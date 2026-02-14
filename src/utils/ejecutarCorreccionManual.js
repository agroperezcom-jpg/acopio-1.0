import { correccionRetroactivaEnvases } from '@/components/utils/correccionRetroactivaEnvases';
import { listAll } from '@/utils/listAllPaginado';

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const DELAY_PER_OPERATION_MS = 500;
const FETCH_PAGE_SIZE = 100;
const DELAY_BETWEEN_PAGES_MS = 250;

/**
 * Descarga todos los registros de una entidad paginando de a FETCH_PAGE_SIZE para evitar 429.
 * @param {Object} entity - base44.entities.X
 * @param {string} order - ej: '-created_date'
 * @returns {Promise<Array>}
 */
async function fetchAll(entity, order = '-created_date') {
  const all = [];
  let skip = 0;
  while (true) {
    const batch = await entity.list(order, FETCH_PAGE_SIZE, skip);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < FETCH_PAGE_SIZE) break;
    skip += batch.length;
    await delay(DELAY_BETWEEN_PAGES_MS);
  }
  return all;
}

/**
 * Arqueo de saldos de envases: procesa TODO el historial (Movimiento con Mov. Envases + Ingreso Fruta con envases, SalidaFruta con envases)
 * y actualiza saldo_envases en cada Proveedor y Cliente.
 * - Movimiento de Envases: Salida (entregamos vacíos) → saldo += cantidad; Ingreso (nos devuelven) → saldo -= cantidad.
 * - Ingreso Fruta (proveedor trae envases_llenos): saldo[proveedor] -= cantidad.
 * - Salida Fruta (cliente se lleva envases_llenos): saldo[cliente] += cantidad.
 */
