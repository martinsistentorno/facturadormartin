import { X, FileDown, Edit2, RotateCcw, Calendar, CreditCard, User, ShieldCheck, Clock, Save, Loader2, Mail, MapPin, Package } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { generateInvoicePdf } from '../utils/invoicePdf';
import { useEffect, useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import { translatePaymentMethod } from '../utils/paymentMethods';
import SaleFormFields, { CONCEPTOS, UNIDADES_MEDIDA } from './SaleFormFields';

export default function SaleDetailDrawer({ venta, isOpen, onClose, onSave, onRetry, initialEditMode = false }) {
  const { emisor } = useConfig();
  const conceptoDefault = emisor?.concepto_default || 1;

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [lookingUp, setLookingUp] = useState(false);
  const [afipLocked, setAfipLocked] = useState(false);

  // Initialize edit form from venta
  useEffect(() => {
    if (venta) {
      const df = venta.datos_fiscales || {};
      setEditForm({
        cliente: venta.cliente || '',
        cuit: df.cuit || '',
        condicionIva: df.condicion_iva || (df.cuit?.length === 11 ? 'Responsable Inscripto' : 'Consumidor Final'),
        email: df.email || '',
        domicilio: df.domicilio || '',
        concepto: df.concepto || conceptoDefault,
        descripcion: df.descripcion || 'Varios',
        cantidad: String(df.cantidad || 1),
        unidadMedida: df.unidad_medida || 7,
        periodoDesde: df.periodo_desde || '',
        periodoHasta: df.periodo_hasta || '',
        vtoPago: df.vto_pago || '',
        monto: venta.monto || 0,
        formaPago: df.forma_pago || 'Contado - Efectivo',
        fechaEmision: df.fecha_emision || new Date().toISOString().split('T')[0],
        tipoCbte: df.tipo_cbte || emisor?.tipo_cbte || 11,
      });
      setIsEditing(initialEditMode);
      setAfipLocked(false);
    }
  }, [venta, isOpen, initialEditMode]);

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

  if (!isOpen || !venta) return null;

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const formatTime = (d) => d ? new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
  const formatCurrency = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(Number(n) || 0);

  const df = venta.datos_fiscales || {};
  const cuitCliente = df.cuit || '';
  const condIva = df.condicion_iva || (cuitCliente && cuitCliente.length >= 10 ? 'IVA Responsable Inscripto' : 'Consumidor Final');
  const formaPago = translatePaymentMethod(df.forma_pago);

  const origenRaw = df.origen;
  const origen = origenRaw === 'mercadolibre' ? 'Mercado Libre' : origenRaw === 'mercadopago' ? 'Mercado Pago' : venta.mp_payment_id ? 'Mercado Libre' : 'Manual';
  const displayPaymentId = venta.mp_payment_id ? venta.mp_payment_id.replace(/^order-/, '') : '';

  const conceptoLabel = CONCEPTOS.find(c => c.value === df.concepto)?.label || 'Productos';
  const unidadLabel = UNIDADES_MEDIDA.find(u => u.value === df.unidad_medida)?.label || 'Unidades';

  const handleDownload = async () => {
    if (venta.pdf_url) {
      try {
        const check = await fetch(venta.pdf_url, { method: 'HEAD' });
        if (check.ok) {
          window.open(venta.pdf_url, '_blank');
          return;
        }
      } catch (_) { /* URL expirada o inaccesible */ }
    }
    generateInvoicePdf(venta, emisor);
  };

  const handleCuitLookup = async (rawCuit) => {
    const val = (rawCuit || '').replace(/\D/g, '');
    if (!val || val.length < 8) return;

    setLookingUp(true);
    try {
      const res = await fetch(`/api/lookup-cuit?cuit=${val}`);
      if (res.ok) {
        const data = await res.json();
        if (data.razonSocial && data.razonSocial.razonSocial) {
          setEditForm(prev => ({
            ...prev,
            cliente: data.razonSocial.razonSocial,
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

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const needsService = editForm.concepto === 2 || editForm.concepto === 3;

      if (onSave) {
        await onSave(venta.id, {
          cliente: editForm.cliente,
          monto: parseFloat(editForm.monto),
          datos_fiscales: {
            ...venta.datos_fiscales,
            cuit: editForm.cuit,
            condicion_iva: editForm.condicionIva,
            email: editForm.email,
            domicilio: editForm.domicilio,
            concepto: editForm.concepto,
            descripcion: editForm.descripcion,
            cantidad: parseFloat(editForm.cantidad) || 1,
            unidad_medida: editForm.unidadMedida,
            ...(needsService ? {
              periodo_desde: editForm.periodoDesde,
              periodo_hasta: editForm.periodoHasta,
              vto_pago: editForm.vtoPago,
            } : {}),
            forma_pago: editForm.formaPago,
            fecha_emision: editForm.fechaEmision,
          }
        });
      }
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Status timeline
  const statusSteps = [
    { key: 'pendiente', label: 'Pendiente', icon: Clock },
    { key: 'procesando', label: 'Procesando', icon: RotateCcw },
    { key: 'facturado', label: 'Facturado', icon: ShieldCheck },
  ];
  const currentStepIndex = statusSteps.findIndex(s => s.key === venta.status);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-[151] w-full max-w-lg bg-surface border-l border-border shadow-2xl animate-drawer-in overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface/95 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">
              {isEditing ? 'Editar Venta' : 'Detalle de Venta'}
            </h3>
            <p className="text-xs text-text-muted mt-0.5 font-mono">{venta.id?.slice(0, 8)}...</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status="procesando" />
                <span className="text-xs font-bold uppercase tracking-widest text-[#7C4DFF]">Modo Edición</span>
              </div>

              <SaleFormFields
                form={editForm}
                setForm={setEditForm}
                showTipoComprobante={false}
                onCuitLookup={handleCuitLookup}
                lookingUp={lookingUp}
                afipLocked={afipLocked}
                conceptoDefault={conceptoDefault}
              />

              <div className="pt-3 flex items-center gap-3">
                <button type="button" onClick={() => { setIsEditing(false); setAfipLocked(false); }} disabled={saving} className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-text-muted hover:bg-surface-alt transition-colors cursor-pointer border border-transparent hover:border-border">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest bg-[#7C4DFF] text-white hover:bg-[#6a3ee6] transition-colors flex justify-center items-center gap-2 cursor-pointer shadow-lg shadow-[#7C4DFF]/20">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Guardar
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* ─── Status + monto hero ─── */}
              <div className="flex items-center justify-between">
                <StatusBadge status={venta.status} />
                <span className="text-2xl font-bold text-text-primary">
                  {formatCurrency(venta.monto)}
                </span>
              </div>

              {/* ─── Cliente ─── */}
              <Section title="Receptor" icon={User}>
                <InfoRow label="Razón Social" value={venta.cliente || 'Consumidor Final'} />
                <InfoRow label="CUIT / DNI" value={cuitCliente || 'Sin identificar'} />
                <InfoRow label="Condición IVA" value={condIva} />
                {df.email && <InfoRow label="Email" value={df.email} />}
                {df.domicilio && <InfoRow label="Domicilio" value={df.domicilio} />}
              </Section>

              {/* ─── Detalle ─── */}
              <Section title="Detalle" icon={Package}>
                <InfoRow label="Concepto" value={conceptoLabel} />
                <InfoRow label="Descripción" value={df.descripcion || 'Productos varios'} />
                <InfoRow label="Cantidad" value={`${df.cantidad || 1} ${unidadLabel}`} />
                {(df.concepto === 2 || df.concepto === 3) && (
                  <>
                    {df.periodo_desde && <InfoRow label="Período" value={`${df.periodo_desde} → ${df.periodo_hasta}`} mono />}
                    {df.vto_pago && <InfoRow label="Vto. Pago" value={df.vto_pago} mono />}
                  </>
                )}
              </Section>

              {/* ─── Operación ─── */}
              <Section title="Operación" icon={CreditCard}>
                <InfoRow label="Fecha Venta" value={`${formatDate(venta.fecha)} ${formatTime(venta.fecha)}`} />
                {df.fecha_emision && <InfoRow label="Fecha Emisión" value={formatDate(df.fecha_emision + 'T12:00:00')} />}
                <InfoRow label="Forma de Pago" value={formaPago} />
                <InfoRow label="Origen" value={origen} highlight={origen === 'Mercado Libre' ? 'accent' : null} />
                {displayPaymentId && (
                  <InfoRow label={origen === 'Mercado Pago' ? 'ID Pago MP' : 'ID MeLi'} value={`#${displayPaymentId}`} mono />
                )}
              </Section>

              {/* ─── AFIP ─── */}
              {(venta.cae || venta.nro_comprobante) && (
                <Section title="Datos AFIP" icon={ShieldCheck}>
                  <InfoRow label="Nro Comprobante" value={venta.nro_comprobante || '—'} mono />
                  <InfoRow label="CAE" value={venta.cae || '—'} mono />
                  <InfoRow label="Vto. CAE" value={formatDate(venta.vto_cae)} />
                </Section>
              )}

              {/* ─── Error detalle ─── */}
              {venta.status === 'error' && df.error_detalle && (
                <div className="bg-red-subtle/50 border border-red/20 rounded-xl p-4">
                  <p className="text-xs font-bold text-red uppercase tracking-widest mb-2">
                    Motivo del Error
                  </p>
                  <p className="text-sm text-red/80">{df.error_detalle}</p>
                </div>
              )}

              {/* ─── Timeline ─── */}
              <Section title="Historial" icon={Calendar}>
                <div className="flex items-center gap-0 mt-2 px-3 pb-2">
                  {statusSteps.map((step, i) => {
                    const isActive = i <= currentStepIndex && venta.status !== 'error';
                    const isCurrent = step.key === venta.status;
                    const StepIcon = step.icon;
                    return (
                      <div key={step.key} className="flex items-center flex-1">
                        <div className={`
                          flex flex-col items-center gap-1
                          ${isActive ? 'text-green' : 'text-text-muted/40'}
                          ${isCurrent ? 'scale-110' : ''}
                          transition-all
                        `}>
                          <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center
                            ${isActive ? 'bg-green-subtle' : 'bg-surface-alt'}
                            ${isCurrent ? 'ring-2 ring-green/30' : ''}
                          `}>
                            <StepIcon size={14} />
                          </div>
                          <span className="text-[10px] font-medium">{step.label}</span>
                        </div>
                        {i < statusSteps.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 rounded-full ${isActive ? 'bg-green/30' : 'bg-border'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {venta.status === 'error' && (
                  <div className="flex items-center gap-2 mt-1 px-4 pb-2 text-red text-xs">
                    <div className="w-3 h-3 rounded-full bg-red" />
                    Estado: Error — Requiere atención
                  </div>
                )}
              </Section>

              {/* ─── Actions ─── */}
              <div className="flex flex-col gap-2 pt-2">
                {venta.status === 'facturado' && venta.cae && (
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 bg-[#3460A8] text-white py-3 rounded-xl font-bold uppercase tracking-wider text-sm hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <FileDown size={16} />
                    Descargar PDF
                  </button>
                )}
                {venta.status === 'error' && onRetry && (
                  <button
                    onClick={() => onRetry(venta.id)}
                    className="w-full flex items-center justify-center gap-2 bg-[#7C4DFF] text-white py-3 rounded-xl font-bold uppercase tracking-wider text-sm hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <RotateCcw size={16} />
                    Reintentar Facturación
                  </button>
                )}
                {venta.status === 'pendiente' && onSave && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full flex items-center justify-center gap-2 bg-surface-alt border border-border text-text-primary py-3 rounded-xl font-bold uppercase tracking-wider text-sm hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer"
                  >
                    <Edit2 size={16} />
                    Editar Datos
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Sub-components ─── */

function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={14} className="text-text-muted" />}
        <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest">
          {title}
        </h4>
      </div>
      <div className="bg-surface-alt/50 border border-border rounded-xl divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, highlight }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-text-muted">{label}</span>
      <span className={`
        text-sm font-medium text-right max-w-[60%] truncate
        ${mono ? 'font-mono text-xs' : ''}
        ${highlight === 'accent' ? 'text-accent' : 'text-text-primary'}
      `}>
        {value}
      </span>
    </div>
  );
}
