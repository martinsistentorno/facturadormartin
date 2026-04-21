import { getAfipRazonSocial } from './lib/afip-helper.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const cuit = process.env.AFIP_CUIT
    const ptoVta = parseInt(process.env.AFIP_PTO_VTA || '1')
    const tipoCbte = parseInt(process.env.AFIP_TIPO_CBTE || '11')

    if (!cuit) {
      return res.status(400).json({ error: 'AFIP_CUIT no configurado en el servidor' })
    }

    // Format CUIT: 20354302684 → 20-35430268-4
    const cuitFmt = cuit.length === 11
      ? `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`
      : cuit

    // Query AFIP padrón for the emisor's own data
    const afipData = await getAfipRazonSocial(cuit)

    // Map AFIP condición to our labels
    let condicionIva = 'Responsable Monotributo'
    if (afipData?.condicion_iva) {
      const map = {
        'Monotributista': 'Responsable Monotributo',
        'Responsable Inscripto': 'IVA Responsable Inscripto',
        'Exento': 'IVA Sujeto Exento',
      }
      condicionIva = map[afipData.condicion_iva] || afipData.condicion_iva
    }

    return res.status(200).json({
      // Datos fijos de AFIP (bloqueados en el frontend)
      razon_social: afipData?.razonSocial || '',
      cuit: cuit,
      cuit_fmt: cuitFmt,
      condicion_iva: condicionIva,
      // Datos configurados en el servidor
      pto_vta: ptoVta,
      tipo_cbte: tipoCbte,
      // Campos editables por el cliente (pre-cargados de AFIP si existen sino vacíos)
      domicilio: afipData?.domicilio || '',
      inicio_actividades: afipData?.inicio_actividades || '',
      ingresos_brutos: cuitFmt,
    })
  } catch (err) {
    console.error('[get-emisor] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
