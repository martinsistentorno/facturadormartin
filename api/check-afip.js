import Afip from '@afipsdk/afip.js'

// Need to use Vercel environment vars basically, let's prompt the user or try if we have them.
// Wait, I don't have the AFIP_CERT or AFIP_KEY on my local environment!
// I must run this check using Vercel or tell the user how to do it.

export default async function handler(req, res) {
  try {
    const afip = new Afip({
      CUIT: 20354302684,
      cert: process.env.AFIP_CERT_BASE64 ? Buffer.from(process.env.AFIP_CERT_BASE64, 'base64').toString('ascii') : null,
      key: process.env.AFIP_KEY_BASE64 ? Buffer.from(process.env.AFIP_KEY_BASE64, 'base64').toString('ascii') : null,
      res_folder: '/tmp',
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
