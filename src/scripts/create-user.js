import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createAdmin() {
  const email = 'admin@comand.app'
  const password = 'comand2026'

  console.log(`Intentando crear usuario: ${email}...`)

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('El usuario ya existe, podés usarlo para entrar.')
    } else {
      console.error('Error creando usuario:', error.message)
    }
  } else {
    console.log('¡Usuario creado con éxito!')
    console.log('Email:', email)
    console.log('Password:', password)
  }
}

createAdmin()
