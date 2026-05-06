import { useState } from 'react'
import { hasEtiqueta } from '../utils/labelHelpers'
import { 
  Plus, FileText, BarChart3, FolderKanban, 
  FileCheck, Clock, AlertCircle, Archive, Trash2,
  FolderPlus, Tag, X, ChevronDown, ChevronUp, ChevronRight,
  PanelLeftClose, PanelLeft
} from 'lucide-react'

import { LABEL_COLORS } from '../config/colors'

export { LABEL_COLORS }

export default function Sidebar({ 
  activeView, 
  onViewChange, 
  ventas = [],
  customFolders = [],
  labels = [],
  onCreateFolder,
  onDeleteFolder,
  onCreateLabel,
  onDeleteLabel,
  onNewVenta,
  collapsed,
  onToggleCollapse,
  activeFilter,
}) {
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParentId, setNewFolderParentId] = useState(null)
  const [showNewLabel, setShowNewLabel] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0].id)
  const [foldersExpanded, setFoldersExpanded] = useState(true)
  const [labelsExpanded, setLabelsExpanded] = useState(true)

  // Counts
  const counts = {
    inbox: ventas.filter(v => (v.status === 'pendiente' || v.status === 'procesando' || v.status === 'error') && !v.archivada && v.status !== 'archivada' && v.status !== 'borrada' && !v.folder).length,
    historico: ventas.filter(v => !v.archivada && v.status !== 'archivada' && v.status !== 'borrada').length,
    facturadas: ventas.filter(v => v.status === 'facturado' && !v.archivada).length,
    pendientes: ventas.filter(v => v.status === 'pendiente' && !v.archivada).length,
    error: ventas.filter(v => v.status === 'error' && !v.archivada).length,
    archivadas: ventas.filter(v => v.archivada || v.status === 'archivada' || v.status === 'archivado').length,
    papelera: ventas.filter(v => v.status === 'borrada').length,
  }

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder?.(newFolderName.trim(), newFolderParentId)
      setNewFolderName('')
      setNewFolderParentId(null)
      setShowNewFolder(false)
    }
  }

  const startNewSubfolder = (parentId) => {
    setNewFolderParentId(parentId)
    setNewFolderName('')
    setShowNewFolder(true)
  }

  const startNewRootFolder = () => {
    setNewFolderParentId(null)
    setNewFolderName('')
    setShowNewFolder(true)
  }

  const handleCreateLabel = () => {
    if (newLabelName.trim()) {
      onCreateLabel?.({ name: newLabelName.trim(), colorId: newLabelColor })
      setNewLabelName('')
      setNewLabelColor(LABEL_COLORS[0].id)
      setShowNewLabel(false)
    }
  }

  const isActive = (view, filter) => {
    if (filter) {
      return activeView === view && activeFilter?.type === filter.type && activeFilter?.value === filter.value
    }
    return activeView === view && !activeFilter
  }

  if (collapsed) {
    return (
      <div className="hidden lg:flex flex-col items-center py-4 w-[60px] border-r border-border/40 bg-white/50 shrink-0">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-alt transition-all cursor-pointer mb-4"
          title="Expandir menú"
        >
          <PanelLeft size={18} />
        </button>

        <button
          onClick={onNewVenta}
          className="w-10 h-10 rounded-full bg-[#C0443C] text-white flex items-center justify-center shadow-md hover:shadow-lg hover:bg-[#A0342D] hover:-translate-y-0.5 transition-all cursor-pointer mb-6"
          title="Nueva Venta"
        >
          <Plus size={18} />
        </button>

        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => onViewChange('facturas')}
            className={`p-2.5 rounded-lg transition-all cursor-pointer ${activeView === 'facturas' ? 'bg-blue/10 text-blue' : 'text-text-muted hover:bg-surface-alt hover:text-text-primary'}`}
            title="Ventas Recibidas"
          >
            <FileText size={18} />
          </button>
          <button
            onClick={() => onViewChange('contable')}
            className={`p-2.5 rounded-lg transition-all cursor-pointer ${activeView === 'contable' ? 'bg-blue/10 text-blue' : 'text-text-muted hover:bg-surface-alt hover:text-text-primary'}`}
            title="Gestión contable"
          >
            <BarChart3 size={18} />
          </button>
          <button
            onClick={() => onViewChange('gestion')}
            className={`p-2.5 rounded-lg transition-all cursor-pointer ${activeView === 'gestion' ? 'bg-blue/10 text-blue' : 'text-text-muted hover:bg-surface-alt hover:text-text-primary'}`}
            title="Estadísticas"
          >
            <FolderKanban size={18} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[240px] shrink-0 flex flex-col border-r border-border/40 bg-white/50 overflow-y-auto overflow-x-hidden">
      
      {/* Collapse toggle + Compose */}
      <div className="p-3 flex items-center gap-2">
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-alt transition-all cursor-pointer"
          title="Colapsar menú"
        >
          <PanelLeftClose size={18} />
        </button>
        
        {/* Compose Button (Gmail style) */}
        <button
          onClick={onNewVenta}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#C0443C] text-white text-[10px] font-bold uppercase tracking-widest shadow-md hover:shadow-lg hover:bg-[#A0342D] hover:-translate-y-0.5 transition-all cursor-pointer"
        >
          <Plus size={14} />
          Nueva Venta
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="px-2 mt-1">
        <SidebarItem
          icon={<BarChart3 size={16} />}
          label="Gestión contable"
          active={isActive('contable')}
          onClick={() => onViewChange('contable')}
        />
        <SidebarItem
          icon={<FolderKanban size={16} />}
          label="Estadísticas"
          active={isActive('gestion')}
          onClick={() => onViewChange('gestion')}
        />
      </nav>

      {/* Divider */}
      <div className="h-px bg-border/40 mx-4 my-3" />

      {/* System Status Folders */}
      <nav className="px-2 space-y-0.5">
        <SidebarItem
          icon={<FileText size={15} />}
          label="Ventas Recibidas"
          count={counts.inbox}
          active={isActive('facturas') && !isActive('facturas', { type: 'status' }) && !isActive('facturas', { type: 'historico' })}
          onClick={() => onViewChange('facturas')}
        />
        <SidebarItem
          icon={<FileCheck size={15} />}
          label="Facturadas"
          count={counts.facturadas}
          active={isActive('facturas', { type: 'status', value: 'facturado' })}
          onClick={() => onViewChange('facturas', { type: 'status', value: 'facturado' })}
          color="#2D8F5E"
        />
        <SidebarItem
          icon={<Clock size={15} />}
          label="Pendientes"
          count={counts.pendientes}
          active={isActive('facturas', { type: 'status', value: 'pendiente' })}
          onClick={() => onViewChange('facturas', { type: 'status', value: 'pendiente' })}
          color="#FFE100"
        />
        <SidebarItem
          icon={<AlertCircle size={15} />}
          label="Error"
          count={counts.error}
          active={isActive('facturas', { type: 'status', value: 'error' })}
          onClick={() => onViewChange('facturas', { type: 'status', value: 'error' })}
          color="#C0443C"
          highlight={counts.error > 0}
        />
        <SidebarItem
          icon={<Archive size={15} />}
          label="Archivo"
          count={counts.archivadas}
          active={isActive('facturas', { type: 'status', value: 'archivada' })}
          onClick={() => onViewChange('facturas', { type: 'status', value: 'archivada' })}
        />
        <SidebarItem
          icon={<Trash2 size={15} />}
          label="Papelera"
          count={counts.papelera}
          active={isActive('facturas', { type: 'status', value: 'borrada' })}
          onClick={() => onViewChange('facturas', { type: 'status', value: 'borrada' })}
        />
      </nav>

      {/* Divider */}
      <div className="h-px bg-border/40 mx-4 my-3" />

      {/* Custom Folders */}
      <div className="px-2">
        <button 
          onClick={() => setFoldersExpanded(!foldersExpanded)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          Carpetas
          {foldersExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        
        {foldersExpanded && (
          <div className="mt-1 space-y-0.5">
            <FolderTree
              folders={customFolders}
              parentId={null}
              depth={0}
              ventas={ventas}
              isActive={isActive}
              onViewChange={onViewChange}
              onDeleteFolder={onDeleteFolder}
              onStartSubfolder={startNewSubfolder}
            />

            {/* Add Folder input (root or subfolder) */}
            {showNewFolder ? (
              <div className="px-3 py-2 flex items-center gap-2" style={{ paddingLeft: newFolderParentId ? '28px' : '12px' }}>
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
                  placeholder={newFolderParentId ? 'Subcarpeta...' : 'Carpeta...'}
                  className="flex-1 bg-surface-alt border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                />
                <button onClick={handleCreateFolder} className="text-green hover:text-green/80 cursor-pointer"><Plus size={14} /></button>
                <button onClick={() => setShowNewFolder(false)} className="text-text-muted hover:text-red cursor-pointer"><X size={14} /></button>
              </div>
            ) : (
              <button
                onClick={startNewRootFolder}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold text-text-muted hover:text-text-primary hover:bg-surface-alt rounded-lg transition-all cursor-pointer"
              >
                <FolderPlus size={14} />
                Nueva carpeta
              </button>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border/40 mx-4 my-3" />

      {/* Labels */}
      <div className="px-2 pb-4">
        <button 
          onClick={() => setLabelsExpanded(!labelsExpanded)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          Etiquetas
          {labelsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {labelsExpanded && (
          <div className="mt-1 space-y-0.5">
            {labels.map(label => {
              const colorObj = LABEL_COLORS.find(c => c.id === label.colorId) || LABEL_COLORS[0]
              return (
                <div key={label.id} className="group relative">
                  <SidebarItem
                    icon={<div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorObj.color }} />}
                    label={label.name}
                    count={ventas.filter(v => hasEtiqueta(v, label.name)).length}
                    active={isActive('facturas', { type: 'label', value: label.name })}
                    onClick={() => onViewChange('facturas', { type: 'label', value: label.name })}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteLabel?.(label.id) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-red transition-all cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              )
            })}

            {/* Add Label */}
            {showNewLabel ? (
              <div className="px-3 py-2 space-y-2">
                <input
                  autoFocus
                  value={newLabelName}
                  onChange={e => setNewLabelName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateLabel()}
                  placeholder="Nombre etiqueta..."
                  className="w-full bg-surface-alt border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                />
                <div className="flex items-center gap-1.5">
                  {LABEL_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setNewLabelColor(c.id)}
                      className={`w-5 h-5 rounded-full transition-all cursor-pointer ${newLabelColor === c.id ? 'ring-2 ring-offset-1 ring-text-primary scale-110' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c.color }}
                      title={c.name}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateLabel} className="flex-1 text-[10px] font-bold text-white bg-[#3460A8] rounded-lg py-1 cursor-pointer hover:bg-[#2A4D86] transition-colors">Crear</button>
                  <button onClick={() => setShowNewLabel(false)} className="text-[10px] font-bold text-text-muted hover:text-red cursor-pointer px-2">Cancelar</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewLabel(true)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold text-text-muted hover:text-text-primary hover:bg-surface-alt rounded-lg transition-all cursor-pointer"
              >
                <Tag size={14} />
                Nueva etiqueta
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SidebarItem({ icon, label, count, active, onClick, color, highlight }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer
        ${active 
          ? 'bg-blue/10 text-blue font-bold' 
          : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
        }
        ${highlight ? 'font-bold' : ''}
      `}
    >
      <span className={active ? 'text-blue' : (color ? '' : 'text-text-muted')} style={color && !active ? { color } : {}}>
        {icon}
      </span>
      <span className="flex-1 text-left truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] font-bold tabular-nums ${active ? 'text-blue' : 'text-text-muted'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

function FolderTree({ folders, parentId, depth, ventas, isActive, onViewChange, onDeleteFolder, onStartSubfolder }) {
  const children = folders.filter(f => (f.parentId || null) === parentId)
  if (children.length === 0) return null

  return children.map(folder => (
    <FolderNode
      key={folder.id}
      folder={folder}
      folders={folders}
      depth={depth}
      ventas={ventas}
      isActive={isActive}
      onViewChange={onViewChange}
      onDeleteFolder={onDeleteFolder}
      onStartSubfolder={onStartSubfolder}
    />
  ))
}

function FolderNode({ folder, folders, depth, ventas, isActive, onViewChange, onDeleteFolder, onStartSubfolder }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = folders.some(f => f.parentId === folder.id)
  const count = ventas.filter(v => v.folder === folder.id).length
  const active = isActive('facturas', { type: 'folder', value: folder.id })

  return (
    <div>
      <div className="group relative" style={{ paddingLeft: `${depth * 16}px` }}>
        <button
          onClick={() => onViewChange('facturas', { type: 'folder', value: folder.id })}
          className={`
            w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer
            ${active ? 'bg-blue/10 text-blue font-bold' : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'}
          `}
        >
          {/* Expand/collapse chevron */}
          {hasChildren ? (
            <span
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
              className="text-text-muted hover:text-text-primary cursor-pointer shrink-0"
            >
              <ChevronRight size={12} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
            </span>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <span className={`shrink-0 ${active ? 'text-blue' : 'text-text-muted'}`}>
            <FolderKanban size={15} />
          </span>
          <span className="flex-1 text-left truncate">{folder.name}</span>
          {count > 0 && (
            <span className={`text-[10px] font-bold tabular-nums ${active ? 'text-blue' : 'text-text-muted'}`}>{count}</span>
          )}
        </button>

        {/* Hover action buttons */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
          <button
            onClick={(e) => { e.stopPropagation(); onStartSubfolder(folder.id) }}
            className="p-1 rounded text-text-muted hover:text-blue transition-all cursor-pointer"
            title="Nueva subcarpeta"
          >
            <FolderPlus size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteFolder?.(folder.id) }}
            className="p-1 rounded text-text-muted hover:text-red transition-all cursor-pointer"
            title="Eliminar carpeta"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Recursive children */}
      {expanded && hasChildren && (
        <FolderTree
          folders={folders}
          parentId={folder.id}
          depth={depth + 1}
          ventas={ventas}
          isActive={isActive}
          onViewChange={onViewChange}
          onDeleteFolder={onDeleteFolder}
          onStartSubfolder={onStartSubfolder}
        />
      )}
    </div>
  )
}