async function correccionSaldosEnvases(base44, queryClient, onProgress) {
  const report = (msg) => { if (typeof onProgress === 'function') onProgress(msg); };

  report('Recalculando stock físico (ocupados/vacíos)...');
  const resultadoStock = await correccionRetroactivaEnvases(base44);
  const envasesCorregidos = resultadoStock?.corregidos ?? 0;
  await delay(DELAY_PER_OPERATION_MS);

  report('Descargando Proveedores, Clientes y Envases...');
  const [proveedores, clientes, envases] = await Promise.all([
    listAll(base44.entities.Proveedor, 'nombre'),
    listAll(base44.entities.Cliente, 'nombre'),
    listAll(base44.entities.Envase, 'tipo'),
  ]);
  await delay(DELAY_PER_OPERATION_MS);

  const envaseIdToTipo = {};
  envases.forEach((e) => { if (e.id != null && e.tipo) envaseIdToTipo[String(e.id)] = e.tipo; });

  report('Descargando Movimientos (paginado 100)...');
  const movimientos = await fetchAll(base44.entities.Movimiento, '-created_date');
  await delay(DELAY_BETWEEN_PAGES_MS);

  report('Descargando Salidas de Fruta (paginado 100)...');
  const salidas = await fetchAll(base44.entities.SalidaFruta, '-created_date');
  await delay(DELAY_BETWEEN_PAGES_MS);

  const saldos = {};
  const norm = (id) => (id == null ? '' : String(id));

  function addSaldo(entidadTipo, entidadId, tipoEnvase, delta) {
    const id = norm(entidadId);
    if (!id || !tipoEnvase) return;
    const key = `${entidadTipo}-${id}`;
    if (!saldos[key]) saldos[key] = {};
    const prev = Number(saldos[key][tipoEnvase]) || 0;
    saldos[key][tipoEnvase] = prev + Number(delta);
  }

  function getTipoEnvase(e, envaseIdToTipo) {
    return e.envase_tipo || (e.envase_id != null && envaseIdToTipo[String(e.envase_id)]) || null;
  }

  // ─── Movimiento de Envases ───
  for (const mov of movimientos) {
    if (mov.tipo_movimiento !== 'Movimiento de Envases' || !mov.movimiento_envases?.length) continue;
    for (const me of mov.movimiento_envases) {
      const tipo = getTipoEnvase(me, envaseIdToTipo);
      if (!tipo) continue;
      const ing = Number(me.cantidad_ingreso) || 0;
      const sal = Number(me.cantidad_salida) || 0;
      if (mov.proveedor_id) addSaldo('Proveedor', mov.proveedor_id, tipo, sal - ing);
      if (mov.cliente_id) addSaldo('Cliente', mov.cliente_id, tipo, ing - sal);
    }
  }

  // ─── Ingreso de Fruta (solo con envases): proveedor devuelve envases → saldo -= cantidad ───
  for (const mov of movimientos) {
    if (mov.tipo_movimiento !== 'Ingreso de Fruta' || !mov.proveedor_id) continue;
    if (mov.envases_llenos?.length) {
      for (const e of mov.envases_llenos) {
        const tipo = getTipoEnvase(e, envaseIdToTipo);
        const cantidad = Number(e.cantidad) ?? Number(e.cantidad_ingreso) ?? 0;
        if (tipo && cantidad !== 0) addSaldo('Proveedor', mov.proveedor_id, tipo, -cantidad);
      }
    } else if (mov.pesajes?.length) {
      const porTipo = {};
      for (const p of mov.pesajes) {
        if (p.envase_id != null || p.envase_tipo) {
          const tipo = p.envase_tipo || envaseIdToTipo[String(p.envase_id)];
          if (tipo) porTipo[tipo] = (porTipo[tipo] || 0) + (Number(p.cantidad) || 1);
        }
      }
      for (const [tipo, cantidad] of Object.entries(porTipo)) {
        addSaldo('Proveedor', mov.proveedor_id, tipo, -cantidad);
      }
    }
  }

  // ─── Salida Fruta (solo con envases): cliente se lleva envases → saldo += cantidad ───
  for (const salida of salidas) {
    if (!salida.cliente_id || !salida.envases_llenos?.length) continue;
    for (const e of salida.envases_llenos) {
      const tipo = getTipoEnvase(e, envaseIdToTipo);
      const cantidad = Number(e.cantidad) ?? Number(e.cantidad_ingreso) ?? 0;
      if (tipo && cantidad !== 0) addSaldo('Cliente', salida.cliente_id, tipo, cantidad);
    }
  }

  function saldoLimpio(objeto) {
    if (!objeto || typeof objeto !== 'object') return {};
    return Object.fromEntries(
      Object.entries(objeto)
        .filter(([, v]) => Number(v) !== 0)
        .map(([k, v]) => [k, Number(v)])
    );
  }

  let actualizados = 0;
  const totalProveedores = proveedores.length;
  const totalClientes = clientes.length;

  for (let i = 0; i < proveedores.length; i++) {
    const p = proveedores[i];
    const key = `Proveedor-${norm(p.id)}`;
    const raw = saldos[key];
    const saldoEnvases = saldoLimpio(raw);
    try {
      await base44.entities.Proveedor.update(p.id, { saldo_envases: saldoEnvases });
      actualizados++;
    } catch (err) {
      console.warn(`correccionSaldosEnvases: error actualizando Proveedor ${p.id}:`, err?.message || err);
    }
    report(`Proveedores: ${i + 1}/${totalProveedores}`);
    await delay(DELAY_PER_OPERATION_MS);
  }

  for (let i = 0; i < clientes.length; i++) {
    const c = clientes[i];
    const key = `Cliente-${norm(c.id)}`;
    const raw = saldos[key];
    const saldoEnvases = saldoLimpio(raw);
    try {
      await base44.entities.Cliente.update(c.id, { saldo_envases: saldoEnvases });
      actualizados++;
    } catch (err) {
      console.warn(`correccionSaldosEnvases: error actualizando Cliente ${c.id}:`, err?.message || err);
    }
    report(`Clientes: ${i + 1}/${totalClientes}`);
    await delay(DELAY_PER_OPERATION_MS);
  }

  queryClient.invalidateQueries({ queryKey: ['proveedores'] });
  queryClient.invalidateQueries({ queryKey: ['clientes'] });
  queryClient.invalidateQueries({ queryKey: ['proveedores-saldosenvases'] });
  queryClient.invalidateQueries({ queryKey: ['clientes-saldosenvases'] });
  queryClient.invalidateQueries({ queryKey: ['envases'] });

  return {
    actualizados,
    totalProveedores,
    totalClientes,
    envasesCorregidos,
    message: `Recalcular envases: ${envasesCorregidos} tipos de envase (stock físico) y ${actualizados} entidades (saldos de deuda).`,
  };
}

