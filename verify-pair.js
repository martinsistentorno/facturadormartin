import crypto from 'crypto'
import fs from 'fs'

// Leer el key desde key_base64.txt
const keyBase64 = fs.readFileSync('key_base64.txt', 'utf-8').trim()
const keyPem = Buffer.from(keyBase64, 'base64').toString('utf-8')

// Leer el cert NUEVO
const certPem = fs.readFileSync('facturador marten final_245626e32824d7f4.crt', 'utf-8')

// Leer el cert VIEJO
const certViejoPem = fs.readFileSync('facturador marten_f66177873cee340.crt', 'utf-8')

console.log('=== VERIFICACIÓN DE PAR CERT/KEY ===\n')

try {
  const pubKeyFromNewCert = crypto.createPublicKey(certPem)
  const pubKeyFromOldCert = crypto.createPublicKey(certViejoPem)
  const privKey = crypto.createPrivateKey(keyPem)
  const pubKeyFromPriv = crypto.createPublicKey(privKey)

  const newCertModulus = pubKeyFromNewCert.export({ type: 'spki', format: 'der' }).toString('hex')
  const oldCertModulus = pubKeyFromOldCert.export({ type: 'spki', format: 'der' }).toString('hex')
  const keyModulus = pubKeyFromPriv.export({ type: 'spki', format: 'der' }).toString('hex')

  console.log('Cert NUEVO matchea con Key?', newCertModulus === keyModulus ? '✅ SÍ' : '❌ NO')
  console.log('Cert VIEJO matchea con Key?', oldCertModulus === keyModulus ? '✅ SÍ' : '❌ NO')
  console.log('')
  console.log('Key modulus (primeros 40 chars):', keyModulus.substring(0, 40))
  console.log('New cert modulus (primeros 40):', newCertModulus.substring(0, 40))
  console.log('Old cert modulus (primeros 40):', oldCertModulus.substring(0, 40))
} catch (err) {
  console.error('Error:', err.message)
}
