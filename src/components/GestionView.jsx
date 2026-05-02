import { useState, useMemo } from 'react'
import { 
  FolderKanban, FolderPlus, Tag, X, Plus, ChevronRight, ChevronDown,
  Search, Users, TrendingUp, Calendar, FileText, ArrowUpDown
} from 'lucide-react'
import { LABEL_COLORS } from '../config/colors'
import { hasEtiqueta } from '../utils/labelHelpers'
import AnalyticsDashboard from './AnalyticsDashboard'

export default function GestionView({ 
  ventas = [],
  customFolders = [],
  labels = [],
  onCreateFolder,
  onDeleteFolder,
  onCreateLabel,
  onDeleteLabel,
  onNavigate,
}) {
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParentId, setNewFolderParentId] = useState(null)
  const [showNewLabel, setShowNewLabel] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0].id)
  const [clientSearch, setClientSearch] = useState('')
  const [sortBy, setSortBy] = useState('total')
  const [selectedClient, setSelectedClient] = useState(null)

  // ─── Build client directory from ventas ───
  const clients = useMemo(() => {
    const map = new Map()
    ventas.forEach(v => {
      if (v.status === 'borrada') return
      const nombre = v.cliente?.trim()
      if (!nombre) return
      if (!map.has(nombre)) {
        map.set(nombre, { nombre, cuit: '', totalFacturado: 0, totalVentas: 0, cantFacturas: 0, cantTotal: 0, ultimaFecha: null, ventas: [] })
      }
      const c = map.get(nombre)
      if (!c.cuit && v.datos_fiscales?.cuit) c.cuit = v.datos_fiscales.cuit
      c.cantTotal++
      c.ventas.push(v)
      if (v.status === 'facturado') {
        c.totalFacturado += Number(v.monto) || 0
        c.cantFacturas++
      }
      c.totalVentas += Number(v.monto) || 0
      const fecha = v.fecha ? new Date(v.fecha) : null
      if (fecha && (!c.ultimaFecha || fecha > c.ultimaFecha)) c.ultimaFecha = fecha
    })
    return Array.from(map.values())
  }, [ventas])

  const sortedClients = useMemo(() => {
    let filtered = clients
    if (clientSearch) {
      const q = clientSearch.toLowerCase()
      filtered = clients.filter(c => c.nombre.toLowerCase().includes(q) || c.cuit.includes(q))
    }
    const sorted = [...filtered]
    if (sortBy === 'total') sorted.sort((a, b) => b.totalFacturado - a.totalFacturado)
    else if (sortBy === 'count') sorted.sort((a, b) => b.cantTotal - a.cantTotal)
    else if (sortBy === 'name') sorted.sort((a, b) => a.nombre.localeCompare(b.nombre))
    else if (sortBy === 'recent') sorted.sort((a, b) => (b.ultimaFecha || 0) - (a.ultimaFecha || 0))
    return sorted
  }, [clients, clientSearch, sortBy])

  const top5 = useMemo(() => {
    return [...clients].sort((a, b) => b.totalFacturado - a.totalFacturado).slice(0, 5)
  }, [clients])

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder?.(newFolderName.trim(), newFolderParentId)
      setNewFolderName('')
      setNewFolderParentId(null)
      setShowNewFolder(false)
    }
  }

  const handleCreateLabel = () => {
    if (newLabelName.trim()) {
      onCreateLabel?.({ name: newLabelName.trim(), colorId: newLabelColor })
      setNewLabelName('')
      setNewLabelColor(LABEL_COLORS[0].id)
      setShowNewLabel(false)
    }
  }

  const formatMoney = (n) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <div>
      {/* ─── ANALYTICS DASHBOARD ─── */}
      <AnalyticsDashboard ventas={ventas} />

      {/* ─── TOP 5 CLIENTS ─── */}
      {top5.length > 0 && (
        <div className="mb-8">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-4 px-1 flex items-center gap-2">
            <TrendingUp size={13} /> Top Clientes
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {top5.map((c, i) => (
              <button
                key={c.nombre}
                onClick={() => setSelectedClient(selectedClient?.nombre === c.nombre ? null : c)}
                className={`bg-white border rounded-2xl p-4 flex flex-col gap-2 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer text-left group
                  ${selectedClient?.nombre === c.nombre ? 'border-blue shadow-md' : 'border-border/40 hover:border-border'}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="w-7 h-7 rounded-full bg-blue/10 text-blue flex items-center justify-center text-[10px] font-black">
                    #{i + 1}
                  </div>
                  <span className="text-[10px] text-text-muted font-bold">{c.cantFacturas} fact.</span>
                </div>
                <div className="text-[11px] font-bold text-text-primary truncate">{c.nombre}</div>
                <div className="text-base font-black text-green tracking-tight">{formatMoney(c.totalFacturado)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── CLIENT DIRECTORY ─── */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 px-1">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted flex items-center gap-2">
            <Users size={13} /> Directorio ({clients.length})
          </h3>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Buscar cliente o CUIT..."
                className="pl-8 pr-3 py-1.5 text-xs border border-border/60 rounded-lg bg-white focus:outline-none focus:border-blue w-[200px]"
              />
            </div>
            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-border/60 rounded-lg bg-white text-text-muted focus:outline-none focus:border-blue cursor-pointer"
            >
              <option value="total">Mayor facturación</option>
              <option value="count">Más operaciones</option>
              <option value="recent">Más reciente</option>
              <option value="name">Alfabético</option>
            </select>
          </div>
        </div>

        {/* Client table */}
        <div className="bg-white border border-border/40 rounded-2xl overflow-hidden shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_100px_80px_100px] gap-2 px-4 py-2.5 bg-surface-alt/50 border-b border-border/30 text-[9px] font-black uppercase tracking-[0.15em] text-text-muted">
            <span>Cliente</span>
            <span className="text-right">Total Facturado</span>
            <span className="text-right">Total Ventas</span>
            <span className="text-center">Facturas</span>
            <span className="text-right">Última Act.</span>
          </div>

          {/* Rows */}
          <div className="max-h-[400px] overflow-y-auto">
            {sortedClients.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-text-muted">
                {clientSearch ? 'Sin resultados para esa búsqueda' : 'No hay clientes registrados'}
              </div>
            ) : sortedClients.map(c => (
              <div key={c.nombre}>
                <button
                  onClick={() => setSelectedClient(selectedClient?.nombre === c.nombre ? null : c)}
                  className={`w-full grid grid-cols-[1fr_120px_100px_80px_100px] gap-2 px-4 py-3 text-left transition-all cursor-pointer border-b border-border/10 last:border-0
                    ${selectedClient?.nombre === c.nombre ? 'bg-blue/5' : 'hover:bg-surface-alt/50'}
                  `}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-text-primary truncate">{c.nombre}</span>
                    {c.cuit && <span className="text-[10px] text-text-muted">{c.cuit}</span>}
                  </div>
                  <span className="text-xs font-black text-green text-right tabular-nums self-center">{formatMoney(c.totalFacturado)}</span>
                  <span className="text-xs font-semibold text-text-secondary text-right tabular-nums self-center">{formatMoney(c.totalVentas)}</span>
                  <span className="text-xs font-bold text-text-muted text-center tabular-nums self-center">{c.cantFacturas}</span>
                  <span className="text-[10px] text-text-muted text-right self-center">{formatDate(c.ultimaFecha)}</span>
                </button>

                {/* Inline history drawer */}
                {selectedClient?.nombre === c.nombre && (
                  <ClientHistory client={c} formatMoney={formatMoney} formatDate={formatDate} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Client History (inline accordion) ─── */
function ClientHistory({ client, formatMoney, formatDate }) {
  const sorted = [...client.ventas].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
  const statusColors = {
    facturado: 'bg-green/10 text-green',
    pendiente: 'bg-yellow/10 text-[#b8960c]',
    error: 'bg-red/10 text-red',
    procesando: 'bg-blue/10 text-blue',
  }

  return (
    <div className="bg-blue/[0.03] border-t border-blue/10 px-4 py-4 animate-slide-down">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">
          Historial de {client.nombre}
        </span>
        <span className="text-[10px] font-bold text-text-muted">{sorted.length} operaciones</span>
      </div>
      <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
        {sorted.map(v => (
          <div key={v.id} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-border/20">
            <FileText size={13} className="text-text-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-text-primary truncate">
                  {v.nro_comprobante || 'Sin comprobante'}
                </span>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${statusColors[v.status] || 'bg-surface-alt text-text-muted'}`}>
                  {v.status}
                </span>
              </div>
              <span className="text-[10px] text-text-muted">{formatDate(v.fecha)}</span>
            </div>
            <span className="text-xs font-black tabular-nums text-text-primary shrink-0">{formatMoney(v.monto)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
