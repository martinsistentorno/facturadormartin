import { TrendingUp, Clock, FileCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { filterVentasByTimeframe } from '../utils/dateUtils'

export default function StatsCards({ ventas, onCardClick }) {
  const [timeframe, setTimeframe] = useState('all') // 'all', 'day', 'week', 'month'

  const filteredVentas = filterVentasByTimeframe(ventas, timeframe)
  const activas = filteredVentas.filter(v => v.status !== 'borrada')
  const facturadas = activas.filter(v => v.status === 'facturado')
  const pendientes = activas.filter(v => v.status === 'pendiente' || v.status === 'procesando' || v.status === 'error')
  const borradas = filteredVentas.filter(v => v.status === 'borrada')

  const cards = [
    {
      id: 'total',
      label: 'Total Ventas',
      value: formatCurrency(activas.reduce((s, v) => s + (Number(v.monto) || 0), 0)),
      sub: `${activas.length} operaciones`,
      icon: TrendingUp,
      accent: 'text-[#2D8F5E]',
      accentBg: 'bg-[#2D8F5E]/10',
      ventas: activas
    },
    {
      id: 'pendientes',
      label: 'Pendientes',
      value: pendientes.length,
      sub: formatCurrency(pendientes.reduce((s, v) => s + (Number(v.monto) || 0), 0)),
      icon: Clock,
      accent: 'text-[#CC9F2F]',
      accentBg: 'bg-[#CC9F2F]/10',
      ventas: pendientes
    },
    {
      id: 'facturadas',
      label: 'Facturadas',
      value: facturadas.length,
      sub: formatCurrency(facturadas.reduce((s, v) => s + (Number(v.monto) || 0), 0)),
      icon: FileCheck,
      accent: 'text-[#2D8F5E]',
      accentBg: 'bg-[#2D8F5E]/10',
      ventas: facturadas
    },
    {
      id: 'borradas',
      label: 'Con Error',
      value: borradas.length,
      sub: borradas.length > 0 ? 'Ver detalles' : 'Sin errores',
      icon: Trash2,
      accent: 'text-[#C0443C]',
      accentBg: 'bg-[#C0443C]/10',
      ventas: borradas
    },
  ]

  return (
    <div className="space-y-4">
      {/* Selector de Rango */}
      <div className="flex items-center justify-start gap-4">
        <h2 className="text-xl font-bold text-text-primary uppercase tracking-tight">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card, i) => {
          const isHero = card.id === 'total'
          return (
            <button
              key={card.id}
              onClick={() => onCardClick(card.label, card.ventas, timeframe)}
              className={`
                text-left bg-white border border-border rounded-xl animate-slide-up hover:-translate-y-1 hover:shadow-[0_8px_20px_-10px_rgba(0,0,0,0.1)] transition-all duration-300 cursor-pointer block w-full outline-none focus:ring-4 focus:ring-accent/5 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]
                ${isHero ? 'lg:col-span-2' : 'lg:col-span-1'}
              `}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <span className="font-bold uppercase tracking-widest text-[11px] text-text-primary">
                  {card.label}
                </span>
                <div className={`rounded-xl p-2.5 transition-colors ${card.accentBg}`}>
                  <card.icon size={16} className={card.accent} />
                </div>
              </div>
              
              <div className={`font-bold tracking-tight mb-1 text-2xl ${card.accent}`}>
                {card.value}
              </div>
              
              <div className="font-medium text-[11px] text-text-muted mt-1">
                {card.sub}
              </div>
            </button>
          )
        })}
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
