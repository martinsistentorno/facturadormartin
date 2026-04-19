import { createClient } from '@supabase/supabase-js'

/**
 * Endpoint de sincronización manual.
 * Consulta los últimos pagos recibidos en la cuenta de MP
 * e inserta los que todavía no estén en la base.
 *
 * GET /api/sync-payments → sincroniza los últimos 20 pagos recibidos
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
    const accessToken = process.env.MELI_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Faltan credenciales de Supabase.')
    }
    if (!accessToken) {
      throw new Error('Falta MELI_ACCESS_TOKEN.')
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    // ─── Obtener el ID del dueño de la cuenta para filtrar pagos salientes ───
    const meRes = await fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    let myUserId = null
    if (meRes.ok) {
      const me = await meRes.json()
      myUserId = me.id
      console.log(`[Sync] ID de la cuenta: ${myUserId}`)
    } else {
      console.warn('[Sync] No se pudo obtener el ID de la cuenta, se procesarán todos los pagos')
    }

    // Consultar los últimos pagos recibidos (status=approved)
    const searchUrl = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=20&status=approved`
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    if (!searchRes.ok) {
      const errText = await searchRes.text()
      throw new Error(`MP Search API ${searchRes.status}: ${errText}`)
    }

    const searchData = await searchRes.json()
    const payments = searchData.results || []

    console.log(`[Sync] Encontrados ${payments.length} pagos aprobados recientes`)

    let inserted = 0
    let skipped = 0
    let outgoing = 0
    const results = []

    for (const payment of payments) {
      const paymentId = String(payment.id)

      // ─── Solo aceptar pagos RECIBIDOS ───
      // Un pago es "recibido" cuando el dueño de la cuenta es el COLLECTOR (cobrador)
      const collectorId = String(payment.collector_id || '')
      const myId = String(myUserId || '')

      console.log(`[Sync] Pago ${paymentId}: collector=${collectorId}, myId=${myId}, op=${payment.operation_type || 'N/A'}, monto=$${payment.transaction_amount}`)

      if (myId && collectorId !== myId) {
        outgoing++
        console.log(`[Sync] Pago ${paymentId} NO es para esta cuenta (collector=${collectorId}), saltando`)
        continue
      }

      // Verificar si ya existe
      const { data: existing } = await supabaseAdmin
        .from('ventas').select('id').eq('mp_payment_id', paymentId).maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      // ─── Detectar si viene de Mercado Libre ───
      const isMeLiOrder = !!payment.order?.id
      const origen = isMeLiOrder ? 'mercadolibre' : 'mercadopago'
      const mpId = isMeLiOrder ? `order-${payment.order.id}` : paymentId

      // Si es de MeLi, verificar que no exista ya por el order ID
      if (isMeLiOrder) {
        const { data: existingOrder } = await supabaseAdmin
          .from('ventas').select('id').eq('mp_payment_id', mpId).maybeSingle()
        if (existingOrder) {
          skipped++
          continue
        }
      }

      // ─── Extraer datos completos del cliente ───
      const payer = payment.payer || {}
      let clienteNombre = 'Consumidor Final'
      let docNumber = payer.identification?.number || ''
      let docType = payer.identification?.type || 'DNI'
      let email = payer.email || ''

      if (isMeLiOrder) {
        // En Mercado Libre, consultamos la orden para obtener los verdaderos datos del comprador
        try {
          const orderRes = await fetch(`https://api.mercadolibre.com/orders/${payment.order.id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          })
          if (orderRes.ok) {
            const order = await orderRes.json()
            const buyer = order.buyer || {}
            if (buyer.first_name) {
              clienteNombre = `${buyer.first_name} ${buyer.last_name || ''}`.trim()
            } else if (buyer.nickname) {
              clienteNombre = buyer.nickname
            }
            docNumber = buyer.billing_info?.doc_number || buyer.identification?.number || docNumber
            docType = buyer.billing_info?.doc_type || docType
            email = buyer.email || email
          }
        } catch (err) {
          console.warn(`[Sync] Error al obtener la orden de MeLi ${payment.order.id}:`, err)
        }
      } else {
        // En Mercado Pago, intentar sacar el nombre de 여러 lados
        if (payment.point_of_interaction?.transaction_data?.bank_info?.payer_info?.name) {
          // Transferencias bancarias CVU
          clienteNombre = payment.point_of_interaction.transaction_data.bank_info.payer_info.name
        } else if (payer.first_name) {
          // Pagos estándar MP
          clienteNombre = `${payer.first_name} ${payer.last_name || ''}`.trim()
        } else if (payer.entity_type === 'individual' && payer.identification?.number) {
          clienteNombre = `DNI ${payer.identification.number}`
        } else if (payer.email) {
          clienteNombre = payer.email.split('@')[0]
        }
      }

      // ─── Determinar forma de pago ───
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
        mp_payment_id: mpId,
        datos_fiscales: {
          email: email,
          identification: { type: docType, number: docNumber },
          cuit: docNumber,
          forma_pago: formaPago,
          mp_status: payment.status,
          mp_method: payment.payment_method_id || '',
          mp_type: payment.payment_type_id || '',
          origen
        }
      }

      const { error: insertError } = await supabaseAdmin.from('ventas').insert([ventaRecord])
      if (insertError) {
        console.error(`[Sync] Error insertando pago ${paymentId}:`, insertError.message)
        results.push({ paymentId, error: insertError.message })
      } else {
        inserted++
        results.push({ paymentId, cliente: clienteNombre, monto: payment.transaction_amount, formaPago })
        console.log(`[Sync] ✅ Pago ${paymentId} insertado (${clienteNombre} - $${payment.transaction_amount})`)
      }
    }

    console.log(`[Sync] Completado: ${inserted} nuevos, ${skipped} ya existían, ${outgoing} salientes ignorados`)

    return res.status(200).json({
      success: true,
      total: payments.length,
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
