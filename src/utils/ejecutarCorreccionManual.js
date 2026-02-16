import { listAll } from '@/utils/listAllPaginado';

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const DELAY_PER_OPERATION_MS = 500;
const FETCH_PAGE_SIZE = 100;
const DELAY_BETWEEN_PAGES_MS = 250;

/**
 * Descarga Movimientos paginados de a 100 para evitar 429.
 */
async function fetchAllMovimientos(base44) {
  const all = [];
  let skip = 0;
  while (true) {
    const batch = await base44.entities.Movimiento.list('-created_date', FETCH_PAGE_SIZE, skip);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < FETCH_PAGE_SIZE) break;
    skip += batch.length;
    await delay(DELAY_BETWEEN_PAGES_MS);
  }
  return all;
}

/**
 * Descarga Salidas de Fruta paginadas.
 */
async function fetchAllSalidasFruta(base44) {
  const all = [];
  let skip = 0;
  while (true) {
    const batch = await base44.entities.SalidaFruta.list('-created_date', FETCH_PAGE_SIZE, skip);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < FETCH_PAGE_SIZE) break;
    skip += batch.length;
    await delay(DELAY_BETWEEN_PAGES_MS);
  }
  return all;
}

/**
 * Descarga TODA la tabla CuentaCorriente en lotes de 100 (Anti-429).
 */
async function fetchAllCuentaCorriente(base44) {
  const all = [];
  let skip = 0;
  while (true) {
    const batch = await base44.entities.CuentaCorriente.list('-fecha', FETCH_PAGE_SIZE, skip);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < FETCH_PAGE_SIZE) break;
    skip += batch.length;
    await delay(DELAY_BETWEEN_PAGES_MS);
  }
  return all;
}

/**
 * reconstruirHistoriaEnvases: Migración definitiva de saldos de envases.
 * - Pone todos los saldos de Proveedores y Clientes en {}.
 * - Descarga historial (Movimientos, Salidas) paginado de a 100.
 * - Recorre cronológicamente y aplica la lógica de SaldoEnvasesService en memoria.
 * - Al final guarda el resultado en cada entidad.
 *
 * Lógica (en memoria):
 * - Movimiento de Envases: salida = ENTREGA (+deuda), ingreso = RECEPCION (-deuda).
 * - Ingreso de Fruta (envases_llenos): proveedor devuelve → RECEPCION (-deuda).
 * - Salida de Fruta (envases_llenos): cliente se lleva → ENTREGA (+deuda).
 */
