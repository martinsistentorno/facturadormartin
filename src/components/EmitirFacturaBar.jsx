import { useState } from 'react'
import { FileText, Loader2, X, Download, Trash2, RotateCcw, Archive, FolderKanban, Tag, ChevronDown, AlertTriangle } from 'lucide-react'

export default function EmitirFacturaBar({ 
  selectedCount, 
  selectedVentas = [], 
  onEmitir, 
  onClear, 
  onExport, 
  onBulkDelete, 
  onBulkRetry, 
  onBulkArchive,
  customFolders = [],
  labels = [],
  onBulkMove,
  onBulkTag,
  onPermanentDelete,
}) {
  const [loading, setLoading] = useState(false)
  const [showFolderMenu, setShowFolderMenu] = useState(false)
  const [showLabelMenu, setShowLabelMenu] = useState(false)
  const [confirmPermanent, setConfirmPermanent] = useState(false)

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
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
        <div className="flex items-center gap-2.5 bg-white/95 backdrop-blur-xl border border-border/60 rounded-full pl-3 pr-4 py-3 shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
          {/* Count */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-black text-white text-[11px] font-black">
              {selectedCount}
            </span>
            <span className="text-text-secondary text-[10px] font-bold uppercase tracking-[0.15em] hidden lg:inline mr-1">
              {selectedCount === 1 ? 'seleccionada' : 'seleccionadas'}
            </span>
          </div>

          <div className="w-px h-6 bg-border/60 mx-1" />

          {/* Emit */}
          {hasPendientes && (
            <button
              id="btn-emitir-factura"
              onClick={handleEmitir}
              disabled={loading}
              className="
                flex items-center gap-2 px-4 py-2 rounded-full
                bg-[#C0443C] text-white text-[10px] font-bold
                uppercase tracking-widest transition-all duration-300
                hover:-translate-y-0.5 shadow-lg shadow-[#C0443C]/20
                disabled:opacity-50 disabled:cursor-not-allowed
                cursor-pointer
              "
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
              <span className="hidden sm:inline">Facturar</span>
            </button>
          )}

          {/* Retry errors */}
          {hasErrors && onBulkRetry && (
            <button
              onClick={onBulkRetry}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFE100] text-black text-[10px] font-bold uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 shadow-lg shadow-[#FFE100]/20 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reintentar</span>
            </button>
          )}

          {/* Export */}
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-alt border border-border/60 text-text-primary text-[10px] font-bold uppercase tracking-widest transition-all duration-300 hover:bg-border/40 hover:-translate-y-0.5 cursor-pointer"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          )}

          {/* Archive / Unarchive */}
          {onBulkArchive && (() => {
            const allArchived = selectedVentas.every(v => v.archivada)
            return (
              <button
                onClick={onBulkArchive}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple/10 border border-purple/20 text-purple text-[10px] font-bold uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
              >
                <Archive size={13} />
                <span className="hidden sm:inline">{allArchived ? 'Desarchivar' : 'Archivar'}</span>
              </button>
            )
          })()}

          {/* Delete (soft) */}
          {onBulkDelete && (
            <button
              onClick={onBulkDelete}
              className="
                flex items-center gap-2 px-4 py-2 rounded-full
                bg-black hover:bg-black/80 text-white text-[10px] font-bold
                uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 shadow-lg shadow-black/10 cursor-pointer
              "
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Eliminar</span>
            </button>
          )}

          {/* Permanent Delete (trash view) */}
          {onPermanentDelete && (
            <button
              onClick={() => setConfirmPermanent(true)}
              className="
                flex items-center gap-2 px-4 py-2 rounded-full
                bg-[#C0443C] hover:bg-[#a83830] text-white text-[10px] font-bold
                uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 shadow-lg shadow-[#C0443C]/20 cursor-pointer
              "
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Borrar definitivo</span>
            </button>
          )}

          {/* Clear */}
          <button
            onClick={onClear}
            className="w-8 h-8 ml-1 flex items-center justify-center rounded-full bg-surface-alt hover:bg-border/80 border border-border/40 text-text-muted hover:text-text-primary transition-all cursor-pointer"
            title="Deseleccionar todo"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Permanent Delete Confirmation Modal */}
      {confirmPermanent && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]" onClick={() => setConfirmPermanent(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[90%] max-w-[400px] bg-white rounded-2xl shadow-2xl border border-border/40 animate-scale-up overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#C0443C]/10 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-[#C0443C]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Borrar definitivamente</h3>
                  <p className="text-[11px] text-text-muted mt-0.5">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Estás por eliminar <strong>{selectedCount} venta(s)</strong> de forma permanente. 
                No podrás recuperarlas después de confirmar.
              </p>
            </div>
            <div className="flex items-center gap-2 px-6 py-4 bg-surface-alt/30 border-t border-border/40">
              <button
                onClick={() => setConfirmPermanent(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-text-secondary hover:bg-surface-alt transition-colors cursor-pointer uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setConfirmPermanent(false)
                  onPermanentDelete()
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#C0443C] hover:bg-[#a83830] text-white text-xs font-bold cursor-pointer uppercase tracking-wider transition-colors"
              >
                Sí, borrar
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
