import { useState, useMemo, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
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
  const { ventas, setVentas, loading, error, refetch, updateVentaStatus, updateVenta, createVenta, deleteVenta, hardDeleteVenta, archiveVenta, updateVentaEtiqueta, bulkCreateVentas } = useVentas()
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

  // ─── Supabase UI Config Sync ───
  useEffect(() => {
    const loadUIConfig = async () => {
      try {
        const { data, error } = await supabase.from('ui_config').select('*')
        if (!error && data) {
          const folders = data.find(c => c.key === 'folders')?.value
          const lbs = data.find(c => c.key === 'labels')?.value
          if (folders) setCustomFolders(folders)
          if (lbs) setLabels(lbs)
        }
      } catch (err) {
        console.error('Error cargando config desde Supabase:', err)
      }
    }
    loadUIConfig()
  }, [])

  const saveUIConfig = async (key, value) => {
    // Guardar en localStorage como backup rápido
    localStorage.setItem(`cmd_${key}`, JSON.stringify(value))
    
    // Guardar en Supabase para persistencia profesional
    try {
      await supabase
        .from('ui_config')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    } catch (err) {
      console.warn(`No se pudo sincronizar ${key} con Supabase.`, err)
    }
  }
  
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
  const archivadas = useMemo(() => ventas.filter(v => v.archivada || v.status === 'archivada' || v.status === 'archivado'), [ventas])
  const filteredVentas = useMemo(() => {
    return ventas.filter(v => {
      // Exclude borradas and archivadas globally from generic UI views
      if (v.status === 'borrada') return false
      if (v.archivada || v.status === 'archivada' || v.status === 'archivado') return false

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

  // ─── Selected ventas data ───
  const selectedVentas = useMemo(() =>
    ventas.filter(v => selectedIds.has(String(v.id))),
    [ventas, selectedIds]
  )

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

  const handleBulkDelete = async () => {
    const count = selectedVentas.length
    if (count === 0) {
      showToast('No hay ventas seleccionadas válidas', 'error')
      return
    }

    try {
      for (const v of selectedVentas) {
        await deleteVenta(v.id)
      }
      setSelectedIds(new Set())
      showToast(`${count} venta(s) movida(s) a la papelera`, 'success')
    } catch (err) {
      showToast('Error al eliminar: ' + err.message, 'error')
    }
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

    try {
      const ids = Array.from(selectedIds)
      for (const id of ids) {
        await archiveVenta(String(id))
      }
      setSelectedIds(new Set())
      showToast(`${count} venta(s) archivada(s) correctamente`, 'success')
    } catch (err) {
      showToast('Error al archivar: ' + err.message, 'error')
    }
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
      showToast('Sincronizando con MP...', 'info');
      const res = await fetch('/api/sync-payments');
      const data = await res.json();
      if (data.success) {
        showToast(`Sync: ${data.inserted} nuevos, ${data.repaired} reparados`, 'success');
        refetch();
      } else {
        showToast('Error: ' + data.error, 'error');
      }
    } catch (err) {
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
    const v = ventas.find(x => String(x.id) === String(id))
    if (v) handleInvoice([v])
  }

  // ─── Emitir Factura handler (Bulk) ───
  const handleInvoice = async (specificVentas = null) => {
    const toInvoice = specificVentas || ventas.filter(v => selectedIds.has(String(v.id)) && v.status !== 'facturado')
    if (toInvoice.length === 0) {
      showToast('No hay ventas pendientes seleccionadas', 'error')
      return
    }

    try {
      showToast('Emitiendo comprobantes...', 'info')
      const targetIds = toInvoice.map(v => v.id)
      setVentas(prev => prev.map(v => targetIds.includes(v.id) ? { ...v, status: 'procesando' } : v))
      
      const payload = {
        ventas: toInvoice.map(v => ({
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

      if (!specificVentas) setSelectedIds(new Set())
      
      if (successCount === resultados.length && successCount > 0) {
        showToast(`✓ ${successCount} comprobantes emitidos`, 'success')
      } else if (successCount > 0) {
        showToast(`${successCount} de ${resultados.length} emitidas. Algunos fallaron.`, 'warning')
      } else {
        showToast('No se emitió ningún comprobante. Revisá los errores.', 'error')
      }
    } catch (err) {
      console.error('[handleInvoice] Error:', err.message)
      showToast('Error al procesar facturas: ' + err.message, 'error')
      setVentas(prev => prev.map(v => v.status === 'procesando' ? { ...v, status: 'error' } : v))
    }
  }

  const handleAnularVenta = async (v) => {
    if (!confirm('¿Estás seguro de que querés anular esta factura?')) return
    try {
      const nroCompArr = (v.nro_comprobante || '0-0').split('-')
      const tipoOriginal = v.datos_fiscales?.tipo_cbte || 11
      let tipoNC = 13
      if (tipoOriginal === 1) tipoNC = 3
      if (tipoOriginal === 6) tipoNC = 8

      await createVenta({
        cliente: v.cliente,
        monto: v.monto,
        fecha: new Date().toISOString(),
        status: 'pendiente',
        datos_fiscales: {
          ...v.datos_fiscales,
          tipo_cbte: tipoNC,
          cbte_asoc: {
            tipo: tipoOriginal,
            pto_vta: parseInt(nroCompArr[0]),
            nro: parseInt(nroCompArr[1]),
            fecha: v.datos_fiscales?.fecha_emision || v.fecha.split('T')[0]
          },
          comprobante_numero: null, cae: null, cae_vto: null, afip_envio_fecha: null, error_detalle: null
        }
      })
      showToast('Nota de Crédito creada como pendiente', 'success')
      setDetailVenta(null)
    } catch (err) { showToast('Error: ' + err.message, 'error') }
  }

  const handleBulkAnular = async () => {
    const selectedVentasArr = ventas.filter(v => selectedIds.has(String(v.id)))
    const toAnular = selectedVentasArr.filter(v => v.status === 'facturado')
    if (toAnular.length === 0) return
    if (!confirm(`¿Estás seguro de que querés anular las ${toAnular.length} facturas?`)) return
    
    try {
      const payloads = toAnular.map(v => {
        const nroCompArr = (v.nro_comprobante || '0-0').split('-')
        const tipoOriginal = v.datos_fiscales?.tipo_cbte || 11
        let tipoNC = 13
        if (tipoOriginal === 1) tipoNC = 3
        if (tipoOriginal === 6) tipoNC = 8
        return {
          cliente: v.cliente, monto: v.monto, fecha: new Date().toISOString(), status: 'pendiente',
          datos_fiscales: {
            ...v.datos_fiscales, tipo_cbte: tipoNC,
            cbte_asoc: {
              tipo: tipoOriginal, pto_vta: parseInt(nroCompArr[0]), nro: parseInt(nroCompArr[1]),
              fecha: v.datos_fiscales?.fecha_emision || v.fecha.split('T')[0]
            },
            comprobante_numero: null, cae: null, cae_vto: null, afip_envio_fecha: null, error_detalle: null
          }
        }
      })
      await bulkCreateVentas(payloads)
      showToast(`${toAnular.length} Notas de Crédito creadas`, 'success')
      setSelectedIds(new Set())
    } catch (err) { showToast('Error en anulación masiva: ' + err.message, 'error') }
  }

  const handleRecoverAfip = async () => {
    try {
      showToast('Recuperando CAEs...', 'info');
      const res = await fetch('/api/recover');
      const data = await res.json();
      if (data.success) {
        showToast(`Recuperación finalizada: ${data.processed}`, 'success');
        refetch();
      } else {
        showToast('Error: ' + data.error, 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
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

  // ─── Filtered ventas for active filter ───
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
      return ventas.filter(v => {
        if (st === 'archivada') return v.archivada || v.status === 'archivada' || v.status === 'archivado'
        return v.status === st && !v.archivada && v.status !== 'archivada' && v.status !== 'archivado'
      })
    }
    if (activeFilter.type === 'folder') {
      const folderIds = getDescendantIds(activeFilter.value, customFolders)
      return ventas.filter(v => folderIds.includes(v.folder))
    }
    if (activeFilter.type === 'label') {
      return ventas.filter(v => hasEtiqueta(v, activeFilter.value))
    }
    return filteredVentas
  }, [activeFilter, filteredVentas, ventas, customFolders])

  // ─── Folder CRUD ───
  const handleCreateFolder = (name, parentId = null) => {
    const folder = { id: Date.now().toString(), name, parentId }
    const updated = [...customFolders, folder]
    setCustomFolders(updated)
    saveUIConfig('folders', updated)
  }
  const handleDeleteFolder = (id) => {
    const idsToDelete = getDescendantIds(id, customFolders)
    const updated = customFolders.filter(f => !idsToDelete.includes(f.id))
    setCustomFolders(updated)
    saveUIConfig('folders', updated)
  }

  // ─── Label CRUD ───
  const handleCreateLabel = ({ name, colorId }) => {
    const label = { id: Date.now().toString(), name, colorId }
    const updated = [...labels, label]
    setLabels(updated)
    saveUIConfig('labels', updated)
  }
  const handleDeleteLabel = (id) => {
    const updated = labels.filter(l => l.id !== id)
    setLabels(updated)
    saveUIConfig('labels', updated)
  }

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
          onRowClick={(venta) => {
            setDetailVenta(venta)
            setDetailVentaEditMode(false)
          }}
          onEdit={(venta) => {
            setDetailVenta(venta)
            setDetailVentaEditMode(venta.status !== 'facturado')
          }}
          onSaveEdit={handleEditVenta}
          onRetry={handleRetry}
          onEmit={handleEmitSingleInvoice}
          onExportAll={(format) => {
            const data = viewFilteredVentas.length > 0 ? viewFilteredVentas : ventas
            const filename = `ventas_${new Date().toISOString().split('T')[0]}`
            if (format === 'csv') exportToCSV(data, filename)
            else exportToExcel(data, filename)
            showToast(`${data.length} ventas exportadas a ${format.toUpperCase()}`, 'success')
          }}
          onBulkImport={() => setBulkImportModalOpen(true)}
          onNewVenta={() => setAddModalOpen(true)}
          activeFilter={activeFilter}
          labels={labels}
          customFolders={customFolders}
        />
      )}

      {activeView === 'contable' && (
        <ContableView 
          ventas={filteredVentas}
          allVentas={ventas}
          selectedVentas={selectedVentas}
          filters={filters}
          onFilterChange={handleFilterChange}
          onCardClick={handleContableCardClick} 
          tableData={contableTableData}
          selectedIds={selectedIds}
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
          onRowClick={(venta) => {
            setDetailVenta(venta)
            setDetailVentaEditMode(false)
          }}
          onEdit={(venta) => {
            setDetailVenta(venta)
            setDetailVentaEditMode(venta.status !== 'facturado')
          }}
          onSaveEdit={handleEditVenta}
          onRetry={handleRetry}
          onEmit={handleEmitSingleInvoice}
          labels={labels}
          customFolders={customFolders}
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
        onBulkDelete={handleBulkDelete}
        onBulkRetry={handleBulkRetry}
        onBulkArchive={handleBulkArchive}
        onBulkAnular={handleBulkAnular}
        customFolders={customFolders}
        labels={labels}
        onBulkMove={handleBulkMove}
        onBulkTag={handleBulkTag}
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
        onAnular={handleAnularVenta}
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
