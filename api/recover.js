import { createClient } from '@supabase/supabase-js'
import Afip from '@afipsdk/afip.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import tls from 'tls'
import crypto from 'crypto'

// SSL Monkeypatch
const _createSecureContext = tls.createSecureContext
tls.createSecureContext = function(options) {
  options = options || {}
  options.ciphers = 'DEFAULT@SECLEVEL=0'
  options.secureOptions = options.secureOptions | crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
  options.minDHSize = 512
  return _createSecureContext.call(tls, options)
}

/**
 * Recuperación MEJORADA:
 * 1. Consulta TODAS las facturas en AFIP (1 hasta lastVoucher)
 * 2. Busca en la DB por nro_comprobante (no por status)
 * 3. Actualiza fecha, CAE, vto_cae y status
 * 4. Si no encuentra match, muestra los datos para debug
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const results = []
  
  try {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    
    // Escribir certs
    const tmpDir = os.tmpdir()
    const certPath = path.join(tmpDir, 'afip_cert.crt')
    const keyPath = path.join(tmpDir, 'afip_key.key')
    fs.writeFileSync(certPath, Buffer.from(process.env.AFIP_CERT_BASE64, 'base64').toString('utf8'))
    fs.writeFileSync(keyPath, Buffer.from(process.env.AFIP_KEY_BASE64, 'base64').toString('utf8'))

    const afip = new Afip({
      CUIT: parseInt(process.env.AFIP_CUIT),
      res_folder: tmpDir,
      ta_folder: tmpDir,
      cert: 'afip_cert.crt',
      key: 'afip_key.key',
      production: true
    })

    // Leer configuración dinámica del emisor
    let ptoVta = parseInt(process.env.AFIP_PTO_VTA || '1')
    let cbteTipo = parseInt(process.env.AFIP_TIPO_CBTE || '11')
    try {
      const { data: cfgData } = await supabase
        .from('config_emisor')
        .select('pto_vta, tipo_cbte')
        .limit(1)
        .maybeSingle()
      if (cfgData) {
        ptoVta = cfgData.pto_vta || ptoVta
        cbteTipo = cfgData.tipo_cbte || cbteTipo
      }
    } catch (e) {
      console.warn('[Recover] No se pudo leer config_emisor, usando env/defaults')
    }

    const lastVoucher = await afip.ElectronicBilling.getLastVoucher(ptoVta, cbteTipo)
    console.log(`[Recover] Detectadas ${lastVoucher} facturas en AFIP.`)

    for (let i = 1; i <= lastVoucher; i++) {
      try {
        const info = await afip.ElectronicBilling.getVoucherInfo(i, ptoVta, cbteTipo)
        const cae = info.CodAutorizacion
        const nComp = `${String(ptoVta).padStart(4, '0')}-${String(i).padStart(8, '0')}`
        const vtoCae = info.FchVto
        const cbteFch = info.CbteFch
        const afipFecha = `${cbteFch.substring(0,4)}-${cbteFch.substring(4,6)}-${cbteFch.substring(6,8)}T12:00:00Z`
        const monto = parseFloat(info.ImpTotal)
        const docNro = info.DocNro.toString()

        // Buscar por nro_comprobante (no por status!)
        const { data: matches } = await supabase
          .from('ventas')
          .select('id, cliente, monto, status, fecha, datos_fiscales')
          .eq('nro_comprobante', nComp)

        if (matches && matches.length > 0) {
          // Actualizar TODOS los registros con ese nro_comprobante
          // Guardar fecha AFIP en datos_fiscales, NO en fecha (para no romper el orden cronológico)
          for (const m of matches) {
            const { error: upErr } = await supabase.from('ventas').update({
              status: 'facturado',
              cae: cae,
              vto_cae: `${vtoCae.substring(0,4)}-${vtoCae.substring(4,6)}-${vtoCae.substring(6,8)}`,
              datos_fiscales: {
                ...(m.datos_fiscales || {}),
                fecha_emision: afipFecha.split('T')[0]
              }
            }).eq('id', m.id)
            
            if (upErr) {
              results.push({ voucher: i, nComp, status: 'Error', error: upErr.message })
            }
          }
          
          results.push({ 
            voucher: i, 
            nComp,
            status: 'Synced (fecha_emision)', 
            afipDate: afipFecha.split('T')[0],
            saleDate: matches[0].fecha?.split('T')[0],
            monto,
            matches: matches.length
          })
        } else {
          // No encontrado por nro_comprobante, buscar por CAE
          const { data: caeMatch } = await supabase
            .from('ventas')
            .select('id, nro_comprobante, datos_fiscales')
            .eq('cae', cae)
            .limit(1)

          if (caeMatch && caeMatch.length > 0) {
            await supabase.from('ventas').update({
              status: 'facturado',
              nro_comprobante: nComp,
              vto_cae: `${vtoCae.substring(0,4)}-${vtoCae.substring(4,6)}-${vtoCae.substring(6,8)}`,
              datos_fiscales: {
                ...(caeMatch[0].datos_fiscales || {}),
                fecha_emision: afipFecha.split('T')[0]
              }
            }).eq('cae', cae)
            
            results.push({ voucher: i, nComp, status: 'Synced via CAE', monto, afipDate: afipFecha.split('T')[0] })
          } else {
            results.push({ voucher: i, nComp, status: 'NOT IN DB', cuit: docNro, monto, afipDate: afipFecha.split('T')[0], cae })
          }
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
