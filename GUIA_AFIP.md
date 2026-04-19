# 🧾 Guía Paso a Paso: Conectar AFIP al Facturador

Esta guía está pensada para seguirse en vivo con el cliente.  
Tiempo estimado: **20-30 minutos**.

---

## Datos que necesitás tener a mano ANTES de empezar

Preguntale esto al cliente antes de arrancar:

| Dato | Ejemplo | ¿Quién lo tiene? |
|---|---|---|
| CUIT del negocio (sin guiones) | `20412345678` | El cliente |
| Razón Social exacta | `MARTINEZ JUAN CARLOS` | El cliente |
| Domicilio fiscal | `Av. Corrientes 1234, CABA` | El cliente |
| Condición frente al IVA | `Responsable Monotributo` o `Responsable Inscripto` | El cliente |
| Punto de Venta electrónico | `1` (o el que tenga habilitado en AFIP) | El cliente |
| Tipo de comprobante | `11` (Factura C para Monotributo) o `6` (Factura B para RI) | El cliente |
| Fecha de Inicio de Actividades | `01/03/2020` | El cliente |
| Nro de IIBB (si tiene) | `123-456789-0` | El cliente |
| Clave Fiscal de AFIP (nivel 3+) | *(la contraseña para entrar a AFIP)* | El cliente |

---

## PASO 1: Obtener el Certificado Digital de AFIP

El cliente necesita generar un certificado digital que autorice a nuestro sistema a emitir facturas en su nombre.

### 1.1 — Generar la Clave Privada y el CSR

Abrir una terminal (PowerShell o CMD) y ejecutar **estos dos comandos exactos**:

```bash
openssl genrsa -out MiClavePrivada.key 2048
```

```bash
openssl req -new -key MiClavePrivada.key -subj "/C=AR/O=NOMBRE_RAZON_SOCIAL/CN=NOMBRE_RAZON_SOCIAL/serialNumber=CUIT XXXXXXXXXXX" -out MiPedido.csr
```

> ⚠️ **IMPORTANTE:** Reemplazá `NOMBRE_RAZON_SOCIAL` con la razón social del cliente y `XXXXXXXXXXX` con su CUIT sin guiones.
> 
> Ejemplo real:
> ```
> openssl req -new -key MiClavePrivada.key -subj "/C=AR/O=MARTINEZ JUAN CARLOS/CN=MARTINEZ JUAN CARLOS/serialNumber=CUIT 20412345678" -out MiPedido.csr
> ```

Esto genera 2 archivos:
- `MiClavePrivada.key` → **GUARDAR EN LUGAR SEGURO. NUNCA COMPARTIR.**
- `MiPedido.csr` → Este se sube a AFIP en el paso siguiente.

### 1.2 — Subir el CSR a AFIP y obtener el Certificado

