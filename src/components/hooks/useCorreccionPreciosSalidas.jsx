import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { listAll } from '@/utils/listAllPaginado';
import { listAllPrecios } from '@/utils/listAllPrecios';

export function useCorreccionPreciosSalidas() {
  const [ejecutado, setEjecutado] = useState(false);

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
    const STORAGE_KEY = 'correccion_precios_salidas_v1';
    const yaEjecutado = localStorage.getItem(STORAGE_KEY);
    if (yaEjecutado) {
      setEjecutado(true);
      return;
    }

    if (ejecutado) return;
    if (!salidas || salidas.length === 0 || !periodosPrecios) return;

    const corregirPreciosSalidas = async () => {
      try {
        const obtenerPrecioVigente = (productoId, fecha) => {
          const preciosOrdenados = periodosPrecios
            .filter(pp => pp.producto_id === productoId && pp.activo)
            .sort((a, b) => new Date(b.fecha_desde) - new Date(a.fecha_desde));
          
          const fechaSalida = new Date(fecha);
          const precioVigente = preciosOrdenados.find(pp => {
            const desde = new Date(pp.fecha_desde);
            const hasta = pp.fecha_hasta ? new Date(pp.fecha_hasta) : new Date('2099-12-31');
            return fechaSalida >= desde && fechaSalida <= hasta;
          });
          
          return precioVigente?.precio_venta_kg || 0;
        };

        let salidasActualizadas = 0;
        let movimientosCCActualizados = 0;

        // Procesar solo salidas confirmadas
        const salidasConfirmadas = salidas.filter(s => s.estado === 'Confirmada');

        for (const salida of salidasConfirmadas) {
          if (!salida.detalles || salida.detalles.length === 0) continue;

          let deudaTotalNueva = 0;
          let necesitaActualizacion = false;
          
          const detallesActualizados = salida.detalles.map(d => {
            const precioVigente = obtenerPrecioVigente(d.producto_id, salida.fecha);
            const kilosEfectivos = (d.kilos_reales || d.kilos_salida) - (d.descuento_kg || 0);
            const deuda = kilosEfectivos * precioVigente;
            deudaTotalNueva += deuda;

            if (d.precio_kg !== precioVigente) necesitaActualizacion = true;

            return {
              ...d,
              precio_kg: precioVigente
            };
          });

          if (necesitaActualizacion || salida.deuda_total !== deudaTotalNueva) {
            // Actualizar salida con nuevos precios y deuda
            await base44.entities.SalidaFruta.update(salida.id, {
              detalles: detallesActualizados,
              deuda_total: deudaTotalNueva
            });
            salidasActualizadas++;

            // Actualizar movimiento de cuenta corriente si existe
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

        // ELIMINAR DUPLICADOS Y RECALCULAR SALDOS
        const todosLosMovCC = await listAll(base44.entities.CuentaCorriente, '-fecha');
        
        // Detectar y eliminar duplicados (mismo comprobante_id + comprobante_tipo)
        const movimientosUnicos = new Map();
        const duplicadosAEliminar = [];

        for (const mov of todosLosMovCC) {
          if (mov.comprobante_id && mov.comprobante_tipo === 'SalidaFruta') {
            const key = `${mov.comprobante_tipo}-${mov.comprobante_id}`;
            if (movimientosUnicos.has(key)) {
              duplicadosAEliminar.push(mov.id);
            } else {
              movimientosUnicos.set(key, mov);
            }
          } else {
            // Movimientos sin comprobante o de otro tipo, conservar
            movimientosUnicos.set(mov.id, mov);
          }
        }

        for (const id of duplicadosAEliminar) {
          await base44.entities.CuentaCorriente.delete(id);
        }

        const movimientosLimpios = await listAll(base44.entities.CuentaCorriente, '-fecha');
        const porCliente = {};
        movimientosLimpios.forEach(mov => {
          if (mov.entidad_tipo === 'Cliente') {
            const key = mov.entidad_id;
            if (!porCliente[key]) {
              porCliente[key] = [];
            }
            porCliente[key].push(mov);
          }
        });

        for (const [clienteId, movs] of Object.entries(porCliente)) {
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
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          fecha: new Date().toISOString(),
          salidasActualizadas,
          movimientosCCActualizados
        }));

        setEjecutado(true);
      } catch (error) {
        console.error('❌ Error en corrección de precios:', error);
      }
    };

    corregirPreciosSalidas();
  }, [salidas, periodosPrecios, ejecutado]);

  return ejecutado;
}