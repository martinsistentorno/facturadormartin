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
import { RefreshCw, Plus, Download, ChevronDown, Trash2, ShieldCheck, Archive } from 'lucide-react'
import AddSaleModal from '../components/AddSaleModal'
import BulkImportModal from '../components/BulkImportModal'
import { exportToCSV, exportToExcel } from '../utils/exportUtils'
import { translatePaymentMethod } from '../utils/paymentMethods'

export default function Home() {
  const { ventas, setVentas, loading, error, refetch, updateVentaStatus, updateVenta, createVenta, deleteVenta, hardDeleteVenta, archiveVenta, bulkCreateVentas } = useVentas()
  const { search: searchClientes } = useClientes(ventas)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [toasts, setToasts] = useState([])
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  
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
  const archivadas = useMemo(() => ventas.filter(v => v.status === 'archivada'), [ventas])
  const filteredVentas = useMemo(() => {
    return ventas.filter(v => {
      // Exclude borradas and archivadas globally from generic UI views
      if (v.status === 'borrada' || v.status === 'archivada') return false

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
          v.datos_fiscales?.cbte_asoc?.nro 
            ? `${String(v.datos_fiscales.cbte_asoc.pto_vta || 0).padStart(4, '0')}-${String(v.datos_fiscales.cbte_asoc.nro).padStart(8, '0')}` 
            : '',
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

  // ─── Action handlers ───
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

  const handleArchiveVenta = async (id) => {
    try {
      await archiveVenta(id)
      showToast('Venta archivada correctamente', 'success')
      setModalData(prev => ({
        ...prev,
        ventas: prev.ventas.filter(v => v.id !== id)
      }))
    } catch (err) {
      console.error('Error al archivar:', err)
      showToast('Error al archivar: ' + err.message, 'error')
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
    if (!confirm(`¿Estás seguro de que quieres reiniciar las ${ids.length} ventas seleccionadas?`)) return;
    try {
      for (const id of ids) {
        const v = ventas.find(x => x.id === id)
        const cleanDatosFiscales = v?.datos_fiscales ? {
          ...v.datos_fiscales,
          comprobante_numero: null,
          cae: null,
          cae_vto: null,
          afip_envio_fecha: null,
          error_detalle: null
        } : null
        await updateVenta(id, { status: 'pendiente', cae: null, nro_comprobante: null, vto_cae: null, datos_fiscales: cleanDatosFiscales })
      }
      showToast(`${ids.length} ventas reiniciadas correctamente`, 'success')
      setIsModalOpen(false) 
    } catch (err) {
      showToast('Error en reinicio masivo: ' + err.message, 'error')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedVentas.length === 0) return
    if (!confirm(`¿Mover ${selectedVentas.length} venta(s) a la papelera?`)) return
    for (const v of selectedVentas) { await deleteVenta(v.id) }
    setSelectedIds(new Set())
    showToast(`${selectedVentas.length} venta(s) eliminada(s)`, 'success')
  }

  const handleBulkArchive = async () => {
    if (selectedVentas.length === 0) return
    for (const v of selectedVentas) { await archiveVenta(v.id) }
    setSelectedIds(new Set())
    showToast(`${selectedVentas.length} venta(s) archivada(s)`, 'success')
  }

  const handleRetry = async (ventaId) => {
    try {
      await updateVenta(ventaId, { status: 'pendiente' })
      showToast('Venta restaurada a pendiente', 'info')
    } catch (err) {
      showToast('Error al reintentar: ' + err.message, 'error')
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/sync-payments')
      const data = await res.json()
      if (res.ok) {
        showToast(`Sync completado: ${data.inserted} nuevos, ${data.repaired} reparados`, 'success')
        refetch()
      } else {
        throw new Error(data.error || 'Error en sync')
      }
    } catch (err) {
      showToast('Error sincronizando: ' + err.message, 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleBulkRetry = async () => {
    const errorVentas = selectedVentas.filter(v => v.status === 'error')
    if (errorVentas.length === 0) return
    for (const v of errorVentas) { await updateVenta(v.id, { status: 'pendiente' }) }
    setSelectedIds(new Set())
    showToast(`${errorVentas.length} venta(s) restauradas a pendiente`, 'info')
  }

  const handleExportSelection = () => {
    if (selectedVentas.length === 0) return
    exportToCSV(selectedVentas, `ventas_seleccion_${new Date().toISOString().split('T')[0]}`)
    showToast(`${selectedVentas.length} venta(s) exportadas a CSV`, 'success')
  }

  const handleExportAll = (format) => {
    const data = filteredVentas.length > 0 ? filteredVentas : ventas
    const filename = `ventas_${new Date().toISOString().split('T')[0]}`
    if (format === 'csv') { exportToCSV(data, filename) } else { exportToExcel(data, filename) }
    showToast(`${data.length} ventas exportadas a ${format.toUpperCase()}`, 'success')
    setExportMenuOpen(false)
  }

  const handleInvoice = async (targetVentas = null) => {
    const toInvoice = targetVentas || selectedVentas.filter(v => v.status !== 'facturado')
    if (toInvoice.length === 0) {
      showToast('No hay ventas facturables seleccionadas', 'error')
      return
    }

    try {
      showToast('Emitiendo factura...', 'info')
      setVentas(prev => prev.map(v => toInvoice.some(tv => tv.id === v.id) ? { ...v, status: 'procesando' } : v))
      
      const response = await fetch('/api/afip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ventas: toInvoice.map(v => ({ id: v.id, fecha: v.fecha, cliente: v.cliente, monto: v.monto, datos_fiscales: v.datos_fiscales || {}, mp_payment_id: v.mp_payment_id })) }),
      });

      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Error del servidor')

      const resultados = data.resultados || []
      setVentas(prev => prev.map(v => {
        const res = resultados.find(r => r.id === v.id)
        if (res) {
          return res.success 
            ? { ...v, status: 'facturado', cae: res.cae, nro_comprobante: res.nro, pdf_url: res.pdf_url || null }
            : { ...v, status: 'error', datos_fiscales: { ...v.datos_fiscales, error_detalle: res.error } }
        }
        return v
      }))
      setSelectedIds(new Set())
      showToast('Proceso finalizado. Revisá los resultados en la tabla.', 'success')
    } catch (err) {
      showToast('Error al procesar: ' + err.message, 'error')
      setVentas(prev => prev.map(v => v.status === 'procesando' ? { ...v, status: 'error' } : v))
    }
  }

  const handleEmitSingleInvoice = async (id) => {
    const v = ventas.find(x => x.id === id)
    if (v) handleInvoice([v])
  }

  const handleRecoverAfip = async () => {
    try {
      showToast('Recuperando CAEs...', 'info');
      const res = await fetch('/api/recover');
      const data = await res.json();
      if (data.success) { showToast(`Recuperación finalizada: ${data.processed}`, 'success'); refetch(); } else { showToast('Error: ' + data.error, 'error'); }
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  };

  const handleEditVenta = async (id, payload) => {
    try { await updateVenta(id, payload); showToast('Datos actualizados', 'success'); } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  const handleCreateVenta = async (payload) => {
    try { await createVenta(payload); showToast('Venta agregada', 'success'); } catch (err) { showToast('Error: ' + err.message, 'error'); throw err; }
  }

  const handleAnularVenta = async (v) => {
    if (!confirm('¿Estás seguro de que querés anular esta factura? Se creará una Nota de Crédito pendiente para emitir.')) return
    
    try {
      const nroCompArr = (v.nro_comprobante || '0-0').split('-')
      const payload = {
        cliente: v.cliente,
        monto: v.monto,
        fecha: new Date().toISOString(),
        status: 'pendiente',
        datos_fiscales: {
          ...v.datos_fiscales,
          tipo_cbte: 13, // Nota de Crédito C
          cbte_asoc: {
            tipo: v.datos_fiscales?.tipo_cbte || 11,
            pto_vta: parseInt(nroCompArr[0]),
            nro: parseInt(nroCompArr[1]),
            fecha: v.datos_fiscales?.fecha_emision || v.fecha.split('T')[0]
          },
          comprobante_numero: null,
          cae: null,
          cae_vto: null,
          afip_envio_fecha: null,
          error_detalle: null
        }
      }
      await createVenta(payload)
      showToast('Nota de Crédito creada como pendiente', 'success')
      setDetailVenta(null)
    } catch (err) {
      showToast('Error al crear NC: ' + err.message, 'error')
    }
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      <div className="flex flex-col gap-1 w-[160px]">
        <button onClick={handleSync} disabled={isSyncing} className={`flex items-center justify-center gap-1.5 px-3 py-1 rounded-md bg-[#009EE3]/10 border border-[#009EE3]/30 text-[#009EE3] text-[9px] font-bold tracking-widest uppercase hover:bg-[#009EE3]/20 transition-all cursor-pointer w-full ${isSyncing ? 'opacity-70 cursor-not-allowed' : ''}`}>
          <RefreshCw size={10} className={isSyncing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Sincronizar MP/ML</span>
        </button>
        <button onClick={handleRecoverAfip} className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-md bg-green/10 border border-green/30 text-green text-[9px] font-bold tracking-widest uppercase hover:bg-green/20 transition-all w-full cursor-pointer">
          <ShieldCheck size={10} />
          <span className="hidden sm:inline">RECUPERAR CAEs</span>
        </button>
      </div>
    </div>
  )

  return (
    <Layout headerActions={headerActions}>
      <div className="space-y-6">
        {error && <div className="bg-red-subtle border border-red/20 rounded-xl px-4 py-3 text-red text-sm">Error: {error}</div>}
        <StatsCards ventas={ventas} onCardClick={handleCardClick} />

        <div>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-text-primary uppercase tracking-tight mb-4">Lista Facturas</h2>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center bg-white border border-border/60 rounded-xl p-1 h-[38px] w-full md:w-auto">
                <button onClick={() => handleCardClick('Archivo', archivadas, 'all')} className="flex-1 flex items-center justify-center h-full px-3 rounded-lg hover:bg-blue-subtle text-text-muted hover:text-blue transition-all cursor-pointer group">
                  <Archive size={14} /><span className="ml-2 text-[9px] font-bold uppercase tracking-widest">Archivo ({archivadas.length})</span>
                </button>
                <div className="w-px h-5 bg-border/40" />
                <button onClick={() => handleCardClick('LISTADO_PAPELERA', borradas, 'all')} className="flex-1 flex items-center justify-center h-full px-3 rounded-lg hover:bg-red-subtle text-text-muted hover:text-red transition-all cursor-pointer group">
                  <Trash2 size={14} /><span className="ml-2 text-[9px] font-bold uppercase tracking-widest">Papelera ({borradas.length})</span>
                </button>
              </div>

              <div className="grid grid-cols-2 md:flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-auto">
                  <button onClick={() => setExportMenuOpen(!exportMenuOpen)} className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white border border-border/60 text-text-secondary text-[9px] font-bold uppercase tracking-widest hover:border-blue/30 transition-all cursor-pointer w-full h-[38px]">
                    <Download size={13} className="text-text-muted" /><span className="truncate">Exportar</span><ChevronDown size={12} className={exportMenuOpen ? 'rotate-180' : ''} />
                  </button>
                  {exportMenuOpen && (
                    <div className="absolute right-0 mt-2 bg-white border border-border/40 rounded-xl shadow-xl z-50 min-w-[140px] overflow-hidden animate-slide-down">
                      <button onClick={() => handleExportAll('csv')} className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-blue/5 transition-colors cursor-pointer">CSV</button>
                      <button onClick={() => handleExportAll('xlsx')} className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-blue/5 transition-colors cursor-pointer">Excel</button>
                    </div>
                  )}
                </div>
                <button onClick={() => setBulkImportModalOpen(true)} className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white border border-border/60 text-text-secondary text-[9px] font-bold uppercase tracking-widest hover:border-blue/30 transition-all cursor-pointer h-[38px]">
                  <Download size={13} />Carga Masiva
                </button>
                <button onClick={() => setAddModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-text-primary text-white text-[9px] font-bold uppercase tracking-widest hover:shadow-lg transition-all cursor-pointer h-[38px] col-span-2 md:col-span-1">
                  <Plus size={13} className="text-yellow" />Nueva Venta
                </button>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <FilterBar filters={filters} onFilterChange={handleFilterChange} totalCount={ventas.length} filteredCount={filteredVentas.length} />
          </div>

          <SalesTable
            ventas={filteredVentas}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleAll={handleToggleAll}
            loading={loading}
            onShowError={(msg) => showToast(msg, 'error')}
            onRowClick={(v) => { setDetailVenta(v); setDetailVentaEditMode(false) }}
            onEdit={(v) => { setDetailVenta(v); setDetailVentaEditMode(v.status !== 'facturado') }}
            onSaveEdit={handleEditVenta}
            onRetry={handleRetry}
            onEmit={handleEmitSingleInvoice}
          />
        </div>

        <EmitirFacturaBar selectedCount={selectedIds.size} selectedVentas={selectedVentas} onEmitir={() => handleInvoice()} onClear={handleClearSelection} onExport={handleExportSelection} onBulkDelete={handleBulkDelete} onBulkRetry={handleBulkRetry} onBulkArchive={handleBulkArchive} />

        <SaleDetailDrawer venta={detailVenta} isOpen={!!detailVenta} onClose={() => { setDetailVenta(null); setDetailVentaEditMode(false) }} onRetry={handleRetry} onSave={handleEditVenta} onAnular={handleAnularVenta} initialEditMode={detailVentaEditMode} />
        <AddSaleModal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} onSave={handleCreateVenta} searchClientes={searchClientes} />
        <BulkImportModal isOpen={bulkImportModalOpen} onClose={() => setBulkImportModalOpen(false)} onSave={async (vm) => { await bulkCreateVentas(vm); await refetch(); showToast(`¡${vm.length} ventas importadas!`, 'success') }} />
        <SummaryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalData.title} ventas={modalData.ventas} onDelete={handleDeleteVenta} onRestore={handleRestoreVenta} onHardDelete={handleHardDeleteVenta} onReset={handleResetVenta} onResetAll={handleResetAllVentas} onShowError={(msg) => showToast(msg, 'error')} />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </Layout>
  )
}
