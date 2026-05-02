import { useState, useEffect } from 'react'
import { Building2, MapPin, FileText, Hash, Calendar, Receipt, X, Save, AlertCircle, Lock, Loader2, Package } from 'lucide-react'

const CONDICION_IVA_OPTIONS = [
  'Responsable Monotributo',
  'IVA Responsable Inscripto',
]

const TIPO_CBTE_OPTIONS = [
  { value: 11, label: 'Factura C (Monotributo)' },
  { value: 1, label: 'Factura A (Resp. Inscripto)' },
  { value: 6, label: 'Factura B (Resp. Inscripto → C.F.)' },
]

const CONCEPTO_OPTIONS = [
  { value: 1, label: 'Productos' },
  { value: 2, label: 'Servicios' },
  { value: 3, label: 'Productos y Servicios' },
]

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
  concepto_default: 1,
}

// Campos que vienen de AFIP y se bloquean siempre
const AFIP_LOCKED_FIELDS = ['razon_social', 'cuit', 'cuit_fmt', 'condicion_iva', 'pto_vta', 'tipo_cbte']

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
  const [loadingAfip, setLoadingAfip] = useState(false)
  const [error, setError] = useState('')
  const [afipLoaded, setAfipLoaded] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    if (currentData) {
      // Existing config from DB — fields that came from AFIP stay locked
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
        monotributo_categoria: currentData.monotributo_categoria || 'A',
        concepto_default: currentData.concepto_default || 1,
      })
      setAfipLoaded(true)
    } else if (!afipLoaded) {
      // First setup — fetch from AFIP to pre-fill locked fields
      fetchAfipEmisor()
    }
  }, [currentData, isOpen])

  const fetchAfipEmisor = async () => {
    setLoadingAfip(true)
    try {
      const apiBase = import.meta.env.VITE_API_URL || ''
      const resp = await fetch(`${apiBase}/api/get-emisor`)
      if (!resp.ok) throw new Error('No se pudieron obtener los datos de AFIP')
      const data = await resp.json()
      setForm({
        razon_social: data.razon_social || '',
        cuit: data.cuit || '',
        cuit_fmt: data.cuit_fmt || '',
        domicilio: data.domicilio || '',
        inicio_actividades: data.inicio_actividades || '',
        condicion_iva: data.condicion_iva || 'Responsable Monotributo',
        ingresos_brutos: data.ingresos_brutos || '',
        pto_vta: data.pto_vta || 1,
        tipo_cbte: data.tipo_cbte || 11,
        monotributo_categoria: data.monotributo_categoria || 'A',
        concepto_default: 1,
      })
      setAfipLoaded(true)
    } catch (err) {
      console.error('Error cargando datos de AFIP:', err)
      setError('No se pudieron cargar los datos fiscales de AFIP. Completá manualmente.')
    } finally {
      setLoadingAfip(false)
    }
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

  // Fields from AFIP are always locked once we have data (either from DB or fetched)
  const hasAfipData = afipLoaded && form.razon_social && form.cuit

  return (
    <div 
      className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm flex items-center justify-center p-3 transition-all transition-opacity"
      onClick={isFirstSetup ? undefined : onClose}
    >
      <div 
        className="bg-[#F9F7F2] rounded-2xl shadow-xl border border-white/50 w-full max-w-[600px] max-h-[95vh] flex flex-col animate-slide-down relative z-[61]"
        onClick={(e) => e.stopPropagation()}
      >
          
          {/* Header */}
          <div className="bg-white/60 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-b border-border/40 shrink-0">
            <div>
              <span className="text-[9px] font-bold tracking-[0.2em] text-[#7C4DFF] uppercase mb-0.5 block">
                Configuración
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

          {/* Loading state */}
          {loadingAfip ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={24} className="animate-spin text-[#3460A8]" />
              <p className="text-xs text-text-muted uppercase font-bold tracking-widest">Consultando AFIP...</p>
            </div>
          ) : (
            <>
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

                  {/* AFIP data notice */}
                  {hasAfipData && (
                    <div className="flex items-center gap-2 bg-[#3460A8]/5 border border-[#3460A8]/15 rounded-xl px-3 py-2 text-[#3460A8] text-xs font-medium">
                      <Lock size={12} />
                      Los datos fiscales fueron obtenidos de AFIP y no se pueden modificar.
                    </div>
                  )}

                  {/* Razón Social & CUIT */}
                  <div className="grid grid-cols-5 gap-3">
                    <div className="col-span-3">
                      <MinimalField 
                        label="Razón Social" icon={Building2} full
                        value={form.razon_social}
                        onChange={(e) => setForm(p => ({ ...p, razon_social: e.target.value.toUpperCase() }))}
                        locked={hasAfipData} placeholder="Empresa S.A." required
                      />
                    </div>
                    <div className="col-span-2">
                      <MinimalField 
                        label="CUIT" icon={Hash} full
                        value={form.cuit_fmt || form.cuit}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/\D/g, '').slice(0, 11)
                          setForm(p => ({
                            ...p,
                            cuit: clean,
                            cuit_fmt: clean.length === 11
                              ? `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`
                              : clean,
                          }))
                        }}
                        locked={hasAfipData} placeholder="20-33795011-7" required
                      />
                    </div>
                  </div>

                  <div className="h-px bg-border/40 w-full" />

                  {/* Domicilio & IIBB (editables)  */}
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

                  <div className="grid grid-cols-2 gap-3">
                    <MinimalField 
                      label="Inicio de Actividades" icon={Calendar}
                      value={form.inicio_actividades}
                      onChange={(e) => setForm(p => ({ ...p, inicio_actividades: e.target.value }))}
                      placeholder="01/01/2020"
                    />
                  </div>

                  <div className="h-px bg-border/40 w-full" />

                  {/* Facturación (locked from AFIP/server config) */}
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-5">
                      <MinimalField 
                        label="Condición IVA" icon={Receipt} isSelect full
                        value={form.condicion_iva}
                        onChange={(e) => {
                          const newCond = e.target.value;
                          const isRI = newCond.toLowerCase().includes('responsable inscripto');
                          setForm(p => ({
                            ...p,
                            condicion_iva: newCond,
                            tipo_cbte: isRI ? 1 : 11, // Auto-ajustar tipo comprobante
                          }));
                        }}
                        options={CONDICION_IVA_OPTIONS}
                      />
                    </div>
                    <div className="col-span-4">
                      <MinimalField 
                        label="Comprobante" icon={FileText} isSelect full
                        value={form.tipo_cbte}
                        onChange={(e) => setForm(p => ({ ...p, tipo_cbte: parseInt(e.target.value) }))}
                        options={TIPO_CBTE_OPTIONS}
                        locked={hasAfipData}
                      />
                    </div>
                    <div className="col-span-3">
                      <MinimalField 
                        label="Punto Vta." icon={Hash} type="number" full
                        value={form.pto_vta}
                        onChange={(e) => setForm(p => ({ ...p, pto_vta: parseInt(e.target.value) || 1 }))}
                        locked={hasAfipData}
                      />
                    </div>
                  </div>

                  {form.condicion_iva?.toLowerCase().includes('monotributo') && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <MinimalField 
                          label="Categoría Monotributo" icon={FileText} isSelect full
                          value={form.monotributo_categoria || 'A'}
                          onChange={(e) => setForm(p => ({ ...p, monotributo_categoria: e.target.value }))}
                          options={[
                            { value: 'A', label: 'Categoría A' },
                            { value: 'B', label: 'Categoría B' },
                            { value: 'C', label: 'Categoría C' },
                            { value: 'D', label: 'Categoría D' },
                            { value: 'E', label: 'Categoría E' },
                            { value: 'F', label: 'Categoría F' },
                            { value: 'G', label: 'Categoría G' },
                            { value: 'H', label: 'Categoría H' },
                            { value: 'I', label: 'Categoría I' },
                            { value: 'J', label: 'Categoría J' },
                            { value: 'K', label: 'Categoría K' }
                          ]}
                        />
                      </div>
                      <div className="h-px bg-border/40 w-full" />
                    </>
                  )}

                  <div className="h-px bg-border/40 w-full" />

                  {/* Concepto por Defecto */}
                  <div className="grid grid-cols-2 gap-3">
                    <MinimalField 
                      label="Concepto por Defecto" icon={Package} isSelect full
                      value={form.concepto_default}
                      onChange={(e) => setForm(p => ({ ...p, concepto_default: parseInt(e.target.value) }))}
                      options={CONCEPTO_OPTIONS}
                    />
                  </div>

                </form>
              </div>

              {/* Footer */}
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
            </>
          )}

      </div>
    </div>
  )
}
