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
  const label = translatePaymentMethod(method)

  const styles = {
    'Efectivo':             { bg: 'bg-accent/10',       text: 'text-accent' },
    'Contado - Efectivo':   { bg: 'bg-accent/10',       text: 'text-accent' },
    'Transferencia':        { bg: 'bg-[#7C4DFF]/10',    text: 'text-[#7C4DFF]' },
    'Transferencia Bancaria': { bg: 'bg-[#7C4DFF]/10',  text: 'text-[#7C4DFF]' },
    'Tarjeta de Crédito':   { bg: 'bg-[#E8A34A]/10',    text: 'text-[#9A641A]' },
    'Tarjeta de Débito':    { bg: 'bg-[#E8A34A]/10',    text: 'text-[#9A641A]' },
    'Tarjeta Prepaga':      { bg: 'bg-[#E8A34A]/10',    text: 'text-[#9A641A]' },
    'Dinero en Cuenta':     { bg: 'bg-[#009EE3]/10',    text: 'text-[#009EE3]' },
    'Crédito MP':           { bg: 'bg-[#2D8F5E]/10',    text: 'text-[#2D8F5E]' },
    'Cripto / Digital':     { bg: 'bg-[#7C4DFF]/10',    text: 'text-[#7C4DFF]' },
    'Billetera Digital':    { bg: 'bg-[#009EE3]/10',    text: 'text-[#009EE3]' },
  }

  // Simplify label for display
  let displayLabel = label
  if (label.includes('Tarjeta')) displayLabel = 'Tarjeta'
  if (label.includes('Contado')) displayLabel = 'Efectivo'
  if (label === 'Transferencia Bancaria') displayLabel = 'Transferencia'

  const style = styles[label] || { bg: 'bg-surface-alt/50', text: 'text-text-secondary' }
  return { ...style, label: displayLabel }
}
