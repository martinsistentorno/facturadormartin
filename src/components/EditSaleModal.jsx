import { useState, useEffect } from 'react';
import { Save, Loader2, X, User, CreditCard, DollarSign, Edit2, FileText, Hash } from 'lucide-react';
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
  const fromApiHasCuit = false; // CUIT siempre editable

  return (
    <div 
      className="fixed inset-0 z-[150] bg-black/20 backdrop-blur-sm flex items-center justify-center p-3 transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-[#F9F7F2] rounded-2xl shadow-xl border border-white/50 w-full max-w-[500px] max-h-[95vh] flex flex-col animate-slide-down relative z-[151]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Minimalista */}
        <div className="bg-white/60 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-b border-border/40 shrink-0">
          <div>
            <span className="text-[9px] font-bold tracking-[0.2em] text-[#C0443C] uppercase mb-0.5 block" style={{ fontFamily: 'Inter' }}>
              Operaciones
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black uppercase text-[#000000] tracking-tight leading-none" style={{ fontFamily: 'Montserrat' }}>
                Editar Venta
              </h2>
              <span className="bg-surface-alt border border-border text-text-muted text-[10px] font-mono px-2 py-0.5 rounded">
                {String(venta.id || '').slice(0, 8)}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-border flex items-center justify-center text-text-muted hover:text-[#C0443C] hover:border-[#C0443C] hover:-translate-y-0.5 transition-all cursor-pointer">
            <X size={14} />
          </button>
        </div>

        <form 
          id="edit-sale-form" 
          onSubmit={handleSubmit} 
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          className="overflow-y-auto p-5 scrollbar-hide flex flex-col gap-4"
        >
          
          <div className="flex items-center justify-between bg-white border border-border/60 rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <StatusBadge status={venta.status || 'pendiente'} />
              <span className="text-xs text-text-muted font-medium ml-1">
                {formatDate(venta.fecha)}
              </span>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted px-2 py-0.5 rounded border border-border/60 bg-surface-alt/30">
              {origen}
            </span>
          </div>

          {/* Cliente & CUIT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#C0443C] flex items-center gap-1" style={{ fontFamily: 'Inter' }}>
                <User size={10} />
                Nombre / Razón Social *
              </span>
              <input
                type="text"
                required
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C0443C]/30 focus:border-[#C0443C] transition-all font-medium"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1" style={{ fontFamily: 'Inter' }}>
                <Hash size={10} />
                CUIT / DNI
              </span>
              <input
                type="text"
                value={formData.cuit}
                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                placeholder="Opcional. Vacío = Consumidor Final"
                className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C0443C]/30 focus:border-[#C0443C] transition-all font-medium"
              />
              <span className="text-[10px] text-text-muted mt-0.5 italic leading-tight">
                Consumidor Final si vacío.
              </span>
            </div>
          </div>

          <div className="h-px bg-border/40 w-full" />

          {/* Detalle */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1" style={{ fontFamily: 'Inter' }}>
              <FileText size={10} />
              Concepto / Descripción
            </span>
            <input
              type="text"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C0443C]/30 focus:border-[#C0443C] transition-all font-medium"
            />
          </div>

          <div className="h-px bg-border/40 w-full" />

          {/* Monto & Forma de Pago */}
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#C0443C] flex items-center gap-1" style={{ fontFamily: 'Inter' }}>
                <DollarSign size={10} />
                Monto Total (ARS) *
              </span>
              <input
                type="number"
                required
                step="0.01"
                min="1"
                className="w-full px-4 py-2 rounded-lg border border-border bg-white text-lg font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-[#C0443C]/30 focus:border-[#C0443C] transition-all tabular-nums"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
              />
            </div>

            <div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1 mb-1.5" style={{ fontFamily: 'Inter' }}>
                <CreditCard size={10} />
                Forma de Pago
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {FORMAS_PAGO.map(fp => (
                  <button
                    key={fp}
                    type="button"
                    onClick={() => setFormData({ ...formData, formaPago: fp })}
                    className={`
                      px-2 py-1.5 rounded-md text-[10px] font-semibold text-center transition-all cursor-pointer border
                      ${formData.formaPago === fp
                        ? 'bg-[#C0443C]/10 border-[#C0443C]/30 text-[#C0443C]'
                        : 'bg-white border-border text-text-secondary hover:border-[#C0443C]/30'
                      }
                    `}
                    style={{ fontFamily: 'Inter' }}
                  >
                    {fp}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>

        {/* Footer Minimalista */}
        <div className="bg-white/80 backdrop-blur-md px-6 py-4 border-t border-border/40 shrink-0">
          <div className="flex flex-col gap-3">
            {/* Resumen */}
            <div className="flex items-center justify-between px-2 text-xs font-medium" style={{ fontFamily: 'Inter' }}>
               <span className="text-text-muted">Total modificado:</span>
               <span className="text-base font-black text-[#C0443C]">
                 {formData.monto ? `$ ${Number(formData.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '$ 0.00'}
               </span>
            </div>
            {/* Submit */}
            <button
              form="edit-sale-form"
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-[#000000] text-white flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[11px] hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
              style={{ fontFamily: 'Montserrat' }}
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              {loading ? 'Procesando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
