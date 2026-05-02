import { useState, useRef, useEffect, useMemo } from 'react'

/**
 * Pure SVG Analytics Chart — Search Console style
 * Supports multiple metrics with DUAL Y-AXIS:
 *   - Left axis: money metrics ($)
 *   - Right axis: count metrics (units)
 * Includes comparison overlay and interactive tooltips
 */
export default function AnalyticsChart({ 
  data = [],           // [{ date, facturadas, pendientes, total, monto }]
  comparisonData = [], // same shape, for the comparison period
  activeMetrics = [],  // ['facturadas', 'monto', ...]
  compareEnabled = false,
  metricConfigs = {},  // { facturadas: { color, label, format, isMoney } }
}) {
  const containerRef = useRef(null)
  const [dims, setDims] = useState({ w: 600, h: 280 })
  const [hoverIdx, setHoverIdx] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect
      setDims({ w: Math.max(300, width), h: 280 })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Split metrics into money vs count
  const moneyMetrics = activeMetrics.filter(m => metricConfigs[m]?.isMoney)
  const countMetrics = activeMetrics.filter(m => !metricConfigs[m]?.isMoney)
  const hasMoney = moneyMetrics.length > 0
  const hasCount = countMetrics.length > 0
  const hasDual = hasMoney && hasCount

  // Dynamic padding — right side gets space for labels only when dual axis
  const pad = { top: 24, right: hasDual ? 55 : 20, bottom: 40, left: 55 }
  const chartW = dims.w - pad.left - pad.right
  const chartH = dims.h - pad.top - pad.bottom

  // ─── Compute Y domains independently ───
  const computeScale = (metrics) => {
    let allVals = []
    metrics.forEach(m => {
      data.forEach(d => { if (d[m] != null) allVals.push(d[m]) })
      if (compareEnabled) {
        comparisonData.forEach(d => { if (d[m] != null) allVals.push(d[m]) })
      }
    })
    if (allVals.length === 0) allVals = [0]
    const rawMax = Math.max(...allVals, 1)
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax))) || 1
    const niceMax = Math.ceil(rawMax / magnitude) * magnitude || 1
    const tickCount = 5
    const step = niceMax / tickCount
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round(i * step))
    return { yMin: 0, yMax: niceMax, yTicks: ticks }
  }

  const moneyScale = useMemo(() => computeScale(moneyMetrics), [data, comparisonData, moneyMetrics.join(','), compareEnabled])
  const countScale = useMemo(() => computeScale(countMetrics), [data, comparisonData, countMetrics.join(','), compareEnabled])

  // If only one type is active, use that scale for everything
  const getScaleFor = (metric) => {
    return metricConfigs[metric]?.isMoney ? moneyScale : countScale
  }

  // X positions
  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW
  const getX = (i) => pad.left + (data.length > 1 ? i * xStep : chartW / 2)
  const getY = (val, scale) => {
    const range = scale.yMax - scale.yMin || 1
    return pad.top + chartH - ((val - scale.yMin) / range) * chartH
  }

  // Build path for a given dataset and metric
  const buildPath = (dataset, metric) => {
    const scale = getScaleFor(metric)
    const step = dataset.length > 1 ? chartW / (dataset.length - 1) : 0
    const points = dataset.map((d, i) => ({
      x: pad.left + (dataset.length > 1 ? i * step : chartW / 2),
      y: getY(d[metric] ?? 0, scale),
    }))
    if (points.length === 0) return ''
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  }

  // Build area (filled under line)
  const buildArea = (dataset, metric) => {
    const scale = getScaleFor(metric)
    const step = dataset.length > 1 ? chartW / (dataset.length - 1) : 0
    const points = dataset.map((d, i) => ({
      x: pad.left + (dataset.length > 1 ? i * step : chartW / 2),
      y: getY(d[metric] ?? 0, scale),
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

  // Decide which grid lines to show (prefer count grid if both, or whichever is active)
  const primaryScale = hasCount ? countScale : moneyScale
  const primaryIsMoney = !hasCount && hasMoney

  return (
    <div ref={containerRef} className="w-full bg-white border border-border/40 rounded-2xl overflow-hidden relative" 
         onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
      <svg width={dims.w} height={dims.h} className="block">
        {/* Grid lines — based on primary scale */}
        {primaryScale.yTicks.map(tick => (
          <g key={tick}>
            <line x1={pad.left} y1={getY(tick, primaryScale)} x2={dims.w - pad.right} y2={getY(tick, primaryScale)} 
                  stroke="#e5e5e5" strokeWidth={1} />
          </g>
        ))}

        {/* Left Y-axis labels */}
        {hasCount && countScale.yTicks.map(tick => (
          <text key={`l-${tick}`} x={pad.left - 8} y={getY(tick, countScale) + 3} textAnchor="end" 
                className="fill-[#999] text-[10px]" style={{ fontSize: '10px', fontFamily: 'Space Grotesk, sans-serif' }}>
            {tick}
          </text>
        ))}
        {!hasCount && hasMoney && moneyScale.yTicks.map(tick => (
          <text key={`l-${tick}`} x={pad.left - 8} y={getY(tick, moneyScale) + 3} textAnchor="end" 
                className="fill-[#999] text-[10px]" style={{ fontSize: '10px', fontFamily: 'Space Grotesk, sans-serif' }}>
            {formatMoneyLabel(tick)}
          </text>
        ))}

        {/* Right Y-axis labels (only when dual) */}
        {hasDual && moneyScale.yTicks.map(tick => (
          <text key={`r-${tick}`} x={dims.w - pad.right + 8} y={getY(tick, moneyScale) + 3} textAnchor="start" 
                style={{ fontSize: '10px', fontFamily: 'Space Grotesk, sans-serif', fill: '#7C4DFF' }}>
            {formatMoneyLabel(tick)}
          </text>
        ))}

        {/* Axis indicator labels */}
        {hasCount && (
          <text x={pad.left - 8} y={pad.top - 8} textAnchor="end"
                style={{ fontSize: '9px', fontFamily: 'Space Grotesk, sans-serif', fill: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Cant.
          </text>
        )}
        {hasDual && (
          <text x={dims.w - pad.right + 8} y={pad.top - 8} textAnchor="start"
                style={{ fontSize: '9px', fontFamily: 'Space Grotesk, sans-serif', fill: '#7C4DFF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Monto
          </text>
        )}

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
          const scale = getScaleFor(metric)
          return (
            <g key={metric}>
              <path d={buildArea(data, metric)} fill={cfg.color || '#3460A8'} opacity={0.06} />
              <path d={buildPath(data, metric)} fill="none" 
                    stroke={cfg.color || '#3460A8'} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              {/* Data points */}
              {data.map((d, i) => (
                <circle key={i} cx={getX(i)} cy={getY(d[metric] ?? 0, scale)} r={hoverIdx === i ? 5 : 3}
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
               minWidth: 150,
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

function formatMoneyLabel(val) {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`
  return `$${val}`
}
