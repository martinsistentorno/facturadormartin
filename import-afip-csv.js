import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Falta configurar VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Nombre del archivo CSV descargado de AFIP (asegurate de ponerlo en la misma carpeta)
const CSV_FILE = 'mis-comprobantes-emitidos.csv';

function parseCSVLine(line) {
  // Limpia comillas y separa por punto y coma (separador por defecto de AFIP en exportaciones en español)
  // Si tu archivo usa coma, cambiá el split(';') por split(',')
  return line.replace(/"/g, '').split(';').map(cell => cell.trim());
}

async function run() {
  const filePath = path.resolve(CSV_FILE);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Archivo no encontrado: ${CSV_FILE}`);
    console.log('Por favor, descarga el CSV de "Mis Comprobantes" desde AFIP, renombralo como "mis-comprobantes-emitidos.csv" y guardalo en la raíz de este proyecto.');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  // Dividir el archivo en líneas y filtrar líneas vacías
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length <= 1) {
    console.error('❌ El archivo CSV está vacío o solo contiene la cabecera.');
    process.exit(1);
  }

  // Parsear cabecera para mapear los índices de las columnas dinámicamente
  const headers = parseCSVLine(lines[0]);
  console.log('Cabeceras detectadas:', headers);

  // Mapeo de índices de columnas críticas
  const getIndex = (names) => {
    for (const name of names) {
      const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxFecha = getIndex(['fecha', 'fecha de emisión', 'fecha de emision']);
  const idxPuntoVenta = getIndex(['punto de venta', 'pto vta', 'pto. vta.']);
  const idxNumero = getIndex(['número desde', 'nro desde', 'nro. desde', 'numero']);
  const idxTipoDoc = getIndex(['tipo doc receptor', 'tipo doc. receptor', 'tipo doc', 'tipo documento']);
  const idxNroDoc = getIndex(['nro. doc. receptor', 'nro doc. receptor', 'nro doc receptor', 'nro doc', 'documento receptor', 'cuit/cuil receptor']);
  const idxNombre = getIndex(['denominación receptor', 'denominacion receptor', 'nombre receptor', 'razon social receptor']);
  const idxMonto = getIndex(['importe total', 'imp. total', 'total', 'monto']);
  const idxCae = getIndex(['cae', 'cód. autorización', 'cod. autorizacion', 'cod.autorizacion']);

  // Validaciones básicas de estructura
  if (idxFecha === -1 || idxNumero === -1 || idxMonto === -1) {
    console.error('❌ Error: No se pudieron mapear las columnas requeridas (Fecha, Número Desde/Comprobante, Importe Total).');
    console.log('Verificá que el archivo use punto y coma (;) como separador.');
    process.exit(1);
  }

  // --- Obtener comprobantes ya existentes en la base de datos para evitar duplicados ---
  console.log('🔍 Consultando facturas existentes en Supabase para evitar duplicados...');
  const { data: existingVentas, error: fetchError } = await supabase
    .from('ventas')
    .select('nro_comprobante, cae')
    .not('nro_comprobante', 'is', null);

  if (fetchError) {
    console.error('❌ Error al consultar las ventas existentes:', fetchError.message);
    process.exit(1);
  }

  const existingCaes = new Set(existingVentas.map(v => v.cae?.trim()).filter(Boolean));
  const existingNros = new Set(existingVentas.map(v => {
    if (!v.nro_comprobante) return null;
    const parts = v.nro_comprobante.split('-');
    if (parts.length !== 2) return v.nro_comprobante.trim();
    return `${parseInt(parts[0])}-${parseInt(parts[1])}`;
  }).filter(Boolean));

  console.log(`💡 Se encontraron ${existingVentas.length} comprobantes en tu base de datos.`);

  console.log(`\n🚀 Iniciando importación de ${lines.length - 1} comprobantes...\n`);

  let exitosos = 0;
  let fallidos = 0;
  let salteados = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < headers.length) continue; // Saltear líneas incompletas

    try {
      const fechaOriginal = row[idxFecha]?.trim();
      let fechaIso = null;

      if (fechaOriginal.includes('/')) {
        const parts = fechaOriginal.split('/');
        if (parts.length === 3) {
          fechaIso = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`).toISOString();
        }
      } else if (fechaOriginal.includes('-')) {
        const parts = fechaOriginal.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // Formato AAAA-MM-DD
            fechaIso = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T12:00:00Z`).toISOString();
          } else {
            // Formato DD-MM-AAAA
            fechaIso = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`).toISOString();
          }
        }
      }

      if (!fechaIso || isNaN(new Date(fechaIso).getTime())) {
        console.warn(`⚠️ Fila ${i}: Fecha con formato inválido (${fechaOriginal}). Se saltea.`);
        continue;
      }

      const ptoVta = idxPuntoVenta !== -1 ? row[idxPuntoVenta].padStart(4, '0') : '0001';
      const nroComp = row[idxNumero].padStart(8, '0');
      const nroComprobanteFormateado = `${parseInt(ptoVta)}-${parseInt(nroComp)}`;
      const cae = idxCae !== -1 ? row[idxCae].trim() : '';

      // VALIDACIÓN ANTIDUPLICADO
      if ((cae && existingCaes.has(cae)) || existingNros.has(nroComprobanteFormateado)) {
        console.log(`⚠️ Fila ${i}: Salteado Cbte ${nroComprobanteFormateado} (CAE: ${cae}) — Ya existe en la base de datos.`);
        salteados++;
        continue;
      }

      const cuitCliente = idxNroDoc !== -1 ? row[idxNroDoc] : '';
      const docType = idxTipoDoc !== -1 ? row[idxTipoDoc] : 'DNI';
      const nombreCliente = idxNombre !== -1 ? row[idxNombre] : 'Consumidor Final';
      
      // Parsear importe (reemplazar coma por punto para float en JS)
      const montoRaw = row[idxMonto].replace(/\./g, '').replace(',', '.');
      const monto = parseFloat(montoRaw) || 0;

      const ventaRecord = {
        fecha: fechaIso,
        cliente: nombreCliente || 'Consumidor Final',
        monto: monto,
        status: 'facturado', // Ya están facturados en AFIP
        cae: cae || null,
        nro_comprobante: nroComprobanteFormateado,
        created_at: fechaIso,
        datos_fiscales: {
          identification: { 
            type: docType || 'DNI', 
            number: cuitCliente 
          },
          cuit: cuitCliente.length === 11 ? cuitCliente : '',
          condicion_iva: cuitCliente.length === 11 ? 'Responsable Inscripto' : 'Consumidor Final',
          origen: 'importacion_afip',
          descripcion: 'Histórico importado de AFIP'
        }
      };

      const { error } = await supabase.from('ventas').insert([ventaRecord]);
      if (error) {
        console.error(`❌ Fila ${i} (Cbte ${nroComprobanteFormateado}): Error al insertar en Supabase:`, error.message);
        fallidos++;
      } else {
        console.log(`✅ Fila ${i}: Importado Cbte ${nroComprobanteFormateado} | $${monto} | ${nombreCliente}`);
        exitosos++;
      }
    } catch (err) {
      console.error(`❌ Fila ${i}: Error inesperado:`, err.message);
      fallidos++;
    }
  }

  console.log(`\n🎉 Resumen del proceso:`);
  console.log(`   - Exitosos (nuevos): ${exitosos}`);
  console.log(`   - Salteados (ya existentes): ${salteados}`);
  console.log(`   - Fallidos: ${fallidos}`);
}

run().catch(console.error);
