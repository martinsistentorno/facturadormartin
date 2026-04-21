import { useState, useEffect } from 'react'
import { Building2, MapPin, FileText, Hash, Calendar, Receipt, X, Save, AlertCircle, Lock } from 'lucide-react'
import { EMISOR } from '../config/emisor'

const CONDICION_IVA_OPTIONS = [
  'Responsable Monotributo',
  'IVA Responsable Inscripto',
  'IVA Sujeto Exento',
  'Consumidor Final',
]

const TIPO_CBTE_OPTIONS = [
  { value: 11, label: 'Factura C (Monotributo)' },
  { value: 1, label: 'Factura A (Resp. Inscripto)' },
  { value: 6, label: 'Factura B (Resp. Inscripto ? C.F.)' },
]

// Helper para saber si un dato ya viene fijo desde el .env
const isLocked = (value, placeholder) => {
  if (!value) return false
  if (String(value) === String(placeholder)) return false
  if (value === '00000000000' || value === '00-00000000-0') return false
  return true
}

const emptyForm = {
  razon_social: '',
  cuit: '',
  cuit_fmt: '',
  domicilio: '',
  inicio_actividades: '',
  condicion_iva: 'Responsable Monotributo',
  ingresos_brutos: '',
  pto_vta: 1,
  tipo_cbte: 11,
}

