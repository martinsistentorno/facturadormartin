import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function test() {
  const { data: ventas } = await supabaseAdmin.from('ventas').select('cliente, datos_fiscales')
  console.log("Total ventas:", ventas.length)
  console.log("Con Cliente == Consumidor Final:", ventas.filter(v => v.cliente === 'Consumidor Final').length)
  console.log("Con Condicion IVA == Consumidor Final:", ventas.filter(v => 
      v.datos_fiscales && v.datos_fiscales.condicion_iva && v.datos_fiscales.condicion_iva.includes('Consumidor')
  ).length)
  console.log("Registros de SCHVABBAUER:")
  console.log(ventas.filter(v => v.cliente && v.cliente.includes('SCHVABBAUER')).map(v => v.datos_fiscales.condicion_iva))
}
test().catch()
