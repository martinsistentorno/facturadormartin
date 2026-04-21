import { TrendingUp, Clock, FileCheck, Trash2, AlertCircle, Eye, EyeOff } from 'lucide-react'
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

  const totalAmount = activas.reduce((s, v) => s + (Number(v.monto) || 0), 0)

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

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[220px]">
        
        {/* 1. TOTAL VENTAS (Hero Card) - Takes 5 columns */}
        <button
          onClick={() => onCardClick('Total Ventas', activas, timeframe)}
          className="lg:col-span-5 relative bg-white border border-border rounded-2xl p-6 flex flex-col justify-center items-center text-center transition-all duration-300 hover:shadow-[0_8px_20px_-10px_rgba(0,0,0,0.1)] hover:-translate-y-1 outline-none group cursor-pointer"
        >
          <button 
            onClick={handleToggleValues}
            className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors p-2 rounded-full hover:bg-surface-alt z-10 cursor-pointer"
          >
            {showValues ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          
          <div className="bg-green/10 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
            <TrendingUp size={24} className="text-green" />
          </div>
          
          <h3 className="font-bold uppercase tracking-widest text-[11px] text-text-muted mb-1">
            Total Ventas
          </h3>
          
          <div className="font-black text-4xl lg:text-5xl tracking-tighter text-text-primary mb-2 transition-all">
            {renderMoney(totalAmount)}
          </div>
          
          <div className="font-semibold text-xs text-green bg-green-subtle px-3 py-1 rounded-full">
            {activas.length} operaciones exitosas
          </div>
        </button>

        {/* 2. STACK OF 3 MINI CARDS - Takes 4 columns */}
        <div className="lg:col-span-4 flex flex-col gap-3 h-[220px]">
          {/* Pendientes */}
          <button
            onClick={() => onCardClick('Pendientes', pendientes, timeframe)}
            className="flex-1 bg-white border border-border rounded-xl px-4 flex items-center justify-between transition-all duration-300 hover:shadow-sm hover:border-yellow outline-none cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="bg-yellow/20 p-2 rounded-lg">
                <Clock size={16} className="text-amber-500" />
              </div>
              <div className="text-left">
                <div className="font-bold uppercase text-[10px] text-text-muted tracking-wider">Pendientes</div>
                <div className="font-bold text-sm text-text-primary">{pendientes.length} fact.</div>
              </div>
            </div>
            <div className="font-bold text-text-primary text-right">
              {renderMoney(pendientes.reduce((s, v) => s + (Number(v.monto) || 0), 0))}
            </div>
          </button>

          {/* Facturadas */}
          <button
            onClick={() => onCardClick('Facturadas', facturadas, timeframe)}
            className="flex-1 bg-white border border-border rounded-xl px-4 flex items-center justify-between transition-all duration-300 hover:shadow-sm hover:border-blue outline-none cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="bg-blue/10 p-2 rounded-lg">
                <FileCheck size={16} className="text-blue" />
              </div>
              <div className="text-left">
                <div className="font-bold uppercase text-[10px] text-text-muted tracking-wider">Facturadas</div>
                <div className="font-bold text-sm text-text-primary">{facturadas.length} fact.</div>
              </div>
            </div>
            <div className="font-bold text-text-primary text-right">
              {renderMoney(facturadas.reduce((s, v) => s + (Number(v.monto) || 0), 0))}
            </div>
          </button>

          {/* Con Error */}
          <button
            onClick={() => onCardClick('Con Error', conError, timeframe)}
            className="flex-1 bg-white border border-border rounded-xl px-4 flex items-center justify-between transition-all duration-300 hover:shadow-sm hover:border-red outline-none cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="bg-red/10 p-2 rounded-lg">
                <AlertCircle size={16} className="text-red" />
              </div>
              <div className="text-left">
                <div className="font-bold uppercase text-[10px] text-text-muted tracking-wider">Con Error AFIP</div>
                <div className="font-bold text-sm text-red">{conError.length} reintentos</div>
              </div>
            </div>
            <div className="font-bold text-red text-right">
               {renderMoney(conError.reduce((s, v) => s + (Number(v.monto) || 0), 0))}
            </div>
          </button>
        </div>

        {/* 3. PAPELERA DE RECICLAJE - Takes 3 columns */}
        <button
          onClick={() => onCardClick('Papelera', borradas, timeframe)}
          className="lg:col-span-3 bg-surface-alt border border-dashed border-border rounded-2xl p-6 flex flex-col justify-center items-center text-center transition-all duration-300 hover:bg-white hover:border-red hover:shadow-sm outline-none cursor-pointer group"
        >
          <div className="bg-text-muted/10 p-4 rounded-full mb-3 group-hover:bg-red/10 transition-colors">
            <Trash2 size={24} className="text-text-muted group-hover:text-red transition-colors" />
          </div>
          <h3 className="font-bold uppercase tracking-widest text-[11px] text-text-primary mb-1">
            Papelera
          </h3>
          <div className="font-bold text-2xl text-text-muted group-hover:text-red transition-colors mb-2">
            {borradas.length}
          </div>
          <p className="text-[10px] text-text-muted px-2">
            Ver ventas borradas. Podés restaurarlas o eliminarlas definitivamente.
          </p>
        </button>

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
