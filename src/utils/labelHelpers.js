/**
 * Normalizes label data from a venta object.
 * Handles both legacy `etiqueta` (string) and new `etiquetas` (array).
 * @param {object} venta
 * @returns {string[]} Array of label names
 */
export function getEtiquetas(venta) {
  if (!venta) return []
  if (Array.isArray(venta.etiquetas) && venta.etiquetas.length > 0) return venta.etiquetas
  if (venta.etiqueta) return [venta.etiqueta]
  return []
}

/**
 * Checks if a venta has a specific label.
 */
export function hasEtiqueta(venta, labelName) {
  return getEtiquetas(venta).includes(labelName)
}
