/**
 * Servicio de Saldos de Envases: gestión del saldo de envases en Proveedor y Cliente.
 * - Saldo positivo = deuda (entidad nos debe envases).
 * - Saldo negativo = a favor (nosotros debemos envases a la entidad).
 * Solo lógica de datos; sin UI.
 */

import { base44 } from '@/api/base44Client';

/** Operaciones permitidas para movimientos de envases (uso interno) */
const OPERACION = {
  ENTREGA: 'ENTREGA',    // Acopio da envases → aumenta deuda
  RECEPCION: 'RECEPCION' // Acopio recibe envases → disminuye deuda
};

/**
 * Parsea saldo_envases de forma segura (evita errores por JSON malformado).
 * @param {*} saldo - valor crudo de entidad.saldo_envases
 * @returns {Record<string, number>} objeto { tipo_envase: cantidad }
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
      const conDobles = String(saldo).replace(/'/g, '"');
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
 * Devuelve un objeto limpio para persistir: solo claves con valores numéricos válidos.
 */
function saldoLimpioParaGuardar(objeto) {
  if (!objeto || typeof objeto !== 'object') return {};
  return Object.fromEntries(
    Object.entries(objeto)
      .filter(([, v]) => v !== undefined && v !== null && !Number.isNaN(Number(v)))
      .map(([k, v]) => [String(k), Number(v)])
  );
}

function getEntity(entidadTipo) {
  if (entidadTipo === 'Proveedor') return base44.entities.Proveedor;
  if (entidadTipo === 'Cliente') return base44.entities.Cliente;
  return null;
}

/**
 * Obtiene la entidad por ID.
 * @returns {Promise<Object|null>}
 */
async function fetchEntidad(entidadTipo, entidadId) {
  const Entity = getEntity(entidadTipo);
  if (!Entity || !entidadId) return null;
  const list = await Entity.filter({ id: entidadId });
  return Array.isArray(list) ? list[0] : list;
}

/**
 * Aplica un conjunto de deltas al saldo y persiste.
 * @param {Record<string, number>} saldoActual - objeto parseado
 * @param {Array<{ tipo_envase: string, cantidad: number }>} items
 * @param {number} multiplicador - +1 para aumentar deuda, -1 para disminuir
 */
function aplicarDeltasYGuardar(entidadTipo, entidadId, saldoActual, items, multiplicador) {
  const nuevoSaldo = { ...saldoActual };
  for (const item of items) {
    const tipo = String(item.tipo_envase || '').trim();
    const cantidad = Number(item.cantidad) || 0;
    if (!tipo || cantidad === 0) continue;
    const prev = Number(nuevoSaldo[tipo]) || 0;
    nuevoSaldo[tipo] = prev + multiplicador * cantidad;
  }
  const aGuardar = saldoLimpioParaGuardar(nuevoSaldo);
  const Entity = getEntity(entidadTipo);
  return Entity.update(entidadId, { saldo_envases: aGuardar });
}

/**
 * Registra un movimiento de envases.
 * @param {string} entidadTipo - 'Proveedor' | 'Cliente'
 * @param {string} entidadId - ID de la entidad
 * @param {Array<{ tipo_envase: string, cantidad: number }>} items
 * @param {string} operacion - 'ENTREGA' | 'RECEPCION'
 * @returns {Promise<void>}
 */
export async function registrarMovimientoEnvase(entidadTipo, entidadId, items, operacion) {
  if (!entidadTipo || !entidadId || !Array.isArray(items) || items.length === 0) {
    throw new Error('registrarMovimientoEnvase: entidadTipo, entidadId e items requeridos');
  }
  if (operacion !== OPERACION.ENTREGA && operacion !== OPERACION.RECEPCION) {
    throw new Error(`registrarMovimientoEnvase: operacion debe ser 'ENTREGA' o 'RECEPCION', recibido: ${operacion}`);
  }

  const entidad = await fetchEntidad(entidadTipo, entidadId);
  if (!entidad) {
    throw new Error(`registrarMovimientoEnvase: entidad no encontrada (${entidadTipo} id=${entidadId})`);
  }

  const saldoActual = safeParseSaldo(entidad.saldo_envases ?? {});
  const multiplicador = operacion === OPERACION.ENTREGA ? 1 : -1;

  await aplicarDeltasYGuardar(entidadTipo, entidadId, saldoActual, items, multiplicador);
}

/**
 * Revierte un movimiento de envases (opuesto a la operación original).
 * @param {string} entidadTipo - 'Proveedor' | 'Cliente'
 * @param {string} entidadId - ID de la entidad
 * @param {Array<{ tipo_envase: string, cantidad: number }>} items
 * @param {string} operacionOriginal - 'ENTREGA' | 'RECEPCION'
 * @returns {Promise<void>}
 */
export async function revertirMovimientoEnvase(entidadTipo, entidadId, items, operacionOriginal) {
  if (!entidadTipo || !entidadId || !Array.isArray(items) || items.length === 0) {
    throw new Error('revertirMovimientoEnvase: entidadTipo, entidadId e items requeridos');
  }
  if (operacionOriginal !== OPERACION.ENTREGA && operacionOriginal !== OPERACION.RECEPCION) {
    throw new Error(`revertirMovimientoEnvase: operacionOriginal debe ser 'ENTREGA' o 'RECEPCION', recibido: ${operacionOriginal}`);
  }

  const entidad = await fetchEntidad(entidadTipo, entidadId);
  if (!entidad) {
    throw new Error(`revertirMovimientoEnvase: entidad no encontrada (${entidadTipo} id=${entidadId})`);
  }

  const saldoActual = safeParseSaldo(entidad.saldo_envases ?? {});
  // Opuesto: si era ENTREGA (+), revertimos con -; si era RECEPCION (-), revertimos con +
  const multiplicador = operacionOriginal === OPERACION.ENTREGA ? -1 : 1;

  await aplicarDeltasYGuardar(entidadTipo, entidadId, saldoActual, items, multiplicador);
}
