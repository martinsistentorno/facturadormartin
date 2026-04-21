import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: 'bg-green-subtle border-green/20 text-green',
  error: 'bg-red-subtle border-red/20 text-red',
  warning: 'bg-yellow-subtle border-yellow/20 text-yellow',
  info: 'bg-surface border-accent/20 text-accent',
};

let toastIdCounter = 0;

function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false);
  const Icon = ICONS[toast.type] || ICONS.info;

  const handleRemove = useCallback(() => {
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  }, [toast.id, onRemove]);

  useEffect(() => {
    const timer = setTimeout(handleRemove, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [handleRemove, toast.duration]);

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl shadow-black/15
        backdrop-blur-sm min-w-[320px] max-w-[420px]
        ${COLORS[toast.type] || COLORS.info}
        ${exiting ? 'animate-toast-out' : 'animate-toast-in'}
      `}
     
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button
        onClick={handleRemove}
        className="p-0.5 rounded hover:bg-black/5 transition-colors shrink-0 cursor-pointer"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[200] flex flex-col gap-2">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

/** Helper para crear un toast con ID �nico */
export function createToast(message, type = 'success', duration = 4000) {
  return { id: ++toastIdCounter, message, type, duration };
}
