import Afip from '@afipsdk/afip.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import tls from 'tls'
import crypto from 'crypto'

// Force legacy TLS
const _createSecureContext = tls.createSecureContext
tls.createSecureContext = function(options) {
  options = options || {}
  options.ciphers = 'DEFAULT@SECLEVEL=0'
  options.secureOptions = options.secureOptions | crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
  options.minDHSize = 512
  return _createSecureContext.call(tls, options)
}

// Leer los archivos directamente (no via Base64)
const certPem = fs.readFileSync('facturador marten final_245626e32824d7f4.crt', 'utf-8')
const keyBase64 = fs.readFileSync('key_base64.txt', 'utf-8').trim()
const keyPem = Buffer.from(keyBase64, 'base64').toString('utf-8')

const tmpDir = os.tmpdir()
fs.writeFileSync(path.join(tmpDir, 'test_cert.crt'), certPem)
fs.writeFileSync(path.join(tmpDir, 'test_key.key'), keyPem)

console.log('Cert OK:', certPem.substring(0, 30))
console.log('Key OK:', keyPem.substring(0, 30))

const CUIT = 20354302684

// TEST 1: SIN access_token (directo a AFIP)
console.log('\n=== TEST 1: Sin access_token (directo a AFIP) ===')
try {
  const afip = new Afip({
    CUIT,
    res_folder: tmpDir,
    ta_folder: tmpDir,
    cert: 'test_cert.crt',
    key: 'test_key.key',
    production: true
    // NO access_token
  })
  
  const lastVoucher = await afip.ElectronicBilling.getLastVoucher(3, 11)
  console.log('✅ ÉXITO! Último comprobante:', lastVoucher)
} catch (err) {
  console.log('❌ Error Test 1:', err.message)
}

// TEST 2: CON el cert VIEJO
console.log('\n=== TEST 2: Cert VIEJO (sin access_token) ===')
try {
  const oldCertPem = fs.readFileSync('facturador marten_f66177873cee340.crt', 'utf-8')
  fs.writeFileSync(path.join(tmpDir, 'test_cert_old.crt'), oldCertPem)

  const afip2 = new Afip({
    CUIT,
    res_folder: tmpDir,
    ta_folder: tmpDir,
    cert: 'test_cert_old.crt',
    key: 'test_key.key',
    production: true
  })
  
  const lastVoucher = await afip2.ElectronicBilling.getLastVoucher(3, 11)
  console.log('✅ ÉXITO! Último comprobante:', lastVoucher)
} catch (err) {
  console.log('❌ Error Test 2:', err.message)
}
