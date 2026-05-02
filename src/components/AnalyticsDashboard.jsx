import { useState, useMemo } from 'react'
import { Calendar, TrendingUp, TrendingDown, FileCheck, Clock, FileText, DollarSign, ToggleLeft, ToggleRight } from 'lucide-react'
import AnalyticsChart from './AnalyticsChart'

const PRESETS = [
  { label: '7 días', days: 7 },
  { label: '28 días', days: 28 },
  { label: '3 meses', days: 90 },
  { label: '12 meses', days: 365 },
]

const METRICS = {
  facturadas: { color: '#2D8F5E', bgClass: 'bg-green', textClass: 'text-green', label: 'Facturadas', icon: FileCheck, format: v => v, isMoney: false },
  pendientes: { color: '#FFE100', bgClass: 'bg-yellow', textClass: 'text-[#b8960c]', label: 'Pendientes', icon: Clock, format: v => v, isMoney: false },
  total: { color: '#3460A8', bgClass: 'bg-blue', textClass: 'text-blue', label: 'Total Ops', icon: FileText, format: v => v, isMoney: false },
  monto: { color: '#7C4DFF', bgClass: 'bg-purple', textClass: 'text-purple', label: 'Monto Fact.', icon: DollarSign, format: v => `$${Number(v||0).toLocaleString('es-AR')}`, isMoney: true },
}

function toDateStr(d) { return d.toISOString().split('T')[0] }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

function groupByInterval(ventas, startDate, endDate, days) {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T23:59:59')
  const filtered = ventas.filter(v => {
    if (v.status === 'borrada') return false
    const d = new Date(v.fecha)
    return d >= start && d <= end
  })
  // Determine grouping
  const totalDays = Math.round((end - start) / 86400000)
  let mode = 'day'
  if (totalDays > 90) mode = 'month'
  else if (totalDays > 14) mode = 'week'

  const buckets = new Map()
  // Create empty buckets
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = mode === 'month'
      ? `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`
      : mode === 'week'
        ? toDateStr(getWeekStart(cursor))
        : toDateStr(cursor)
    if (!buckets.has(key)) buckets.set(key, { date: key, facturadas: 0, pendientes: 0, total: 0, monto: 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  // Fill
  filtered.forEach(v => {
    const d = new Date(v.fecha)
    const key = mode === 'month'
      ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      : mode === 'week'
        ? toDateStr(getWeekStart(d))
        : toDateStr(d)
    const b = buckets.get(key)
    if (!b) return
    b.total++
    if (v.status === 'facturado') { b.facturadas++; b.monto += Number(v.monto) || 0 }
    if (v.status === 'pendiente' || v.status === 'procesando') b.pendientes++
  })
  return Array.from(buckets.values())
}

function getWeekStart(d) {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1))
  return r
}

function computeKPI(ventas, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T23:59:59')
  const filtered = ventas.filter(v => {
    if (v.status === 'borrada') return false
    const d = new Date(v.fecha)
    return d >= start && d <= end
  })
  return {
    facturadas: filtered.filter(v => v.status === 'facturado').length,
    pendientes: filtered.filter(v => v.status === 'pendiente' || v.status === 'procesando').length,
    total: filtered.length,
    monto: filtered.filter(v => v.status === 'facturado').reduce((s, v) => s + (Number(v.monto) || 0), 0),
  }
}

