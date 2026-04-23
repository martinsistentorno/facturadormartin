import { useState, useRef, useEffect } from 'react';
import { User, Hash, Mail, MapPin, FileText, Package, CreditCard, DollarSign, Calendar, Loader2, ChevronDown } from 'lucide-react';

// ─── Constantes ───
const FORMAS_PAGO = [
  'Contado',
  'Tarjeta de Débito',
  'Tarjeta de Crédito',
  'Cuenta Corriente',
  'Cheque',
  'Transferencia Bancaria',
  'Otra',
  'Otros medios de pago electrónico',
];

const TIPOS_COMPROBANTE = [
  { value: 11, label: 'Factura C' },
  { value: 13, label: 'Nota de Crédito C' },
  { value: 12, label: 'Nota de Débito C' },
  { value: 15, label: 'Recibo C' },
];

const CONCEPTOS = [
  { value: 1, label: 'Productos' },
  { value: 2, label: 'Servicios' },
  { value: 3, label: 'Productos y Servicios' },
];

const UNIDADES_MEDIDA = [
  { value: 7, label: 'Unidades' },
  { value: 1, label: 'Kilogramos' },
  { value: 2, label: 'Metros' },
  { value: 3, label: 'Litros' },
  { value: 5, label: 'Toneladas' },
  { value: 97, label: 'Otras unidades' },
  { value: 98, label: 'Bonificación' },
  { value: 99, label: 'Sin definir' },
];

const CONDICIONES_IVA = [
  'Consumidor Final',
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
];

// ─── Sub-componentes ───
function MiniInput({ label, icon: Icon, type = 'text', value, onChange, placeholder, required, disabled, className = '', onBlur, onFocus, step, min }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted/70 flex items-center gap-1 ml-0.5">
        {Icon && <Icon size={10} />}
        {label} {required && <span className="text-[#C0443C]">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        step={step}
        min={min}
        autoComplete="off"
        className={`w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C4DFF]/10 focus:border-[#7C4DFF] transition-all font-medium placeholder:font-normal placeholder:text-text-muted/30 disabled:bg-surface-alt/50 disabled:text-text-muted disabled:cursor-not-allowed`}
      />
    </div>
  );
}

