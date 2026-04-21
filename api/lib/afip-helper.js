import Afip from '@afipsdk/afip.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

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

    console.log(`[AFIP Helper] Cert escrito en ${certPath} (${certContent.length} chars)`)
    console.log(`[AFIP Helper] Key escrito en ${keyPath} (${keyContent.length} chars)`)

    afipInstance = new Afip({
      CUIT: parseInt(afipCuit),
      res_folder: tmpDir,
      ta_folder: tmpDir,
      cert: 'afip_cert.crt',
      key: 'afip_key.key',
      production: isProduction
    })

    console.log('[AFIP Helper] Instancia creada OK (producción:', isProduction, ', CUIT:', afipCuit, ')')
    return afipInstance
  } catch (err) {
    console.error('[AFIP Helper] Error creando instancia:', err.message)
    return null
  }
}

/**
 * Consulta la Razón Social de un CUIT usando ws_sr_constancia_inscripcion.
 * 
 * @param {string|number} cuit - CUIT de 11 dígitos
 * @returns {string|null} Razón Social o null si no se encuentra
 */
const nameCache = {}

export async function getAfipRazonSocial(cuit) {
  const cuitStr = String(cuit).replace(/[-\s]/g, '')
  
  if (!cuitStr || cuitStr.length !== 11) {
    console.log(`[AFIP Helper] CUIT inválido: "${cuitStr}" (largo: ${cuitStr.length})`)
    return null
  }
  if (nameCache[cuitStr]) return nameCache[cuitStr]

  const afip = getAfipInstance()
  if (!afip) {
    console.log('[AFIP Helper] No hay instancia AFIP disponible')
    return null
  }

  try {
    console.log(`[AFIP Helper] Paso 1: Obteniendo TA para ${AFIP_SERVICE}...`)

    // Obtener Token de Autorización para ws_sr_constancia_inscripcion
    const ta = await afip.GetServiceTA(AFIP_SERVICE)
    console.log(`[AFIP Helper] Paso 1 OK: TA obtenido (token: ${ta.token?.substring(0, 30)}...)`)

    // Preparar parámetros SOAP (misma estructura que RegisterScopeFive.getTaxpayerDetails)
    const soapParams = {
      token: ta.token,
      sign: ta.sign,
      cuitRepresentada: afip.CUIT,
      idPersona: parseInt(cuitStr)
    }

    console.log(`[AFIP Helper] Paso 2: Llamando getPersona_v2 para CUIT ${cuitStr}...`)

    // Ejecutar la request SOAP directamente usando el cliente SOAP de RegisterScopeFive
    // que apunta al endpoint personaServiceA5 (el mismo que usa ws_sr_constancia_inscripcion)
    const rawResult = await afip.RegisterScopeFive.executeRequest('getPersona_v2', soapParams)

    console.log(`[AFIP Helper] Paso 2 resultado crudo:`, JSON.stringify(rawResult)?.substring(0, 500))

    // RegisterScopeFive.executeRequest wraps the result already,
    // extracting personaReturn from the raw SOAP response
    const result = rawResult

    if (!result || !result.datosGenerales) {
      console.log(`[AFIP Helper] CUIT ${cuitStr} no tiene datosGenerales`)
      return null
    }

    // Extraer nombre: Empresa → razonSocial, Persona → nombre + apellido
    let razonSocial = result.datosGenerales.razonSocial || ''
    if (!razonSocial && result.datosGenerales.nombre) {
      razonSocial = `${result.datosGenerales.nombre} ${result.datosGenerales.apellido || ''}`.trim()
    }

    if (razonSocial) {
      nameCache[cuitStr] = razonSocial
      console.log(`[AFIP Helper] ✅ ${cuitStr} → ${razonSocial}`)
    }

    return razonSocial || null
  } catch (err) {
    console.error(`[AFIP Helper] ❌ Error consultando ${cuitStr}:`, err.message)
    // Log stack trace for debugging
    if (err.stack) console.error('[AFIP Helper] Stack:', err.stack.substring(0, 500))
    return null
  }
}