async function reconstruirHistoriaEnvases(base44, onProgress) {
  const report = (msg) => { if (typeof onProgress === 'function') onProgress(msg); };

  report('Descargando Proveedores, Clientes y Envases...');
  const [proveedores, clientes, envases] = await Promise.all([
    listAll(base44.entities.Proveedor, 'nombre', FETCH_PAGE_SIZE),
    listAll(base44.entities.Cliente, 'nombre', FETCH_PAGE_SIZE),
    listAll(base44.entities.Envase, 'tipo', FETCH_PAGE_SIZE),
  ]);
  await delay(DELAY_PER_OPERATION_MS);

  const envaseIdToTipo = {};
  envases.forEach((e) => { if (e.id != null && e.tipo) envaseIdToTipo[String(e.id)] = e.tipo; });

  const getTipoEnvase = (e) => e.envase_tipo || (e.envase_id != null && envaseIdToTipo[String(e.envase_id)]) || null;

  // 1. Poner todos los saldos en {}
  report('Poniendo todos los saldos de envases en cero...');
  for (const p of proveedores) {
    try {
      await base44.entities.Proveedor.update(p.id, { saldo_envases: {} });
    } catch (err) {
      console.warn(`reconstruirHistoriaEnvases: error reset Proveedor ${p.id}:`, err?.message);
    }
    await delay(50);
  }
  for (const c of clientes) {
    try {
      await base44.entities.Cliente.update(c.id, { saldo_envases: {} });
    } catch (err) {
      console.warn(`reconstruirHistoriaEnvases: error reset Cliente ${c.id}:`, err?.message);
    }
    await delay(50);
  }
  await delay(DELAY_PER_OPERATION_MS);

  // 2. Descargar historial paginado
  report('Descargando Movimientos (paginado 100)...');
  const movimientos = await fetchAllMovimientos(base44);
  await delay(DELAY_BETWEEN_PAGES_MS);

  report('Descargando Salidas de Fruta (paginado 100)...');
  const salidas = await fetchAllSalidasFruta(base44);
  await delay(DELAY_BETWEEN_PAGES_MS);

  // 3. Combinar y ordenar cronológicamente
  const eventos = [
    ...movimientos.map(m => ({ ...m, _tipo: 'movimiento', _fecha: m.fecha || m.created_date })),
    ...salidas.map(s => ({ ...s, _tipo: 'salida', _fecha: s.fecha || s.created_date })),
  ];
  eventos.sort((a, b) => new Date(a._fecha || 0) - new Date(b._fecha || 0));

  // 4. Aplicar lógica SaldoEnvasesService en memoria
  const saldos = {};
  const norm = (id) => (id == null ? '' : String(id));

  function aplicarDelta(entidadTipo, entidadId, tipoEnvase, delta) {
    const id = norm(entidadId);
    if (!id || !tipoEnvase) return;
    const key = `${entidadTipo}-${id}`;
    if (!saldos[key]) saldos[key] = {};
    const prev = Number(saldos[key][tipoEnvase]) || 0;
    saldos[key][tipoEnvase] = prev + Number(delta);
  }

  for (const ev of eventos) {
    if (ev._tipo === 'movimiento') {
      // Movimiento de Envases
      if (ev.tipo_movimiento === 'Movimiento de Envases' && ev.movimiento_envases?.length) {
        for (const me of ev.movimiento_envases) {
          const tipo = getTipoEnvase(me);
          if (!tipo) continue;
          const sal = Number(me.cantidad_salida) || 0;
          const ing = Number(me.cantidad_ingreso) || 0;
          if (sal > 0) {
            if (ev.proveedor_id) aplicarDelta('Proveedor', ev.proveedor_id, tipo, sal);
            if (ev.cliente_id) aplicarDelta('Cliente', ev.cliente_id, tipo, sal);
          }
          if (ing > 0) {
            if (ev.proveedor_id) aplicarDelta('Proveedor', ev.proveedor_id, tipo, -ing);
            if (ev.cliente_id) aplicarDelta('Cliente', ev.cliente_id, tipo, -ing);
          }
        }
      }
      // Ingreso de Fruta (envases_llenos): proveedor devuelve → RECEPCION (-deuda)
      if (ev.tipo_movimiento === 'Ingreso de Fruta' && ev.envases_llenos?.length && ev.proveedor_id) {
        for (const e of ev.envases_llenos) {
          const tipo = getTipoEnvase(e);
          const cantidad = Number(e.cantidad) ?? Number(e.cantidad_ingreso) ?? 0;
          if (tipo && cantidad > 0) aplicarDelta('Proveedor', ev.proveedor_id, tipo, -cantidad);
        }
      }
    } else if (ev._tipo === 'salida') {
      // Salida de Fruta (envases_llenos): cliente se lleva → ENTREGA (+deuda)
      if (ev.envases_llenos?.length && ev.cliente_id) {
        for (const e of ev.envases_llenos) {
          const tipo = getTipoEnvase(e);
          const cantidad = Number(e.cantidad) ?? Number(e.cantidad_ingreso) ?? 0;
          if (tipo && cantidad > 0) aplicarDelta('Cliente', ev.cliente_id, tipo, cantidad);
        }
      }
    }
  }

  // 5. Limpiar saldos (omitir ceros)
  function saldoLimpio(objeto) {
    if (!objeto || typeof objeto !== 'object') return {};
    return Object.fromEntries(
      Object.entries(objeto)
        .filter(([, v]) => Number(v) !== 0)
        .map(([k, v]) => [k, Number(v)])
    );
  }

  // 6. Guardar en cada entidad
  let actualizados = 0;
  const totalProveedores = proveedores.length;
  const totalClientes = clientes.length;

  report('Guardando saldos en Proveedores...');
  for (let i = 0; i < proveedores.length; i++) {
    const p = proveedores[i];
    const key = `Proveedor-${norm(p.id)}`;
    const raw = saldos[key];
    const saldoEnvases = saldoLimpio(raw);
    try {
      await base44.entities.Proveedor.update(p.id, { saldo_envases: saldoEnvases });
      actualizados++;
    } catch (err) {
      console.warn(`reconstruirHistoriaEnvases: error Proveedor ${p.id}:`, err?.message);
    }
    if (i % 10 === 0) report(`Proveedores: ${i + 1}/${totalProveedores}`);
    await delay(DELAY_PER_OPERATION_MS);
  }

  report('Guardando saldos en Clientes...');
  for (let i = 0; i < clientes.length; i++) {
    const c = clientes[i];
    const key = `Cliente-${norm(c.id)}`;
    const raw = saldos[key];
    const saldoEnvases = saldoLimpio(raw);
    try {
      await base44.entities.Cliente.update(c.id, { saldo_envases: saldoEnvases });
      actualizados++;
    } catch (err) {
      console.warn(`reconstruirHistoriaEnvases: error Cliente ${c.id}:`, err?.message);
    }
    if (i % 10 === 0) report(`Clientes: ${i + 1}/${totalClientes}`);
    await delay(DELAY_PER_OPERATION_MS);
  }

  return {
    actualizados,
    totalProveedores,
    totalClientes,
    movimientosProcesados: movimientos.length,
    salidasProcesadas: salidas.length,
    message: `reconstruirHistoriaEnvases: ${actualizados} entidades actualizadas (${movimientos.length} movimientos, ${salidas.length} salidas procesados cronológicamente).`,
  };
}

