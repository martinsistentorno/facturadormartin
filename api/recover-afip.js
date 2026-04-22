import { createClient } from '@supabase/supabase-js'
import Afip from '@afipsdk/afip.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import tls from 'tls'
import crypto from 'crypto'

// SSL Monkeypatch for legacy AFIP servers
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
  if (req.method === 'OPTIONS') return res.status(200).end()

  const results = []
  
  try {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    
    const afip = new Afip({
      CUIT: parseInt(process.env.AFIP_CUIT),
      res_folder: os.tmpdir(),
      ta_folder: os.tmpdir(),
      cert: 'afip_cert.crt',
      key: 'afip_key.key',
      production: true
    })

    // Escribir certs si no existen en /tmp (necesario para afipsdk v0.7.6)
    const certPath = path.join(os.tmpdir(), 'afip_cert.crt')
    const keyPath = path.join(os.tmpdir(), 'afip_key.key')
    if (!fs.existsSync(certPath)) fs.writeFileSync(certPath, Buffer.from(process.env.AFIP_CERT_BASE64, 'base64').toString('utf8'))
    if (!fs.existsSync(keyPath)) fs.writeFileSync(keyPath, Buffer.from(process.env.AFIP_KEY_BASE64, 'base64').toString('utf8'))

    const ptoVta = 3
    const cbteTipo = 11

    const lastVoucher = await afip.ElectronicBilling.getLastVoucher(ptoVta, cbteTipo)
    console.log(`[Recover] Detectadas ${lastVoucher} facturas en AFIP.`)

    for (let i = 1; i <= lastVoucher; i++) {
       try {
         const info = await afip.ElectronicBilling.getVoucherInfo(i, ptoVta, cbteTipo)
         const cuit = info.DocNro.toString()
         const monto = parseFloat(info.ImpTotal)
         const cae = info.CodAutorizacion
         const nComp = `${String(ptoVta).padStart(4, '0')}-${String(i).padStart(8, '0')}`
         const vtoCae = info.FchVto // AAAAMMDD

         // Buscar en Supabase una venta pendiente que coincida
         // Unimos monto y cuit para mayor precisión
         const { data: match } = await supabase
           .from('ventas')
           .select('id, cliente, monto, status')
           .eq('monto', monto)
           .eq('datos_fiscales->>cuit', cuit)
           .eq('status', 'pendiente')
           .limit(1)

         if (match && match.length > 0) {
           const venta = match[0]
           // Actualizar venta
           await supabase.from('ventas').update({
             status: 'facturado',
             cae: cae,
             nro_comprobante: nComp,
             vto_cae: `${vtoCae.substring(0,4)}-${vtoCae.substring(4,6)}-${vtoCae.substring(6,8)}`
           }).eq('id', venta.id)
           
           results.push({ voucher: i, status: 'Recovered', id: venta.id, cliente: venta.cliente })
         } else {
           results.push({ voucher: i, status: 'Not Found in DB', cuit, monto })
         }
       } catch (e) {
         results.push({ voucher: i, status: 'Error', error: e.message })
       }
    }

    return res.status(200).json({ success: true, processed: lastVoucher, details: results })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ success: false, error: err.message })
  }
}
