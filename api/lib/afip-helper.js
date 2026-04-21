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

    fs.writeFileSync(certPath, Buffer.from(certBase64, 'base64').toString('utf-8'))
    fs.writeFileSync(keyPath, Buffer.from(keyBase64, 'base64').toString('utf-8'))

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

/**
 * Consulta la Razón Social de un CUIT usando ws_sr_constancia_inscripcion.
 * 
 * @param {string|number} cuit - CUIT de 11 dígitos
 * @returns {string|null} Razón Social o null si no se encuentra
 */
const nameCache = {}

export async function getAfipRazonSocial(cuit) {
  const cuitStr = String(cuit).replace(/[-\s]/g, '')
  
  if (!cuitStr || cuitStr.length !== 11) return null
  if (nameCache[cuitStr]) return nameCache[cuitStr]

  const afip = getAfipInstance()
  if (!afip) return null

  try {
    console.log(`[AFIP Helper] Consultando CUIT: ${cuitStr} via ${AFIP_SERVICE}`)

    // Obtener Token de Autorización para ws_sr_constancia_inscripcion
    const { token, sign } = await afip.GetServiceTA(AFIP_SERVICE)

    // Llamar al endpoint SOAP (mismo que usa RegisterScopeFive)
    const soapParams = {
      token,
      sign,
      cuitRepresentada: afip.CUIT,
      idPersona: parseInt(cuitStr)
    }

    // Usar el RegisterScopeFive pero con nuestro TA
    // El truco: ejecutamos la request SOAP directamente en el mismo WSDL
    const result = await afip.RegisterScopeFive.executeRequest('getPersona_v2', soapParams)
      .catch(err => {
        if (err.message.indexOf('No existe') !== -1) return null
        throw err
      })

    if (!result || !result.datosGenerales) {
      console.log(`[AFIP Helper] CUIT ${cuitStr} no encontrado o sin datos`)
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
    console.error(`[AFIP Helper] Error consultando ${cuitStr}:`, err.message)
    return null
  }
}
