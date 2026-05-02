import { useState, useMemo, useRef, useEffect } from 'react'
import { Calendar, TrendingUp, TrendingDown, FileCheck, Clock, FileText, DollarSign, ToggleLeft, ToggleRight, Plus, X, ChevronDown, Search, FileDown } from 'lucide-react'
import AnalyticsChart from './AnalyticsChart'
import { exportChartDataToExcel, exportChartDataToCSV } from '../utils/exportUtils'

const PRESETS = [
  { label: '7 días', days: 7 },
  { label: '28 días', days: 28 },
  { label: '3 meses', days: 90 },
  { label: '12 meses', days: 365 },
]

const METRICS = {
  facturadas: { color: '#305D4A', bgClass: 'card-green', textClass: 'text-green', label: 'Facturadas', icon: FileCheck, format: v => v, isMoney: false },
  pendientes: { color: '#D4B230', bgClass: 'card-yellow', textClass: 'text-[#b8960c]', label: 'Pendientes', icon: Clock, format: v => v, isMoney: false },
  total: { color: '#2C6473', bgClass: 'card-blue', textClass: 'text-blue', label: 'Total Ops', icon: FileText, format: v => v, isMoney: false },
  monto: { color: '#814FFE', bgClass: 'card-purple', textClass: 'text-purple', label: 'Monto Fact.', icon: DollarSign, format: v => `$${Number(v||0).toLocaleString('es-AR')}`, isMoney: true },
}

function toDateStr(d) { return d.toISOString().split('T')[0] }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function daysAgoStr(n) { return toDateStr(addDays(new Date(), -n)) }

