import { TrendingUp, Clock, FileCheck, Trash2, AlertCircle, Eye, EyeOff, Activity } from 'lucide-react'
import { useState } from 'react'
import { filterVentasByTimeframe } from '../utils/dateUtils'

export default function StatsCards({ ventas, onCardClick }) {
  const [timeframe, setTimeframe] = useState('all') // 'all', 'day', 'week', 'month'
  const [showValues, setShowValues] = useState(true)

  const filteredVentas = filterVentasByTimeframe(ventas, timeframe)
  const activas = filteredVentas.filter(v => v.status !== 'borrada')
  
  const facturadas = activas.filter(v => v.status === 'facturado')
  const conError = activas.filter(v => v.status === 'error')
  const pendientes = activas.filter(v => v.status === 'pendiente' || v.status === 'procesando')
  const borradas = filteredVentas.filter(v => v.status === 'borrada')

  const totalActivasAmount = activas.reduce((s, v) => s + (Number(v.monto) || 0), 0)
  const facturadasAmount = facturadas.reduce((s, v) => s + (Number(v.monto) || 0), 0)
  const pendientesAmount = pendientes.reduce((s, v) => s + (Number(v.monto) || 0), 0)
  const conErrorAmount = conError.reduce((s, v) => s + (Number(v.monto) || 0), 0)

  const handleToggleValues = (e) => {
    e.stopPropagation()
    setShowValues(!showValues)
  }

  const renderMoney = (amount) => {
    return showValues ? formatCurrency(amount) : '$ ***.***'
  }

  return (
    <div className="space-y-4">
      {/* Top Bar with Title & Filter */}
      <div className="flex items-center justify-between lg:justify-start gap-4">
        <h2 className="text-xl font-bold text-text-primary uppercase tracking-tight">
            Resumen
        </h2>
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg pl-3 pr-2 py-1 focus-within:border-accent transition-colors">
          <select 
            className="text-sm text-text-primary bg-transparent focus:outline-none cursor-pointer pr-4"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
          >
            <option value="all">Histórico (Todo)</option>
            <option value="day">Hoy</option>
            <option value="week">Esta Semana</option>
            <option value="month">Este Mes</option>
          </select>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[220px]">
        
        {/* 1. FACTURADO (Hero Card) - Takes 8 columns */}
        <button
          onClick={() => onCardClick('Facturadas', facturadas, timeframe)}
          className="lg:col-span-8 relative bg-white border border-border rounded-2xl p-6 flex flex-col justify-center items-center text-center transition-all duration-300 hover:border-green hover:shadow-sm outline-none group cursor-pointer overflow-hidden"
        >
          {/* Decorative Waves (Subtle) */}
          <div className="absolute left-8 bottom-6 w-24 h-12 opacity-10 pointer-events-none hidden md:block">
            <svg viewBox="0 0 100 50" className="w-full h-full stroke-green fill-green/20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M0,50 L20,50 L30,10 L40,50 L50,50 L60,10 L70,50 L100,50" />
            </svg>
          </div>
          <div className="absolute right-8 bottom-6 w-24 h-12 opacity-10 pointer-events-none hidden md:block">
            <svg viewBox="0 0 100 50" className="w-full h-full stroke-green fill-green/20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M0,50 L20,50 L30,10 L40,50 L50,50 L60,10 L70,50 L100,50" />
            </svg>
          </div>

          <button 
            onClick={handleToggleValues}
            className="absolute top-4 right-4 text-text-muted/60 hover:text-text-primary transition-colors p-2 rounded-full hover:bg-surface-alt z-10 cursor-pointer"
          >
            {showValues ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          
          <div className="bg-green/10 w-10 h-10 flex items-center justify-center rounded-full mb-3 group-hover:scale-110 transition-transform">
            <TrendingUp size={18} className="text-green" />
          </div>
          
          <h3 className="font-bold uppercase tracking-[0.1em] text-[12px] text-text-primary/90 mb-1">
            Facturado y Cobrado
          </h3>
          
          <div className="font-black text-4xl lg:text-5xl tracking-tighter text-text-primary mb-3 transition-all">
            {renderMoney(facturadasAmount)}
          </div>
          
          <div className="font-semibold text-[10px] text-green bg-green-subtle px-3 py-1 rounded-full uppercase tracking-wider">
            {facturadas.length} {facturadas.length === 1 ? 'factura exitosa' : 'facturas exitosas'}
          </div>
        </button>

        {/* 2. STACK OF 3 MINI CARDS - Takes 4 columns */}
        <div className="lg:col-span-4 flex flex-col gap-3 h-[220px]">
          
          {/* Total Ventas */}
          <button
            onClick={() => onCardClick('Total Ventas', activas, timeframe)}
            className="flex-1 bg-white border border-border rounded-xl px-4 py-2 flex flex-col items-center justify-center text-center transition-all duration-300 hover:shadow-sm hover:border-blue outline-none cursor-pointer group"
          >
            <div className="font-bold uppercase text-[9px] text-text-muted tracking-widest mb-1">Total Movimientos</div>
            <div className="flex items-center gap-2 mb-0.5">
               <Activity size={15} className="text-blue" />
               <div className="font-bold text-[19px] text-text-primary tracking-tighter">{renderMoney(totalActivasAmount)}</div>
            </div>
            <div className="font-medium text-[10px] text-text-secondary opacity-70">{activas.length} op. registradas</div>
          </button>

          {/* Pendientes */}
          <button
            onClick={() => onCardClick('Pendientes', pendientes, timeframe)}
            className="flex-1 bg-white border border-border rounded-xl px-4 py-2 flex flex-col items-center justify-center text-center transition-all duration-300 hover:shadow-sm hover:border-amber-400 outline-none cursor-pointer group"
          >
            <div className="font-bold uppercase text-[9px] text-text-muted tracking-widest mb-1">Pendiente de Cobro</div>
            <div className="flex items-center gap-2 mb-0.5">
               <Clock size={15} className="text-amber-500" />
               <div className="font-bold text-[19px] text-text-primary tracking-tighter">{renderMoney(pendientesAmount)}</div>
            </div>
            <div className="font-medium text-[10px] text-text-secondary opacity-70">{pendientes.length} facturas</div>
          </button>

          {/* Con Error */}
          <button
            onClick={() => onCardClick('Con Error', conError, timeframe)}
            className="flex-1 bg-white border border-border rounded-xl px-4 py-2 flex flex-col items-center justify-center text-center transition-all duration-300 hover:shadow-sm hover:border-red outline-none cursor-pointer group"
          >
            <div className="font-bold uppercase text-[9px] text-text-muted tracking-widest mb-1">Errores AFIP</div>
            <div className="flex items-center gap-2 mb-0.5">
               <AlertCircle size={15} className="text-red" />
               <div className="font-bold text-[19px] text-text-primary tracking-tighter text-red">{renderMoney(conErrorAmount)}</div>
            </div>
            <div className="font-medium text-[10px] text-red opacity-80">{conError.length} reintentos</div>
          </button>
        </div>

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
