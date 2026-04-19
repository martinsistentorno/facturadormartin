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

      // ─── Filtrar pagos SALIENTES ───
      // Comparamos como String porque MP a veces devuelve números y a veces strings
      const payerId = String(payment.payer?.id || '')
      const collectorId = String(payment.collector_id || '')
      const myId = String(myUserId || '')
      const opType = payment.operation_type || ''

      console.log(`[Sync] Pago ${paymentId}: payer=${payerId}, collector=${collectorId}, myId=${myId}, op=${opType}`)

      // Es SALIENTE si: el pagador es el dueño de la cuenta
      // O si el collector NO es el dueño (y tenemos el ID)
      if (myId && (payerId === myId || (collectorId && collectorId !== myId))) {
        outgoing++
        console.log(`[Sync] Pago ${paymentId} es SALIENTE, saltando`)
        continue
      }

      // Verificar si ya existe
      const { data: existing } = await supabaseAdmin
        .from('ventas').select('id').eq('mp_payment_id', paymentId).maybeSingle()

      if (existing) {
        skipped++
        continue
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
          origen: 'mercadopago-sync'
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
