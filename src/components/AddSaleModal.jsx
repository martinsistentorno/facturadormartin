import { useState, useRef, useEffect } from 'react';
import { Plus, Loader2, X, User, CreditCard, DollarSign, FileText } from 'lucide-react';

const FORMAS_PAGO = [
  'Contado - Efectivo',
  'Transferencia Bancaria',
  'Tarjeta de Débito',
  'Tarjeta de Crédito',
  'Mercado Pago',
  'Otro',
];

export default function AddSaleModal({ isOpen, onClose, onSave, searchClientes }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cliente: '',
    cuit: '',
    monto: '',
    formaPago: 'Contado - Efectivo',
  });
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef(null);

  const resetForm = () => {
    setFormData({ cliente: '', cuit: '', monto: '', formaPago: 'Contado - Efectivo' });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') handleClose(); };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClienteChange = (value) => {
    setFormData({ ...formData, cliente: value });
    if (searchClientes && value.length >= 2) {
      const results = searchClientes(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (cliente) => {
    setFormData({
      ...formData,
      cliente: cliente.nombre,
      cuit: cliente.cuit || formData.cuit,
      formaPago: cliente.formaPago || formData.formaPago,
    });
    setShowSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        fecha: new Date().toISOString(),
        cliente: formData.cliente.trim(),
        monto: parseFloat(formData.monto),
        status: 'pendiente',
        datos_fiscales: {
          cuit: formData.cuit.trim() || null,
          forma_pago: formData.formaPago,
        },
      });
      resetForm();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-[151] w-full max-w-md bg-surface border-l border-border shadow-2xl animate-drawer-in overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface/95 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-subtle">
              <Plus size={18} className="text-green" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-text-primary" style={{ fontFamily: 'Montserrat' }}>
                Nueva Venta
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Registrar venta manual</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* ─── Cliente ─── */}
          <Section title="Datos del Cliente" icon={User}>
            <div className="px-4 py-3 relative" ref={suggestionsRef}>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                Nombre / Razón Social
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Juan Pérez"
                className="w-full bg-base border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors"
                value={formData.cliente}
                onChange={(e) => handleClienteChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                autoComplete="off"
              />
              {/* Suggestions dropdown */}
              {showSuggestions && (
                <div className="absolute left-4 right-4 mt-1 bg-surface border border-border rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                  {suggestions.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectSuggestion(c)}
                      className="w-full text-left px-4 py-2.5 hover:bg-surface-alt transition-colors flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="text-sm text-text-primary font-medium">{c.nombre}</span>
                      {c.cuit && <span className="text-xs text-text-muted font-mono">{c.cuit}</span>}
                    </button>
                  ))}
                </div>
              )}
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
              <p className="text-[10px] text-text-muted mt-1.5">Opcional. Si está vacío, AFIP lo tomará como Consumidor Final.</p>
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
                min="1"
                placeholder="0.00"
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

          {/* ─── Resumen + Submit ─── */}
          <div className="bg-surface-alt/50 border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-text-muted uppercase tracking-widest font-bold" style={{ fontFamily: 'Space Grotesk' }}>Resumen</span>
              <FileText size={14} className="text-text-muted" />
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Cliente</span>
                <span className="text-text-primary font-medium">{formData.cliente || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">CUIT</span>
                <span className="text-text-primary font-mono text-xs">{formData.cuit || 'Consumidor Final'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Pago</span>
                <span className="text-text-primary">{formData.formaPago}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-text-muted font-bold">Total</span>
                <span className="text-xl font-bold text-accent">
                  {formData.monto ? `$ ${Number(formData.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '$ 0.00'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-black text-white py-4 rounded-xl font-black uppercase tracking-widest hover:-translate-y-0.5 hover:shadow-xl transition-all disabled:opacity-50 disabled:transform-none cursor-pointer"
            style={{ fontFamily: 'Montserrat' }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            {loading ? 'CREANDO...' : 'AGREGAR VENTA'}
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