// Función para ejecutar correcciones manualmente
export async function ejecutarCorreccionManual(tipo, base44, queryClient, onProgress) {
  // Resetear flags de localStorage para permitir re-ejecución
  const resetFlags = () => {
    switch(tipo) {
      case 'correccionSaldosEnvases':
        localStorage.removeItem('correccion_saldos_envases_v1');
        break;
      case 'recalcularSaldosDesdeCC':
        localStorage.removeItem('recalcular_saldos_desde_cc_v1');
        break;
    }
  };

  resetFlags();

  switch(tipo) {
    case 'correccionSaldosEnvases':
      return correccionSaldosEnvases(base44, queryClient, onProgress);
    case 'recalcularSaldosDesdeCC': {
      // Reparación masiva: saldo_actual = suma de CuentaCorriente (Haber suma, Debe resta). Solo confía en monto guardado.
      const report = (msg) => { if (typeof onProgress === 'function') onProgress(msg); };

      report('Descargando Cuenta Corriente...');
      const todosCC = await listAll(base44.entities.CuentaCorriente, '-fecha');
      await delay(DELAY_PER_OPERATION_MS);

      const saldoPorEntidad = {};
      for (const mov of todosCC) {
        const tipo = mov.entidad_tipo;
        const id = mov.entidad_id;
        if (!tipo || !id) continue;
        const key = `${tipo}-${id}`;
        if (!saldoPorEntidad[key]) saldoPorEntidad[key] = 0;
        const monto = Number(mov.monto) || 0;
        if (mov.tipo_movimiento === 'Haber') {
          saldoPorEntidad[key] += monto;
        } else {
          saldoPorEntidad[key] -= monto;
        }
      }

      report('Descargando Proveedores y Clientes...');
      const [proveedores, clientes] = await Promise.all([
        listAll(base44.entities.Proveedor, 'nombre'),
        listAll(base44.entities.Cliente, 'nombre')
      ]);
      await delay(DELAY_PER_OPERATION_MS);

      let actualizados = 0;
      const totalP = proveedores.length;
      const totalC = clientes.length;

      for (let i = 0; i < proveedores.length; i++) {
        const p = proveedores[i];
        const saldo = saldoPorEntidad[`Proveedor-${p.id}`] ?? 0;
        const valor = Math.round(Number(saldo) * 100) / 100;
        try {
          await base44.entities.Proveedor.update(p.id, { saldo_actual: valor });
          actualizados++;
        } catch (err) {
          console.warn(`recalcularSaldosDesdeCC: error Proveedor ${p.id}:`, err?.message || err);
        }
        report(`Proveedores: ${i + 1}/${totalP}`);
        await delay(DELAY_PER_OPERATION_MS);
      }

      for (let i = 0; i < clientes.length; i++) {
        const c = clientes[i];
        const saldo = saldoPorEntidad[`Cliente-${c.id}`] ?? 0;
        const valor = Math.round(Number(saldo) * 100) / 100;
        try {
          await base44.entities.Cliente.update(c.id, { saldo_actual: valor });
          actualizados++;
        } catch (err) {
          console.warn(`recalcularSaldosDesdeCC: error Cliente ${c.id}:`, err?.message || err);
        }
        report(`Clientes: ${i + 1}/${totalC}`);
        await delay(DELAY_PER_OPERATION_MS);
      }

      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cuentacorriente'] });
      return {
        actualizados,
        totalProveedores: totalP,
        totalClientes: totalC,
        message: `Saldos desde CC: ${actualizados} entidades actualizadas (${totalP} proveedores, ${totalC} clientes). saldo_actual = suma de CuentaCorriente.`
      };
    }
    default:
      throw new Error(`Tipo de corrección desconocido: ${tipo}`);
  }
}
