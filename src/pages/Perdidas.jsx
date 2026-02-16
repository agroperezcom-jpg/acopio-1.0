import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, TrendingDown, Scale, FileDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DateRangeSelector from '@/components/DateRangeSelector';
import { base44 } from '@/api/base44Client';

export default function Perdidas() {
  const [rango, setRango] = useState(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return { desde: startOfMonth(hoy), hasta: endOfDay(hoy) };
  });

  const TABLE_PAGE_SIZE = 20;
  const LIMITE_STATS = 10000;

  const desdeISO = rango?.desde ? new Date(rango.desde).toISOString() : null;
  const hastaISO = rango?.hasta ? new Date(rango.hasta).toISOString() : null;
  const filterConfirmadas = useMemo(() => {
    if (!desdeISO || !hastaISO) return null;
    return {
      estado: 'Confirmada',
      fecha: { $gte: desdeISO, $lte: hastaISO }
    };
  }, [desdeISO, hastaISO]);

  // Query exclusiva para estadísticas (KPIs): trae TODAS las salidas del período para sumar correctamente
  const statsQuery = useQuery({
    queryKey: ['salidas-perdidas-stats', desdeISO, hastaISO],
    queryFn: async () => {
      const list = await base44.entities.SalidaFruta.filter(
        filterConfirmadas,
        '-fecha',
        LIMITE_STATS,
        0
      );
      return Array.isArray(list) ? list : [list];
    },
    enabled: !!filterConfirmadas,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });
  const salidasParaTotales = statsQuery.data ?? [];

  // Query para la tabla visual: salidas paginadas (solo la página actual)
  const [paginaTabla, setPaginaTabla] = useState(1);
  const tableQuery = useQuery({
    queryKey: ['salidas-perdidas-tabla', desdeISO, hastaISO, paginaTabla],
    queryFn: async () => {
      const skip = (paginaTabla - 1) * TABLE_PAGE_SIZE;
      return base44.entities.SalidaFruta.filter(
        filterConfirmadas,
        '-fecha',
        TABLE_PAGE_SIZE,
        skip
      );
    },
    enabled: !!filterConfirmadas,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });
  const salidasTabla = tableQuery.data ?? [];

  const isLoading = statsQuery.isLoading;
  const error = statsQuery.error;

  const { data: productos = [] } = useQuery({
    queryKey: ['productos'],
    queryFn: () => base44.entities.Producto.list('fruta', 100),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const analisisPerdidas = useMemo(() => {
    let totalPerdidasBascula = 0;
    let totalPerdidasCalidad = 0;
    const perdidasPorProducto = {};
    const detallesPerdidas = [];
    const salidas = salidasParaTotales ?? [];

    salidas.forEach(salida => {
      salida.detalles?.forEach(detalle => {
        const kilosSalidaOriginal = detalle.kilos_salida || 0;
        const kilosReales = detalle.kilos_reales || kilosSalidaOriginal;
        const descuentoKg = detalle.descuento_kg || 0;

        // Pérdida por diferencia de báscula
        const perdidaBascula = kilosSalidaOriginal - kilosReales;
        totalPerdidasBascula += perdidaBascula;

        // Pérdida por descuento de calidad
        totalPerdidasCalidad += descuentoKg;

        // Agrupar por producto
        if (!perdidasPorProducto[detalle.producto_nombre]) {
          perdidasPorProducto[detalle.producto_nombre] = {
            bascula: 0,
            calidad: 0,
            total: 0,
            salidas: 0
          };
        }
        perdidasPorProducto[detalle.producto_nombre].bascula += perdidaBascula;
        perdidasPorProducto[detalle.producto_nombre].calidad += descuentoKg;
        perdidasPorProducto[detalle.producto_nombre].total += perdidaBascula + descuentoKg;
        perdidasPorProducto[detalle.producto_nombre].salidas += 1;

        // Guardar detalle si hay pérdida
        if (perdidaBascula > 0 || descuentoKg > 0) {
          detallesPerdidas.push({
            fecha: salida.fecha,
            remito: salida.numero_remito,
            cliente: salida.cliente_nombre,
            producto: detalle.producto_nombre,
            kilosOriginal: kilosSalidaOriginal,
            kilosReales: kilosReales,
            perdidaBascula: perdidaBascula,
            descuentoCalidad: descuentoKg,
            motivo: detalle.motivo_ajuste || '-'
          });
        }
      });
    });

    return {
      totalPerdidasBascula,
      totalPerdidasCalidad,
      totalGeneral: totalPerdidasBascula + totalPerdidasCalidad,
      perdidasPorProducto,
      detallesPerdidas: detallesPerdidas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    };
  }, [salidasParaTotales]);

  const exportarPDF = () => {
    const periodoText = rango
      ? `${format(rango.desde, 'dd/MM/yyyy')} - ${format(rango.hasta, 'dd/MM/yyyy')}`
      : 'Sin período';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Informe de Pérdidas</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #dc2626; padding-bottom: 10px; }
          .title { font-size: 20px; font-weight: bold; color: #991b1b; }
          .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0; }
          .summary-card { background: #fee; padding: 15px; border-radius: 8px; text-align: center; border: 2px solid #fca; }
          .summary-card .value { font-size: 24px; font-weight: bold; color: #dc2626; }
          .summary-card .label { font-size: 11px; color: #666; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #fee; font-weight: 600; color: #991b1b; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">INFORME DE PÉRDIDAS</div>
          <p>Período: ${periodoText}</p>
          <p>Salidas confirmadas: ${salidasParaTotales.length}</p>
        </div>

        <div class="summary">
          <div class="summary-card">
            <div class="value">${analisisPerdidas.totalPerdidasBascula.toFixed(2)} kg</div>
            <div class="label">Pérdida por Báscula</div>
          </div>
          <div class="summary-card">
            <div class="value">${analisisPerdidas.totalPerdidasCalidad.toFixed(2)} kg</div>
            <div class="label">Pérdida por Calidad</div>
          </div>
          <div class="summary-card">
            <div class="value">${analisisPerdidas.totalGeneral.toFixed(2)} kg</div>
            <div class="label">Pérdida Total</div>
          </div>
        </div>

        <h3>Pérdidas por Producto</h3>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th class="text-right">Báscula</th>
              <th class="text-right">Calidad</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(analisisPerdidas.perdidasPorProducto).map(([prod, datos]) => `
              <tr>
                <td>${prod}</td>
                <td class="text-right">${datos.bascula.toFixed(2)} kg</td>
                <td class="text-right">${datos.calidad.toFixed(2)} kg</td>
                <td class="text-right"><strong>${datos.total.toFixed(2)} kg</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <p>Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  const productosArray = Object.entries(analisisPerdidas.perdidasPorProducto)
    .map(([nombre, datos]) => ({ nombre, ...datos }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              Análisis de Pérdidas
            </h1>
            <p className="text-slate-600 mt-1">Control de pérdidas en salidas de fruta confirmadas</p>
          </div>
          {rango && salidasParaTotales.length > 0 && (
            <Button onClick={exportarPDF} className="bg-red-600 hover:bg-red-700 w-full sm:w-auto">
              <FileDown className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          )}
        </div>

        <DateRangeSelector
          startDate={rango.desde}
          endDate={rango.hasta}
          onChange={({ start, end }) => setRango({ desde: start, hasta: end })}
          className="mb-4"
        />

        {error ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-16 w-16 text-red-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Error al cargar datos</h3>
              <p className="text-slate-500">No se pudieron cargar las salidas. Intenta recargar la página.</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="text-center py-12">Cargando...</div>
        ) : salidasParaTotales.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <TrendingDown className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin datos</h3>
              <p className="text-slate-500">No hay salidas confirmadas en el período seleccionado</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Resumen General */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-700 font-medium mb-1">Pérdida por Báscula</p>
                      <p className="text-3xl font-bold text-red-800">
                        {analisisPerdidas.totalPerdidasBascula.toFixed(2)}
                      </p>
                      <p className="text-xs text-red-600 mt-1">kg (diferencia envío-recepción)</p>
                    </div>
                    <Scale className="h-12 w-12 text-red-600 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-700 font-medium mb-1">Descuentos por Calidad</p>
                      <p className="text-3xl font-bold text-orange-800">
                        {analisisPerdidas.totalPerdidasCalidad.toFixed(2)}
                      </p>
                      <p className="text-xs text-orange-600 mt-1">kg (clasificación/estado)</p>
                    </div>
                    <TrendingDown className="h-12 w-12 text-orange-600 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-100 to-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-700 font-medium mb-1">Pérdida Total</p>
                      <p className="text-3xl font-bold text-slate-800">
                        {analisisPerdidas.totalGeneral.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">kg en {salidasParaTotales.length} salida(s)</p>
                    </div>
                    <AlertTriangle className="h-12 w-12 text-slate-600 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabla visual: salidas del período (paginada) */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Salidas del período</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Página {paginaTabla} · Los totales de arriba corresponden a todo el período ({salidasParaTotales.length} salida(s))
                </p>
              </CardHeader>
              <CardContent>
                {tableQuery.isLoading ? (
                  <div className="text-center py-8 text-slate-500">Cargando salidas...</div>
                ) : salidasTabla.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No hay salidas en esta página.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left p-2 font-semibold">Fecha</th>
                            <th className="text-left p-2 font-semibold">Remito</th>
                            <th className="text-left p-2 font-semibold">Cliente</th>
                            <th className="text-right p-2 font-semibold">Detalles</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salidasTabla.map((s, idx) => (
                            <tr key={s.id ?? idx} className="border-b hover:bg-slate-50">
                              <td className="p-2">{format(new Date(s.fecha), 'dd/MM/yy HH:mm')}</td>
                              <td className="p-2 font-mono">{s.numero_remito ?? '-'}</td>
                              <td className="p-2">{s.cliente_nombre ?? '-'}</td>
                              <td className="p-2 text-right">{Array.isArray(s.detalles) ? s.detalles.length : 0} ítem(s)</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaginaTabla(p => Math.max(1, p - 1))}
                        disabled={paginaTabla <= 1}
                      >
                        Anterior
                      </Button>
                      <span className="text-sm text-slate-600">Página {paginaTabla}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaginaTabla(p => p + 1)}
                        disabled={salidasTabla.length < TABLE_PAGE_SIZE}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Pérdidas por Producto */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Pérdidas por Producto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 font-semibold">Producto</th>
                        <th className="text-right p-3 font-semibold">Báscula</th>
                        <th className="text-right p-3 font-semibold">Calidad</th>
                        <th className="text-right p-3 font-semibold">Total Pérdida</th>
                        <th className="text-center p-3 font-semibold">Salidas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productosArray.map((prod, idx) => (
                        <tr key={idx} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-medium">{prod.nombre}</td>
                          <td className="p-3 text-right text-red-600">{prod.bascula.toFixed(2)} kg</td>
                          <td className="p-3 text-right text-orange-600">{prod.calidad.toFixed(2)} kg</td>
                          <td className="p-3 text-right font-bold text-slate-800">{prod.total.toFixed(2)} kg</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline">{prod.salidas}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Detalle de Pérdidas */}
            {analisisPerdidas.detallesPerdidas.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Historial de Pérdidas ({analisisPerdidas.detallesPerdidas.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left p-2 font-semibold">Fecha</th>
                          <th className="text-left p-2 font-semibold">Remito</th>
                          <th className="text-left p-2 font-semibold">Cliente</th>
                          <th className="text-left p-2 font-semibold">Producto</th>
                          <th className="text-right p-2 font-semibold">Kg Orig.</th>
                          <th className="text-right p-2 font-semibold">Kg Reales</th>
                          <th className="text-right p-2 font-semibold">Pérd. Báscula</th>
                          <th className="text-right p-2 font-semibold">Desc. Calidad</th>
                          <th className="text-left p-2 font-semibold">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analisisPerdidas.detallesPerdidas.map((detalle, idx) => (
                          <tr key={idx} className="border-b hover:bg-slate-50">
                            <td className="p-2 text-xs">{format(new Date(detalle.fecha), 'dd/MM/yy HH:mm')}</td>
                            <td className="p-2 font-mono text-xs">{detalle.remito}</td>
                            <td className="p-2 text-xs">{detalle.cliente}</td>
                            <td className="p-2">{detalle.producto}</td>
                            <td className="p-2 text-right">{detalle.kilosOriginal.toFixed(2)}</td>
                            <td className="p-2 text-right">{detalle.kilosReales.toFixed(2)}</td>
                            <td className="p-2 text-right text-red-600 font-medium">
                              {detalle.perdidaBascula > 0 ? detalle.perdidaBascula.toFixed(2) : '-'}
                            </td>
                            <td className="p-2 text-right text-orange-600 font-medium">
                              {detalle.descuentoCalidad > 0 ? detalle.descuentoCalidad.toFixed(2) : '-'}
                            </td>
                            <td className="p-2 text-xs italic">{detalle.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}