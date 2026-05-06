import { useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import { Sparkles, ShieldCheck, TrendingUp, TrendingDown, Target, Zap, Users, AlertTriangle, FileText, ArrowUpRight, ArrowDownRight, Minus, BarChart3, Calendar, Download, FileDown, Loader2 } from 'lucide-react';
import { generateFiscalReport, generatePerformanceReport } from '../utils/reportEngine';
import { exportReportToPDF, exportFiscalReportToExcel, exportPerformanceReportToExcel } from '../utils/reportExport';

function Metric({ label, value, sub, color = 'text-text-primary' }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">{label}</span>
      <span className={`text-lg font-black tracking-tight ${color}`}>{value}</span>
      {sub && <span className="text-[10px] text-text-muted mt-0.5">{sub}</span>}
    </div>
  );
}

function Section({ icon: Icon, title, color, children }) {
  return (
    <div className="p-5 rounded-2xl border border-border bg-surface-alt/30">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg bg-white shadow-sm ${color}`}><Icon size={18} /></div>
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-text-primary">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function Badge({ text, variant = 'green' }) {
  const colors = {
    green: 'bg-[#2D8F5E]/10 text-[#2D8F5E] border-[#2D8F5E]/20',
    yellow: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
    red: 'bg-[#C0443C]/10 text-[#C0443C] border-[#C0443C]/20',
    blue: 'bg-[#3460A8]/10 text-[#3460A8] border-[#3460A8]/20',
    purple: 'bg-[#7C4DFF]/10 text-[#7C4DFF] border-[#7C4DFF]/20',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${colors[variant]}`}>{text}</span>;
}

