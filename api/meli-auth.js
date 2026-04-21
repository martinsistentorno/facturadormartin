/**
 * Paso 1 del OAuth de Mercado Libre.
 * Redirige al usuario a la página de autorización de ML.
 * 
 * GET /api/meli-auth → redirige a ML para autorizar
 */
export default async function handler(req, res) {
  const appId = process.env.MELI_APP_ID
  
  if (!appId) {
    return res.status(500).json({ error: 'Falta MELI_APP_ID en las variables de entorno' })
  }

  // La redirect URI debe coincidir EXACTAMENTE con la configurada en la app de ML
  const redirectUri = `https://${req.headers.host}/api/meli-callback`
  
  const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`

  console.log('[MeLi Auth] Redirigiendo a:', authUrl)
  
  return res.redirect(302, authUrl)
}