function groupByInterval(ventas, startDate, endDate) {
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
  if (!startDate || !endDate) return { facturadas: 0, pendientes: 0, total: 0, monto: 0 }
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
  const [timeframe, setTimeframe] = useState(28) // number or 'custom'
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)

  const [compareMode, setCompareMode] = useState('off') // 'off', 'previous', 'year', 'custom'
  const [compareFrom, setCompareFrom] = useState('')
  const [compareTo, setCompareTo] = useState('')
  const [compareOpen, setCompareOpen] = useState(false)
  const compareRef = useRef(null)

  const [activeMetrics, setActiveMetrics] = useState(['facturadas'])
  const [selectedClient, setSelectedClient] = useState('all')
  const [clientOpen, setClientOpen] = useState(false)
  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const clientRef = useRef(null)

  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef(null)

  const uniqueClients = useMemo(() => {
    const clients = new Set()
    ventas.forEach(v => {
      if (v.status !== 'borrada' && v.cliente) {
        clients.add(v.cliente.trim())
      }
    })
    return Array.from(clients).sort((a, b) => a.localeCompare(b))
  }, [ventas])

  const filteredUniqueClients = useMemo(() => {
    if (!clientSearchTerm.trim()) return uniqueClients
    const q = clientSearchTerm.toLowerCase().trim()
    return uniqueClients.filter(c => c.toLowerCase().includes(q))
  }, [uniqueClients, clientSearchTerm])

  const dashboardVentas = useMemo(() => {
    if (selectedClient === 'all') return ventas
    return ventas.filter(v => v.cliente?.trim() === selectedClient)
  }, [ventas, selectedClient])

  useEffect(() => {
    const handler = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
      if (compareRef.current && !compareRef.current.contains(e.target)) setCompareOpen(false)
      if (clientRef.current && !clientRef.current.contains(e.target)) setClientOpen(false)
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ─── DATE CALCULATIONS ───
  const today = new Date()
  const todayStr = toDateStr(today)
  
  let startDate, endDate;
  if (timeframe === 'custom' && customFrom && customTo) {
    startDate = customFrom
    endDate = customTo
  } else {
    const tfNum = typeof timeframe === 'number' ? timeframe : 28
    endDate = todayStr
    startDate = toDateStr(addDays(today, -tfNum + 1))
  }

  const durationDays = Math.round((new Date(endDate + 'T12:00') - new Date(startDate + 'T12:00')) / 86400000) + 1

  let compStartDate = '', compEndDate = ''
  if (compareMode === 'previous') {
    compEndDate = toDateStr(addDays(new Date(startDate + 'T12:00'), -1))
    compStartDate = toDateStr(addDays(new Date(compEndDate + 'T12:00'), -durationDays + 1))
  } else if (compareMode === 'year') {
    compStartDate = toDateStr(addDays(new Date(startDate + 'T12:00'), -365))
    compEndDate = toDateStr(addDays(new Date(endDate + 'T12:00'), -365))
  } else if (compareMode === 'custom' && compareFrom && compareTo) {
    compStartDate = compareFrom
    compEndDate = compareTo
  }

  const compareEnabled = compareMode !== 'off'

  const kpi = useMemo(() => computeKPI(dashboardVentas, startDate, endDate), [dashboardVentas, startDate, endDate])
  const kpiComp = useMemo(() => computeKPI(dashboardVentas, compStartDate, compEndDate), [dashboardVentas, compStartDate, compEndDate])

  const chartData = useMemo(() => groupByInterval(dashboardVentas, startDate, endDate), [dashboardVentas, startDate, endDate])
  // Para la comparativa, usamos los mismos buckets de la original (simulando que suceden a la par)
  const chartComp = useMemo(() => {
    if (!compareEnabled || !compStartDate || !compEndDate) return []
    const compData = groupByInterval(dashboardVentas, compStartDate, compEndDate)
    // Map comparison data to the same length as chartData
    return chartData.map((d, i) => {
      const compBucket = compData[i] || { facturadas: 0, pendientes: 0, total: 0, monto: 0 }
      return { ...compBucket, date: d.date } // Override date so it overlays on the chart
    })
  }, [dashboardVentas, compStartDate, compEndDate, compareEnabled, chartData])

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
          
          {/* Client Filter */}
          <div className="relative" ref={clientRef}>
            <button
              onClick={() => setClientOpen(!clientOpen)}
              className="flex items-center gap-2 bg-surface-alt rounded-xl border border-border/40 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-text-primary hover:bg-border/30 transition-colors cursor-pointer"
            >
              <span className="truncate max-w-[150px]">
                {selectedClient === 'all' ? 'Todos los clientes' : selectedClient}
              </span>
              <ChevronDown size={12} className="text-text-muted" />
            </button>

            {clientOpen && (
              <div className="absolute left-0 top-full mt-2 w-[280px] bg-white border border-border rounded-xl shadow-xl z-50 animate-slide-down overflow-hidden flex flex-col">
                <div className="p-2 border-b border-border/60 bg-surface-alt/20">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Buscar cliente..."
                      value={clientSearchTerm}
                      onChange={e => setClientSearchTerm(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 text-xs border border-border/60 rounded-lg bg-white focus:outline-none focus:border-blue placeholder-text-muted"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <button
                    onClick={() => { setSelectedClient('all'); setClientOpen(false); setClientSearchTerm(''); }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold cursor-pointer border-b border-border/10
                      ${selectedClient === 'all' ? 'bg-blue/5 text-blue' : 'text-text-primary hover:bg-surface-alt/50'}
                    `}
                  >
                    Todos los clientes
                  </button>
                  {filteredUniqueClients.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[10px] text-text-muted">No hay coincidencias</div>
                  ) : (
                    filteredUniqueClients.map(c => (
                      <button
                        key={c}
                        onClick={() => { setSelectedClient(c); setClientOpen(false); setClientSearchTerm(''); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold cursor-pointer border-b border-border/10 last:border-0 truncate
                          ${selectedClient === c ? 'bg-blue/5 text-blue' : 'text-text-primary hover:bg-surface-alt/50'}
                        `}
                      >
                        {c}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Main Date Selectors */}
          <div className="flex items-center bg-surface-alt rounded-xl p-1 border border-border/40">
            {PRESETS.map(p => (
              <button key={p.days} onClick={() => setTimeframe(p.days)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
                  timeframe === p.days ? 'bg-text-primary text-white shadow-md' : 'text-text-muted hover:bg-border/30'
                }`}>
                {p.label}
              </button>
            ))}

            <div className="relative ml-1" ref={moreRef}>
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
                  timeframe === 'custom' ? 'bg-blue text-white shadow-md' : 'text-text-muted hover:bg-border/30'
                }`}
              >
                {timeframe === 'custom' ? <Calendar size={14} /> : <Plus size={14} />}
              </button>

              {moreOpen && (
                <div className="absolute right-0 top-full mt-2 w-[340px] bg-white border border-border rounded-xl shadow-xl z-50 animate-slide-down">
                  <div className="px-4 py-3 border-b border-border"><h4 className="text-sm font-bold text-text-primary">Período principal</h4></div>
                  <div className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[9px] font-bold uppercase text-text-muted tracking-widest">Inicio</label>
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded-lg bg-surface-alt focus:outline-none focus:border-blue" />
                      </div>
                      <span className="text-text-muted mt-4">-</span>
                      <div className="flex-1">
                        <label className="text-[9px] font-bold uppercase text-text-muted tracking-widest">Fin</label>
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded-lg bg-surface-alt focus:outline-none focus:border-blue" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-surface-alt/30">
                    <button onClick={() => setMoreOpen(false)} className="px-4 py-1.5 text-xs font-bold text-blue hover:underline cursor-pointer">Cancelar</button>
                    <button onClick={() => { if(customFrom && customTo) { setTimeframe('custom'); setMoreOpen(false) } }} className="px-4 py-1.5 text-xs font-bold text-white bg-blue rounded-lg hover:bg-blue/90 disabled:opacity-50 cursor-pointer" disabled={!customFrom || !customTo}>Aplicar</button>
                  </div>
                </div>
              )}
            </div>
            {/* Compare Selector */}
            <div className="relative" ref={compareRef}>
              <button onClick={() => setCompareOpen(!compareOpen)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer border ${
                  compareEnabled ? 'border-purple bg-purple/5 text-purple' : 'border-border/40 text-text-muted hover:bg-surface-alt'
                }`}>
                {compareEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                Comparar {compareEnabled && <ChevronDown size={12} className="ml-0.5" />}
              </button>

              {compareOpen && (
                <div className="absolute right-0 top-full mt-2 w-[300px] bg-white border border-border rounded-xl shadow-xl z-50 animate-slide-down">
                  <div className="px-4 py-3 border-b border-border"><h4 className="text-sm font-bold text-text-primary">Comparar con</h4></div>
                  <div className="p-2">
                    <button onClick={() => { setCompareMode('off'); setCompareOpen(false) }} className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-surface-alt cursor-pointer ${compareMode === 'off' ? 'text-purple bg-purple/5' : 'text-text-primary'}`}>
                      Sin comparación
                    </button>
                    <button onClick={() => { setCompareMode('previous'); setCompareOpen(false) }} className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-surface-alt cursor-pointer ${compareMode === 'previous' ? 'text-purple bg-purple/5' : 'text-text-primary'}`}>
                      Período anterior
                    </button>
                    <button onClick={() => { setCompareMode('year'); setCompareOpen(false) }} className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-surface-alt cursor-pointer ${compareMode === 'year' ? 'text-purple bg-purple/5' : 'text-text-primary'}`}>
                      Mismo período año anterior
                    </button>
                    <button onClick={() => setCompareMode('custom')} className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-surface-alt cursor-pointer ${compareMode === 'custom' ? 'text-purple bg-purple/5' : 'text-text-primary'}`}>
                      Personalizado...
                    </button>
                  </div>
                  
                  {compareMode === 'custom' && (
                    <div className="p-4 border-t border-border bg-surface-alt/30">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[9px] font-bold uppercase text-text-muted tracking-widest">Inicio Comp.</label>
                          <input type="date" value={compareFrom} onChange={e => setCompareFrom(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:border-purple" />
                        </div>
                        <span className="text-text-muted mt-4">-</span>
                        <div className="flex-1">
                          <label className="text-[9px] font-bold uppercase text-text-muted tracking-widest">Fin Comp.</label>
                          <input type="date" value={compareTo} onChange={e => setCompareTo(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:border-purple" />
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button onClick={() => setCompareOpen(false)} className="px-3 py-1.5 text-xs font-bold text-white bg-purple rounded-lg hover:bg-purple/90 cursor-pointer">OK</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Export Dropdown */}
            <div className="relative" ref={exportRef}>
              <button 
                onClick={() => setExportOpen(!exportOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer border border-border/40 text-text-muted hover:bg-surface-alt hover:text-text-primary"
              >
                <FileDown size={14} />
                Exportar <ChevronDown size={12} className="ml-0.5" />
              </button>
              
              {exportOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-border/40 py-1 z-50 animate-slide-down">
                  <button 
                    onClick={() => { exportChartDataToExcel(chartData); setExportOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-alt hover:text-blue transition-colors cursor-pointer"
                  >
                    Exportar Gráfico (Excel)
                  </button>
                  <button 
                    onClick={() => { exportChartDataToCSV(chartData); setExportOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-alt hover:text-blue transition-colors cursor-pointer"
                  >
                    Exportar Gráfico (CSV)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-stretch gap-4 mb-6">
        <div className="flex flex-wrap gap-2 lg:gap-4 w-full">
          {cards.map(card => {
            const Icon = card.icon
            const isUp = card.change >= 0
            const isActive = card.active
            return (
              <button
                key={card.key}
                onClick={() => toggleMetric(card.key)}
                className={`relative min-w-[160px] max-w-[220px] px-4 py-4 md:px-5 md:py-4 flex flex-col justify-between text-left transition-all duration-300 outline-none cursor-pointer rounded-xl border border-border shadow-sm group
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
                  {compareEnabled && (
                    <div className={`flex items-center gap-1 mt-1 text-[9px] md:text-[10px] font-bold ${isActive ? 'text-white/80' : (isUp ? 'text-green' : 'text-red')}`}>
                      {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {isUp ? '+' : ''}{card.change}%
                      <span className={`font-normal ml-0.5 ${isActive ? 'text-white/60' : 'text-text-muted'}`}>vs comp.</span>
                    </div>
                  )}
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
          <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-text-muted rounded inline-block" style={{ borderTop: '2px dashed #999' }} /> Comparación</span>
        </div>
      )}
    </div>
  )
}
