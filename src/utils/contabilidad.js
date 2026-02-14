/**
 * Utilidades para cálculos contables y de cuenta corriente
 */

/**
 * Actualiza el saldo vivo (saldo_actual) de una entidad Cliente o Proveedor.
 * Haber = aumenta deuda → delta positivo. Debe = disminuye deuda → delta negativo.
 * @param {Object} base44 - Instancia del cliente base44
 * @param {string} entidadTipo - 'Cliente' o 'Proveedor'
 * @param {string} entidadId - ID de la entidad
 * @param {number} delta - Monto a sumar al saldo_actual (positivo = más deuda, negativo = menos deuda)
 * @returns {Promise<void>}
 */
export async function actualizarSaldoEntidad(base44, entidadTipo, entidadId, delta) {
  if (!entidadId || delta === 0) return;
  const numDelta = Number(delta);
  if (Number.isNaN(numDelta)) return;

  const list = entidadTipo === 'Cliente'
    ? await base44.entities.Cliente.filter({ id: entidadId })
    : await base44.entities.Proveedor.filter({ id: entidadId });
  const entity = Array.isArray(list) ? list[0] : list;

  if (!entity) return;
  const saldoActual = Number(entity.saldo_actual) || 0;
  const nuevoSaldo = Math.round((saldoActual + numDelta) * 100) / 100;

  if (entidadTipo === 'Cliente') {
    await base44.entities.Cliente.update(entidadId, { saldo_actual: nuevoSaldo });
  } else {
    await base44.entities.Proveedor.update(entidadId, { saldo_actual: nuevoSaldo });
  }
}

/**
 * Calcula los saldos acumulados (saldo_resultante) para una lista de movimientos de cuenta corriente
 * @param {Array} movimientos - Array de movimientos de CuentaCorriente ordenados por fecha
 * @returns {Array} - Array de movimientos con saldo_resultante calculado
 */
export function calcularSaldosAcumulados(movimientos) {
  if (!movimientos || movimientos.length === 0) return [];
  
  // Ordenar por fecha si no están ordenados
  const movimientosOrdenados = [...movimientos].sort((a, b) => {
    const fechaA = new Date(a.fecha || 0);
    const fechaB = new Date(b.fecha || 0);
    return fechaA.getTime() - fechaB.getTime();
  });
  
  let saldoAcumulado = 0;
  const movimientosConSaldo = movimientosOrdenados.map(mov => {
    const monto = Number(mov.monto) || 0;
    
    // Haber = aumenta saldo (deuda), Debe = disminuye saldo (pago/cobro)
    if (mov.tipo_movimiento === 'Haber') {
      saldoAcumulado += monto;
    } else {
      saldoAcumulado -= monto;
    }
    
    return {
      ...mov,
      saldo_resultante: saldoAcumulado
    };
  });
  
  return movimientosConSaldo;
}

/**
 * Calcula el saldo resultante para un nuevo movimiento basado en el último saldo de la entidad
 * @param {number} saldoAnterior - Saldo anterior de la entidad
 * @param {number} monto - Monto del nuevo movimiento
 * @param {string} tipoMovimiento - 'Haber' o 'Debe'
 * @returns {number} - Nuevo saldo resultante
 */
export function calcularNuevoSaldo(saldoAnterior, monto, tipoMovimiento) {
  const montoNum = Number(monto) || 0;
  const saldoAnteriorNum = Number(saldoAnterior) || 0;
  
  if (tipoMovimiento === 'Haber') {
    return saldoAnteriorNum + montoNum;
  } else {
    return saldoAnteriorNum - montoNum;
  }
}

/**
 * Recalcula y actualiza los saldos resultantes para todos los movimientos de una entidad.
 * Usa filter + paginación (solo trae movimientos de ESA entidad), evita list() masivo.
 * @param {Object} base44 - Instancia de base44 client
 * @param {string} entidadId - ID de la entidad (cliente o proveedor)
 * @param {string} entidadTipo - 'Cliente' o 'Proveedor'
 * @returns {Promise<number>} - Saldo final calculado
 */
export async function recalcularSaldosEntidad(base44, entidadId, entidadTipo) {
  const LOTE = 100;
  const movsEntidad = [];
  let skip = 0;

  while (true) {
    const pagina = await base44.entities.CuentaCorriente.filter(
      { entidad_id: entidadId, entidad_tipo: entidadTipo },
      'fecha',
      LOTE,
      skip
    );
    if (!pagina || pagina.length === 0) break;
    movsEntidad.push(...pagina);
    if (pagina.length < LOTE) break;
    skip += LOTE;
    if (pagina.length === LOTE) await delay(DELAY_ENTRE_LOTES_MS);
  }

  const movsOrdenados = movsEntidad.sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  );
  const movimientosConSaldo = calcularSaldosAcumulados(movsOrdenados);

  for (const mov of movimientosConSaldo) {
    await base44.entities.CuentaCorriente.update(mov.id, {
      saldo_resultante: mov.saldo_resultante
    });
  }

  return movimientosConSaldo.length > 0
    ? movimientosConSaldo[movimientosConSaldo.length - 1].saldo_resultante
    : 0;
}

const DELAY_ENTRE_LOTES_MS = 150;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
