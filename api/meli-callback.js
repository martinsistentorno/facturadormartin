import { createClient } from '@supabase/supabase-js'

/**
 * Paso 2 del OAuth de Mercado Libre.
 * Recibe el código de autorización y lo intercambia por tokens.
 * Guarda access_token + refresh_token en Supabase.
 * 
 * GET /api/meli-callback?code=XXXX → intercambia por tokens
 */
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  const { code } = req.query

  if (!code) {
    return res.status(400).send(`
      <html><body style="font-family:system-ui;padding:40px;text-align:center">
        <h2 style="color:#C0443C">❌ Error</h2>
        <p>No se recibió el código de autorización de Mercado Libre.</p>
        <a href="/api/meli-auth">Intentar de nuevo</a>
      </body></html>
    `)
  }

  try {
    const appId = process.env.MELI_APP_ID
    const clientSecret = process.env.MELI_CLIENT_SECRET
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!appId || !clientSecret) throw new Error('Faltan MELI_APP_ID o MELI_CLIENT_SECRET')
    if (!supabaseUrl || !supabaseKey) throw new Error('Faltan credenciales de Supabase')

    const redirectUri = `https://${req.headers.host}/api/meli-callback`

    // Intercambiar código por tokens
    console.log('[MeLi Callback] Intercambiando código por tokens...')
    
    const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: appId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      console.error('[MeLi Callback] Error:', errText)
      throw new Error(`ML OAuth Error ${tokenRes.status}: ${errText}`)
    }

    const tokenData = await tokenRes.json()
    console.log('[MeLi Callback] Tokens obtenidos! Expira en', tokenData.expires_in, 'segundos')

    // Guardar en Supabase
    const supabase = createClient(supabaseUrl, supabaseKey)
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    // Upsert (insertar o actualizar si ya existe la fila con id=1)
    const { error: upsertError } = await supabase
      .from('meli_tokens')
      .upsert({
        id: 1,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })

    if (upsertError) {
      console.error('[MeLi Callback] Error guardando tokens:', upsertError.message)
      throw new Error(`Error guardando tokens: ${upsertError.message}`)
    }

    console.log('[MeLi Callback] Tokens guardados en Supabase OK')

    // Verificar identidad
    const meRes = await fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    })
    let userInfo = ''
    if (meRes.ok) {
      const me = await meRes.json()
      userInfo = `<p>Cuenta: <strong>${me.nickname || me.first_name || me.id}</strong> (ID: ${me.id})</p>`
    }

    return res.status(200).send(`
      <html><body style="font-family:system-ui;padding:40px;text-align:center;max-width:500px;margin:0 auto">
        <h2 style="color:#2D8F5E">✅ ¡Autorización exitosa!</h2>
        ${userInfo}
        <p>Los tokens se guardaron en la base de datos.</p>
        <p style="color:#666;font-size:14px">El sistema se va a encargar de renovarlos automáticamente. No hace falta volver a hacer esto.</p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
        <p style="font-size:13px;color:#999">Token expira: ${expiresAt.toLocaleString('es-AR')}</p>
        <a href="/" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#000;color:#fff;text-decoration:none;font-weight:bold;text-transform:uppercase;letter-spacing:1px">
          Volver al Dashboard
        </a>
      </body></html>
    `)

  } catch (err) {
    console.error('[MeLi Callback] ERROR:', err.message)
    return res.status(500).send(`
      <html><body style="font-family:system-ui;padding:40px;text-align:center">
        <h2 style="color:#C0443C">❌ Error</h2>
        <p>${err.message}</p>
        <a href="/api/meli-auth">Intentar de nuevo</a>
      </body></html>
    `)
  }
}
