/**
 * Obtiene todos los periodos de precios históricos en lotes.
 * Evita límites duros que pueden dejar fuera periodos antiguos.
 *
 * @param {Object} entity - base44.entities.PeriodoPrecio
 * @param {string} [order='-fecha_desde'] - orden de la consulta
 * @param {number} [batchSize=1000] - tamaño de lote por página
 * @returns {Promise<Array>} periodos completos
 */
export async function listAllPrecios(entity, order = '-fecha_desde', batchSize = 1000) {
  const allItems = [];
  let skip = 0;

  while (true) {
    const batch = await entity.list(order, batchSize, skip);
    if (!Array.isArray(batch) || batch.length === 0) break;
    allItems.push(...batch);
    if (batch.length < batchSize) break;
    skip += batchSize;
  }

  return allItems;
}
