import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function fixMartinSist() {
  console.log('🚀 Corrigiendo registros de MARTIN SIST a Consumidor Final...')

  // Fix 1: Donde el cliente diga MARTIN o MARTINSIST
  const { data: ventasMartin } = await supabaseAdmin
    .from('ventas')
    .select('*')
    .ilike('cliente', '%martin%')
  
  // Fix 2: Donde el CUIT sea de Martin
  const { data: ventasCuit } = await supabaseAdmin
    .from('ventas')
    .select('*')
    .contains('datos_fiscales', { cuit: '20354302684' })

  const { data: ventasDni } = await supabaseAdmin
    .from('ventas')
    .select('*')
    .contains('datos_fiscales', { cuit: '35430268' })

  const allToFix = [...(ventasMartin || []), ...(ventasCuit || []), ...(ventasDni || [])]
  // Deduplicate
  const uniqueToFix = Array.from(new Map(allToFix.map(item => [item.id, item])).values())

  console.log(`Se encontraron ${uniqueToFix.length} registros para corregir.`)

  let updated = 0
  for (const v of uniqueToFix) {
    const updatedDatosFiscales = { ...v.datos_fiscales, cuit: '', condicion_iva: 'Consumidor Final' }
    if (updatedDatosFiscales.identification) {
       updatedDatosFiscales.identification.number = ''
    }

    const { error } = await supabaseAdmin
      .from('ventas')
      .update({
        cliente: 'Consumidor Final',
        datos_fiscales: updatedDatosFiscales
      })
      .eq('id', v.id)
    
    if (!error) updated++
  }

  console.log(`✅ Se corrigieron ${updated} registros exitosamente.`)
}

fixMartinSist().catch(console.error)
