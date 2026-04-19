import { X, FileDown, Edit2, RotateCcw, Calendar, CreditCard, User, Hash, ShieldCheck, Clock } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { generateInvoicePdf } from '../utils/invoicePdf';
import { useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';

export default function SaleDetailDrawer({ venta, isOpen, onClose, onEdit, onRetry }) {
  const { emisor } = useConfig();
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

  const cuitCliente = venta.datos_fiscales?.cuit || '';
  const condIva = cuitCliente && cuitCliente.length >= 10 ? 'IVA Responsable Inscripto' : 'Consumidor Final';
  const formaPago = venta.datos_fiscales?.forma_pago || 'No especificada';
  const origenRaw = venta.datos_fiscales?.origen;
  const origen = origenRaw === 'mercadolibre' ? 'Mercado Libre' : origenRaw === 'mercadopago' ? 'Mercado Pago' : venta.mp_payment_id ? 'Mercado Libre' : 'Manual';
  const displayPaymentId = venta.mp_payment_id ? venta.mp_payment_id.replace(/^order-/, '') : '';

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
    // Fallback: generar PDF local
    generateInvoicePdf(venta, emisor);
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
      <div className="fixed right-0 top-0 bottom-0 z-[151] w-full max-w-md bg-surface border-l border-border shadow-2xl animate-drawer-in overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface/95 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary" style={{ fontFamily: 'Montserrat' }}>
              Detalle de Venta
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

          {/* ─── Status + monto hero ─── */}
          <div className="flex items-center justify-between">
            <StatusBadge status={venta.status} />
            <span className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'Inter' }}>
              {formatCurrency(venta.monto)}
            </span>
          </div>

          {/* ─── Cliente ─── */}
          <Section title="Cliente" icon={User}>
            <InfoRow label="Nombre / Razón Social" value={venta.cliente || 'Consumidor Final'} />
            <InfoRow label="CUIT / DNI" value={cuitCliente || 'Sin identificar'} />
            <InfoRow label="Condición IVA" value={condIva} />
          </Section>

          {/* ─── Operación ─── */}
          <Section title="Detalle de Operación" icon={CreditCard}>
            <InfoRow label="Fecha" value={`${formatDate(venta.fecha)} ${formatTime(venta.fecha)}`} />
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
          {venta.status === 'error' && venta.datos_fiscales?.error_detalle && (
            <div className="bg-red-subtle/50 border border-red/20 rounded-xl p-4">
              <p className="text-xs font-bold text-red uppercase tracking-widest mb-2" style={{ fontFamily: 'Inter' }}>
                Motivo del Error
              </p>
              <p className="text-sm text-red/80">{venta.datos_fiscales.error_detalle}</p>
            </div>
          )}

          {/* ─── Timeline ─── */}
          <Section title="Historial" icon={Calendar}>
            <div className="flex items-center gap-0 mt-2">
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
              <div className="flex items-center gap-2 mt-3 text-red text-xs">
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
                style={{ fontFamily: 'Montserrat' }}
              >
                <FileDown size={16} />
                Descargar PDF
              </button>
            )}
            {venta.status === 'error' && onRetry && (
              <button
                onClick={() => onRetry(venta.id)}
                className="w-full flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl font-bold uppercase tracking-wider text-sm hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer"
                style={{ fontFamily: 'Montserrat' }}
              >
                <RotateCcw size={16} />
                Reintentar Facturación
              </button>
            )}
            {venta.status === 'pendiente' && onEdit && (
              <button
                onClick={() => { onEdit(venta); onClose(); }}
                className="w-full flex items-center justify-center gap-2 bg-surface-alt border border-border text-text-primary py-3 rounded-xl font-bold uppercase tracking-wider text-sm hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer"
                style={{ fontFamily: 'Montserrat' }}
              >
                <Edit2 size={16} />
                Editar Datos
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Sub-components ─── */

function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={14} className="text-text-muted" />}
        <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest" style={{ fontFamily: 'Inter' }}>
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
        text-sm font-medium text-right
        ${mono ? 'font-mono text-xs' : ''}
        ${highlight === 'accent' ? 'text-accent' : 'text-text-primary'}
      `}>
        {value}
      </span>
    </div>
  );
}
