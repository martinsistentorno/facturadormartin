import { useMemo } from 'react';

/**
 * Hook que extrae clientes únicos de las ventas existentes
 * para alimentar el autocompletado en AddSaleModal.
 */
export function useClientes(ventas) {
  const clientes = useMemo(() => {
    const map = new Map();

    ventas.forEach(v => {
      const nombre = v.cliente?.trim();
      if (!nombre) return;

      // Si ya existe, mergear datos (CUIT, etc)
      if (!map.has(nombre)) {
        map.set(nombre, {
          nombre,
          cuit: v.datos_fiscales?.cuit || '',
          formaPago: v.datos_fiscales?.forma_pago || '',
        });
      } else {
        // Actualizar datos si la versión existente no tiene CUIT
        const existing = map.get(nombre);
        if (!existing.cuit && v.datos_fiscales?.cuit) {
          existing.cuit = v.datos_fiscales.cuit;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [ventas]);

  const search = (query) => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return clientes.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      c.cuit.includes(q)
    ).slice(0, 5);
  };

  return { clientes, search };
}
