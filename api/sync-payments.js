import { createClient } from '@supabase/supabase-js'
import Afip from '@afipsdk/afip.js'
import { getValidAccessToken } from './lib/meli-token.js'

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

    // ─── Configurar AFIP para consultas (si están las credenciales) ───
    let afipInstance = null
    const afipCuit = process.env.AFIP_CUIT
    const certBase64 = process.env.AFIP_CERT_BASE64
    const keyBase64 = process.env.AFIP_KEY_BASE64
    if (afipCuit && certBase64 && keyBase64) {
      try {
        afipInstance = new Afip({
          CUIT: parseInt(afipCuit),
          cert: Buffer.from(certBase64, 'base64').toString('utf-8'),
          key: Buffer.from(keyBase64, 'base64').toString('utf-8'),
          production: process.env.AFIP_PRODUCTION === 'true'
        })
      } catch (err) {
        console.warn('[Sync] No se pudo instanciar AFIP:', err.message)
      }
    }

    // Cache de nombres de usuarios para no repetir llamadas
    const userNameCache = {}
    const afipNameCache = {}

    // ─── Función helper: buscar Razón Social en AFIP a partir del CUIT ───
    async function getAfipRazonSocial(cuitNumber) {
      if (!afipInstance || !cuitNumber || String(cuitNumber).length !== 11) return null
      const cuitStr = String(cuitNumber)
      if (afipNameCache[cuitStr]) return afipNameCache[cuitStr]

      try {
        console.log(`[Sync] Consultando AFIP para CUIT: ${cuitStr}`)
        const data = await afipInstance.RegisterScopeFive.getTaxpayerDetails(cuitStr)
        if (data && data.datosGenerales) {
          let name = data.datosGenerales.razonSocial || ''
          if (!name && data.datosGenerales.nombre) {
            name = `${data.datosGenerales.nombre} ${data.datosGenerales.apellido || ''}`.trim()
          }
          if (name) {
             afipNameCache[cuitStr] = name
             return name
          }
        }
      } catch (e) {
        console.warn(`[Sync] Error consultando AFIP para ${cuitStr}: ${e.message}`)
      }
      return null
    }

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
    let outgoing = 0
    const results = []

    // ══════════════════════════════════════════════════════════
    //  PARTE 1: Sincronizar PAGOS de Mercado Pago
    //  (transferencias, QR, Point, links de pago)
    // ══════════════════════════════════════════════════════════
    console.log('[Sync] ── Buscando pagos de Mercado Pago ──')

    const searchUrl = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=20&status=approved`
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
          .from('ventas').select('id').eq('mp_payment_id', paymentId).maybeSingle()
        if (existing) { skipped++; continue }

        // ─── Extraer nombre del cliente ───
        const payer = payment.payer || {}
        let clienteNombre = 'Consumidor Final'
        let docNumber = String(payer.identification?.number || '')
        let docType = payer.identification?.type || 'DNI'
        let email = payer.email || ''

        // 1. Prioridad: Consultar AFIP si es un CUIT válido (11 dígitos)
        if (docNumber && docNumber.length === 11) {
          const afipName = await getAfipRazonSocial(docNumber)
          if (afipName) {
            clienteNombre = afipName
          }
        }

        // 2. Si no vino de AFIP, intentar procesar los demás datos del payer...
        if (clienteNombre === 'Consumidor Final') {
          // Para transferencias: buscar el nombre real del usuario por su ID
          // PERO: si el payer.id es el mismo que el dueño de la cuenta,
          // es una transferencia bancaria donde MP no sabe quién envió → dejar como Consumidor Final
          const payerIdStr = String(payer.id || '')
          if (payer.id && payerIdStr !== myId && (!payer.first_name || payer.first_name === null)) {
            const realName = await getUserName(payer.id)
            if (realName) {
              clienteNombre = realName
            } else if (email) {
              clienteNombre = email.split('@')[0]
            }
          } else if (payer.first_name) {
            clienteNombre = `${payer.first_name} ${payer.last_name || ''}`.trim()
          } else if (email && payerIdStr !== myId) {
            clienteNombre = email.split('@')[0]
          }
        }

        // Forma de pago
        const typeId = payment.payment_type_id || ''
        const methodMap = {
          'credit_card': 'Tarjeta de Crédito',
          'debit_card': 'Tarjeta de Débito',
          'account_money': 'Mercado Pago',
          'ticket': 'Efectivo',
          'bank_transfer': 'Transferencia',
          'transfer': 'Transferencia'
        }
        const formaPago = methodMap[typeId] || payment.payment_method_id || 'Mercado Pago'

        const ventaRecord = {
          fecha: payment.date_approved || payment.date_created || new Date().toISOString(),
          cliente: clienteNombre,
          monto: payment.transaction_amount || 0,
          status: 'pendiente',
          mp_payment_id: paymentId,
          datos_fiscales: {
            email,
            identification: { type: docType, number: docNumber },
            cuit: docNumber,
            forma_pago: formaPago,
            mp_status: payment.status,
            mp_method: payment.payment_method_id || '',
            mp_type: payment.payment_type_id || '',
            origen: 'mercadopago',
            descripcion: payment.description || 'Venta Mercado Pago'
          }
        }

        const { error: insertError } = await supabaseAdmin.from('ventas').insert([ventaRecord])
        if (insertError) {
          results.push({ paymentId, error: insertError.message })
        } else {
          inserted++
          results.push({ paymentId, cliente: clienteNombre, monto: payment.transaction_amount, tipo: 'MP', formaPago })
        }
      }
    }

    // ══════════════════════════════════════════════════════════
    //  PARTE 2: Sincronizar ÓRDENES de Mercado Libre
    //  (ventas del marketplace)
    // ══════════════════════════════════════════════════════════
    console.log('[Sync] ── Buscando órdenes de Mercado Libre ──')

    if (myUserId) {
      const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${myUserId}&sort=date_desc&limit=20`
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
            .from('ventas').select('id').eq('mp_payment_id', mpId).maybeSingle()
          if (existing) { skipped++; continue }

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

          // Intentar obtener doc de billing_info
          if (buyer.billing_info?.doc_number) {
            docNumber = String(buyer.billing_info.doc_number)
            docType = buyer.billing_info.doc_type || 'DNI'
          } else if (buyer.identification?.number) {
            docNumber = String(buyer.identification.number)
            docType = buyer.identification.type || 'DNI'
          }

          // 1. Prioridad: Consultar AFIP si es un CUIT válido
          if (docNumber && docNumber.length === 11) {
            const afipName = await getAfipRazonSocial(docNumber)
            if (afipName) {
              clienteNombre = afipName
            }
          }

          if (clienteNombre === 'Consumidor Final') {
            if (buyer.first_name) {
              clienteNombre = `${buyer.first_name} ${buyer.last_name || ''}`.trim()
            } else if (buyer.nickname) {
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

          const ventaRecord = {
            fecha: order.date_created || new Date().toISOString(),
            cliente: clienteNombre,
            monto: order.total_amount || 0,
            status: 'pendiente',
            mp_payment_id: mpId,
            datos_fiscales: {
              email,
              identification: { type: docType, number: docNumber },
              cuit: docNumber,
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
      outgoing,
      results
    })

  } catch (err) {
    console.error('[Sync] ERROR:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
