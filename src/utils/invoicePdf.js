import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { EMISOR } from '../config/emisor';

/**
 * Genera y descarga un PDF de factura con el formato reglamentario de AFIP.
 * @param {Object} venta - Objeto de la venta con datos fiscales y de facturación.
 */
export async function generateInvoicePdf(venta) {
  const doc = new jsPDF();
  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ─── Rectángulo Principal ───
  doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2));

  // ─── Línea Divisoria Cabecera ───
  doc.line(pageWidth / 2, margin, pageWidth / 2, 55);

  // ─── El Cuadradito de la "C" ───
  doc.setFillColor(255, 255, 255);
  doc.rect((pageWidth / 2) - 8, margin - 1, 16, 14, 'FD');
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('C', pageWidth / 2, margin + 10, { align: 'center' });
  doc.setFontSize(8);
  doc.text('COD. 011', pageWidth / 2, margin + 13, { align: 'center' });

  // ─── Datos Emisor (Izquierda) ───
  const maxLeftWidth = (pageWidth / 2) - margin - 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const razonSocialLines = doc.splitTextToSize(EMISOR.razonSocial, maxLeftWidth);
  doc.text(razonSocialLines, margin + 5, 25);
  
  const startYSub = 25 + (razonSocialLines.length * 6);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const domicilioLines = doc.splitTextToSize(`Domicilio: ${EMISOR.domicilio}`, maxLeftWidth);
  doc.text(domicilioLines, margin + 5, startYSub);
  
  doc.text(`Condición IVA: ${EMISOR.condicionIva}`, margin + 5, startYSub + (domicilioLines.length * 5) + 2);

  // ─── Datos Comprobante (Derecha) ───
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA', pageWidth - margin - 5, 22, { align: 'right' });
  
  doc.setFontSize(11);
  const nroCompArr = (venta.nro_comprobante || '0000-00000000').split('-');
  doc.text(`Punto de Venta: ${nroCompArr[0]}   Comp. Nro: ${nroCompArr[1]}`, pageWidth - margin - 5, 30, { align: 'right' });
  
  const fechaEmision = venta.fecha ? new Date(venta.fecha).toLocaleDateString('es-AR') : '—';
  doc.text(`Fecha de Emisión: ${fechaEmision}`, pageWidth - margin - 5, 37, { align: 'right' });
  
  doc.setFontSize(10);
  doc.text(`CUIT: ${EMISOR.cuitFormateado}`, pageWidth - margin - 5, 45, { align: 'right' });
  doc.text(`Ingresos Brutos: ${EMISOR.ingresosBrutos}`, pageWidth - margin - 5, 50, { align: 'right' });
  doc.text(`Inicio de Actividades: ${EMISOR.inicioActividades}`, pageWidth - margin - 5, 55, { align: 'right' });

  doc.line(margin, 60, pageWidth - margin, 60);

  // ─── Datos del Receptor ───
  const cuitCliente = venta.datos_fiscales?.cuit || 'Consumidor Final';
  const condIvaReceptor = cuitCliente.includes('-') || cuitCliente.length > 8 ? 'IVA Responsable Inscripto' : 'Consumidor Final';
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`CUIL/CUIT: ${cuitCliente}`, margin + 5, 70);
  doc.text(`Apellido y Nombre / Razón Social: ${venta.cliente}`, margin + 5, 77);
  doc.setFont('helvetica', 'normal');
  doc.text(`Condición frente al IVA: ${condIvaReceptor}`, margin + 5, 84);
  doc.text(`Condición de venta: ${venta.datos_fiscales?.forma_pago || 'Contado'}`, margin + 110, 84);

  doc.line(margin, 90, pageWidth - margin, 90);

  // ─── Detalle de Items ───
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, 95, pageWidth - (margin * 2), 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Descripción', margin + 5, 100);
  doc.text('Cant.', pageWidth - 80, 100);
  doc.text('Precio Unit.', pageWidth - 55, 100);
  doc.text('Subtotal', pageWidth - 15, 100, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Productos varios', margin + 5, 110);
  doc.text('1.00', pageWidth - 80, 110);
  doc.text(Number(venta.monto).toFixed(2), pageWidth - 55, 110);
  doc.text(Number(venta.monto).toFixed(2), pageWidth - 15, 110, { align: 'right' });

  // ─── Pie de Factura ───
  const totalY = 240;
  doc.line(margin, totalY - 5, pageWidth - margin, totalY - 5);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL: ', pageWidth - 60, totalY + 5);
  doc.text(`$ ${Number(venta.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, pageWidth - 15, totalY + 5, { align: 'right' });

  // ─── QR de AFIP ───
  try {
    const qrData = {
      ver: 1,
      fecha: venta.fecha ? venta.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
      cuit: Number(EMISOR.cuit),
      ptoVta: Number(nroCompArr[0]),
      tipoCmp: EMISOR.tipoCbte,
      nroCmp: Number(nroCompArr[1]),
      importe: Number(venta.monto),
      moneda: "PES",
      ctz: 1,
      tipoDocRec: cuitCliente === 'Consumidor Final' ? 99 : 80,
      nroDocRec: cuitCliente === 'Consumidor Final' ? 0 : Number(cuitCliente.replace(/-/g, '')),
      tipoCodAut: "E",
      codAut: Number(venta.cae)
    };

    const qrJsonStr = JSON.stringify(qrData);
    const qrBase64 = btoa(qrJsonStr);
    const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${qrBase64}`;
    
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
  const fileName = `Factura_${venta.nro_comprobante || 'sin-numero'}.pdf`;
  doc.save(fileName);
}
