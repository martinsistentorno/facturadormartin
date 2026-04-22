import { useState, useMemo, useCallback } from 'react'
import { useVentas } from '../hooks/useVentas'
import { useClientes } from '../hooks/useClientes'
import StatsCards from '../components/StatsCards'
import SalesTable from '../components/SalesTable'
import EmitirFacturaBar from '../components/EmitirFacturaBar'
import SummaryModal from '../components/SummaryModal'
import Layout from '../components/Layout'
import FilterBar from '../components/FilterBar'
import SaleDetailDrawer from '../components/SaleDetailDrawer'
import ToastContainer, { createToast } from '../components/ToastContainer'
import { RefreshCw, Plus, Download, ChevronDown, Trash2, ShieldCheck } from 'lucide-react'
import AddSaleModal from '../components/AddSaleModal'
import BulkImportModal from '../components/BulkImportModal'
import { exportToCSV, exportToExcel } from '../utils/exportUtils'
import { translatePaymentMethod } from '../utils/paymentMethods'

export default function Home() {
  const { ventas, setVentas, loading, error, refetch, updateVentaStatus, updateVenta, createVenta, deleteVenta, hardDeleteVenta, bulkCreateVentas } = useVentas()
  const { search: searchClientes } = useClientes(ventas)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [toasts, setToasts] = useState([])
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  
  // ─── Modal State ───
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalData, setModalData] = useState({ title: '', ventas: [] })

  // ─── Drawer State ───
  const [detailVenta, setDetailVenta] = useState(null)
  const [detailVentaEditMode, setDetailVentaEditMode] = useState(false)

  // ─── Filters State ───
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    medio: '',
    origen: '',
    dateFrom: '',
    dateTo: '',
    montoMin: '',
    montoMax: '',
  })

  // ─── Debounced search ───
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters)
    // Debounce search
    clearTimeout(window.__searchTimer)
    window.__searchTimer = setTimeout(() => {
      setDebouncedSearch(newFilters.search)
    }, 300)
  }, [])

  // ─── Filtered ventas ───
  const borradas = useMemo(() => ventas.filter(v => v.status === 'borrada'), [ventas])
  const filteredVentas = useMemo(() => {
    return ventas.filter(v => {
      // Exclude borradas globally from generic UI views
      if (v.status === 'borrada') return false

      // Universal search across all fields
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        const searchable = [
          v.cliente,
          v.datos_fiscales?.cuit,
          v.cae,
          v.nro_comprobante,
          String(v.monto || ''),
          v.status,
          v.datos_fiscales?.forma_pago,
          v.mp_payment_id ? `MeLi #${v.mp_payment_id.replace(/^order-/, '')}` : '',
          v.mp_payment_id ? `MP #${v.mp_payment_id.replace(/^order-/, '')}` : '',
        ].filter(Boolean).join(' ').toLowerCase()
        if (!searchable.includes(q)) return false
      }

      // Status filter
      if (filters.status && v.status !== filters.status) return false

      // Date range
      if (filters.dateFrom || filters.dateTo) {
        const d = new Date(v.fecha);
        const vDateLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (filters.dateFrom && vDateLocal < filters.dateFrom) return false;
        if (filters.dateTo && vDateLocal > filters.dateTo) return false;
      }

      // Monto range
      const monto = Number(v.monto) || 0
      if (filters.montoMin && monto < Number(filters.montoMin)) return false
      if (filters.montoMax && monto > Number(filters.montoMax)) return false

      // Origen filter
      if (filters.origen) {
        const q = filters.origen.toLowerCase()
        const origen = (v.datos_fiscales?.origen || '').toLowerCase()
        const isMeLi = origen.includes('mercadolibre') || v.mp_payment_id?.startsWith('order-')
        const isMePa = origen.includes('mercadopago') || (v.mp_payment_id && !v.mp_payment_id.startsWith('order-'))
        const isManual = origen.includes('manual') || (!v.mp_payment_id)

        if (q === 'mercadolibre' && !isMeLi) return false
        if (q === 'mercadopago' && !isMePa) return false
        if (q === 'manual' && !isManual) return false
      }

      // Medio filter
      if (filters.medio) {
        const q = filters.medio.toLowerCase()
        const translated = translatePaymentMethod(v.datos_fiscales?.forma_pago).toLowerCase()

        if (q === 'transferencia' && !translated.includes('transferencia')) return false
        if (q === 'tarjeta' && !translated.includes('tarjeta')) return false
        if (q === 'contado' && !translated.includes('efectivo') && !translated.includes('contado')) return false
        if (q === 'dinero en cuenta' && !translated.includes('dinero en cuenta')) return false
        if (q === 'crédito mp' && !translated.includes('crédito mp')) return false
        if (q === 'cripto / digital' && !translated.includes('cripto')) return false
      }

      return true
    })
  }, [ventas, debouncedSearch, filters.status, filters.medio, filters.origen, filters.dateFrom, filters.dateTo, filters.montoMin, filters.montoMax])

  // ─── Selected ventas data ───
  const selectedVentas = useMemo(() =>
    ventas.filter(v => selectedIds.has(v.id)),
    [ventas, selectedIds]
  )

  const handleCardClick = (title, filteredVentas, timeframe) => {
    let tfLabel = ''
    if (timeframe === 'day') tfLabel = ' (Hoy)'
    if (timeframe === 'week') tfLabel = ' (Esta Sem)'
    if (timeframe === 'month') tfLabel = ' (Este Mes)'
    if (timeframe === 'all') tfLabel = ' (Histórico)'

    let mTitle = title;
    if (title === 'LISTADO_PAPELERA') mTitle = 'Papelera de Reciclaje'

    setModalData({ title: `${mTitle}${tfLabel}`, ventas: filteredVentas })
    setIsModalOpen(true)
  }

  // ─── Selection handlers ───
  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleToggleAll = () => {
    const seleccionables = filteredVentas
    if (selectedIds.size === seleccionables.length && seleccionables.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(seleccionables.map(v => v.id)))
    }
  }

  const handleClearSelection = () => {
    setSelectedIds(new Set())
  }

  // ─── Toast helper ───
  const showToast = useCallback((message, type = 'success') => {
    setToasts(prev => [...prev, createToast(message, type)])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ─── Delete handler for Modal ───
  const handleDeleteVenta = async (id) => {
    try {
      await deleteVenta(id)
      showToast('Venta eliminada del sistema', 'success')
      setModalData(prev => ({
        ...prev,
        ventas: prev.ventas.filter(v => v.id !== id)
      }))
    } catch (err) {
      console.error('Error al eliminar:', err)
      showToast('Error al eliminar: ' + err.message, 'error')
    }
  }

  const handleRestoreVenta = async (id) => {
    try {
      await updateVentaStatus(id, 'pendiente')
      showToast('Venta restaurada a pendiente', 'info')
      setModalData(prev => ({
        ...prev,
        ventas: prev.ventas.filter(v => v.id !== id)
      }))
    } catch (err) {
      console.error('Error al restaurar:', err)
      showToast('Error al restaurar: ' + err.message, 'error')
    }
  }

  const handleHardDeleteVenta = async (id) => {
    try {
      await hardDeleteVenta(id)
      showToast('Venta eliminada permanentemente', 'success')
      setModalData(prev => ({
        ...prev,
        ventas: prev.ventas.filter(v => v.id !== id)
      }))
    } catch (err) {
      console.error('Error al eliminar definitivamente:', err)
      showToast('Error al eliminar: ' + err.message, 'error')
    }
  }

  const handleResetVenta = async (id) => {
    try {
      const v = ventas.find(x => x.id === id)
      const cleanDatosFiscales = v?.datos_fiscales ? {
        ...v.datos_fiscales,
        comprobante_numero: null,
        cae: null,
        cae_vto: null,
        afip_envio_fecha: null,
        error_detalle: null
      } : null

      await updateVenta(id, { 
        status: 'pendiente', 
        cae: null, 
        nro_comprobante: null, 
        vto_cae: null, 
        datos_fiscales: cleanDatosFiscales 
      })
      showToast('Venta reiniciada a pendiente', 'success')
      setModalData(prev => ({
        ...prev,
        ventas: prev.ventas.filter(v => v.id !== id)
      }))
    } catch (err) {
      console.error('Error al reiniciar:', err)
      showToast('Error al reiniciar: ' + err.message, 'error')
    }
  }

  const handleResetAllVentas = async (ids) => {
    if (!confirm(`¿Estás seguro de que quieres reiniciar las ${ids.length} ventas seleccionadas? Se mantendrán los CUITs pero se borrarán los datos de facturación previos.`)) return;
    
    try {
      // Loop to preserve individual datos_fiscales while clearing AFIP data
      // For bulk, let's use Promise.all to be reasonably fast
      const updates = ids.map(id => {
        const v = ventas.find(x => x.id === id)
        const cleanDatosFiscales = v?.datos_fiscales ? {
          ...v.datos_fiscales,
          comprobante_numero: null,
          cae: null,
          cae_vto: null,
          afip_envio_fecha: null,
          error_detalle: null
        } : null

        return supabase
          .from('ventas')
          .update({ 
            status: 'pendiente', 
            cae: null, 
            nro_comprobante: null, 
            vto_cae: null, 
            datos_fiscales: cleanDatosFiscales 
          })
          .eq('id', id)
      })

      const results = await Promise.all(updates)
      const errors = results.filter(r => r.error)
      if (errors.length > 0) throw errors[0].error

      // Local update
      setVentas(prev => prev.map(v => {
        if (!ids.includes(v.id)) return v
        return { 
          ...v, 
          status: 'pendiente', 
          cae: null, 
          nro_comprobante: null, 
          vto_cae: null, 
          datos_fiscales: v.datos_fiscales ? {
            ...v.datos_fiscales,
            comprobante_numero: null,
            cae: null,
            cae_vto: null,
            afip_envio_fecha: null,
            error_detalle: null
          } : null
        }
      }))

      showToast(`${ids.length} ventas reiniciadas correctamente`, 'success')
      setIsModalOpen(false) 
    } catch (err) {
      console.error('Error en reinicio masivo:', err)
      showToast('Error en reinicio masivo: ' + err.message, 'error')
    }
  }

  // ─── Bulk delete ───
  const handleBulkDelete = async () => {
    if (selectedVentas.length === 0) return

    if (!confirm(`¿Mover ${selectedVentas.length} venta(s) a la papelera?\nPodrás restaurarlas o eliminarlas definitivamente luego.`)) return

    let deleted = 0
    for (const v of selectedVentas) {
      try {
        await deleteVenta(v.id)
        deleted++
      } catch (err) {
        console.error(`Error eliminando ${v.id}:`, err)
      }
    }
    setSelectedIds(new Set())
    showToast(`${deleted} venta(s) eliminada(s)`, 'success')
  }

  // ─── Retry handler ───
  const handleRetry = async (ventaId) => {
    const venta = ventas.find(v => v.id === ventaId)
    if (!venta) return

    try {
      // Reset to pendiente
      await updateVenta(ventaId, { status: 'pendiente' })
      setVentas(prev => prev.map(v => v.id === ventaId ? { ...v, status: 'pendiente' } : v))
      showToast('Venta restaurada a pendiente. Selecciónala y facturá.', 'info')
    } catch (err) {
      showToast('Error al reintentar: ' + err.message, 'error')
    }
  }

  // ─── Bulk retry ───
  const handleBulkRetry = async () => {
    const errorVentas = selectedVentas.filter(v => v.status === 'error')
    if (errorVentas.length === 0) return

    let retried = 0
    for (const v of errorVentas) {
      try {
        await updateVenta(v.id, { status: 'pendiente' })
        retried++
      } catch (err) {
        console.error(`Error reintentando ${v.id}:`, err)
      }
    }
    setVentas(prev => prev.map(v =>
      errorVentas.find(e => e.id === v.id) ? { ...v, status: 'pendiente' } : v
    ))
    setSelectedIds(new Set())
    showToast(`${retried} venta(s) restauradas a pendiente`, 'info')
  }

  // ─── Export handlers ───
  const handleExportSelection = () => {
    if (selectedVentas.length === 0) return
    exportToCSV(selectedVentas, `ventas_seleccion_${new Date().toISOString().split('T')[0]}`)
    showToast(`${selectedVentas.length} venta(s) exportadas a CSV`, 'success')
  }

  const handleExportAll = (format) => {
    const data = filteredVentas.length > 0 ? filteredVentas : ventas
    const filename = `ventas_${new Date().toISOString().split('T')[0]}`
    if (format === 'csv') {
      exportToCSV(data, filename)
    } else {
      exportToExcel(data, filename)
    }
    showToast(`${data.length} ventas exportadas a ${format.toUpperCase()}`, 'success')
    setExportMenuOpen(false)
  }

  // ─── Emitir Factura handler ───
  const handleInvoice = async () => {
    const selectedVentasToInvoice = ventas.filter(v => selectedIds.has(v.id) && v.status !== 'facturado')
    if (selectedVentasToInvoice.length === 0) {
      showToast('No hay ventas pendientes o con error seleccionadas', 'error')
      return
    }

    try {
      showToast('Emitiendo factura...', 'info')
      
      setVentas(prev => prev.map(v => 
        selectedIds.has(v.id) ? { ...v, status: 'procesando' } : v
      ))
      
      const payload = {
        ventas: selectedVentasToInvoice.map(v => ({
          id: v.id,
          fecha: v.fecha,
          cliente: v.cliente,
          monto: v.monto,
          datos_fiscales: v.datos_fiscales || {},
          mp_payment_id: v.mp_payment_id,
        })),
      }

      const response = await fetch('/api/afip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json()
      
      if (!response.ok || data.error || !data.success) {
        throw new Error(data.error || `Error del servidor (${response.status})`)
      }

      const resultados = data.resultados || []
      const successCount = resultados.filter(r => r.success).length
      
      setVentas(prev => prev.map(v => {
        const res = resultados.find(r => r.id === v.id)
        if (res) {
          if (res.success) {
            return { 
              ...v, 
              status: 'facturado', 
              cae: res.cae, 
              nro_comprobante: res.nro,
              pdf_url: res.pdf_url || null
            }
          } else {
            return { 
              ...v, 
              status: 'error',
              datos_fiscales: { 
                ...v.datos_fiscales, 
                error_detalle: res.error 
              }
            }
          }
        }
        return v
      }))

      setSelectedIds(new Set())
      
      if (successCount === resultados.length && successCount > 0) {
        showToast(`✓ ${successCount} comprobante(s) emitido(s) con éxito`, 'success')
      } else if (successCount > 0) {
        showToast(`${successCount} de ${resultados.length} emitidas. Algunos fallaron.`, 'warning')
      } else {
        showToast('No se emitió ningún comprobante. Comprobá los errores en la tabla.', 'error')
      }

    } catch (err) {
      console.error('[handleInvoice] Error:', err.message)
      showToast('Error al procesar facturas: ' + err.message, 'error')
      
      // Si falló el request entero, marcar las que estaban en proceso como error
      setVentas(prev => prev.map(v => 
        v.status === 'procesando' 
          ? { ...v, status: 'error', datos_fiscales: { ...v.datos_fiscales, error_detalle: err.message } } 
          : v
      ))
    }
  }

  const handleRecoverAfip = async () => {
    try {
      showToast('Iniciando recuperación de AFIP...', 'info');
      const res = await fetch('/api/recover');
      const data = await res.json();
      
      if (data.success) {
        showToast(`✓ Recuperación finalizada. Procesadas: ${data.processed}`, 'success');
        refetch(); // Recargar datos
      } else {
        showToast('Error en recuperación: ' + data.error, 'error');
      }
    } catch (err) {
      showToast('Error de conexión: ' + err.message, 'error');
    }
  };

  const handleSyncMeLi = async () => {
    setLoading(true)
    showToast('⚓ Sincronizando con Mercado Libre...', 'info')
    try {
      const res = await fetch('/api/sync-payments')
      const data = await res.json()
      
      if (data.success) {
        showToast(`✓ Sincronización completa: ${data.inserted} nuevos, ${data.repaired} recuperados.`, 'success')
        refetch()
      } else {
        throw new Error(data.error || 'Error desconocido')
      }
    } catch (err) {
      console.error('[handleSyncMeLi] Error:', err.message)
      showToast('Error al sincronizar: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEditVenta = async (id, payload) => {
    try {
      await updateVenta(id, payload)
      showToast('Datos actualizados correctamente', 'success')
    } catch (err) {
      console.error('Error al actualizar venta:', err)
      showToast('Error al actualizar: ' + err.message, 'error')
    }
  }

  const handleCreateVenta = async (payload) => {
    try {
      await createVenta(payload)
      showToast('Venta agregada correctamente', 'success')
    } catch (err) {
      console.error('Error al crear venta:', err)
      showToast('Error al crear venta: ' + err.message, 'error')
      throw err
    }
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSyncMeLi}
        disabled={loading}
        className="
          flex items-center gap-2 px-4 py-2 rounded-xl
          bg-[#FFE100]/10 border border-[#FFE100]/30
          text-[#D6B500] text-[11px] font-bold tracking-widest uppercase
          hover:bg-[#FFE100]/20 hover:border-[#FFE100]/50 hover:shadow-sm
          transition-all duration-200
          disabled:opacity-50 cursor-pointer
        "
        title="Sincronizar ventas de Mercado Libre y Mercado Pago"
      >
        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        <span className="hidden sm:inline">SINCRONIZAR MELI</span>
      </button>

      <button
        onClick={handleRecoverAfip}
        disabled={loading}
        className="
          flex items-center gap-2 px-4 py-2 rounded-xl
          bg-green/10 border border-green/30
          text-green text-[11px] font-bold tracking-widest uppercase
          hover:bg-green/20 hover:border-green/50 hover:shadow-sm
          transition-all duration-200
          disabled:opacity-50 cursor-pointer
        "
        title="Recuperar CAEs perdidos desde AFIP"
      >
        <ShieldCheck size={12} />
        <span className="hidden sm:inline">RECUPERAR CAEs</span>
      </button>

      <button
        onClick={refetch}
        disabled={loading}
        className="
          flex items-center gap-2 px-4 py-2 rounded-xl
          bg-surface border border-border
          text-text-secondary text-[11px] font-bold tracking-widest uppercase
          hover:bg-surface-alt hover:text-[var(--color-cmd-blue)] hover:border-[var(--color-cmd-blue)]/30 hover:shadow-sm
          transition-all duration-200
          disabled:opacity-50 cursor-pointer
        "
      >
        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        <span className="hidden sm:inline">ACTUALIZAR</span>
      </button>
    </div>
  )

  return (
    <Layout headerActions={headerActions}>
      <div className="space-y-6">

      {/* ─── Error banner ─── */}
      {error && (
        <div className="bg-red-subtle border border-red/20 rounded-xl px-4 py-3 text-red text-sm animate-slide-down">
          Error cargando ventas: {error}
        </div>
      )}

      {/* ─── Stats ─── */}
      <StatsCards ventas={ventas} onCardClick={handleCardClick} />

      {/* ─── Filters ─── */}
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        totalCount={ventas.length}
        filteredCount={filteredVentas.length}
      />

      {/* ─── Table section ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-text-primary uppercase tracking-tight">
            Lista Facturas
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleCardClick('LISTADO_PAPELERA', borradas, 'all')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-border/60 text-text-muted hover:text-red hover:border-red/20 hover:-translate-y-1 hover:shadow-lg transition-all cursor-pointer text-[11px] font-bold uppercase tracking-widest"
            >
              <Trash2 size={14} />
              Papelera ({borradas.length})
            </button>

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-border/60 text-text-secondary text-[11px] font-bold uppercase tracking-widest hover:-translate-y-1 hover:shadow-lg hover:border-[var(--color-cmd-blue)]/30 hover:text-[var(--color-cmd-blue)] transition-all cursor-pointer"
              >
                <Download size={14} className="text-text-muted" />
                Exportación Masiva
                <ChevronDown size={14} className={`transition-transform duration-200 ${exportMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {exportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 bg-[#F9F7F2] border border-white/50 rounded-xl shadow-xl shadow-black/10 z-50 min-w-[160px] overflow-hidden animate-slide-down">
                    <button
                      onClick={() => handleExportAll('csv')}
                      className="w-full text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-widest text-text-primary hover:bg-accent/5 hover:text-accent transition-colors cursor-pointer"
                    >
                      Archivo CSV
                    </button>
                    <div className="h-px bg-border/40 mx-2" />
                    <button
                      onClick={() => handleExportAll('xlsx')}
                      className="w-full text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-widest text-text-primary hover:bg-accent/5 hover:text-accent transition-colors cursor-pointer"
                    >
                      Excel (.xlsx)
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setBulkImportModalOpen(true)}
              className="
                flex items-center gap-2 px-6 py-3 rounded-xl
                bg-accent/5 text-accent text-[11px] font-bold uppercase tracking-widest
                border border-accent/10
                hover:-translate-y-1 hover:bg-accent/10 hover:shadow-lg hover:shadow-accent/5
                transition-all duration-300 cursor-pointer
              "
            >
              <Download size={16} />
              Carga Masiva
            </button>

            <button
              onClick={() => setAddModalOpen(true)}
              className="
                flex items-center gap-2 px-6 py-3 rounded-xl
                bg-text-primary text-white text-[11px] font-bold uppercase tracking-widest
                hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20
                transition-all duration-300 cursor-pointer
              "
            >
              <Plus size={16} className="text-yellow" />
              Nueva Venta
            </button>
          </div>
        </div>
        <SalesTable
          ventas={filteredVentas}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleAll={handleToggleAll}
          loading={loading}
          onShowError={(msg) => showToast(msg, 'error')}
          onRowClick={(venta) => {
            setDetailVenta(venta)
            setDetailVentaEditMode(false)
          }}
          onEdit={(venta) => {
            setDetailVenta(venta)
            setDetailVentaEditMode(true)
          }}
          onSaveEdit={handleEditVenta}
          onRetry={handleRetry}
        />
      </div>

      {/* ─── Floating action bar ─── */}
      <EmitirFacturaBar
        selectedCount={selectedIds.size}
        selectedVentas={selectedVentas}
        onEmitir={handleInvoice}
        onClear={handleClearSelection}
        onExport={handleExportSelection}
        onBulkDelete={handleBulkDelete}
        onBulkRetry={handleBulkRetry}
      />

      {/* ─── Detail Drawer ─── */}
      <SaleDetailDrawer
        venta={detailVenta}
        isOpen={!!detailVenta}
        onClose={() => {
          setDetailVenta(null)
          setDetailVentaEditMode(false)
        }}
        onRetry={handleRetry}
        onSave={handleEditVenta}
        initialEditMode={detailVentaEditMode}
      />

      {/* ─── Add Sale Modal ─── */}
      <AddSaleModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleCreateVenta}
        searchClientes={searchClientes}
      />

      <BulkImportModal
        isOpen={bulkImportModalOpen}
        onClose={() => setBulkImportModalOpen(false)}
        onSave={async (ventasMasivas) => {
          await bulkCreateVentas(ventasMasivas)
          await refetch()
          showToast(`¡${ventasMasivas.length} ventas importadas exitosamente!`, 'success')
        }}
      />

      {/* ─── Summary Modal ─── */}
      <SummaryModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalData.title}
        ventas={modalData.ventas}
        onDelete={handleDeleteVenta}
        onRestore={handleRestoreVenta}
        onHardDelete={handleHardDeleteVenta}
        onReset={handleResetVenta}
        onResetAll={handleResetAllVentas}
        onShowError={(msg) => showToast(msg, 'error')}
      />

      {/* ─── Toasts ─── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </Layout>
  )
}
