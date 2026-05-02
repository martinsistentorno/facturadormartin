import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function testConsumidorFinal() {
  const { data: ventas } = await supabaseAdmin
    .from('ventas')
    .select('id, cliente, datos_fiscales')
    .eq('cliente', 'Consumidor Final')
    .not('datos_fiscales', 'is', null) // asegurar que existan datos_fiscales
  
  // Imprimir los primeros 5 para diagnóstico
  console.log('--- 5 Registros de Consumidor Final ---')
  console.log(JSON.stringify(ventas.slice(0, 5), null, 2))
  
  // Buscar a ver por qué falló doc.length === 11
  const badMeliIds = ventas.filter(v => v.datos_fiscales?.identification?.number?.length === 11)
  console.log(`-> Registros con identification.number == 11 : ${badMeliIds.length}`)

}

testConsumidorFinal().catch(console.error)
