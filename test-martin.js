import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function checkMartinWipe() {
  const { data: ventas } = await supabaseAdmin
    .from('ventas')
    .select('id, cliente, datos_fiscales')
    .ilike('datos_fiscales->>email', '%martin%')
  
  console.log(`Emails con martin: ${ventas.length}`)
  console.log(ventas.slice(0, 5))
}

checkMartinWipe().catch(console.error)
