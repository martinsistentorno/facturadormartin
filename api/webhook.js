import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  console.log('[Webhook] Nueva notificación recibida')

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const accessToken = process.env.MELI_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Faltan credenciales de Supabase en el servidor.')
    }
    if (!accessToken) {
      throw new Error('Falta MELI_ACCESS_TOKEN en el servidor.')
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)
    const body = req.body

    console.log('[Webhook] Body:', JSON.stringify(body))

    if (!body) return res.status(200).json({ received: true, processed: false, reason: 'Empty payload' })

    const topic = body.topic || body.type

    // ════════════════════════════════════════════════════
    //  ORDEN de Mercado Libre (Marketplace)
    //  topic: "orders_v2"
    // ════════════════════════════════════════════════════
    if (topic === 'orders_v2') {
      const orderId = body.resource?.split('/')?.pop()
      if (!orderId) return res.status(200).json({ processed: false, reason: 'No order ID' })
      console.log('[Webhook] → MeLi Order:', orderId)

      // Duplicado por orderId
      const { data: existingOrder } = await supabaseAdmin
        .from('ventas').select('id').eq('mp_payment_id', `order-${orderId}`).maybeSingle()
      if (existingOrder) return res.status(200).json({ received: true, duplicate: true })

      // Consultar la orden completa
      const orderRes = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (!orderRes.ok) {
        const errText = await orderRes.text()
        throw new Error(`MeLi Orders API ${orderRes.status}: ${errText}`)
      }
      const order = await orderRes.json()

      // Si la orden tiene pagos, verificar que no exista ya insertada por el webhook de payment
      const orderPaymentIds = (order.payments || []).map(p => String(p.id))
      if (orderPaymentIds.length > 0) {
        const { data: existingByPayment } = await supabaseAdmin
          .from('ventas').select('id').in('mp_payment_id', orderPaymentIds).limit(1)
        if (existingByPayment && existingByPayment.length > 0) {
          console.log('[Webhook] Orden ya registrada via payment, saltando')
          return res.status(200).json({ received: true, duplicate: true })
        }
      }

      // Construir datos del cliente
      const buyer = order.buyer || {}
      const clienteNombre = buyer.first_name
        ? `${buyer.first_name} ${buyer.last_name || ''}`.trim()
        : buyer.nickname || `Venta MeLi #${orderId}`

      const docNumber = buyer.billing_info?.doc_number || buyer.identification?.number || ''

      // Forma de pago desde los pagos de la orden
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
        // Prefijo "order-" para diferenciar del paymentId puro
        mp_payment_id: `order-${orderId}`,
        datos_fiscales: {
          email: buyer.email || '',
          identification: { type: buyer.billing_info?.doc_type || 'DNI', number: docNumber },
          cuit: docNumber,
          forma_pago: formaPago,
          meli_order_id: orderId,
          meli_payment_ids: orderPaymentIds,
          meli_status: order.status,
          origen: 'mercadolibre'
        }
      }

      const { error: insertError } = await supabaseAdmin.from('ventas').insert([ventaRecord])
      if (insertError) throw new Error(`DB Insert Error: ${insertError.message}`)

      console.log('[Webhook] MeLi Order registrada OK')
      return res.status(200).json({ received: true, processed: true, orderId })
    }

    // ════════════════════════════════════════════════════
    //  PAGO de Mercado Pago (QR, Point, Link de Pago)
    //  topic: "payment" o action contiene "payment"
    // ════════════════════════════════════════════════════
    if (topic === 'payment' || body.action?.includes('payment')) {
      const paymentId = String(body.data?.id || body.resource?.split('/')?.pop() || '')
      if (!paymentId) return res.status(200).json({ processed: false, reason: 'No payment ID' })
      console.log('[Webhook] → MePa Payment:', paymentId)

      // Duplicado directo
      const { data: existingPayment } = await supabaseAdmin
        .from('ventas').select('id').eq('mp_payment_id', paymentId).maybeSingle()
      if (existingPayment) return res.status(200).json({ received: true, duplicate: true })

      // Duplicado cruzado: si ya entró como order y la order tiene este paymentId
      // Buscamos en datos_fiscales->meli_payment_ids
      const { data: existingViaOrder } = await supabaseAdmin
        .from('ventas')
        .select('id')
        .contains('datos_fiscales', { meli_payment_ids: [paymentId] })
        .limit(1)
      if (existingViaOrder && existingViaOrder.length > 0) {
        console.log('[Webhook] Pago ya registrado via order, saltando')
        return res.status(200).json({ received: true, duplicate: true })
      }

      // Consultar la info del pago
      const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (!payRes.ok) {
        const errText = await payRes.text()
        throw new Error(`MePa Payments API ${payRes.status}: ${errText}`)
      }
      const payment = await payRes.json()

      // Si es un pago de una orden de MeLi, ignorar (ya lo maneja orders_v2)
      if (payment.order?.id) {
        const meliOrderId = String(payment.order.id)
        const { data: existingMeliOrder } = await supabaseAdmin
          .from('ventas').select('id').eq('mp_payment_id', `order-${meliOrderId}`).maybeSingle()
        if (existingMeliOrder) {
          console.log('[Webhook] Pago pertenece a orden MeLi ya registrada, saltando')
          return res.status(200).json({ received: true, duplicate: true })
        }
      }

      // Solo procesar pagos aprobados
      if (payment.status !== 'approved') {
        console.log(`[Webhook] Pago no aprobado: ${payment.status}`)
        return res.status(200).json({ received: true, processed: false, reason: `Status: ${payment.status}` })
      }

      // Datos del pagador
      const payer = payment.payer || {}
      let clienteNombre = 'Consumidor Final'
      if (payer.first_name) clienteNombre = `${payer.first_name} ${payer.last_name || ''}`.trim()
      else if (payer.email) clienteNombre = payer.email.split('@')[0]

      // Método de pago
      const typeId = payment.payment_type_id || ''
      const methodMap = {
        'credit_card': 'Tarjeta de Crédito',
        'debit_card': 'Tarjeta de Débito',
        'account_money': 'Mercado Pago',
        'ticket': 'Efectivo',
        'bank_transfer': 'Transferencia'
      }
      const formaPago = methodMap[typeId] || 'Mercado Pago'

      const ventaRecord = {
        fecha: payment.date_approved || payment.date_created || new Date().toISOString(),
        cliente: clienteNombre,
        monto: payment.transaction_amount || 0,
        status: 'pendiente',
        mp_payment_id: paymentId,
        datos_fiscales: {
          email: payer.email || '',
          identification: { type: payer.identification?.type || 'DNI', number: payer.identification?.number || '' },
          cuit: payer.identification?.number || '',
          forma_pago: formaPago,
          mp_status: payment.status,
          mp_method: payment.payment_method_id || '',
          origen: 'mercadopago'
        }
      }

      const { error: insertError } = await supabaseAdmin.from('ventas').insert([ventaRecord])
      if (insertError) throw new Error(`DB Insert Error: ${insertError.message}`)

      console.log('[Webhook] MePa Payment registrado OK')
      return res.status(200).json({ received: true, processed: true, paymentId })
    }

    // Cualquier otro tópico (merchant_orders, messages, etc.)
    console.log(`[Webhook] Tópico no manejado: ${topic}`)
    return res.status(200).json({ received: true, processed: false, reason: `Tópico ignorado: ${topic}` })

  } catch (err) {
    console.error('[Webhook] ERROR CRÍTICO:', err.message)
    // Siempre respondemos 200 para que MeLi/MP no re-envíe infinitamente
    return res.status(200).json({ error: err.message })
  }
}
