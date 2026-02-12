/**
 * ═══════════════════════════════════════════════════════════════════
 * UTILIDAD: OBTENER PRECIO VIGENTE SEGÚN FECHA
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Función centralizada para calcular el precio vigente de un producto
 * en una fecha específica, evitando duplicación de lógica.
 * 
 * @param {Array} periodosPrecios - Array de períodos de precios
 * @param {string} productoId - ID del producto
 * @param {string|Date} fecha - Fecha para la cual obtener el precio
 * @param {string} tipoPrecio - 'compra' o 'venta' (default: 'compra')
 * @returns {number} - Precio vigente o 0 si no se encuentra
 */
export function obtenerPrecioVigente(periodosPrecios, productoId, fecha, tipoPrecio = 'compra') {
  if (!productoId || !fecha || !periodosPrecios || periodosPrecios.length === 0) {
    return 0;
  }

  // Filtrar precios activos del producto y ordenar por fecha descendente
  const preciosOrdenados = periodosPrecios
    .filter(pp => pp.producto_id === productoId && pp.activo)
    .sort((a, b) => new Date(b.fecha_desde) - new Date(a.fecha_desde));
  
  if (preciosOrdenados.length === 0) {
    return 0;
  }

  const fechaConsulta = new Date(fecha);
  
  // Buscar precio vigente (fecha_desde <= fecha consulta)
  const precioVigente = preciosOrdenados.find(pp => {
    const fechaDesde = new Date(pp.fecha_desde);
    
    // Si tiene fecha_hasta, verificar que la fecha esté en el rango
    if (pp.fecha_hasta) {
      const fechaHasta = new Date(pp.fecha_hasta);
      return fechaConsulta >= fechaDesde && fechaConsulta <= fechaHasta;
    }
    
    // Si no tiene fecha_hasta, solo verificar que fecha_desde <= fecha consulta
    return fechaConsulta >= fechaDesde;
  });
  
  // Si se encontró precio vigente, retornarlo
  if (precioVigente) {
    return tipoPrecio === 'compra' 
      ? (precioVigente.precio_compra_kg || 0)
      : (precioVigente.precio_venta_kg || 0);
  }
  
  // Si no hay precio vigente, usar el más reciente disponible
  const precioMasReciente = preciosOrdenados[0];
  if (precioMasReciente) {
    return tipoPrecio === 'compra'
      ? (precioMasReciente.precio_compra_kg || 0)
      : (precioMasReciente.precio_venta_kg || 0);
  }
  
  return 0;
}
