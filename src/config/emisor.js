// Configuración del emisor de facturas.
// Todos los valores se leen de variables de entorno para poder reutilizar
// el mismo código en múltiples clientes sin modificar archivos.
export const EMISOR = {
  razonSocial: import.meta.env.VITE_EMISOR_RAZON_SOCIAL || 'SIN CONFIGURAR',
  cuit: import.meta.env.VITE_EMISOR_CUIT || '00000000000',
  cuitFormateado: import.meta.env.VITE_EMISOR_CUIT_FMT || '00-00000000-0',
  domicilio: import.meta.env.VITE_EMISOR_DOMICILIO || '',
  inicioActividades: import.meta.env.VITE_EMISOR_INICIO_ACT || '',
  condicionIva: import.meta.env.VITE_EMISOR_COND_IVA || 'Responsable Monotributo',
  ingresosBrutos: import.meta.env.VITE_EMISOR_IIBB || import.meta.env.VITE_EMISOR_CUIT || '',
  ptoVta: parseInt(import.meta.env.VITE_EMISOR_PTO_VTA || '1'),
  tipoCbte: parseInt(import.meta.env.VITE_EMISOR_TIPO_CBTE || '11'),
};
