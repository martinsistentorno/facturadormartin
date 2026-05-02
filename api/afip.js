import { createClient } from '@supabase/supabase-js'
import Afip from '@afipsdk/afip.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import tls from 'tls'
import crypto from 'crypto'
import { getAfipRazonSocial } from './_lib/afip-helper.js'

// AFIP servers use 1024-bit DH keys which OpenSSL 3.0+ (Node 18+) rejects.
// Force SECLEVEL=0 on ALL TLS connections — the SOAP lib inside the SDK creates its own.
const _createSecureContext = tls.createSecureContext
tls.createSecureContext = function(options) {
  options = options || {}
  // ALWAYS override — don't use || because the SOAP lib may set its own ciphers
  options.ciphers = 'DEFAULT@SECLEVEL=0'
  options.secureOptions = options.secureOptions | crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
  options.minDHSize = 512
  return _createSecureContext.call(tls, options)
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  console.log('=== AFIP API LLAMADA ===')

  try {
    const { ventas } = req.body

    if (!ventas || !Array.isArray(ventas) || ventas.length === 0) {
      return res.status(400).json({ error: 'Lista de ventas vacía' })
    }

    console.log(`Ventas recibidas: ${ventas.length}`)

    // ─── Supabase Admin (escritura con service_role) ───
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Faltan credenciales de Supabase en el servidor (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    // ─── Fetch emisor config from DB ───
    let emisorConfig = null
    const cuit = process.env.AFIP_CUIT

    try {
      const { data: cfgData, error: cfgError } = await supabaseAdmin
        .from('config_emisor')
        .select('*')
        .limit(1)
        .maybeSingle()
      
      if (cfgError) {
        console.error('⚠️ Error leyendo config_emisor:', cfgError.message)
      }

      emisorConfig = cfgData

      // Si no hay configuración, la autogeneramos usando AFIP
      if (!emisorConfig && cuit) {
        console.log('[AFIP] config_emisor vacío. Autogenerando desde Padrón AFIP...')
        const afipData = await getAfipRazonSocial(cuit)
        
        let condicionIva = 'Responsable Monotributo'
        if (afipData?.condicion_iva) {
          const map = {
            'Monotributista': 'Responsable Monotributo',
            'Responsable Inscripto': 'IVA Responsable Inscripto',
            'Exento': 'IVA Sujeto Exento',
          }
          condicionIva = map[afipData.condicion_iva] || afipData.condicion_iva
        }

        const cuitFmt = cuit.length === 11 ? `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}` : cuit
        const ptoVta = parseInt(process.env.AFIP_PTO_VTA || '1')
        const tipoCbte = parseInt(process.env.AFIP_TIPO_CBTE || '11')

        const newConfig = {
          razon_social: afipData?.razonSocial || '',
          cuit: cuit,
          cuit_fmt: cuitFmt,
          condicion_iva: condicionIva,
          pto_vta: ptoVta,
          tipo_cbte: tipoCbte,
          domicilio: afipData?.domicilio || '',
          inicio_actividades: afipData?.inicio_actividades || '',
          ingresos_brutos: cuitFmt
        }

        const { data: insertedConfig, error: insertErr } = await supabaseAdmin
          .from('config_emisor')
          .insert([newConfig])
          .select()
          .single()

        if (!insertErr && insertedConfig) {
          console.log('[AFIP] config_emisor autogenerado con éxito.')
          emisorConfig = insertedConfig
        } else {
          console.error('[AFIP] Error insertando auto-config:', insertErr?.message)
          emisorConfig = newConfig // fallback temporal en memoria
        }
      }
    } catch (cfgErr) {
      console.error('⚠️ Error fetch config_emisor:', cfgErr.message)
    }

    // ─── Config AFIP ───
    const certBase64 = process.env.AFIP_CERT_BASE64
    const keyBase64 = process.env.AFIP_KEY_BASE64
    const ptoVta = emisorConfig?.pto_vta || parseInt(process.env.AFIP_PTO_VTA || '1')
    const tipoCbte = emisorConfig?.tipo_cbte || 11
    const isProduction = process.env.AFIP_PRODUCTION === 'true'
    const isSandbox = process.env.AFIP_SANDBOX === 'true'

    console.log(`Config: CUIT=${cuit}, PtoVta=${ptoVta}, TipoCbte=${tipoCbte}, Production=${isProduction}, Sandbox=${isSandbox}`)

    // ══════════════════════════════════════════════
    //  MODO SANDBOX — Simula sin tocar AFIP
    // ══════════════════════════════════════════════
    if (isSandbox) {
      console.log('--- MODO SANDBOX ACTIVO ---')
      const resultados = []

      for (const v of ventas) {
        const nComp = `SB-${ptoVta}-${Math.floor(Math.random() * 90000000 + 10000000)}`
        const cae = Math.floor(Math.random() * 100000000000000).toString()
        const fVto = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

        const { error: upError } = await supabaseAdmin
          .from('ventas')
          .update({
            status: 'facturado',
            cae: cae,
            nro_comprobante: nComp,
            vto_cae: fVto
          })
          .eq('id', v.id)

        if (upError) {
          console.error(`❌ DB error para venta ${v.id}:`, upError.message)
          resultados.push({ id: v.id, success: false, error: 'Error guardando en DB: ' + upError.message })
        } else {
          console.log(`✅ Sandbox OK: ${v.id} → ${nComp}`)
          resultados.push({ id: v.id, success: true, nro: nComp, cae })
        }
      }

      return res.status(200).json({ success: true, resultados })
    }

    // ══════════════════════════════════════════════
    //  MODO REAL — Facturación electrónica con AFIP
    // ══════════════════════════════════════════════
    if (!cuit || !certBase64 || !keyBase64) {
      return res.status(500).json({
        error: 'Faltan credenciales de AFIP (AFIP_CUIT, AFIP_CERT_BASE64, AFIP_KEY_BASE64). Configurá las variables en Vercel.'
      })
    }

    const certContent = Buffer.from(certBase64, 'base64').toString('utf8')
    const keyContent = Buffer.from(keyBase64, 'base64').toString('utf8')

    // Escribir certs a /tmp para evitar ENAMETOOLONG (afip.js v0.7.6 en Vercel)
    const tmpDir = os.tmpdir()
    const certPath = path.join(tmpDir, 'afip_cert.crt')
    const keyPath = path.join(tmpDir, 'afip_key.key')
    
    fs.writeFileSync(certPath, certContent)
    fs.writeFileSync(keyPath, keyContent)

    const afipConfig = {
      CUIT: parseInt(cuit),
      res_folder: tmpDir,
      ta_folder: tmpDir,
      cert: 'afip_cert.crt',
      key: 'afip_key.key',
      production: isProduction
    }

    // SDK token es OPCIONAL — sin él, AFIP SDK se conecta directo a los servers de AFIP
    const sdkToken = process.env.AFIP_SDK_TOKEN
    if (sdkToken) {
      afipConfig.access_token = sdkToken
      console.log('Usando SDK Token (proxy mode)')
    } else {
      console.log('Conectando directo a AFIP (sin proxy)')
    }

    const afip = new Afip(afipConfig)

    // Debug: mostrar info de diagnóstico
    console.log('AFIP SDK inicializado correctamente')
    console.log(`Cert empieza con: ${certContent.substring(0, 30)}...`)
    console.log(`Key empieza con: ${keyContent.substring(0, 30)}...`)
    console.log(`Cert largo: ${certContent.length} chars`)
    console.log(`Key largo: ${keyContent.length} chars`)
    console.log(`Cert hash: ${crypto.createHash('sha256').update(certContent).digest('hex').substring(0, 16)}`)
    console.log(`Key hash: ${crypto.createHash('sha256').update(keyContent).digest('hex').substring(0, 16)}`)
    console.log(`Token: ${sdkToken ? sdkToken.substring(0, 10) + '...' : 'NO DEFINIDO'}`)

    const resultados = []

    for (const v of ventas) {
      try {
        // Armar tipo de comprobante ANTES de consultar AFIP
        const conceptoVenta = v.datos_fiscales?.concepto || emisorConfig?.concepto_default || 1
        const cbteTipoVenta = v.datos_fiscales?.tipo_cbte || tipoCbte

        // Obtener último comprobante y calcular el siguiente
        let lastVoucher
        try {
          lastVoucher = await afip.ElectronicBilling.getLastVoucher(ptoVta, cbteTipoVenta)
        } catch (afipErr) {
          console.error('❌ Error detallado de AFIP SDK:', JSON.stringify(afipErr, null, 2))
          console.error('❌ afipErr.message:', afipErr.message)
          console.error('❌ afipErr.response:', afipErr.response?.data || afipErr.response)
          throw afipErr
        }
        const nextVoucher = lastVoucher + 1

        console.log(`Venta ${v.id}: último comprobante=${lastVoucher}, siguiente=${nextVoucher}, tipo=${cbteTipoVenta}`)

        // Determinar tipo de documento del receptor
        const cuitCliente = v.datos_fiscales?.cuit?.replace(/-/g, '')
        let docTipo = 99 // Por defecto: Sin Identificar
        const tipoDocInput = v.datos_fiscales?.doc_tipo || ''
        
        if (tipoDocInput === 'CUIT' || (!tipoDocInput && cuitCliente?.length >= 10)) docTipo = 80
        else if (tipoDocInput === 'CUIL') docTipo = 86
        else if (tipoDocInput === 'DNI') docTipo = 96
        else if (tipoDocInput === 'Pasaporte') docTipo = 94

        // Si no hay número de documento, AFIP exige 99 (Consumidor Final anónimo)
        if (!cuitCliente) docTipo = 99

        const docNro = docTipo !== 99 && cuitCliente ? parseInt(cuitCliente) : 0

        // Nueva reglamentación RG 5616: Condición IVA del receptor
        let condicionIvaReceptor = 5 // Consumidor Final por defecto
        const condStr = (v.datos_fiscales?.condicion_iva || '').toLowerCase()
        if (condStr.includes('inscripto')) condicionIvaReceptor = 1
        if (condStr.includes('monotributo')) condicionIvaReceptor = 6
        if (condStr.includes('exento')) condicionIvaReceptor = 4
        if (condStr.includes('no responsable')) condicionIvaReceptor = 3


        // Fecha de emisión: usar la del formulario si existe, sino hoy
        const fechaEmisionRaw = v.datos_fiscales?.fecha_emision || new Date().toISOString().split('T')[0]
        const cbteFch = parseInt(fechaEmisionRaw.replace(/-/g, ''))

        const data = {
          'CantReg': 1,
          'PtoVta': ptoVta,
          'CbteTipo': cbteTipoVenta,
          'Concepto': conceptoVenta,
          'DocTipo': docTipo,
          'DocNro': docNro,
          'CbteDesde': nextVoucher,
          'CbteHasta': nextVoucher,
          'CbteFch': cbteFch,
          'ImpTotal': parseFloat(v.monto),
          'ImpTotConc': 0,
          'ImpNeto': parseFloat(v.monto),
          'ImpOpEx': 0,
          'ImpIVA': 0,
          'ImpTrib': 0,
          'MonId': 'PES',
          'MonCotiz': 1,
          'CondicionIvaReceptor': condicionIvaReceptor
        }

        // Campos obligatorios para Servicios (2) y Productos y Servicios (3)
        if (conceptoVenta === 2 || conceptoVenta === 3) {
          const periodoDesde = v.datos_fiscales?.periodo_desde
          const periodoHasta = v.datos_fiscales?.periodo_hasta
          const vtoPago = v.datos_fiscales?.vto_pago

          if (periodoDesde) data['FchServDesde'] = parseInt(periodoDesde.replace(/-/g, ''))
          if (periodoHasta) data['FchServHasta'] = parseInt(periodoHasta.replace(/-/g, ''))
          if (vtoPago) data['FchVtoPago'] = parseInt(vtoPago.replace(/-/g, ''))
        }

        // Comprobante asociado obligatorio para NC (13) y ND (12)
        if (cbteTipoVenta === 13 || cbteTipoVenta === 12) {
          const asoc = v.datos_fiscales?.cbte_asoc
          if (asoc && asoc.nro) {
            data['CbtesAsoc'] = [{
              'Tipo': asoc.tipo || 11,
              'PtoVta': asoc.pto_vta || ptoVta,
              'Nro': parseInt(asoc.nro),
              'Cuit': parseInt(cuit),
              'CbteFch': asoc.fecha ? parseInt(asoc.fecha.replace(/-/g, '')) : cbteFch
            }]
            console.log(`CbtesAsoc: Tipo=${asoc.tipo}, PtoVta=${asoc.pto_vta}, Nro=${asoc.nro}`)
          } else {
            console.warn('⚠️ NC/ND sin comprobante asociado — AFIP podría rechazarlo')
          }
        }

        console.log(`Enviando comprobante a AFIP...`)
        const resAFIP = await afip.ElectronicBilling.createVoucher(data)
        console.log(`✅ AFIP OK: CAE=${resAFIP.CAE}, Vto=${resAFIP.CAEFchVto}`)

        // Guardar resultado en Supabase
        const nroComprobante = `${String(ptoVta).padStart(4, '0')}-${String(nextVoucher).padStart(8, '0')}`

        // ─── Generar y Guardar PDF Permanente ───
        let finalPdfUrl = null
        try {
          if (sdkToken) {
            const pdfRes = await afip.ElectronicBilling.createPDF({
              html: `
                <p><b>Razón Social:</b> ${v.cliente || 'Consumidor Final'}</p>
                <p><b>CUIT:</b> ${v.datos_fiscales?.cuit || 'N/A'}</p>
                <p><b>Forma de Pago:</b> ${v.datos_fiscales?.forma_pago || 'Contado'}</p>
              `,
              file_name: `Factura_${nroComprobante}.pdf`,
              copy: 1,
              voucher_info: {
                PtoVta: ptoVta,
                CbteTipo: tipoCbte,
                CbteNro: nextVoucher
              }
            })
            
            const s3Url = pdfRes?.file || null
            console.log(`📄 PDF generado en S3 (temporal): ${s3Url}`)

            if (s3Url) {
              // Descargar PDF desde S3 temporal
              const pdfResponse = await fetch(s3Url)
              const arrayBuffer = await pdfResponse.arrayBuffer()
              const buffer = Buffer.from(arrayBuffer)

              // Subir a nuestro Supabase Storage (bucket "facturas")
              const fileName = `${v.id}_${nroComprobante}.pdf`
              const { error: uploadError } = await supabaseAdmin.storage
                .from('facturas')
                .upload(fileName, buffer, {
                  contentType: 'application/pdf',
                  upsert: true
                })

              if (uploadError) {
                console.error(`⚠️ Error subiendo PDF a Supabase Storage:`, uploadError.message)
                finalPdfUrl = s3Url // Fallback temporal si falla
              } else {
                const { data } = supabaseAdmin.storage
                  .from('facturas')
                  .getPublicUrl(fileName)
                finalPdfUrl = data.publicUrl
                console.log(`💾 PDF guardado permanentemente: ${finalPdfUrl}`)
              }
            }
          } else {
            console.log('📄 Generación de PDF por AFIP SDK omitida (conexión directa)')
          }
        } catch (pdfErr) {
          console.error(`⚠️ Error manejando PDF (no fatal):`, pdfErr.message)
        }

        const cbteFchStr = data.CbteFch.toString()
        const fechaEmision = `${cbteFchStr.substring(0,4)}-${cbteFchStr.substring(4,6)}-${cbteFchStr.substring(6,8)}`

        const { error: upError } = await supabaseAdmin
          .from('ventas')
          .update({
            status: 'facturado',
            cae: resAFIP.CAE,
            nro_comprobante: nroComprobante,
            vto_cae: resAFIP.CAEFchVto,
            pdf_url: finalPdfUrl,
            datos_fiscales: {
              ...v.datos_fiscales,
              fecha_emision: fechaEmision
            }
          })
          .eq('id', v.id)

        if (upError) {
          console.error(`⚠️ Factura emitida pero error guardando en DB:`, upError.message)
        }

        resultados.push({
          id: v.id,
          success: true,
          nro: nroComprobante,
          cae: resAFIP.CAE,
          pdf_url: finalPdfUrl
        })

      } catch (err) {
        console.error(`❌ Error facturando venta ${v.id}:`, err.message)

        // Marcar como error en DB
        const { error: dbErr } = await supabaseAdmin
          .from('ventas')
          .update({
            status: 'error',
            datos_fiscales: {
              ...v.datos_fiscales,
              error_detalle: err.message
            }
          })
          .eq('id', v.id)

        if (dbErr) {
          console.error('Error secundario (DB):', dbErr.message)
        }

        resultados.push({ id: v.id, success: false, error: err.message })
      }
    }

    const okCount = resultados.filter(r => r.success).length
    console.log(`=== Resultado: ${okCount}/${resultados.length} facturas emitidas ===`)
    return res.status(200).json({ success: true, resultados })

  } catch (err) {
    console.error('❌ Error General AFIP API:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
