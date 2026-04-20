import { createClient } from '@supabase/supabase-js'
import Afip from '@afipsdk/afip.js'

// ─── Configurar AFIP para consultas globales (si están las credenciales) ───
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
    console.warn('[Webhook] No se pudo instanciar AFIP:', err.message)
  }
}

const afipNameCache = {}
async function getAfipRazonSocial(cuitNumber) {
  if (!afipInstance || !cuitNumber || String(cuitNumber).length !== 11) return null
  const cuitStr = String(cuitNumber)
  if (afipNameCache[cuitStr]) return afipNameCache[cuitStr]

  try {
    console.log(`[Webhook] Consultando AFIP para CUIT: ${cuitStr}`)
    const data = await afipInstance.RegisterScopeFive.GetTaxpayerDetails(cuitStr)
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
    console.warn(`[Webhook] Error consultando AFIP para ${cuitStr}: ${e.message}`)
  }
  return null
}
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Mercado Pago a veces manda GET para verificar que la URL está viva
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', message: 'Webhook activo' })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  console.log('═══════════════════════════════════════════════')
  console.log('[Webhook] Nueva notificación recibida')
  console.log('[Webhook] Headers:', JSON.stringify({
    'content-type': req.headers['content-type'],
    'x-signature': req.headers['x-signature'],
    'x-request-id': req.headers['x-request-id'],
    'user-agent': req.headers['user-agent']
  }))

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

    // Log COMPLETO del body para diagnóstico
    console.log('[Webhook] Body COMPLETO:', JSON.stringify(body, null, 2))
    console.log('[Webhook] Query params:', JSON.stringify(req.query))

    if (!body || Object.keys(body).length === 0) {
      console.log('[Webhook] Body vacío, revisando query params...')
      // A veces MP manda datos como query params
      if (req.query?.topic && req.query?.id) {
        console.log('[Webhook] Datos en query params, redirigiendo...')
        return await processPayment(supabaseAdmin, accessToken, req.query.id, res)
      }
      return res.status(200).json({ received: true, processed: false, reason: 'Empty payload' })
    }

    const topic = body.topic || body.type || ''
    const action = body.action || ''

    console.log(`[Webhook] Topic: "${topic}" | Action: "${action}"`)

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
      let clienteNombre = buyer.first_name
        ? `${buyer.first_name} ${buyer.last_name || ''}`.trim()
        : buyer.nickname || `Venta MeLi #${orderId}`

      const docNumber = buyer.billing_info?.doc_number || buyer.identification?.number || ''

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
    //  PAGO de Mercado Pago (QR, Point, Link, Transferencia)
    //  topic: "payment" o action contiene "payment"
    //  También capturamos "merchant_order" por si viene así
    // ════════════════════════════════════════════════════
    if (
      topic === 'payment' ||
      topic === 'merchant_order' ||
      action.includes('payment') ||
      body.data?.id
    ) {
      let paymentId = ''

      if (topic === 'merchant_order') {
        // Si es merchant_order, extraemos los pagos de la orden comercial
        const moId = body.data?.id || body.resource?.split('/')?.pop()
        console.log('[Webhook] → Merchant Order:', moId)

        const moRes = await fetch(`https://api.mercadopago.com/merchant_orders/${moId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        if (moRes.ok) {
          const mo = await moRes.json()
          console.log('[Webhook] Merchant Order payments:', JSON.stringify(mo.payments))
          // Procesar cada pago de la merchant order
          const approvedPayments = (mo.payments || []).filter(p => p.status === 'approved')
          if (approvedPayments.length === 0) {
            console.log('[Webhook] Merchant Order sin pagos aprobados')
            return res.status(200).json({ received: true, processed: false, reason: 'No approved payments in MO' })
          }
          paymentId = String(approvedPayments[0].id)
        } else {
          const errText = await moRes.text()
          console.error('[Webhook] Error al consultar Merchant Order:', errText)
          // Intentar procesar como payment directo
          paymentId = String(body.data?.id || '')
        }
      } else {
        paymentId = String(body.data?.id || body.resource?.split('/')?.pop() || '')
      }

      if (!paymentId) return res.status(200).json({ processed: false, reason: 'No payment ID' })

      return await processPayment(supabaseAdmin, accessToken, paymentId, res)
    }

    // ════════════════════════════════════════════════════
    //  CATCH-ALL: Cualquier otro tópico
    //  Lo registramos completo para diagnóstico
    // ════════════════════════════════════════════════════
    console.log(`[Webhook] ⚠️ Tópico NO MANEJADO: "${topic}"`)
    console.log(`[Webhook] Body completo del tópico no manejado:`, JSON.stringify(body, null, 2))

    // Si tiene un data.id, intentamos procesarlo como pago de todas formas
    if (body.data?.id) {
      console.log('[Webhook] Tiene data.id, intentando como pago...')
      return await processPayment(supabaseAdmin, accessToken, String(body.data.id), res)
    }

    return res.status(200).json({ received: true, processed: false, reason: `Tópico ignorado: ${topic}` })

  } catch (err) {
    console.error('[Webhook] ERROR CRÍTICO:', err.message)
    // Siempre respondemos 200 para que MeLi/MP no re-envíe infinitamente
    return res.status(200).json({ error: err.message })
  }
}

// ════════════════════════════════════════════════════════════
//  Función compartida para procesar un Payment por su ID
// ════════════════════════════════════════════════════════════
async function processPayment(supabaseAdmin, accessToken, paymentId, res) {
  console.log('[Webhook] → Procesando Payment:', paymentId)

  // Duplicado directo
  const { data: existingPayment } = await supabaseAdmin
    .from('ventas').select('id').eq('mp_payment_id', paymentId).maybeSingle()
  if (existingPayment) {
    console.log('[Webhook] Pago duplicado, saltando')
    return res.status(200).json({ received: true, duplicate: true })
  }

  // Duplicado cruzado: si ya entró como order y la order tiene este paymentId
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

  console.log('[Webhook] Payment status:', payment.status, '| type:', payment.payment_type_id, '| method:', payment.payment_method_id)

  // ─── Solo aceptar pagos RECIBIDOS ───
  // Si el dueño de la cuenta NO es el collector, es un gasto/envío, no una venta
  try {
    const meRes = await fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    if (meRes.ok) {
      const me = await meRes.json()
      const myId = String(me.id)
      const collectorId = String(payment.collector_id || '')

      console.log(`[Webhook] Pago ${paymentId}: collector=${collectorId}, myId=${myId}`)

      if (collectorId && collectorId !== myId) {
        console.log(`[Webhook] Pago ${paymentId} NO es para esta cuenta, ignorando`)
        return res.status(200).json({ received: true, processed: false, reason: 'Pago no recibido por esta cuenta' })
      }
    }
  } catch (meErr) {
    console.warn('[Webhook] No se pudo verificar collector:', meErr.message)
  }

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

  // ─── Extraer datos completos del pagador ───
  const payer = payment.payer || {}
  let clienteNombre = 'Consumidor Final'
  let docNumber = payer.identification?.number || ''
  let docType = payer.identification?.type || 'DNI'

  // 1. Prioridad: Consultar AFIP si es un CUIT válido
  if (docNumber && docNumber.length === 11) {
    const afipName = await getAfipRazonSocial(docNumber)
    if (afipName) {
      clienteNombre = afipName
    }
  }

  // Obtener myId para comparar (reutilizar si ya lo sacamos antes)
  let ownerIdStr = ''
  try {
    const meCheck = await fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    if (meCheck.ok) {
      const meData = await meCheck.json()
      ownerIdStr = String(meData.id)
    }
  } catch (_) {}

  const payerIdStr = String(payer.id || '')

  if (clienteNombre === 'Consumidor Final') {
    // Para transferencias: buscar el nombre real del usuario por su ID
    // PERO si payer.id === dueño de la cuenta → es transferencia bancaria sin datos del remitente
    if (payer.id && payerIdStr !== ownerIdStr && (!payer.first_name || payer.first_name === null)) {
    try {
      const userRes = await fetch(`https://api.mercadolibre.com/users/${payer.id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (userRes.ok) {
        const userData = await userRes.json()
        clienteNombre = userData.first_name && userData.last_name
          ? `${userData.first_name} ${userData.last_name}`
          : userData.nickname || (payer.email ? payer.email.split('@')[0] : 'Consumidor Final')
      } else if (payer.email) {
        clienteNombre = payer.email.split('@')[0]
      }
    } catch (e) {
      if (payer.email) clienteNombre = payer.email.split('@')[0]
    }
  } else if (payer.first_name) {
    clienteNombre = `${payer.first_name} ${payer.last_name || ''}`.trim()
  } else if (payer.email && payerIdStr !== ownerIdStr) {
    clienteNombre = payer.email.split('@')[0]
  }
  }

  // Método de pago
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
      email: payer.email || '',
      identification: { type: payer.identification?.type || 'DNI', number: payer.identification?.number || '' },
      cuit: payer.identification?.number || '',
      forma_pago: formaPago,
      mp_status: payment.status,
      mp_method: payment.payment_method_id || '',
      mp_type: payment.payment_type_id || '',
      origen: 'mercadopago'
    }
  }

  const { error: insertError } = await supabaseAdmin.from('ventas').insert([ventaRecord])
  if (insertError) throw new Error(`DB Insert Error: ${insertError.message}`)

  console.log(`[Webhook] ✅ Payment ${paymentId} registrado OK (${formaPago})`)
  return res.status(200).json({ received: true, processed: true, paymentId })
}
