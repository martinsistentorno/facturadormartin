import StatusBadge from './StatusBadge'
import { AlertCircle, Edit2, FileDown, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { generateInvoicePdf } from '../utils/invoicePdf'
import { useState } from 'react'
import { useConfig } from '../context/ConfigContext'

const PAGE_SIZES = [25, 50, 100]

const OrigenBadge = ({ origen, mpId }) => {
  const isOrder = mpId?.startsWith('order-');
  const isMeLi = origen?.includes('mercadolibre') || isOrder;
  const isManual = origen === 'manual' || (!origen && !mpId);

  if (isMeLi) {
    return <span className="text-[#A68900] font-medium text-xs">Mercado Libre</span>
  } else if (isManual) {
    return <span className="text-text-muted font-medium text-xs">Manual</span>
  } else {
    // Default to Mercado Pago if mpId exists and it's not MeLi
    return <span className="text-[#009EE3] font-medium text-xs">Mercado Pago</span>
  }
}

const PaymentBadge = ({ method }) => {
  if (!method) return <span className="text-text-muted text-xs">—</span>;
  let bg = 'bg-surface-alt/50';
  let text = 'text-text-secondary';
  let label = method;

  if (method?.includes('Efectivo') || method?.includes('Contado')) {
    bg = 'bg-accent/10';
    text = 'text-accent';
    label = 'Efectivo';
  } else if (method?.includes('Transferencia')) {
    bg = 'bg-[#7C4DFF]/10';
    text = 'text-[#7C4DFF]';
    label = 'Transferencia';
  } else if (method?.includes('Tarjeta')) {
    bg = 'bg-[#E8A34A]/10';
    text = 'text-[#9A641A]';
    label = 'Tarjeta';
  } else if (method?.includes('account_money') || method?.includes('Mercado Pago')) {
    bg = 'bg-[#009EE3]/10';
    text = 'text-[#009EE3]';
    label = 'Dinero en Cuenta';
  }

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide ${bg} ${text} truncate max-w-[140px]`} title={method}>
      {label}
    </span>
  )
}

export default function SalesTable({ ventas, selectedIds, onToggleSelect, onToggleAll, loading, onShowError, onEdit, onRowClick, onRetry }) {
  const { emisor } = useConfig()
  const [sortKey, setSortKey] = useState('fecha')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  // ─── Sorting ───
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'fecha' ? 'desc' : 'asc')
    }
    setPage(0)
  }

  const sortedVentas = [...ventas].sort((a, b) => {
    let valA, valB
    switch (sortKey) {
      case 'fecha':
        valA = new Date(a.fecha || 0).getTime()
        valB = new Date(b.fecha || 0).getTime()
        break
      case 'cliente':
        valA = (a.cliente || '').toLowerCase()
        valB = (b.cliente || '').toLowerCase()
        break
      case 'monto':
        valA = Number(a.monto) || 0
        valB = Number(b.monto) || 0
        break
      case 'status':
        valA = a.status || ''
        valB = b.status || ''
        break
      case 'factura':
        valA = a.nro_comprobante || ''
        valB = b.nro_comprobante || ''
        break
      case 'cae':
        valA = a.cae || ''
        valB = b.cae || ''
        break
      case 'medio':
        valA = a.datos_fiscales?.forma_pago || ''
        valB = b.datos_fiscales?.forma_pago || ''
        break
      default:
        return 0
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1
    if (valA > valB) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  // ─── Pagination ───
  const totalPages = Math.ceil(sortedVentas.length / pageSize)
  const pagedVentas = sortedVentas.slice(page * pageSize, (page + 1) * pageSize)
  const startIndex = page * pageSize + 1
  const endIndex = Math.min((page + 1) * pageSize, sortedVentas.length)

  const allSelected = ventas.length > 0 && selectedIds.size === ventas.length

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(Number(amount) || 0)
  }

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="p-12 text-center">
          <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-text-muted text-sm">Cargando ventas...</p>
        </div>
      </div>
    )
  }

  if (!ventas.length) {
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="p-12 text-center">
          <div className="text-4xl mb-3 opacity-30">📋</div>
          <p className="text-text-secondary text-sm font-medium">No hay ventas que coincidan</p>
          <p className="text-text-muted text-xs mt-1">Probá ajustando los filtros o agregando una venta manual</p>
        </div>
      </div>
    )
  }

  const handleRowClick = (venta) => {
    onToggleSelect(venta.id)
  }

  // ─── Sort header helper ───
  const SortHeader = ({ label, sortField, align }) => (
    <th
      className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'} text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer select-none hover:text-accent transition-colors group`}
      onClick={() => handleSort(sortField)}
    >
      <div className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        <span className={`transition-opacity ${sortKey === sortField ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
          {sortKey === sortField && sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </div>
    </th>
  )

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-12 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="w-4 h-4 rounded border-border bg-surface-alt accent-accent cursor-pointer"
                  id="select-all-checkbox"
                />
              </th>
              <SortHeader label="Fecha" sortField="fecha" />
              <SortHeader label="Cliente" sortField="cliente" />
              <SortHeader label="Monto" sortField="monto" align="right" />
              <SortHeader label="Origen" sortField="origen" />
              <SortHeader label="Medio" sortField="medio" />
              <SortHeader label="Status" sortField="status" />
              <SortHeader label="Factura" sortField="factura" />
              <SortHeader label="CAE" sortField="cae" />
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {pagedVentas.map((venta, i) => {
              const isSelected = selectedIds.has(venta.id)
              const isError = venta.status === 'error'
              return (
                <tr
                  key={venta.id}
                  onClick={() => handleRowClick(venta)}
                  className={`
                    border-b border-border transition-colors duration-150 cursor-pointer
                    ${isError ? 'bg-red-subtle/20 hover:bg-red-subtle/40' : ''}
                    hover:bg-surface-alt hover:opacity-90
                    ${isSelected ? 'bg-[#EAE4D3]' : ''}
                  `}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(venta.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-border bg-surface-alt accent-accent cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-text-primary font-medium">{formatDate(venta.fecha)}</div>
                    <div className="text-text-muted text-xs">{formatTime(venta.fecha)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-text-primary">{venta.cliente || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-text-primary font-semibold tabular-nums">{formatCurrency(venta.monto)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <OrigenBadge origen={venta.datos_fiscales?.origen} mpId={venta.mp_payment_id} />
                  </td>
                  <td className="px-4 py-3">
                    <PaymentBadge method={venta.datos_fiscales?.forma_pago} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={venta.status} />
                      {isError && venta.datos_fiscales?.error_detalle && (
                        <div className="relative group">
                          <button
                            onClick={(e) => { e.stopPropagation(); onShowError(venta.datos_fiscales.error_detalle) }}
                            className="text-red hover:text-red-400 transition-colors p-1"
                            title="Ver motivo de rechazo"
                          >
                            <AlertCircle size={15} />
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                            <div className="bg-text-primary text-white text-xs rounded-lg px-3 py-2 max-w-[250px] shadow-lg whitespace-normal">
                              {venta.datos_fiscales.error_detalle}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-text-primary" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-text-primary text-xs font-mono whitespace-nowrap">
                      {venta.nro_comprobante || <span className="text-text-muted">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {venta.cae ? (
                      <div>
                        <div className="text-text-primary text-xs font-mono">{venta.cae}</div>
                        {venta.vto_cae && (
                          <div className="text-text-muted text-xs">Vto: {formatDate(venta.vto_cae)}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {venta.status === 'pendiente' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onEdit(venta) }}
                          className="p-2 text-text-muted hover:text-blue hover:bg-blue/10 rounded-lg transition-all cursor-pointer"
                          title="Editar datos fiscales"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      {isError && onRetry && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRetry(venta.id) }}
                          className="p-2 text-text-muted hover:text-yellow hover:bg-yellow-subtle rounded-lg transition-all cursor-pointer"
                          title="Reintentar facturación"
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}
                      {venta.status === 'facturado' && venta.cae && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (venta.pdf_url) {
                              try {
                                const check = await fetch(venta.pdf_url, { method: 'HEAD' });
                                if (check.ok) {
                                  window.open(venta.pdf_url, '_blank');
                                  return;
                                }
                              } catch (_) { /* expired */ }
                            }
                            generateInvoicePdf(venta, emisor);
                          }}
                          className="p-2 text-text-muted hover:text-green hover:bg-green/10 rounded-lg transition-all cursor-pointer"
                          title="Descargar PDF"
                        >
                          <FileDown size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Pagination bar (Gmail style) ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-alt/50">
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted" style={{ fontFamily: 'Inter' }}>
            Filas por página:
          </span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}
            className="bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text-primary cursor-pointer focus:outline-none focus:border-accent"
          >
            {PAGE_SIZES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-text-muted tabular-nums" style={{ fontFamily: 'Inter' }}>
            {startIndex}–{endIndex} de {sortedVentas.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
