import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function adjustPaymentData() {
  console.log('🚀 Separando Medio de Pago vs Forma de Pago en DB...')

  const { data: ventas, error } = await supabaseAdmin.from('ventas').select('id, datos_fiscales')
  if (error) return console.error(error)

  let count = 0
  for (const v of ventas) {
    if (v.datos_fiscales && v.datos_fiscales.forma_pago && !v.datos_fiscales.medio_pago) {
      const medioOriginal = v.datos_fiscales.forma_pago
      // Since existing records only have forma_pago, we duplicate it into medio_pago
      // New records will have both pulled fresh from Mercado Pago
      const updatedFiscales = { 
        ...v.datos_fiscales, 
        medio_pago: medioOriginal,
        forma_pago: medioOriginal // already simplified
      }
      
      const { error: upErr } = await supabaseAdmin.from('ventas').update({ datos_fiscales: updatedFiscales }).eq('id', v.id)
      if (!upErr) count++
    }
  }

  console.log(`✅ Se actualizaron ${count} registros con el esquema dual de pagos.`)
}

adjustPaymentData().catch(console.error)
