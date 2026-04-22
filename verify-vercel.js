import crypto from 'crypto'
import fs from 'fs'
import Afip from '@afipsdk/afip.js'
import os from 'os'
import path from 'path'
import tls from 'tls'

const _createSecureContext = tls.createSecureContext
tls.createSecureContext = function(options) {
  options = options || {}
  options.ciphers = 'DEFAULT@SECLEVEL=0'
  options.secureOptions = options.secureOptions | crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
  options.minDHSize = 512
  return _createSecureContext.call(tls, options)
}

// Simular EXACTAMENTE lo que hace Vercel: leer de base64 env vars
const certBase64 = fs.readFileSync('cert_base64_new.txt', 'utf-8').trim()
const keyBase64 = fs.readFileSync('key_base64.txt', 'utf-8').trim()

// Decodificar igual que afip.js
const certContent = Buffer.from(certBase64, 'base64').toString('utf8')
const keyContent = Buffer.from(keyBase64, 'base64').toString('utf8')

// Comparar con archivos directos
const certDirect = fs.readFileSync('facturador marten final_245626e32824d7f4.crt', 'utf-8')

console.log('=== COMPARACION DE DECODIFICACION ===')
console.log('Cert via B64 length:', certContent.length)
console.log('Cert direct length:', certDirect.length)
console.log('Cert match:', certContent === certDirect ? '✅ IGUALES' : '❌ DIFERENTES')

const certHashB64 = crypto.createHash('sha256').update(certContent).digest('hex').substring(0, 16)
const certHashDirect = crypto.createHash('sha256').update(certDirect).digest('hex').substring(0, 16)
console.log('Cert hash (via B64):', certHashB64)
console.log('Cert hash (direct):', certHashDirect)

console.log('\nKey via B64 length:', keyContent.length)
const keyHashB64 = crypto.createHash('sha256').update(keyContent).digest('hex').substring(0, 16)
console.log('Key hash:', keyHashB64)

// Escribir a tmp y probar
const tmpDir = os.tmpdir()
fs.writeFileSync(path.join(tmpDir, 'verify_cert.crt'), certContent)
fs.writeFileSync(path.join(tmpDir, 'verify_key.key'), keyContent)

console.log('\n=== TEST: Facturar via Base64 (simulando Vercel) ===')
try {
  const afip = new Afip({
    CUIT: 20354302684,
    res_folder: tmpDir,
    ta_folder: tmpDir,
    cert: 'verify_cert.crt',
    key: 'verify_key.key',
    production: true
  })
  const last = await afip.ElectronicBilling.getLastVoucher(3, 11)
  console.log('✅ ÉXITO via B64! Último comprobante:', last)
} catch (err) {
  console.log('❌ Error via B64:', err.message)
}
