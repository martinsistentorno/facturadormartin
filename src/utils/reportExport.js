import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ══════════════════════════════════════════════
//  EXPORT REPORT TO PDF  (visual capture)
// ══════════════════════════════════════════════
export async function exportReportToPDF(containerEl, title = 'Reporte CMD') {
  if (!containerEl) return;

  const canvas = await html2canvas(containerEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#FFFFFF',
    logging: false,
    windowWidth: containerEl.scrollWidth,
    windowHeight: containerEl.scrollHeight,
  });

  const imgW = canvas.width;
  const imgH = canvas.height;

  // A4 portrait: 210mm x 297mm
  const pdfW = 210;
  const margin = 10;
  const contentW = pdfW - margin * 2;
  const contentH = (imgH * contentW) / imgW;

  const pdf = new jsPDF({
    orientation: contentH > 280 ? 'portrait' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // If content is taller than one page, split across pages
  const pageH = 297 - margin * 2;
  let yOffset = 0;
  let pageNum = 0;

  while (yOffset < contentH) {
    if (pageNum > 0) pdf.addPage();
    
    // Calculate source crop
    const srcY = (yOffset / contentH) * imgH;
    const srcH = Math.min((pageH / contentH) * imgH, imgH - srcY);
    const drawH = Math.min(pageH, contentH - yOffset);

    // Create cropped canvas for this page
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = imgW;
    pageCanvas.height = srcH;
    const ctx = pageCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, srcY, imgW, srcH, 0, 0, imgW, srcH);

    const pageImgData = pageCanvas.toDataURL('image/png');
    pdf.addImage(pageImgData, 'PNG', margin, margin, contentW, drawH);

    // Footer
    pdf.setFontSize(7);
    pdf.setTextColor(150);
    pdf.text(`CMD Soluciones — ${title} — Página ${pageNum + 1}`, margin, 293);
    pdf.text(new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }), pdfW - margin, 293, { align: 'right' });

    yOffset += pageH;
    pageNum++;
  }

  const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_');
  pdf.save(`${safeName}_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ══════════════════════════════════════════════
//  EXPORT FISCAL REPORT TO EXCEL
// ══════════════════════════════════════════════
export function exportFiscalReportToExcel(report) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen fiscal
  const summary = [
    ['REPORTE DE SALUD FISCAL — CMD Soluciones'],
    ['Generado', new Date().toLocaleDateString('es-AR')],
    [],
    ['POSICIÓN FISCAL'],
    ['Categoría', report.category],
    ['Tope anual', report.limit],
    ['Facturado anual', report.annualBilled],
    ['% utilizado', `${report.pctUsed}%`],
    ['Margen restante', report.remaining],
    ['Promedio mensual', report.avgMonthly],
    ['Proyección anual', report.projectedAnnual],
    ['¿Excederá?', report.willExceed ? 'SÍ' : 'NO'],
    ['Presupuesto seguro/mes', report.safeMonthlyBudget],
    ['Meses restantes', report.monthsRemaining],
    [],
    ['NOTAS DE CRÉDITO'],
    ['NC emitidas', report.creditNotesCount],
    ['Facturas emitidas', report.invoicesCount],
    ['Ratio NC/Fact', `${report.cnRatio}%`],
    ['Monto NC total', report.cnTotal],
    ['Monto facturas total', report.invTotal],
    [],
    ['TASA DE ERROR'],
    ['Errores', report.errorsCount],
    ['Total activas', report.totalActive],
    ['Tasa de error', `${report.errorRate}%`],
    [],
    ['TABLA ACTUAL'],
    ['Registros', report.tableTotal],
    ['Facturadas', report.tableFacturadas],
    ['Monto facturado', report.tableBilledTotal],
    ['Pendientes', report.tablePendientes],
    ['Monto pendiente', report.tablePendingTotal],
    ['Errores', report.tableErrors],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen Fiscal');

  // Sheet 2: Estacionalidad
  if (report.monthlyValues.length > 0) {
    const seasonData = [['Mes', 'Facturado'], ...report.monthlyValues.map(m => [m.month, m.value])];
    const ws2 = XLSX.utils.aoa_to_sheet(seasonData);
    ws2['!cols'] = [{ wch: 10 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Estacionalidad');
  }

  // Sheet 3: Clientes
  if (report.clientRanking.length > 0) {
    const clientData = [
      ['Cliente', 'Monto Total', 'Operaciones', '% del Total'],
      ...report.clientRanking.map(c => [c.name, c.total, c.count, c.pct ? `${c.pct}%` : '—'])
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(clientData);
    ws3['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Clientes');
  }

  XLSX.writeFile(wb, `reporte_fiscal_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ══════════════════════════════════════════════
//  EXPORT PERFORMANCE REPORT TO EXCEL
// ══════════════════════════════════════════════
export function exportPerformanceReportToExcel(report) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen
  const summary = [
    ['REPORTE DE RENDIMIENTO — CMD Soluciones'],
    ['Generado', new Date().toLocaleDateString('es-AR')],
    ['Período', `${report.startDate} → ${report.endDate}`],
    ['Duración', `${report.durationDays} días`],
    ['Cliente', report.selectedClient === 'all' ? 'Todos' : report.selectedClient],
    [],
    ['RESUMEN DEL PERÍODO'],
    ['Total facturado', report.totalBilled],
    ['Operaciones', report.totalOps],
    ['Facturadas', report.billed],
    ['Pendientes', report.pending],
    ['Tasa de conversión', `${report.conversionRate}%`],
    ['Promedio diario (monto)', report.dailyAvg],
    ['Promedio diario (ops)', report.dailyOpsAvg],
    [],
    ['TENDENCIA'],
    ['Tendencia monto', report.montoTrendLabel],
    ['Pendiente regresión', report.montoTrend.slope],
    ['R²', report.montoTrend.r2],
    ['Tendencia operaciones', report.opsTrendLabel],
    [],
    ['VOLATILIDAD'],
    ['Coef. variación monto', `${report.montoCV}%`],
    [],
    ['TICKET'],
    ['Promedio', report.avgTicket],
    ['Mediana', report.medianTicket],
    ['Mínimo', report.minTicket],
    ['Máximo', report.maxTicket],
    ['CV Ticket', `${report.ticketCV}%`],
    [],
    ['PROYECCIÓN'],
    ['Próximo período estimado', report.projectedMonto],
  ];

  if (report.compareEnabled && report.growth) {
    summary.push(
      [],
      ['COMPARACIÓN'],
      ['Δ Monto', `${report.growth.montoChange}%`],
      ['Δ Operaciones', `${report.growth.opsChange}%`],
      ['Δ Facturadas', `${report.growth.factChange}%`],
      ['Monto anterior', report.compInsights.prevMonto],
      ['Ops anteriores', report.compInsights.prevOps],
    );
  }

  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1['!cols'] = [{ wch: 28 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  // Sheet 2: Top clientes
  if (report.top5.length > 0) {
    const clientData = [
      ['Cliente', 'Monto', 'Operaciones', '%'],
      ...report.clientRanking.map(c => [c.name, c.total, c.count, `${c.pct}%`])
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(clientData);
    ws2['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Clientes');
  }

  // Sheet 3: Distribución por día
  const dayData = [
    ['Día', 'Monto facturado'],
    ...report.dayDistribution.map(d => [d.day, d.total])
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(dayData);
  ws3['!cols'] = [{ wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Días de semana');

  XLSX.writeFile(wb, `reporte_rendimiento_${new Date().toISOString().split('T')[0]}.xlsx`);
}
