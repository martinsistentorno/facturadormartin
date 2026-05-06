import StatsCards from './StatsCards'
import SalesTable from './SalesTable'
import FilterBar from './FilterBar'
import AIReportModal from './AIReportModal'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { getMonotributoLimit } from '../utils/afipConstants'
import { useConfig } from '../context/ConfigContext'

export default function ContableView({ 
  ventas, 
  allVentas,
  filters,
  onFilterChange,
  onCardClick,
  tableData,
  selectedIds,
  selectedVentas = [],
  onToggleSelect,
  onToggleAll,
  loading,
  onShowError,
  onRowClick,
  onEdit,
  onSaveEdit,
  onRetry,
  onEmit,
  labels,
  customFolders = [],
  onDelete,
  onArchive,
  onRestore,
  onHardDelete,
}) {
  const [reportOpen, setReportOpen] = useState(false)
  const { emisor } = useConfig()

  const category = emisor?.monotributo_categoria || 'A';
  const limit = getMonotributoLimit(category);

  const fiscalData = {
    allVentas,
    tableVentas: tableData?.ventas || [],
    selectedVentas,
    category,
    limit,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-text-primary uppercase tracking-tight">
            Gestión contable
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Métricas fiscales y financieras de tu negocio
          </p>
        </div>
        
        <button
          onClick={() => setReportOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#2D8F5E] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#24734B] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer shadow-lg shadow-black/10"
        >
          <Sparkles size={13} />
          Resumen Contable
        </button>
      </div>

      <StatsCards ventas={ventas} allVentas={allVentas} onCardClick={onCardClick} activeCard={tableData?.baseTitle} tableVentas={tableData?.ventas} selectedVentas={selectedVentas} />

      <div className="mt-8 mb-4">
        <FilterBar filters={filters} onFilterChange={onFilterChange} />
      </div>

      {tableData && (
        <div className="bg-surface rounded-xl border border-border p-4 md:p-6 animate-fade-in shadow-sm">
          <SalesTable 
            ventas={tableData.ventas}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onToggleAll={onToggleAll}
            loading={loading}
            onShowError={onShowError}
            onRowClick={onRowClick}
            onEdit={onEdit}
            onSaveEdit={onSaveEdit}
            onRetry={onRetry}
            onEmit={onEmit}
            labels={labels}
            customFolders={customFolders}
            onDelete={onDelete}
            onArchive={onArchive}
            onRestore={onRestore}
            onHardDelete={onHardDelete}
          />
        </div>
      )}
      <AIReportModal 
        isOpen={reportOpen} 
        onClose={() => setReportOpen(false)} 
        type="fiscal"
        data={fiscalData}
      />
    </div>
  )
}
