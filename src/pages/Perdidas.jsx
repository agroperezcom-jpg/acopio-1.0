import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingDown, Scale, FileDown } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import DateRangeToolbar from '@/components/DateRangeToolbar';

export default function Perdidas() {
  const [rango, setRango] = useState(null);

  const PAGE_SIZE = 500;

  const { data: salidas = [], isLoading, error } = useQuery({
    queryKey: ['salidas-confirmadas-perdidas', rango?.desde, rango?.hasta],
    queryFn: async () => {
      const desde = rango.desde.toISOString();
      const hasta = rango.hasta.toISOString();
      const filter = {
        estado: 'Confirmada',
        fecha: { $gte: desde, $lte: hasta }
      };

      let allSalidas = [];
      let page = 0;

      while (true) {
        const batch = await base44.entities.SalidaFruta.filter(
          filter,
          '-fecha',
          PAGE_SIZE,
          page * PAGE_SIZE
        );

        allSalidas = [...allSalidas, ...(Array.isArray(batch) ? batch : [batch])];

        if ((Array.isArray(batch) ? batch.length : 0) < PAGE_SIZE) break;

        page++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      return allSalidas;
    },
    enabled: !!rango?.desde && !!rango?.hasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: productos = [] } = useQuery({
    queryKey: ['productos'],
    queryFn: () => base44.entities.Producto.list('fruta', 100),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const salidasConfirmadas = salidas;

  const analisisPerdidas = useMemo(() => {
    let totalPerdidasBascula = 0;
    let totalPerdidasCalidad = 0;
    const perdidasPorProducto = {};
    const detallesPerdidas = [];

    salidasConfirmadas.forEach(salida => {
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
  }, [salidasConfirmadas]);

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
          <p>Salidas confirmadas: ${salidasConfirmadas.length}</p>
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
          {rango && salidasConfirmadas.length > 0 && (
            <Button onClick={exportarPDF} className="bg-red-600 hover:bg-red-700 w-full sm:w-auto">
              <FileDown className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          )}
        </div>

        <DateRangeToolbar
          onRangeChange={({ desde, hasta }) => setRango({ desde, hasta })}
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
        ) : !rango ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <TrendingDown className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Cargando rango de fechas...</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="text-center py-12">Cargando...</div>
        ) : salidasConfirmadas.length === 0 ? (
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
                      <p className="text-xs text-slate-600 mt-1">kg en {salidasConfirmadas.length} salida(s)</p>
                    </div>
                    <AlertTriangle className="h-12 w-12 text-slate-600 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>

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