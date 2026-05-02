import { X, FileDown, Edit2, RotateCcw, Calendar, CreditCard, User, ShieldCheck, Clock, Save, Loader2, Mail, MapPin, Package, FileText, Link2, Percent, FolderKanban } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { generateInvoicePdf } from '../utils/invoicePdf';
import { useEffect, useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import { translatePaymentMethod, simplifyPaymentMethod } from '../utils/paymentMethods';
import SaleFormFields, { CONCEPTOS, UNIDADES_MEDIDA } from './SaleFormFields';
import { getTiposComprobante, calcularIVA, getAlicuotaById, needsCbteAsociado } from '../utils/ivaHelpers';
import { getEtiquetas } from '../utils/labelHelpers';

export default function SaleDetailDrawer({ venta, isOpen, onClose, onSave, onRetry, onAnular, initialEditMode = false, customFolders = [], labels = [] }) {
  const { emisor, isRI } = useConfig();
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
      const asoc = df.cbte_asoc || {};
      setEditForm({
        cliente: venta.cliente || '',
        cuit: df.cuit || '',
        docType: df.doc_tipo || (df.cuit?.length >= 10 ? 'CUIT' : 'DNI'),
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
        formaPago: simplifyPaymentMethod(df.forma_pago || 'Contado'),
        fechaEmision: df.fecha_emision || new Date().toISOString().split('T')[0],
        tipoCbte: df.tipo_cbte || emisor?.tipo_cbte || 11,
        // Comprobante asociado
        cbteAsocTipo: asoc.tipo || 11,
        cbteAsocNroFmt: asoc.pto_vta && asoc.nro
          ? `${String(asoc.pto_vta).padStart(4, '0')}-${String(asoc.nro).padStart(8, '0')}`
          : '',
        cbteAsocPtoVta: asoc.pto_vta || 0,
        cbteAsocNro: asoc.nro || 0,
        cbteAsocFecha: asoc.fecha || '',
        // IVA
        ivaAlicuota: df.iva_alicuota_id || 5,
        // Organization
        folder: venta.folder || '',
        etiquetas: getEtiquetas(venta),
      });
      
      // Auto-open in editing if it's pending
      setIsEditing(initialEditMode || venta.status === 'pendiente');
      setAfipLocked(df.cuit?.length >= 8);
    }
  }, [venta, isOpen, initialEditMode, conceptoDefault, emisor?.tipo_cbte]);

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

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const needsService = editForm.concepto === 2 || editForm.concepto === 3;
      const needsCbteAsoc = needsCbteAsociado(editForm.tipoCbte);

      // IVA data for RI
      const ivaInfo = isRI ? calcularIVA(parseFloat(editForm.monto), editForm.ivaAlicuota || 5) : null;
      const alicuota = isRI ? getAlicuotaById(editForm.ivaAlicuota || 5) : null;

      if (onSave) {
        await onSave(venta.id, {
          cliente: editForm.cliente,
          monto: parseFloat(editForm.monto),
          datos_fiscales: {
            ...venta.datos_fiscales,
            cuit: editForm.cuit,
            doc_tipo: editForm.docType,
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
            ...(needsCbteAsoc ? {
              cbte_asoc: {
                tipo: editForm.cbteAsocTipo || 11,
                pto_vta: editForm.cbteAsocPtoVta || 0,
                nro: editForm.cbteAsocNro || 0,
                fecha: editForm.cbteAsocFecha || '',
              }
            } : {}),
            ...(isRI && ivaInfo ? {
              iva_alicuota_id: editForm.ivaAlicuota || 5,
              iva_porcentaje: alicuota?.rate || 0.21,
              neto_gravado: ivaInfo.netoGravado,
              iva_monto: ivaInfo.ivaMonto,
            } : {}),
            forma_pago: editForm.formaPago,
            fecha_emision: editForm.fechaEmision,
          },
          folder: editForm.folder,
          etiquetas: editForm.etiquetas,
          etiqueta: editForm.etiquetas[0] || '',
        });
      }
      // After save, just close the drawer
      onClose();
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
              {isEditing ? 'Editar Datos' : 'Detalle de Venta'}
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

        <div className="p-6 space-y-6">
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-4 animate-fade-in">
              <SaleFormFields
                form={editForm}
                setForm={setEditForm}
                showTipoComprobante={false}
                onCuitLookup={handleCuitLookup}
                lookingUp={lookingUp}
                afipLocked={afipLocked}
                conceptoDefault={conceptoDefault}
                isRI={isRI}
                emisor={emisor}
              />

              <div className="pt-3 flex items-center gap-3">
                <button 
                  type="button" 
                  onClick={onClose} 
                  disabled={saving} 
                  className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-text-muted hover:bg-surface-alt transition-colors cursor-pointer border border-transparent hover:border-border"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest bg-[#7C4DFF] text-white hover:bg-[#6a3ee6] transition-colors flex justify-center items-center gap-2 cursor-pointer shadow-lg shadow-[#7C4DFF]/20"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Guardar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {/* ─── Status + monto hero ─── */}
              <div className="flex items-center justify-between">
                <StatusBadge status={venta.status} />
                <span className="text-2xl font-bold text-text-primary tabular-nums">
                  {formatCurrency(venta.monto)}
                </span>
              </div>

              {/* ─── Info Grid ─── */}
              <div className="grid gap-5">
                <Section title="Receptor" icon={User}>
                  <InfoRow label="Razón Social" value={venta.cliente || 'Consumidor Final'} />
                  <InfoRow label="CUIT / DNI" value={cuitCliente || 'Sin identificar'} />
                  <InfoRow label="Condición IVA" value={condIva} />
                  {df.email && <InfoRow label="Email" value={df.email} />}
                  {df.domicilio && <InfoRow label="Domicilio" value={df.domicilio} />}
                </Section>

                <Section title="Detalle" icon={Package}>
                  <InfoRow label="Concepto" value={conceptoLabel} />
                  <InfoRow label="Descripción" value={df.descripcion || 'Productos varios'} />
                  <InfoRow label="Cantidad" value={`${df.cantidad || 1} ${unidadLabel}`} />
                </Section>

                {df.cbte_asoc && df.cbte_asoc.nro > 0 && (
                  <Section title="Comprobante Asociado" icon={Link2}>
                    <InfoRow
                      label="Tipo"
                      value={getTiposComprobante(emisor).find(t => t.value === df.cbte_asoc.tipo)?.label || `Tipo ${df.cbte_asoc.tipo}`}
                    />
                    <InfoRow
                      label="Número"
                      value={`${String(df.cbte_asoc.pto_vta || 0).padStart(4, '0')}-${String(df.cbte_asoc.nro || 0).padStart(8, '0')}`}
                      mono
                    />
                    {df.cbte_asoc.fecha && (
                      <InfoRow label="Fecha" value={formatDate(df.cbte_asoc.fecha)} />
                    )}
                  </Section>
                )}

                {(venta.cae || venta.nro_comprobante) && (
                  <Section title="Datos Fiscales" icon={ShieldCheck}>
                    <InfoRow label="Factura" value={venta.nro_comprobante || '—'} mono />
                    <InfoRow label="CAE" value={venta.cae || '—'} mono />
                    <InfoRow label="Vencimiento" value={formatDate(venta.vto_cae)} />
                  </Section>
                )}

                {isRI && df.neto_gravado != null && (
                  <Section title="IVA" icon={Percent}>
                    <InfoRow label="Neto Gravado" value={formatCurrency(df.neto_gravado)} />
                    <InfoRow label="Alícuota" value={getAlicuotaById(df.iva_alicuota_id || 5)?.label || '21%'} />
                    <InfoRow label="IVA" value={formatCurrency(df.iva_monto)} highlight="accent" />
                  </Section>
                )}

                <Section title="Organización" icon={FolderKanban}>
                  <div className="px-4 py-3 space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Carpeta</label>
                      <select 
                        value={isEditing ? editForm.folder : (venta.folder || '')}
                        onChange={(e) => isEditing && setEditForm(prev => ({ ...prev, folder: e.target.value }))}
                        disabled={!isEditing}
                        className="w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:px-0 cursor-pointer"
                      >
                        <option value="">Ninguna</option>
                        {customFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Etiquetas</label>
                      {isEditing ? (
                        <div className="flex flex-wrap gap-1.5">
                          {labels.map(l => {
                            const colorObj = LABEL_COLORS.find(c => c.id === l.colorId) || LABEL_COLORS[0];
                            const active = editForm.etiquetas?.includes(l.name);
                            return (
                              <button key={l.id} type="button"
                                onClick={() => {
                                  const curr = editForm.etiquetas || [];
                                  const next = active ? curr.filter(e => e !== l.name) : [...curr, l.name];
                                  setEditForm(prev => ({ ...prev, etiquetas: next }));
                                }}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight border transition-all cursor-pointer ${
                                  active ? 'border-accent/40 bg-accent/5 text-accent' : 'border-border/40 bg-surface-alt text-text-muted hover:border-border'
                                }`}
                              >
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorObj.color }} />
                                {l.name}
                              </button>
                            );
                          })}
                          {labels.length === 0 && <span className="text-[10px] text-text-muted italic">Sin etiquetas creadas</span>}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {getEtiquetas(venta).length > 0 ? getEtiquetas(venta).map(name => {
                            const label = labels.find(l => l.name === name);
                            const colorObj = LABEL_COLORS.find(c => c.id === label?.colorId) || LABEL_COLORS[0];
                            return (
                              <div key={name} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-alt border border-border/40">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorObj.color }} />
                                <span className="text-[10px] font-bold text-text-primary uppercase tracking-tighter">{name}</span>
                              </div>
                            );
                          }) : <span className="text-xs text-text-muted">—</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </Section>

              </div>

              {/* ─── Timeline ─── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} className="text-text-muted" />
                  <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest">Historial de Estado</h4>
                </div>
                <div className="flex items-center gap-0 px-2">
                  {statusSteps.map((step, i) => {
                    const isActive = i <= currentStepIndex && venta.status !== 'error';
                    const isCurrent = step.key === venta.status;
                    const StepIcon = step.icon;
                    return (
                      <div key={step.key} className="flex items-center flex-1">
                        <div className={`flex flex-col items-center gap-1 ${isActive ? 'text-green' : 'text-text-muted/40'} ${isCurrent ? 'scale-110 font-bold' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-green-subtle' : 'bg-surface-alt'}`}>
                            <StepIcon size={14} />
                          </div>
                          <span className="text-[9px] uppercase tracking-tighter">{step.label}</span>
                        </div>
                        {i < statusSteps.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 rounded-full ${isActive ? 'bg-green/30' : 'bg-border'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ─── Actions ─── */}
              <div className="flex flex-col gap-3 pt-2">
                {venta.status === 'facturado' && (
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 bg-[#3460A8] text-white py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <FileDown size={18} />
                    Ver Factura (PDF)
                  </button>
                )}
                {venta.status === 'facturado' && onAnular && (
                  <button
                    onClick={() => onAnular(venta)}
                    className="w-full flex items-center justify-center gap-2 bg-red-subtle border border-red/20 text-red py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <RotateCcw size={18} className="rotate-180" />
                    Anular Factura (NC)
                  </button>
                )}
                {venta.status === 'error' && onRetry && (
                  <button
                    onClick={() => onRetry(venta.id)}
                    className="w-full flex items-center justify-center gap-2 bg-yellow text-black py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <RotateCcw size={18} />
                    Reintentar Facturación
                  </button>
                )}
                {(venta.status === 'pendiente' || venta.status === 'error') && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full flex items-center justify-center gap-2 bg-surface-alt border border-border text-text-primary py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer"
                  >
                    <Edit2 size={18} />
                    Editar Datos Fiscales
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={14} className="text-text-muted" />}
        <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
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
      <span className="text-[11px] text-text-muted uppercase tracking-wider">{label}</span>
      <span className={`
        text-sm font-semibold text-right max-w-[60%] truncate
        ${mono ? 'font-mono text-xs' : ''}
        ${highlight === 'accent' ? 'text-accent' : 'text-text-primary'}
      `}>
        {value}
      </span>
    </div>
  );
}
