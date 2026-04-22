import Modal from './Modal';
import StatusBadge from './StatusBadge';
import { Trash2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function SummaryModal({ isOpen, onClose, title, ventas, onDelete, onRestore, onHardDelete, onReset, onResetAll, onShowError }) {
  const [deletingId, setDeletingId] = useState(null)

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(Number(amount) || 0);
  };

  const totalMonto = ventas.reduce((s, v) => s + (Number(v.monto) || 0), 0);
  const isTrashView = ventas.length > 0 && ventas.every(v => v.status === 'borrada');

  const handleDelete = async (id) => {
    if (!onDelete) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  const handleHardDelete = async (id) => {
    if (!onHardDelete) return;
    if (!confirm('¿Estás seguro de que quieres eliminar esta venta permanentemente? Esta acción no se puede deshacer.')) return;
    setDeletingId(id);
    try {
      await onHardDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {ventas.length === 0 ? (
        <div className="text-center py-10 opacity-50">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-sm font-medium">No hay ventas registradas en este período.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Total summary - Hidden for Trash */}
          {!isTrashView && (
            <div className="flex justify-between items-center p-4 bg-surface-alt rounded-lg border border-border">
              <div>
                {title.toLowerCase().includes('facturado') && ventas.length > 0 && (
                  <button
                    onClick={() => onResetAll && onResetAll(ventas.map(v => v.id))}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-600 border border-orange-500/20 hover:bg-orange-500/20 transition-all text-xs font-bold uppercase tracking-wider"
                  >
                    <RefreshCw size={14} />
                    Reiniciar Todo
                  </button>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Total del Período</p>
                <p className="text-xl font-bold text-accent">{formatCurrency(totalMonto)}</p>
              </div>
            </div>
          )}

          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-alt">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">Monto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Factura</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-surface">
                {ventas.map((venta) => (
                  <tr key={venta.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 text-text-primary whitespace-nowrap">{formatDate(venta.fecha)}</td>
                    <td className="px-4 py-3 text-text-primary">{venta.cliente}</td>
                    <td className="px-4 py-3 text-right text-text-primary font-semibold tabular-nums">{formatCurrency(venta.monto)}</td>
                    <td className="px-4 py-3 text-left">
                      <span className="text-text-primary text-xs font-mono whitespace-nowrap">
                        {venta.datos_fiscales?.comprobante_numero || <span className="text-text-muted">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={venta.status} />
                        {venta.status === 'error' && venta.datos_fiscales?.error_detalle && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onShowError(venta.datos_fiscales.error_detalle) }}
                            className="text-red hover:text-red-400 transition-colors p-1"
                            title="Ver motivo de rechazo"
                          >
                            <AlertCircle size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {venta.status === 'borrada' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => onRestore && onRestore(venta.id)}
                            className="p-1.5 rounded-lg text-green bg-green/5 border border-green/10 hover:bg-green/20 hover:border-green/30 transition-all"
                            title="Restaurar a pendiente"
                          >
                            <RefreshCw size={16} />
                          </button>
                          <button
                            onClick={() => handleHardDelete(venta.id)}
                            disabled={deletingId === venta.id}
                            className="p-1.5 rounded-lg text-red bg-red/5 border border-red/10 hover:bg-red/20 hover:border-red/30 transition-all disabled:opacity-50"
                            title="Eliminar definitivamente"
                          >
                            {deletingId === venta.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          {venta.status === 'facturado' && (
                            <button
                              onClick={() => {
                                if (confirm('¿Quieres reiniciar esta venta a pendiente? Se borrará el CAE y número de factura.')) {
                                  onReset && onReset(venta.id)
                                }
                              }}
                              className="p-1.5 rounded-lg text-orange-500 bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/20 hover:border-orange-500/30 transition-all"
                              title="Reiniciar a pendiente"
                            >
                              <RefreshCw size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(venta.id)}
                            disabled={deletingId === venta.id}
                            className="p-1.5 rounded-lg text-text-muted hover:text-red hover:bg-red-subtle/30 transition-colors disabled:opacity-50"
                            title="Mover a papelera"
                          >
                            {deletingId === venta.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
