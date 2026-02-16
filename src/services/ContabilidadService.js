/**
 * Servicio de contabilidad: recálculo de saldo_actual desde CuentaCorriente.
 * Solo lógica de datos; sin UI.
 */

import { base44 } from '@/api/base44Client';

const LOTE = 100;
const DELAY_MS = 150;

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function getEntity(entidadTipo) {
  if (entidadTipo === 'Proveedor') return base44.entities.Proveedor;
  if (entidadTipo === 'Cliente') return base44.entities.Cliente;
  return null;
}

/**
 * Descarga todos los movimientos de CuentaCorriente de una sola entidad (filtro por ID).
 * @param {string} entidadTipo - 'Proveedor' | 'Cliente'
 * @param {string} entidadId - ID de la entidad
 * @returns {Promise<Array>}
 */
async function fetchCuentaCorrienteEntidad(entidadTipo, entidadId) {
  const all = [];
  let skip = 0;
  while (true) {
    const pagina = await base44.entities.CuentaCorriente.filter(
      { entidad_tipo: entidadTipo, entidad_id: entidadId },
      'fecha',
      LOTE,
      skip
    );
    if (!pagina || pagina.length === 0) break;
    all.push(...pagina);
    if (pagina.length < LOTE) break;
    skip += LOTE;
    await delay(DELAY_MS);
  }
  return all;
}

/**
 * Recalcula el saldo_actual de una entidad desde su libro mayor (CuentaCorriente).
 * Descarga solo los movimientos de ESA entidad, suma Haber - Debe, actualiza y devuelve el nuevo saldo.
 *
 * @param {string} entidadTipo - 'Proveedor' | 'Cliente'
 * @param {string} entidadId - ID de la entidad
 * @returns {Promise<number>} - Nuevo saldo_actual (redondeado a 2 decimales)
 */
export async function recalcularSaldoEntidad(entidadTipo, entidadId) {
  const Entity = getEntity(entidadTipo);
  if (!Entity || !entidadId) {
    throw new Error('recalcularSaldoEntidad: entidadTipo (Proveedor|Cliente) y entidadId requeridos');
  }

  const movimientos = await fetchCuentaCorrienteEntidad(entidadTipo, entidadId);

  let saldo = 0;
  for (const mov of movimientos) {
    if (mov.anulado === true || mov.estado === 'Anulado') continue;
    const monto = Number(mov.monto) || 0;
    if (mov.tipo_movimiento === 'Haber') {
      saldo += monto;
    } else if (mov.tipo_movimiento === 'Debe') {
      saldo -= monto;
    }
  }

  const nuevoSaldo = Math.round(Number(saldo) * 100) / 100;
  await Entity.update(entidadId, { saldo_actual: nuevoSaldo });

  return nuevoSaldo;
}