function MiniSelect({ label, icon: Icon, value, onChange, options, disabled, className = '', required }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted/70 flex items-center gap-1 ml-0.5">
        {Icon && <Icon size={10} />}
        {label} {required && <span className="text-[#C0443C]">*</span>}
      </span>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C4DFF]/10 focus:border-[#7C4DFF] transition-all font-medium appearance-none cursor-pointer disabled:bg-surface-alt/50 disabled:text-text-muted disabled:cursor-not-allowed"
      >
        {options.map(opt => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function SectionDivider({ label, icon: Icon, collapsed, onToggle, collapsible = false }) {
  return (
    <button
      type="button"
      onClick={collapsible ? onToggle : undefined}
      className={`flex items-center gap-2 w-full py-1 ${collapsible ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
    >
      {Icon && <Icon size={12} className="text-[#3460A8]" />}
      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#3460A8]">{label}</span>
      <div className="flex-1 h-px bg-border/40 ml-1" />
      {collapsible && (
        <ChevronDown size={12} className={`text-text-muted transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
      )}
    </button>
  );
}

// ─── Componente Principal ───
export default function SaleFormFields({
  form,
  setForm,
  showTipoComprobante = false,
  searchClientes,
  onCuitLookup,
  lookingUp = false,
  afipLocked = false,
  conceptoDefault = 1,
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [serviceOpen, setServiceOpen] = useState(form.concepto !== 1);
  const suggestionsRef = useRef(null);

  const needsServiceDates = form.concepto === 2 || form.concepto === 3;

  useEffect(() => {
    setServiceOpen(needsServiceDates);
  }, [needsServiceDates]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClienteChange = (e) => {
    const value = e.target.value.toUpperCase();
    setForm({ ...form, cliente: value });
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
    setForm({
      ...form,
      cliente: cliente.nombre,
      cuit: cliente.cuit || form.cuit,
      formaPago: cliente.formaPago || form.formaPago,
    });
    setShowSuggestions(false);
  };

  const handleCuitBlur = () => {
    if (onCuitLookup) onCuitLookup(form.cuit);
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Tipo de Comprobante (solo en nueva venta) ── */}
      {showTipoComprobante && (
        <>
          <SectionDivider label="Comprobante" icon={FileText} />
          <div className="grid grid-cols-1">
            <MiniSelect
              label="Tipo de Comprobante"
              icon={FileText}
              value={form.tipoCbte}
              onChange={(e) => setForm({ ...form, tipoCbte: parseInt(e.target.value) })}
              options={TIPOS_COMPROBANTE}
            />
          </div>
        </>
      )}

      {/* ── Receptor ── */}
      <SectionDivider label="Receptor" icon={User} />

      <div className="grid grid-cols-12 gap-3">
        {/* Tipo Doc */}
        <div className="col-span-4">
          <MiniSelect
            label="Tipo Doc"
            value={form.docType || (form.cuit?.length >= 10 ? 'CUIT' : 'DNI')}
            onChange={(e) => setForm({ ...form, docType: e.target.value })}
            options={[
              { value: 'CUIT', label: 'CUIT' },
              { value: 'CUIL', label: 'CUIL' },
              { value: 'DNI', label: 'DNI' },
              { value: 'Pasaporte', label: 'Pasaporte' },
              { value: 'Sin Identificar', label: 'Ninguno' }
            ]}
          />
        </div>

        {/* Nro Doc */}
        <div className="relative col-span-8">
          <MiniInput
            label="Nro de Documento"
            icon={Hash}
            value={form.cuit}
            onChange={(e) => setForm({ ...form, cuit: e.target.value })}
            onBlur={handleCuitBlur}
            placeholder="20-11111111-2"
          />
          {lookingUp && <Loader2 size={14} className="absolute right-3 top-8 animate-spin text-[#7C4DFF]" />}
        </div>

        {/* Condición IVA */}
        <div className="col-span-12">
          <MiniSelect
            label="Condición IVA"
            value={form.condicionIva}
            onChange={(e) => setForm({ ...form, condicionIva: e.target.value })}
            options={CONDICIONES_IVA}
          />
        </div>
      </div>

      {/* Razón Social — full width */}
      <div className="relative" ref={suggestionsRef}>
        <MiniInput
          label="Razón Social / Nombre"
          icon={User}
          value={form.cliente}
          onChange={handleClienteChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="Juan Pérez"
          required
        />
        {showSuggestions && (
          <div className="absolute left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto">
            {suggestions.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectSuggestion(c)}
                className="w-full text-left px-4 py-2.5 hover:bg-[#7C4DFF]/5 transition-colors flex items-center justify-between gap-2 cursor-pointer border-b border-border/30 last:border-0"
              >
                <span className="text-sm text-text-primary font-semibold">{c.nombre}</span>
                {c.cuit && <span className="text-[10px] text-text-muted font-mono bg-surface-alt px-2 py-0.5 rounded-lg">{c.cuit}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniInput
          label="Email"
          icon={Mail}
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="cliente@email.com"
        />
        <MiniInput
          label="Domicilio"
          icon={MapPin}
          value={form.domicilio}
          onChange={(e) => setForm({ ...form, domicilio: e.target.value.toUpperCase() })}
          placeholder="Av. Corrientes 1234"
        />
      </div>

      {/* ── Detalle ── */}
      <SectionDivider label="Detalle del Comprobante" icon={Package} />

      <div className="grid grid-cols-4 gap-3">
        <MiniSelect
          label="Concepto"
          icon={Package}
          value={form.concepto}
          onChange={(e) => setForm({ ...form, concepto: parseInt(e.target.value) })}
          options={CONCEPTOS}
        />
        <MiniInput
          label="Cantidad"
          type="number"
          value={form.cantidad}
          onChange={(e) => {
            const val = e.target.value;
            setForm({
              ...form,
              cantidad: val,
              monto: form.precioUnitario 
                ? (parseFloat(form.precioUnitario || 0) * parseFloat(val || 1)).toFixed(2) 
                : form.monto
            });
          }}
          min="1"
          step="0.01"
        />
        <MiniSelect
          label="Unidad"
          value={form.unidadMedida}
          onChange={(e) => setForm({ ...form, unidadMedida: parseInt(e.target.value) })}
          options={UNIDADES_MEDIDA}
        />
        <MiniInput
          label="P. Unitario"
          icon={DollarSign}
          type="number"
          value={form.precioUnitario !== undefined ? form.precioUnitario : (form.cantidad > 0 && form.monto ? (form.monto / form.cantidad).toFixed(2) : '')}
          onChange={(e) => {
            const val = e.target.value;
            setForm({
              ...form,
              precioUnitario: val,
              monto: val ? (parseFloat(val || 0) * parseFloat(form.cantidad || 1)).toFixed(2) : form.monto
            });
          }}
          min="0"
          step="0.01"
          placeholder="0.00"
        />
      </div>

      <MiniInput
        label="Descripción"
        icon={FileText}
        value={form.descripcion}
        onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
        placeholder="Ej: Servicios profesionales de consultoría"
      />

      {/* ── Servicio (condicional) ── */}
      {needsServiceDates && (
        <>
          <SectionDivider
            label="Período de Servicio"
            icon={Calendar}
            collapsible
            collapsed={!serviceOpen}
            onToggle={() => setServiceOpen(!serviceOpen)}
          />
          {serviceOpen && (
            <div className="grid grid-cols-3 gap-3 animate-fade-in">
              <MiniInput
                label="Período Desde"
                icon={Calendar}
                type="date"
                value={form.periodoDesde}
                onChange={(e) => setForm({ ...form, periodoDesde: e.target.value })}
                required
              />
              <MiniInput
                label="Período Hasta"
                icon={Calendar}
                type="date"
                value={form.periodoHasta}
                onChange={(e) => setForm({ ...form, periodoHasta: e.target.value })}
                required
              />
              <MiniInput
                label="Vto. Pago"
                icon={Calendar}
                type="date"
                value={form.vtoPago}
                onChange={(e) => setForm({ ...form, vtoPago: e.target.value })}
                required
              />
            </div>
          )}
        </>
      )}

      {/* ── Pago ── */}
      <SectionDivider label="Pago" icon={DollarSign} />

      <div className="grid grid-cols-2 gap-3">
        {/* Monto — destacado */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#2D8F5E] flex items-center gap-1 ml-0.5">
            <DollarSign size={10} />
            Monto Total (ARS) <span className="text-[#C0443C]">*</span>
          </span>
          <input
            type="number"
            required
            step="0.01"
            min="0.01"
            placeholder="0.00"
            className="w-full px-3 py-2.5 rounded-xl border-2 border-[#2D8F5E]/30 bg-white text-lg font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-[#2D8F5E]/15 focus:border-[#2D8F5E] transition-all tabular-nums"
            value={form.monto}
            onChange={(e) => {
              const val = e.target.value;
              setForm({ 
                ...form, 
                monto: val,
                precioUnitario: val && form.cantidad > 0 ? (parseFloat(val) / parseFloat(form.cantidad)).toFixed(2) : ''
              });
            }}
          />
        </div>

        {/* Fecha de emisión */}
        <MiniInput
          label="Fecha de Emisión"
          icon={Calendar}
          type="date"
          value={form.fechaEmision}
          onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })}
        />
      </div>

      {/* Forma de Pago — compact pills */}
      <div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted/70 flex items-center gap-1 ml-0.5 mb-2">
          <CreditCard size={10} />
          Forma de Pago
        </span>
        <div className="flex flex-wrap gap-2">
          {FORMAS_PAGO.map(fp => (
            <button
              key={fp}
              type="button"
              onClick={() => setForm({ ...form, formaPago: fp })}
              className={`
                px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border
                ${form.formaPago === fp
                  ? 'bg-[#121212] border-[#121212] text-white shadow-md shadow-black/15'
                  : 'bg-white border-border text-text-secondary hover:border-[#121212]/30 hover:text-text-primary'
                }
              `}
            >
              {fp}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Exportar constantes para uso externo
export { TIPOS_COMPROBANTE, CONCEPTOS, UNIDADES_MEDIDA, CONDICIONES_IVA, FORMAS_PAGO };