1. Ir a [https://auth.afip.gob.ar/contribuyente/](https://auth.afip.gob.ar/contribuyente/)
2. Iniciar sesión con CUIT y Clave Fiscal del cliente
3. Buscar el servicio **"Administración de Certificados Digitales"**
   - Si no aparece, ir a *"Administrar Relaciones"* → *"AFIP"* → habilitar *"Administración de Certificados Digitales"*
4. Dentro del servicio:
   - Click en **"Agregar alias nuevo"**
   - Elegir un nombre (ej: `facturador-cmd`)
   - Click en **"Agregar certificado"**
   - Subir el archivo `MiPedido.csr`
   - AFIP te va a devolver un archivo `.crt` para descargar → **descargarlo**
5. Ahora hay que **autorizar el certificado para facturar**:
   - Ir al servicio **"Administración de Relaciones"**
   - Agregar una nueva relación con el servicio **"Facturación Electrónica" (wsfe)**
   - Asociar el alias `facturador-cmd` que acabás de crear

Al final de este paso tenés que tener **2 archivos**:
- `MiClavePrivada.key` (del paso 1.1)
- `certificado.crt` (descargado de AFIP)

---

## PASO 2: Obtener el Token del SDK

Nuestro sistema usa el SDK de [afipsdk.com](https://afipsdk.com) para comunicarse con AFIP.

1. Ir a [https://app.afipsdk.com/](https://app.afipsdk.com/)
2. Crear una cuenta gratuita (o iniciar sesión si ya existe)
3. Ir a **"API Keys"** o **"Tokens"**
4. Generar un nuevo token
5. Copiar el token generado (es un texto largo)

---

## PASO 3: Convertir Certificado y Clave a Base64

En la misma terminal donde generaste los archivos, ejecutá:

### En PowerShell (Windows):
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("MiClavePrivada.key"))
```
Copiar TODO el texto que sale → este es tu `AFIP_KEY_BASE64`

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificado.crt"))
```
Copiar TODO el texto que sale → este es tu `AFIP_CERT_BASE64`

### En Mac/Linux:
```bash
base64 -i MiClavePrivada.key
base64 -i certificado.crt
```

---

## PASO 4: Cargar las Variables en Vercel

Ir al panel de Vercel → tu proyecto → **Settings → Environment Variables** y cargar:

| Variable | Valor |
|---|---|
| `AFIP_CUIT` | CUIT sin guiones (ej: `20412345678`) |
| `AFIP_CERT_BASE64` | El texto base64 del certificado (paso 3) |
| `AFIP_KEY_BASE64` | El texto base64 de la clave privada (paso 3) |
| `AFIP_SDK_TOKEN` | El token de afipsdk.com (paso 2) |
| `AFIP_PTO_VTA` | Punto de venta (ej: `1`) |
| `AFIP_PRODUCTION` | `true` |
| `AFIP_SANDBOX` | `false` |

Y también los datos del emisor para los PDFs:

| Variable | Valor |
|---|---|
| `VITE_EMISOR_RAZON_SOCIAL` | Razón social exacta |
| `VITE_EMISOR_CUIT` | CUIT sin guiones |
| `VITE_EMISOR_CUIT_FMT` | CUIT con guiones (ej: `20-41234567-8`) |
| `VITE_EMISOR_DOMICILIO` | Domicilio fiscal |
| `VITE_EMISOR_INICIO_ACT` | Fecha inicio actividades |
| `VITE_EMISOR_COND_IVA` | `Responsable Monotributo` o `IVA Responsable Inscripto` |
| `VITE_EMISOR_IIBB` | Nro IIBB (o dejarlo vacío) |
| `VITE_EMISOR_PTO_VTA` | Mismo punto de venta |
| `VITE_EMISOR_TIPO_CBTE` | `11` (Factura C) o `6` (Factura B) |

---

## PASO 5: Hacer el Deploy y Probar

1. Hacer un nuevo deploy en Vercel (push a Git o `vercel --prod`)
2. Entrar al facturador
3. Crear una venta manual de prueba (ej: $100, "Cliente Test")
4. Seleccionarla y tocar **"Facturar"**
5. Si todo está bien:
   - La venta pasa a estado **"Facturado"** ✅
   - Aparece un número de CAE
   - Se puede descargar el PDF

---

## ❌ Errores comunes

| Error | Causa | Solución |
|---|---|---|
| `Faltan credenciales de AFIP` | Variables no cargadas en Vercel | Verificar que estén en *Production* (no solo Preview) |
| `Falta AFIP_SDK_TOKEN` | No se registró en afipsdk.com | Crear cuenta y generar token |
| `WSAA Error` | Certificado no autorizado para wsfe | Volver al paso 1.2 punto 5 (autorizar relación) |
| `Punto de venta inválido` | El PtoVta no existe en AFIP | El cliente debe habilitar el punto de venta electrónico desde AFIP |
| `Error de firma` | Key o Cert mal convertido a base64 | Regenerar el base64, asegurarse de copiar TODO el texto |

---

## 🔒 Nota de Seguridad

- La clave privada (`.key`) **nunca** debe compartirse por email o chat
- En Vercel las variables están cifradas
- El certificado tiene vigencia de **2 años**, después hay que renovarlo
