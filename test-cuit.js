import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function test() {
  const { data: ventas } = await supabaseAdmin
    .from('ventas')
    .select('id, cliente, datos_fiscales')
    .ilike('datos_fiscales->identification->>number', '%20337950117%')
  
  console.log(JSON.stringify(ventas, null, 2))
}

test().catch(console.error)