export default function AnalyticsDashboard({ ventas = [] }) {
  const [activeDays, setActiveDays] = useState(28)
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [activeMetrics, setActiveMetrics] = useState(['facturadas'])

  const today = new Date()
  const endDate = toDateStr(today)
  const startDate = toDateStr(addDays(today, -activeDays + 1))
  const compEndDate = toDateStr(addDays(today, -activeDays))
  const compStartDate = toDateStr(addDays(today, -activeDays * 2 + 1))

  const kpi = useMemo(() => computeKPI(ventas, startDate, endDate), [ventas, startDate, endDate])
  const kpiComp = useMemo(() => computeKPI(ventas, compStartDate, compEndDate), [ventas, compStartDate, compEndDate])

  const chartData = useMemo(() => groupByInterval(ventas, startDate, endDate, activeDays), [ventas, startDate, endDate, activeDays])
  const chartComp = useMemo(() => compareEnabled ? groupByInterval(ventas, compStartDate, compEndDate, activeDays) : [], [ventas, compStartDate, compEndDate, activeDays, compareEnabled])

  const toggleMetric = (m) => {
    setActiveMetrics(prev => prev.includes(m) ? (prev.length > 1 ? prev.filter(x => x !== m) : prev) : [...prev, m])
  }

  const pctChange = (curr, prev) => {
    if (!prev || prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  const cards = Object.entries(METRICS).map(([key, cfg]) => ({
    key, ...cfg,
    value: kpi[key],
    prev: kpiComp[key],
    change: pctChange(kpi[key], kpiComp[key]),
    active: activeMetrics.includes(key),
  }))

  return (
    <div className="mb-10">
      {/* Header + Date Range */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-text-primary uppercase tracking-tight">Gestión</h2>
          <p className="text-xs text-text-muted mt-0.5">Panel analítico y organización</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.days} onClick={() => setActiveDays(p.days)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
                activeDays === p.days ? 'bg-text-primary text-white shadow-md' : 'bg-surface-alt text-text-muted hover:bg-border/30'
              }`}>
              {p.label}
            </button>
          ))}
          <button onClick={() => setCompareEnabled(!compareEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer border ${
              compareEnabled ? 'border-purple bg-purple/5 text-purple' : 'border-border/40 text-text-muted hover:border-border'
            }`}>
            {compareEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            Comparar
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-stretch gap-4 mb-6">
        <div className="flex flex-wrap gap-2 lg:gap-4 flex-1">
          {cards.map(card => {
            const Icon = card.icon
            const isUp = card.change >= 0
            const isActive = card.active
            return (
              <button
                key={card.key}
                onClick={() => toggleMetric(card.key)}
                className={`relative flex-1 min-w-[140px] px-4 py-4 md:px-6 md:py-5 flex flex-col justify-between text-left transition-all duration-300 outline-none cursor-pointer rounded-xl border border-border shadow-sm group
                  ${isActive ? `${card.bgClass} text-white border-transparent` : 'bg-white text-text-primary hover:bg-surface-alt'}
                `}
              >
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                  <div className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${isActive ? 'bg-white/20 border-white/40' : 'bg-surface border-border'}`}>
                    {isActive && <Icon size={10} className="text-white" />}
                  </div>
                  <span className={`text-[10px] md:text-xs font-semibold uppercase tracking-wider ${isActive ? 'text-white' : 'text-text-secondary'}`}>{card.label}</span>
                </div>
                <div className="flex flex-col">
                  <span className={`text-xl md:text-3xl font-black tracking-tight ${isActive ? 'text-white' : card.textClass}`}>
                    {card.isMoney ? card.format(card.value) : card.value}
                  </span>
                  <div className={`flex items-center gap-1 mt-1 text-[9px] md:text-[10px] font-bold ${isActive ? 'text-white/80' : (isUp ? 'text-green' : 'text-red')}`}>
                    {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {isUp ? '+' : ''}{card.change}%
                    <span className={`font-normal ml-0.5 ${isActive ? 'text-white/60' : 'text-text-muted'}`}>vs anterior</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Chart */}
      <AnalyticsChart
        data={chartData}
        comparisonData={chartComp}
        activeMetrics={activeMetrics}
        compareEnabled={compareEnabled}
        metricConfigs={METRICS}
      />

      {compareEnabled && (
        <div className="flex items-center gap-4 mt-3 px-2 text-[10px] text-text-muted">
          <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-text-primary rounded inline-block" /> Actual</span>
          <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-text-muted rounded inline-block" style={{ borderTop: '2px dashed #999' }} /> Anterior</span>
        </div>
      )}
    </div>
  )
}
