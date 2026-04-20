import Afip from '@afipsdk/afip.js'

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  const { cuit } = req.query
  if (!cuit) {
    return res.status(400).json({ error: 'Falta parametro cuit' })
  }

  try {
    const afipCuit = process.env.AFIP_CUIT
    const certBase64 = process.env.AFIP_CERT_BASE64
    const keyBase64 = process.env.AFIP_KEY_BASE64
    const isProduction = process.env.AFIP_PRODUCTION === 'true'

    if (!afipCuit || !certBase64 || !keyBase64) {
      return res.status(500).json({ error: 'Credenciales de AFIP no configuradas en el servidor' })
    }

    const cert = Buffer.from(certBase64, 'base64').toString('utf-8')
    const key = Buffer.from(keyBase64, 'base64').toString('utf-8')

    // Instanciar AFIP
    const afip = new Afip({ 
        CUIT: parseInt(afipCuit), 
        cert, 
        key, 
        production: isProduction 
    })

    // Consultar el padron (Alcance 5)
    console.log(`[AFIP] Consultando CUIT: ${cuit}...`)
    const data = await afip.RegisterScopeFive.getTaxpayerDetails(cuit)
    
    if (!data || !data.datosGenerales) {
      return res.status(404).json({ error: 'CUIT no encontrado o sin datos generales' })
    }

    // El Padron A5 devuelve diferentes propiedades segun sea Empresa o Persona fisica
    let razonSocial = data.datosGenerales.razonSocial || ''
    if (!razonSocial && data.datosGenerales.nombre) {
         razonSocial = `${data.datosGenerales.nombre} ${data.datosGenerales.apellido || ''}`.trim()
    }

    return res.status(200).json({
      success: true,
      cuit,
      razonSocial,
      estado: data.datosGenerales.estadoClave,
      tipoPersona: data.datosGenerales.tipoPersona
    })

  } catch (err) {
    console.error('[AFIP] Error consultando CUIT:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
