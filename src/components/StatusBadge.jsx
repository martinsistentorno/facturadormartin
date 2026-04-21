export default function StatusBadge({ status }) {
  const config = {
    pendiente: {
      label: 'Pendiente',
      bg: 'bg-yellow-subtle',
      text: 'text-yellow',
      dot: 'bg-yellow',
    },
    procesando: {
      label: 'Procesando',
      bg: 'bg-accent-subtle',
      text: 'text-accent',
      dot: 'bg-accent',
    },
    facturado: {
      label: 'Facturado',
      bg: 'bg-green-subtle',
      text: 'text-green',
      dot: 'bg-green',
    },
    error: {
      label: 'Error',
      bg: 'bg-red-subtle',
      text: 'text-red',
      dot: 'bg-red',
    },
    borrada: {
      label: 'Borrada',
      bg: 'bg-text-secondary/10',
      text: 'text-text-secondary',
      dot: 'bg-text-secondary',
    },
  }

  const c = config[status] || config.pendiente

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-wide ${c.bg} ${c.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${status === 'procesando' ? 'animate-pulse-subtle' : ''}`} />
      {c.label}
    </span>
  )
}
