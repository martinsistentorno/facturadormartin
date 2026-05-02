import { useState } from 'react'
import { FileText, Loader2, X, Download, Trash2, RotateCcw, Archive, FolderKanban, Tag, ChevronDown } from 'lucide-react'

export default function EmitirFacturaBar({ 
  selectedCount, 
  selectedVentas = [], 
  onEmitir, 
  onClear, 
  onExport, 
  onBulkDelete, 
  onBulkRetry, 
  onBulkArchive,
  onBulkAnular,
  customFolders = [],
  labels = [],
  onBulkMove,
  onBulkTag
}) {
  const [loading, setLoading] = useState(false)
  const [showFolderMenu, setShowFolderMenu] = useState(false)
  const [showLabelMenu, setShowLabelMenu] = useState(false)

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
  const hasFacturados = selectedVentas.some(v => v.status === 'facturado')

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
      <div className="flex items-center gap-3 bg-[#121212] border border-white/10 rounded-2xl px-5 py-3 shadow-2xl shadow-black/40">
        {/* Count */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-xs font-bold">
            {selectedCount}
          </span>
          <span className="text-white/70 text-sm hidden lg:inline">
            {selectedCount === 1 ? 'seleccionada' : 'seleccionadas'}
          </span>
        </div>

        <div className="w-px h-8 bg-white/20" />

        {/* Emit */}
        {hasPendientes && (
          <button
            id="btn-emitir-factura"
            onClick={handleEmitir}
            disabled={loading}
            className="
              flex items-center gap-2 px-4 py-2 rounded-xl
              bg-red-subtle border border-red/20 text-red text-xs font-bold
              uppercase tracking-wider transition-all duration-200
              hover:bg-red/10 active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed
              cursor-pointer
            "
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            <span className="hidden sm:inline">Facturar</span>
          </button>
        )}

        {/* Move to Folder */}
        <div className="relative">
          <button
            onClick={() => { setShowFolderMenu(!showFolderMenu); setShowLabelMenu(false); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-xs font-bold uppercase tracking-wider active:scale-95 hover:bg-white/10 transition-all cursor-pointer"
          >
            <FolderKanban size={14} />
            <span className="hidden sm:inline">Mover</span>
            <ChevronDown size={12} className={`transition-transform ${showFolderMenu ? 'rotate-180' : ''}`} />
          </button>
          {showFolderMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowFolderMenu(false)} />
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                <div className="px-3 py-2 text-[8px] font-black uppercase tracking-[0.2em] text-white/40 border-b border-white/5 mb-1">Mover a...</div>
                <button 
                  onClick={() => { onBulkMove?.(''); setShowFolderMenu(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  Ninguna
                </button>
                {customFolders.map(f => (
                  <button 
                    key={f.id}
                    onClick={() => { onBulkMove?.(f.id); setShowFolderMenu(false); }}
                    className="w-full text-left px-4 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tag */}
        <div className="relative">
          <button
            onClick={() => { setShowLabelMenu(!showLabelMenu); setShowFolderMenu(false); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-xs font-bold uppercase tracking-wider active:scale-95 hover:bg-white/10 transition-all cursor-pointer"
          >
            <Tag size={14} />
            <span className="hidden sm:inline">Etiquetar</span>
            <ChevronDown size={12} className={`transition-transform ${showLabelMenu ? 'rotate-180' : ''}`} />
          </button>
          {showLabelMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowLabelMenu(false)} />
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                <div className="px-3 py-2 text-[8px] font-black uppercase tracking-[0.2em] text-white/40 border-b border-white/5 mb-1">Etiquetar como...</div>
                <button 
                  onClick={() => { onBulkTag?.(''); setShowLabelMenu(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  Sin etiqueta
                </button>
                {labels.map(l => {
                  const colorObj = LABEL_COLORS.find(c => c.id === l.colorId) || LABEL_COLORS[0]
                  return (
                    <button 
                      key={l.id}
                      onClick={() => { onBulkTag?.(l.name); setShowLabelMenu(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer flex items-center gap-2"
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colorObj.color }} />
                      {l.name}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Retry errors */}
        {hasErrors && onBulkRetry && (
          <button
            onClick={onBulkRetry}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-subtle border border-yellow/20 text-yellow text-xs font-bold uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Reintentar</span>
          </button>
        )}

        {/* Anular (NC) */}
        {hasFacturados && onBulkAnular && (
          <button
            onClick={onBulkAnular}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red/10 border border-red/20 text-red text-xs font-bold uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw size={14} className="rotate-180" />
            <span className="hidden sm:inline">Anular</span>
          </button>
        )}

        {/* Export */}
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider active:scale-95 hover:bg-white/20 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        )}

        {/* Archive */}
        {onBulkArchive && (
          <button
            onClick={onBulkArchive}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple/10 border border-purple/20 text-purple text-xs font-bold uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
          >
            <Archive size={14} />
            <span className="hidden sm:inline">Archivar</span>
          </button>
        )}

        {/* Delete */}
        {onBulkDelete && (
          <button
            onClick={onBulkDelete}
            className="
              flex items-center gap-2 px-4 py-2 rounded-xl
              bg-accent hover:bg-accent-hover text-white text-xs font-bold
              uppercase tracking-wider active:scale-95 transition-all cursor-pointer
            "
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Eliminar</span>
          </button>
        )}

        {/* Clear */}
        <button
          onClick={onClear}
          className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Deseleccionar todo"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

