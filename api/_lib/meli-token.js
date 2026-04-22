import { createClient } from '@supabase/supabase-js'

/**
 * Helper para obtener un Access Token válido de Mercado Libre.
 * 
 * 1. Lee el token de la tabla `meli_tokens` en Supabase
 * 2. Si no expiró, lo devuelve
 * 3. Si expiró, usa el refresh_token para obtener uno nuevo
 * 4. Guarda el nuevo token en Supabase
 * 5. Devuelve el access_token válido
 */

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan credenciales de Supabase')
  return createClient(url, key)
}

export async function getValidAccessToken() {
  const supabase = getSupabase()

  // 1. Leer token almacenado
  const { data: tokenRow, error: readError } = await supabase
    .from('meli_tokens')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (readError) {
    console.error('[MeLi Token] Error leyendo token:', readError.message)
    throw new Error('No se pudo leer el token de la base de datos')
  }

  if (!tokenRow) {
    // No hay token guardado, intentar con la env var como fallback
    const envToken = process.env.MELI_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN
    if (envToken) {
      console.warn('[MeLi Token] No hay token en DB, usando env var como fallback')
      return envToken
    }
    throw new Error('No hay token de Mercado Libre configurado. Visitá /api/meli-auth para autorizar.')
  }

  // 2. ¿El token sigue vigente? (con 5 min de margen)
  const now = new Date()
  const expiresAt = new Date(tokenRow.expires_at)
  const marginMs = 5 * 60 * 1000 // 5 minutos de margen

  if (expiresAt.getTime() - marginMs > now.getTime()) {
    console.log('[MeLi Token] Token vigente, expira:', expiresAt.toISOString())
    return tokenRow.access_token
  }

  // 3. Token expirado → Refrescar
  console.log('[MeLi Token] Token expirado, refrescando...')
  
  const appId = process.env.MELI_APP_ID
  const clientSecret = process.env.MELI_CLIENT_SECRET

  if (!appId || !clientSecret) {
    throw new Error('Faltan MELI_APP_ID o MELI_CLIENT_SECRET para refrescar el token')
  }

  const refreshRes = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: appId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token
    })
  })

  if (!refreshRes.ok) {
    const errText = await refreshRes.text()
    console.error('[MeLi Token] Error refrescando token:', errText)
    throw new Error(`Error refrescando token de ML: ${refreshRes.status} - ${errText}`)
  }

  const newTokenData = await refreshRes.json()
  console.log('[MeLi Token] Token refrescado OK, nuevo expira en', newTokenData.expires_in, 'segundos')

  // 4. Guardar nuevo token en Supabase
  const newExpiresAt = new Date(Date.now() + newTokenData.expires_in * 1000)

  const { error: updateError } = await supabase
    .from('meli_tokens')
    .update({
      access_token: newTokenData.access_token,
      refresh_token: newTokenData.refresh_token,
      expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', 1)

  if (updateError) {
    console.error('[MeLi Token] Error guardando token nuevo:', updateError.message)
    // Aun así devolvemos el token nuevo, aunque no se haya guardado
  }

  return newTokenData.access_token
}
