import StatusBadge from './StatusBadge'
import { LABEL_COLORS } from '../config/colors'
import { getEtiquetas, hasEtiqueta } from '../utils/labelHelpers'
import { AlertCircle, Edit2, FileDown, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Save, Loader2, X, Settings2, Check, Eye, FileText, Download, Archive, Tag, FolderInput, ChevronRight as ChevronRightSub, Trash2 } from 'lucide-react'
import { generateInvoicePdf } from '../utils/invoicePdf'
import { useState, Fragment, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useConfig } from '../context/ConfigContext'
import { translatePaymentMethod, getPaymentBadgeStyle } from '../utils/paymentMethods'
import { exportToExcel, exportToCSV } from '../utils/exportUtils'

const PAGE_SIZES = [25, 50, 100]

const FORMAS_PAGO = [
  'Contado - Efectivo',
  'Transferencia Bancaria',
  'Tarjeta de Débito',
  'Tarjeta de Crédito',
  'Mercado Pago',
  'Crédito MP',
  'Otro',
];

const COLUMN_CONFIG = [
  { id: 'fecha', label: 'Fecha', default: true },
  { id: 'cliente', label: 'Cliente', default: true },
  { id: 'cuit', label: 'CUIT / DNI', default: true },
  { id: 'monto', label: 'Monto', default: true, align: 'right' },
  { id: 'iva', label: 'Cond. IVA', default: false },
  { id: 'descripcion', label: 'Descripción', default: false },
  { id: 'origen', label: 'Origen', default: true },
  { id: 'medio', label: 'Medio', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'factura', label: 'Factura', default: true },
  { id: 'cae', label: 'CAE', default: true },
  { id: 'etiqueta', label: 'Etiqueta', default: true },
  { id: 'fecha_facturacion', label: 'Fch. Facturación', default: false },
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
    return <span className="text-[#009EE3] font-medium text-xs">Mercado Pago</span>
  }
}

