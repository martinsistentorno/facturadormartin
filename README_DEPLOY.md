# 🚀 Guía de Despliegue — Facturador CMD

## Cómo desplegar para un nuevo cliente

### 1. Crear repositorio
```bash
# Desde GitHub: "Use this template" → crear nuevo repo
# Ejemplo: facturador-clienteB
```

### 2. Crear proyecto en Supabase
1. Nuevo proyecto en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor** y ejecutar:
```sql
CREATE TABLE ventas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha TIMESTAMPTZ DEFAULT now(),
  cliente TEXT,
  monto NUMERIC,
  status TEXT DEFAULT 'pendiente',
  datos_fiscales JSONB DEFAULT '{}',
  mp_payment_id TEXT,
  cae TEXT,
  nro_comprobante TEXT,
  vto_cae TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios autenticados pueden todo" ON ventas
  FOR ALL USING (auth.role() = 'authenticated');
```
3. Ir a **Storage** → **New Bucket** → nombre: `facturas` → marcar **Public**
4. Anotar las credenciales de **Settings > API**:
   - `Project URL` → será `VITE_SUPABASE_URL`
   - `anon/public key` → será `VITE_SUPABASE_ANON_KEY`
   - `service_role key` → será `SUPABASE_SERVICE_ROLE_KEY`

### 3. Crear usuario de acceso
En Supabase → **Authentication** → **Add User** → email + contraseña para el cliente.

### 4. Certificado AFIP
El cliente debe tener un certificado de AFIP para factura electrónica.
```bash
# Convertir certificado y clave a Base64:
# En Linux/Mac:
base64 -i certificado.crt | tr -d '\n'
base64 -i clave_privada.key | tr -d '\n'

# En Windows (PowerShell):
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificado.crt"))
[Convert]::ToBase64String([IO.File]::ReadAllBytes("clave_privada.key"))
```
Esos textos largos son `AFIP_CERT_BASE64` y `AFIP_KEY_BASE64`.

### 5. Token AFIP SDK
1. Registrarse en [app.afipsdk.com](https://app.afipsdk.com)
2. Generar un Access Token
3. Ese es `AFIP_SDK_TOKEN`

### 6. Conectar a Vercel
1. Importar el repo en [vercel.com](https://vercel.com)
2. Framework: **Vite**
3. En **Settings > Environment Variables**, cargar TODAS estas variables:

| Variable | Descripción | Ejemplo |
|---|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clave pública de Supabase | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada de Supabase | `eyJ...` |
| `AFIP_CUIT` | CUIT del emisor (sin guiones) | `20123456789` |
| `AFIP_CERT_BASE64` | Certificado AFIP en Base64 | `MII...` |
| `AFIP_KEY_BASE64` | Clave privada AFIP en Base64 | `MII...` |
| `AFIP_SDK_TOKEN` | Token de afipsdk.com | `abc123...` |
| `AFIP_PTO_VTA` | Punto de venta AFIP | `1` |
| `AFIP_PRODUCTION` | Usar AFIP producción | `true` |
| `AFIP_SANDBOX` | Modo simulación (sin AFIP real) | `false` |
| `VITE_EMISOR_RAZON_SOCIAL` | Razón social del cliente | `PEREZ JUAN` |
| `VITE_EMISOR_CUIT` | CUIT del cliente | `20123456789` |
| `VITE_EMISOR_CUIT_FMT` | CUIT formateado | `20-12345678-9` |
| `VITE_EMISOR_DOMICILIO` | Dirección fiscal | `AV. SIEMPRE VIVA 123` |
| `VITE_EMISOR_INICIO_ACT` | Inicio de actividades | `01/01/2020` |
| `VITE_EMISOR_COND_IVA` | Condición ante IVA | `Responsable Monotributo` |
| `VITE_EMISOR_IIBB` | Nro Ingresos Brutos | `20-12345678-9` |
| `VITE_EMISOR_PTO_VTA` | Punto de venta (UI) | `1` |
| `VITE_EMISOR_TIPO_CBTE` | Tipo comprobante (11=C, 6=B, 1=A) | `11` |
| `MELI_ACCESS_TOKEN` | Token de Mercado Libre | `APP_USR-...` |
| `MELI_APP_ID` | App ID de Mercado Libre | `123456789` |
| `APP_URL` | URL de la app desplegada | `https://facturador-clienteB.vercel.app` |

### 7. Deploy
Vercel despliega automáticamente al hacer push. Si necesitás forzar:
> Vercel Dashboard → Deployments → Redeploy

---

## Checklist rápido para un cliente nuevo
- [ ] Repo creado desde template
- [ ] Proyecto Supabase creado
- [ ] Tabla `ventas` creada
- [ ] Bucket `facturas` creado (público)
- [ ] Usuario de acceso creado en Auth
- [ ] Certificado AFIP convertido a Base64
- [ ] Token AFIP SDK obtenido
- [ ] Todas las env vars cargadas en Vercel
- [ ] Deploy exitoso
- [ ] Prueba con SANDBOX=true primero
- [ ] Cambiar a PRODUCTION=true cuando esté listo
