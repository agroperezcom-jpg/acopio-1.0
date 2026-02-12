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
 * Recalcula y actualiza los saldos resultantes para todos los movimientos de una entidad
 * Útil para correcciones después de cambios en movimientos existentes
 * @param {Object} base44 - Instancia de base44 client
 * @param {string} entidadId - ID de la entidad (cliente o proveedor)
 * @param {string} entidadTipo - 'Cliente' o 'Proveedor'
 * @returns {Promise<number>} - Saldo final calculado
 */
export async function recalcularSaldosEntidad(base44, entidadId, entidadTipo) {
  const todosMovCC = await base44.entities.CuentaCorriente.list();
  const movsEntidad = todosMovCC
    .filter(m => m.entidad_id === entidadId && m.entidad_tipo === entidadTipo)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  
  const movimientosConSaldo = calcularSaldosAcumulados(movsEntidad);
  
  // Actualizar en base de datos
  for (const mov of movimientosConSaldo) {
    await base44.entities.CuentaCorriente.update(mov.id, {
      saldo_resultante: mov.saldo_resultante
    });
  }
  
  // Retornar el saldo final
  return movimientosConSaldo.length > 0 
    ? movimientosConSaldo[movimientosConSaldo.length - 1].saldo_resultante 
    : 0;
}

const DELAY_ENTRE_ENTIDADES_MS = 200;
const DELAY_ENTRE_LOTES_MS = 150;
const LOTE_MOVIMIENTOS = 100;
const LOTE_ENTIDADES = 100;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Obtiene todos los registros de una entidad paginando (evita 429).
 * @param {Function} fetchPage - (skip) => Promise<Array>
 * @param {string} nombreEntidad - Para mensajes de progreso
 * @param {Function} onProgress - (message) => void
 * @returns {Promise<Array>}
 */
async function obtenerTodosPaginado(fetchPage, nombreEntidad, onProgress) {
  const todos = [];
  let skip = 0;
  let loteNum = 0;
  while (true) {
    loteNum++;
    onProgress(`Descargando lote ${loteNum} de ${nombreEntidad}...`);
    const pagina = await fetchPage(skip);
    if (!pagina || pagina.length === 0) break;
    todos.push(...pagina);
    if (pagina.length < LOTE_ENTIDADES) break;
    skip += LOTE_ENTIDADES;
    await delay(DELAY_ENTRE_LOTES_MS);
  }
  return todos;
}

/**
 * Obtiene todos los movimientos de CuentaCorriente de una entidad en lotes.
 * @param {Object} base44
 * @param {string} entidadTipo - 'Proveedor' | 'Cliente'
 * @param {string} entidadId
 * @param {string} nombreEntidad - Para mensajes
 * @param {Function} onProgress - (message) => void
 * @returns {Promise<Array>}
 */
async function obtenerMovimientosEntidadPaginado(base44, entidadTipo, entidadId, nombreEntidad, onProgress) {
  const todos = [];
  let skip = 0;
  let loteNum = 0;
  while (true) {
    loteNum++;
    onProgress(`Descargando lote ${loteNum} de movimientos para ${nombreEntidad}...`);
    const pagina = await base44.entities.CuentaCorriente.filter(
      { entidad_tipo: entidadTipo, entidad_id: entidadId },
      'fecha',
      LOTE_MOVIMIENTOS,
      skip
    );
    if (!pagina || pagina.length === 0) break;
    todos.push(...pagina);
    if (pagina.length < LOTE_MOVIMIENTOS) break;
    skip += LOTE_MOVIMIENTOS;
    await delay(DELAY_ENTRE_LOTES_MS);
  }
  return todos;
}

/**
 * Calcula el saldo real a partir de movimientos de CC (Haber aumenta deuda, Debe la disminuye).
 * Saldo = suma(Haber) - suma(Debe).
 */
function calcularSaldoDesdeMovimientos(movimientos) {
  const ordenados = [...(movimientos || [])].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  );
  let saldo = 0;
  for (const mov of ordenados) {
    const monto = Number(mov.monto) || 0;
    if (mov.tipo_movimiento === 'Haber') saldo += monto;
    else saldo -= monto;
  }
  return Math.round(saldo * 100) / 100;
}

/**
 * Sincroniza saldo_actual de todos los Proveedores y Clientes desde el historial de CuentaCorriente.
 * Procesa en lotes y de forma secuencial para evitar 429.
 * Solo se ejecuta al llamar explícitamente (ej. botón "Sincronizar Saldos").
 * @param {Object} base44 - Cliente base44
 * @param {Function} onProgress - (message: string) => void - Callback para actualizar UI
 * @returns {Promise<{ proveedoresActualizados: number, clientesActualizados: number }>}
 */
export async function sincronizarSaldosEntidades(base44, onProgress = () => {}) {
  onProgress('Iniciando sincronización de saldos...');

  const fetchProveedores = (skip) =>
    base44.entities.Proveedor.list('nombre', LOTE_ENTIDADES, skip);
  const fetchClientes = (skip) =>
    base44.entities.Cliente.list('nombre', LOTE_ENTIDADES, skip);

  const proveedores = await obtenerTodosPaginado(fetchProveedores, 'proveedores', onProgress);
  onProgress(`Se obtuvieron ${proveedores.length} proveedores. Procesando uno por uno...`);
  await delay(DELAY_ENTRE_LOTES_MS);

  let proveedoresActualizados = 0;
  let index = 0;
  for (const proveedor of proveedores) {
    index++;
    onProgress(`Procesando Proveedor ${index} de ${proveedores.length}: ${proveedor.nombre || proveedor.id}...`);
    const movimientos = await obtenerMovimientosEntidadPaginado(
      base44,
      'Proveedor',
      proveedor.id,
      proveedor.nombre || proveedor.id,
      onProgress
    );
    const saldoReal = calcularSaldoDesdeMovimientos(movimientos);
    await base44.entities.Proveedor.update(proveedor.id, { saldo_actual: saldoReal });
    proveedoresActualizados++;
    await delay(DELAY_ENTRE_ENTIDADES_MS);
  }

  onProgress(`Proveedores listos. Obteniendo clientes...`);
  const clientes = await obtenerTodosPaginado(fetchClientes, 'clientes', onProgress);
  onProgress(`Se obtuvieron ${clientes.length} clientes. Procesando uno por uno...`);
  await delay(DELAY_ENTRE_LOTES_MS);

  let clientesActualizados = 0;
  index = 0;
  for (const cliente of clientes) {
    index++;
    onProgress(`Procesando Cliente ${index} de ${clientes.length}: ${cliente.nombre || cliente.id}...`);
    const movimientos = await obtenerMovimientosEntidadPaginado(
      base44,
      'Cliente',
      cliente.id,
      cliente.nombre || cliente.id,
      onProgress
    );
    const saldoReal = calcularSaldoDesdeMovimientos(movimientos);
    await base44.entities.Cliente.update(cliente.id, { saldo_actual: saldoReal });
    clientesActualizados++;
    await delay(DELAY_ENTRE_ENTIDADES_MS);
  }

  onProgress('¡Sincronización completada con éxito!');
  return { proveedoresActualizados, clientesActualizados };
}
