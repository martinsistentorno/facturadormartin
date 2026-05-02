import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function testMissing() {
  const { data: ventas } = await supabaseAdmin
    .from('ventas')
    .select('id, cliente, datos_fiscales')
    .ilike('datos_fiscales->identification->>number', '%20337950117%')
  
  console.log('All records matching 20337950117 anywhere in identification:')
  console.log(JSON.stringify(ventas, null, 2))
}

testMissing().catch(console.error)
