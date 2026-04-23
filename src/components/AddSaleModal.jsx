import { useState, useEffect } from 'react';
import { Plus, Loader2, X } from 'lucide-react';
import SaleFormFields from './SaleFormFields';
import { useConfig } from '../context/ConfigContext';

const TODAY = new Date().toISOString().split('T')[0];

function getEmptyForm(conceptoDefault = 1) {
  return {
    cliente: '',
    cuit: '',
    docType: 'DNI',
    condicionIva: 'Consumidor Final',
    email: '',
    domicilio: '',
    concepto: conceptoDefault,
    descripcion: 'Varios',
    cantidad: '1',
    unidadMedida: 7,
    periodoDesde: '',
    periodoHasta: '',
    vtoPago: '',
    monto: '',
    formaPago: 'Contado - Efectivo',
    fechaEmision: TODAY,
    tipoCbte: 11,
  };
}

export default function AddSaleModal({ isOpen, onClose, onSave, searchClientes }) {
  const { emisor } = useConfig();
  const conceptoDefault = emisor?.concepto_default || 1;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(getEmptyForm(conceptoDefault));
  const [lookingUp, setLookingUp] = useState(false);
  const [afipLocked, setAfipLocked] = useState(false);

  const resetForm = () => {
    setFormData(getEmptyForm(conceptoDefault));
    setAfipLocked(false);
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

  const handleCuitLookup = async (rawCuit) => {
    const val = (rawCuit || '').replace(/\D/g, '');
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
            docType: 'CUIT',
            condicionIva: data.razonSocial.condicion_iva || (val.length === 11 ? 'Responsable Inscripto' : 'Consumidor Final'),
            cuit: val,
            domicilio: data.razonSocial.domicilio || prev.domicilio,
          }));
          setAfipLocked(true);
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
      const needsService = formData.concepto === 2 || formData.concepto === 3;

      await onSave({
        cliente: formData.cliente,
        monto: parseFloat(formData.monto),
        status: 'pendiente',
        mp_payment_id: null,
        datos_fiscales: {
          cuit: formData.cuit,
          doc_tipo: formData.docType || (formData.cuit?.length >= 10 ? 'CUIT' : 'DNI'),
          condicion_iva: formData.condicionIva,
          email: formData.email,
          domicilio: formData.domicilio,
          concepto: formData.concepto,
          descripcion: formData.descripcion,
          cantidad: parseFloat(formData.cantidad) || 1,
          unidad_medida: formData.unidadMedida,
          ...(needsService ? {
            periodo_desde: formData.periodoDesde,
            periodo_hasta: formData.periodoHasta,
            vto_pago: formData.vtoPago,
          } : {}),
          forma_pago: formData.formaPago,
          fecha_emision: formData.fechaEmision,
          tipo_cbte: formData.tipoCbte,
          origen: 'manual',
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
        className="bg-[#F9F7F2] rounded-2xl shadow-xl border border-white/50 w-full max-w-[600px] max-h-[95vh] flex flex-col animate-slide-down relative z-[151]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-border/40 shrink-0">
          <div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#2D8F5E] uppercase mb-0.5 block opacity-80">
              Operaciones
            </span>
            <h2 className="text-lg font-black uppercase text-text-primary tracking-tight leading-none">
              Nueva Venta
            </h2>
          </div>
          <button onClick={handleClose} className="w-9 h-9 rounded-full bg-white border border-border flex items-center justify-center text-text-muted hover:text-[#C0443C] hover:border-[#C0443C] hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form
          id="add-sale-form"
          onSubmit={handleSubmit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          className="overflow-y-auto px-6 py-5 scrollbar-hide"
        >
          <SaleFormFields
            form={formData}
            setForm={setFormData}
            showTipoComprobante={true}
            searchClientes={searchClientes}
            onCuitLookup={handleCuitLookup}
            lookingUp={lookingUp}
            afipLocked={afipLocked}
            conceptoDefault={conceptoDefault}
          />
        </form>

        {/* Footer */}
        <div className="bg-white/60 backdrop-blur-md px-6 py-4 border-t border-border/40 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted/60">Monto Final</span>
            <span className="text-xl font-bold text-text-primary tabular-nums">
              {formData.monto ? `$ ${Number(formData.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '$ 0.00'}
            </span>
          </div>
          <button
            form="add-sale-form"
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-2xl bg-[#121212] text-white flex items-center justify-center gap-3 font-bold uppercase tracking-[0.2em] text-xs hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
          >
            {loading ? <Loader2 className="animate-spin text-white" size={18} /> : <Plus size={18} />}
            {loading ? 'PROCESANDO...' : 'GENERAR VENTA'}
          </button>
        </div>
      </div>
    </div>
  );
}
