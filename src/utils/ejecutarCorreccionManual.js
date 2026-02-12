import { correccionRetroactivaPerdidas } from '@/components/utils/correccionRetroactivaPerdidas';
import { correccionRetroactivaEnvases } from '@/components/utils/correccionRetroactivaEnvases';
import { obtenerPrecioVigente } from '@/utils/precioVigente';
import { listAll } from '@/utils/listAllPaginado';

// Función para ejecutar correcciones manualmente
export async function ejecutarCorreccionManual(tipo, base44, queryClient) {
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
      return { resultadoPerdidas, resultadoEnvases };
    }
    case 'envasesRetroactiva': {
      const resultado = await correccionRetroactivaEnvases(base44);
      queryClient.invalidateQueries({ queryKey: ['envases'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['salidas'] });
      return resultado;
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
      return { corregidos, total: envases.length };
    }
    case 'cuentaCorriente': {
      const [movimientos, salidas, periodosPrecios] = await Promise.all([
        listAll(base44.entities.Movimiento, '-created_date'),
        listAll(base44.entities.SalidaFruta, '-created_date'),
        listAll(base44.entities.PeriodoPrecio, '-created_date')
      ]);

      // Usar función utilitaria centralizada
      const obtenerPrecio = (productoId, fecha, tipoPrecio) => 
        obtenerPrecioVigente(periodosPrecios, productoId, fecha, tipoPrecio);

      let ingresosActualizados = 0;
      let salidasActualizadas = 0;

      // Procesar ingresos
      for (const movimiento of movimientos) {
        if (movimiento.tipo_movimiento === 'Ingreso de Fruta' && movimiento.pesajes && movimiento.pesajes.length > 0) {
          if (movimiento.deuda_total && movimiento.deuda_total > 0) continue;

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
        }
      }

      // Procesar salidas
      for (const salida of salidas) {
        if (salida.estado === 'Confirmada' && salida.detalles && salida.detalles.length > 0) {
          if (salida.deuda_total && salida.deuda_total > 0) continue;

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
        }
      }

      // Crear movimientos de cuenta corriente
      const movimientosCC = await listAll(base44.entities.CuentaCorriente, '-fecha');
      let movimientosCCCreados = 0;

      for (const movimiento of movimientos.filter(m => m.tipo_movimiento === 'Ingreso de Fruta')) {
        if (!movimiento.proveedor_id || !movimiento.deuda_total || movimiento.deuda_total <= 0) continue;
        const yaExiste = movimientosCC.some(cc => cc.comprobante_tipo === 'IngresoFruta' && cc.comprobante_id === movimiento.id);
        if (!yaExiste) {
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
        }
      }

      for (const salida of salidas) {
        if (!salida.cliente_id || !salida.deuda_total || salida.deuda_total <= 0) continue;
        const yaExiste = movimientosCC.some(cc => cc.comprobante_tipo === 'SalidaFruta' && cc.comprobante_id === salida.id);
        if (!yaExiste) {
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
        }
      }

      // Recalcular saldos
      const todosLosMovCC = await listAll(base44.entities.CuentaCorriente, '-fecha');
      const porEntidad = {};
      todosLosMovCC.forEach(mov => {
        const key = `${mov.entidad_tipo}-${mov.entidad_id}`;
        if (!porEntidad[key]) porEntidad[key] = [];
        porEntidad[key].push(mov);
      });

      for (const [key, movs] of Object.entries(porEntidad)) {
        const movsOrdenados = movs.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
        let saldoAcumulado = 0;
        for (const mov of movsOrdenados) {
          const monto = Number(mov.monto) || 0;
          saldoAcumulado += mov.tipo_movimiento === 'Haber' ? monto : -monto;
          await base44.entities.CuentaCorriente.update(mov.id, { saldo_resultante: saldoAcumulado });
        }
      }

      queryClient.invalidateQueries(['movimientos']);
      queryClient.invalidateQueries(['salidas']);
      queryClient.invalidateQueries(['cuentacorriente']);
      return { ingresosActualizados, salidasActualizadas, movimientosCCCreados };
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
      return { salidasActualizadas, movimientosCCActualizados };
    }
    default:
      throw new Error(`Tipo de corrección desconocido: ${tipo}`);
  }
}
