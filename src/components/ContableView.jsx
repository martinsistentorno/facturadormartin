import StatsCards from './StatsCards'
import SalesTable from './SalesTable'
import FilterBar from './FilterBar'

export default function ContableView({ 
  ventas, 
  filters,
  onFilterChange,
  onCardClick,
  tableData,
  selectedIds,
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
}) {
  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h2 className="text-lg md:text-xl font-bold text-text-primary uppercase tracking-tight">
          Resumen Contable
        </h2>
        <p className="text-xs text-text-muted mt-1">
          Métricas fiscales y financieras de tu negocio
        </p>
      </div>

      <StatsCards ventas={ventas} onCardClick={onCardClick} activeCard={tableData?.baseTitle} />

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
          />
        </div>
      )}
    </div>
  )
}
