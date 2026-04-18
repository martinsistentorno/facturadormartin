import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Comand] Supabase no configurado. Agregá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY a tu .env'
  )
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)
