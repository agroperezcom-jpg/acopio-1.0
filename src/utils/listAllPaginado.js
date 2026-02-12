/**
 * Utilidad para obtener TODOS los registros de una entidad base44 en lotes.
 * Evita el límite fijo de 1000 registros y permite procesar 10.000+ o 100.000+.
 *
 * @param {Object} entity - Entidad base44 (ej: base44.entities.Movimiento)
 * @param {string} [order='-created_date'] - Orden (ej: '-created_date', '-fecha')
 * @param {number} [batchSize=1000] - Tamaño del lote por página
 * @returns {Promise<Array>} - Todos los registros concatenados
 */
export async function listAll(entity, order = '-created_date', batchSize = 1000) {
  const allItems = [];
  let skip = 0;

  while (true) {
    const batch = await entity.list(order, batchSize, skip);
    if (!batch || batch.length === 0) break;
    allItems.push(...batch);
    if (batch.length < batchSize) break;
    skip += batchSize;
  }

  return allItems;
}
