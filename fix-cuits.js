import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { getAfipRazonSocial } from './api/lib/afip-helper.js'

dotenv.config()

// Forzar configuración local a producción para que AFIP reconozca CUITs reales
process.env.AFIP_PRODUCTION = 'true'
process.env.AFIP_SANDBOX = 'false'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function fixCuits() {
  console.log('🚀 Iniciando corrección de CUITs usando AFIP Producción...')

  // 1. Obtener todas las ventas pendientes que tengan CUIT (length >= 10) 
  // pero que figuren como Consumidor Final o no tengan la condición de IVA correcta.
  const { data: ventas, error } = await supabaseAdmin
    .from('ventas')
    .select('*')
    .eq('status', 'pendiente')

  if (error) {
    return console.error('Error fetching ventas:', error.message)
  }

  const toFix = ventas.filter(v => {
    const doc = v.datos_fiscales?.identification?.number || ''
    return doc.length === 11 && v.cliente === 'Consumidor Final'
  })

  console.log(`Se encontraron ${toFix.length} ventas recuperadas que tienen CUIT real y necesitan re-consulta.`)

  let updatedCount = 0

  for (const v of toFix) {
    const docNumber = v.datos_fiscales.identification.number
    console.log(`- Consultando CUIT ${docNumber}...`)

    try {
      const afipResult = await getAfipRazonSocial(docNumber)
      if (afipResult) {
        const razonSocial = afipResult.razonSocial
        const condicion_iva = afipResult.condicion_iva
        
        let ivaMapped = condicion_iva
        const map = {
          'Monotributista': 'Responsable Monotributo',
          'Responsable Inscripto': 'IVA Responsable Inscripto',
          'Exento': 'IVA Sujeto Exento',
        }
        if (map[condicion_iva]) ivaMapped = map[condicion_iva]

        console.log(`   └> AFIP OK: ${razonSocial} | ${ivaMapped}`)

        const updatedFiscales = {
          ...v.datos_fiscales,
          cuit: afipResult.cuit,
          condicion_iva: ivaMapped
        }

        const { error: upErr } = await supabaseAdmin.from('ventas')
          .update({
            cliente: razonSocial,
            datos_fiscales: updatedFiscales
          })
          .eq('id', v.id)

        if (!upErr) updatedCount++
      } else {
        console.log(`   └> AFIP no devolvió datos para este CUIT.`)
      }
    } catch (e) {
      console.log(`   └> Error AFIP: ${e.message}`)
    }
    
    // Pequeno delay para no saturar AFIP
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`✅ ¡Proceso finalizado! ${updatedCount} registros actualizados con Razón Social y condición de IVA.`)
}

fixCuits().catch(console.error)