/**
 * Reconstruye saldo_actual de Proveedor y Cliente desde el libro mayor (CuentaCorriente).
 * - Descarga CuentaCorriente en lotes de 100 (Anti-429).
 * - Haber = aumenta saldo (deuda); Debe = disminuye (pago/cobro).
 * - Persiste saldo_actual redondeado a 2 decimales.
 */
async function reconstruirSaldosMonetarios(base44, onProgress) {
  const report = (msg) => { if (typeof onProgress === 'function') onProgress(msg); };

  report('Descargando Cuenta Corriente (lotes de 100)...');
  const todosCC = await fetchAllCuentaCorriente(base44);
  await delay(DELAY_PER_OPERATION_MS);

  const saldos = {};
  const norm = (id) => (id == null ? '' : String(id));

  for (const mov of todosCC) {
    if (mov.anulado === true || mov.estado === 'Anulado') continue;
    const tipo = mov.entidad_tipo;
    const id = mov.entidad_id;
    if (!tipo || !id) continue;
    const key = `${tipo}-${norm(id)}`;
    if (saldos[key] === undefined) saldos[key] = 0;
    const monto = Number(mov.monto) || 0;
    if (mov.tipo_movimiento === 'Haber') {
      saldos[key] += monto;
    } else if (mov.tipo_movimiento === 'Debe') {
      saldos[key] -= monto;
    }
  }

  report('Descargando Proveedores y Clientes...');
  const [proveedores, clientes] = await Promise.all([
    listAll(base44.entities.Proveedor, 'nombre', FETCH_PAGE_SIZE),
    listAll(base44.entities.Cliente, 'nombre', FETCH_PAGE_SIZE),
  ]);
  await delay(DELAY_PER_OPERATION_MS);

  let actualizados = 0;
  const totalP = proveedores.length;
  const totalC = clientes.length;

  report('Guardando saldos en Proveedores...');
  for (let i = 0; i < proveedores.length; i++) {
    const p = proveedores[i];
    const saldo = saldos[`Proveedor-${norm(p.id)}`] ?? 0;
    const nuevoSaldo = Math.round(Number(saldo) * 100) / 100;
    try {
      await base44.entities.Proveedor.update(p.id, { saldo_actual: nuevoSaldo });
      actualizados++;
    } catch (err) {
      console.warn(`reconstruirSaldosMonetarios: error Proveedor ${p.id}:`, err?.message);
    }
    if (i % 10 === 0) report(`Proveedores: ${i + 1}/${totalP}`);
    await delay(DELAY_PER_OPERATION_MS);
  }

  report('Guardando saldos en Clientes...');
  for (let i = 0; i < clientes.length; i++) {
    const c = clientes[i];
    const saldo = saldos[`Cliente-${norm(c.id)}`] ?? 0;
    const nuevoSaldo = Math.round(Number(saldo) * 100) / 100;
    try {
      await base44.entities.Cliente.update(c.id, { saldo_actual: nuevoSaldo });
      actualizados++;
    } catch (err) {
      console.warn(`reconstruirSaldosMonetarios: error Cliente ${c.id}:`, err?.message);
    }
    if (i % 10 === 0) report(`Clientes: ${i + 1}/${totalC}`);
    await delay(DELAY_PER_OPERATION_MS);
  }

  return {
    actualizados,
    totalProveedores: totalP,
    totalClientes: totalC,
    movimientosCC: todosCC.length,
    message: `Saldos desde CC: ${actualizados} entidades actualizadas (${todosCC.length} movimientos de CuentaCorriente). saldo_actual matemáticamente correcto.`,
  };
}

// Función para ejecutar correcciones manualmente
export async function ejecutarCorreccionManual(tipo, base44, queryClient, onProgress) {
  const resetFlags = () => {
    switch (tipo) {
      case 'correccionSaldosEnvases':
        localStorage.removeItem('correccion_saldos_envases_v1');
        break;
      case 'recalcularSaldosDesdeCC':
        localStorage.removeItem('recalcular_saldos_desde_cc_v1');
        break;
    }
  };

  resetFlags();

  switch (tipo) {
    case 'correccionSaldosEnvases': {
      const resultado = await reconstruirHistoriaEnvases(base44, onProgress);
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['proveedores-saldosenvases'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-saldosenvases'] });
      queryClient.invalidateQueries({ queryKey: ['envases'] });
      return resultado;
    }
    case 'recalcularSaldosDesdeCC': {
      const resultado = await reconstruirSaldosMonetarios(base44, onProgress);
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cuentacorriente'] });
      return resultado;
    }
    default:
      throw new Error(`Tipo de corrección desconocido: ${tipo}`);
  }
}
