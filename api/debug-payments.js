/**
 * Endpoint de diagnóstico: muestra los datos CRUDOS de los últimos pagos
 * para poder ver qué campos trae la API y corregir la extracción.
 *
 * GET /api/debug-payments → muestra los últimos 5 pagos con todos sus campos relevantes
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const accessToken = process.env.MELI_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN
    if (!accessToken) throw new Error('Falta MELI_ACCESS_TOKEN')

    // 1. Info de la cuenta
    const meRes = await fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const meData = meRes.ok ? await meRes.json() : { error: await meRes.text() }

    // 2. Últimos 5 pagos aprobados
    const searchRes = await fetch(
      `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=5&status=approved`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )
    const searchData = await searchRes.json()
    const payments = searchData.results || []

    const debugResults = []

    for (const p of payments) {
      const result = {
        payment_id: p.id,
        monto: p.transaction_amount,
        status: p.status,
        operation_type: p.operation_type,
        payment_type_id: p.payment_type_id,
        payment_method_id: p.payment_method_id,
        collector_id: p.collector_id,
        payer: {
          id: p.payer?.id,
          first_name: p.payer?.first_name,
          last_name: p.payer?.last_name,
          email: p.payer?.email,
          identification: p.payer?.identification,
          entity_type: p.payer?.entity_type,
        },
        order: p.order || null,
        point_of_interaction: p.point_of_interaction ? {
          type: p.point_of_interaction.type,
          transaction_data: {
            bank_info: p.point_of_interaction.transaction_data?.bank_info || null,
            payer_info: p.point_of_interaction.transaction_data?.payer_info || null,
          }
        } : null,
        description: p.description,
        additional_info: p.additional_info ? {
          payer: p.additional_info.payer || null,
          items: p.additional_info.items || null,
        } : null,
      }

      // Si tiene order, intentar obtener datos de MeLi
      if (p.order?.id) {
        try {
          const orderRes = await fetch(`https://api.mercadolibre.com/orders/${p.order.id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          })
          const orderStatus = orderRes.status
          const orderBody = await orderRes.json()
          result.meli_order = {
            api_status: orderStatus,
            buyer: orderBody.buyer || null,
            error: orderBody.error || null,
            message: orderBody.message || null,
          }
        } catch (err) {
          result.meli_order = { error: err.message }
        }
      }

      debugResults.push(result)
    }

    return res.status(200).json({
      account: {
        id: meData.id,
        nickname: meData.nickname,
        first_name: meData.first_name,
        last_name: meData.last_name,
      },
      payments: debugResults
    })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