const PaymentBadge = ({ method }) => {
  if (!method) return <span className="text-text-muted text-xs">—</span>;
  const { bg, text, label } = getPaymentBadgeStyle(method);
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide ${bg} ${text} truncate max-w-[140px]`} title={translatePaymentMethod(method)}>
      {label}
    </span>
  )
}

const EtiquetaBadge = ({ name, labels }) => {
  if (!name) return null;
  const label = labels.find(l => l.name === name);
  const colorObj = LABEL_COLORS.find(c => c.id === label?.colorId) || LABEL_COLORS[0];
  const color = colorObj.color;
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-alt border border-border/40 max-w-[120px] shrink-0">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[10px] font-bold text-text-primary truncate uppercase tracking-tighter">{name}</span>
    </div>
  )
}

const EtiquetasCellContent = ({ venta, labels }) => {
  const etiquetas = getEtiquetas(venta)
  if (etiquetas.length === 0) return null
  const visible = etiquetas.slice(0, 2)
  const overflow = etiquetas.length - 2
  return (
    <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
      {visible.map(name => <EtiquetaBadge key={name} name={name} labels={labels} />)}
      {overflow > 0 && (
        <span className="text-[9px] font-black text-text-muted bg-surface-alt border border-border/40 rounded-full px-1.5 py-0.5">+{overflow}</span>
      )}
    </div>
  )
}

const QuickCuitInput = ({ venta, onSaveEdit }) => {
  const [value, setValue] = useState(venta.datos_fiscales?.cuit || '')
  const [loading, setLoading] = useState(false)
  const isEditable = venta.status === 'pendiente' || venta.status === 'error'

  useEffect(() => {
    setValue(venta.datos_fiscales?.cuit || '')
  }, [venta.datos_fiscales?.cuit])

  if (!isEditable) {
    return <span className="text-text-muted font-mono text-xs">{venta.datos_fiscales?.cuit || '—'}</span>
  }

  const handleBlurOrEnter = async (val) => {
    const cleanCuit = (val || '').replace(/\D/g, '')
    const currentCuit = (venta.datos_fiscales?.cuit || '').replace(/\D/g, '')
    
    // Si no cambió el valor, no hacer nada
    if (cleanCuit === currentCuit) return

    // Si está vacío, se borra (es una edición válida)
    if (!cleanCuit) {
      onSaveEdit(venta.id, {
        datos_fiscales: {
          ...venta.datos_fiscales,
          cuit: '',
          doc_tipo: 'DNI'
        }
      })
      return
    }

    // Validar longitudes permitidas: DNI (7 u 8 dígitos) o CUIT (11 dígitos)
    const isValidLen = cleanCuit.length === 7 || cleanCuit.length === 8 || cleanCuit.length === 11
    if (!isValidLen) {
      // Si la longitud es inválida, restauramos el valor original y no guardamos basura
      setValue(venta.datos_fiscales?.cuit || '')
      return
    }

    // Si es DNI (7 u 8 dígitos)
    if (cleanCuit.length === 7 || cleanCuit.length === 8) {
      onSaveEdit(venta.id, {
        datos_fiscales: {
          ...venta.datos_fiscales,
          cuit: cleanCuit,
          doc_tipo: 'DNI'
        }
      })
      return
    }

    // Si es CUIT de 11 dígitos, consultamos AFIP
    if (cleanCuit.length === 11) {
      setLoading(true)
      console.log(`[QuickCuitInput] Consultando AFIP para CUIT: ${cleanCuit}`)
      try {
        const response = await fetch(`/api/lookup-cuit?cuit=${encodeURIComponent(cleanCuit)}`)
        const data = await response.json()
        console.log('[QuickCuitInput] Respuesta AFIP:', data)
        
        if (response.ok && data?.success && data?.razonSocial?.razonSocial) {
          const info = data.razonSocial
          const mappedCond = info.condicion_iva || 'Consumidor Final'
          console.log(`[QuickCuitInput] Guardando con AFIP OK: ${info.razonSocial} | ${mappedCond}`)
          
          onSaveEdit(venta.id, {
            cliente: info.razonSocial,
            datos_fiscales: {
              ...venta.datos_fiscales,
              cuit: cleanCuit,
              condicion_iva: mappedCond,
              doc_tipo: 'CUIT',
              domicilio: info.domicilio || venta.datos_fiscales?.domicilio || '',
            }
          })
        } else {
          console.log('[QuickCuitInput] CUIT no encontrado o error en respuesta de AFIP, guardando solo CUIT')
          onSaveEdit(venta.id, {
            datos_fiscales: {
              ...venta.datos_fiscales,
              cuit: cleanCuit,
              doc_tipo: 'CUIT'
            }
          })
        }
      } catch (err) {
        console.error('[QuickCuitInput] Error fetch inline AFIP', err)
        onSaveEdit(venta.id, {
          datos_fiscales: {
            ...venta.datos_fiscales,
            cuit: cleanCuit,
            doc_tipo: 'CUIT'
          }
        })
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="relative flex items-center max-w-[150px]">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => handleBlurOrEnter(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.target.blur()
          }
          if (e.key === 'Escape') {
            setValue(venta.datos_fiscales?.cuit || '')
            e.target.blur()
          }
        }}
        placeholder="Cargar CUIT/DNI..."
        disabled={loading}
        className="w-full px-2.5 py-1 text-xs font-mono font-medium rounded-xl border border-border bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/10 focus:border-accent disabled:opacity-50"
      />
      {loading && (
        <Loader2 size={12} className="absolute right-3.5 animate-spin text-accent" />
      )}
    </div>
  )
}

export default function SalesTable({ 
  ventas, 
  selectedIds, 
  onToggleSelect, 
  onToggleAll, 
  loading, 
  onShowError, 
  onRowClick, 
  onEdit, 
  onSaveEdit, 
  onRetry,
  onEmit,
  labels = [],
  customFolders = [],
  onBulkImport,
  onDelete,
  onArchive,
  onRestore,
  onHardDelete,
}) {
  const { emisor, isRI } = useConfig()
  const [sortKey, setSortKey] = useState('fecha')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef(null)

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

  // ─── Context Menu State ───
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, venta }
  const [ctxSub, setCtxSub] = useState(null); // 'labels' | 'folders' | null
  const longPressTimer = useRef(null);
  const ctxMenuRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false)
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowColumnPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const closeCtxMenu = useCallback(() => {
    setCtxMenu(null);
    setCtxSub(null);
  }, []);

  // Desktop: right-click
  const handleContextMenu = useCallback((e, venta) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, venta });
    setCtxSub(null);
  }, []);

  // Mobile: long press
  const handleTouchStart = useCallback((e, venta) => {
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      setCtxMenu({ x: touch.clientX, y: touch.clientY, venta });
      setCtxSub(null);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Context menu actions
  const handleCtxArchive = useCallback(() => {
    if (ctxMenu?.venta && onSaveEdit) {
      const isArchivada = ctxMenu.venta.archivada || ctxMenu.venta.status === 'archivada' || ctxMenu.venta.status === 'archivado';
      const newStatus = isArchivada && ctxMenu.venta.status === 'archivada' ? 'pendiente' : ctxMenu.venta.status;
      onSaveEdit(ctxMenu.venta.id, { archivada: !isArchivada, status: newStatus });
    }
    closeCtxMenu();
  }, [ctxMenu, onSaveEdit, closeCtxMenu]);

  const handleCtxLabel = useCallback((labelName) => {
    if (ctxMenu?.venta && onSaveEdit) {
      const current = getEtiquetas(ctxMenu.venta)
      let next
      if (labelName === '' || labelName === null) {
        next = []
      } else if (current.includes(labelName)) {
        next = current.filter(e => e !== labelName)
      } else {
        next = [...current, labelName]
      }
      onSaveEdit(ctxMenu.venta.id, { etiquetas: next, etiqueta: next[0] || '' });
    }
    closeCtxMenu();
  }, [ctxMenu, onSaveEdit, closeCtxMenu]);

  const handleCtxMove = useCallback((folderId) => {
    if (ctxMenu?.venta && onSaveEdit) {
      onSaveEdit(ctxMenu.venta.id, { folder: folderId });
    }
    closeCtxMenu();
  }, [ctxMenu, onSaveEdit, closeCtxMenu]);

  useEffect(() => {
    localStorage.setItem('salesTableVisibleColumns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Close pickers/menus on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowColumnPicker(false);
      }
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(event.target)) {
        closeCtxMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeCtxMenu]);

  const toggleColumn = (columnId) => {
    setVisibleColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId) 
        : [...prev, columnId]
    );
  };

  const isVisible = (columnId) => visibleColumns.includes(columnId);

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
      case 'etiqueta':
        valA = getEtiquetas(a).join(',') || ''
        valB = getEtiquetas(b).join(',') || ''
        break
      default:
        return 0
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1
    if (valA > valB) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  // ─── Agrupar "No leídos" primero (estilo correo) ───
  // El orden de columnas se respeta DENTRO de cada grupo. Solo cuando hay
  // al menos una no leída se muestran los encabezados de sección.
  const unreadCount = ventas.filter(v => v.leido === false).length
  const hasUnread = unreadCount > 0
  const groupedVentas = hasUnread
    ? [...sortedVentas.filter(v => v.leido === false), ...sortedVentas.filter(v => v.leido !== false)]
    : sortedVentas

  // ─── Pagination ───
  const totalPages = Math.ceil(groupedVentas.length / pageSize)
  const pagedVentas = groupedVentas.slice(page * pageSize, (page + 1) * pageSize)
  const startIndex = page * pageSize + 1
  const endIndex = Math.min((page + 1) * pageSize, groupedVentas.length)

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
      <div className="bg-transparent overflow-hidden">
        <div className="p-12 text-center">
          <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-text-muted text-sm">Cargando ventas...</p>
        </div>
      </div>
    )
  }

  if (!ventas.length) {
    return (
      <div className="bg-transparent overflow-hidden">
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
      className={`px-[clamp(0.4rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)] ${align === 'right' ? 'text-right' : 'text-left'} text-[clamp(10px,0.7vw,11px)] font-bold text-text-secondary uppercase tracking-wider cursor-pointer select-none hover:text-accent transition-colors group`}
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
    <div className="animate-fade-in relative space-y-4">
      
      {/* ─── Mobile Card View ─── */}
      <div className="md:hidden space-y-3 px-1">
        {(() => { let lastGroupM = null; return pagedVentas.map((venta) => {
          const isSelected = selectedIds.has(venta.id)
          const isError = venta.status === 'error'
          const isNC = [3, 8, 13, 113].includes(venta.datos_fiscales?.tipo_cbte)
          const groupM = venta.leido === false ? 'unread' : 'read'
          const showSectionHeaderM = hasUnread && groupM !== lastGroupM
          lastGroupM = groupM

          return (
            <Fragment key={venta.id}>
              {showSectionHeaderM && (
                <div className="px-1 pt-2 pb-0.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                    {groupM === 'unread' ? `No leídos · ${unreadCount}` : 'Todo lo demás'}
                  </span>
                </div>
              )}
            <div
              onClick={() => handleRowClick(venta)}
              onContextMenu={(e) => handleContextMenu(e, venta)}
              onTouchStart={(e) => handleTouchStart(e, venta)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
              className={`
                bg-white border border-border rounded-2xl p-4 transition-all active:scale-[0.98] select-none
                ${isSelected ? 'ring-2 ring-blue border-blue' : ''}
                ${isError ? 'bg-red-subtle/30' : ''}
              `}
              style={{ touchAction: 'pan-y' }}
            >
              {/* Card Header: Checkbox, Status & Date */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(venta.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 rounded border-border bg-surface-alt accent-accent cursor-pointer"
                  />
                  <StatusBadge status={venta.status} />
                  {isError && venta.datos_fiscales?.error_detalle && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onShowError(venta.datos_fiscales.error_detalle) }}
                      className="text-red p-1"
                    >
                      <AlertCircle size={16} />
                    </button>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{formatDate(venta.fecha)}</div>
                  <div className="text-[9px] text-text-muted opacity-60">{formatTime(venta.fecha)}</div>
                </div>
              </div>

              {/* Card Body: Customer & Description */}
              <div className="mb-4">
                <div className="font-black text-xs text-text-primary uppercase truncate mb-1 tracking-tight">
                  {venta.cliente || 'Consumidor Final'}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-text-muted uppercase bg-surface-alt px-1.5 py-0.5 rounded">
                    {venta.nro_comprobante || 'Sin Factura'}
                  </span>
                  <OrigenBadge origen={venta.datos_fiscales?.origen} mpId={venta.mp_payment_id} />
                </div>
              </div>

              {/* Card Footer: Amount & Actions */}
              <div className="flex items-end justify-between pt-3 border-t border-border/40">
                <div>
                  <div className={`text-lg font-black tracking-tight ${isNC ? 'text-red' : 'text-text-primary'}`}>
                    {isNC && '- '}{formatCurrency(venta.monto)}
                  </div>
                  {isNC && <div className="text-[8px] font-bold text-red uppercase">Nota de Crédito</div>}
                </div>
                
                <div className="flex items-center gap-1">
                  {venta.status === 'facturado' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(venta); }}
                      className="p-2.5 bg-surface-alt rounded-xl text-text-muted hover:text-accent"
                    >
                      <Eye size={18} />
                    </button>
                  )}
                  {venta.status === 'pendiente' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(venta); }}
                      className="p-2.5 bg-surface-alt rounded-xl text-text-muted hover:text-accent"
                    >
                      <Edit2 size={18} />
                    </button>
                  )}
                  {isError && onRetry && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRetry(venta.id) }}
                      className="p-2.5 bg-yellow-subtle rounded-xl text-amber-600"
                    >
                      <RotateCcw size={18} />
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
                          } catch (_) {}
                        }
                        generateInvoicePdf(venta, emisor);
                      }}
                      className="p-2.5 bg-green-subtle rounded-xl text-green"
                    >
                      <FileDown size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            </Fragment>
          )
        }) })()}
      </div>

      {/* ─── Desktop Table View (md+) ─── */}
      <div className="hidden md:block">
        
        {/* Table Toolbar / Pagination & Column Picker (Gmail Style) */}
        <div className="flex items-center justify-between px-2 py-2 mb-2 gap-2 relative">
          
          <div className="flex items-center gap-1">
            {/* Unified Export Dropdown */}
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setExportOpen(!exportOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-white text-[10px] md:text-xs font-semibold text-text-muted hover:bg-surface-alt hover:text-text-primary shadow-sm transition-all cursor-pointer"
              >
                <FileDown size={13} />
                Exportar
                <ChevronDown size={12} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
              </button>

              {exportOpen && (
                <div className="absolute left-0 mt-2 w-40 bg-white border border-border rounded-xl shadow-lg z-50 py-1 animate-slide-down">
                  <button
                    onClick={() => { exportToExcel(sortedVentas); setExportOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-alt hover:text-green transition-colors cursor-pointer text-left"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-green" />
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => { exportToCSV(sortedVentas); setExportOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-alt hover:text-blue transition-colors cursor-pointer text-left"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-blue" />
                    CSV (.csv)
                  </button>
                </div>
              )}
            </div>

            {onBulkImport && (
              <button
                onClick={onBulkImport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-white text-[10px] md:text-xs font-semibold text-text-muted hover:bg-surface-alt hover:text-purple shadow-sm transition-all cursor-pointer"
              >
                <FolderInput size={13} />
                Carga Masiva
              </button>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted hidden md:inline">
                Filas por página:
              </span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}
                className="bg-transparent border-none text-xs font-semibold text-text-primary cursor-pointer focus:outline-none"
              >
                {PAGE_SIZES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs text-text-muted tabular-nums font-semibold">
                {startIndex}–{endIndex} de {sortedVentas.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-alt disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-alt disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Column Picker */}
            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => setShowColumnPicker(!showColumnPicker)}
                className={`
                  flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer
                  ${showColumnPicker 
                    ? 'bg-surface-alt text-text-primary' 
                    : 'bg-transparent text-text-muted hover:bg-surface-alt hover:text-text-primary'
                  }
                `}
              >
                <Settings2 size={14} />
                Mostrar
              </button>

              {showColumnPicker && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-border rounded-xl shadow-lg z-50 py-3 animate-slide-down">
                  <div className="px-4 pb-2 mb-2 border-b border-border/40">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-primary opacity-60">
                      Columnas
                    </span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto px-1 space-y-0.5">
                    {COLUMN_CONFIG.map(col => (
                      <button
                        key={col.id}
                        onClick={() => toggleColumn(col.id)}
                        className={`
                          w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-[11px] font-semibold
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
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-2xl border border-border/40 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="overflow-x-auto min-h-[400px] scroll-shadow-container">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]">
              <tr className="border-b border-border/60">
                <th className="w-10 px-[clamp(0.4rem,1vw,1rem)] py-3 text-left">
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
                {isVisible('etiqueta') && <SortHeader label="Etiqueta" sortField="etiqueta" />}
                <th className="px-4 py-3 text-right bg-surface-alt/5 bg-white sticky right-0 shadow-[-1px_0_0_rgba(0,0,0,0.05)]"></th>
              </tr>
            </thead>
            <tbody>
              {(() => { let lastGroup = null; return pagedVentas.map((venta, i) => {
                const isSelected = selectedIds.has(venta.id)
                const isError = venta.status === 'error'
                const group = venta.leido === false ? 'unread' : 'read'
                const showSectionHeader = hasUnread && group !== lastGroup
                lastGroup = group

                return (
                  <Fragment key={venta.id}>
                    {showSectionHeader && (
                      <tr className="bg-surface-alt/40 border-b border-border/40 select-none">
                        <td colSpan={99} className="px-4 py-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                            {group === 'unread' ? `No leídos · ${unreadCount}` : 'Todo lo demás'}
                          </span>
                        </td>
                      </tr>
                    )}
                  <tr
                    draggable
                    onDragStart={(e) => {
                      const isCurrentSelected = selectedIds.has(venta.id)
                      const ids = isCurrentSelected && selectedIds.size > 0
                        ? Array.from(selectedIds)
                        : [venta.id]
                      e.dataTransfer.setData('application/venta-ids', JSON.stringify(ids))
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={() => onRowClick?.(venta)}
                    onContextMenu={(e) => handleContextMenu(e, venta)}
                    onTouchStart={(e) => handleTouchStart(e, venta)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    className={`
                      transition-all duration-150 cursor-pointer border-b border-border/40 select-none
                      ${!isSelected && !isError ? 'hover:bg-surface-alt/60' : ''}
                      ${isError ? 'bg-red-subtle/30 hover:bg-red-subtle/50' : ''}
                      ${isSelected ? 'bg-blue-subtle/50 hover:bg-blue-subtle' : ''}
                    `}
                    style={{ touchAction: 'pan-y' }}
                  >
                    <td className="px-[clamp(0.4rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)]">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(venta.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-border bg-surface-alt accent-accent cursor-pointer"
                      />
                    </td>
                    {isVisible('fecha') && (
                      <td className="px-[clamp(0.4rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)]">
                        <div className="text-text-primary font-medium">{formatDate(venta.fecha)}</div>
                        <div className="text-text-muted text-xs">{formatTime(venta.fecha)}</div>
                      </td>
                    )}
                    {isVisible('cliente') && (
                      <td className="px-[clamp(0.4rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)]">
                        <div className="flex items-center gap-2">
                          {venta.leido === false && (
                            <div className="w-1.5 h-1.5 rounded-full bg-blue shrink-0 shadow-[0_0_8px_rgba(52,96,168,0.5)]" title="Venta nueva" />
                          )}
                          <div className={`uppercase truncate max-w-[12vw] ${venta.leido === false ? 'font-black text-text-primary text-[clamp(11px,0.85vw,13px)]' : 'text-text-primary text-[clamp(11px,0.85vw,13px)] font-bold'}`}>
                            {venta.cliente || '—'}
                          </div>
                        </div>
                      </td>
                    )}
                    {isVisible('cuit') && (
                      <td className="px-[clamp(0.4rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)]" onClick={(e) => e.stopPropagation()}>
                        <QuickCuitInput venta={venta} onSaveEdit={onSaveEdit} />
                      </td>
                    )}
                    {isVisible('monto') && (
                      <td className="px-4 py-3 text-right">
                        {[3, 8, 13, 113].includes(venta.datos_fiscales?.tipo_cbte) ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[#C0443C] font-bold text-[clamp(11px,0.85vw,13px)] tabular-nums">- {formatCurrency(venta.monto)}</span>
                            <span className="text-[8px] font-bold text-[#C0443C]/80 uppercase tracking-wider">Nota de Crédito</span>
                          </div>
                        ) : [2, 7, 12, 112].includes(venta.datos_fiscales?.tipo_cbte) ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[#3460A8] font-semibold tabular-nums">{formatCurrency(venta.monto)}</span>
                            <span className="text-[9px] font-bold text-[#3460A8]/80 uppercase tracking-wider">Nota de Débito</span>
                          </div>
                        ) : (
                          <span className="text-text-primary font-bold text-[clamp(11px,0.85vw,13px)] tabular-nums">{formatCurrency(venta.monto)}</span>
                        )}
                        {isRI && venta.datos_fiscales?.neto_gravado != null && (
                          <div className="text-[9px] text-text-muted tabular-nums mt-0.5">
                            Neto {formatCurrency(venta.datos_fiscales.neto_gravado)} + IVA {formatCurrency(venta.datos_fiscales.iva_monto)}
                          </div>
                        )}
                      </td>
                    )}
                    {isVisible('iva') && (
                      <td className="px-[clamp(0.4rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)]">
                        <div className="text-text-secondary text-xs">{venta.datos_fiscales?.condicion_iva || '—'}</div>
                      </td>
                    )}
                    {isVisible('descripcion') && (
                      <td className="px-[clamp(0.4rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)]">
                        <div className="text-text-secondary text-[clamp(10px,0.8vw,12px)] italic truncate max-w-[150px]" title={venta.datos_fiscales?.descripcion}>{venta.datos_fiscales?.descripcion || '—'}</div>
                      </td>
                    )}
                    {isVisible('origen') && (
                      <td className="px-[clamp(0.4rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)]">
                        <OrigenBadge origen={venta.datos_fiscales?.origen} mpId={venta.mp_payment_id} />
                      </td>
                    )}
                    {isVisible('medio') && (
                      <td className="px-[clamp(0.4rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)]">
                        <PaymentBadge method={venta.datos_fiscales?.medio_pago || venta.datos_fiscales?.forma_pago} />
                      </td>
                    )}
                    {isVisible('status') && (
                      <td className="px-[clamp(0.4rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)]">
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
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                    {isVisible('factura') && (
                      <td className="px-[clamp(0.4rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)]">
                        <div className="text-text-primary text-[clamp(10px,0.8vw,12px)] font-mono whitespace-nowrap">
                          {venta.nro_comprobante || <span className="text-text-muted">—</span>}
                        </div>
                      </td>
                    )}
                    {isVisible('cae') && (
                      <td className="px-[clamp(0.4rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)]">
                        {venta.cae ? (
                          <div>
                            <div className="text-text-primary text-[clamp(10px,0.8vw,12px)] font-mono">{venta.cae}</div>
                            {venta.vto_cae && (
                              <div className="text-text-muted text-[10px]">Vto: {formatDate(venta.vto_cae)}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[clamp(10px,0.8vw,12px)] text-text-muted tabular-nums font-mono">{venta.cae || '—'}</span>
                        )}
                      </td>
                    )}
                    {isVisible('etiqueta') && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <EtiquetasCellContent venta={venta} labels={labels} />
                      </td>
                    )}
                    {isVisible('fecha_facturacion') && (
                      <td className="px-4 py-3">
                        {venta.datos_fiscales?.fecha_emision ? (
                          <div className="text-text-primary text-xs font-mono">{new Date(venta.datos_fiscales.fecha_emision + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>
                    )}
                                                            <td className="px-[clamp(0.4rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)] text-right bg-white sticky right-0 shadow-[-1px_0_0_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-end gap-1">
                        {venta.status === 'facturado' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onEdit) onEdit(venta);
                            }}
                            className="p-2 transition-all cursor-pointer rounded-lg text-text-muted hover:text-accent hover:bg-accent/5"
                            title="Ver detalle"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        {venta.status === 'pendiente' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onEdit) onEdit(venta);
                            }}
                            className="p-2 transition-all cursor-pointer rounded-lg text-text-muted hover:text-accent hover:bg-accent/5"
                            title="Editar datos"
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
                        {onEmit && (venta.status === 'pendiente' || venta.status === 'error') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onEmit(venta.id) }}
                            className="p-2 text-text-muted hover:text-green hover:bg-green/10 rounded-lg transition-all cursor-pointer"
                            title="Facturar ahora"
                          >
                            <FileText size={16} />
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
                                } catch (_) {}
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
                  </Fragment>
                )
              }) })()}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* ─── Context Menu (Right-click / Long-press) ─── */}
      {ctxMenu && createPortal(
        <div className="command-context-menu-portal" style={{ position: 'fixed', zIndex: 99999 }}>
          <div className="fixed inset-0 z-[99998]" onClick={closeCtxMenu} onContextMenu={(e) => { e.preventDefault(); closeCtxMenu(); }} />
          <div
            ref={ctxMenuRef}
            className="fixed z-[99999] bg-white border border-border/60 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] min-w-[200px] overflow-hidden animate-slide-down py-1.5"
            style={{
              left: Math.min(ctxMenu.x, window.innerWidth - 220),
              top: Math.min(ctxMenu.y, window.innerHeight - 300),
            }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/30 bg-surface-alt/30">
              <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-text-primary/70">
                Organizar
              </span>
              <span className="block text-xs font-bold text-text-primary truncate mt-0.5" title={ctxMenu.venta?.cliente || 'Consumidor Final'}>
                {ctxMenu.venta?.cliente || 'Consumidor Final'}
              </span>
            </div>

            <div className="p-1">
              {/* Archive */}
              <button
                onMouseEnter={() => setCtxSub(null)}
                onClick={handleCtxArchive}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-semibold text-text-primary hover:bg-surface-alt rounded-lg transition-colors cursor-pointer"
              >
                <Archive size={15} className="text-text-muted" />
                {(ctxMenu.venta?.archivada || ctxMenu.venta?.status === 'archivada' || ctxMenu.venta?.status === 'archivado') ? 'Desarchivar' : 'Archivar'}
              </button>

              {/* Trash / Delete Action */}
              <button
                onClick={() => {
                  if (ctxMenu.venta?.status === 'borrada') {
                    if (confirm('¿Estás seguro de eliminar esta venta definitivamente? Esta acción no se puede deshacer.')) {
                      onHardDelete?.(ctxMenu.venta.id);
                    }
                  } else {
                    onDelete?.(ctxMenu.venta.id);
                  }
                  closeCtxMenu();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                  ctxMenu.venta?.status === 'borrada' ? 'text-red hover:bg-red-subtle/30' : 'text-text-primary hover:bg-surface-alt'
                }`}
              >
                <Trash2 size={15} className={ctxMenu.venta?.status === 'borrada' ? 'text-red' : 'text-text-muted'} />
                {ctxMenu.venta?.status === 'borrada' ? 'Eliminar definitivamente' : 'Enviar a papelera'}
              </button>

              {ctxMenu.venta?.status === 'borrada' && (
                <button
                  onClick={() => { onRestore?.(ctxMenu.venta.id); closeCtxMenu(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-semibold text-text-primary hover:bg-surface-alt rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw size={15} className="text-text-muted" />
                  Restaurar venta
                </button>
              )}

              <div className="h-px bg-border/20 mx-2 my-0.5" />

              {/* Labels submenu */}
              <div 
                className="relative"
                onMouseEnter={() => setCtxSub('labels')}
              >
                <button
                  onClick={() => setCtxSub(ctxSub === 'labels' ? null : 'labels')}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-semibold text-text-primary hover:bg-surface-alt rounded-lg transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <Tag size={15} className="text-text-muted" />
                    Etiquetar
                  </span>
                  <ChevronRightSub size={14} className={`text-text-muted transition-transform ${ctxSub === 'labels' ? 'rotate-90' : ''}`} />
                </button>
                {ctxSub === 'labels' && (
                  <div className="border-t border-border/10 bg-surface-alt/30 rounded-b-lg py-1">
                    {getEtiquetas(ctxMenu.venta).length > 0 && (
                      <button
                        onClick={() => handleCtxLabel('')}
                        className="w-full flex items-center gap-3 px-6 py-2 text-[11px] font-semibold text-red hover:bg-red-subtle/30 rounded-lg transition-colors cursor-pointer"
                      >
                        <X size={13} />
                        Quitar todas
                      </button>
                    )}
                    {labels.map(label => {
                      const colorObj = LABEL_COLORS.find(c => c.id === label.colorId) || LABEL_COLORS[0];
                      const isActive = hasEtiqueta(ctxMenu.venta, label.name);
                      return (
                        <button
                          key={label.name}
                          onClick={() => handleCtxLabel(label.name)}
                          className={`w-full flex items-center gap-3 px-6 py-2 text-[11px] font-semibold transition-colors cursor-pointer rounded-lg ${
                            isActive ? 'bg-accent/5 text-accent' : 'text-text-primary hover:bg-surface-alt'
                          }`}
                        >
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colorObj.color }} />
                          {label.name}
                          {isActive && <Check size={13} className="ml-auto text-accent" />}
                        </button>
                      );
                    })}
                    {labels.length === 0 && (
                      <div className="px-6 py-3 text-[10px] text-text-muted italic">No hay etiquetas creadas</div>
                    )}
                  </div>
                )}
              </div>

              <div className="h-px bg-border/20 mx-2 my-0.5" />

              {/* Folders submenu */}
              <div 
                className="relative"
                onMouseEnter={() => setCtxSub('folders')}
              >
                <button
                  onClick={() => setCtxSub(ctxSub === 'folders' ? null : 'folders')}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-semibold text-text-primary hover:bg-surface-alt rounded-lg transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <FolderInput size={15} className="text-text-muted" />
                    Mover a carpeta
                  </span>
                  <ChevronRightSub size={14} className={`text-text-muted transition-transform ${ctxSub === 'folders' ? 'rotate-90' : ''}`} />
                </button>
                {ctxSub === 'folders' && (
                  <div className="border-t border-border/10 bg-surface-alt/30 rounded-b-lg py-1">
                    {ctxMenu.venta?.folder && (
                      <button
                        onClick={() => handleCtxMove(null)}
                        className="w-full flex items-center gap-3 px-6 py-2 text-[11px] font-semibold text-red hover:bg-red-subtle/30 rounded-lg transition-colors cursor-pointer"
                      >
                        <X size={13} />
                        Sacar de carpeta
                      </button>
                    )}
                    {customFolders.map(folder => {
                      const isActive = ctxMenu.venta?.folder === folder.id;
                      return (
                        <button
                          key={folder.id}
                          onClick={() => handleCtxMove(folder.id)}
                          className={`w-full flex items-center gap-3 px-6 py-2 text-[11px] font-semibold transition-colors cursor-pointer rounded-lg ${
                            isActive ? 'bg-accent/5 text-accent' : 'text-text-primary hover:bg-surface-alt'
                          }`}
                        >
                          📁 {folder.name}
                          {isActive && <Check size={13} className="ml-auto text-accent" />}
                        </button>
                      );
                    })}
                    {customFolders.length === 0 && (
                      <div className="px-6 py-3 text-[10px] text-text-muted italic">No hay carpetas creadas</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}
