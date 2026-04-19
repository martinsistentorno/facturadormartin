import { TrendingUp, Clock, FileCheck, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { filterVentasByTimeframe } from '../utils/dateUtils'

export default function StatsCards({ ventas, onCardClick }) {
  const [timeframe, setTimeframe] = useState('all') // 'all', 'day', 'week', 'month'

  const filteredVentas = filterVentasByTimeframe(ventas, timeframe)

  const totalMonto = filteredVentas.reduce((sum, v) => sum + (Number(v.monto) || 0), 0)
  const pendientes = filteredVentas.filter(v => v.status === 'pendiente' || v.status === 'procesando')
  const facturadas = filteredVentas.filter(v => v.status === 'facturado')
  const errores = filteredVentas.filter(v => v.status === 'error')

  const cards = [
    {
      id: 'total',
      label: 'Total Ventas',
      value: formatCurrency(totalMonto),
      sub: `${filteredVentas.length} operaciones`,
      icon: TrendingUp,
      accent: 'text-green',
      accentBg: 'bg-green-subtle',
      ventas: filteredVentas
    },
    {
      id: 'pendientes',
      label: 'Pendientes',
      value: pendientes.length,
      sub: formatCurrency(pendientes.reduce((s, v) => s + (Number(v.monto) || 0), 0)),
      icon: Clock,
      accent: 'text-yellow',
      accentBg: 'bg-yellow-subtle',
      ventas: pendientes
    },
    {
      id: 'facturadas',
      label: 'Facturadas',
      value: facturadas.length,
      sub: formatCurrency(facturadas.reduce((s, v) => s + (Number(v.monto) || 0), 0)),
      icon: FileCheck,
      accent: 'text-green',
      accentBg: 'bg-green-subtle',
      ventas: facturadas
    },
    {
      id: 'errores',
      label: 'Con Error',
      value: errores.length,
      sub: errores.length > 0 ? 'Requieren atención' : 'Sin errores',
      icon: AlertTriangle,
      accent: 'text-red',
      accentBg: 'bg-red-subtle',
      ventas: errores
    },
  ]

  return (
    <div className="space-y-4">
      {/* Selector de Rango */}
      <div className="flex items-center justify-start gap-5">
        <h2 className="text-xl font-black text-text-secondary uppercase tracking-wider" style={{fontFamily: 'Montserrat'}}>
            Resumen
        </h2>
        <select 
          className="bg-surface border border-border rounded-lg text-sm text-text-primary px-3 py-1.5 focus:outline-none focus:border-accent cursor-pointer"
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
        >
          <option value="all">Histórico (Todo)</option>
          <option value="day">Hoy</option>
          <option value="week">Esta Semana</option>
          <option value="month">Este Mes</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <button
            key={card.id}
            onClick={() => onCardClick(card.label, card.ventas, timeframe)}
            className="text-left bg-surface border border-border rounded-xl p-5 animate-slide-up hover:-translate-y-1 hover:shadow-lg hover:border-border-subtle transition-all duration-200 cursor-pointer block w-full outline-none focus:ring-2 focus:ring-accent/50"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`p-2 rounded-lg ${card.accentBg}`}>
                <card.icon size={16} className={card.accent} />
              </div>
            </div>
            <div className={`text-2xl font-semibold mb-1 ${card.accent}`}>
              {card.value}
            </div>
            <div className="text-xs text-text-muted">{card.sub}</div>
          </button>
        ))}
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
