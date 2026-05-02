import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function fixPaymentMethods() {
  console.log('🚀 Corrigiendo nombres de formas de pago en la DB...')

  const { data: ventas, error } = await supabaseAdmin
    .from('ventas')
    .select('id, datos_fiscales')
  
  if (error) return console.error(error)

  const mappings = {
    'Dinero en Cuenta': 'Mercado Pago',
    'Transferencia': 'Transferencia Bancaria',
    'cvu': 'Transferencia Bancaria'
  }

  let count = 0
  for (const v of ventas) {
    const current = v.datos_fiscales?.forma_pago
    if (mappings[current]) {
      const updatedFiscales = { ...v.datos_fiscales, forma_pago: mappings[current] }
      
      const { error: upErr } = await supabaseAdmin
        .from('ventas')
        .update({ datos_fiscales: updatedFiscales })
        .eq('id', v.id)
      
      if (!upErr) count++
    }
  }

  console.log(`✅ Se actualizaron ${count} registros con nombres de pago más legibles.`)
}

fixPaymentMethods().catch(console.error)
