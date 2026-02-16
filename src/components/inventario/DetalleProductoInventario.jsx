import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DateRangeSelector from '@/components/DateRangeSelector';
import { toFixed2, sumaExacta } from '@/components/utils/precisionDecimal';
import { base44 } from '@/api/base44Client';

const PAGE_SIZE = 20;
const TOTALS_LIMIT = 1000;

/**
 * Desglose de stock e historial de movimientos de un producto.
 * Carga datos solo cuando está montado (lazy: al expandir la fila).
 * Props: producto, rangoFechasInicial opcional { desde, hasta }.
 */
export default function DetalleProductoInventario({ producto, rangoFechasInicial }) {
  const [rangoHistorial, setRangoHistorial] = useState(() => {
    if (rangoFechasInicial?.desde && rangoFechasInicial?.hasta) {
      return { desde: rangoFechasInicial.desde, hasta: rangoFechasInicial.hasta };
    }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return { desde: startOfMonth(hoy), hasta: endOfDay(hoy) };
  });

  const [pagina, setPagina] = useState(1);
  const desdeISO = rangoHistorial?.desde?.toISOString?.();
  const hastaISO = rangoHistorial?.hasta?.toISOString?.();
  const skip = (pagina - 1) * PAGE_SIZE;

  useEffect(() => setPagina(1), [desdeISO, hastaISO]);

  // Lista: solo para la tabla, paginada (20 por página)
  const { data: movimientosLista = [], isLoading: loadingListaMov } = useQuery({
    queryKey: ['movimientos-inventario-producto-lista', producto?.id, desdeISO, hastaISO, pagina],
    queryFn: async () => {
      if (!desdeISO || !hastaISO) return [];
      return base44.entities.Movimiento.filter(
        { fecha: { $gte: desdeISO, $lte: hastaISO } },
        '-fecha',
        PAGE_SIZE,
        skip
      );
    },
    enabled: !!producto?.id && !!desdeISO && !!hastaISO,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: salidasLista = [], isLoading: loadingListaSal } = useQuery({
    queryKey: ['salidas-inventario-producto-lista', producto?.id, desdeISO, hastaISO, pagina],
    queryFn: async () => {
      if (!desdeISO || !hastaISO) return [];
      return base44.entities.SalidaFruta.filter(
        { fecha: { $gte: desdeISO, $lte: hastaISO } },
        '-fecha',
        PAGE_SIZE,
        skip
      );
    },
    enabled: !!producto?.id && !!desdeISO && !!hastaISO,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Totales: datos para sumar ingresado/salido en el rango (límite 1000, sin paginación)
  const { data: movimientosTotales = [] } = useQuery({
    queryKey: ['movimientos-inventario-producto-totales', producto?.id, desdeISO, hastaISO],
    queryFn: async () => {
      if (!desdeISO || !hastaISO) return [];
      return base44.entities.Movimiento.filter(
        { fecha: { $gte: desdeISO, $lte: hastaISO } },
        '-fecha',
        TOTALS_LIMIT,
        0
      );
    },
    enabled: !!producto?.id && !!desdeISO && !!hastaISO,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: salidasTotales = [] } = useQuery({
    queryKey: ['salidas-inventario-producto-totales', producto?.id, desdeISO, hastaISO],
    queryFn: async () => {
      if (!desdeISO || !hastaISO) return [];
      return base44.entities.SalidaFruta.filter(
        { fecha: { $gte: desdeISO, $lte: hastaISO } },
        '-fecha',
        TOTALS_LIMIT,
        0
      );
    },
    enabled: !!producto?.id && !!desdeISO && !!hastaISO,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const historico = useMemo(() => {
    if (!producto?.id) return [];
    const historicoList = [];

    (Array.isArray(movimientosLista) ? movimientosLista : []).forEach((mov) => {
      if (mov.tipo_movimiento === 'Ingreso de Fruta' && mov.pesajes) {
        mov.pesajes.forEach((p) => {
          if (p.producto_id === producto.id) {
            historicoList.push({
              fecha: mov.fecha,
              tipo: 'ingreso',
              cantidad: toFixed2(p.peso_neto || 0),
              referencia: `Ingreso - ${mov.proveedor_nombre}`,
              proveedor: mov.proveedor_nombre,
            });
          }
        });
      }
    });

    (Array.isArray(salidasLista) ? salidasLista : []).forEach((sal) => {
      if (sal.detalles) {
        sal.detalles.forEach((d) => {
          if (d.producto_id === producto.id) {
            const kilosOriginalesSalidos = d.kilos_salida;
            historicoList.push({
              fecha: sal.fecha,
              tipo: 'salida',
              cantidad: kilosOriginalesSalidos,
              referencia: `${sal.numero_remito} - ${sal.cliente_nombre}`,
              cliente: sal.cliente_nombre,
              estado: sal.estado,
              kilosReales: sal.estado === 'Confirmada' ? (d.kilos_reales || d.kilos_salida) : null,
              descuentoKg: sal.estado === 'Confirmada' ? (d.descuento_kg || 0) : null,
              kilosEfectivos: sal.estado === 'Confirmada' ? toFixed2((d.kilos_reales || d.kilos_salida) - (d.descuento_kg || 0)) : null,
              perdidaBascula: sal.estado === 'Confirmada' ? toFixed2(d.kilos_salida - (d.kilos_reales || d.kilos_salida)) : 0,
              perdidaCalidad: sal.estado === 'Confirmada' ? toFixed2(d.descuento_kg || 0) : 0,
            });
          }
        });
      }
    });

    return historicoList.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [producto?.id, movimientosLista, salidasLista]);

  const historicoTotales = useMemo(() => {
    if (!producto?.id) return [];
    const list = [];
    (Array.isArray(movimientosTotales) ? movimientosTotales : []).forEach((mov) => {
      if (mov.tipo_movimiento === 'Ingreso de Fruta' && mov.pesajes) {
        mov.pesajes.forEach((p) => {
          if (p.producto_id === producto.id) {
            list.push({ tipo: 'ingreso', cantidad: toFixed2(p.peso_neto || 0) });
          }
        });
      }
    });
    (Array.isArray(salidasTotales) ? salidasTotales : []).forEach((sal) => {
      if (sal.detalles) {
        sal.detalles.forEach((d) => {
          if (d.producto_id === producto.id) {
            list.push({ tipo: 'salida', cantidad: Number(d.kilos_salida) || 0 });
          }
        });
      }
    });
    return list;
  }, [producto?.id, movimientosTotales, salidasTotales]);

  const totalIngresado = useMemo(
    () => toFixed2(sumaExacta(...historicoTotales.filter((m) => m.tipo === 'ingreso').map((m) => m.cantidad))),
    [historicoTotales]
  );
  const totalSalido = useMemo(
    () => toFixed2(sumaExacta(...historicoTotales.filter((m) => m.tipo === 'salida').map((m) => m.cantidad))),
    [historicoTotales]
  );

  const hasMoreMov = (Array.isArray(movimientosLista) ? movimientosLista : []).length === PAGE_SIZE;
  const hasMoreSal = (Array.isArray(salidasLista) ? salidasLista : []).length === PAGE_SIZE;
  const hasMore = hasMoreMov || hasMoreSal;
  const loadingLista = loadingListaMov || loadingListaSal;

  const stock = Number(producto?.stock) ?? 0;
  const stockBajo = producto?.stockBajo ?? stock < 100;

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <h5 className="text-sm font-semibold text-blue-900 mb-2">
          Breakdown de Stock (Kilos Netos)
          {rangoHistorial && (
            <span className="font-normal text-blue-700 ml-1">— en el período seleccionado</span>
          )}
        </h5>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-slate-600">Total Ingresado:</span>
            <span className="ml-2 font-semibold text-green-700">+{totalIngresado} kg</span>
          </div>
          <div>
            <span className="text-slate-600">Total Salido:</span>
            <span className="ml-2 font-semibold text-red-700">-{totalSalido} kg</span>
          </div>
          <div className="col-span-2 pt-2 border-t border-blue-300">
            <span className="text-slate-700 font-semibold">Stock Disponible:</span>
            <span
              className={`ml-2 text-lg font-bold ${
                stock < 0 ? 'text-red-700' : stockBajo ? 'text-orange-600' : 'text-green-700'
              }`}
            >
              {stock.toFixed(2)} kg
            </span>
          </div>
        </div>
      </div>
      <div className="mb-4">
        <p className="text-xs text-slate-500 mb-2">Ver movimientos en este rango:</p>
        <DateRangeSelector
          startDate={rangoHistorial.desde}
          endDate={rangoHistorial.hasta}
          onChange={({ start, end }) => setRangoHistorial({ desde: start, hasta: end })}
          className="flex-wrap"
        />
      </div>
      <h4 className="font-semibold text-slate-700 mb-3">Historial de Movimientos</h4>
      {!rangoHistorial ? (
        <p className="text-sm text-slate-500 py-4">
          Elige un rango de fechas arriba para cargar el historial (ej. Enero 2025).
        </p>
      ) : (
        <>
          {loadingLista && historico.length === 0 ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {historico.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">No hay movimientos de este producto en el período.</p>
              ) : (
                historico.map((mov, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {mov.tipo === 'ingreso' ? (
                          <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-600 mt-0.5" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-800">{mov.referencia}</p>
                          <p className="text-xs text-slate-500">
                            {format(new Date(mov.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </p>
                          {mov.estado === 'Pendiente de Confirmación' && (
                            <span className="text-xs text-amber-600 font-medium">(Pendiente confirmación)</span>
                          )}
                          {mov.estado === 'Confirmada' && mov.kilosEfectivos != null && (
                            <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                              <p>
                                └─ Efectivos cobrados:{' '}
                                <strong className="text-green-700">{mov.kilosEfectivos.toFixed(2)} kg</strong>
                              </p>
                              {(mov.perdidaBascula > 0 || mov.perdidaCalidad > 0) && (
                                <p className="text-red-600">
                                  └─ Pérdidas irreversibles:{' '}
                                  <strong>{(mov.perdidaBascula + mov.perdidaCalidad).toFixed(2)} kg</strong> (no
                                  vuelven al stock)
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-semibold ${mov.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {mov.tipo === 'ingreso' ? '+' : '-'}
                          {mov.cantidad.toFixed(2)} kg
                        </span>
                        {mov.tipo === 'salida' && (
                          <p className="text-xs text-slate-500 mt-0.5">(Originales salidos)</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {(pagina > 1 || hasMore) && !loadingLista && (
            <div className="flex items-center justify-center gap-3 mt-4 py-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1 || loadingLista}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                className="gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm font-medium text-slate-700">Página {pagina}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore || loadingLista}
                onClick={() => setPagina((p) => p + 1)}
                className="gap-1.5"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
