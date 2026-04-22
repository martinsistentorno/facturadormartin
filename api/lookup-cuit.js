import { getAfipRazonSocial } from './_lib/afip-helper.js'

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

  // Debug: verificar que las env vars de AFIP existan
  const hasAfipCuit = !!process.env.AFIP_CUIT
  const hasAfipCert = !!process.env.AFIP_CERT_BASE64
  const hasAfipKey = !!process.env.AFIP_KEY_BASE64
  const afipProd = process.env.AFIP_PRODUCTION

  console.log(`[AFIP Debug] AFIP_CUIT: ${hasAfipCuit}, CERT: ${hasAfipCert}, KEY: ${hasAfipKey}, PRODUCTION: ${afipProd}`)

  try {
    console.log(`[AFIP] Consultando CUIT: ${cuit}...`)
    const razonSocial = await getAfipRazonSocial(cuit)
    
    if (!razonSocial) {
      return res.status(404).json({ 
        error: 'CUIT no encontrado o sin datos',
        debug: {
          hasAfipCuit,
          hasAfipCert,
          hasAfipKey,
          afipProd,
          cuitQueried: cuit
        }
      })
    }

    return res.status(200).json({
      success: true,
      cuit,
      razonSocial
    })

  } catch (err) {
    console.error('[AFIP] Error consultando CUIT:', err.message)
    return res.status(500).json({ 
      error: err.message,
      debug: { hasAfipCuit, hasAfipCert, hasAfipKey, afipProd }
    })
  }
}
