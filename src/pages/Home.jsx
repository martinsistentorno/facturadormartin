import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { hasEtiqueta } from '../utils/labelHelpers'
import { useVentas } from '../hooks/useVentas'
import { useClientes } from '../hooks/useClientes'
import EmitirFacturaBar from '../components/EmitirFacturaBar'
import SummaryModal from '../components/SummaryModal'
import Layout from '../components/Layout'
import SaleDetailDrawer from '../components/SaleDetailDrawer'
import ToastContainer, { createToast } from '../components/ToastContainer'
import AddSaleModal from '../components/AddSaleModal'
import BulkImportModal from '../components/BulkImportModal'
import { exportToCSV, exportToExcel } from '../utils/exportUtils'
import { translatePaymentMethod } from '../utils/paymentMethods'
import FacturasView from '../components/FacturasView'
import ContableView from '../components/ContableView'
import GestionView from '../components/GestionView'

export default function Home() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const { ventas, setVentas, loading, error, refetch, updateVentaStatus, updateVenta, createVenta, deleteVenta, hardDeleteVenta, archiveVenta, updateVentaEtiqueta, bulkCreateVentas } = useVentas(selectedYear)
  const { search: searchClientes } = useClientes(ventas)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [toasts, setToasts] = useState([])
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // ─── View Navigation State ───
  const [activeView, setActiveView] = useState('facturas')
  const [activeFilter, setActiveFilter] = useState(null)
  const [contableTableData, setContableTableData] = useState(null)
  const [customFolders, setCustomFolders] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cmd_folders') || '[]') } catch { return [] }
  })
  const [labels, setLabels] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cmd_labels') || '[]') } catch { return [] }
  })
  
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
  const archivadas = useMemo(() => ventas.filter(v => (v.archivada || v.status === 'archivada' || v.status === 'archivado') && v.status !== 'borrada'), [ventas])
  // ─── Base filtered ventas (Applies search and top bar filters only) ───
  const baseFilteredVentas = useMemo(() => {
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
          v.mp_payment_id ? `MeLi #${v.mp_payment_id.replace(/^order-/, '')}` : '',
          v.mp_payment_id ? `MP #${v.mp_payment_id.replace(/^order-/, '')}` : '',
          // Comprobante asociado
          v.datos_fiscales?.cbte_asoc?.nro ? `Asoc #${v.datos_fiscales.cbte_asoc.nro}` : '',
          v.datos_fiscales?.cbte_asoc?.pto_vta ? `${String(v.datos_fiscales.cbte_asoc.pto_vta).padStart(4, '0')}` : '',
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

  // ─── Filtered ventas (Excludes deleted/archived, used for stats/dashboards) ───
  const filteredVentas = useMemo(() => {
    return baseFilteredVentas.filter(v => {
      if (v.status === 'borrada') return false
      if (v.archivada || v.status === 'archivada' || v.status === 'archivado') return false
      return true
    })
  }, [baseFilteredVentas])

  // ─── Selected ventas data ───
  const selectedVentas = useMemo(() =>
    ventas.filter(v => selectedIds.has(String(v.id))),
    [ventas, selectedIds]
  )

  // ─── Marcar como leída al DESELECCIONAR (estilo correo) ───
  // Una venta "no leída" pasa a "leída" cuando el usuario la deselecciona,
  // no apenas la clickea. Así no salta de la sección "No leídos" a "Todo lo
  // demás" mientras todavía la está mirando. Cubre todas las vías de deselección
  // (click en fila, checkbox, botón Limpiar, acciones masivas).
  const prevSelectedRef = useRef(new Set())
  useEffect(() => {
    const prev = prevSelectedRef.current
    const deselected = []
    prev.forEach(id => { if (!selectedIds.has(id)) deselected.push(id) })
    prevSelectedRef.current = new Set(selectedIds)
    if (deselected.length === 0) return

    deselected.forEach(id => {
      const v = ventas.find(x => String(x.id) === String(id))
      if (v && v.leido === false) {
        updateVenta(v.id, { leido: true }).catch(err =>
          console.error('[leido] No se pudo marcar como leída:', err.message)
        )
      }
    })
  }, [selectedIds, ventas, updateVenta])

  const handleCardClick = (title, filteredVentas, timeframe) => {
    let tfLabel = ''
    if (timeframe === 'day') tfLabel = ' (Hoy)'
    if (timeframe === 'week') tfLabel = ' (Esta Sem)'
    if (timeframe === 'month') tfLabel = ' (Este Mes)'
    if (timeframe === 'year') tfLabel = ' (Año Fiscal)'
    if (timeframe === 'all') tfLabel = ' (Histórico)'

    let mTitle = title;
    if (title === 'LISTADO_PAPELERA') mTitle = 'Papelera de Reciclaje'

    setModalData({ title: `${mTitle}${tfLabel}`, ventas: filteredVentas })
    setIsModalOpen(true)
  }

  const handleContableCardClick = (title, filteredVentas, timeframe) => {
    let tfLabel = ''
    if (timeframe === 'day') tfLabel = ' (Hoy)'
    if (timeframe === 'week') tfLabel = ' (Esta Sem)'
    if (timeframe === 'month') tfLabel = ' (Este Mes)'
    if (timeframe === 'year') tfLabel = ' (Año Fiscal)'
    if (timeframe === 'all') tfLabel = ' (Histórico)'

    setContableTableData({ title: `${title}${tfLabel}`, baseTitle: title, ventas: filteredVentas })
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
    const seleccionables = viewFilteredVentas
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
  const showToast = useCallback((message, type = 'success', duration = 4000, action = null) => {
    setToasts(prev => [...prev, createToast(message, type, duration, action)])
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

  const handleBulkDelete = async () => {
    const count = selectedVentas.length
    if (count === 0) {
      showToast('No hay ventas seleccionadas válidas', 'error')
      return
    }

    const idsToProcess = selectedVentas.map(v => String(v.id))
    
    setVentas(prev => prev.map(v => 
      idsToProcess.includes(String(v.id)) ? { ...v, status: 'borrada', archivada: false } : v
    ))

    setSelectedIds(new Set())
    showToast(`${count} venta(s) movida(s) a la papelera`, 'success')
  }

  // ─── Archive handler ───
  const handleArchiveVenta = async (id) => {
    try {
      await archiveVenta(String(id))
      showToast('Venta archivada correctamente', 'success')
      setModalData(prev => ({
        ...prev,
        ventas: prev.ventas.filter(v => String(v.id) !== String(id))
      }))
    } catch (err) {
      console.error('Error al archivar:', err)
      showToast('Error al archivar: ' + err.message, 'error')
    }
  }

  const handleBulkArchive = async () => {
    const count = selectedIds.size
    if (count === 0) {
      showToast('No hay ventas seleccionadas', 'error')
      return
    }

    const idsToProcess = Array.from(selectedIds).map(id => String(id))
    const allArchived = selectedVentas.every(v => v.archivada)
    
    setVentas(prev => prev.map(v => 
      idsToProcess.includes(String(v.id)) ? { ...v, archivada: !allArchived } : v
    ))
    
    setSelectedIds(new Set())
    showToast(
      allArchived 
        ? `${count} venta(s) desarchivada(s)` 
        : `${count} venta(s) archivada(s) correctamente`, 
      'success'
    )
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

  // ─── Sync handler ───
  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/sync-payments', { method: 'GET' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`)
      }
      const inserted = data.inserted ?? 0
      const repaired = data.repaired ?? 0
      const skipped = data.skipped ?? 0
      showToast(
        `Sync completado: ${inserted} nuevos, ${repaired} reparados, ${skipped} ya existían`,
        'success'
      )
      await refetch() // Recargar ventas de la DB
    } catch (err) {
      console.error('[handleSync] Error:', err)
      showToast('Error sincronizando: ' + err.message, 'error')
    } finally {
      setIsSyncing(false)
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

  // ─── Emitir Factura handler (Single) ───
  const handleEmitSingleInvoice = async (id) => {
    const ventaTarget = ventas.find(v => String(v.id) === String(id))
    if (!ventaTarget || ventaTarget.status === 'facturado') return

    try {
      showToast('Emitiendo factura...', 'info')
      setVentas(prev => prev.map(v => String(v.id) === String(id) ? { ...v, status: 'procesando' } : v))

      const payload = {
        ventas: [{
          id: ventaTarget.id,
          fecha: ventaTarget.fecha,
          cliente: ventaTarget.cliente,
          monto: ventaTarget.monto,
          datos_fiscales: ventaTarget.datos_fiscales || {},
          cbte_asoc: ventaTarget.datos_fiscales?.cbte_asoc || null,
          mp_payment_id: ventaTarget.mp_payment_id,
        }],
      }

      const response = await fetch('/api/afip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`)
      }

      const res = (data.resultados || []).find(r => String(r.id) === String(id))

      if (res?.success) {
        setVentas(prev => prev.map(v => String(v.id) === String(id) ? {
          ...v,
          status: 'facturado',
          cae: res.cae,
          nro_comprobante: res.nro,
          pdf_url: res.pdf_url || null,
        } : v))
        showToast(`✓ Comprobante emitido con éxito`, 'success')
      } else {
        setVentas(prev => prev.map(v => String(v.id) === String(id) ? {
          ...v,
          status: 'error',
          datos_fiscales: { ...v.datos_fiscales, error_detalle: res?.error || 'Error desconocido al emitir' },
        } : v))
        showToast(`Error al emitir factura: ${res?.error || 'desconocido'}`, 'error')
      }

      refetch()
    } catch (err) {
      setVentas(prev => prev.map(v => String(v.id) === String(id) ? { ...v, status: 'error' } : v))
      showToast('Error: ' + err.message, 'error')
    }
  }

  // ─── Emitir Factura handler (Bulk) ───
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
          cbte_asoc: v.datos_fiscales?.cbte_asoc || null,
          mp_payment_id: v.mp_payment_id,
        })),
      }

      const response = await fetch('/api/afip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`)
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

      // Sincronizar con la DB tras el update local (defensa contra desincronización)
      refetch()

      const successIds = resultados.filter(r => r.success).map(r => r.id)

      if (successCount === resultados.length && successCount > 0) {
        showToast(
          `✓ ${successCount} comprobante(s) emitido(s) con éxito`,
          'success',
          8000,
          {
            label: 'Ver Facturas',
            onClick: () => {
              handleViewChange('facturas', { type: 'status', value: 'facturado' })
              setSelectedIds(new Set(successIds))
            }
          }
        )
      } else if (successCount > 0) {
        showToast(
          `${successCount} de ${resultados.length} emitidas. Algunos fallaron.`,
          'warning',
          8000,
          {
            label: 'Ver Facturas',
            onClick: () => {
              handleViewChange('facturas', { type: 'status', value: 'facturado' })
              setSelectedIds(new Set(successIds))
            }
          }
        )
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
      showToast('Iniciando recuperación de AFIP... (puede tardar varios segundos)', 'info')
      const response = await fetch('/api/recover', { method: 'POST' })
      const data = await response.json()
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${response.status}`)
      }
      const processed = data.processed ?? 0
      showToast(`✓ Recuperación finalizada. Procesadas: ${processed}`, 'success')
      await refetch() // Recargar datos
    } catch (err) {
      console.error('[handleRecoverAfip] Error:', err)
      showToast('Error de conexión: ' + err.message, 'error')
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

  const handleBulkMove = async (folderId) => {
    try {
      const ids = Array.from(selectedIds)
      for (const id of ids) {
        await updateVenta(id, { folder: folderId })
      }
      setSelectedIds(new Set())
      showToast(`Movidas ${ids.length} ventas`, 'success')
    } catch (err) {
      showToast('Error al mover ventas', 'error')
    }
  }

  const handleBulkTag = async (etiqueta) => {
    try {
      const ids = Array.from(selectedIds)
      for (const id of ids) {
        await updateVentaEtiqueta(id, etiqueta)
      }
      setSelectedIds(new Set())
      showToast(`Etiquetadas ${ids.length} ventas`, 'success')
    } catch (err) {
      showToast('Error al etiquetar ventas', 'error')
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


  // ─── View Navigation ───
  const handleViewChange = (view, filter = null) => {
    setActiveView(view)
    setActiveFilter(filter)
    if (filter?.type === 'status') {
      setFilters(prev => ({ ...prev, status: filter.value === 'pendiente' ? 'pendiente' : filter.value }))
    } else if (!filter) {
      setFilters(prev => ({ ...prev, status: '' }))
    }
  }

  // ─── Helper: get all descendant folder IDs ───
  const getDescendantIds = (folderId, folders) => {
    const children = folders.filter(f => f.parentId === folderId)
    let ids = [folderId]
    children.forEach(child => {
      ids = [...ids, ...getDescendantIds(child.id, folders)]
    })
    return ids
  }

  // ─── Filtered ventas for active filter (Table View) ───
  const viewFilteredVentas = useMemo(() => {
    if (!activeFilter) {
      // Default Inbox view (Pendientes + Error)
      return filteredVentas.filter(v => (v.status === 'pendiente' || v.status === 'procesando' || v.status === 'error') && !v.folder)
    }
    if (activeFilter.type === 'historico') {
      return filteredVentas
    }
    if (activeFilter.type === 'status') {
      const st = activeFilter.value
      // Archived: Search inside baseFilteredVentas (which includes archived but respects top filters)
      if (st === 'archivada') {
        return baseFilteredVentas.filter(v => (v.archivada || v.status === 'archivada' || v.status === 'archivado') && v.status !== 'borrada')
      }
      if (st === 'borrada') {
        return baseFilteredVentas.filter(v => v.status === 'borrada')
      }
      // Other statuses (Facturado, Pendiente, Error): Search inside filteredVentas
      return filteredVentas.filter(v => v.status === st)
    }
    if (activeFilter.type === 'folder') {
      const folderIds = getDescendantIds(activeFilter.value, customFolders)
      return filteredVentas.filter(v => folderIds.includes(v.folder))
    }
    if (activeFilter.type === 'label') {
      return filteredVentas.filter(v => hasEtiqueta(v, activeFilter.value))
    }
    return filteredVentas
  }, [activeFilter, filteredVentas, baseFilteredVentas, customFolders])

  // ─── Folder CRUD ───
  const handleCreateFolder = (name, parentId = null) => {
    const folder = { id: Date.now().toString(), name, parentId }
    const updated = [...customFolders, folder]
    setCustomFolders(updated)
    localStorage.setItem('cmd_folders', JSON.stringify(updated))
  }
  const handleDeleteFolder = (id) => {
    const idsToDelete = getDescendantIds(id, customFolders)
    const updated = customFolders.filter(f => !idsToDelete.includes(f.id))
    setCustomFolders(updated)
    localStorage.setItem('cmd_folders', JSON.stringify(updated))
  }

  // ─── Label CRUD ───
  const handleCreateLabel = ({ name, colorId }) => {
    const label = { id: Date.now().toString(), name, colorId }
    const updated = [...labels, label]
    setLabels(updated)
    localStorage.setItem('cmd_labels', JSON.stringify(updated))
  }
  const handleDeleteLabel = (id) => {
    const updated = labels.filter(l => l.id !== id)
    setLabels(updated)
    localStorage.setItem('cmd_labels', JSON.stringify(updated))
  }

  // ─── Drag & Drop handler from Sidebar ───
  const handleSidebarDrop = useCallback((ids, action) => {
    const count = ids.length
    if (action.type === 'trash') {
      setVentas(prev => prev.map(v =>
        ids.includes(v.id) ? { ...v, status: 'borrada', archivada: false } : v
      ))
      setSelectedIds(new Set())
      showToast(`${count} venta(s) movida(s) a la papelera`, 'success')
    } else if (action.type === 'archive') {
      setVentas(prev => prev.map(v =>
        ids.includes(v.id) ? { ...v, archivada: true } : v
      ))
      setSelectedIds(new Set())
      showToast(`${count} venta(s) archivada(s)`, 'success')
    } else if (action.type === 'folder') {
      setVentas(prev => prev.map(v =>
        ids.includes(v.id) ? { ...v, folder: action.value } : v
      ))
      setSelectedIds(new Set())
      const folderName = customFolders.find(f => f.id === action.value)?.name || 'carpeta'
      showToast(`${count} venta(s) movida(s) a "${folderName}"`, 'success')
    } else if (action.type === 'label') {
      setVentas(prev => prev.map(v => {
        if (!ids.includes(v.id)) return v
        const current = Array.isArray(v.etiquetas) ? v.etiquetas : (v.etiqueta ? [v.etiqueta] : [])
        if (current.includes(action.value)) return v
        const next = [...current, action.value]
        return { ...v, etiquetas: next, etiqueta: next[0] || '' }
      }))
      setSelectedIds(new Set())
      showToast(`Etiqueta "${action.value}" aplicada a ${count} venta(s)`, 'success')
    }
  }, [ventas, customFolders, showToast])

  return (
    <Layout 
      onSyncMeli={handleSync}
      onRecoverCAEs={handleRecoverAfip}
      activeView={activeView}
      onViewChange={handleViewChange}
      ventas={ventas}
      customFolders={customFolders}
      labels={labels}
      onCreateFolder={handleCreateFolder}
      onDeleteFolder={handleDeleteFolder}
      onCreateLabel={handleCreateLabel}
      onDeleteLabel={handleDeleteLabel}
      onNewVenta={() => setAddModalOpen(true)}
      activeFilter={activeFilter}
      onDrop={handleSidebarDrop}
      selectedYear={selectedYear}
      onYearChange={setSelectedYear}
    >
      <div>

      {/* ─── Error banner ─── */}
      {error && (
        <div className="bg-red-subtle border border-red/20 rounded-xl px-4 py-3 text-red text-sm animate-slide-down mb-6">
          Error cargando ventas: {error}
        </div>
      )}

      {/* ─── View Switch ─── */}
      {activeView === 'facturas' && (
        <FacturasView
          ventas={ventas}
          filteredVentas={viewFilteredVentas}
          filters={filters}
          onFilterChange={handleFilterChange}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleAll={handleToggleAll}
          loading={loading}
          onShowError={(msg) => showToast(msg, 'error')}
          onRowClick={(venta) => handleToggleSelect(venta.id)}
          onEdit={(venta) => {
            setDetailVenta(venta)
            setDetailVentaEditMode(venta.status !== 'facturado')
          }}
          onSaveEdit={handleEditVenta}
          onRetry={handleRetry}
          onEmit={handleEmitSingleInvoice}
          onBulkImport={() => setBulkImportModalOpen(true)}
          onNewVenta={() => setAddModalOpen(true)}
          activeFilter={activeFilter}
          labels={labels}
          customFolders={customFolders}
          onDelete={deleteVenta}
          onArchive={archiveVenta}
          onRestore={(id) => updateVentaStatus(id, 'facturado')}
          onHardDelete={handleHardDeleteVenta}
        />
      )}

      {activeView === 'contable' && (
        <ContableView 
          allVentas={ventas}
          ventas={filteredVentas} 
          filters={filters}
          onFilterChange={handleFilterChange}
          onCardClick={handleContableCardClick} 
          tableData={contableTableData}
          selectedIds={selectedIds}
          selectedVentas={selectedVentas}
          onToggleSelect={handleToggleSelect}
          onToggleAll={() => {
            const seleccionables = contableTableData?.ventas || []
            if (selectedIds.size === seleccionables.length && seleccionables.length > 0) {
              setSelectedIds(new Set())
            } else {
              setSelectedIds(new Set(seleccionables.map(v => String(v.id))))
            }
          }}
          loading={loading}
          onShowError={(msg) => showToast(msg, 'error')}
          onRowClick={(venta) => handleToggleSelect(venta.id)}
          onEdit={(venta) => {
            setDetailVenta(venta)
            setDetailVentaEditMode(venta.status !== 'facturado')
          }}
          onSaveEdit={handleEditVenta}
          onRetry={handleRetry}
          onEmit={handleEmitSingleInvoice}
          labels={labels}
          customFolders={customFolders}
          onDelete={deleteVenta}
          onArchive={archiveVenta}
          onRestore={(id) => updateVentaStatus(id, 'facturado')}
          onHardDelete={handleHardDeleteVenta}
        />
      )}

      {activeView === 'gestion' && (
        <GestionView
          ventas={ventas}
          customFolders={customFolders}
          labels={labels}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onCreateLabel={handleCreateLabel}
          onDeleteLabel={handleDeleteLabel}
          onNavigate={handleViewChange}
        />
      )}

      {/* ─── Floating action bar ─── */}
      <EmitirFacturaBar
        selectedCount={selectedIds.size}
        selectedVentas={selectedVentas}
        onEmitir={handleInvoice}
        onClear={handleClearSelection}
        onExport={handleExportSelection}
        onBulkDelete={activeFilter?.value === 'borrada' ? null : handleBulkDelete}
        onBulkRetry={handleBulkRetry}
        onBulkArchive={handleBulkArchive}
        customFolders={customFolders}
        labels={labels}
        onBulkMove={handleBulkMove}
        onBulkTag={handleBulkTag}
        onPermanentDelete={activeFilter?.value === 'borrada' ? () => {
          const count = selectedVentas.length
          if (count === 0) return
          const ids = selectedVentas.map(v => String(v.id))
          setVentas(prev => prev.filter(v => !ids.includes(String(v.id))))
          setSelectedIds(new Set())
          showToast(`${count} venta(s) eliminada(s) definitivamente`, 'success')
        } : null}
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
        customFolders={customFolders}
        labels={labels}
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
        onArchive={handleArchiveVenta}
        onUpdateEtiqueta={updateVentaEtiqueta}
      />

      {/* ─── Toasts ─── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </Layout>
  )
}
