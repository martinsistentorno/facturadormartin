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
  onDrop,
}) {
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParentId, setNewFolderParentId] = useState(null)
  const [showNewLabel, setShowNewLabel] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0].id)
  const [foldersExpanded, setFoldersExpanded] = useState(true)
  const [labelsExpanded, setLabelsExpanded] = useState(true)
  const [dropTarget, setDropTarget] = useState(null) // tracks which sidebar item is being hovered

  const handleDragOver = (e, targetId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(targetId)
  }

  const handleDragLeave = () => {
    setDropTarget(null)
  }

  const handleDropOnItem = (e, action) => {
    e.preventDefault()
    setDropTarget(null)
    try {
      const ids = JSON.parse(e.dataTransfer.getData('application/venta-ids'))
      if (ids && ids.length > 0 && onDrop) {
        onDrop(ids, action)
      }
    } catch {}
  }

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
      <div className="hidden lg:flex flex-col items-center py-4 w-[60px] h-full border-r border-white/10 shrink-0" style={{ backgroundColor: '#1B3A4B' }}>
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer mb-4"
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
            className={`p-2.5 rounded-lg transition-all cursor-pointer ${activeView === 'facturas' ? 'bg-white/15 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'}`}
            title="Ventas Recibidas"
          >
            <FileText size={18} />
          </button>
          <button
            onClick={() => onViewChange('contable')}
            className={`p-2.5 rounded-lg transition-all cursor-pointer ${activeView === 'contable' ? 'bg-white/15 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'}`}
            title="Gestión contable"
          >
            <BarChart3 size={18} />
          </button>
          <button
            onClick={() => onViewChange('gestion')}
            className={`p-2.5 rounded-lg transition-all cursor-pointer ${activeView === 'gestion' ? 'bg-white/15 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'}`}
            title="Estadísticas"
          >
            <FolderKanban size={18} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[240px] h-full shrink-0 flex flex-col border-r border-white/10 overflow-y-auto overflow-x-hidden" style={{ backgroundColor: '#1B3A4B' }}>
      
      {/* Collapse toggle + Compose */}
      <div className="p-3 flex items-center gap-2">
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
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
      <div className="h-px bg-white/10 mx-4 my-3" />

      {/* System Status Folders */}
      <nav className="px-2 space-y-0.5">
        <SidebarItem
          icon={<Clock size={15} />}
          label="Ventas pendientes"
          count={counts.inbox}
          active={isActive('facturas') && !isActive('facturas', { type: 'status' }) && !isActive('facturas', { type: 'historico' })}
          onClick={() => onViewChange('facturas')}
          color="#FFE100"
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
          icon={<AlertCircle size={15} />}
          label="Error"
          count={counts.error}
          active={isActive('facturas', { type: 'status', value: 'error' })}
          onClick={() => onViewChange('facturas', { type: 'status', value: 'error' })}
          color="#C0443C"
          highlight={counts.error > 0}
        />
        
        <div className="h-px bg-white/10 mx-2 my-2" />
        
        <SidebarItem
          icon={<Archive size={15} />}
          label="Archivo"
          count={counts.archivadas}
          active={isActive('facturas', { type: 'status', value: 'archivada' })}
          onClick={() => onViewChange('facturas', { type: 'status', value: 'archivada' })}
          isDropTarget={dropTarget === 'archive'}
          onDragOver={(e) => handleDragOver(e, 'archive')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDropOnItem(e, { type: 'archive' })}
        />
        <SidebarItem
          icon={<Trash2 size={15} />}
          label="Papelera"
          count={counts.papelera}
          active={isActive('facturas', { type: 'status', value: 'borrada' })}
          onClick={() => onViewChange('facturas', { type: 'status', value: 'borrada' })}
          isDropTarget={dropTarget === 'trash'}
          onDragOver={(e) => handleDragOver(e, 'trash')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDropOnItem(e, { type: 'trash' })}
        />
      </nav>

      {/* Divider */}
      <div className="h-px bg-white/10 mx-4 my-3" />

      {/* Custom Folders */}
      <div className="px-2">
        <button 
          onClick={() => setFoldersExpanded(!foldersExpanded)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
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
              dropTarget={dropTarget}
              onItemDragOver={handleDragOver}
              onItemDragLeave={handleDragLeave}
              onItemDrop={handleDropOnItem}
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
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white/50"
                />
                <button onClick={handleCreateFolder} className="text-green hover:text-green/80 cursor-pointer"><Plus size={14} /></button>
                <button onClick={() => setShowNewFolder(false)} className="text-white/40 hover:text-red cursor-pointer"><X size={14} /></button>
              </div>
            ) : (
              <button
                onClick={startNewRootFolder}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold text-white/40 hover:text-white/70 hover:bg-white/10 rounded-lg transition-all cursor-pointer"
              >
                <FolderPlus size={14} />
                Nueva carpeta
              </button>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10 mx-4 my-3" />

      {/* Labels */}
      <div className="px-2 pb-4">
        <button 
          onClick={() => setLabelsExpanded(!labelsExpanded)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
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
                    isDropTarget={dropTarget === `label-${label.name}`}
                    onDragOver={(e) => handleDragOver(e, `label-${label.name}`)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDropOnItem(e, { type: 'label', value: label.name })}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteLabel?.(label.id) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-white/30 hover:text-red transition-all cursor-pointer"
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
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white/50"
                />
                <div className="flex items-center gap-1.5">
                  {LABEL_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setNewLabelColor(c.id)}
                      className={`w-5 h-5 rounded-full transition-all cursor-pointer ${newLabelColor === c.id ? 'ring-2 ring-offset-1 ring-offset-[#1B3A4B] ring-white scale-110' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c.color }}
                      title={c.name}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateLabel} className="flex-1 text-[10px] font-bold text-white bg-[#3460A8] rounded-lg py-1 cursor-pointer hover:bg-[#2A4D86] transition-colors">Crear</button>
                  <button onClick={() => setShowNewLabel(false)} className="text-[10px] font-bold text-white/40 hover:text-red cursor-pointer px-2">Cancelar</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewLabel(true)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold text-white/40 hover:text-white/70 hover:bg-white/10 rounded-lg transition-all cursor-pointer"
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

function SidebarItem({ icon, label, count, active, onClick, color, highlight, isDropTarget, onDragOver, onDragLeave, onDrop }) {
  return (
    <button
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer
        ${active 
          ? 'bg-white/15 text-white font-bold' 
          : 'text-white/70 hover:bg-white/10 hover:text-white'
        }
        ${highlight ? 'font-bold' : ''}
        ${isDropTarget ? 'ring-2 ring-[#C0443C] ring-offset-1 ring-offset-[#1B3A4B] bg-[#C0443C]/20 scale-[1.02]' : ''}
      `}
    >
      <span className={active ? 'text-white' : (color ? '' : 'text-white/50')} style={color && !active ? { color } : {}}>
        {icon}
      </span>
      <span className="flex-1 text-left truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] font-bold tabular-nums ${active ? 'text-white' : 'text-white/40'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

function FolderTree({ folders, parentId, depth, ventas, isActive, onViewChange, onDeleteFolder, onStartSubfolder, dropTarget, onItemDragOver, onItemDragLeave, onItemDrop }) {
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
      dropTarget={dropTarget}
      onItemDragOver={onItemDragOver}
      onItemDragLeave={onItemDragLeave}
      onItemDrop={onItemDrop}
    />
  ))
}

