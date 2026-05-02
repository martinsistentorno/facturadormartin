import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function countConsumidorFinal() {
  const { data: allVentas } = await supabaseAdmin.from('ventas').select('id, cliente, datos_fiscales')
  
  const cfCount = allVentas.filter(v => v.cliente === 'Consumidor Final').length
  const totalCount = allVentas.length
  
  console.log(`Total records: ${totalCount}`)
  console.log(`Consumidor Final records: ${cfCount}`)

  // Ver si hay algunos que tengan DNI real pero dicen Consumidor Final
  const cfConDni = allVentas.filter(v => 
     v.cliente === 'Consumidor Final' && 
     v.datos_fiscales?.identification?.number?.length > 4
  )
  console.log(`CF con DNI guardado: ${cfConDni.length}`)
  if (cfConDni.length > 0) {
    console.log(JSON.stringify(cfConDni[0], null, 2))
  }
}

countConsumidorFinal().catch(console.error)
