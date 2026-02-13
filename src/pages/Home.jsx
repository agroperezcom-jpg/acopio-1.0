import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createPageUrl } from '@/utils';
import {
  Apple,
  ArrowLeftRight,
  History,
  FileText,
  Package,
  Scale,
  Boxes,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, startOfDay, endOfDay, addDays, subDays, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Home() {
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() => startOfDay(new Date()));

  const desde = useMemo(() => startOfDay(fechaSeleccionada), [fechaSeleccionada]);
  const hasta = useMemo(() => endOfDay(fechaSeleccionada), [fechaSeleccionada]);

  const { data: movimientos = [] } = useQuery({
    queryKey: ['movimientos-home', desde, hasta],
    queryFn: async () => {
      return base44.entities.Movimiento.filter(
        { fecha: { $gte: desde.toISOString(), $lte: hasta.toISOString() } },
        '-fecha',
        50
      );
    },
    enabled: !!desde && !!hasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: salidas = [] } = useQuery({
    queryKey: ['salidas-home', desde, hasta],
    queryFn: async () => {
      return base44.entities.SalidaFruta.filter(
        { fecha: { $gte: desde.toISOString(), $lte: hasta.toISOString() } },
        '-fecha',
        50
      );
    },
    enabled: !!desde && !!hasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: pagos = [] } = useQuery({
    queryKey: ['pagos-home', desde, hasta],
    queryFn: async () => {
      return base44.entities.Pago.filter(
        { fecha: { $gte: desde.toISOString(), $lte: hasta.toISOString() } },
        '-fecha',
        50
      );
    },
    enabled: !!desde && !!hasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: cobros = [] } = useQuery({
    queryKey: ['cobros-home', desde, hasta],
    queryFn: async () => {
      return base44.entities.Cobro.filter(
        { fecha: { $gte: desde.toISOString(), $lte: hasta.toISOString() } },
        '-fecha',
        50
      );
    },
    enabled: !!desde && !!hasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: movimientosTesoreria = [] } = useQuery({
    queryKey: ['movimientostesoreria-home', desde, hasta],
    queryFn: async () => {
      const todos = await base44.entities.MovimientoTesoreria.filter(
        { fecha: { $gte: desde.toISOString(), $lte: hasta.toISOString() } },
        '-fecha',
        50
      );
      return todos.filter(m => m.referencia_origen_tipo !== 'Pago' && m.referencia_origen_tipo !== 'Cobro');
    },
    enabled: !!desde && !!hasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const actividadDiaria = useMemo(() => {
    const items = [];

    movimientos.forEach(m => {
      const kilos = m.pesajes?.reduce((s, p) => s + (p.peso_neto || 0), 0) || 0;
      const descripcion = m.proveedor_nombre || m.cliente_nombre || 'Sin entidad';
      items.push({
        id: `mov-${m.id}`,
        fecha: m.fecha,
        tipo: m.tipo_movimiento,
        descripcion,
        monto: kilos > 0 ? `${kilos.toFixed(0)} kg` : '-',
        icono: m.tipo_movimiento === 'Ingreso de Fruta' ? Apple : ArrowLeftRight,
        color: m.tipo_movimiento === 'Ingreso de Fruta' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
        origen: 'movimiento'
      });
    });

    salidas.forEach(s => {
      const kilos = s.detalles?.reduce((sum, d) => sum + (d.kilos_salida || 0), 0) || 0;
      items.push({
        id: `sal-${s.id}`,
        fecha: s.fecha,
        tipo: 'Salida de Fruta',
        descripcion: s.cliente_nombre || 'Sin cliente',
        monto: `${kilos.toFixed(0)} kg`,
        icono: ShoppingCart,
        color: 'bg-purple-100 text-purple-700',
        origen: 'salida'
      });
    });

    pagos.forEach(p => {
      const monto = p.monto_total ?? p.monto ?? 0;
      items.push({
        id: `pago-${p.id}`,
        fecha: p.fecha,
        tipo: 'Pago',
        descripcion: p.proveedor_nombre || 'Proveedor',
        monto: `$${Number(monto).toLocaleString('es-AR')}`,
        icono: TrendingDown,
        color: 'bg-red-100 text-red-700',
        origen: 'pago'
      });
    });

    cobros.forEach(c => {
      const monto = c.monto_total ?? c.monto ?? 0;
      items.push({
        id: `cobro-${c.id}`,
        fecha: c.fecha,
        tipo: 'Cobro',
        descripcion: c.cliente_nombre || 'Cliente',
        monto: `$${Number(monto).toLocaleString('es-AR')}`,
        icono: TrendingUp,
        color: 'bg-emerald-100 text-emerald-700',
        origen: 'cobro'
      });
    });

    movimientosTesoreria.forEach(m => {
      const esIngreso = ['Ingreso Manual', 'Crédito Bancario'].includes(m.tipo_movimiento);
      items.push({
        id: `mt-${m.id}`,
        fecha: m.fecha,
        tipo: m.tipo_movimiento || 'Movimiento Tesorería',
        descripcion: m.concepto || m.tipo_movimiento,
        monto: `$${Number(m.monto || 0).toLocaleString('es-AR')}`,
        icono: esIngreso ? Wallet : ArrowRight,
        color: esIngreso ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700',
        origen: 'tesoreria'
      });
    });

    return items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [movimientos, salidas, pagos, cobros, movimientosTesoreria]);

  const irDiaAnterior = () => setFechaSeleccionada(d => subDays(d, 1));
  const irHoy = () => setFechaSeleccionada(startOfDay(new Date()));
  const irDiaSiguiente = () => setFechaSeleccionada(d => addDays(d, 1));

  const etiquetaFecha = isToday(fechaSeleccionada)
    ? 'Hoy'
    : format(fechaSeleccionada, "EEEE d MMM", { locale: es });

  const modulosPrincipales = [
    { nombre: 'Movimiento de Fruta', icon: Apple, page: 'MovimientoFruta', color: 'bg-green-100 text-green-700' },
    { nombre: 'Inventario', icon: Package, page: 'Inventario', color: 'bg-teal-100 text-teal-700' },
    {
      nombre: 'Mov. Envases',
      icon: ArrowLeftRight,
      page: 'MovimientoEnvases',
      color: 'bg-orange-50 text-orange-600',
    },
    { nombre: 'Tesorería', icon: Scale, page: 'Tesoreria', color: 'bg-indigo-100 text-indigo-700' },
    { nombre: 'Informes Contables', icon: FileText, page: 'InformesContables', color: 'bg-blue-100 text-blue-700' },
    { nombre: 'Historial', icon: History, page: 'Historial', color: 'bg-slate-100 text-slate-700' }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 overflow-hidden">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/694c069ad9a3c71a10fee653/2db155312_imagenesdeperfilISO_Mesadetrabajo1.jpg"
              alt="Logo Acopio"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-2">
            Gestión de Acopio
          </h1>
          <p className="text-slate-500 text-lg">
            Sistema de control de frutas y envases
          </p>
        </div>

        {/* Módulos Principales */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Boxes className="h-6 w-6 text-indigo-600" />
            Acceso Rápido a Módulos
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {modulosPrincipales.map((modulo) => (
              <Link key={modulo.page} to={createPageUrl(modulo.page)}>
                <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer h-full">
                  <CardContent className="p-6 flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 ${modulo.color}`}>
                      <modulo.icon className="h-8 w-8" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">{modulo.nombre}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Feed de Actividad Diario */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-slate-400" />
                Actividad del día
              </CardTitle>
              {/* Selector de día */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={irDiaAnterior} aria-label="Día anterior">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <span className="min-w-[140px] text-center font-medium text-slate-700 capitalize px-3 py-1.5 bg-slate-100 rounded-lg">
                  {etiquetaFecha}
                </span>
                <Button variant="outline" size="sm" onClick={irDiaSiguiente} aria-label="Día siguiente">
                  <ChevronRight className="h-5 w-5" />
                </Button>
                {!isToday(fechaSeleccionada) && (
                  <Button variant="ghost" size="sm" onClick={irHoy} className="text-indigo-600">
                    Hoy
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {actividadDiaria.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <p className="text-slate-500">No hay actividad registrada para este día</p>
                <Link
                  to={createPageUrl('Historial')}
                  className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <History className="h-4 w-4" />
                  Ver Historial Completo
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {actividadDiaria.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                      <item.icono className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{item.descripcion}</p>
                      <p className="text-sm text-slate-500">
                        {format(new Date(item.fecha), "HH:mm", { locale: es })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold text-sm ${(item.color.split(' ')[1] || 'text-slate-700')}`}>
                        {item.monto}
                      </span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {item.tipo}
                      </Badge>
                    </div>
                  </div>
                ))}
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <Link
                    to={createPageUrl('Historial')}
                    className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    <History className="h-4 w-4" />
                    Ver Historial Completo
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
