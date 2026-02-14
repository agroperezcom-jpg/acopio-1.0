/**
 * Servicio de Saldos de Envases: actualización incremental del campo saldo_envases
 * en Proveedor y Cliente. Cantidad positiva = aumenta la deuda; negativa = disminuye.
 */

/**
 * Parsea saldo_envases de forma segura para no perder saldo por formato erróneo.
 * - Si es objeto plano → se devuelve una copia.
 * - Si es string → intenta JSON.parse; si falla, intenta reemplazar comillas simples por dobles y parsear.
 * - Si falla todo o es null/undefined → devuelve {}.
 * @param {*} saldo - valor crudo de entidad.saldo_envases
 * @returns {Record<string, number>} objeto tipo → cantidad
 */
function safeParseSaldo(saldo) {
  if (saldo == null) return {};
  if (typeof saldo === 'object' && !Array.isArray(saldo)) {
    return { ...saldo };
  }
  if (typeof saldo !== 'string') return {};
  try {
    const parsed = JSON.parse(saldo);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...parsed };
    }
    return {};
  } catch {
    try {
      const conDobles = saldo.replace(/'/g, '"');
      const parsed = JSON.parse(conDobles);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...parsed };
      }
      return {};
    } catch {
      return {};
    }
  }
}

/**
 * Devuelve un objeto limpio para persistir: solo claves con valores numéricos.
 */
function saldoLimpioParaGuardar(objeto) {
  if (!objeto || typeof objeto !== 'object') return {};
  return Object.fromEntries(
    Object.entries(objeto)
      .filter(([, v]) => v !== undefined && v !== null && !Number.isNaN(Number(v)))
      .map(([k, v]) => [String(k), Number(v)])
  );
}

/**
 * Actualiza la deuda de envases de una entidad (Proveedor o Cliente).
 * @param {Object} base44 - Cliente base44
 * @param {string} entidadTipo - 'Proveedor' o 'Cliente'
 * @param {string} entidadId - ID de la entidad
 * @param {string} tipoEnvase - Tipo de envase (ej: "Bin Madera")
 * @param {number} cantidad - Delta: positivo aumenta deuda, negativo la disminuye
 * @returns {Promise<void>}
 */
export async function actualizarDeudaEnvase(base44, entidadTipo, entidadId, tipoEnvase, cantidad) {
  if (!base44 || !entidadTipo || !entidadId || !tipoEnvase || cantidad === 0) return;

  const Entity = entidadTipo === 'Proveedor'
    ? base44.entities.Proveedor
    : base44.entities.Cliente;

  if (!Entity) return;

  const list = await Entity.filter({ id: entidadId });
  const entidad = Array.isArray(list) ? list[0] : list;
  if (!entidad) return;

  const saldoEnvases = safeParseSaldo(entidad.saldo_envases ?? {});

  const saldoActual = Number(saldoEnvases[tipoEnvase]) || 0;
  const nuevoSaldo = saldoActual + Number(cantidad);
  saldoEnvases[tipoEnvase] = nuevoSaldo;

  const aGuardar = saldoLimpioParaGuardar(saldoEnvases);
  await Entity.update(entidadId, { saldo_envases: aGuardar });
}
