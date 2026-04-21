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

// ─────────────────────────────────────────────────────
//  Algoritmo de CUIT: calcular dígito verificador
//  CUIT = XX-DNIDNI00-Y
//  XX = prefijo (20 masc, 27 fem, 23 ambiguo, 24 otro)
//  Y  = dígito verificador calculado por módulo 11
// ─────────────────────────────────────────────────────

function calculateCuitCheckDigit(tenDigits) {
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const digits = tenDigits.split('').map(Number)
  let sum = 0
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * weights[i]
  }
  const remainder = sum % 11
  if (remainder === 0) return 0
  if (remainder === 1) return -1  // caso especial: se necesita otro prefijo
  return 11 - remainder
}

/**
 * Dado un DNI (7-8 dígitos), genera las posibles CUITs válidas.
 * Prueba los prefijos más comunes: 20, 27, 23, 24.
 */
function dniToPossibleCuits(dni) {
  const paddedDni = String(dni).padStart(8, '0')
  const prefixes = ['20', '27', '23', '24']
  const cuits = []
  
  for (const prefix of prefixes) {
    const base = prefix + paddedDni
    const checkDigit = calculateCuitCheckDigit(base)
    if (checkDigit >= 0) {
      cuits.push(base + checkDigit)
    }
  }
  return cuits
}

// ─────────────────────────────────────────────────────
//  Cache y función principal de consulta
// ─────────────────────────────────────────────────────

const nameCache = {}

/**
 * Consulta interna a AFIP con un CUIT de 11 dígitos.
 * NO usa cache, eso lo maneja la función pública.
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

    return razonSocial || null
  } catch (err) {
    console.error(`[AFIP Helper] Error SOAP para ${cuitStr}:`, err.message)
    return null
  }
}

/**
 * Consulta la Razón Social a partir de un CUIT (11 dígitos) o DNI (7-8 dígitos).
 * 
 * Si recibe un DNI, calcula las posibles CUITs y las prueba contra AFIP
 * hasta encontrar la correcta.
 * 
 * @param {string|number} docNumber - CUIT (11 dígitos) o DNI (7-8 dígitos)
 * @returns {{ razonSocial: string, cuit: string } | null}
 */
export async function getAfipRazonSocial(docNumber) {
  const cleaned = String(docNumber).replace(/[-\s]/g, '')
  
  if (!cleaned || cleaned.length < 7 || cleaned.length > 11) {
    return null
  }

  // Si ya lo tenemos en cache
  if (nameCache[cleaned]) return nameCache[cleaned]

  const afip = getAfipInstance()
  if (!afip) return null

  // ─── Caso 1: CUIT directo (11 dígitos) ───
  if (cleaned.length === 11) {
    console.log(`[AFIP Helper] Consultando CUIT directo: ${cleaned}`)
    const name = await queryAfipByCuit(cleaned)
    if (name) {
      nameCache[cleaned] = name
      console.log(`[AFIP Helper] ✅ ${cleaned} → ${name}`)
      return name
    }
    return null
  }

  // ─── Caso 2: DNI (7-8 dígitos) → calcular posibles CUITs ───
  const possibleCuits = dniToPossibleCuits(cleaned)
  console.log(`[AFIP Helper] DNI ${cleaned} → probando CUITs: ${possibleCuits.join(', ')}`)

  for (const cuit of possibleCuits) {
    const name = await queryAfipByCuit(cuit)
    if (name) {
      // Guardar en cache tanto por DNI como por CUIT
      nameCache[cleaned] = name
      nameCache[cuit] = name
      console.log(`[AFIP Helper] ✅ DNI ${cleaned} → CUIT ${cuit} → ${name}`)
      return name
    }
  }

  console.log(`[AFIP Helper] DNI ${cleaned}: ninguno de los CUITs posibles devolvió datos`)
  return null
}
