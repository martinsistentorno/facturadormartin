import { useState } from 'react';
import { Search, Filter, X, Calendar, DollarSign } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'facturado', label: 'Facturado' },
  { value: 'error', label: 'Error' },
];

export default function FilterBar({ filters, onFilterChange, totalCount, filteredCount }) {
  const [expanded, setExpanded] = useState(false);

  const hasActiveFilters = filters.search || filters.status || filters.medio || filters.dateFrom || filters.dateTo || filters.montoMin || filters.montoMax;

  const update = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearAll = () => {
    onFilterChange({
      search: '',
      status: '',
      medio: '',
      dateFrom: '',
      dateTo: '',
      montoMin: '',
      montoMax: '',
    });
  };

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden animate-fade-in">
      {/* Main bar: search + toggle */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por cliente, CUIT, CAE, nro comprobante, monto..."
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-alt border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            style={{ fontFamily: 'Inter' }}
          />
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider
            border transition-all cursor-pointer
            ${expanded || hasActiveFilters
              ? 'bg-accent/10 border-accent/30 text-accent'
              : 'bg-surface-alt border-border text-text-secondary hover:border-accent/30'
            }
          `}
          style={{ fontFamily: 'Inter' }}
        >
          <Filter size={14} />
          Filtros
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-red-subtle border border-red/20 text-red hover:bg-red/10 transition-colors cursor-pointer"
            style={{ fontFamily: 'Inter' }}
          >
            <X size={14} />
            Limpiar
          </button>
        )}

        <span className="text-xs text-text-muted whitespace-nowrap hidden sm:block" style={{ fontFamily: 'Inter' }}>
          {hasActiveFilters ? `${filteredCount} de ${totalCount}` : `${totalCount} registros`}
        </span>
      </div>

      {/* Expanded filters */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border grid grid-cols-2 md:grid-cols-6 gap-3 animate-slide-down">
          {/* Estado */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5" style={{ fontFamily: 'Inter' }}>
              Estado
            </label>
            <select
              value={filters.status}
              onChange={(e) => update('status', e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Origen */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5" style={{ fontFamily: 'Inter' }}>
              Origen
            </label>
            <select
              value={filters.origen || ''}
              onChange={(e) => update('origen', e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="">Todos</option>
              <option value="mercadolibre">Mercado Libre</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          {/* Medio de Pago */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5" style={{ fontFamily: 'Inter' }}>
              Medio de Pago
            </label>
            <select
              value={filters.medio || ''}
              onChange={(e) => update('medio', e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="">Todos</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Tarjeta">Tarjeta (Cred/Deb)</option>
              <option value="Contado">Contado / Efectivo</option>
            </select>
          </div>

          {/* Fecha Desde */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5" style={{ fontFamily: 'Inter' }}>
              <Calendar size={10} className="inline mr-1" />Desde
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => update('dateFrom', e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          {/* Fecha Hasta */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5" style={{ fontFamily: 'Inter' }}>
              <Calendar size={10} className="inline mr-1" />Hasta
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => update('dateTo', e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          {/* Monto */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5" style={{ fontFamily: 'Inter' }}>
              <DollarSign size={10} className="inline mr-1" />Rango Monto
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Mín"
                value={filters.montoMin}
                onChange={(e) => update('montoMin', e.target.value)}
                className="w-1/2 bg-surface-alt border border-border rounded-lg px-2 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
              <input
                type="number"
                placeholder="Máx"
                value={filters.montoMax}
                onChange={(e) => update('montoMax', e.target.value)}
                className="w-1/2 bg-surface-alt border border-border rounded-lg px-2 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
