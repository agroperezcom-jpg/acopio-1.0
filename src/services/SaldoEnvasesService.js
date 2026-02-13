/**
 * Servicio de Saldos de Envases: actualización incremental del campo saldo_envases
 * en Proveedor y Cliente. Cantidad positiva = aumenta la deuda; negativa = disminuye.
 */

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

  const saldoEnvases = entidad.saldo_envases && typeof entidad.saldo_envases === 'object'
    ? { ...entidad.saldo_envases }
    : {};

  const saldoActual = Number(saldoEnvases[tipoEnvase]) || 0;
  const nuevoSaldo = saldoActual + Number(cantidad);
  saldoEnvases[tipoEnvase] = nuevoSaldo;

  await Entity.update(entidadId, { saldo_envases: saldoEnvases });
}
