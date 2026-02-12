import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { listAll } from '@/utils/listAllPaginado';
import { listAllPrecios } from '@/utils/listAllPrecios';

export function useCorreccionCuentaCorriente() {
  const [ejecutado, setEjecutado] = useState(false);

  const { data: movimientos = [] } = useQuery({
    queryKey: ['movimientos'],
    queryFn: () => listAll(base44.entities.Movimiento, '-created_date'),
    enabled: true,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: salidas = [] } = useQuery({
    queryKey: ['salidas'],
    queryFn: () => listAll(base44.entities.SalidaFruta, '-created_date'),
    enabled: true,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: periodosPrecios = [] } = useQuery({
    queryKey: ['periodosprecios'],
    queryFn: () => listAllPrecios(base44.entities.PeriodoPrecio, '-created_date'),
    enabled: true,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  useEffect(() => {
    // Verificar localStorage primero
    const STORAGE_KEY = 'correccion_cuenta_corriente_completa_v2';
    const yaEjecutado = localStorage.getItem(STORAGE_KEY);
    if (yaEjecutado) {
      setEjecutado(true);
      return;
    }

    // Esperar a que todos los datos estén disponibles
    if (ejecutado) return;
    if (!movimientos || !salidas || !periodosPrecios) return;
    
    // Ejecutar incluso si no hay precios, para setear estados
    const hayDatos = movimientos.length > 0 || salidas.length > 0;
    if (!hayDatos) return;

    const corregirCuentaCorriente = async () => {
      console.log('\n═══════════════════════════════════════════════════════════════════');
      console.log('🔄 CORRECCIÓN RETROACTIVA - CUENTA CORRIENTE');
      console.log('═══════════════════════════════════════════════════════════════════\n');

      try {
        // Función para obtener precio vigente en una fecha
        const obtenerPrecioVigente = (productoId, fecha, tipoPrecio) => {
          const preciosOrdenados = periodosPrecios
            .filter(pp => pp.producto_id === productoId && pp.activo)
            .sort((a, b) => new Date(b.fecha_desde) - new Date(a.fecha_desde));
          
          const fechaMovimiento = new Date(fecha);
          const precioVigente = preciosOrdenados.find(pp => new Date(pp.fecha_desde) <= fechaMovimiento);
          
          if (precioVigente) {
            return tipoPrecio === 'compra' ? precioVigente.precio_compra_kg : precioVigente.precio_venta_kg;
          }
          
          // Si no hay precio vigente, usar el más reciente
          const precioMasReciente = preciosOrdenados[0];
          return precioMasReciente ? 
            (tipoPrecio === 'compra' ? precioMasReciente.precio_compra_kg : precioMasReciente.precio_venta_kg) : 0;
        };

        let ingresosActualizados = 0;
        let salidasActualizadas = 0;

        // ═══════════════════════════════════════════════════════════════════
        // PROCESAR INGRESOS DE FRUTA (Deudas con proveedores)
        // ═══════════════════════════════════════════════════════════════════
        console.log('📥 Procesando Ingresos de Fruta...\n');
        
        for (const movimiento of movimientos) {
          if (movimiento.tipo_movimiento === 'Ingreso de Fruta' && movimiento.pesajes && movimiento.pesajes.length > 0) {
            // Verificar si ya tiene deuda_total calculada
            if (movimiento.deuda_total && movimiento.deuda_total > 0) {
              console.log(`   ⏭️  ${movimiento.proveedor_nombre}: Ya tiene deuda calculada = $${movimiento.deuda_total.toFixed(2)}\n`);
              continue;
            }

            let deudaTotal = 0;
            
            movimiento.pesajes.forEach(pesaje => {
              const precioCompra = obtenerPrecioVigente(pesaje.producto_id, movimiento.fecha, 'compra');
              const deudaPesaje = pesaje.peso_neto * precioCompra;
              deudaTotal += deudaPesaje;
              
              console.log(`   ${pesaje.producto_nombre}: ${pesaje.peso_neto.toFixed(2)} kg × $${precioCompra.toFixed(2)} = $${deudaPesaje.toFixed(2)}`);
            });

            // Actualizar movimiento con deuda total y estado
            await base44.entities.Movimiento.update(movimiento.id, {
              deuda_total: deudaTotal,
              estado_pago: movimiento.estado_pago || 'Pendiente',
              monto_pagado: movimiento.monto_pagado || 0
            });
            
            console.log(`   ✅ ${movimiento.proveedor_nombre}: Deuda Total = $${deudaTotal.toFixed(2)}\n`);
            ingresosActualizados++;
          }
        }

        // ═══════════════════════════════════════════════════════════════════
        // PROCESAR SALIDAS DE FRUTA (Deudas de clientes)
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n📤 Procesando Salidas de Fruta...\n');
        
        for (const salida of salidas) {
          if (salida.estado === 'Confirmada' && salida.detalles && salida.detalles.length > 0) {
            // Verificar si ya tiene deuda_total calculada
            if (salida.deuda_total && salida.deuda_total > 0) {
              console.log(`   ⏭️  ${salida.cliente_nombre} - ${salida.numero_remito}: Ya tiene deuda calculada = $${salida.deuda_total.toFixed(2)}\n`);
              continue;
            }

            let deudaTotal = 0;
            
            salida.detalles.forEach(detalle => {
              const kilosEfectivos = (detalle.kilos_reales || detalle.kilos_salida || 0) - (detalle.descuento_kg || 0);
              const precioVenta = detalle.precio_kg || obtenerPrecioVigente(detalle.producto_id, salida.fecha, 'venta');
              const deudaDetalle = kilosEfectivos * precioVenta;
              deudaTotal += deudaDetalle;
              
              console.log(`   ${detalle.producto_nombre}: ${kilosEfectivos.toFixed(2)} kg × $${precioVenta.toFixed(2)} = $${deudaDetalle.toFixed(2)}`);
            });

            // Actualizar salida con deuda total y estado
            const updates = {
              deuda_total: deudaTotal,
              estado_cobro: salida.estado_cobro || 'Pendiente',
              monto_cobrado: salida.monto_cobrado || 0
            };

            await base44.entities.SalidaFruta.update(salida.id, updates);
            
            console.log(`   ✅ ${salida.cliente_nombre} - ${salida.numero_remito}: Deuda Total = $${deudaTotal.toFixed(2)}\n`);
            salidasActualizadas++;
          }
        }

        console.log('\n═══════════════════════════════════════════════════════════════════');
        console.log('✅ CORRECCIÓN COMPLETADA');
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log(`   Ingresos actualizados: ${ingresosActualizados}`);
        console.log(`   Salidas actualizadas: ${salidasActualizadas}`);
        console.log('═══════════════════════════════════════════════════════════════════\n');

        // ═══════════════════════════════════════════════════════════════════
        // PASO 2: CREAR MOVIMIENTOS EN CUENTA CORRIENTE RETROACTIVAMENTE
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n🔄 GENERANDO MOVIMIENTOS DE CUENTA CORRIENTE RETROACTIVOS...\n');

        // Obtener movimientos de CC existentes
        const movimientosCC = await listAll(base44.entities.CuentaCorriente, '-fecha');
        let movimientosCCCreados = 0;

        // INGRESOS DE FRUTA → CUENTA CORRIENTE PROVEEDORES
        for (const movimiento of movimientos.filter(m => m.tipo_movimiento === 'Ingreso de Fruta')) {
          if (!movimiento.proveedor_id || !movimiento.deuda_total || movimiento.deuda_total <= 0) continue;

          // Verificar si ya existe un movimiento de CC para este ingreso
          const yaExiste = movimientosCC.some(
            cc => cc.comprobante_tipo === 'IngresoFruta' && cc.comprobante_id === movimiento.id
          );

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
            console.log(`✅ CC Proveedor: ${movimiento.proveedor_nombre} - $${movimiento.deuda_total.toFixed(2)}`);
          }
        }

        // SALIDAS DE FRUTA → CUENTA CORRIENTE CLIENTES
        for (const salida of salidas) {
          if (!salida.cliente_id || !salida.deuda_total || salida.deuda_total <= 0) continue;

          // Verificar si ya existe un movimiento de CC para esta salida
          const yaExiste = movimientosCC.some(
            cc => cc.comprobante_tipo === 'SalidaFruta' && cc.comprobante_id === salida.id
          );

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
            console.log(`✅ CC Cliente: ${salida.cliente_nombre} - $${salida.deuda_total.toFixed(2)}`);
          }
        }

        console.log(`\n📊 Movimientos de CC creados: ${movimientosCCCreados}`);

        // ═══════════════════════════════════════════════════════════════════
        // PASO 3: RECALCULAR SALDOS RESULTANTES EN ORDEN CRONOLÓGICO
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n🧮 RECALCULANDO SALDOS RESULTANTES...\n');

        const todosLosMovCC = await listAll(base44.entities.CuentaCorriente, '-fecha');
        
        // Agrupar por entidad (proveedor o cliente)
        const porEntidad = {};
        todosLosMovCC.forEach(mov => {
          const key = `${mov.entidad_tipo}-${mov.entidad_id}`;
          if (!porEntidad[key]) {
            porEntidad[key] = [];
          }
          porEntidad[key].push(mov);
        });

        // Recalcular saldos para cada entidad
        for (const [key, movs] of Object.entries(porEntidad)) {
          // Ordenar por fecha
          const movsOrdenados = movs.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
          
          let saldoAcumulado = 0;
          for (const mov of movsOrdenados) {
            if (mov.tipo_movimiento === 'Haber') {
              saldoAcumulado += mov.monto;
            } else {
              saldoAcumulado -= mov.monto;
            }
            
            await base44.entities.CuentaCorriente.update(mov.id, {
              saldo_resultante: saldoAcumulado
            });
          }
          
          console.log(`✅ ${key}: Saldo final = $${saldoAcumulado.toFixed(2)}`);
        }

        console.log('═══════════════════════════════════════════════════════════════════\n');

        // Guardar en localStorage
        localStorage.setItem('correccion_cuenta_corriente_completa_v2', JSON.stringify({
          fecha: new Date().toISOString(),
          ingresosActualizados,
          salidasActualizadas,
          movimientosCCCreados
        }));

        setEjecutado(true);
      } catch (error) {
        console.error('❌ Error en corrección de cuenta corriente:', error);
      }
    };

    corregirCuentaCorriente();
  }, [movimientos, salidas, periodosPrecios, ejecutado]);

  return ejecutado;
}