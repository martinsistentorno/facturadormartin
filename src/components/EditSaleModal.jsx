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
    descripcion: '',
    monto: 0,
    formaPago: 'Contado - Efectivo',
  });

  useEffect(() => {
    if (venta) {
      setFormData({
        cliente: venta.cliente || '',
        cuit: venta.datos_fiscales?.cuit || '',
        descripcion: venta.datos_fiscales?.descripcion || 'Productos varios',
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
          descripcion: formData.descripcion,
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
  const origenRaw = venta.datos_fiscales?.origen;
  const origen = origenRaw === 'mercadolibre' ? 'Mercado Libre' : origenRaw === 'mercadopago' ? 'Mercado Pago' : venta.mp_payment_id ? 'Mercado Libre' : 'Manual';
  const fromApiHasCuit = origen !== 'Manual' && !!venta.datos_fiscales?.cuit;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-[151] w-full max-w-sm bg-surface border-l border-border shadow-2xl animate-drawer-in overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface/95 backdrop-blur-sm border-b border-border px-5 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-yellow-subtle">
              <Edit2 size={14} className="text-yellow" />
            </div>
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-primary" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Editar Venta
              </h3>
              <p className="text-[9px] text-text-muted mt-0.5 font-mono opacity-70">ID: {String(venta.id || '').slice(0, 8)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* ─── Info Card ─── */}
          <div className="flex items-center justify-between bg-surface-alt/30 border border-border/50 rounded-lg p-3">
            <div className="flex items-center gap-2.5">
              <StatusBadge status={venta.status || 'pendiente'} />
              <div className="text-[10px] text-text-muted font-medium">
                <Clock size={10} className="inline mr-1" />
                {formatDate(venta.fecha)}
              </div>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted px-2 py-0.5 rounded border border-border/60">
              {origen}
            </span>
          </div>

          {/* ─── Cliente ─── */}
          <Section title="Datos del Cliente" icon={User}>
            <div className="px-4 py-2.5">
              <label className="block text-[9px] font-medium text-text-muted uppercase tracking-wider mb-1.5" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Nombre / Razón Social
              </label>
              <input
                type="text"
                required
                className="w-full bg-base border border-border/80 rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40 transition-colors"
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
              />
            </div>
            <div className="px-4 py-2.5 border-t border-border/40">
              <label className="block text-[9px] font-medium text-text-muted uppercase tracking-wider mb-1.5" style={{ fontFamily: 'Space Grotesk' }}>
                CUIT / DNI
              </label>
              <input
                type="text"
                disabled={fromApiHasCuit}
                placeholder="Ej: 20-12345678-9"
                className={`w-full border rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none transition-colors ${fromApiHasCuit ? 'bg-surface-alt/70 border-transparent opacity-60 cursor-not-allowed' : 'bg-base border-border/80 focus:border-accent/40'}`}
                value={formData.cuit}
                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
              />
              {fromApiHasCuit ? (
                <p className="text-[8px] text-accent/70 mt-1 flex items-center gap-1 font-medium italic">
                   Dato automático por API (Bloqueado).
                </p>
              ) : (
                <p className="text-[9px] text-text-muted/60 mt-1">Consumidor Final si se deja vacío.</p>
              )}
            </div>
          </Section>

          {/* ─── Detalle ─── */}
          <Section title="Detalle" icon={DollarSign}>
            <div className="px-4 py-2.5">
              <label className="block text-[9px] font-medium text-text-muted uppercase tracking-wider mb-1.5" style={{ fontFamily: 'Space Grotesk' }}>
                Concepto / Descripción
              </label>
              <textarea
                className="w-full bg-base border border-border/80 rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40 transition-colors resize-none leading-relaxed"
                rows="2"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              />
              <p className="text-[9px] text-text-muted/60 mt-1 italic">Aparecerá en el cuerpo de la factura.</p>
            </div>
          </Section>

          {/* ─── Monto ─── */}
          <Section title="Importe" icon={DollarSign}>
            <div className="px-4 py-2.5">
              <label className="block text-[9px] font-medium text-text-muted uppercase tracking-wider mb-1.5" style={{ fontFamily: 'Space Grotesk' }}>
                Monto Total (ARS)
              </label>
              <input
                type="number"
                required
                step="0.01"
                className="w-full bg-base border border-border/80 rounded-md px-3 py-2 text-lg font-bold text-text-primary focus:outline-none focus:border-accent/40 transition-colors tabular-nums"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
              />
            </div>
          </Section>

          {/* ─── Forma de Pago ─── */}
          <Section title="Forma de Pago" icon={CreditCard}>
            <div className="px-4 py-3">
              <div className="grid grid-cols-2 gap-1.5">
                {FORMAS_PAGO.map(fp => (
                  <button
                    key={fp}
                    type="button"
                    onClick={() => setFormData({ ...formData, formaPago: fp })}
                    className={`
                      px-2 py-2 rounded-md text-[10px] font-semibold text-left transition-all cursor-pointer border
                      ${formData.formaPago === fp
                        ? 'bg-accent/10 border-accent/40 text-accent'
                        : 'bg-surface-alt/40 border-border/40 text-text-secondary hover:border-accent/20'
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
            className="w-full flex items-center justify-center gap-2 bg-[#000000] text-white py-3 rounded-lg text-xs font-bold uppercase tracking-[0.2em] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 transition-all disabled:opacity-50 disabled:transform-none cursor-pointer"
            style={{ fontFamily: 'Montserrat' }}
          >
            {loading ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            {loading ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
          </button>
        </form>
      </div>
    </>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        {Icon && <Icon size={11} className="text-text-muted opacity-60" />}
        <h4 className="text-[9px] font-bold text-text-muted uppercase tracking-[0.1em]" style={{ fontFamily: 'Montserrat' }}>
          {title}
        </h4>
      </div>
      <div className="bg-surface border border-border/60 rounded-lg divide-y divide-border/40 overflow-hidden shadow-sm">
        {children}
      </div>
    </div>
  );
}
