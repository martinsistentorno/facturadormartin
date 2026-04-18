import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // Configuración de CORS básica para pruebas
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  console.log('[Webhook MeLi] Nueva notificación recibida')

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables de Supabase faltantes en el servidor (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)
    const body = req.body

    console.log('[Webhook MeLi] Body:', JSON.stringify(body))

    if (!body || !body.topic || !body.resource) {
      return res.status(200).json({ 
        received: true, 
        processed: false, 
        reason: 'Payload inválido o vacío (requiere topic y resource)' 
      })
    }

    if (body.topic !== 'orders_v2') {
      return res.status(200).json({ 
        received: true, 
        processed: false, 
        reason: `Tópico ignorado: ${body.topic}` 
      })
    }

    const orderResourceUrl = body.resource
    const orderId = orderResourceUrl.split('/').pop()

    console.log('[Webhook MeLi] Procesando Orden ID:', orderId)
    
    // ─── Control de duplicados ───
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('ventas')
      .select('id')
      .eq('mp_payment_id', orderId)
      .maybeSingle()

    if (checkError) throw new Error(`Error consultando duplicados: ${checkError.message}`)

    if (existing) {
      console.log('[Webhook MeLi] Orden duplicada:', orderId)
      return res.status(200).json({ received: true, duplicate: true })
    }

    // ─── Obtener detalles desde MeLi API ───
    const meliAccessToken = process.env.MELI_ACCESS_TOKEN
    let orderData = null

    if (meliAccessToken) {
      try {
        console.log('[Webhook MeLi] Consultando API de Mercado Libre...')
        const response = await fetch(`https://api.mercadolibre.com${orderResourceUrl}`, {
          headers: { 'Authorization': `Bearer ${meliAccessToken}` }
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('[Webhook MeLi] Error API MeLi:', response.status, errorText)
        } else {
          orderData = await response.json()
        }
      } catch (meliFetchErr) {
        console.error('[Webhook MeLi] Error fatal en fetch MeLi:', meliFetchErr.message)
      }
    }

    // Construcción del registro
    const clienteNombre = orderData?.buyer?.first_name 
      ? `${orderData.buyer.first_name} ${orderData.buyer.last_name || ''}`.trim()
      : orderData?.buyer?.nickname || `Venta MeLi #${orderId}`

    const monto = orderData?.total_amount || 0
    const docNumber = orderData?.buyer?.billing_info?.doc_number || orderData?.buyer?.identification?.number || ''

    // Extraer forma de pago de Mercado Pago
    const firstPayment = orderData?.payments?.[0];
    const paymentMap = {
      'credit_card': 'Tarjeta de Crédito',
      'debit_card': 'Tarjeta de Débito',
      'account_money': 'Dinero en cuenta MP',
      'ticket': 'Cupón (Pago Fácil/Rápipago)',
      'bank_transfer': 'Transferencia'
    };
    const formaPago = paymentMap[firstPayment?.payment_type] || firstPayment?.payment_type || 'Mercado Pago';

    const ventaRecord = {
      fecha: orderData?.date_created || new Date().toISOString(),
      cliente: clienteNombre,
      monto: monto,
      status: 'pendiente',
      mp_payment_id: orderId,
      datos_fiscales: {
        email: orderData?.buyer?.email,
        identification: {
           type: orderData?.buyer?.billing_info?.doc_type || 'DNI',
           number: docNumber
        },
        cuit: docNumber,
        shipping_id: orderData?.shipping?.id,
        meli_status: orderData?.status,
        forma_pago: formaPago
      },
    }

    console.log('[Webhook MeLi] Insertando en Supabase...')
    const { error: insertError } = await supabaseAdmin.from('ventas').insert([ventaRecord])
    
    if (insertError) {
      throw new Error(`Error al insertar en Supabase: ${insertError.message}`)
    }

    console.log('[Webhook MeLi] Procesado con éxito')
    return res.status(200).json({ received: true, processed: true, orderId })

  } catch (err) {
    console.error('[Webhook MeLi] Error Crítico:', err.message)
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
}

