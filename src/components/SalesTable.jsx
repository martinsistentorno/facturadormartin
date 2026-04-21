import StatusBadge from './StatusBadge'
import { AlertCircle, Edit2, FileDown, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Save, Loader2, X, Settings2, Check } from 'lucide-react'
import { generateInvoicePdf } from '../utils/invoicePdf'
import { useState, Fragment, useEffect, useRef } from 'react'
import { useConfig } from '../context/ConfigContext'

const PAGE_SIZES = [25, 50, 100]

const FORMAS_PAGO = [
  'Contado - Efectivo',
  'Transferencia Bancaria',
  'Tarjeta de Débito',
  'Tarjeta de Crédito',
  'Mercado Pago',
  'Otro',
];

const COLUMN_CONFIG = [
  { id: 'fecha', label: 'Fecha', default: true },
  { id: 'cliente', label: 'Cliente', default: true },
  { id: 'cuit', label: 'CUIT / DNI', default: false },
  { id: 'monto', label: 'Monto', default: true, align: 'right' },
  { id: 'iva', label: 'Cond. IVA', default: false },
  { id: 'descripcion', label: 'Descripción', default: false },
  { id: 'origen', label: 'Origen', default: true },
  { id: 'medio', label: 'Medio', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'factura', label: 'Factura', default: true },
  { id: 'cae', label: 'CAE', default: true },
];

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
  } else if (method?.includes('account_money') || method?.includes('Mercado Pago') || method === 'Dinero en Cuenta') {
    bg = 'bg-[#009EE3]/10';
    text = 'text-[#009EE3]';
    label = 'Dinero en Cuenta';
  } else if (method?.includes('customer_credits') || method === 'Crédito MP') {
    bg = 'bg-green-subtle';
    text = 'text-green';
    label = 'Crédito MP';
  } else if (method?.includes('digital_currency') || method === 'Cripto / Digital') {
    bg = 'bg-purple-subtle';
    text = 'text-purple';
    label = 'Cripto / Digital';
  }

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide ${bg} ${text} truncate max-w-[140px]`} title={method}>
      {label}
    </span>
  )
}

export default function SalesTable({ ventas, selectedIds, onToggleSelect, onToggleAll, loading, onShowError, onEdit, onRowClick, onRetry, onSaveEdit }) {
  const { emisor } = useConfig()
  const [sortKey, setSortKey] = useState('fecha')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [lookingUpAFIP, setLookingUpAFIP] = useState(false)
  const [confirmingEdit, setConfirmingEdit] = useState(false)

  // ─── Column visibility state ───
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('salesTableVisibleColumns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return COLUMN_CONFIG.filter(c => c.default).map(c => c.id);
      }
    }
    return COLUMN_CONFIG.filter(c => c.default).map(c => c.id);
  });

  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('salesTableVisibleColumns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowColumnPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (columnId) => {
    setVisibleColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId) 
        : [...prev, columnId]
    );
  };

  const isVisible = (columnId) => visibleColumns.includes(columnId);

  const handleStartEdit = (e, venta) => {
    e.stopPropagation();
    if (editingId === venta.id) {
       setEditingId(null);
       setConfirmingEdit(false);
    } else {
       setEditingId(venta.id);
       setConfirmingEdit(false);
       setEditForm({
         cliente: venta.cliente || '',
         cuit: venta.datos_fiscales?.cuit || '',
         condicionIva: venta.datos_fiscales?.condicion_iva || (venta.datos_fiscales?.cuit?.length === 11 ? 'Responsable Inscripto' : 'Consumidor Final'),
         descripcion: venta.datos_fiscales?.descripcion || 'Varios',
         monto: venta.monto || '',
         formaPago: venta.datos_fiscales?.forma_pago || 'Contado - Efectivo',
       });
    }
  }

  const handleCuitBlur = async () => {
    const val = editForm.cuit?.replace(/\D/g, '');
    if (!val || val.length < 8) return;

    setLookingUpAFIP(true);
    try {
      const res = await fetch(`/api/lookup-cuit?cuit=${val}`);
      if (res.ok) {
        const data = await res.json();
        if (data.razonSocial && data.razonSocial.razonSocial) {
           setEditForm(prev => ({
              ...prev,
              cliente: data.razonSocial.razonSocial,
              condicionIva: data.razonSocial.condicion_iva || (val.length === 11 ? 'Responsable Inscripto' : 'Consumidor Final'),
              cuit: val
           }));
        }
      }
    } catch(err) {
      console.error('Error fetching CUIT', err);
    } finally {
      setLookingUpAFIP(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!onSaveEdit) return;

    const ventaOrig = ventas.find(v => v.id === editingId);
    if (!ventaOrig) return;

    // Extra safety check for changes
    const hasChanges = (
      editForm.cliente !== (ventaOrig.cliente || '') ||
      parseFloat(editForm.monto || 0) !== parseFloat(ventaOrig.monto || 0) ||
      editForm.cuit !== (ventaOrig.datos_fiscales?.cuit || '') ||
      editForm.condicionIva !== (ventaOrig.datos_fiscales?.condicion_iva || (ventaOrig.datos_fiscales?.cuit?.length === 11 ? 'Responsable Inscripto' : 'Consumidor Final')) ||
      editForm.descripcion !== (ventaOrig.datos_fiscales?.descripcion || 'Varios') ||
      editForm.formaPago !== (ventaOrig.datos_fiscales?.forma_pago || 'Contado - Efectivo')
    );

    if (!hasChanges) {
       setEditingId(null);
       return;
    }

    const origenVal = ventaOrig.datos_fiscales?.origen?.toLowerCase();
    const isManual = origenVal === 'manual' || (!origenVal && !ventaOrig.mp_payment_id);

    if (!isManual && !confirmingEdit) {
       setConfirmingEdit(true);
       return;
    }

    setSavingEdit(true);
    try {
       await onSaveEdit(editingId, {
          cliente: editForm.cliente,
          monto: parseFloat(editForm.monto),
          datos_fiscales: {
             ...ventaOrig?.datos_fiscales,
             cuit: editForm.cuit,
             condicion_iva: editForm.condicionIva,
             descripcion: editForm.descripcion,
             forma_pago: editForm.formaPago
          }
       });
       setEditingId(null);
       setConfirmingEdit(false);
    } catch (err) {
       onShowError('Error al guardar: ' + err.message);
    } finally {
       setSavingEdit(false);
    }
  }

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
      case 'origen':
        valA = a.datos_fiscales?.origen || ''
        valB = b.datos_fiscales?.origen || ''
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
    <div className="bg-surface border border-border rounded-xl overflow-hidden animate-fade-in relative">
      
      {/* Table Toolbar / Column Picker */}
      <div className="flex items-center justify-end px-4 py-2 bg-surface-alt/30 border-b border-border gap-2 relative">
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer
              shadow-sm
              ${showColumnPicker 
                ? 'bg-[#121212] text-white border-black shadow-lg shadow-black/10' 
                : 'bg-white border-border text-text-muted hover:text-text-primary hover:border-black/20 hover:shadow-md'
              }
            `}
          >
            <Settings2 size={12} />
            Mostrar
          </button>

          {showColumnPicker && (
            <div className="absolute right-0 mt-3 w-64 bg-white border border-border rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-50 py-4 animate-slide-down">
              <div className="px-5 pb-3 mb-2 border-b border-border/50">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-primary opacity-60">
                  Configurar Tabla
                </span>
              </div>
              <div className="max-h-[300px] overflow-y-auto px-2 space-y-1">
                {COLUMN_CONFIG.map(col => (
                  <button
                    key={col.id}
                    onClick={() => toggleColumn(col.id)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-[11px] font-semibold
                      ${isVisible(col.id) 
                        ? 'bg-accent/5 text-accent' 
                        : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
                      }
                    `}
                  >
                    <span>{col.label}</span>
                    {isVisible(col.id) && <Check size={14} className="text-accent" />}
                  </button>
                ))}
              </div>
              <div className="px-5 pt-3 mt-2 border-t border-border/50">
                <p className="text-[9px] text-text-muted italic leading-relaxed">Las preferencias se guardan para tu próxima sesión.</p>
              </div>
            </div>
          )}
        </div>
      </div>

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
              {isVisible('fecha') && <SortHeader label="Fecha" sortField="fecha" />}
              {isVisible('cliente') && <SortHeader label="Cliente" sortField="cliente" />}
              {isVisible('cuit') && <SortHeader label="CUIT / DNI" sortField="cuit" />}
              {isVisible('monto') && <SortHeader label="Monto" sortField="monto" align="right" />}
              {isVisible('iva') && <SortHeader label="Cond. IVA" sortField="iva" />}
              {isVisible('descripcion') && <SortHeader label="Descripción" sortField="descripcion" />}
              {isVisible('origen') && <SortHeader label="Origen" sortField="origen" />}
              {isVisible('medio') && <SortHeader label="Medio" sortField="medio" />}
              {isVisible('status') && <SortHeader label="Status" sortField="status" />}
              {isVisible('factura') && <SortHeader label="Factura" sortField="factura" />}
              {isVisible('cae') && <SortHeader label="CAE" sortField="cae" />}
              <th className="px-4 py-3 text-right bg-surface-alt/30"></th>
            </tr>
          </thead>
          <tbody>
            {pagedVentas.map((venta, i) => {
              const isSelected = selectedIds.has(venta.id)
              const isError = venta.status === 'error'
              const isEditing = editingId === venta.id
              const origenVal = venta.datos_fiscales?.origen?.toLowerCase()
              const isManual = origenVal === 'manual' || (!origenVal && !venta.mp_payment_id)

              // Check for changes
              const hasChanges = isEditing && (
                editForm.cliente !== (venta.cliente || '') ||
                parseFloat(editForm.monto || 0) !== parseFloat(venta.monto || 0) ||
                editForm.cuit !== (venta.datos_fiscales?.cuit || '') ||
                editForm.condicionIva !== (venta.datos_fiscales?.condicion_iva || (venta.datos_fiscales?.cuit?.length === 11 ? 'Responsable Inscripto' : 'Consumidor Final')) ||
                editForm.descripcion !== (venta.datos_fiscales?.descripcion || 'Varios') ||
                editForm.formaPago !== (venta.datos_fiscales?.forma_pago || 'Contado - Efectivo')
              )

              return (
                <Fragment key={venta.id}>
                <tr
                  onClick={() => handleRowClick(venta)}
                  className={`
                    transition-all duration-150 cursor-pointer
                    ${isEditing ? 'border-b-0 bg-white shadow-sm relative z-10 font-medium' : 'border-b border-border hover:bg-white/60'}
                    ${isError && !isEditing ? 'bg-[#C0443C]/5 hover:bg-[#C0443C]/10' : ''}
                    ${isSelected && !isEditing ? 'bg-[#3460A8]/8 border-l-2 border-l-[#3460A8]' : ''}
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
                  {isVisible('fecha') && (
                    <td className="px-4 py-3">
                      <div className="text-text-primary font-medium">{formatDate(venta.fecha)}</div>
                      <div className="text-text-muted text-xs">{formatTime(venta.fecha)}</div>
                    </td>
                  )}
                  {isVisible('cliente') && (
                    <td className="px-4 py-3">
                      <div className="text-text-primary uppercase">{venta.cliente || '—'}</div>
                    </td>
                  )}
                  {isVisible('cuit') && (
                    <td className="px-4 py-3">
                      <div className="text-text-muted font-mono text-xs">{venta.datos_fiscales?.cuit || '—'}</div>
                    </td>
                  )}
                  {isVisible('monto') && (
                    <td className="px-4 py-3 text-right">
                      <span className="text-text-primary font-semibold tabular-nums">{formatCurrency(venta.monto)}</span>
                    </td>
                  )}
                  {isVisible('iva') && (
                    <td className="px-4 py-3">
                      <div className="text-text-secondary text-xs">{venta.datos_fiscales?.condicion_iva || '—'}</div>
                    </td>
                  )}
                  {isVisible('descripcion') && (
                    <td className="px-4 py-3">
                      <div className="text-text-secondary text-xs italic truncate max-w-[150px]" title={venta.datos_fiscales?.descripcion}>{venta.datos_fiscales?.descripcion || '—'}</div>
                    </td>
                  )}
                  {isVisible('origen') && (
                    <td className="px-4 py-3">
                      <OrigenBadge origen={venta.datos_fiscales?.origen} mpId={venta.mp_payment_id} />
                    </td>
                  )}
                  {isVisible('medio') && (
                    <td className="px-4 py-3">
                      <PaymentBadge method={venta.datos_fiscales?.forma_pago} />
                    </td>
                  )}
                  {isVisible('status') && (
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
                  )}
                  {isVisible('factura') && (
                    <td className="px-4 py-3">
                      <div className="text-text-primary text-xs font-mono whitespace-nowrap">
                        {venta.nro_comprobante || <span className="text-text-muted">—</span>}
                      </div>
                    </td>
                  )}
                  {isVisible('cae') && (
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
                  )}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {venta.status === 'pendiente' && (
                        <button
                          onClick={(e) => handleStartEdit(e, venta)}
                          className={`p-2 transition-all cursor-pointer rounded-lg ${isEditing ? 'bg-accent text-white hover:bg-accent/80' : 'text-text-muted hover:text-accent hover:bg-accent/5'}`}
                          title={isEditing ? "Cerrar edición" : "Editar datos"}
                        >
                          {isEditing ? <ChevronUp size={16} /> : <Edit2 size={16} />}
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

                {isEditing && (
                  <tr className="border-b border-border bg-surface-alt/10">
                    <td colSpan="12" className="p-0">
                      <div className="animate-fade-in pl-10 pr-6 py-8 border-l-[4px] border-accent shadow-[inset_0_20px_40px_-20px_rgba(0,0,0,0.05)] relative z-0">
                        <form onSubmit={submitEdit} className="grid grid-cols-6 gap-6 items-end">
                          <div className="col-span-2">
                             <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 opacity-60">Cliente / Nombre</label>
                             <input type="text" value={editForm.cliente} onChange={e => setEditForm({...editForm, cliente: e.target.value})} className="w-full bg-white border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all outline-none" />
                          </div>

                          <div className="col-span-1 relative">
                             <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 opacity-60">DNI / CUIT</label>
                             <input type="text" value={editForm.cuit} onChange={e => setEditForm({...editForm, cuit: e.target.value})} onBlur={handleCuitBlur} className="w-full bg-white border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all outline-none font-mono" />
                             {lookingUpAFIP && <Loader2 size={12} className="absolute right-3 top-[42px] animate-spin text-accent" />}
                          </div>

                          <div className="col-span-1">
                             <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 opacity-60">IVA</label>
                             <select value={editForm.condicionIva} onChange={e => setEditForm({...editForm, condicionIva: e.target.value})} className="w-full bg-white border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all outline-none appearance-none cursor-pointer">
                               <option>Consumidor Final</option>
                               <option>Responsable Inscripto</option>
                               <option>Monotributista</option>
                               <option>Exento</option>
                             </select>
                          </div>

                          <div className="col-span-2">
                             <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 opacity-60">Descripción Venta</label>
                             <input type="text" value={editForm.descripcion} onChange={e => setEditForm({...editForm, descripcion: e.target.value})} className="w-full bg-white border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all outline-none" />
                          </div>

                          <div className="col-span-3 relative">
                             <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 opacity-60">Monto a Procesar</label>
                             <div className="relative">
                               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold">$</span>
                               <input type="number" step="0.01" value={editForm.monto} onChange={e => setEditForm({...editForm, monto: e.target.value})} className="w-full bg-white border border-border rounded-xl pl-9 pr-4 py-4 text-xl font-bold text-text-primary focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all outline-none" required />
                             </div>
                          </div>

                          <div className="col-span-3">
                             <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 opacity-60">Forma de Pago</label>
                             <select value={editForm.formaPago} onChange={e => setEditForm({...editForm, formaPago: e.target.value})} className="w-full bg-white border border-border rounded-xl px-4 py-4 text-sm text-text-primary focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all outline-none appearance-none cursor-pointer">
                               {FORMAS_PAGO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                             </select>
                          </div>

                          <div className="col-span-6 flex flex-col md:flex-row gap-6 items-center justify-between mt-4 pt-6 border-t border-border/60 min-h-[60px]">
                            <div className="flex-1 w-full relative">
                               {confirmingEdit && (
                                 <div className="flex items-center gap-2 text-[11px] text-[#C0443C] leading-tight max-w-[420px] font-medium p-3 bg-[#C0443C]/5 border border-[#C0443C]/20 rounded-xl animate-fade-in mx-auto md:mx-0">
                                   <AlertCircle size={16} className="shrink-0" />
                                   <p><strong>Atención:</strong> Estás por alterar datos automáticos. Podría generar inconsistencias de conciliación. ¿Confirmás?</p>
                                 </div>
                               )}
                            </div>
                            
                            <div className="flex gap-3 min-w-[280px] w-full md:w-auto">
                               {confirmingEdit ? (
                                 <>
                                   <button type="button" onClick={() => setConfirmingEdit(false)} className="flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-bold text-text-muted hover:bg-surface-alt transition-all cursor-pointer uppercase tracking-widest">
                                     Volver
                                   </button>
                                   <button type="submit" disabled={savingEdit} className="flex-1 md:flex-none flex gap-2 items-center justify-center px-8 py-3 bg-[#C0443C] text-white rounded-xl text-xs font-black uppercase tracking-[0.15em] hover:-translate-y-1 hover:shadow-lg hover:shadow-accent/30 transition-all cursor-pointer animate-pulse-once">
                                     {savingEdit ? <Loader2 size={14} className="animate-spin" /> : null}
                                     CONFIRMAR
                                   </button>
                                 </>
                               ) : (
                                 <>
                                   <button type="button" onClick={() => setEditingId(null)} className="flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-bold text-text-muted hover:bg-surface-alt transition-all cursor-pointer uppercase tracking-widest">
                                     Cancelar
                                   </button>
                                   <button 
                                     type="submit" 
                                     disabled={savingEdit || !hasChanges} 
                                     className={`flex-1 md:flex-none flex gap-2 items-center justify-center px-8 py-3 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all cursor-pointer ${!hasChanges ? 'bg-text-muted/10 text-text-muted/50 cursor-not-allowed' : 'bg-text-primary text-white hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20'}`}
                                   >
                                     {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                     ACTUALIZAR
                                   </button>
                                 </>
                               )}
                            </div>
                          </div>
                        </form>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-alt/50">
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
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
          <span className="text-xs text-text-muted tabular-nums">
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
