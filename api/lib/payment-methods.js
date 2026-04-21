/**
 * Diccionario centralizado de métodos de pago (versión backend / CommonJS-compatible).
 * Fuente de verdad compartida con src/utils/paymentMethods.js
 */

const PAYMENT_METHOD_MAP = {
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
  'mercado pago':     'Dinero en Cuenta',
}

/**
 * Traduce un payment_type_id o payment_method_id de Mercado Pago al español.
 * @param {string} typeId - payment_type_id de MP (ej: 'customer_credits')
 * @param {string} [methodId] - payment_method_id de MP (ej: 'visa') como fallback
 * @returns {string}
 */
export function translatePaymentMethod(typeId, methodId) {
  if (!typeId && !methodId) return 'Mercado Pago'
  const key1 = (typeId || '').trim().toLowerCase()
  const key2 = (methodId || '').trim().toLowerCase()
  return PAYMENT_METHOD_MAP[key1] || PAYMENT_METHOD_MAP[key2] || typeId || methodId || 'Mercado Pago'
}
