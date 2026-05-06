import { useState, useMemo, useRef, useEffect } from 'react'
import { Calendar, TrendingUp, TrendingDown, FileCheck, Clock, FileText, DollarSign, ToggleLeft, ToggleRight, Plus, X, ChevronDown, Search, FileDown, Sparkles, Users } from 'lucide-react'
import AnalyticsChart from './AnalyticsChart'
import AIReportModal from './AIReportModal'
import { exportChartDataToExcel, exportChartDataToCSV } from '../utils/exportUtils'


const PRESETS = [
  { id: 'all', label: 'Histórico' },
  { id: 'year', label: 'Año Fiscal' },
  { id: 'month', label: 'Mes' },
  { id: 'week', label: 'Semana' },
  { id: 'day', label: 'Día' },
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

function getSignedAmount(v) {
  const isCN = [3, 8, 13, 113].includes(v.datos_fiscales?.tipo_cbte);
  const a = Number(v.monto) || 0;
  return isCN ? -Math.abs(a) : Math.abs(a);
}

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
    if (v.status === 'facturado') { b.facturadas++; b.monto += getSignedAmount(v) }
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
    monto: filtered.filter(v => v.status === 'facturado').reduce((s, v) => s + getSignedAmount(v), 0),
  }
}

export default function AnalyticsDashboard({ ventas = [], onFilteredVentasChange }) {
  const [timeframe, setTimeframe] = useState('all') // 'all','year','month','week','day' or 'custom'
  const [timeframeOpen, setTimeframeOpen] = useState(false)
  const timeframeRef = useRef(null)
  
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)

  const [compareMode, setCompareMode] = useState('off') // 'off', 'previous', 'year', 'custom'
  const [compareFrom, setCustomCompareFrom] = useState('')
  const [compareTo, setCustomCompareTo] = useState('')

  const [activeMetrics, setActiveMetrics] = useState(['facturadas'])
  const [selectedClient, setSelectedClient] = useState('all')
  const [clientOpen, setClientOpen] = useState(false)
  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const clientRef = useRef(null)

  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef(null)
  const [reportOpen, setReportOpen] = useState(false)

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
      if (timeframeRef.current && !timeframeRef.current.contains(e.target)) setTimeframeOpen(false)
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
  } else if (timeframe === 'all') {
    startDate = '2020-01-01'
    endDate = todayStr
  } else if (timeframe === 'year') {
    startDate = `${today.getFullYear()}-01-01`
    endDate = todayStr
  } else if (timeframe === 'month') {
    startDate = toDateStr(new Date(today.getFullYear(), today.getMonth(), 1))
    endDate = todayStr
  } else if (timeframe === 'week') {
    startDate = toDateStr(addDays(today, -6))
    endDate = todayStr
  } else if (timeframe === 'day') {
    startDate = todayStr
    endDate = todayStr
  } else {
    startDate = toDateStr(addDays(today, -27))
    endDate = todayStr
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

  const filteredSales = useMemo(() => {
    if (!startDate || !endDate) return dashboardVentas
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T23:59:59')
    return dashboardVentas.filter(v => {
      if (v.status === 'borrada') return false
      const d = new Date(v.fecha)
      return d >= start && d <= end
    })
  }, [dashboardVentas, startDate, endDate])

  useEffect(() => {
    onFilteredVentasChange?.(filteredSales)
  }, [filteredSales, onFilteredVentasChange])

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-text-primary uppercase tracking-tight">Métricas del negocio</h2>
          <p className="text-xs text-text-muted mt-1">Panel analítico y organización</p>
        </div>
        
        <button
          onClick={() => setReportOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#3460A8] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#2A4D86] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer shadow-lg shadow-black/10"
        >
          <Sparkles size={13} />
          Resumen Estadísticas
        </button>
      </div>

      {/* ─── TOP BAR (Filters) ─── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-surface-alt/30 p-2 rounded-xl border border-border/40 mb-6 mt-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick timeframe pills */}
          <div className="flex p-0.5 bg-white rounded-lg border border-border/60 shadow-sm">
            {PRESETS.map((option) => (
              <button
                key={option.id}
                onClick={() => { setTimeframe(option.id); setCustomFrom(''); setCustomTo(''); }}
                className={`px-3 py-1.5 rounded-md text-[10px] md:text-xs font-semibold transition-all duration-200 cursor-pointer
                  ${timeframe === option.id ? 'bg-blue/10 text-blue shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-surface-alt'}
                `}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Client Filter */}
          <div className="relative" ref={clientRef}>
            <button
              onClick={() => setClientOpen(!clientOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] md:text-xs font-semibold transition-all cursor-pointer
                ${(clientOpen || selectedClient !== 'all') ? 'bg-blue/10 border-blue/30 text-blue' : 'bg-white border-border/60 text-text-muted hover:text-text-primary hover:border-border shadow-sm'}
              `}
            >
              <Users size={13} />
              <span className="truncate max-w-[150px]">
                {selectedClient === 'all' ? 'Todos los clientes' : selectedClient}
              </span>
              <ChevronDown size={12} className={`text-text-muted transition-transform ${clientOpen ? 'rotate-180' : ''}`} />
            </button>

            {clientOpen && (
              <div className="absolute right-0 top-full mt-2 w-[280px] bg-white border border-border rounded-xl shadow-xl z-50 animate-slide-down overflow-hidden flex flex-col">
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

          {/* More Info / Compare Filter */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] md:text-xs font-semibold transition-all cursor-pointer
                ${(moreOpen || timeframe === 'custom' || compareMode !== 'off') ? 'bg-purple/10 border-purple/30 text-purple' : 'bg-white border-border/60 text-text-muted hover:text-text-primary hover:border-border shadow-sm'}
              `}
            >
              <Calendar size={13} />
              Más opciones
              <ChevronDown size={12} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>

            {moreOpen && (
              <div className="absolute right-0 top-full mt-2 w-[340px] bg-white border border-border rounded-xl shadow-xl z-50 animate-slide-down">
                <div className="px-4 py-3 border-b border-border bg-surface-alt/20"><h4 className="text-sm font-bold text-text-primary">Período personalizado</h4></div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] font-bold uppercase text-text-muted tracking-widest">Inicio</label>
                      <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:border-purple" />
                    </div>
                    <span className="text-text-muted mt-4">-</span>
                    <div className="flex-1">
                      <label className="text-[9px] font-bold uppercase text-text-muted tracking-widest">Fin</label>
                      <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:border-purple" />
                    </div>
                  </div>
                </div>
                
                <div className="px-4 py-3 border-y border-border bg-surface-alt/20"><h4 className="text-sm font-bold text-text-primary">Comparar con</h4></div>
                <div className="p-2">
                    <button onClick={() => setCompareMode('off')} className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-surface-alt cursor-pointer ${compareMode === 'off' ? 'text-purple bg-purple/5' : 'text-text-primary'}`}>Sin comparación</button>
                    <button onClick={() => setCompareMode('previous')} className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-surface-alt cursor-pointer ${compareMode === 'previous' ? 'text-purple bg-purple/5' : 'text-text-primary'}`}>Período anterior</button>
                    <button onClick={() => setCompareMode('year')} className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-surface-alt cursor-pointer ${compareMode === 'year' ? 'text-purple bg-purple/5' : 'text-text-primary'}`}>Mismo período año anterior</button>
                    <button onClick={() => setCompareMode('custom')} className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-surface-alt cursor-pointer ${compareMode === 'custom' ? 'text-purple bg-purple/5' : 'text-text-primary'}`}>Personalizado...</button>
                </div>
                {compareMode === 'custom' && (
                  <div className="p-4 border-t border-border bg-surface-alt/10">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[9px] font-bold uppercase text-text-muted tracking-widest">Inicio Comp.</label>
                        <input type="date" value={compareFrom} onChange={e => setCustomCompareFrom(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:border-purple" />
                      </div>
                      <span className="text-text-muted mt-4">-</span>
                      <div className="flex-1">
                        <label className="text-[9px] font-bold uppercase text-text-muted tracking-widest">Fin Comp.</label>
                        <input type="date" value={compareTo} onChange={e => setCustomCompareTo(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:border-purple" />
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-surface-alt/30">
                  <button onClick={() => setMoreOpen(false)} className="px-4 py-1.5 text-xs font-bold text-purple hover:underline cursor-pointer">Cerrar</button>
                  <button onClick={() => { if(customFrom && customTo) setTimeframe('custom'); setMoreOpen(false); }} className="px-4 py-1.5 text-xs font-bold text-white bg-purple rounded-lg hover:bg-purple/90 cursor-pointer">Aplicar</button>
                </div>
              </div>
            )}
          </div>

          {/* Export Dropdown */}
          <div className="relative" ref={exportRef}>
            <button 
              onClick={() => setExportOpen(!exportOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] md:text-xs font-semibold transition-all cursor-pointer
                ${exportOpen ? 'bg-blue/10 border-blue/30 text-blue' : 'bg-white border-border/60 text-text-muted hover:text-text-primary hover:border-border shadow-sm'}
              `}
            >
              <FileDown size={13} />
              Exportar
              <ChevronDown size={12} className={`ml-0.5 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
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
      <AIReportModal 
        isOpen={reportOpen} 
        onClose={() => setReportOpen(false)} 
        type="performance"
        data={{ filteredSales, chartData, kpi, kpiComp, compareEnabled, selectedClient, startDate, endDate, durationDays }}
      />
    </div>
  )
}
