import { createClient } from '@supabase/supabase-js'
import { getValidAccessToken } from './lib/meli-token.js'
import { getAfipRazonSocial } from './lib/afip-helper.js'
import { translatePaymentMethod } from './lib/payment-methods.js'

/**
 * Endpoint de sincronización manual.
 * 1. Busca los últimos pagos recibidos en MP (transferencias, QR, etc.)
 * 2. Busca las últimas órdenes de Mercado Libre
 * 3. Inserta los que todavía no estén en la base.
 *
 * GET /api/sync-payments → sincroniza todo
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  console.log('[Sync] Sincronización manual iniciada')

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) throw new Error('Faltan credenciales de Supabase.')

    // Obtener token válido (auto-refresh si expiró)
    const accessToken = await getValidAccessToken()

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    // ─── Obtener el ID del dueño de la cuenta ───
    const meRes = await fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    let myUserId = null
    if (meRes.ok) {
      const me = await meRes.json()
      myUserId = me.id
      console.log(`[Sync] ID de la cuenta: ${myUserId}`)
    }

    // Cache de nombres de usuarios para no repetir llamadas
    const userNameCache = {}


    // ─── Función helper: buscar nombre real de un usuario por su ID ───
    async function getUserName(userId) {
      if (!userId) return null
      const uid = String(userId)
      if (userNameCache[uid]) return userNameCache[uid]

      try {
        const userRes = await fetch(`https://api.mercadolibre.com/users/${uid}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        if (userRes.ok) {
          const userData = await userRes.json()
          const name = userData.first_name && userData.last_name
            ? `${userData.first_name} ${userData.last_name}`
            : userData.nickname || null
          userNameCache[uid] = name
          return name
        }
      } catch (e) {
        console.warn(`[Sync] Error buscando usuario ${uid}:`, e.message)
      }
      return null
    }

    let inserted = 0
    let skipped = 0
    let repaired = 0
    let outgoing = 0
    const results = []

    // ══════════════════════════════════════════════════════════
    //  PARTE 1: Sincronizar PAGOS de Mercado Pago
    //  (transferencias, QR, Point, links de pago)
    // ══════════════════════════════════════════════════════════
    console.log('[Sync] ── Buscando pagos de Mercado Pago ──')

    const searchUrl = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=100&status=approved`
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    if (searchRes.ok) {
      const searchData = await searchRes.json()
      const payments = searchData.results || []
      console.log(`[Sync] Encontrados ${payments.length} pagos MP`)

      for (const payment of payments) {
        const paymentId = String(payment.id)

        // Solo pagos RECIBIDOS
        const collectorId = String(payment.collector_id || '')
        const myId = String(myUserId || '')
        if (myId && collectorId !== myId) {
          outgoing++
          continue
        }

        // Si tiene order.id, es de MeLi → lo procesamos en la Parte 2
        if (payment.order?.id) {
          continue
        }

        // Ya existe?
        const { data: existing } = await supabaseAdmin
          .from('ventas').select('id, datos_fiscales').eq('mp_payment_id', paymentId).maybeSingle()

        if (existing) {
          // MODO REPARACIÓN: Si existe pero le faltan los datos fiscales, los recuperamos
          if (!existing.datos_fiscales) {
            console.log(`[Sync] 🛠️ Reparando datos en pago MP ${paymentId}`)
            const repairRecord = await buildVentaRecord(payment, myUserId, accessToken, getUserName)
            if (repairRecord && !repairRecord.skip) {
              await supabaseAdmin.from('ventas').update({ 
                cliente: repairRecord.cliente,
                datos_fiscales: repairRecord.datos_fiscales 
              }).eq('id', existing.id)
              repaired++
            }
          }
          skipped++
          continue
        }

        // MÚLTIPLE DE DUPLICADOS: Si es un pago de Mercado Libre, ignorarlo por completo.
        // Orders API ya procesa las ventas de Mercado Libre con todos los datos correctos del comprador.
        if (payment.order?.type === 'mercadolibre') {
          console.log(`[Sync] Pago ${paymentId} pertenece a MeLi (Order: ${payment.order.id}). Se ignora por estar manejado por Orders.`)
          skipped++
          continue
        }

        const ventaRecord = await buildVentaRecord(payment, myUserId, accessToken, getUserName)

        const { error: insertError } = await supabaseAdmin.from('ventas').insert([ventaRecord])
        if (insertError) {
          results.push({ paymentId, error: insertError.message })
        } else {
          inserted++
          results.push({ paymentId, cliente: ventaRecord.cliente, monto: payment.transaction_amount, tipo: 'MP', formaPago: ventaRecord.datos_fiscales.forma_pago })
        }
      }
    }

    // ─── Help Function: Construir record de venta desde un pago MP ───
    async function buildVentaRecord(payment, myUserId, accessToken, getUserName) {
        const paymentId = String(payment.id)
        const payer = payment.payer || {}
        let clienteNombre = 'Consumidor Final'
        let docNumber = String(payer.identification?.number || '')
        let docType = payer.identification?.type || 'DNI'
        let email = payer.email || ''
        let resolvedCuit = docNumber
        const payerIdStr = String(payer.id || '')
        const isOwnAccount = payerIdStr === myUserId
        let condicionIvaFallback = null

        // Filtrar CUIT/DNI propio de Martin
        if (docNumber === '20354302684' || docNumber === '35430268') {
          docNumber = ''
          resolvedCuit = ''
          docType = 'DNI'
        }

        if (!isOwnAccount && docNumber && docNumber.length === 11) {
          const afipResult = await getAfipRazonSocial(docNumber)
          if (afipResult) {
            clienteNombre = afipResult.razonSocial
            resolvedCuit = afipResult.cuit
            if (afipResult.condicion_iva) {
              const map = {
                'Monotributista': 'Responsable Monotributo',
                'Responsable Inscripto': 'IVA Responsable Inscripto',
                'Exento': 'IVA Sujeto Exento',
              }
              condicionIvaFallback = map[afipResult.condicion_iva] || afipResult.condicion_iva
            }
          }
        }

        if (clienteNombre === 'Consumidor Final' && !isOwnAccount) {
          if (payer.id && (!payer.first_name || payer.first_name === null)) {
            const realName = await getUserName(payer.id)
            if (realName) clienteNombre = realName
            else if (email) clienteNombre = email.split('@')[0]
          } else if (payer.first_name) {
            clienteNombre = `${payer.first_name} ${payer.last_name || ''}`.trim()
          } else if (email) {
            clienteNombre = email.split('@')[0]
          }
        }

        const formaPago = translatePaymentMethod(payment.payment_type_id, payment.payment_method_id)
        const finalCuit = clienteNombre === 'Consumidor Final' ? '' : resolvedCuit
        const condicionIva = condicionIvaFallback || ((finalCuit && finalCuit.length === 11) ? 'Responsable Inscripto' : 'Consumidor Final')

        return {
          fecha: payment.date_approved || payment.date_created || new Date().toISOString(),
          cliente: clienteNombre,
          monto: payment.transaction_amount || 0,
          status: 'pendiente',
          mp_payment_id: paymentId,
          datos_fiscales: {
            email,
            identification: { type: docType, number: docNumber },
            cuit: finalCuit,
            condicion_iva: condicionIva,
            forma_pago: formaPago,
            mp_status: payment.status,
            mp_method: payment.payment_method_id || '',
            mp_type: payment.payment_type_id || '',
            origen: 'mercadopago',
            descripcion: payment.description || 'Venta Mercado Pago'
          }
        }
    }

    // ══════════════════════════════════════════════════════════
    //  PARTE 2: Sincronizar ÓRDENES de Mercado Libre
    //  (ventas del marketplace)
    //  Para cada orden, buscamos el billing_info del comprador
    //  con una llamada extra a la API para obtener su CUIT real
    // ══════════════════════════════════════════════════════════
    console.log('[Sync] ── Buscando órdenes de Mercado Libre ──')

    if (myUserId) {
      const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${myUserId}&sort=date_desc&limit=50`
      const ordersRes = await fetch(ordersUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json()
        const orders = ordersData.results || []
        console.log(`[Sync] Encontradas ${orders.length} órdenes MeLi`)

        for (const order of orders) {
          const orderId = String(order.id)
          const mpId = `order-${orderId}`

          // Solo órdenes pagadas
          if (order.status !== 'paid') {
            continue
          }

          // Ya existe?
          const { data: existing } = await supabaseAdmin
            .from('ventas').select('id, datos_fiscales').eq('mp_payment_id', mpId).maybeSingle()
          
          if (existing) {
            // REPARACIÓN MeLi:
            if (!existing.datos_fiscales) {
              console.log(`[Sync] 🛠️ Reparando datos en orden MeLi ${orderId}`)
              // (Aquí llamaríamos al helper de construcción pero para ir rápido inyectamos la lógica directa por ahora)
              try {
                const billingRes = await fetch(`https://api.mercadolibre.com/orders/${orderId}/billing_info`, {
                  headers: { 'Authorization': `Bearer ${accessToken}` }
                })
                if (billingRes.ok) {
                  const billingData = await billingRes.json()
                  const b = billingData.billing_info
                  let finalCuit = ''
                  let docNumber = b?.doc_number || ''
                  let docType = b?.doc_type || 'DNI'
                  if (docNumber && docNumber.length === 11) finalCuit = docNumber

                  const firstPayment = order.payments?.[0] || {}
                  const formaPago = translatePaymentMethod(firstPayment.payment_type_id, firstPayment.payment_method_id)

                  await supabaseAdmin.from('ventas').update({ 
                    cliente: b?.name || `${order.buyer?.first_name} ${order.buyer?.last_name}`.trim(),
                    datos_fiscales: {
                      email: order.buyer?.email,
                      identification: { type: docType, number: docNumber },
                      cuit: finalCuit,
                      condicion_iva: (finalCuit.length === 11) ? 'Responsable Inscripto' : 'Consumidor Final',
                      forma_pago: formaPago,
                      meli_order_id: orderId,
                      origen: 'mercadolibre',
                      descripcion: order.order_items?.[0]?.item?.title || `Venta MeLi #${orderId}`
                    }
                  }).eq('id', existing.id)
                  repaired++
                }
              } catch (e) {}
            }
            skipped++; continue 
          }

          // También verificar por payment IDs individuales
          const orderPaymentIds = (order.payments || []).map(p => String(p.id))
          if (orderPaymentIds.length > 0) {
            const { data: existingByPayment } = await supabaseAdmin
              .from('ventas').select('id').in('mp_payment_id', orderPaymentIds).limit(1)
            if (existingByPayment && existingByPayment.length > 0) {
              skipped++
              continue
            }
          }

          // ─── Datos del comprador ───
          const buyer = order.buyer || {}
          let clienteNombre = 'Consumidor Final'
          let docNumber = ''
          let docType = 'DNI'
          let email = buyer.email || ''
          let extractedBillingName = ''

          // ─── LLAMADA EXTRA: obtener billing_info real del comprador ───
          // La API de /orders/search NO trae billing_info completo,
          // hay que pedirlo aparte para cada orden
          try {
            const billingRes = await fetch(
              `https://api.mercadolibre.com/orders/${orderId}/billing_info`,
              { headers: { 'Authorization': `Bearer ${accessToken}` } }
            )
            if (billingRes.ok) {
              const billingData = await billingRes.json()
              const billingInfo = billingData.billing_info || billingData
              
              // billing_info puede tener distintos formatos según la versión de la API
              if (billingInfo.doc_number) {
                docNumber = String(billingInfo.doc_number)
                docType = billingInfo.doc_type || 'DNI'
              } else if (billingInfo.additional_info) {
                // A veces viene como array de {type, value}
                const docField = billingInfo.additional_info.find(f => 
                  f.type === 'DOC_NUMBER' || f.type === 'TAXPAYER_ID_NUMBER'
                )
                const docTypeField = billingInfo.additional_info.find(f => 
                  f.type === 'DOC_TYPE' || f.type === 'TAXPAYER_ID_TYPE'
                )
                if (docField) docNumber = String(docField.value)
                if (docTypeField) docType = docTypeField.value || 'DNI'
              }
              
              // Intentar extraer el nombre real directamente de los datos de facturación
              let bName = billingInfo.name || billingInfo.business_name || billingInfo.corporate_name || ''
              let bLastName = billingInfo.last_name || ''
              
              if (!bName && billingInfo.additional_info) {
                const bNameF = billingInfo.additional_info.find(f => f.type === 'BUSINESS_NAME' || f.type === 'CORPORATE_NAME')
                const fNameF = billingInfo.additional_info.find(f => f.type === 'FIRST_NAME')
                const lNameF = billingInfo.additional_info.find(f => f.type === 'LAST_NAME')
                
                if (bNameF) {
                  bName = String(bNameF.value)
                } else if (fNameF) {
                  bName = String(fNameF.value)
                  if (lNameF) bLastName = String(lNameF.value)
                }
              }
              
              extractedBillingName = `${bName} ${bLastName}`.trim()
              console.log(`[Sync] Billing info orden ${orderId}: doc=${docNumber}, type=${docType}, name=${extractedBillingName}`)
            } else {
              console.warn(`[Sync] No se pudo obtener billing_info para orden ${orderId}: ${billingRes.status}`)
            }
          } catch (billingErr) {
            console.warn(`[Sync] Error obteniendo billing_info ${orderId}:`, billingErr.message)
          }

          // Fallback: intentar datos del buyer del search
          if (!docNumber) {
            if (buyer.billing_info?.doc_number) {
              docNumber = String(buyer.billing_info.doc_number)
              docType = buyer.billing_info.doc_type || 'DNI'
            } else if (buyer.identification?.number) {
              docNumber = String(buyer.identification.number)
              docType = buyer.identification.type || 'DNI'
            }
          }

          let isOwnAccount = false
          // Filtrar CUIT/DNI propio de Martin
          if (docNumber === '20354302684' || docNumber === '35430268') {
            docNumber = ''
            extractedBillingName = ''
            clienteNombre = 'Consumidor Final'
            isOwnAccount = true
          }

          // 1. Consultar AFIP SOLO si es un CUIT (11 dígitos)
          let resolvedCuit = docNumber
          let condicionIvaFallback = null
          if (docNumber && docNumber.length === 11) {
            const afipResult = await getAfipRazonSocial(docNumber)
            if (afipResult) {
              clienteNombre = afipResult.razonSocial
              resolvedCuit = afipResult.cuit
              if (afipResult.condicion_iva) condicionIvaFallback = afipResult.condicion_iva
            }
          }

          // 2. Si AFIP no devolvió nada, intentar usar nombres extraídos
          if (clienteNombre === 'Consumidor Final' && !isOwnAccount) {
            if (extractedBillingName) {
              clienteNombre = extractedBillingName
            } else if (buyer.first_name) {
              clienteNombre = `${buyer.first_name} ${buyer.last_name || ''}`.trim()
            } else if (buyer.id) {
              try {
                // Consultar el nombre real del usuario (evitar el nickname)
                const userRes = await fetch(`https://api.mercadolibre.com/users/${buyer.id}`, {
                  headers: { 'Authorization': `Bearer ${accessToken}` }
                })
                if (userRes.ok) {
                  const userData = await userRes.json()
                  if (userData.company && userData.company.corporate_name) {
                    clienteNombre = userData.company.corporate_name
                  } else if (userData.first_name) {
                    clienteNombre = `${userData.first_name} ${userData.last_name || ''}`.trim()
                  }
                }
              } catch (e) {}
            }
            
            // Fallback final
            if (clienteNombre === 'Consumidor Final' && buyer.nickname) {
              clienteNombre = buyer.nickname
            }
          }

          // Forma de pago
          const firstPayment = order.payments?.[0]
          const paymentTypeMap = {
            'credit_card': 'Tarjeta de Crédito',
            'debit_card': 'Tarjeta de Débito',
            'account_money': 'Mercado Pago',
            'ticket': 'Efectivo',
            'bank_transfer': 'Transferencia'
          }
          const formaPago = paymentTypeMap[firstPayment?.payment_type] || firstPayment?.payment_type || 'Mercado Libre'

          // Si es Consumidor Final, NO guardar CUIT
          const finalCuit = clienteNombre === 'Consumidor Final' ? '' : resolvedCuit
          const condicionIva = condicionIvaFallback || ((finalCuit && finalCuit.length === 11) ? 'Responsable Inscripto' : 'Consumidor Final')

          const ventaRecord = {
            fecha: order.date_created || new Date().toISOString(),
            cliente: clienteNombre,
            monto: order.total_amount || 0,
            status: 'pendiente',
            mp_payment_id: mpId,
            datos_fiscales: {
              email,
              identification: { type: docType, number: docNumber },
              cuit: finalCuit,
              condicion_iva: condicionIva,
              forma_pago: formaPago,
              meli_order_id: orderId,
              meli_payment_ids: orderPaymentIds,
              meli_status: order.status,
              origen: 'mercadolibre',
              descripcion: order.order_items?.[0]?.item?.title || `Venta MeLi #${orderId}`
            }
          }

          const { error: insertError } = await supabaseAdmin.from('ventas').insert([ventaRecord])
          if (insertError) {
            results.push({ orderId, error: insertError.message })
          } else {
            inserted++
            results.push({ orderId, cliente: clienteNombre, monto: order.total_amount, tipo: 'MeLi', formaPago })
          }
        }
      } else {
        const errText = await ordersRes.text()
        console.error('[Sync] Error buscando órdenes MeLi:', errText)
        results.push({ meliOrdersError: errText })
      }
    }

    console.log(`[Sync] Completado: ${inserted} nuevos, ${skipped} ya existían, ${outgoing} salientes ignorados`)

    return res.status(200).json({
      success: true,
      inserted,
      skipped,
      repaired,
      outgoing,
      results
    })

  } catch (err) {
    console.error('[Sync] ERROR:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
