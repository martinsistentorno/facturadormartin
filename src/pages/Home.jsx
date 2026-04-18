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
import { RefreshCw, Plus, Download, ChevronDown } from 'lucide-react'
import EditSaleModal from '../components/EditSaleModal'
import AddSaleModal from '../components/AddSaleModal'
import { exportToCSV, exportToExcel } from '../utils/exportUtils'

export default function Home() {
  const { ventas, setVentas, loading, error, refetch, updateVentaStatus, updateVenta, createVenta, deleteVenta } = useVentas()
  const { search: searchClientes } = useClientes(ventas)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [toasts, setToasts] = useState([])
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  
  // ─── Modal State ───
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVenta, setEditingVenta] = useState(null)
  const [modalData, setModalData] = useState({ title: '', ventas: [] })

  // ─── Drawer State ───
  const [detailVenta, setDetailVenta] = useState(null)

  // ─── Filters State ───
  const [filters, setFilters] = useState({
    search: '',
    status: '',
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
  const filteredVentas = useMemo(() => {
    return ventas.filter(v => {
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
          v.mp_payment_id ? `MeLi #${v.mp_payment_id}` : '',
        ].filter(Boolean).join(' ').toLowerCase()
        if (!searchable.includes(q)) return false
      }

      // Status filter
      if (filters.status && v.status !== filters.status) return false

      // Date range
      if (filters.dateFrom) {
        const vDate = new Date(v.fecha).toISOString().split('T')[0]
        if (vDate < filters.dateFrom) return false
      }
      if (filters.dateTo) {
        const vDate = new Date(v.fecha).toISOString().split('T')[0]
        if (vDate > filters.dateTo) return false
      }

      // Monto range
      const monto = Number(v.monto) || 0
      if (filters.montoMin && monto < Number(filters.montoMin)) return false
      if (filters.montoMax && monto > Number(filters.montoMax)) return false

      return true
    })
  }, [ventas, debouncedSearch, filters.status, filters.dateFrom, filters.dateTo, filters.montoMin, filters.montoMax])

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

    setModalData({ title: `${title}${tfLabel}`, ventas: filteredVentas })
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
    const seleccionables = filteredVentas.filter(v => v.status !== 'facturado')
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

  // ─── Bulk delete ───
  const handleBulkDelete = async () => {
    const errorVentas = selectedVentas.filter(v => v.status === 'error')
    if (errorVentas.length === 0) {
      showToast('Solo se pueden eliminar ventas con error', 'warning')
      return
    }

    if (!confirm(`¿Eliminar ${errorVentas.length} venta(s) con error?`)) return

    let deleted = 0
    for (const v of errorVentas) {
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
      
      if (successCount === resultados.length) {
        showToast(`✓ ${successCount} comprobante(s) emitido(s) con éxito`, 'success')
      } else {
        showToast(`${successCount} de ${resultados.length} procesadas correctamente`, 'warning')
      }

    } catch (err) {
      console.error('[handleInvoice] Error:', err.message)
      showToast('Error al procesar facturas: ' + err.message, 'error')
      
      setVentas(prev => prev.map(v => 
        v.status === 'procesando' ? { ...v, status: 'pendiente' } : v
      ))
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
    <button
      onClick={refetch}
      disabled={loading}
      className="
        flex items-center gap-2 px-3 py-1.5 rounded-full
        bg-surface border border-border mr-2
        text-text-secondary text-[11px] font-bold tracking-widest uppercase
        hover:bg-surface-alt hover:text-text-primary
        transition-all duration-200
        disabled:opacity-50 cursor-pointer
      "
      style={{fontFamily: 'Space Grotesk'}}
    >
      <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">ACTUALIZAR</span>
    </button>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-black text-text-secondary uppercase tracking-wider" style={{fontFamily: 'Montserrat'}}>
            Lista Facturas
          </h2>
          <div className="flex items-center gap-3">
            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-text-secondary text-xs font-bold uppercase tracking-wider hover:border-accent/30 transition-all cursor-pointer"
                style={{ fontFamily: 'Space Grotesk' }}
              >
                <Download size={14} />
                Exportar
                <ChevronDown size={12} />
              </button>
              {exportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 bg-surface border border-border rounded-xl shadow-xl z-50 min-w-[140px] overflow-hidden">
                    <button
                      onClick={() => handleExportAll('csv')}
                      className="w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                    >
                      CSV (.csv)
                    </button>
                    <button
                      onClick={() => handleExportAll('xlsx')}
                      className="w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors border-t border-border cursor-pointer"
                    >
                      Excel (.xlsx)
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setAddModalOpen(true)}
              className="
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                bg-black text-white text-xs font-bold uppercase tracking-wider
                hover:-translate-y-0.5 hover:shadow-lg
                transition-all duration-200 cursor-pointer
              "
              style={{ fontFamily: 'Space Grotesk' }}
            >
              <Plus size={14} />
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
          onEdit={(venta) => setEditingVenta(venta)}
          onRowClick={(venta) => setDetailVenta(venta)}
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
        onClose={() => setDetailVenta(null)}
        onEdit={(venta) => setEditingVenta(venta)}
        onRetry={handleRetry}
      />

      {/* ─── Edit Modal ─── */}
      <EditSaleModal
        isOpen={!!editingVenta}
        onClose={() => setEditingVenta(null)}
        venta={editingVenta}
        onSave={handleEditVenta}
      />

      {/* ─── Add Sale Modal ─── */}
      <AddSaleModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleCreateVenta}
        searchClientes={searchClientes}
      />

      {/* ─── Summary Modal ─── */}
      <SummaryModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalData.title}
        ventas={modalData.ventas}
        onDelete={handleDeleteVenta}
        onShowError={(msg) => showToast(msg, 'error')}
      />

      {/* ─── Toasts ─── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </Layout>
  )
}