// ═══════════════════════════════════════
//  FISCAL REPORT VIEW
// ═══════════════════════════════════════
function FiscalReportView({ data, contentRef }) {
  const r = useMemo(() => generateFiscalReport(data), [data]);

  // Expose report data for Excel export
  if (contentRef) contentRef.current = { reportData: r, type: 'fiscal' };

  const statusColor = r.pctUsed >= 90 ? 'red' : r.pctUsed >= 70 ? 'yellow' : 'green';
  const statusLabel = r.pctUsed >= 90 ? 'Zona crítica' : r.pctUsed >= 70 ? 'Zona de precaución' : 'Zona segura';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple/10 to-blue/10 p-6 rounded-2xl border border-purple/10">
        <div className="flex items-center gap-2 text-purple mb-2">
          <Sparkles size={14} />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Resumen contable</span>
        </div>
        <h2 className="text-xl font-black text-text-primary uppercase tracking-tight">
          Categoría {r.category} — {r.fmt(r.limit)} de tope anual
        </h2>
        <div className="flex items-center gap-3 mt-3">
          <Badge text={statusLabel} variant={statusColor} />
          <span className="text-xs text-text-muted">{r.pctUsed}% utilizado</span>
        </div>
      </div>

      {/* Fiscal Position */}
      <Section icon={ShieldCheck} title="Posición fiscal actual" color="text-[#2D8F5E]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Metric label="Facturado anual" value={r.fmt(r.annualBilled)} color="text-text-primary" />
          <Metric label="Margen restante" value={r.fmt(r.remaining)} color={statusColor === 'red' ? 'text-[#C0443C]' : 'text-[#2D8F5E]'} />
          <Metric label="Promedio mensual" value={r.fmt(r.avgMonthly)} sub={`${r.monthlyValues.length} meses con datos`} />
          <Metric label="Presupuesto seguro/mes" value={r.fmt(r.safeMonthlyBudget)} sub={`Para los ${r.monthsRemaining} meses restantes`} />
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          {r.willExceed
            ? `⚠️ A ritmo actual, tu proyección anual es de ${r.fmt(r.projectedAnnual)}, lo que supera el límite por ${r.fmt(r.excessAmount)}. Deberías reducir tu facturación mensual a ${r.fmt(r.safeMonthlyBudget)} para mantenerte dentro de la categoría.`
            : r.monthsUntilLimit === Infinity
              ? `Estás operando cómodamente dentro de tu categoría. Con el ritmo actual no hay riesgo de exceder el límite.`
              : `A ritmo actual, alcanzarías el límite en aprox. ${r.monthsUntilLimit} meses. Tu proyección anual es ${r.fmt(r.projectedAnnual)}, dentro del margen.`
          }
        </p>
      </Section>

      {/* Seasonality */}
      {r.monthlyValues.length >= 2 && (
        <Section icon={Calendar} title="Estacionalidad mensual" color="text-[#3460A8]">
          <div className="flex items-end gap-1 h-24 mb-3">
            {r.monthlyValues.map((m, i) => {
              const maxVal = Math.max(...r.monthlyValues.map(x => x.value), 1);
              const h = Math.max((m.value / maxVal) * 100, 4);
              const isBest = r.bestMonth && m.month === r.bestMonth.month;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-md transition-all ${isBest ? 'bg-[#3460A8]' : 'bg-[#3460A8]/30'}`}
                    style={{ height: `${h}%` }}
                    title={`${m.month}: ${r.fmt(m.value)}`}
                  />
                  <span className="text-[8px] font-bold text-text-muted">{m.month}</span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {r.bestMonth && <Metric label="Mejor mes" value={r.bestMonth.month} sub={r.fmt(r.bestMonth.value)} color="text-[#2D8F5E]" />}
            {r.worstMonth && <Metric label="Mes más bajo" value={r.worstMonth.month} sub={r.fmt(r.worstMonth.value)} color="text-[#C0443C]" />}
            <Metric label="Volatilidad" value={`${r.coeffVariation}%`} sub={r.coeffVariation > 40 ? 'Alta variación' : r.coeffVariation > 20 ? 'Variación moderada' : 'Estable'} />
          </div>
        </Section>
      )}

      {/* Client Concentration */}
      <Section icon={Users} title={`Concentración de clientes (${r.totalClients} clientes)`} color="text-[#7C4DFF]">
        <div className="space-y-2 mb-3">
          {r.top3.map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-[10px] font-black text-text-muted w-5 shrink-0">#{i + 1}</span>
              <div className="flex-1 bg-surface-alt rounded-md h-6 relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-[#7C4DFF]/20 rounded-md" style={{ width: `${Math.min(c.pct, 100)}%` }} />
                <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-text-primary truncate">{c.name}</span>
              </div>
              <span className="text-xs font-bold text-text-primary w-20 text-right">{r.fmt(c.total)}</span>
              <span className="text-[10px] text-text-muted w-12 text-right">{c.pct}%</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted">Riesgo de dependencia:</span>
          <Badge text={r.concentrationRisk} variant={r.concentrationRisk === 'alto' ? 'red' : r.concentrationRisk === 'moderado' ? 'yellow' : 'green'} />
        </div>
      </Section>

      {/* Credit notes + errors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section icon={FileText} title="Notas de crédito" color="text-[#C0443C]">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Emitidas" value={r.creditNotesCount} sub={`vs ${r.invoicesCount} facturas`} />
            <Metric label="Ratio NC/Fact" value={`${r.cnRatio}%`} sub={r.cnRatio > 15 ? 'Ratio elevado' : 'Normal'} color={r.cnRatio > 15 ? 'text-[#C0443C]' : 'text-text-primary'} />
          </div>
          <p className="text-[10px] text-text-muted mt-2">
            Neto: {r.fmt(r.invTotal - r.cnTotal)} ({r.fmt(r.cnTotal)} devuelto)
          </p>
        </Section>

        <Section icon={AlertTriangle} title="Tasa de error" color={r.errorRate > 5 ? 'text-[#C0443C]' : 'text-[#2D8F5E]'}>
          <Metric label="Errores / Total" value={`${r.errorsCount} / ${r.totalActive}`} sub={`${r.errorRate}% de error`} color={r.errorRate > 5 ? 'text-[#C0443C]' : 'text-text-primary'} />
          <p className="text-[10px] text-text-muted mt-2">
            {r.errorRate > 5 ? 'Se recomienda revisar los comprobantes rechazados por AFIP y corregir datos antes de reintentar.' : 'La tasa de error está dentro de un rango aceptable.'}
          </p>
        </Section>
      </div>

      {/* Selection impact */}
      {r.selCount > 0 && (
        <Section icon={Target} title={`Impacto de selección (${r.selCount} ventas)`} color="text-[#FFE100]">
          <Metric label="Monto seleccionado" value={r.fmt(r.selTotal)} sub={`Representa ${r.selPctOfLimit}% del tope anual`} />
        </Section>
      )}

      {/* Table context */}
      <div className="p-4 rounded-2xl bg-surface-alt/50 border border-border/40">
        <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Contexto de la tabla actual</span>
        <p className="text-xs mt-1 text-text-secondary leading-relaxed">
          Mostrando {r.tableTotal} registros: {r.tableFacturadas} facturadas ({r.fmt(r.tableBilledTotal)}), {r.tablePendientes} pendientes ({r.fmt(r.tablePendingTotal)}), {r.tableErrors} con error. Este reporte se recalcula automáticamente cada vez que aplicás filtros.
        </p>
      </div>

      <p className="text-[9px] text-center text-text-muted italic">* Reporte generado algorítmicamente a partir de los datos filtrados en tu tabla. No constituye asesoramiento contable.</p>
    </div>
  );
}

// ═══════════════════════════════════════
//  PERFORMANCE REPORT VIEW
// ═══════════════════════════════════════
function PerformanceReportView({ data, contentRef }) {
  const r = useMemo(() => generatePerformanceReport(data), [data]);

  // Expose report data for Excel export
  if (contentRef) contentRef.current = { reportData: r, type: 'performance' };

  const trendIcon = r.montoTrendLabel === 'ascendente' ? ArrowUpRight : r.montoTrendLabel === 'descendente' ? ArrowDownRight : Minus;
  const trendColor = r.montoTrendLabel === 'ascendente' ? 'text-[#2D8F5E]' : r.montoTrendLabel === 'descendente' ? 'text-[#C0443C]' : 'text-[#3460A8]';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue/10 to-purple/10 p-6 rounded-2xl border border-blue/10">
        <div className="flex items-center gap-2 text-blue mb-2">
          <BarChart3 size={14} />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Resumen estadísticas</span>
        </div>
        <h2 className="text-xl font-black text-text-primary uppercase tracking-tight">
          {r.durationDays} días analizados {r.selectedClient !== 'all' ? `— ${r.selectedClient}` : ''}
        </h2>
        <p className="text-xs text-text-muted mt-1">{r.startDate} → {r.endDate}</p>
      </div>

      {/* Overview */}
      <Section icon={BarChart3} title="Resumen del período" color="text-[#3460A8]">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
          <Metric label="Total facturado" value={r.fmt(r.totalBilled)} />
          <Metric label="Operaciones" value={r.totalOps} sub={`${r.dailyOpsAvg.toFixed(1)} ops/día`} />
          <Metric label="Pendientes" value={r.pending} sub="Sin facturar" color={r.pending > 0 ? 'text-[#F59E0B]' : 'text-[#2D8F5E]'} />
        </div>
        {r.pending > 0 && (
          <p className="text-[10px] text-text-muted">
            Monto pendiente de facturar estimado: {r.fmt(r.avgTicket * r.pending)} (basado en ticket promedio)
          </p>
        )}
      </Section>

      {/* Comparison */}
      {r.compareEnabled && r.growth && (
        <Section icon={r.growth.montoChange >= 0 ? TrendingUp : TrendingDown} title="Comparación de períodos" color={r.growth.montoChange >= 0 ? 'text-[#2D8F5E]' : 'text-[#C0443C]'}>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Monto</span>
              <div className={`text-lg font-black ${r.growth.montoChange >= 0 ? 'text-[#2D8F5E]' : 'text-[#C0443C]'}`}>
                {r.growth.montoChange >= 0 ? '+' : ''}{r.growth.montoChange}%
              </div>
              <span className="text-[10px] text-text-muted">Antes: {r.fmt(r.compInsights.prevMonto)}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Operaciones</span>
              <div className={`text-lg font-black ${r.growth.opsChange >= 0 ? 'text-[#2D8F5E]' : 'text-[#C0443C]'}`}>
                {r.growth.opsChange >= 0 ? '+' : ''}{r.growth.opsChange}%
              </div>
              <span className="text-[10px] text-text-muted">Antes: {r.compInsights.prevOps}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Facturadas</span>
              <div className={`text-lg font-black ${r.growth.factChange >= 0 ? 'text-[#2D8F5E]' : 'text-[#C0443C]'}`}>
                {r.growth.factChange >= 0 ? '+' : ''}{r.growth.factChange}%
              </div>
              <span className="text-[10px] text-text-muted">Antes: {r.compInsights.prevFact}</span>
            </div>
          </div>
        </Section>
      )}

      {/* Trend + Volatility */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section icon={trendIcon} title="Tendencia (regresión lineal)" color={trendColor}>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Monto" value={r.montoTrendLabel} color={trendColor} />
            <Metric label="Operaciones" value={r.opsTrendLabel} />
          </div>
          <p className="text-[10px] text-text-muted mt-2">
            {r.montoTrendLabel === 'ascendente'
              ? `El monto facturado crece a un ritmo de ${r.fmt(Math.abs(r.montoTrend.slope))} por período. La tendencia es consistente (R²=${r.montoTrend.r2.toFixed(2)}).`
              : r.montoTrendLabel === 'descendente'
                ? `La facturación muestra una caída de ${r.fmt(Math.abs(r.montoTrend.slope))} por período. Evaluá si es estacional o estructural.`
                : `La facturación se mantiene estable sin variaciones significativas entre períodos.`
            }
          </p>
        </Section>

        <Section icon={Zap} title="Volatilidad" color={r.montoCV > 50 ? 'text-[#C0443C]' : 'text-[#3460A8]'}>
          <Metric label="Coeficiente de variación" value={`${r.montoCV}%`} sub={r.montoCV > 50 ? 'Alta volatilidad' : r.montoCV > 25 ? 'Volatilidad moderada' : 'Baja volatilidad'} color={r.montoCV > 50 ? 'text-[#C0443C]' : 'text-text-primary'} />
          <p className="text-[10px] text-text-muted mt-2">
            {r.montoCV > 50
              ? 'Tu facturación varía mucho entre períodos. Esto puede generar tensión en el flujo de caja.'
              : 'Tu ingreso es predecible, lo que facilita la planificación financiera.'
            }
          </p>
        </Section>
      </div>

      {/* Best/Worst + Day of week */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section icon={Target} title="Períodos destacados" color="text-[#FFE100]">
          {r.bestPeriod && <Metric label="Mejor período" value={r.bestPeriod.date} sub={`${r.fmt(r.bestPeriod.monto)} facturado, ${r.bestPeriod.total} ops`} color="text-[#2D8F5E]" />}
          {r.worstPeriod && <Metric label="Período más bajo" value={r.worstPeriod.date} sub={`${r.fmt(r.worstPeriod.monto)} facturado`} color="text-[#C0443C]" />}
        </Section>

        <Section icon={Calendar} title="Distribución por día" color="text-[#3460A8]">
          <div className="flex items-end gap-1 h-16 mb-2">
            {r.dayDistribution.map((d, i) => {
              const maxVal = Math.max(...r.dayDistribution.map(x => x.total), 1);
              const h = Math.max((d.total / maxVal) * 100, 4);
              const isBest = d.day === r.bestDayName;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className={`w-full rounded-t-sm ${isBest ? 'bg-[#3460A8]' : 'bg-[#3460A8]/25'}`} style={{ height: `${h}%` }} />
                  <span className="text-[7px] font-bold text-text-muted">{d.day}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-text-muted">Mejor día: <strong>{r.bestDayName}</strong></p>
        </Section>
      </div>

      {/* Ticket analysis */}
      <Section icon={FileText} title={`Análisis de ticket (${r.ticketCount} facturas)`} color="text-[#7C4DFF]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
          <Metric label="Promedio" value={r.fmt(r.avgTicket)} />
          <Metric label="Mediana" value={r.fmt(r.medianTicket)} />
          <Metric label="Mínimo" value={r.fmt(r.minTicket)} />
          <Metric label="Máximo" value={r.fmt(r.maxTicket)} />
        </div>
        <p className="text-[10px] text-text-muted">
          {r.ticketCV > 60
            ? `Dispersión alta (CV ${r.ticketCV}%): tus facturas varían mucho en monto. Tenés una mezcla de tickets chicos y grandes.`
            : `Dispersión ${r.ticketCV > 30 ? 'moderada' : 'baja'} (CV ${r.ticketCV}%): tus facturas son relativamente uniformes en valor.`
          }
        </p>
      </Section>

      {/* Top clients */}
      {r.top5.length > 0 && (
        <Section icon={Users} title={`Top clientes del período (${r.totalClients} clientes)`} color="text-[#7C4DFF]">
          <div className="space-y-1.5">
            {r.top5.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[10px] font-black text-text-muted w-5">#{i + 1}</span>
                <div className="flex-1 bg-surface-alt rounded-md h-5 relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-[#7C4DFF]/20 rounded-md" style={{ width: `${Math.min(c.pct, 100)}%` }} />
                  <span className="absolute inset-0 flex items-center px-2 text-[9px] font-bold text-text-primary truncate">{c.name}</span>
                </div>
                <span className="text-[10px] font-bold w-16 text-right">{r.fmt(c.total)}</span>
                <span className="text-[9px] text-text-muted w-10 text-right">{c.pct}%</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Projection */}
      <div className="p-4 rounded-2xl bg-surface-alt/50 border border-border/40">
        <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Proyección próximo período</span>
        <p className="text-xs mt-1 text-text-secondary leading-relaxed">
          Basado en la tendencia {r.montoTrendLabel} y el promedio diario de {r.fmt(r.dailyAvg)}, se proyecta un facturado de <strong className="text-text-primary">{r.fmt(r.projectedMonto)}</strong> para los próximos {r.durationDays} días.
          {r.selectedClient !== 'all' ? ` (filtrado por cliente: ${r.selectedClient})` : ''}
        </p>
      </div>

      <p className="text-[9px] text-center text-text-muted italic">* Reporte generado algorítmicamente a partir de los datos filtrados. No constituye asesoramiento contable.</p>
    </div>
  );
}

// ═══════════════════════════════════════
//  MAIN MODAL
// ═══════════════════════════════════════
export default function AIReportModal({ isOpen, onClose, type, data }) {
  const reportRef = useRef(null);
  const dataRef = useRef({ reportData: null, type: null });
  const [exporting, setExporting] = useState(false);

  if (!data) return null;

  const handlePDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      // Small delay to ensure all charts (Recharts) are stable and fully rendered
      await new Promise(r => setTimeout(r, 100));
      const title = type === 'fiscal' ? 'Resumen_Contable' : 'Resumen_Estadisticas';
      await exportReportToPDF(reportRef.current, title);
    } finally {
      setExporting(false);
    }
  };

  const handleExcel = () => {
    const { reportData, type: rType } = dataRef.current;
    if (!reportData) return;
    if (rType === 'fiscal') {
      exportFiscalReportToExcel(reportData);
    } else {
      exportPerformanceReportToExcel(reportData);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resumen — Motor Analítico">
      {/* Export toolbar */}
      <div className="flex items-center justify-end gap-2 mb-4 -mt-1">
        <button
          onClick={handleExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-white text-[10px] md:text-xs font-semibold text-text-muted hover:bg-surface-alt hover:text-text-primary shadow-sm transition-all cursor-pointer"
        >
          <FileDown size={13} />
          Excel
        </button>
        <button
          onClick={handlePDF}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-white text-[10px] md:text-xs font-semibold text-text-muted hover:bg-surface-alt hover:text-text-primary shadow-sm transition-all cursor-pointer disabled:opacity-50"
        >
          {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          {exporting ? 'Exportando...' : 'PDF'}
        </button>
      </div>

      <div ref={reportRef}>
        {type === 'fiscal' ? (
          <FiscalReportView data={data} contentRef={dataRef} />
        ) : (
          <PerformanceReportView data={data} contentRef={dataRef} />
        )}
      </div>
    </Modal>
  );
}
