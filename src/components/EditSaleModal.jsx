import { useState, useEffect } from 'react';
import { Save, Loader2, X, User, CreditCard, DollarSign, Edit2, Clock } from 'lucide-react';
import StatusBadge from './StatusBadge';

const FORMAS_PAGO = [
  'Contado - Efectivo',
  'Transferencia Bancaria',
  'Tarjeta de Débito',
  'Tarjeta de Crédito',
  'Mercado Pago',
  'Otro',
];

export default function EditSaleModal({ isOpen, onClose, venta, onSave }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cliente: '',
    cuit: '',
    monto: 0,
    formaPago: 'Contado - Efectivo',
  });

  useEffect(() => {
    if (venta) {
      setFormData({
        cliente: venta.cliente || '',
        cuit: venta.datos_fiscales?.cuit || '',
        monto: venta.monto || 0,
        formaPago: venta.datos_fiscales?.forma_pago || 'Contado - Efectivo',
      });
    }
  }, [venta]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(venta.id, {
        cliente: formData.cliente,
        monto: parseFloat(formData.monto),
        datos_fiscales: {
          ...venta.datos_fiscales,
          cuit: formData.cuit,
          forma_pago: formData.formaPago,
        }
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !venta) return null;

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const origen = venta.mp_payment_id ? 'Mercado Libre' : 'Manual';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-[151] w-full max-w-md bg-surface border-l border-border shadow-2xl animate-drawer-in overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface/95 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-yellow-subtle">
              <Edit2 size={18} className="text-yellow" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-text-primary" style={{ fontFamily: 'Montserrat' }}>
                Editar Venta
              </h3>
              <p className="text-xs text-text-muted mt-0.5 font-mono">{venta.id?.slice(0, 8)}...</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* ─── Info Card ─── */}
          <div className="flex items-center justify-between bg-surface-alt/50 border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <StatusBadge status={venta.status} />
              <div className="text-xs text-text-muted">
                <Clock size={10} className="inline mr-1" />
                {formatDate(venta.fecha)}
              </div>
            </div>
            <span className="text-xs text-text-muted px-2 py-1 rounded-full bg-surface border border-border">
              {origen}
            </span>
          </div>

          {/* ─── Cliente ─── */}
          <Section title="Datos del Cliente" icon={User}>
            <div className="px-4 py-3">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                Nombre / Razón Social
              </label>
              <input
                type="text"
                required
                className="w-full bg-base border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors"
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
              />
            </div>
            <div className="px-4 py-3 border-t border-border">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                CUIT / DNI
              </label>
              <input
                type="text"
                placeholder="Ej: 20-12345678-9"
                className="w-full bg-base border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors"
                value={formData.cuit}
                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
              />
              <p className="text-[10px] text-text-muted mt-1.5">Si está vacío, AFIP lo tomará como Consumidor Final.</p>
            </div>
          </Section>

          {/* ─── Monto ─── */}
          <Section title="Importe" icon={DollarSign}>
            <div className="px-4 py-3">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                Monto Total (ARS)
              </label>
              <input
                type="number"
                required
                step="0.01"
                className="w-full bg-base border border-border rounded-lg px-4 py-3 text-xl font-bold text-text-primary focus:outline-none focus:border-accent transition-colors tabular-nums"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
              />
            </div>
          </Section>

          {/* ─── Forma de Pago ─── */}
          <Section title="Forma de Pago" icon={CreditCard}>
            <div className="px-4 py-3">
              <div className="grid grid-cols-2 gap-2">
                {FORMAS_PAGO.map(fp => (
                  <button
                    key={fp}
                    type="button"
                    onClick={() => setFormData({ ...formData, formaPago: fp })}
                    className={`
                      px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-all cursor-pointer border
                      ${formData.formaPago === fp
                        ? 'bg-accent/10 border-accent/30 text-accent font-bold'
                        : 'bg-surface-alt border-border text-text-secondary hover:border-accent/20'
                      }
                    `}
                  >
                    {fp}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* ─── Submit ─── */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-black text-white py-4 rounded-xl font-black uppercase tracking-widest hover:-translate-y-0.5 hover:shadow-xl transition-all disabled:opacity-50 disabled:transform-none cursor-pointer"
            style={{ fontFamily: 'Montserrat' }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {loading ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
          </button>
        </form>
      </div>
    </>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={14} className="text-text-muted" />}
        <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>
          {title}
        </h4>
      </div>
      <div className="bg-surface-alt/50 border border-border rounded-xl divide-y divide-border">
        {children}
      </div>
    </div>
  );
}
