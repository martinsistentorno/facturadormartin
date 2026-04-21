import Afip from '@afipsdk/afip.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import tls from 'tls'
import crypto from 'crypto'

// AFIP servers use 1024-bit DH keys which OpenSSL 3.0+ (Node 18+) rejects.
const _createSecureContext = tls.createSecureContext
tls.createSecureContext = function(options) {
  options = options || {}
  options.ciphers = 'DEFAULT@SECLEVEL=0'
  options.secureOptions = options.secureOptions | crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
  options.minDHSize = 512
  return _createSecureContext.call(tls, options)
}

/**
 * Helper para consultar datos de contribuyentes en AFIP.
 * 
 * Usa el servicio ws_sr_constancia_inscripcion (en vez de ws_sr_padron_a5)
 * porque es el que tiene delegado el Computador Fiscal del cliente.
 * 
 * Ambos servicios usan el MISMO endpoint SOAP (personaServiceA5),
 * solo cambia el nombre del servicio al pedir el Token de Autorización.
 */

const AFIP_SERVICE = 'ws_sr_constancia_inscripcion'

let afipInstance = null

function getAfipInstance() {
  if (afipInstance) return afipInstance

  const afipCuit = process.env.AFIP_CUIT
  const certBase64 = process.env.AFIP_CERT_BASE64
  const keyBase64 = process.env.AFIP_KEY_BASE64
  const isProduction = process.env.AFIP_PRODUCTION === 'true'

  if (!afipCuit || !certBase64 || !keyBase64) {
    console.warn('[AFIP Helper] Credenciales de AFIP no configuradas')
    return null
  }

  try {
    // v0.7.6 necesita archivos en disco (no acepta strings como v1.2.x)
    const tmpDir = os.tmpdir()
    const certPath = path.join(tmpDir, 'afip_cert.crt')
    const keyPath = path.join(tmpDir, 'afip_key.key')

    const certContent = Buffer.from(certBase64, 'base64').toString('utf-8')
    const keyContent = Buffer.from(keyBase64, 'base64').toString('utf-8')
    
    fs.writeFileSync(certPath, certContent)
    fs.writeFileSync(keyPath, keyContent)

    afipInstance = new Afip({
      CUIT: parseInt(afipCuit),
      res_folder: tmpDir,
      ta_folder: tmpDir,
      cert: 'afip_cert.crt',
      key: 'afip_key.key',
      production: isProduction
    })

    console.log('[AFIP Helper] Instancia creada OK (producción:', isProduction, ')')
    return afipInstance
  } catch (err) {
    console.error('[AFIP Helper] Error creando instancia:', err.message)
    return null
  }
}

const nameCache = {}

/**
 * Consulta interna a AFIP con un CUIT de 11 dígitos.
 */
async function queryAfipByCuit(cuitStr) {
  const afip = getAfipInstance()
  if (!afip) return null

  try {
    const ta = await afip.GetServiceTA(AFIP_SERVICE)

    const soapParams = {
      token: ta.token,
      sign: ta.sign,
      cuitRepresentada: afip.CUIT,
      idPersona: parseInt(cuitStr)
    }

    const result = await afip.RegisterScopeFive.executeRequest('getPersona_v2', soapParams)
      .catch(err => {
        if (err.message.indexOf('No existe') !== -1) return null
        throw err
      })

    if (!result || !result.datosGenerales) return null

    // Extraer nombre: Empresa → razonSocial, Persona → nombre + apellido
    let razonSocial = result.datosGenerales.razonSocial || ''
    if (!razonSocial && result.datosGenerales.nombre) {
      razonSocial = `${result.datosGenerales.nombre} ${result.datosGenerales.apellido || ''}`.trim()
    }
    
    // Extraer condición frente al IVA
    let condicionIva = 'Responsable Inscripto' // fallback
    if (result.datosMonotributo) {
      condicionIva = 'Monotributista'
    } else if (result.datosRegimenGeneral) {
      const impuestos = result.datosRegimenGeneral.impuesto || []
      const impuestosArr = Array.isArray(impuestos) ? impuestos : [impuestos]
      
      const hasExento = impuestosArr.find(i => String(i.idImpuesto) === '32')
      if (hasExento) {
        condicionIva = 'Exento'
      } else {
        condicionIva = 'Responsable Inscripto'
      }
    }

    return { razonSocial: razonSocial || null, condicionIva }
  } catch (err) {
    console.error(`[AFIP Helper] Error SOAP para ${cuitStr}:`, err.message)
    return null
  }
}

/**
 * Consulta la Razón Social a partir de un CUIT (11 dígitos).
 * 
 * @param {string|number} docNumber - CUIT (11 dígitos)
 * @returns {{ razonSocial: string, cuit: string } | null}
 */
export async function getAfipRazonSocial(docNumber) {
  const cleaned = String(docNumber).replace(/[-\s]/g, '')
  
  if (!cleaned || cleaned.length !== 11) {
    return null
  }

  // Si ya lo tenemos en cache
  if (nameCache[cleaned]) return nameCache[cleaned]

  console.log(`[AFIP Helper] Consultando CUIT directo: ${cleaned}`)
  const data = await queryAfipByCuit(cleaned)
  if (data && data.razonSocial) {
    const result = { razonSocial: data.razonSocial, cuit: cleaned, condicion_iva: data.condicionIva }
    nameCache[cleaned] = result
    console.log(`[AFIP Helper] ✅ ${cleaned} → ${data.razonSocial} (${data.condicionIva})`)
    return result
  }
  return null
}
