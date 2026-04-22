import Afip from '@afipsdk/afip.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

export default async function handler(req, res) {
  try {
    const certBase64 = process.env.AFIP_CERT_BASE64
    const keyBase64 = process.env.AFIP_KEY_BASE64
    const cuit = process.env.AFIP_CUIT

    if (!cuit || !certBase64 || !keyBase64) {
      return res.status(500).json({ error: 'Faltan credenciales de AFIP' })
    }

    const certContent = Buffer.from(certBase64, 'base64').toString('utf8')
    const keyContent = Buffer.from(keyBase64, 'base64').toString('utf8')

    const tmpDir = os.tmpdir()
    const certPath = path.join(tmpDir, 'afip_cert_check.crt')
    const keyPath = path.join(tmpDir, 'afip_key_check.key')
    
    fs.writeFileSync(certPath, certContent)
    fs.writeFileSync(keyPath, keyContent)

    const afip = new Afip({
      CUIT: parseInt(cuit),
      res_folder: tmpDir,
      ta_folder: tmpDir,
      cert: 'afip_cert_check.crt',
      key: 'afip_key_check.key',
      production: true
    })

    const ptoVta = 3
    const cbteTipo = 11

    const lastVoucher = await afip.ElectronicBilling.getLastVoucher(ptoVta, cbteTipo)
    console.log("Last Voucher Nro is:", lastVoucher)
    
    if (lastVoucher > 0) {
      const voucherInfo = await afip.ElectronicBilling.getVoucherInfo(lastVoucher, ptoVta, cbteTipo)
      console.log("Voucher Info:", voucherInfo)
      return res.status(200).json({ lastVoucher, voucherInfo })
    } else {
      return res.status(200).json({ message: "No vouchers exist for this PtoVta" })
    }
  } catch(e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}
