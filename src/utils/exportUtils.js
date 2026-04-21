import * as XLSX from 'xlsx';
import { translatePaymentMethod } from './paymentMethods';

/**
 * Prepara los datos de ventas en un formato tabular limpio.
 */
function prepareRows(ventas) {
  return ventas.map(v => ({
    'Fecha': v.fecha ? new Date(v.fecha).toLocaleDateString('es-AR') : '—',
    'Cliente': v.cliente || 'Consumidor Final',
    'CUIT': v.datos_fiscales?.cuit || '—',
    'Monto': Number(v.monto) || 0,
    'Estado': v.status || '—',
    'Nro Comprobante': v.nro_comprobante || '—',
    'CAE': v.cae || '—',
    'Vto CAE': v.vto_cae ? new Date(v.vto_cae).toLocaleDateString('es-AR') : '—',
    'Forma de Pago': translatePaymentMethod(v.datos_fiscales?.forma_pago),
    'Origen': v.datos_fiscales?.origen === 'mercadolibre' ? 'Mercado Libre' : v.datos_fiscales?.origen === 'mercadopago' ? 'Mercado Pago' : v.mp_payment_id ? 'Mercado Libre' : 'Manual',
  }));
}

/**
 * Exportar ventas a CSV y descargar inmediatamente.
 */
export function exportToCSV(ventas, filename = 'ventas') {
  const rows = prepareRows(ventas);
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = String(row[h] ?? '');
        // Escapar comillas y campos con comas
        return val.includes(',') || val.includes('"') || val.includes('\n')
          ? `"${val.replace(/"/g, '""')}"`
          : val;
      }).join(',')
    )
  ];

  const csvString = '\uFEFF' + csvLines.join('\n'); // BOM for Excel UTF-8
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Exportar ventas a Excel (.xlsx) con formato.
 */
export function exportToExcel(ventas, filename = 'ventas') {
  const rows = prepareRows(ventas);
  if (rows.length === 0) return;

  const ws = XLSX.utils.json_to_sheet(rows);

  // Ajustar anchos de columna
  const colWidths = Object.keys(rows[0]).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ventas');

  const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `${filename}.xlsx`);
}

/**
 * Helper para descargar un Blob como archivo.
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
