/**
 * CMD Soluciones — Report Engine v1.0
 * Motor algorítmico de análisis financiero/comercial.
 * Consume datos reales de las tablas filtradas.
 */

// ── Helpers ──────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);
const pct = (n, d) => d === 0 ? 0 : +((n / d) * 100).toFixed(1);
const getAmount = (v) => {
  const isCN = [3, 8, 13, 113].includes(v.datos_fiscales?.tipo_cbte);
  const a = Number(v.monto) || 0;
  return isCN ? -Math.abs(a) : Math.abs(a);
};

// ── Linear regression (least-squares) ────────────────
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  points.forEach(([x, y]) => { sx += x; sy += y; sxy += x * y; sxx += x * x; });
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n, r2: 0 };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const ssRes = points.reduce((s, [x, y]) => s + (y - (slope * x + intercept)) ** 2, 0);
  const ssTot = points.reduce((s, [, y]) => s + (y - sy / n) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

// ── Standard Deviation ───────────────────────────────
function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

// ═══════════════════════════════════════════════════════
// FISCAL REPORT  (Vista Contable)
// ═══════════════════════════════════════════════════════
export function generateFiscalReport({ allVentas, tableVentas, selectedVentas, category, limit }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const monthsElapsed = currentMonth + 1;
  const monthsRemaining = 12 - monthsElapsed;

  // ── 1. Facturación global del año ──
  const allThisYear = allVentas.filter(v => v.status === 'facturado' && new Date(v.fecha).getFullYear() === currentYear);
  const annualBilled = allThisYear.reduce((s, v) => s + getAmount(v), 0);
  const pctUsed = pct(annualBilled, limit);
  const remaining = Math.max(limit - annualBilled, 0);
  const avgMonthly = monthsElapsed > 0 ? annualBilled / monthsElapsed : 0;
  const projectedAnnual = avgMonthly * 12;
  const willExceed = projectedAnnual > limit;
  const excessAmount = willExceed ? projectedAnnual - limit : 0;
  const monthsUntilLimit = avgMonthly > 0 ? Math.floor(remaining / avgMonthly) : Infinity;
  const safeMonthlyBudget = monthsRemaining > 0 ? remaining / monthsRemaining : 0;

  // ── 2. Facturación por mes (del año) ──
  const byMonth = {};
  allThisYear.forEach(v => {
    const m = new Date(v.fecha).getMonth();
    byMonth[m] = (byMonth[m] || 0) + getAmount(v);
  });
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthlyValues = Object.entries(byMonth).map(([m, v]) => ({ month: monthNames[m], value: v, idx: +m })).sort((a, b) => a.idx - b.idx);
  const bestMonth = monthlyValues.length > 0 ? monthlyValues.reduce((a, b) => a.value > b.value ? a : b) : null;
  const worstMonth = monthlyValues.length > 0 ? monthlyValues.reduce((a, b) => a.value < b.value ? a : b) : null;
  const volatility = stdDev(monthlyValues.map(m => m.value));
  const coeffVariation = avgMonthly > 0 ? pct(volatility, avgMonthly) : 0;

  // ── 3. Concentración de clientes (desde la tabla visible) ──
  const source = tableVentas.length > 0 ? tableVentas : allThisYear;
  const clientMap = {};
  source.forEach(v => {
    const name = v.cliente?.trim() || 'Sin nombre';
    if (!clientMap[name]) clientMap[name] = { total: 0, count: 0 };
    clientMap[name].total += getAmount(v);
    clientMap[name].count++;
  });
  const GENERIC_CLIENTS = ['consumidor final', 'cf', 'sin nombre', 'particular', 'cliente genérico', 'cliente generico', 'varios', 'mostrador'];
  const clientRanking = Object.entries(clientMap)
    .map(([name, d]) => ({ name, ...d }))
    .filter(c => !GENERIC_CLIENTS.includes(c.name.toLowerCase().trim()))
    .sort((a, b) => b.total - a.total);
  const totalFromSource = source.reduce((s, v) => s + getAmount(v), 0);
  const top3 = clientRanking.slice(0, 3).map(c => ({
    ...c,
    pct: pct(c.total, totalFromSource),
  }));
  const top1Pct = top3[0]?.pct || 0;
  const concentrationRisk = top1Pct > 50 ? 'alto' : top1Pct > 30 ? 'moderado' : 'bajo';

  // ── 4. Notas de crédito ──
  const creditNotes = source.filter(v => [3, 8, 13, 113].includes(v.datos_fiscales?.tipo_cbte));
  const invoices = source.filter(v => ![3, 8, 13, 113, 2, 7, 12, 112].includes(v.datos_fiscales?.tipo_cbte));
  const cnTotal = creditNotes.reduce((s, v) => s + Math.abs(Number(v.monto) || 0), 0);
  const invTotal = invoices.reduce((s, v) => s + Math.abs(Number(v.monto) || 0), 0);
  const cnRatio = invoices.length > 0 ? pct(creditNotes.length, invoices.length) : 0;

  // ── 5. Error rate ──
  const allActive = allVentas.filter(v => v.status !== 'borrada');
  const errors = allActive.filter(v => v.status === 'error');
  const errorRate = pct(errors.length, allActive.length);

  // ── 6. Impacto de selección ──
  const selBilled = selectedVentas.filter(v => v.status === 'facturado');
  const selTotal = selBilled.reduce((s, v) => s + getAmount(v), 0);
  const selPctOfLimit = pct(selTotal, limit);

  // ── 7. Vista tabla actual ──
  const tableFacturadas = tableVentas.filter(v => v.status === 'facturado');
  const tablePendientes = tableVentas.filter(v => v.status === 'pendiente');
  const tableErrors = tableVentas.filter(v => v.status === 'error');
  const tableBilledTotal = tableFacturadas.reduce((s, v) => s + getAmount(v), 0);
  const tablePendingTotal = tablePendientes.reduce((s, v) => s + getAmount(v), 0);

  return {
    // Fiscal position
    annualBilled, pctUsed, remaining, limit, category,
    avgMonthly, projectedAnnual, willExceed, excessAmount,
    monthsUntilLimit, safeMonthlyBudget, monthsRemaining,
    // Seasonality
    monthlyValues, bestMonth, worstMonth, volatility, coeffVariation,
    // Clients
    clientRanking, top3, concentrationRisk, totalClients: clientRanking.length,
    // Credit notes
    cnTotal, invTotal, cnRatio, creditNotesCount: creditNotes.length, invoicesCount: invoices.length,
    // Errors
    errorRate, errorsCount: errors.length, totalActive: allActive.length,
    // Selection
    selTotal, selPctOfLimit, selCount: selectedVentas.length,
    // Table
    tableTotal: tableVentas.length, tableFacturadas: tableFacturadas.length,
    tablePendientes: tablePendientes.length, tableErrors: tableErrors.length,
    tableBilledTotal, tablePendingTotal,
    // Formatted
    fmt,
  };
}

// ═══════════════════════════════════════════════════════
// PERFORMANCE REPORT  (Vista Estadística)
// ═══════════════════════════════════════════════════════
export function generatePerformanceReport({ filteredSales, chartData, kpi, kpiComp, compareEnabled, selectedClient, startDate, endDate, durationDays }) {

  // ── 1. Overview ──
  const totalOps = kpi.total;
  const totalBilled = kpi.monto;
  const pending = kpi.pendientes;
  const billed = kpi.facturadas;
  const conversionRate = pct(billed, totalOps);

  // ── 2. Comparison ──
  let growth = null;
  let compInsights = null;
  if (compareEnabled && kpiComp) {
    const montoChange = kpiComp.monto > 0 ? pct(kpi.monto - kpiComp.monto, kpiComp.monto) : (kpi.monto > 0 ? 100 : 0);
    const opsChange = kpiComp.total > 0 ? pct(kpi.total - kpiComp.total, kpiComp.total) : (kpi.total > 0 ? 100 : 0);
    const factChange = kpiComp.facturadas > 0 ? pct(kpi.facturadas - kpiComp.facturadas, kpiComp.facturadas) : (kpi.facturadas > 0 ? 100 : 0);
    growth = { montoChange, opsChange, factChange };
    compInsights = {
      prevMonto: kpiComp.monto,
      prevOps: kpiComp.total,
      prevFact: kpiComp.facturadas,
    };
  }

  // ── 3. Trend analysis via linear regression on chartData ──
  const montoPoints = chartData.map((d, i) => [i, d.monto]);
  const opsPoints = chartData.map((d, i) => [i, d.total]);
  const montoTrend = linearRegression(montoPoints);
  const opsTrend = linearRegression(opsPoints);

  const trendLabel = (slope, data) => {
    if (data.length < 3) return 'insuficiente';
    const avg = data.reduce((s, v) => s + v, 0) / data.length;
    const relSlope = avg !== 0 ? (slope / avg) * 100 : 0;
    if (relSlope > 5) return 'ascendente';
    if (relSlope < -5) return 'descendente';
    return 'estable';
  };
  const montoTrendLabel = trendLabel(montoTrend.slope, montoPoints.map(p => p[1]));
  const opsTrendLabel = trendLabel(opsTrend.slope, opsPoints.map(p => p[1]));

  // ── 4. Volatility ──
  const montoValues = chartData.map(d => d.monto);
  const opsValues = chartData.map(d => d.total);
  const montoVolatility = stdDev(montoValues);
  const opsVolatility = stdDev(opsValues);
  const avgMonto = montoValues.reduce((s, v) => s + v, 0) / (montoValues.length || 1);
  const montoCV = avgMonto > 0 ? pct(montoVolatility, avgMonto) : 0;

  // ── 5. Best / worst periods ──
  const bestPeriod = chartData.length > 0 ? chartData.reduce((a, b) => a.monto > b.monto ? a : b) : null;
  const worstPeriod = chartData.length > 0 ? chartData.reduce((a, b) => a.monto < b.monto ? a : b) : null;
  const bestOpsPeriod = chartData.length > 0 ? chartData.reduce((a, b) => a.total > b.total ? a : b) : null;

  // ── 6. Ticket analysis ──
  const facturadasData = filteredSales.filter(v => v.status === 'facturado');
  const tickets = facturadasData.map(v => getAmount(v)).filter(a => a > 0);
  const avgTicket = tickets.length > 0 ? tickets.reduce((s, v) => s + v, 0) / tickets.length : 0;
  const medianTicket = tickets.length > 0 ? (() => {
    const sorted = [...tickets].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  })() : 0;
  const maxTicket = tickets.length > 0 ? Math.max(...tickets) : 0;
  const minTicket = tickets.length > 0 ? Math.min(...tickets) : 0;
  const ticketSpread = maxTicket - minTicket;
  const ticketCV = avgTicket > 0 ? pct(stdDev(tickets), avgTicket) : 0;

  // ── 7. Client analysis (from filteredSales) ──
  const clientMap = {};
  filteredSales.filter(v => v.status !== 'borrada').forEach(v => {
    const name = v.cliente?.trim() || 'Sin nombre';
    if (!clientMap[name]) clientMap[name] = { total: 0, count: 0, billed: 0 };
    clientMap[name].total += getAmount(v);
    clientMap[name].count++;
    if (v.status === 'facturado') clientMap[name].billed += getAmount(v);
  });
  const clientRanking = Object.entries(clientMap)
    .map(([name, d]) => ({ name, ...d, pct: pct(d.total, totalBilled || 1) }))
    .sort((a, b) => b.total - a.total);
  const top5 = clientRanking.slice(0, 5);

  // ── 8. Daily average ──
  const dailyAvg = durationDays > 0 ? totalBilled / durationDays : 0;
  const dailyOpsAvg = durationDays > 0 ? totalOps / durationDays : 0;

  // ── 9. Projection (next period, same duration) ──
  const projectedMonto = montoTrend.slope > 0
    ? totalBilled + (montoTrend.slope * chartData.length)
    : totalBilled * (montoTrendLabel === 'descendente' ? 0.92 : 1.0);

  // ── 10. Day-of-week analysis (if we have individual sales) ──
  const dayMap = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  filteredSales.filter(v => v.status === 'facturado').forEach(v => {
    dayMap[new Date(v.fecha).getDay()] += getAmount(v);
  });
  const bestDay = dayMap.indexOf(Math.max(...dayMap));
  const worstDay = dayMap.indexOf(Math.min(...dayMap.filter((_, i) => dayMap[i] > 0 || true)));

  return {
    // Overview
    totalOps, totalBilled, pending, billed, conversionRate, durationDays,
    selectedClient,
    // Comparison
    growth, compInsights, compareEnabled,
    // Trends
    montoTrendLabel, opsTrendLabel, montoTrend, opsTrend,
    // Volatility
    montoVolatility, montoCV,
    // Periods
    bestPeriod, worstPeriod, bestOpsPeriod, chartBuckets: chartData.length,
    // Tickets
    avgTicket, maxTicket, minTicket, medianTicket, ticketSpread, ticketCV, ticketCount: tickets.length,
    // Clients
    clientRanking, top5, totalClients: clientRanking.length,
    // Daily
    dailyAvg, dailyOpsAvg,
    // Projection
    projectedMonto,
    // Day of week
    bestDayName: dayNames[bestDay], worstDayName: dayNames[worstDay],
    dayDistribution: dayMap.map((v, i) => ({ day: dayNames[i], total: v })),
    // Utils
    fmt,
    startDate, endDate,
  };
}
