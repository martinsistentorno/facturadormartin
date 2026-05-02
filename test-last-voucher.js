import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function getLastVoucher() {
  const { data: ventas } = await supabaseAdmin
    .from('ventas')
    .select('id, nro_comprobante, cae')
    .not('cae', 'is', null)
    .not('nro_comprobante', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
  
  if (ventas.length === 0) {
    console.log("No facturas with CAE found in DB.")
    return
  }
  
  console.log("Latest Factura in Supabase:", ventas[0])
}

getLastVoucher().catch(console.error)
