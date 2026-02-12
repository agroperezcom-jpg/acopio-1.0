/**
 * Servicio de Stock: actualización incremental de stock (Producto y Envase).
 * Producto: campo stock (o stock_actual si el backend lo expone).
 * Envase: campos stock_ocupados y stock_vacios.
 * Una sola lectura + un solo .update() por entidad.
 */

/**
 * Ajusta el stock de un producto en cantidadDelta (positivo = ingreso, negativo = salida).
 * @param {Object} base44 - Cliente base44
 * @param {string} productoId - ID del producto
 * @param {number} cantidadDelta - Kilos a sumar (positivo) o restar (negativo)
 * @returns {Promise<void>}
 */
export async function ajustarStockProducto(base44, productoId, cantidadDelta) {
  if (!productoId || cantidadDelta === 0) return;
  const delta = Number(cantidadDelta);
  if (Number.isNaN(delta)) return;

  const list = await base44.entities.Producto.filter({ id: productoId });
  const producto = Array.isArray(list) ? list[0] : list;
  if (!producto) return;

  const stockActual = Number(producto.stock ?? producto.stock_actual ?? 0);
  const nuevoStock = Math.max(0, Math.round((stockActual + delta) * 100) / 100);

  await base44.entities.Producto.update(productoId, { stock: nuevoStock });
}

/**
 * Ajusta stock de envase: ocupados y/o vacíos.
 * @param {Object} base44 - Cliente base44
 * @param {string} envaseId - ID del envase
 * @param {number} deltaOcupados - Delta para stock_ocupados (default 0)
 * @param {number} deltaVacios - Delta para stock_vacios (default 0)
 */
export async function ajustarStockEnvase(base44, envaseId, deltaOcupados = 0, deltaVacios = 0) {
  if (!envaseId || (deltaOcupados === 0 && deltaVacios === 0)) return;

  const list = await base44.entities.Envase.filter({ id: envaseId });
  const envase = Array.isArray(list) ? list[0] : list;
  if (!envase) return;

  const ocupados = Math.max(0, (Number(envase.stock_ocupados) || 0) + Number(deltaOcupados));
  const vacios = Math.max(0, (Number(envase.stock_vacios) || 0) + Number(deltaVacios));

  await base44.entities.Envase.update(envaseId, {
    stock_ocupados: ocupados,
    stock_vacios: vacios
  });
}
