import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function undoMartinWipe() {
  // Delete the 10 records I ruined so the next sync will fetch them freshly and accurately from Mercado Pago
  const { data: ruined } = await supabaseAdmin
    .from('ventas')
    .select('id')
    .ilike('datos_fiscales->>email', '%sanmartin3d@gmail.com%')
    .eq('cliente', 'Consumidor Final')

  for (const r of ruined) {
    await supabaseAdmin.from('ventas').delete().eq('id', r.id)
  }

  console.log(`Deleted ${ruined.length} ruined records. They will be recovered cleanly on next sync.`)
}

undoMartinWipe().catch(console.error)
