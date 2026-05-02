import { useState, useRef, useEffect, useMemo } from 'react'

/**
 * Pure SVG Analytics Chart — Search Console style
 * Supports multiple metrics, comparison overlay, interactive tooltips
 */
export default function AnalyticsChart({ 
  data = [],           // [{ date, facturadas, pendientes, total, monto }]
  comparisonData = [], // same shape, for the comparison period
  activeMetrics = [],  // ['facturadas', 'monto', ...]
  compareEnabled = false,
  metricConfigs = {},  // { facturadas: { color, label, format } }
}) {
  const containerRef = useRef(null)
  const [dims, setDims] = useState({ w: 600, h: 260 })
  const [hoverIdx, setHoverIdx] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect
      setDims({ w: Math.max(300, width), h: 260 })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pad = { top: 24, right: 20, bottom: 40, left: 55 }
  const chartW = dims.w - pad.left - pad.right
  const chartH = dims.h - pad.top - pad.bottom

  // Compute Y domain across all active metrics + comparison
  const { yMin, yMax, yTicks } = useMemo(() => {
    let allVals = []
    activeMetrics.forEach(m => {
      data.forEach(d => { if (d[m] != null) allVals.push(d[m]) })
      if (compareEnabled) {
        comparisonData.forEach(d => { if (d[m] != null) allVals.push(d[m]) })
      }
    })
    if (allVals.length === 0) allVals = [0]
    const min = 0
    const rawMax = Math.max(...allVals, 1)
    // Nice max
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)))
    const niceMax = Math.ceil(rawMax / magnitude) * magnitude || 1
    // Generate ticks
    const tickCount = 5
    const step = niceMax / tickCount
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round(i * step))
    return { yMin: min, yMax: niceMax, yTicks: ticks }
  }, [data, comparisonData, activeMetrics, compareEnabled])

  // X positions
  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW
  const getX = (i) => pad.left + (data.length > 1 ? i * xStep : chartW / 2)
  const getY = (val) => pad.top + chartH - ((val - yMin) / (yMax - yMin || 1)) * chartH

  // Build path
  const buildPath = (dataset, metric) => {
    const points = dataset.map((d, i) => ({
      x: pad.left + (dataset.length > 1 ? i * (chartW / (dataset.length - 1)) : chartW / 2),
      y: getY(d[metric] ?? 0),
    }))
    if (points.length === 0) return ''
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  }

  // Build area (filled under line)
  const buildArea = (dataset, metric) => {
    const points = dataset.map((d, i) => ({
      x: pad.left + (dataset.length > 1 ? i * (chartW / (dataset.length - 1)) : chartW / 2),
      y: getY(d[metric] ?? 0),
    }))
    if (points.length === 0) return ''
    const baseline = pad.top + chartH
    return `M${points[0].x},${baseline} ` +
      points.map(p => `L${p.x},${p.y}`).join(' ') +
      ` L${points[points.length - 1].x},${baseline} Z`
  }

  // Date labels for X axis
  const xLabels = useMemo(() => {
    if (data.length <= 1) return data.map(d => formatDateLabel(d.date))
    const maxLabels = Math.floor(chartW / 70)
    const step = Math.max(1, Math.ceil(data.length / maxLabels))
    return data.map((d, i) => i % step === 0 || i === data.length - 1 ? formatDateLabel(d.date) : '')
  }, [data, chartW])

  const handleMouseMove = (e) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || data.length === 0) return
    const mouseX = e.clientX - rect.left - pad.left
    const idx = Math.round(mouseX / (xStep || 1))
    const clamped = Math.max(0, Math.min(data.length - 1, idx))
    setHoverIdx(clamped)
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  if (data.length === 0) {
    return (
      <div ref={containerRef} className="w-full bg-white border border-border/40 rounded-2xl p-8 text-center">
        <p className="text-xs text-text-muted">No hay datos para el período seleccionado</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full bg-white border border-border/40 rounded-2xl overflow-hidden relative" 
         onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
      <svg width={dims.w} height={dims.h} className="block">
        {/* Grid lines */}
        {yTicks.map(tick => (
          <g key={tick}>
            <line x1={pad.left} y1={getY(tick)} x2={dims.w - pad.right} y2={getY(tick)} 
                  stroke="#e5e5e5" strokeWidth={1} />
            <text x={pad.left - 8} y={getY(tick) + 3} textAnchor="end" 
                  className="fill-[#999] text-[10px]" style={{ fontSize: '10px', fontFamily: 'Space Grotesk, sans-serif' }}>
              {formatYLabel(tick, activeMetrics, metricConfigs)}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {xLabels.map((label, i) => label ? (
          <text key={i} x={getX(i)} y={dims.h - 8} textAnchor="middle" 
                className="fill-[#999] text-[10px]" style={{ fontSize: '10px', fontFamily: 'Space Grotesk, sans-serif' }}>
            {label}
          </text>
        ) : null)}

        {/* Comparison lines (dashed, behind) */}
        {compareEnabled && activeMetrics.map(metric => {
          const cfg = metricConfigs[metric] || {}
          return (
            <g key={`comp-${metric}`}>
              <path d={buildPath(comparisonData, metric)} fill="none" 
                    stroke={cfg.color || '#999'} strokeWidth={1.5} strokeDasharray="6 4" opacity={0.35} />
            </g>
          )
        })}

        {/* Main lines + areas */}
        {activeMetrics.map(metric => {
          const cfg = metricConfigs[metric] || {}
          return (
            <g key={metric}>
              <path d={buildArea(data, metric)} fill={cfg.color || '#3460A8'} opacity={0.06} />
              <path d={buildPath(data, metric)} fill="none" 
                    stroke={cfg.color || '#3460A8'} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              {/* Data points */}
              {data.map((d, i) => (
                <circle key={i} cx={getX(i)} cy={getY(d[metric] ?? 0)} r={hoverIdx === i ? 5 : 3}
                  fill="white" stroke={cfg.color || '#3460A8'} strokeWidth={2}
                  className="transition-all duration-150" />
              ))}
            </g>
          )
        })}

        {/* Hover vertical line */}
        {hoverIdx !== null && (
          <line x1={getX(hoverIdx)} y1={pad.top} x2={getX(hoverIdx)} y2={pad.top + chartH}
                stroke="#000" strokeWidth={1} opacity={0.1} strokeDasharray="4 2" />
        )}
      </svg>

      {/* Tooltip */}
      {hoverIdx !== null && data[hoverIdx] && (
        <div className="absolute z-50 pointer-events-none bg-[#1a1a1a] text-white rounded-xl px-4 py-3 shadow-xl"
             style={{
               left: Math.min(tooltipPos.x + 12, dims.w - 180),
               top: Math.max(tooltipPos.y - 80, 8),
               minWidth: 140,
             }}>
          <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">
            {formatDateFull(data[hoverIdx].date)}
          </div>
          {activeMetrics.map(metric => {
            const cfg = metricConfigs[metric] || {}
            const val = data[hoverIdx][metric] ?? 0
            const compVal = compareEnabled && comparisonData[hoverIdx] ? comparisonData[hoverIdx][metric] ?? 0 : null
            return (
              <div key={metric} className="flex items-center gap-2 mb-1 last:mb-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color || '#3460A8' }} />
                <span className="text-[11px] font-semibold flex-1">{cfg.label || metric}</span>
                <span className="text-[11px] font-black tabular-nums">
                  {cfg.format ? cfg.format(val) : val}
                </span>
                {compVal !== null && (
                  <span className="text-[9px] text-white/40 ml-1">vs {cfg.format ? cfg.format(compVal) : compVal}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Helpers ─── */
function formatDateLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function formatDateFull(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatYLabel(val, activeMetrics, configs) {
  // If any money metric is active, format as money
  const moneyMetric = activeMetrics.find(m => configs[m]?.isMoney)
  if (moneyMetric) {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`
    return `$${val}`
  }
  return val.toString()
}
