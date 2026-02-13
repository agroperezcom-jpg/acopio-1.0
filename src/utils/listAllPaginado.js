/**
 * Utilidad para obtener TODOS los registros de una entidad base44 en lotes.
 * Evita el límite fijo de 1000 registros y permite procesar 10.000+ o 100.000+.
 * Incluye throttling (200ms entre páginas) para no saturar la API (evitar 429).
 *
 * @param {Object} entity - Entidad base44 (ej: base44.entities.Movimiento)
 * @param {string} [order='-created_date'] - Orden (ej: '-created_date', '-fecha')
 * @param {number} [batchSize=1000] - Tamaño del lote por página
 * @returns {Promise<Array>} - Todos los registros concatenados
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const DELAY_BETWEEN_PAGES_MS = 200;

export async function listAll(entity, order = '-created_date', batchSize = 1000) {
  const allItems = [];
  let skip = 0;

  while (true) {
    const batch = await entity.list(order, batchSize, skip);
    if (!batch || batch.length === 0) break;
    allItems.push(...batch);
    if (batch.length < batchSize) break;
    skip += batchSize;
    await delay(DELAY_BETWEEN_PAGES_MS);
  }

  return allItems;
}
