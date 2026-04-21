import Afip from '@afipsdk/afip.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import dotenv from 'dotenv'

dotenv.config()

async function checkCert() {
  const cuit = process.env.AFIP_CUIT
  const certBase64 = process.env.AFIP_CERT_BASE64
  const keyBase64 = process.env.AFIP_KEY_BASE64

  if (!cuit || !certBase64 || !keyBase64) {
    console.log("Faltan variables de entorno en el .env (descargalas de Vercel y ponelas en tu .env)")
    return
  }

  const tmpDir = os.tmpdir()
  fs.writeFileSync(path.join(tmpDir, 'cert.crt'), Buffer.from(certBase64, 'base64').toString('utf-8'))
  fs.writeFileSync(path.join(tmpDir, 'key.key'), Buffer.from(keyBase64, 'base64').toString('utf-8'))

  console.log("Probando certificado en entorno HOMOLOGACIÓN (Pruebas)...")
  try {
    const afipHomo = new Afip({ CUIT: parseInt(cuit), res_folder: tmpDir, cert: 'cert.crt', key: 'key.key', production: false })
    const info = await afipHomo.ElectronicBilling.getServerStatus()
    console.log("✅ HOMOLOGACIÓN: Conexión exitosa. El servidor de pruebas autorizó el certificado.")
  } catch (e) {
    console.log("❌ HOMOLOGACIÓN: Falló la conexión ->", e.message)
  }

  console.log("\nProbando certificado en entorno PRODUCCIÓN (Real)...")
  try {
    const afipProd = new Afip({ CUIT: parseInt(cuit), res_folder: tmpDir, cert: 'cert.crt', key: 'key.key', production: true })
    const info = await afipProd.ElectronicBilling.getServerStatus()
    console.log("✅ PRODUCCIÓN: Conexión exitosa. El certificado es VÁLIDO para producción.")
  } catch (e) {
    console.log("❌ PRODUCCIÓN: Falló la conexión ->", e.message)
  }
}

checkCert()