function FolderNode({ folder, folders, depth, ventas, isActive, onViewChange, onDeleteFolder, onStartSubfolder, dropTarget, onItemDragOver, onItemDragLeave, onItemDrop }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = folders.some(f => f.parentId === folder.id)
  const count = ventas.filter(v => v.folder === folder.id).length
  const active = isActive('facturas', { type: 'folder', value: folder.id })
  const isOver = dropTarget === `folder-${folder.id}`

  return (
    <div>
      <div className="group relative" style={{ paddingLeft: `${depth * 16}px` }}>
        <button
          onClick={() => onViewChange('facturas', { type: 'folder', value: folder.id })}
          onDragOver={(e) => onItemDragOver?.(e, `folder-${folder.id}`)}
          onDragLeave={onItemDragLeave}
          onDrop={(e) => onItemDrop?.(e, { type: 'folder', value: folder.id })}
          className={`
            w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer
            ${active ? 'bg-white/15 text-white font-bold' : 'text-white/70 hover:bg-white/10 hover:text-white'}
            ${isOver ? 'ring-2 ring-[#C0443C] ring-offset-1 ring-offset-[#1B3A4B] bg-[#C0443C]/20 scale-[1.02]' : ''}
          `}
        >
          {/* Expand/collapse chevron */}
          {hasChildren ? (
            <span
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
              className="text-white/40 hover:text-white cursor-pointer shrink-0"
            >
              <ChevronRight size={12} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
            </span>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <span className={`shrink-0 ${active ? 'text-white' : 'text-white/50'}`}>
            <FolderKanban size={15} />
          </span>
          <span className="flex-1 text-left truncate">{folder.name}</span>
          {count > 0 && (
            <span className={`text-[10px] font-bold tabular-nums ${active ? 'text-white' : 'text-white/40'}`}>{count}</span>
          )}
        </button>

        {/* Hover action buttons */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
          <button
            onClick={(e) => { e.stopPropagation(); onStartSubfolder(folder.id) }}
            className="p-1 rounded text-white/30 hover:text-white transition-all cursor-pointer"
            title="Nueva subcarpeta"
          >
            <FolderPlus size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteFolder?.(folder.id) }}
            className="p-1 rounded text-white/30 hover:text-red transition-all cursor-pointer"
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
          dropTarget={dropTarget}
          onItemDragOver={onItemDragOver}
          onItemDragLeave={onItemDragLeave}
          onItemDrop={onItemDrop}
        />
      )}
    </div>
  )
}
