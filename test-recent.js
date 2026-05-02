import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function testRecent() {
  const { data: ventas } = await supabaseAdmin.from('ventas').select('created_at, cliente, datos_fiscales').order('created_at', { ascending: false }).limit(5)
  console.log(JSON.stringify(ventas, null, 2))
}

testRecent().catch(console.error)
