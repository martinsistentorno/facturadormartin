import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function testWiped() {
  const { data: ventas } = await supabaseAdmin.from('ventas').select('id, cliente, datos_fiscales').eq('cliente', 'Consumidor Final')
  console.log("Ruined records:", ventas.length)
  for (const v of ventas) {
     if (v.datos_fiscales && v.datos_fiscales.email) {
         console.log(`- ID: ${v.id} | Email: ${v.datos_fiscales.email} | Origin: ${v.datos_fiscales.origen}`)
     }
  }
}

testWiped().catch(console.error)
