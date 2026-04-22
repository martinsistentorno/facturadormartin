/**
 * Diccionario centralizado de métodos de pago.
 * Cualquier string crudo de Mercado Pago / Mercado Libre se traduce aquí.
 * ÚNICA FUENTE DE VERDAD para todo el sistema.
 */

const PAYMENT_METHOD_MAP = {
  // Mercado Pago payment_type_id values
  'credit_card':      'Tarjeta de Crédito',
  'debit_card':       'Tarjeta de Débito',
  'account_money':    'Dinero en Cuenta',
  'ticket':           'Efectivo',
  'bank_transfer':    'Transferencia',
  'transfer':         'Transferencia',
  'prepaid_card':     'Tarjeta Prepaga',
  'digital_currency': 'Cripto / Digital',
  'customer_credits': 'Crédito MP',
  'digital_wallet':   'Billetera Digital',
  'voucher_card':     'Voucher',
  'crypto':           'Cripto / Digital',
  'atm':              'Cajero ATM',

  // Mercado Pago payment_method_id values (fallback)
  'visa':             'Tarjeta de Crédito',
  'master':           'Tarjeta de Crédito',
  'amex':             'Tarjeta de Crédito',
  'naranja':          'Tarjeta de Crédito',
  'cabal':            'Tarjeta de Crédito',
  'maestro':          'Tarjeta de Débito',
  'debvisa':          'Tarjeta de Débito',
  'debmaster':        'Tarjeta de Débito',
  'rapipago':         'Efectivo',
  'pagofacil':        'Efectivo',
  'cvu':              'Transferencia',

  // Already-translated values (idempotent)
  'tarjeta de crédito':   'Tarjeta de Crédito',
  'tarjeta de débito':    'Tarjeta de Débito',
  'dinero en cuenta':     'Dinero en Cuenta',
  'efectivo':             'Efectivo',
  'transferencia':        'Transferencia',
  'transferencia bancaria': 'Transferencia Bancaria',
  'tarjeta prepaga':      'Tarjeta Prepaga',
  'cripto / digital':     'Cripto / Digital',
  'crédito mp':           'Crédito MP',
  'contado - efectivo':   'Contado - Efectivo',
  'mercado pago':         'Dinero en Cuenta',
}

/**
 * Agrupa un método de pago detallado en una categoría genérica y prolija
 * para el Formulario de Edición o Facturas generadas manuales.
 */
export function simplifyPaymentMethod(method) {
  const m = (method || '').toLowerCase()
  if (m.includes('tarjeta de crédito')) return 'Tarjeta de Crédito'
  if (m.includes('tarjeta de débito')) return 'Tarjeta de Débito'
  if (m.includes('tarjeta') || m.includes('prepaga')) return 'Tarjeta de Débito'
  if (m.includes('transferencia') || m.includes('cvu')) return 'Transferencia'
  if (m.includes('cuenta') || m.includes('mercado') || m.includes('crédito mp') || m.includes('billetera')) return 'Contado'
  if (m.includes('efectivo') || m.includes('contado') || m.includes('ticket') || m.includes('rapipago')) return 'Contado'
  
  return 'Contado'
}

/**
 * Traduce un string crudo de método de pago a su versión en español.
 * Insensible a mayúsculas. Devuelve el original si no encuentra traducción.
 * @param {string} raw - El string crudo (ej: 'customer_credits', 'account_money')
 * @returns {string} - El nombre en español (ej: 'Crédito MP', 'Dinero en Cuenta')
 */
export function translatePaymentMethod(raw) {
  if (!raw) return '—'
  const key = raw.trim().toLowerCase()
  return PAYMENT_METHOD_MAP[key] || raw
}

/**
 * Categoría visual para el PaymentBadge.
 * Devuelve { bg, text, label } para el badge.
 */
export function getPaymentBadgeStyle(method) {
  const label = simplifyPaymentMethod(method)

  const styles = {
    'Contado':              { bg: 'bg-accent/10',       text: 'text-accent' },
    'Transferencia':        { bg: 'bg-[#7C4DFF]/10',    text: 'text-[#7C4DFF]' },
    'Tarjeta de Crédito':   { bg: 'bg-[#E8A34A]/10',    text: 'text-[#9A641A]' },
    'Tarjeta de Débito':    { bg: 'bg-[#E8A34A]/10',    text: 'text-[#9A641A]' },
    'Cuenta Corriente':     { bg: 'bg-[#3460A8]/10',    text: 'text-[#3460A8]' },
    'Cheque':               { bg: 'bg-surface-alt/80',  text: 'text-text-muted' },
    'Otra':                 { bg: 'bg-surface-alt/50',  text: 'text-text-secondary' },
  }

  const style = styles[label] || { bg: 'bg-surface-alt/50', text: 'text-text-secondary' }
  return { ...style, label }
}
