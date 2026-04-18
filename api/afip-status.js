export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const cuit = process.env.AFIP_CUIT
    const certBase64 = process.env.AFIP_CERT_BASE64
    const keyBase64 = process.env.AFIP_KEY_BASE64
    const sdkToken = process.env.AFIP_SDK_TOKEN
    const isProduction = process.env.AFIP_PRODUCTION === 'true'
    const isSandbox = process.env.AFIP_SANDBOX === 'true'
    const ptoVta = process.env.AFIP_PTO_VTA || '1'

    const hasCert = !!certBase64 && !!keyBase64
    const hasToken = !!sdkToken
    const hasCuit = !!cuit

    const connected = hasCert && hasToken && hasCuit && !isSandbox
    const mode = isSandbox ? 'sandbox' : (isProduction ? 'production' : 'homologation')

    return res.status(200).json({
      connected,
      mode,
      ptoVta: parseInt(ptoVta),
      checks: {
        cuit: hasCuit,
        cert: hasCert,
        token: hasToken,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return res.status(200).json({
      connected: false,
      mode: 'error',
      error: err.message,
      timestamp: new Date().toISOString(),
    })
  }
}
