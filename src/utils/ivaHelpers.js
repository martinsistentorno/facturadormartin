// ─── IVA Helpers ───
// Lógica centralizada para el manejo dinámico de Monotributo vs Responsable Inscripto

// ─── Alícuotas de IVA (códigos AFIP) ───
export const ALICUOTAS_IVA = [
  { value: 5, label: '21%', rate: 0.21 },
  { value: 4, label: '10.5%', rate: 0.105 },
  { value: 6, label: '27%', rate: 0.27 },
  { value: 3, label: '0%', rate: 0 },
  { value: 8, label: 'Exento', rate: 0 },
];

// ─── Tipos de Comprobante por condición ───
const TIPOS_COMPROBANTE_MONO = [
  { value: 11, label: 'Factura C' },
  { value: 13, label: 'Nota de Crédito C' },
  { value: 12, label: 'Nota de Débito C' },
  { value: 15, label: 'Recibo C' },
];

const TIPOS_COMPROBANTE_RI = [
  { value: 1, label: 'Factura A' },
  { value: 3, label: 'Nota de Crédito A' },
  { value: 2, label: 'Nota de Débito A' },
  { value: 6, label: 'Factura B' },
  { value: 8, label: 'Nota de Crédito B' },
  { value: 7, label: 'Nota de Débito B' },
];

/**
 * Determina si el emisor es Responsable Inscripto.
 */
export function isResponsableInscripto(emisor) {
  if (!emisor) return false;
  const cond = (emisor.condicion_iva || '').toLowerCase();
  return cond.includes('responsable inscripto');
}

/**
 * Devuelve los tipos de comprobante disponibles según la condición del emisor.
 */
export function getTiposComprobante(emisor) {
  return isResponsableInscripto(emisor) ? TIPOS_COMPROBANTE_RI : TIPOS_COMPROBANTE_MONO;
}

/**
 * Sugiere el tipo de comprobante por defecto según el receptor.
 * - Emisor RI + Receptor RI → Factura A (1)
 * - Emisor RI + Receptor CF/Mono/Exento → Factura B (6)
 * - Emisor Mono → Factura C (11)
 */
export function getDefaultTipoCbte(emisor, condicionIvaReceptor) {
  if (!isResponsableInscripto(emisor)) return 11; // Factura C

  const cond = (condicionIvaReceptor || '').toLowerCase();
  if (cond.includes('responsable inscripto')) return 1; // Factura A
  return 6; // Factura B
}

/**
 * Calcula el desglose de IVA a partir del monto total (IVA incluido).
 * @param {number} montoTotal - Monto total con IVA incluido
 * @param {number} alicuotaId - ID de alícuota AFIP (5=21%, 4=10.5%, etc.)
 * @returns {{ netoGravado: number, ivaMonto: number, total: number }}
 */
export function calcularIVA(montoTotal, alicuotaId) {
  const alicuota = ALICUOTAS_IVA.find(a => a.value === alicuotaId);
  if (!alicuota || alicuota.rate === 0) {
    return {
      netoGravado: Number(montoTotal) || 0,
      ivaMonto: 0,
      total: Number(montoTotal) || 0,
    };
  }

  const total = Number(montoTotal) || 0;
  const neto = total / (1 + alicuota.rate);
  const iva = total - neto;

  return {
    netoGravado: Math.round(neto * 100) / 100,
    ivaMonto: Math.round(iva * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Determina si un tipo de comprobante es NC o ND (necesita comprobante asociado).
 */
export function needsCbteAsociado(tipoCbte) {
  // NC: 3 (A), 8 (B), 13 (C) | ND: 2 (A), 7 (B), 12 (C)
  return [2, 3, 7, 8, 12, 13].includes(tipoCbte);
}

/**
 * Determina si un tipo de comprobante es NC (para mostrar monto negativo).
 */
export function isNotaCredito(tipoCbte) {
  return [3, 8, 13, 113].includes(tipoCbte);
}

/**
 * Devuelve la alícuota por su ID.
 */
export function getAlicuotaById(id) {
  return ALICUOTAS_IVA.find(a => a.value === id) || ALICUOTAS_IVA[0];
}
