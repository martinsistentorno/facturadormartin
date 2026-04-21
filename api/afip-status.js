import tls from 'tls'
import crypto from 'crypto'

const _createSecureContext = tls.createSecureContext
tls.createSecureContext = function(options) {
  options = options || {}
  options.ciphers = 'DEFAULT@SECLEVEL=0'
  options.secureOptions = options.secureOptions | crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
  options.minDHSize = 512
  return _createSecureContext.call(tls, options)
}

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
    const isProduction = process.env.AFIP_PRODUCTION === 'true'
    const isSandbox = process.env.AFIP_SANDBOX === 'true'
    const ptoVta = process.env.AFIP_PTO_VTA || '1'

    const hasCert = !!certBase64 && !!keyBase64
    const hasCuit = !!cuit

    const baseStatus = {
      connected: false,
      mode: isSandbox ? 'sandbox' : (isProduction ? 'production' : 'homologation'),
      ptoVta: parseInt(ptoVta),
      checks: { cuit: hasCuit, cert: hasCert },
      timestamp: new Date().toISOString(),
      tests: {}
    }

    if (!hasCert || !hasCuit) {
      return res.status(200).json(baseStatus)
    }

    if (isSandbox) {
      baseStatus.connected = true
      return res.status(200).json(baseStatus)
    }

    // Probar el certificado real
    const getAfipTestInstance = async (prod) => {
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      const AfipModule = await import('@afipsdk/afip.js')
      const Afip = AfipModule.default || AfipModule
      
      const tmpDir = os.tmpdir()
      const certPath = path.join(tmpDir, 'afip_cert_test.crt')
      const keyPath = path.join(tmpDir, 'afip_key_test.key')
      
      fs.writeFileSync(certPath, Buffer.from(certBase64, 'base64').toString('utf-8'))
      fs.writeFileSync(keyPath, Buffer.from(keyBase64, 'base64').toString('utf-8'))
      
      return new Afip({ CUIT: parseInt(cuit), res_folder: tmpDir, cert: 'afip_cert_test.crt', key: 'afip_key_test.key', production: prod })
    }

    try {
      const afipHomo = await getAfipTestInstance(false)
      await afipHomo.ElectronicBilling.getServerStatus()
      baseStatus.tests.homologacion = "EXITO"
      if (!isProduction) baseStatus.connected = true
    } catch (e) {
      baseStatus.tests.homologacion = `FALLO - ${e.message}`
    }

    try {
      const afipProd = await getAfipTestInstance(true)
      await afipProd.ElectronicBilling.getServerStatus()
      baseStatus.tests.produccion = "EXITO"
      if (isProduction) baseStatus.connected = true
    } catch (e) {
      baseStatus.tests.produccion = `FALLO - ${e.message}`
    }

    // Evaluar estado final del certificado
    if (baseStatus.tests.homologacion.includes("EXITO") && baseStatus.tests.produccion.includes("FALLO")) {
      baseStatus.tests.conclusion = "CERTIFICADO DE HOMOLOGACIÓN DETECTADO. No podés emitir facturas reales con este certificado."
    } else if (baseStatus.tests.produccion.includes("EXITO")) {
      baseStatus.tests.conclusion = "CERTIFICADO DE PRODUCCIÓN DETECTADO. Todo listo para emitir facturas legales."
    }

    return res.status(200).json(baseStatus)
  } catch (err) {
    return res.status(200).json({
      connected: false,
      mode: 'error',
      error: err.message,
      timestamp: new Date().toISOString(),
    })
  }
}
