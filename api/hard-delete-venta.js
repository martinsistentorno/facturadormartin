import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // Verificar autenticación mediante JWT de Supabase
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado: Falta cabecera de autenticación' })
  }

  const token = authHeader.split(' ')[1]
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Variables de entorno de Supabase no configuradas en el servidor' })
  }

  try {
    // Validar el token usando el cliente anon para verificar la identidad
    const client = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: authError } = await client.auth.getUser(token)

    if (authError || !user) {
      console.error('[Hard Delete Venta] Auth error:', authError)
      return res.status(401).json({ error: 'No autorizado: Token inválido o sesión expirada' })
    }

    const { id } = req.body || {}
    if (!id) {
      return res.status(400).json({ error: 'Falta parámetro id de la venta' })
    }

    console.log(`[Hard Delete Venta] Solicitud de eliminación física para venta ID: ${id} por usuario ${user.email}`)

    // Realizar la eliminación usando el cliente de administración (Service Role)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const { data, error: deleteError } = await adminClient
      .from('ventas')
      .delete()
      .eq('id', id)
      .select()

    if (deleteError) {
      console.error('[Hard Delete Venta] Error al eliminar en DB:', deleteError)
      return res.status(500).json({ error: 'Error de base de datos al eliminar la venta' })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' })
    }

    console.log(`[Hard Delete Venta] Venta ID: ${id} eliminada físicamente de forma exitosa`)
    return res.status(200).json({ success: true, deleted: data[0] })

  } catch (err) {
    console.error('[Hard Delete Venta] Error inesperado:', err)
    return res.status(500).json({ error: err.message })
  }
}
