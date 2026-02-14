import { correccionRetroactivaEnvases } from '@/components/utils/correccionRetroactivaEnvases';
import { listAll } from '@/utils/listAllPaginado';

const delay = (ms) => new Promise(res => setTimeout(res, ms));
const DELAY_PER_OPERATION_MS = 500; // Extremadamente conservador: 1 operación cada 500ms para evitar 429

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
    case 'correccionSaldosEnvases': {
      const report = (msg) => { if (typeof onProgress === 'function') onProgress(msg); };

      // 1. Recalcular stock físico (ocupados/vacíos) con la misma lógica que Corrección Retroactiva
      report('Recalculando stock físico (ocupados/vacíos)...');
      const resultadoStock = await correccionRetroactivaEnvases(base44);
      const envasesCorregidos = resultadoStock?.corregidos ?? 0;

      report('Descargando proveedores y clientes...');
      const [proveedores, clientes, envases] = await Promise.all([
        listAll(base44.entities.Proveedor, 'nombre'),
        listAll(base44.entities.Cliente, 'nombre'),
        listAll(base44.entities.Envase, 'tipo')
      ]);
      await delay(DELAY_PER_OPERATION_MS);

      const envaseIdToTipo = {};
      envases.forEach(e => { if (e.id && e.tipo) envaseIdToTipo[e.id] = e.tipo; });

      report('Descargando movimientos (por lotes)...');
      const movimientos = await listAll(base44.entities.Movimiento, '-created_date');
      await delay(DELAY_PER_OPERATION_MS);

      report('Descargando salidas de fruta (por lotes)...');
      const salidas = await listAll(base44.entities.SalidaFruta, '-created_date');

      const saldosPorEntidad = {};

      function addSaldo(entidadTipo, entidadId, tipoEnvase, delta) {
        if (!entidadId || !tipoEnvase) return;
        const key = `${entidadTipo}-${entidadId}`;
        if (!saldosPorEntidad[key]) saldosPorEntidad[key] = {};
        const actual = Number(saldosPorEntidad[key][tipoEnvase]) || 0;
        saldosPorEntidad[key][tipoEnvase] = actual + Number(delta);
      }

      for (const mov of movimientos) {
        if (mov.tipo_movimiento === 'Ingreso de Fruta' && mov.proveedor_id) {
          if (mov.envases_llenos?.length) {
            for (const e of mov.envases_llenos) {
              const tipo = e.envase_tipo;
              if (tipo && (e.cantidad || 0) !== 0) addSaldo('Proveedor', mov.proveedor_id, tipo, -(e.cantidad || 0));
            }
          } else if (mov.pesajes?.length) {
            const porEnvase = {};
            for (const p of mov.pesajes) {
              if (p.envase_id) {
                const tipo = envaseIdToTipo[p.envase_id] || p.envase_tipo;
                if (tipo) {
                  porEnvase[tipo] = (porEnvase[tipo] || 0) + (p.cantidad || 1);
                }
              }
            }
            for (const [tipo, cantidad] of Object.entries(porEnvase)) {
              addSaldo('Proveedor', mov.proveedor_id, tipo, -cantidad);
            }
          }
        }
        // Misma fórmula que MovimientoEnvases.jsx: Proveedor delta = salida - ingreso, Cliente delta = ingreso - salida
        if (mov.tipo_movimiento === 'Movimiento de Envases' && mov.movimiento_envases?.length) {
          for (const e of mov.movimiento_envases) {
            const tipo = e.envase_tipo || (e.envase_id && envaseIdToTipo[e.envase_id]);
            if (!tipo) continue;
            const ing = Number(e.cantidad_ingreso) || 0;
            const sal = Number(e.cantidad_salida) || 0;
            if (mov.proveedor_id) addSaldo('Proveedor', mov.proveedor_id, tipo, sal - ing);
            if (mov.cliente_id) addSaldo('Cliente', mov.cliente_id, tipo, ing - sal);
          }
        }
      }

      for (const salida of salidas) {
        if (!salida.cliente_id || !salida.envases_llenos?.length) continue;
        for (const e of salida.envases_llenos) {
          const tipo = e.envase_tipo || (e.envase_id && envaseIdToTipo[e.envase_id]);
          if (tipo && (e.cantidad || 0) !== 0) addSaldo('Cliente', salida.cliente_id, tipo, -(e.cantidad || 0));
        }
      }

      let actualizados = 0;
      const totalProveedores = proveedores.length;
      const totalClientes = clientes.length;

      for (let i = 0; i < proveedores.length; i++) {
        const p = proveedores[i];
        const key = `Proveedor-${p.id}`;
        const saldo = saldosPorEntidad[key];
        const saldoEnvases = saldo ? Object.fromEntries(
          Object.entries(saldo).map(([t, v]) => [t, Math.max(0, Number(v))]).filter(([, v]) => v !== 0)
        ) : {};
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
        const key = `Cliente-${c.id}`;
        const saldo = saldosPorEntidad[key];
        const saldoEnvases = saldo ? Object.fromEntries(
          Object.entries(saldo).map(([t, v]) => [t, Math.max(0, Number(v))]).filter(([, v]) => v !== 0)
        ) : {};
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
        message: `Recalcular envases: ${envasesCorregidos} tipos de envase (stock físico) y ${actualizados} entidades (saldos de deuda).`
      };
    }
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
