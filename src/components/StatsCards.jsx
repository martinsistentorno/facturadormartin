import { TrendingUp, Clock, FileCheck, Trash2, AlertCircle, Activity, ChevronDown, ChevronUp, AlertTriangle, Archive, Calendar, X } from 'lucide-react'
import { useState, useMemo, useEffect, useRef } from 'react'
import { filterVentasByTimeframe } from '../utils/dateUtils'
import { useConfig } from '../context/ConfigContext'
import { getMonotributoLimit } from '../utils/afipConstants'

export default function StatsCards({ ventas, allVentas, onCardClick, activeCard, tableVentas, selectedVentas = [] }) {
  const [timeframe, setTimeframe] = useState('all')
  const [moreOpen, setMoreOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const moreRef = useRef(null)

  const { emisor, isRI } = useConfig()

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const customRange = (timeframe === 'custom' && customFrom && customTo) ? { from: customFrom, to: customTo } : null
  const filteredVentas = filterVentasByTimeframe(ventas, timeframe, customRange)
  const activas = filteredVentas.filter(v => v.status !== 'borrada')

  const facturadas = activas.filter(v => v.status === 'facturado')
  const conError = activas.filter(v => v.status === 'error')
  const pendientes = activas.filter(v => v.status === 'pendiente' || v.status === 'procesando')
  const archivadasAll = ventas.filter(v => v.archivada || v.status === 'archivada' || v.status === 'archivado')
  const borradasAll = ventas.filter(v => v.status === 'borrada')

  const getAmount = (v) => {
    const isCreditNote = [3, 8, 13, 113].includes(v.datos_fiscales?.tipo_cbte);
    const amount = Number(v.monto) || 0;
    return isCreditNote ? -Math.abs(amount) : Math.abs(amount);
  };

  const totalActivasAmount = activas.reduce((s, v) => s + getAmount(v), 0)
  const facturadasAmount = facturadas.reduce((s, v) => s + getAmount(v), 0)
  const pendientesAmount = pendientes.reduce((s, v) => s + getAmount(v), 0)
  const conErrorAmount = conError.reduce((s, v) => s + getAmount(v), 0)


  // ─── Monotributo ───
  const facturacionAnualGlobal = useMemo(() => {
    if (isRI) return 0;
    const currentYear = new Date().getFullYear();
    const sourceVentas = allVentas || ventas;
    const facturadasAnio = sourceVentas.filter(v =>
      v.status === 'facturado' &&
      new Date(v.fecha).getFullYear() === currentYear
    );
    return facturadasAnio.reduce((s, v) => s + getAmount(v), 0);
  }, [allVentas, ventas, isRI]);

  const facturacionAnualFiltrada = useMemo(() => {
    if (isRI) return 0;
    const currentYear = new Date().getFullYear();
    const source = selectedVentas.length > 0 ? selectedVentas : (tableVentas || ventas);
    const facturadasAnio = source.filter(v =>
      v.status === 'facturado' &&
      new Date(v.fecha).getFullYear() === currentYear
    );
    return facturadasAnio.reduce((s, v) => s + getAmount(v), 0);
  }, [tableVentas, ventas, isRI, selectedVentas]);

  const category = emisor?.monotributo_categoria || 'A';
  const limit = getMonotributoLimit(category);
  const percentageGlobal = Math.min((facturacionAnualGlobal / limit) * 100, 100);
  const percentageFiltrada = Math.min((facturacionAnualFiltrada / limit) * 100, 100);

  const getThermometerColor = (pct) => {
    if (pct >= 90) return 'text-[#C0443C] bg-[#C0443C]';
    if (pct >= 75) return 'text-[#F59E0B] bg-[#F59E0B]';
    return 'text-[#2D8F5E] bg-[#2D8F5E]';
  };
  const colorClass = getThermometerColor(percentageGlobal);

  useEffect(() => {
    if (!activeCard && onCardClick) {
      onCardClick('Facturadas', facturadas, timeframe)
    }
  }, [])

  useEffect(() => {
    if (!activeCard || !onCardClick) return;
    let newData = [];
    if (activeCard === 'Facturadas') newData = facturadas;
    else if (activeCard === 'Total Ventas') newData = activas;
    else if (activeCard === 'Pendientes') newData = pendientes;
    else if (activeCard === 'Con Error') newData = conError;
    else return;
    onCardClick(activeCard, newData, timeframe);
  }, [timeframe, ventas, customFrom, customTo]);

  const renderMoney = (amount) => formatCurrency(amount)


  const handleApplyCustom = () => {
    if (customFrom && customTo) {
      setTimeframe('custom')
      setMoreOpen(false)
    }
  }

  const handlePreset = (id) => {
    setTimeframe(id)
    setCustomFrom('')
    setCustomTo('')
    setMoreOpen(false)
  }


  const cards = [
    { key: 'Facturadas', label: 'Total Facturado', amount: facturadasAmount, count: facturadas.length, bgClass: 'card-green', textColor: 'text-green', icon: FileCheck },
    { key: 'Pendientes', label: 'Pendientes', amount: pendientesAmount, count: pendientes.length, bgClass: 'card-yellow', textColor: 'text-[#b8960c]', icon: Clock },
    { key: 'Con Error', label: 'Errores AFIP', amount: conErrorAmount, count: conError.length, bgClass: 'card-red', textColor: 'text-red', icon: AlertCircle },
    { key: 'Total Ventas', label: 'Total Movimientos', amount: totalActivasAmount, count: activas.length, bgClass: 'card-blue', textColor: 'text-blue', icon: Activity },
  ]

  return (
    <div className="space-y-4">
      {/* ─── TOP BAR ─── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-surface-alt/30 p-2 rounded-xl border border-border/40">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick timeframe pills */}
          <div className="flex p-0.5 bg-white rounded-lg border border-border/60 shadow-sm">
            {[
              { id: 'all', label: 'Histórico' },
              { id: 'year', label: 'Año Fiscal' },
              { id: 'month', label: 'Mes' },
              { id: 'week', label: 'Semana' },
              { id: 'day', label: 'Día' }
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => handlePreset(option.id)}
                className={`px-3 py-1.5 rounded-md text-[10px] md:text-xs font-semibold transition-all duration-200 cursor-pointer
                  ${timeframe === option.id ? 'bg-blue/10 text-blue shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-surface-alt'}
                `}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Más información dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] md:text-xs font-semibold transition-all cursor-pointer
                ${(moreOpen || timeframe === 'custom') ? 'bg-blue/10 border-blue/30 text-blue' : 'bg-white border-border/60 text-text-muted hover:text-text-primary hover:border-border shadow-sm'}
              `}
            >
              <Calendar size={13} />
              Más información
              <ChevronDown size={12} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>

            {moreOpen && (
              <div className="absolute top-full left-0 mt-2 w-[340px] bg-white border border-border rounded-xl shadow-xl z-50 animate-slide-down overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-border">
                  <h4 className="text-sm font-bold text-text-primary">Intervalo de fechas</h4>
                </div>

                <div className="p-4 space-y-3">
                  {/* Preset ranges */}
                  {[
                    { label: 'Últimos 7 días', from: daysAgo(7), to: todayStr() },
                    { label: 'Últimos 28 días', from: daysAgo(28), to: todayStr() },
                    { label: 'Últimos 3 meses', from: daysAgo(90), to: todayStr() },
                    { label: 'Últimos 6 meses', from: daysAgo(180), to: todayStr() },
                    { label: 'Últimos 12 meses', from: daysAgo(365), to: todayStr() },
                  ].map((preset) => (
                    <label key={preset.label} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="datePreset"
                        checked={timeframe === 'custom' && customFrom === preset.from && customTo === preset.to}
                        onChange={() => { setCustomFrom(preset.from); setCustomTo(preset.to); setTimeframe('custom'); }}
                        className="accent-blue w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm text-text-primary group-hover:text-blue transition-colors">{preset.label}</span>
                    </label>
                  ))}

                  <div className="h-px bg-border/40 my-2" />

                  {/* Custom range */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="datePreset"
                      checked={timeframe === 'custom' && ![7,28,90,180,365].some(d => customFrom === daysAgo(d) && customTo === todayStr())}
                      onChange={() => {}}
                      className="accent-blue w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm text-text-primary">Personalizado</span>
                  </label>

                  <div className="flex items-center gap-2 pl-7">
                    <div className="flex-1">
                      <label className="text-[9px] font-bold uppercase text-text-muted tracking-widest">Fecha inicio</label>
                      <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded-lg bg-surface-alt focus:outline-none focus:border-blue" />
                    </div>
                    <span className="text-text-muted mt-4">-</span>
                    <div className="flex-1">
                      <label className="text-[9px] font-bold uppercase text-text-muted tracking-widest">Fecha fin</label>
                      <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded-lg bg-surface-alt focus:outline-none focus:border-blue" />
                    </div>
                  </div>

                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-surface-alt/30">
                  <button onClick={() => { setMoreOpen(false) }} className="px-4 py-1.5 text-xs font-bold text-blue cursor-pointer hover:underline">Cancelar</button>
                  <button onClick={handleApplyCustom} className="px-4 py-1.5 text-xs font-bold text-white bg-blue rounded-lg cursor-pointer hover:bg-blue/90 transition-colors disabled:opacity-40" disabled={!customFrom || !customTo}>Aplicar</button>
                </div>
              </div>
            )}
          </div>

          {/* Active custom badge */}
          {timeframe === 'custom' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue/10 text-blue rounded-full text-[10px] font-bold">
              <Calendar size={11} />
              {customFrom} → {customTo}
              <button onClick={() => { setTimeframe('all'); setCustomFrom(''); setCustomTo(''); }} className="ml-1 hover:text-red cursor-pointer"><X size={11} /></button>
            </div>
          )}

        </div>
      </div>

      {/* ─── METRIC CARDS ROW ─── */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-stretch gap-4">
        <div className="flex flex-wrap gap-2 lg:gap-4 flex-1">
          {cards.map((card) => {
            const isActive = activeCard === card.key
            const Icon = card.icon
            const dataMap = { 'Facturadas': facturadas, 'Pendientes': pendientes, 'Con Error': conError, 'Total Ventas': activas }
            return (
              <button
                key={card.key}
                onClick={() => onCardClick(card.key, dataMap[card.key], timeframe)}
                className={`relative px-6 py-4 md:px-8 md:py-5 flex flex-col justify-between text-left transition-all duration-300 outline-none cursor-pointer rounded-xl border border-border shadow-sm group
                  ${isActive ? `${card.bgClass} text-white border-transparent` : 'bg-white text-text-primary hover:bg-surface-alt'}
                `}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${isActive ? 'bg-white/20 border-white/40' : 'bg-surface border-border'}`}>
                    {isActive && <Icon size={10} className="text-white" />}
                  </div>
                  <span className={`text-xs md:text-sm font-semibold ${isActive ? 'text-white' : 'text-text-secondary'}`}>{card.label}</span>
                </div>
                <div className="flex flex-col">
                  <span className={`text-2xl md:text-3xl font-black tracking-tight ${isActive ? 'text-white' : card.textColor}`}>
                    {renderMoney(card.amount)}
                  </span>
                  <span className={`text-[10px] uppercase tracking-widest mt-1 ${isActive ? 'text-white/80' : 'text-text-muted'}`}>
                    {card.count} mov.
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Monotributo thermometer */}
        {!isRI && (
          <div className="flex flex-col justify-center w-full xl:w-[350px] 2xl:w-[450px] px-2 py-4 xl:py-0">
            <div className="flex justify-between items-end mb-2">
              <div className="flex flex-col">
                <span className="text-xs md:text-sm font-bold uppercase text-text-muted tracking-widest">Cat. {category}</span>
                <span className="text-[11px] md:text-xs font-semibold text-text-muted mt-0.5">Límite: {renderMoney(limit)}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg md:text-xl font-black text-text-primary">{renderMoney(facturacionAnualGlobal)}</span>
                  <span className={`text-[10px] font-bold ${colorClass.split(' ')[0]}`}>{percentageGlobal.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="h-2.5 w-full bg-border/40 rounded-full overflow-hidden relative">
              {/* Barra global (total año fiscal) */}
              <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${colorClass.split(' ')[1]}`} style={{ width: `${percentageGlobal}%` }} />
              {/* Barra filtrada sutil superpuesta (impacto del cliente/filtro) */}
              {percentageFiltrada > 0 && percentageFiltrada < percentageGlobal && (
                <div className="absolute top-0 left-0 h-full rounded-full bg-white/40 transition-all duration-1000" style={{ width: `${percentageFiltrada}%` }} />
              )}
            </div>
            {/* Leyenda sutil de impacto */}
            {percentageFiltrada > 0 && percentageFiltrada < percentageGlobal && (
              <span className="text-[9px] text-text-muted/70 italic mt-1.5 ml-1 animate-fade-in tracking-wider">
                Impacto de la tabla en el límite anual
              </span>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
