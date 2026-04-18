import { useState } from 'react'
import { FileText, Loader2, X, Download, Trash2, RotateCcw } from 'lucide-react'

export default function EmitirFacturaBar({ selectedCount, selectedVentas = [], onEmitir, onClear, onExport, onBulkDelete, onBulkRetry }) {
  const [loading, setLoading] = useState(false)

  const handleEmitir = async () => {
    setLoading(true)
    try {
      await onEmitir()
    } finally {
      setLoading(false)
    }
  }

  if (selectedCount === 0) return null

  const hasErrors = selectedVentas.some(v => v.status === 'error')
  const hasPendientes = selectedVentas.some(v => v.status === 'pendiente')

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="flex items-center gap-3 bg-surface border border-border rounded-2xl px-5 py-3 shadow-2xl shadow-black/40">
        {/* Count */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-xs font-bold">
            {selectedCount}
          </span>
          <span className="text-text-secondary text-sm hidden sm:inline">
            {selectedCount === 1 ? 'seleccionada' : 'seleccionadas'}
          </span>
        </div>

        <div className="w-px h-8 bg-border" />

        {/* Emit */}
        {hasPendientes && (
          <button
            id="btn-emitir-factura"
            onClick={handleEmitir}
            disabled={loading}
            className="
              flex items-center gap-2 px-4 py-2 rounded-xl
              bg-accent hover:bg-accent-hover text-white text-xs font-bold
              uppercase tracking-wider transition-all duration-200
              hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/25
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
              cursor-pointer
            "
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            <span className="hidden sm:inline">Facturar</span>
          </button>
        )}

        {/* Retry errors */}
        {hasErrors && onBulkRetry && (
          <button
            onClick={onBulkRetry}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-subtle border border-yellow/20 text-yellow text-xs font-bold uppercase tracking-wider hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Reintentar</span>
          </button>
        )}

        {/* Export */}
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-alt border border-border text-text-secondary text-xs font-bold uppercase tracking-wider hover:-translate-y-0.5 hover:border-accent/30 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        )}

        {/* Delete errors */}
        {hasErrors && onBulkDelete && (
          <button
            onClick={onBulkDelete}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-subtle border border-red/20 text-red text-xs font-bold uppercase tracking-wider hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Eliminar</span>
          </button>
        )}

        {/* Clear */}
        <button
          onClick={onClear}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
          title="Deseleccionar todo"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
