import { useState, useRef, useEffect } from 'react';
import { Plus, Loader2, X, User, CreditCard, DollarSign, FileText, Hash } from 'lucide-react';

const FORMAS_PAGO = [
  'Contado - Efectivo',
  'Transferencia Bancaria',
  'Tarjeta de Débito',
  'Tarjeta de Crédito',
  'Mercado Pago',
  'Otro',
];

// Reutilizamos el diseño del campo minimalista
function MinimalField({ label, icon: Icon, type = "text", value, onChange, placeholder, required, full = false, onFocus, onBlur, step, min }) {
  return (
    <div className={`flex flex-col gap-1 ${!full && 'col-span-1'}`}>
      <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1" style={{ fontFamily: 'var(--font-outfit)' }}>
        {Icon && <Icon size={10} />}
        {label} {required && '*'}
      </span>
        <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        step={step}
        min={min}
        autoComplete="off"
        className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#7C4DFF]/50 focus:border-[#7C4DFF] transition-all font-medium placeholder:font-normal placeholder:text-text-muted/60"
      />
    </div>
  )
}

export default function AddSaleModal({ isOpen, onClose, onSave, searchClientes }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cliente: '',
    cuit: '',
    descripcion: 'Varios',
    monto: '',
    condicionIva: 'Consumidor Final',
    formaPago: 'Contado - Efectivo',
  });
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const suggestionsRef = useRef(null);

  const resetForm = () => {
    setFormData({ cliente: '', cuit: '', descripcion: 'Varios', monto: '', condicionIva: 'Consumidor Final', formaPago: 'Contado - Efectivo' });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

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

  useEffect(() => {
    const handler = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClienteChange = (e) => {
    const value = e.target.value.toUpperCase();
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

  const handleCuitBlur = async () => {
    const val = formData.cuit.replace(/\D/g, '');
    if (!val || val.length < 8) return;

    setLookingUp(true);
    try {
      const res = await fetch(`/api/lookup-cuit?cuit=${val}`);
      if (res.ok) {
        const data = await res.json();
        if (data.razonSocial && data.razonSocial.razonSocial) {
           setFormData(prev => ({
              ...prev,
              cliente: data.razonSocial.razonSocial,
              condicionIva: data.razonSocial.condicion_iva || (val.length === 11 ? 'Responsable Inscripto' : 'Consumidor Final'),
              cuit: val
           }));
        }
      }
    } catch(err) {
      console.error('Error fetching CUIT', err);
    } finally {
      setLookingUp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        cliente: formData.cliente,
        monto: parseFloat(formData.monto),
        status: 'pendiente',
        mp_payment_id: null,
        datos_fiscales: {
          cuit: formData.cuit,
          condicion_iva: formData.condicionIva,
          forma_pago: formData.formaPago,
          descripcion: formData.descripcion,
          origen: 'Manual'
        }
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
    <div 
      className="fixed inset-0 z-[150] bg-black/20 backdrop-blur-sm flex items-center justify-center p-3 transition-opacity"
      onClick={handleClose}
    >
      <div 
        className="bg-[#F9F7F2] rounded-2xl shadow-xl border border-white/50 w-full max-w-[500px] max-h-[95vh] flex flex-col animate-slide-down relative z-[151]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Minimalista */}
        <div className="bg-white/60 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-b border-border/40 shrink-0">
          <div>
            <span className="text-[9px] font-bold tracking-[0.2em] text-[#2D8F5E] uppercase mb-0.5 block" style={{ fontFamily: 'var(--font-outfit)' }}>
              Operaciones
            </span>
            <h2 className="text-lg font-black uppercase text-[#000000] tracking-tight leading-none" style={{ fontFamily: 'var(--font-montserrat)' }}>
              Nueva Venta
            </h2>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-full bg-white border border-border flex items-center justify-center text-text-muted hover:text-[#C0443C] hover:border-[#C0443C] hover:-translate-y-0.5 transition-all cursor-pointer">
            <X size={14} />
          </button>
        </div>

        <form 
          id="add-sale-form" 
          onSubmit={handleSubmit} 
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          className="overflow-y-auto p-6 scrollbar-hide flex flex-col gap-6"
        >
          
          {/* Cliente & CUIT */}
          <div className="space-y-4">
            <div className="relative" ref={suggestionsRef}>
              <MinimalField 
                label="Cliente / Razón Social" icon={User} full
                value={formData.cliente}
                onChange={handleClienteChange}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Juan Pérez" required
              />
              {showSuggestions && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                  {suggestions.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectSuggestion(c)}
                      className="w-full text-left px-4 py-3 hover:bg-[#3460A8]/5 transition-colors flex items-center justify-between gap-2 cursor-pointer border-b border-border/40 last:border-0"
                    >
                      <span className="text-sm text-text-primary font-medium" style={{ fontFamily: 'var(--font-outfit)' }}>{c.nombre}</span>
                      {c.cuit && <span className="text-[10px] text-text-muted font-mono bg-surface px-2 py-0.5 rounded">{c.cuit}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <MinimalField 
                label="CUIT / DNI" icon={Hash} full
                value={formData.cuit}
                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                onBlur={handleCuitBlur}
                placeholder="Ingresá y deseleccioná para buscar..."
              />
              {lookingUp && <Loader2 size={14} className="absolute right-3 top-9 animate-spin text-accent" />}
            </div>

            {/* Condición IVA */}
            <div className="flex flex-col gap-1 w-full mt-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1" style={{ fontFamily: 'var(--font-outfit)' }}>
                Condición frente al IVA
              </span>
              <select
                value={formData.condicionIva}
                onChange={(e) => setFormData({ ...formData, condicionIva: e.target.value })}
                className="w-full px-3 py-2 border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C4DFF]/50 focus:border-[#7C4DFF] transition-all font-medium appearance-none rounded-lg"
              >
                <option value="Consumidor Final">Consumidor Final</option>
                <option value="Responsable Inscripto">Responsable Inscripto</option>
                <option value="Monotributista">Monotributista</option>
                <option value="Exento">Exento</option>
              </select>
            </div>

            <MinimalField 
              label="Descripción Venta" icon={FileText} full
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Ej: Varios / Servicios Profesionales"
            />
          </div>

          <div className="h-px bg-border/40 w-full" />

          {/* Monto & Forma de Pago */}
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#2D8F5E] flex items-center gap-1" style={{ fontFamily: 'var(--font-outfit)' }}>
                <DollarSign size={10} />
                Monto Total (ARS) *
              </span>
              <input
                type="number"
                required
                step="0.01"
                min="1"
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl border border-border bg-white text-xl font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-[#2D8F5E]/30 focus:border-[#2D8F5E] transition-all tabular-nums"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
              />
            </div>

            <div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1 mb-2" style={{ fontFamily: 'var(--font-outfit)' }}>
                <CreditCard size={10} />
                Forma de Pago
              </span>
              <div className="grid grid-cols-2 gap-2">
                {FORMAS_PAGO.map(fp => (
                  <button
                    key={fp}
                    type="button"
                    onClick={() => setFormData({ ...formData, formaPago: fp })}
                    className={`
                      px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-center transition-all cursor-pointer border-2
                      ${formData.formaPago === fp
                        ? 'bg-[#3460A8] border-[#3460A8] text-white shadow-md shadow-[#3460A8]/20'
                        : 'bg-white border-border text-text-secondary hover:border-[#3460A8] hover:text-[#3460A8]'
                      }
                    `}
                    style={{ fontFamily: 'var(--font-montserrat)' }}
                  >
                    {fp}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>

        {/* Footer Minimalista */}
        <div className="bg-[#F9F7F2] px-6 py-6 border-t-[3px] border-black/5 shrink-0">
          <div className="flex flex-col gap-4">
            {/* Resumen */}
            <div className="flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-widest" style={{ fontFamily: 'var(--font-montserrat)' }}>
               <span className="text-text-muted">Monto Final:</span>
               <span className="text-xl font-black text-[#000000]">
                 {formData.monto ? `$ ${Number(formData.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '$ 0.00'}
               </span>
            </div>
            {/* Submit */}
            <button
              form="add-sale-form"
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-xl bg-[#000000] text-white flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-xs hover:-translate-y-1.5 hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.4)] transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer border-2 border-black"
              style={{ fontFamily: 'var(--font-montserrat)' }}
            >
              {loading ? <Loader2 className="animate-spin text-white" size={20} /> : <Plus size={20} />}
              {loading ? 'PROCESANDO...' : 'GENERAR VENTA'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
