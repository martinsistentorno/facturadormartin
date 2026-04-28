import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

// Mapping de tipo comprobante a labels
const CBTE_LABELS = {
  11: { letter: 'C', code: '011', name: 'FACTURA' },
  12: { letter: 'C', code: '012', name: 'NOTA DE DÉBITO' },
  13: { letter: 'C', code: '013', name: 'NOTA DE CRÉDITO' },
  15: { letter: 'C', code: '015', name: 'RECIBO' },
  1:  { letter: 'A', code: '001', name: 'FACTURA' },
  6:  { letter: 'B', code: '006', name: 'FACTURA' },
};

const UNIDAD_LABELS = {
  7: 'unidades', 1: 'kg', 2: 'metros', 3: 'litros',
  5: 'toneladas', 97: 'otras', 98: 'bonif.', 99: 's/d',
};

/**
 * Genera y descarga un PDF de factura con el formato reglamentario de AFIP.
 * @param {Object} venta - Objeto de la venta con datos fiscales y de facturación.
 * @param {Object} emisor - Datos del emisor (desde config_emisor de Supabase).
 */
export async function generateInvoicePdf(venta, emisor) {
  // Fallback si no se pasan datos de emisor
  const e = {
    razonSocial: emisor?.razon_social || 'SIN CONFIGURAR',
    cuit: emisor?.cuit || '00000000000',
    cuitFormateado: emisor?.cuit_fmt || '00-00000000-0',
    domicilio: emisor?.domicilio || '',
    inicioActividades: emisor?.inicio_actividades || '',
    condicionIva: emisor?.condicion_iva || 'Responsable Monotributo',
    ingresosBrutos: emisor?.ingresos_brutos || emisor?.cuit_fmt || '',
    ptoVta: emisor?.pto_vta || 1,
    tipoCbte: emisor?.tipo_cbte || 11,
  };

  const df = venta.datos_fiscales || {};
  const tipoCbte = df.tipo_cbte || e.tipoCbte;
  const cbteInfo = CBTE_LABELS[tipoCbte] || CBTE_LABELS[11];

  const doc = new jsPDF();
  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ─── Rectángulo Principal ───
  doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2));

  // ─── Línea Divisoria Cabecera ───
  doc.line(pageWidth / 2, margin, pageWidth / 2, 55);

  // ─── El Cuadradito de la Letra ───
  doc.setFillColor(255, 255, 255);
  doc.rect((pageWidth / 2) - 8, margin - 1, 16, 14, 'FD');
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(cbteInfo.letter, pageWidth / 2, margin + 10, { align: 'center' });
  doc.setFontSize(8);
  doc.text(`COD. ${cbteInfo.code}`, pageWidth / 2, margin + 13, { align: 'center' });

  // ─── Datos Emisor (Izquierda) ───
  const maxLeftWidth = (pageWidth / 2) - margin - 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const razonSocialLines = doc.splitTextToSize(e.razonSocial, maxLeftWidth);
  doc.text(razonSocialLines, margin + 5, 25);
  
  const startYSub = 25 + (razonSocialLines.length * 6);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const domicilioLines = doc.splitTextToSize(`Domicilio: ${e.domicilio}`, maxLeftWidth);
  doc.text(domicilioLines, margin + 5, startYSub);
  
  doc.text(`Condición IVA: ${e.condicionIva}`, margin + 5, startYSub + (domicilioLines.length * 5) + 2);

  // ─── Datos Comprobante (Derecha) ───
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(cbteInfo.name, pageWidth - margin - 5, 22, { align: 'right' });
  
  doc.setFontSize(11);
  const nroCompArr = (venta.nro_comprobante || '0000-00000000').split('-');
  doc.text(`Punto de Venta: ${nroCompArr[0]}   Comp. Nro: ${nroCompArr[1]}`, pageWidth - margin - 5, 30, { align: 'right' });
  
  // Usar fecha de emisión AFIP si existe
  const fechaEmisionStr = df.fecha_emision
    ? new Date(df.fecha_emision + 'T12:00:00').toLocaleDateString('es-AR')
    : (venta.fecha ? new Date(venta.fecha).toLocaleDateString('es-AR') : '—');
  doc.text(`Fecha de Emisión: ${fechaEmisionStr}`, pageWidth - margin - 5, 37, { align: 'right' });
  
  doc.setFontSize(10);
  doc.text(`CUIT: ${e.cuitFormateado}`, pageWidth - margin - 5, 45, { align: 'right' });
  doc.text(`Ingresos Brutos: ${e.ingresosBrutos}`, pageWidth - margin - 5, 50, { align: 'right' });
  doc.text(`Inicio de Actividades: ${e.inicioActividades}`, pageWidth - margin - 5, 55, { align: 'right' });

  doc.line(margin, 60, pageWidth - margin, 60);

  // ─── Datos del Receptor ───
  const numDocumento = df.cuit || '';
  const tipoDocumento = df.doc_tipo || (numDocumento.length >= 10 ? 'CUIT' : 'DNI');
  const docLabel = numDocumento ? `${tipoDocumento}: ${numDocumento}` : 'CUIT/DNI: Consumidor Final';

  const fallbackIva = numDocumento.length >= 10 ? 'Responsable Inscripto' : 'Consumidor Final';
  const condIvaReceptor = df.condicion_iva || fallbackIva;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(docLabel, margin + 5, 68);
  doc.text(`Apellido y Nombre / Razón Social: ${venta.cliente}`, margin + 5, 74);
  doc.setFont('helvetica', 'normal');
  doc.text(`Condición frente al IVA: ${condIvaReceptor}`, margin + 5, 80);
  doc.text(`Condición de venta: ${df.forma_pago || 'Contado'}`, margin + 110, 80);

  // Domicilio y Email del receptor (si existen)
  let receptorY = 86;
  if (df.domicilio) {
    doc.text(`Domicilio: ${df.domicilio}`, margin + 5, receptorY);
    receptorY += 5;
  }
  if (df.email) {
    doc.text(`Email: ${df.email}`, margin + 5, receptorY);
    receptorY += 5;
  }

  // Período de servicio (si aplica)
  if ((df.concepto === 2 || df.concepto === 3) && df.periodo_desde) {
    receptorY += 5;
  }
  
  // Comprobante Asociado (NC/ND)
  if (df.cbte_asoc && df.cbte_asoc.nro) {
    const asoc = df.cbte_asoc;
    const asocLabel = CBTE_LABELS[asoc.tipo]?.name || `Tipo ${asoc.tipo}`;
    const asocNro = `${String(asoc.pto_vta || 0).padStart(4, '0')}-${String(asoc.nro).padStart(8, '0')}`;
    const asocFecha = asoc.fecha ? new Date(asoc.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '';
    
    doc.setFont('helvetica', 'bold');
    doc.text(`Comprobante Asociado: ${asocLabel} ${asocNro}${asocFecha ? ` del ${asocFecha}` : ''}`, margin + 5, receptorY);
    receptorY += 5;
  }

  const lineAfterReceptor = receptorY + 2;
  doc.line(margin, lineAfterReceptor, pageWidth - margin, lineAfterReceptor);

  // ─── Detalle de Items ───
  const tableHeaderY = lineAfterReceptor + 5;
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, tableHeaderY, pageWidth - (margin * 2), 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Descripción', margin + 5, tableHeaderY + 5);
  doc.text('Cant.', pageWidth - 80, tableHeaderY + 5);
  doc.text('Precio Unit.', pageWidth - 55, tableHeaderY + 5);
  doc.text('Subtotal', pageWidth - 15, tableHeaderY + 5, { align: 'right' });

  const cantidad = df.cantidad || 1;
  const unidadLabel = UNIDAD_LABELS[df.unidad_medida] || 'unidades';
  const precioUnit = Number(venta.monto) / cantidad;

  doc.setFont('helvetica', 'normal');
  const descText = df.descripcion || 'Productos varios';
  const descLines = doc.splitTextToSize(descText, pageWidth - margin - 90);
  doc.text(descLines, margin + 5, tableHeaderY + 15);
  doc.text(`${cantidad} ${unidadLabel}`, pageWidth - 80, tableHeaderY + 15);
  doc.text(precioUnit.toFixed(2), pageWidth - 55, tableHeaderY + 15);
  doc.text(Number(venta.monto).toFixed(2), pageWidth - 15, tableHeaderY + 15, { align: 'right' });

  // ─── Pie de Factura ───
  const totalY = 240;
  doc.line(margin, totalY - 5, pageWidth - margin, totalY - 5);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL: ', pageWidth - 60, totalY + 5);
  doc.text(`$ ${Number(venta.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, pageWidth - 15, totalY + 5, { align: 'right' });

  // ─── QR de AFIP ───
  try {
    const cleanCuit = (val) => String(val || '').replace(/\D/g, '');
    const numDoc = cleanCuit(df.cuit);
    
    let tipoDocRec = 99; // Consumidor Final
    if (numDoc.length >= 10) {
      tipoDocRec = 80; // CUIT (asumimos CUIT si es largo)
    } else if (numDoc.length >= 7) {
      tipoDocRec = 96; // DNI
    }

    const nroCompPto = (venta.nro_comprobante || '0-0').split('-');
    
    const qrData = {
      ver: 1,
      fecha: df.fecha_emision || (venta.fecha ? venta.fecha.split('T')[0] : new Date().toISOString().split('T')[0]),
      cuit: Number(cleanCuit(e.cuit)),
      ptoVta: Number(nroCompPto[0]),
      tipoCmp: Number(tipoCbte),
      nroCmp: Number(nroCompPto[1]),
      importe: parseFloat(Number(venta.monto).toFixed(2)),
      moneda: "PES",
      ctz: 1,
      tipoDocRec: tipoDocRec,
      nroDocRec: tipoDocRec === 99 ? 0 : Number(numDoc),
      tipoCodAut: "E",
      codAut: Number(venta.cae)
    };

    const qrJsonStr = JSON.stringify(qrData);
    // Base64 robusto para UTF-8 (requerido para el parámetro p de AFIP/ARCA)
    const qrBase64 = btoa(encodeURIComponent(qrJsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1)));
    const qrUrl = `https://www.arca.gob.ar/fe/qr/?p=${qrBase64}`;
    
    const qrImage = await QRCode.toDataURL(qrUrl);
    doc.addImage(qrImage, 'PNG', margin + 5, pageHeight - 45, 35, 35);
  } catch (err) {
    console.error('Error generando QR:', err);
  }

  // ─── CAE y Vencimiento ───
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`CAE: ${venta.cae || '—'}`, pageWidth - margin - 5, pageHeight - 25, { align: 'right' });
  
  const fVtoCae = venta.vto_cae ? new Date(venta.vto_cae).toLocaleDateString('es-AR') : '—';
  doc.text(`Fecha de Vencimiento de CAE: ${fVtoCae}`, pageWidth - margin - 5, pageHeight - 18, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Comprobante emitido a través de Sistema de Facturación — Command Soluciones', pageWidth / 2, pageHeight - 5, { align: 'center' });

  // ─── Descarga ───
  const fileName = `${cbteInfo.name}_${venta.nro_comprobante || 'sin-numero'}.pdf`;
  doc.save(fileName);
}
