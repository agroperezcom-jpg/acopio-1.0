/**
 * Servicio de Saldos de Envases: gestión del saldo de envases en Proveedor y Cliente.
 * - Saldo positivo = deuda (entidad nos debe envases).
 * - Saldo negativo = a favor (nosotros debemos envases a la entidad).
 * Solo lógica de datos; sin UI.
 */

import { base44 } from '@/api/base44Client';
import { listAll } from '@/utils/listAllPaginado';

const LOTE = 100;
const DELAY_MS = 150;

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

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

/**
 * Descarga movimientos de una entidad (filtro por proveedor_id o cliente_id).
 */
async function fetchMovimientosPorEntidad(entidadTipo, entidadId) {
  const field = entidadTipo === 'Proveedor' ? 'proveedor_id' : 'cliente_id';
  const all = [];
  let skip = 0;
  while (true) {
    const batch = await base44.entities.Movimiento.filter(
      { [field]: entidadId },
      '-created_date',
      LOTE,
      skip
    );
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < LOTE) break;
    skip += LOTE;
    await delay(DELAY_MS);
  }
  return all;
}

/**
 * Descarga salidas de fruta de un cliente (filtro por cliente_id).
 */
async function fetchSalidasFrutaPorCliente(clienteId) {
  const all = [];
  let skip = 0;
  while (true) {
    const batch = await base44.entities.SalidaFruta.filter(
      { cliente_id: clienteId },
      '-created_date',
      LOTE,
      skip
    );
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < LOTE) break;
    skip += LOTE;
    await delay(DELAY_MS);
  }
  return all;
}

/**
 * Recalcula el saldo_envases de una entidad desde MovimientoEnvases, IngresoFruta y SalidaFruta.
 * Descarga solo datos filtrados por esa entidad (no toda la base).
 * Aplica lógica de arqueo: Entregas (+deuda) - Devoluciones (-deuda). Actualiza y devuelve el nuevo saldo.
 *
 * @param {string} entidadTipo - 'Proveedor' | 'Cliente'
 * @param {string} entidadId - ID de la entidad
 * @returns {Promise<Record<string, number>>} - Nuevo saldo_envases { tipo_envase: cantidad }
 */
export async function recalcularSaldoEnvasesEntidad(entidadTipo, entidadId) {
  const Entity = getEntity(entidadTipo);
  if (!Entity || !entidadId) {
    throw new Error('recalcularSaldoEnvasesEntidad: entidadTipo (Proveedor|Cliente) y entidadId requeridos');
  }

  const envases = await listAll(base44.entities.Envase, 'tipo', LOTE);
  const envaseIdToTipo = {};
  envases.forEach((e) => {
    if (e.id != null && e.tipo) envaseIdToTipo[String(e.id)] = e.tipo;
  });
  const getTipoEnvase = (e) => e.envase_tipo || (e.envase_id != null && envaseIdToTipo[String(e.envase_id)]) || null;

  const movimientos = await fetchMovimientosPorEntidad(entidadTipo, entidadId);
  let salidas = [];
  if (entidadTipo === 'Cliente') {
    salidas = await fetchSalidasFrutaPorCliente(entidadId);
  }

  const eventos = [
    ...movimientos.map((m) => ({ ...m, _tipo: 'movimiento', _fecha: m.fecha || m.created_date })),
    ...salidas.map((s) => ({ ...s, _tipo: 'salida', _fecha: s.fecha || s.created_date })),
  ];
  eventos.sort((a, b) => new Date(a._fecha || 0) - new Date(b._fecha || 0));

  const saldo = {};
  function aplicarDelta(tipoEnvase, delta) {
    if (!tipoEnvase) return;
    const prev = Number(saldo[tipoEnvase]) || 0;
    saldo[tipoEnvase] = prev + Number(delta);
  }

  for (const ev of eventos) {
    if (ev._tipo === 'movimiento') {
      if (ev.tipo_movimiento === 'Movimiento de Envases' && ev.movimiento_envases?.length) {
        for (const me of ev.movimiento_envases) {
          const tipo = getTipoEnvase(me);
          const sal = Number(me.cantidad_salida) || 0;
          const ing = Number(me.cantidad_ingreso) || 0;
          if (sal > 0) aplicarDelta(tipo, sal);
          if (ing > 0) aplicarDelta(tipo, -ing);
        }
      }
      if (ev.tipo_movimiento === 'Ingreso de Fruta' && ev.envases_llenos?.length && entidadTipo === 'Proveedor') {
        for (const e of ev.envases_llenos) {
          const tipo = getTipoEnvase(e);
          const cantidad = Number(e.cantidad) ?? Number(e.cantidad_ingreso) ?? 0;
          if (tipo && cantidad > 0) aplicarDelta(tipo, -cantidad);
        }
      }
    } else if (ev._tipo === 'salida' && entidadTipo === 'Cliente') {
      if (ev.envases_llenos?.length) {
        for (const e of ev.envases_llenos) {
          const tipo = getTipoEnvase(e);
          const cantidad = Number(e.cantidad) ?? Number(e.cantidad_ingreso) ?? 0;
          if (tipo && cantidad > 0) aplicarDelta(tipo, cantidad);
        }
      }
    }
  }

  const saldoLimpio = Object.fromEntries(
    Object.entries(saldo).filter(([, v]) => Number(v) !== 0).map(([k, v]) => [k, Number(v)])
  );
  await Entity.update(entidadId, { saldo_envases: saldoLimpio });
  return saldoLimpio;
}