// Subcomponente Minimalista para los inputs
function MinimalField({ label, icon: Icon, type = "text", value, onChange, placeholder, locked, required, full = false, isSelect = false, options = [] }) {
  if (locked) {
    return (
      <div className={`flex flex-col gap-1 ${!full && 'col-span-1'}`}>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#3460A8]/80 flex items-center gap-1">
          {Icon && <Icon size={10} />}
          {label}
        </span>
        <div className="flex items-center justify-between px-3 py-2 bg-[#3460A8]/5 border border-[#3460A8]/20 rounded-lg">
          <span className="text-xs font-semibold text-[#000000] truncate">
            {isSelect ? options.find(o => o.value === value)?.label || value : value}
          </span>
          <Lock size={12} className="text-[#3460A8]/50 shrink-0 ml-2" />
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-1 ${!full && 'col-span-1'}`}>
      <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1">
        {Icon && <Icon size={10} />}
        {label} {required && '*'}
      </span>
      {isSelect ? (
        <select
          value={value}
          onChange={onChange}
          className="w-full px-3 py-2 rounded-lg border border-border bg-white text-xs focus:outline-none focus:ring-1 focus:ring-[#7C4DFF]/50 focus:border-[#7C4DFF] transition-all cursor-pointer font-medium"
        >
          {options.map(opt => (
            <option key={opt.value || opt} value={opt.value || opt}>
              {opt.label || opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="w-full px-3 py-2 rounded-lg border border-border bg-white text-xs focus:outline-none focus:ring-1 focus:ring-[#7C4DFF]/50 focus:border-[#7C4DFF] transition-all font-medium uppercase placeholder:normal-case placeholder:text-text-muted/60"
        />
      )}
    </div>
  )
}

export default function EmisorSetupModal({ isOpen, onClose, onSave, currentData, isFirstSetup }) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (currentData) {
      setForm({
        razon_social: currentData.razon_social || '',
        cuit: currentData.cuit || '',
        cuit_fmt: currentData.cuit_fmt || '',
        domicilio: currentData.domicilio || '',
        inicio_actividades: currentData.inicio_actividades || '',
        condicion_iva: currentData.condicion_iva || 'Responsable Monotributo',
        ingresos_brutos: currentData.ingresos_brutos || '',
        pto_vta: currentData.pto_vta || 1,
        tipo_cbte: currentData.tipo_cbte || 11,
      })
    } else {
      setForm({
        ...emptyForm,
        razon_social: isLocked(EMISOR.razonSocial, 'SIN CONFIGURAR') ? EMISOR.razonSocial : '',
        cuit: isLocked(EMISOR.cuit, '00000000000') ? EMISOR.cuit : '',
        cuit_fmt: isLocked(EMISOR.cuitFormateado, '00-00000000-0') ? EMISOR.cuitFormateado : '',
        domicilio: EMISOR.domicilio || '',
        inicio_actividades: EMISOR.inicioActividades || '',
        condicion_iva: EMISOR.condicionIva || 'Responsable Monotributo',
        ingresos_brutos: EMISOR.ingresosBrutos || '',
        pto_vta: EMISOR.ptoVta || 1,
        tipo_cbte: EMISOR.tipoCbte || 11,
      })
    }
  }, [currentData, isOpen])

  const handleCuitChange = (e) => {
    const value = e.target.value
    const clean = value.replace(/\D/g, '').slice(0, 11)
    setForm(prev => ({
      ...prev,
      cuit: clean,
      cuit_fmt: clean.length === 11
        ? `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`
        : clean,
      ingresos_brutos: prev.ingresos_brutos || (clean.length === 11
        ? `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`
        : '')
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.razon_social.trim()) return setError('La Razón Social es obligatoria')
    if (form.cuit.length !== 11) return setError('El CUIT debe tener 11 dígitos')

    setSaving(true)
    try {
      await onSave(form)
      if (!isFirstSetup) onClose()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  // Identificar bloqueos
  const lockRazon = isLocked(EMISOR.razonSocial, 'SIN CONFIGURAR')
  const lockCuit = isLocked(EMISOR.cuit, '00000000000')
  const lockIva = isLocked(EMISOR.condicionIva, 'SIN CONFIGURAR')
  const lockPtoVta = isLocked(EMISOR.ptoVta, 0)
  const lockCbte = isLocked(EMISOR.tipoCbte, 0)

  return (
    <div 
      className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm flex items-center justify-center p-3 transition-all transition-opacity"
      onClick={isFirstSetup ? undefined : onClose}
    >
      <div 
        className="bg-[#F9F7F2] rounded-2xl shadow-xl border border-white/50 w-full max-w-[600px] max-h-[95vh] flex flex-col animate-slide-down relative z-[61]"
        onClick={(e) => e.stopPropagation()}
      >
          
          {/* Header Minimalista */}
          <div className="bg-white/60 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-b border-border/40 shrink-0">
            <div>
              <span className="text-[9px] font-bold tracking-[0.2em] text-[#7C4DFF] uppercase mb-0.5 block">
                Ajustes Vercel
              </span>
              <h2 className="text-lg font-black uppercase text-[#000000] tracking-tight leading-none">
                Datos Fiscales
              </h2>
            </div>
            {!isFirstSetup && (
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-border flex items-center justify-center text-text-muted hover:text-[#C0443C] hover:border-[#C0443C] hover:-translate-y-0.5 transition-all cursor-pointer">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Form */}
          <div className="overflow-y-auto px-6 py-4 scrollbar-hide">
            <form id="emisor-form" onSubmit={handleSubmit} className="space-y-4">
              
              {/* Error Alert */}
              {error && (
                <div className="flex items-center gap-2 bg-[#C0443C]/10 border border-[#C0443C]/20 rounded-xl px-3 py-2 text-[#C0443C] text-xs font-medium animate-slide-down">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              {/* Razón Social & CUIT (Compacto a 2 columnas) */}
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-3">
                  <MinimalField 
                    label="Razón Social" icon={Building2} full
                    value={form.razon_social}
                    onChange={(e) => setForm(p => ({ ...p, razon_social: e.target.value.toUpperCase() }))}
                    locked={lockRazon} placeholder="Empresa S.A." required
                  />
                </div>
                <div className="col-span-2">
                  <MinimalField 
                    label="CUIT" icon={Hash} full
                    value={form.cuit_fmt || form.cuit}
                    onChange={handleCuitChange}
                    locked={lockCuit} placeholder="20-33795011-7" required
                  />
                </div>
              </div>

              <div className="h-px bg-border/40 w-full" />

              {/* Domicilio & IIBB / Inicio Act combinados */}
              <div className="grid grid-cols-2 gap-3">
                <MinimalField 
                  label="Domicilio Fiscal" icon={MapPin}
                  value={form.domicilio}
                  onChange={(e) => setForm(p => ({ ...p, domicilio: e.target.value.toUpperCase() }))}
                  placeholder="Ej: Calle 123, CABA"
                />
                <MinimalField 
                   label="Ingresos Brutos" icon={FileText}
                   value={form.ingresos_brutos}
                   onChange={(e) => setForm(p => ({ ...p, ingresos_brutos: e.target.value }))}
                   placeholder="Igual al CUIT"
                 />
              </div>

              {/* Facturación (3 columnas compactas) */}
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-5">
                  <MinimalField 
                    label="Condición IVA" icon={Receipt} isSelect full
                    value={form.condicion_iva}
                    onChange={(e) => setForm(p => ({ ...p, condicion_iva: e.target.value }))}
                    options={CONDICION_IVA_OPTIONS}
                    locked={lockIva}
                  />
                </div>
                <div className="col-span-4">
                  <MinimalField 
                    label="Comprobante" icon={FileText} isSelect full
                    value={form.tipo_cbte}
                    onChange={(e) => setForm(p => ({ ...p, tipo_cbte: parseInt(e.target.value) }))}
                    options={TIPO_CBTE_OPTIONS}
                    locked={lockCbte}
                  />
                </div>
                <div className="col-span-3">
                  <MinimalField 
                    label="Punto Vta." icon={Hash} type="number" full
                    value={form.pto_vta}
                    onChange={(e) => setForm(p => ({ ...p, pto_vta: parseInt(e.target.value) || 1 }))}
                    locked={lockPtoVta}
                  />
                </div>
              </div>

            </form>
          </div>

          {/* Footer Minimalista */}
          <div className="bg-white/80 backdrop-blur-md px-6 py-3 border-t border-border/40 shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-[9px] uppercase font-bold tracking-widest text-text-muted flex items-center gap-1">
                <Lock size={10} /> Protegido por AFIP
              </p>
              <button
                form="emisor-form"
                type="submit"
                disabled={saving}
                className="h-10 px-6 rounded-xl bg-[#3460A8] text-white flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20 hover:bg-[#2F528F] transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
               
              >
                {saving ? 'Guardando...' : (isFirstSetup ? 'Comenzar' : 'Actualizar')}
              </button>
            </div>
          </div>

      </div>
    </div>
  )
}
