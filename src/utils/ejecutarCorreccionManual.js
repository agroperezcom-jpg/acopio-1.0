import { correccionRetroactivaPerdidas } from '@/components/utils/correccionRetroactivaPerdidas';
import { correccionRetroactivaEnvases } from '@/components/utils/correccionRetroactivaEnvases';
import { obtenerPrecioVigente } from '@/utils/precioVigente';
import { listAll } from '@/utils/listAllPaginado';

const delay = (ms) => new Promise(res => setTimeout(res, ms));
const DELAY_PER_OPERATION_MS = 500; // Extremadamente conservador: 1 operación cada 500ms para evitar 429

// Función para ejecutar correcciones manualmente
export async function ejecutarCorreccionManual(tipo, base44, queryClient, onProgress) {
  // Resetear flags de localStorage para permitir re-ejecución
  const resetFlags = () => {
    switch(tipo) {
      case 'autoRetroactiva':
        localStorage.removeItem('acopio_correccion_perdidas_v1_ejecutada');
        localStorage.removeItem('acopio_correccion_perdidas_v1_ejecutada_fecha');
        localStorage.removeItem('acopio_correccion_perdidas_v1_ejecutada_resultado');
        break;
      case 'envasesRetroactiva':
        localStorage.removeItem('correccion_envases_retroactiva_v4');
        break;
      case 'segregacionEnvases':
        localStorage.removeItem('correccion_segregacion_envases_ejecutada_v1');
        break;
      case 'cuentaCorriente':
        localStorage.removeItem('correccion_cuenta_corriente_completa_v2');
        break;
      case 'preciosSalidas':
        localStorage.removeItem('correccion_precios_salidas_v1');
        break;
      case 'correccionSaldosEnvases':
        localStorage.removeItem('correccion_saldos_envases_v1');
        break;
    }
  };

  resetFlags();

  switch(tipo) {
    case 'autoRetroactiva': {
      const [resultadoPerdidas, resultadoEnvases] = await Promise.all([
        correccionRetroactivaPerdidas(base44),
        correccionRetroactivaEnvases(base44)
      ]);
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['salidas'] });
      queryClient.invalidateQueries({ queryKey: ['envases'] });
      const cp = resultadoPerdidas?.corregidos ?? 0;
      const ce = resultadoEnvases?.corregidos ?? 0;
      return { resultadoPerdidas, resultadoEnvases, message: `Pérdidas: ${cp} productos corregidos. Envases: ${ce} corregidos.` };
    }
    case 'envasesRetroactiva': {
      const resultado = await correccionRetroactivaEnvases(base44);
      queryClient.invalidateQueries({ queryKey: ['envases'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['salidas'] });
      const c = resultado?.corregidos ?? 0;
      return { ...resultado, message: `Envases retroactiva: ${c} envases corregidos.` };
    }
    case 'segregacionEnvases': {
      // Esta corrección requiere ejecutar la lógica del hook manualmente
      const [envases, movimientos, salidas] = await Promise.all([
        listAll(base44.entities.Envase, 'tipo'),
        listAll(base44.entities.Movimiento, '-created_date'),
        listAll(base44.entities.SalidaFruta, '-created_date')
      ]);

      const stocksRecalculados = {};
      envases.forEach(env => {
        stocksRecalculados[env.id] = { tipo: env.tipo, ocupados: 0, vacios: 0 };
      });

      const todosLosRegistros = [
        ...movimientos.map(m => ({ ...m, tipo_registro: 'movimiento', fecha: new Date(m.fecha) })),
        ...salidas.map(s => ({ ...s, tipo_registro: 'salida', fecha: new Date(s.fecha) }))
      ].sort((a, b) => a.fecha - b.fecha);

      todosLosRegistros.forEach((registro) => {
        if (registro.tipo_registro === 'movimiento') {
          if (registro.tipo_movimiento === 'Ingreso de Fruta') {
            const cantLlenos = parseInt(registro.cantidad_envases_llenos) || 0;
            if (cantLlenos > 0) {
              const envasesUsados = {};
              registro.pesajes?.forEach(p => {
                if (p.envase_id) {
                  envasesUsados[p.envase_id] = (envasesUsados[p.envase_id] || 0) + (p.cantidad || 1);
                }
              });
              const totalUnidades = Object.values(envasesUsados).reduce((sum, cant) => sum + cant, 0);
              if (totalUnidades > 0) {
                Object.entries(envasesUsados).forEach(([envaseId, unidades]) => {
                  if (stocksRecalculados[envaseId]) {
                    const proporcion = unidades / totalUnidades;
                    const asignados = Math.round(cantLlenos * proporcion);
                    stocksRecalculados[envaseId].ocupados += asignados;
                  }
                });
              }
            }
          } else if (registro.tipo_movimiento === 'Movimiento de Envases') {
            registro.movimiento_envases?.forEach(mv => {
              if (stocksRecalculados[mv.envase_id]) {
                const ingreso = parseInt(mv.cantidad_ingreso) || 0;
                const salida = parseInt(mv.cantidad_salida) || 0;
                stocksRecalculados[mv.envase_id].vacios += ingreso - salida;
              }
            });
          }
        } else if (registro.tipo_registro === 'salida') {
          const cantLlenos = parseInt(registro.cantidad_envases_llenos) || 0;
          if (cantLlenos > 0 && envases[0] && stocksRecalculados[envases[0].id]) {
            stocksRecalculados[envases[0].id].ocupados -= cantLlenos;
          }
        }
      });

      let corregidos = 0;
      for (const envase of envases) {
        const recalculado = stocksRecalculados[envase.id];
        const stockOcupadosActual = parseInt(envase.stock_ocupados) || 0;
        const stockVaciosActual = parseInt(envase.stock_vacios) || 0;
        const nuevoOcupados = Math.max(0, recalculado.ocupados);
        const nuevoVacios = Math.max(0, recalculado.vacios);

        if (stockOcupadosActual !== nuevoOcupados || stockVaciosActual !== nuevoVacios) {
          await base44.entities.Envase.update(envase.id, {
            stock_ocupados: nuevoOcupados,
            stock_vacios: nuevoVacios
          });
          corregidos++;
        }
      }

      queryClient.invalidateQueries(['envases']);
      queryClient.invalidateQueries(['movimientos']);
      queryClient.invalidateQueries(['salidas']);
      return { corregidos, total: envases.length, message: `Segregación: ${corregidos} envases actualizados de ${envases.length} total.` };
    }
    case 'cuentaCorriente': {
      const movimientos = await listAll(base44.entities.Movimiento, '-created_date');
      const salidas = await listAll(base44.entities.SalidaFruta, '-created_date');
      const periodosPrecios = await listAll(base44.entities.PeriodoPrecio, '-created_date');

      const obtenerPrecio = (productoId, fecha, tipoPrecio) =>
        obtenerPrecioVigente(periodosPrecios, productoId, fecha, tipoPrecio);

      let ingresosActualizados = 0;
      let salidasActualizadas = 0;

      // Procesar ingresos (secuencial + throttle + try/catch)
      const ingresosAProcesar = movimientos.filter(
        m => m.tipo_movimiento === 'Ingreso de Fruta' && m.pesajes?.length > 0 && !(m.deuda_total && m.deuda_total > 0)
      );
      for (let i = 0; i < ingresosAProcesar.length; i++) {
        const movimiento = ingresosAProcesar[i];
        try {
          let deudaTotal = 0;
          movimiento.pesajes.forEach(pesaje => {
            const precioCompra = obtenerPrecio(pesaje.producto_id, movimiento.fecha, 'compra');
            deudaTotal += pesaje.peso_neto * precioCompra;
          });
          await base44.entities.Movimiento.update(movimiento.id, {
            deuda_total: deudaTotal,
            estado_pago: movimiento.estado_pago || 'Pendiente',
            monto_pagado: movimiento.monto_pagado || 0
          });
          ingresosActualizados++;
        } catch (err) {
          console.warn(`CuentaCorriente: error actualizando Movimiento ${movimiento.id}:`, err?.message || err);
        }
        await delay(DELAY_PER_OPERATION_MS);
      }

      // Procesar salidas (secuencial + throttle + try/catch)
      const salidasAProcesar = salidas.filter(
        s => s.estado === 'Confirmada' && s.detalles?.length > 0 && !(s.deuda_total && s.deuda_total > 0)
      );
      for (let i = 0; i < salidasAProcesar.length; i++) {
        const salida = salidasAProcesar[i];
        try {
          let deudaTotal = 0;
          salida.detalles.forEach(detalle => {
            const kilosEfectivos = (detalle.kilos_reales || detalle.kilos_salida || 0) - (detalle.descuento_kg || 0);
            const precioVenta = detalle.precio_kg || obtenerPrecio(detalle.producto_id, salida.fecha, 'venta');
            deudaTotal += kilosEfectivos * precioVenta;
          });
          await base44.entities.SalidaFruta.update(salida.id, {
            deuda_total: deudaTotal,
            estado_cobro: salida.estado_cobro || 'Pendiente',
            monto_cobrado: salida.monto_cobrado || 0
          });
          salidasActualizadas++;
        } catch (err) {
          console.warn(`CuentaCorriente: error actualizando SalidaFruta ${salida.id}:`, err?.message || err);
        }
        await delay(DELAY_PER_OPERATION_MS);
      }

      // Crear movimientos de cuenta corriente (secuencial + throttle + try/catch)
      const movimientosCC = await listAll(base44.entities.CuentaCorriente, '-fecha');
      let movimientosCCCreados = 0;

      const ingresosParaCC = movimientos.filter(m => m.tipo_movimiento === 'Ingreso de Fruta' && m.proveedor_id && m.deuda_total > 0);
      for (let i = 0; i < ingresosParaCC.length; i++) {
        const movimiento = ingresosParaCC[i];
        const yaExiste = movimientosCC.some(cc => cc.comprobante_tipo === 'IngresoFruta' && cc.comprobante_id === movimiento.id);
        if (!yaExiste) {
          try {
            await base44.entities.CuentaCorriente.create({
              fecha: movimiento.fecha,
              tipo_movimiento: 'Haber',
              entidad_tipo: 'Proveedor',
              entidad_id: movimiento.proveedor_id,
              entidad_nombre: movimiento.proveedor_nombre,
              monto: movimiento.deuda_total,
              saldo_resultante: 0,
              concepto: `Ingreso de fruta - ${new Date(movimiento.fecha).toLocaleDateString('es-AR')}`,
              comprobante_id: movimiento.id,
              comprobante_tipo: 'IngresoFruta'
            });
            movimientosCCCreados++;
          } catch (err) {
            console.warn(`CuentaCorriente: error creando CC IngresoFruta ${movimiento.id}:`, err?.message || err);
          }
          await delay(DELAY_PER_OPERATION_MS);
        }
      }

      for (const salida of salidas) {
        if (!salida.cliente_id || !salida.deuda_total || salida.deuda_total <= 0) continue;
        const yaExiste = movimientosCC.some(cc => cc.comprobante_tipo === 'SalidaFruta' && cc.comprobante_id === salida.id);
        if (!yaExiste) {
          try {
            await base44.entities.CuentaCorriente.create({
              fecha: salida.fecha,
              tipo_movimiento: 'Haber',
              entidad_tipo: 'Cliente',
              entidad_id: salida.cliente_id,
              entidad_nombre: salida.cliente_nombre,
              monto: salida.deuda_total,
              saldo_resultante: 0,
              concepto: `Salida de fruta - ${salida.numero_remito}`,
              comprobante_id: salida.id,
              comprobante_tipo: 'SalidaFruta'
            });
            movimientosCCCreados++;
          } catch (err) {
            console.warn(`CuentaCorriente: error creando CC SalidaFruta ${salida.id}:`, err?.message || err);
          }
          await delay(DELAY_PER_OPERATION_MS);
        }
      }

      // Recalcular saldos: construir lista plana de updates y procesar en lotes con throttle + try/catch
      const todosLosMovCC = await listAll(base44.entities.CuentaCorriente, '-fecha');
      const porEntidad = {};
      todosLosMovCC.forEach(mov => {
        const key = `${mov.entidad_tipo}-${mov.entidad_id}`;
        if (!porEntidad[key]) porEntidad[key] = [];
        porEntidad[key].push(mov);
      });

      const movimientosAActualizar = [];
      for (const movs of Object.values(porEntidad)) {
        const movsOrdenados = movs.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
        let saldoAcumulado = 0;
        for (const mov of movsOrdenados) {
          const monto = Number(mov.monto) || 0;
          saldoAcumulado += mov.tipo_movimiento === 'Haber' ? monto : -monto;
          movimientosAActualizar.push({ id: mov.id, saldo_resultante: saldoAcumulado });
        }
      }

      for (let i = 0; i < movimientosAActualizar.length; i++) {
        const { id, saldo_resultante } = movimientosAActualizar[i];
        try {
          await base44.entities.CuentaCorriente.update(id, { saldo_resultante });
        } catch (err) {
          console.warn(`CuentaCorriente: error actualizando saldo_resultante ${id}:`, err?.message || err);
        }
        await delay(DELAY_PER_OPERATION_MS);
      }

      queryClient.invalidateQueries(['movimientos']);
      queryClient.invalidateQueries(['salidas']);
      queryClient.invalidateQueries(['cuentacorriente']);
      return {
        ingresosActualizados,
        salidasActualizadas,
        movimientosCCCreados,
        message: `Cuenta Corriente: ${ingresosActualizados} ingresos, ${salidasActualizadas} salidas actualizados. ${movimientosCCCreados} movimientos CC creados. Saldos recalculados.`
      };
    }
    case 'preciosSalidas': {
      const [salidas, periodosPrecios] = await Promise.all([
        listAll(base44.entities.SalidaFruta, '-created_date'),
        listAll(base44.entities.PeriodoPrecio, '-created_date')
      ]);

      // Usar función utilitaria centralizada
      const obtenerPrecio = (productoId, fecha) => 
        obtenerPrecioVigente(periodosPrecios, productoId, fecha, 'venta');

      let salidasActualizadas = 0;
      let movimientosCCActualizados = 0;

      const salidasConfirmadas = salidas.filter(s => s.estado === 'Confirmada');

      for (const salida of salidasConfirmadas) {
        if (!salida.detalles || salida.detalles.length === 0) continue;

        let deudaTotalNueva = 0;
        let necesitaActualizacion = false;
        
        const detallesActualizados = salida.detalles.map(d => {
          const precioVigente = obtenerPrecio(d.producto_id, salida.fecha);
          const kilosEfectivos = (d.kilos_reales || d.kilos_salida) - (d.descuento_kg || 0);
          const deuda = kilosEfectivos * precioVigente;
          deudaTotalNueva += deuda;

          if (d.precio_kg !== precioVigente) {
            necesitaActualizacion = true;
          }

          return { ...d, precio_kg: precioVigente };
        });

        if (necesitaActualizacion || salida.deuda_total !== deudaTotalNueva) {
          await base44.entities.SalidaFruta.update(salida.id, {
            detalles: detallesActualizados,
            deuda_total: deudaTotalNueva
          });
          salidasActualizadas++;

          const movimientosCC = await base44.entities.CuentaCorriente.filter({
            comprobante_tipo: 'SalidaFruta',
            comprobante_id: salida.id
          });

          if (movimientosCC.length > 0) {
            const movCC = movimientosCC[0];
            const diferencia = deudaTotalNueva - (movCC.monto || 0);
            
            if (Math.abs(diferencia) > 0.01) {
              await base44.entities.CuentaCorriente.update(movCC.id, {
                monto: deudaTotalNueva,
                saldo_resultante: (movCC.saldo_resultante || 0) + diferencia
              });
              movimientosCCActualizados++;
            }
          }
        }
      }

      queryClient.invalidateQueries(['salidas']);
      queryClient.invalidateQueries(['cuentacorriente']);
      return {
        salidasActualizadas,
        movimientosCCActualizados,
        message: `Precios en salidas: ${salidasActualizadas} salidas actualizadas, ${movimientosCCActualizados} movimientos CC ajustados.`
      };
    }
    case 'correccionSaldosEnvases': {
      const report = (msg) => { if (typeof onProgress === 'function') onProgress(msg); };

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
        if (mov.tipo_movimiento === 'Movimiento de Envases' && mov.movimiento_envases?.length) {
          for (const e of mov.movimiento_envases) {
            const tipo = e.envase_tipo || (e.envase_id && envaseIdToTipo[e.envase_id]);
            if (!tipo) continue;
            const ing = Number(e.cantidad_ingreso) || 0;
            const sal = Number(e.cantidad_salida) || 0;
            if (mov.proveedor_id) addSaldo('Proveedor', mov.proveedor_id, tipo, ing - sal);
            if (mov.cliente_id) addSaldo('Cliente', mov.cliente_id, tipo, sal - ing);
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
      return {
        actualizados,
        totalProveedores,
        totalClientes,
        message: `Saldos de envases: ${actualizados} entidades actualizadas (${totalProveedores} proveedores, ${totalClientes} clientes).`
      };
    }
    default:
      throw new Error(`Tipo de corrección desconocido: ${tipo}`);
  }
}
