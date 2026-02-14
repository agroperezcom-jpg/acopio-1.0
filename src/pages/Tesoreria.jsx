import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Wallet,
  Landmark,
  PiggyBank,
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
  ArrowRight,
  DollarSign,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DateRangeSelector from '@/components/DateRangeSelector';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';

export default function Tesoreria() {
  const [rango, setRango] = useState(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return { desde: startOfMonth(hoy), hasta: endOfDay(hoy) };
  });
  const { data: cajas = [], isLoading: loadingCajas } = useQuery({
    queryKey: ['cajas'],
    queryFn: () => base44.entities.Caja.list(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: bancos = [], isLoading: loadingBancos } = useQuery({
    queryKey: ['bancos'],
    queryFn: () => base44.entities.Banco.list(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: cheques = [], isLoading: loadingCheques } = useQuery({
    queryKey: ['cheques'],
    queryFn: () => base44.entities.Cheque.list('-fecha_pago', 100),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Cargar TODAS las entidades con saldo_actual (Fuente de la Verdad)
  const { data: proveedores = [], isLoading: loadingProveedores } = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => base44.entities.Proveedor.list('nombre'),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('nombre'),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Movimientos de tesorería del período: KPIs Cobros/Pagos Realizados y lista "Movimientos Recientes"
  const { data: movimientosTesoreriaPeriodo = [] } = useQuery({
    queryKey: ['movimientostesoreria-periodo', rango?.desde?.toISOString?.(), rango?.hasta?.toISOString?.()],
    queryFn: async () => {
      const desde = rango.desde.toISOString();
      const hasta = rango.hasta.toISOString();
      return base44.entities.MovimientoTesoreria.filter(
        { fecha: { $gte: desde, $lte: hasta } },
        '-fecha',
        5000
      );
    },
    enabled: !!rango?.desde && !!rango?.hasta,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const isLoading = loadingCajas || loadingBancos || loadingCheques || loadingProveedores || loadingClientes;

  // KPIs principales - Memoizados para evitar recálculos innecesarios
  const totalCajas = useMemo(() => 
    cajas.reduce((sum, c) => sum + (c.saldo || 0), 0), 
    [cajas]
  );
  
  const totalBancos = useMemo(() => 
    bancos.reduce((sum, b) => sum + (b.saldo || 0), 0), 
    [bancos]
  );
  
  const totalLiquido = useMemo(() => totalCajas + totalBancos, [totalCajas, totalBancos]);

  const chequesEnCartera = useMemo(() => 
    cheques.filter(ch => ch.estado === 'En Cartera'), 
    [cheques]
  );
  
  const totalChequesCartera = useMemo(() => 
    chequesEnCartera.reduce((sum, ch) => sum + (ch.monto || 0), 0), 
    [chequesEnCartera]
  );

  // Alertas - Memoizadas
  const bancosConSaldoBajo = useMemo(() => 
    bancos.filter(b => b.activa && b.saldo < b.saldo_minimo), 
    [bancos]
  );
  
  const chequesProxVencer = useMemo(() => {
    const hoy = new Date();
    return cheques.filter(ch => {
      if (ch.estado !== 'En Cartera' || !ch.fecha_pago) return false;
      const diasRestantes = Math.floor((new Date(ch.fecha_pago) - hoy) / (1000 * 60 * 60 * 24));
      return diasRestantes <= 7 && diasRestantes >= 0;
    });
  }, [cheques]);

  // ═══════════════════════════════════════════════════════════════════
  // DEUDAS DESDE SALDO_ACTUAL (FUENTE DE LA VERDAD)
  // ═══════════════════════════════════════════════════════════════════
  
  // CLIENTES: Deuda total (lo que nos deben) - Lee directamente saldo_actual
  const deudaClientes = useMemo(() => 
    clientes
      .filter(c => (c.saldo_actual || 0) > 0)
      .reduce((sum, c) => sum + (c.saldo_actual || 0), 0),
    [clientes]
  );

  // PROVEEDORES: Deuda total (lo que les debemos) - Lee directamente saldo_actual
  const deudaProveedores = useMemo(() => 
    proveedores
      .filter(p => (p.saldo_actual || 0) > 0)
      .reduce((sum, p) => sum + (p.saldo_actual || 0), 0),
    [proveedores]
  );

  // KPIs del período: Cobros y Pagos realizados (solo movimientos en el rango de fechas)
  const cobrosRealizados = useMemo(
    () =>
      (movimientosTesoreriaPeriodo || [])
        .filter((m) => m.referencia_origen_tipo === 'Cobro')
        .reduce((sum, m) => sum + (Number(m.monto) || 0), 0),
    [movimientosTesoreriaPeriodo]
  );

  const pagosRealizados = useMemo(
    () =>
      (movimientosTesoreriaPeriodo || [])
        .filter((m) => m.referencia_origen_tipo === 'Pago')
        .reduce((sum, m) => sum + (Number(m.monto) || 0), 0),
    [movimientosTesoreriaPeriodo]
  );

  // Movimientos recientes del período seleccionado (últimos 5)
  const movimientosRecientes = useMemo(() => 
    movimientosTesoreriaPeriodo.slice(0, 5),
    [movimientosTesoreriaPeriodo]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Wallet className="h-8 w-8 text-indigo-600" />
            Tesorería Estratégica
          </h1>
          <p className="text-slate-500 mt-1">Panel de control financiero</p>
          <div className="mt-4">
            <DateRangeSelector
              startDate={rango.desde}
              endDate={rango.hasta}
              onChange={({ start, end }) => setRango({ desde: start, hasta: end })}
            />
          </div>
        </div>

        {/* Alertas */}
        {(bancosConSaldoBajo.length > 0 || chequesProxVencer.length > 0) && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-amber-900">Alertas de Tesorería</p>
                  {bancosConSaldoBajo.length > 0 && (
                    <p className="text-sm text-amber-700">
                      • {bancosConSaldoBajo.length} banco(s) con saldo por debajo del mínimo
                    </p>
                  )}
                  {chequesProxVencer.length > 0 && (
                    <p className="text-sm text-amber-700">
                      • {chequesProxVencer.length} cheque(s) próximo(s) a vencer en los próximos 7 días
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Liquidez Total</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    ${totalLiquido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <Wallet className="h-10 w-10 text-indigo-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">En Cajas</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${totalCajas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <PiggyBank className="h-10 w-10 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">En Bancos</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ${totalBancos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <Landmark className="h-10 w-10 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Cheques en Cartera</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ${totalChequesCartera.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <CreditCard className="h-10 w-10 text-purple-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cuentas Corrientes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Deuda Total Clientes</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${deudaClientes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">A cobrar</p>
                </div>
                <TrendingUp className="h-10 w-10 text-red-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Cobros Realizados</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${cobrosRealizados.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">En el período seleccionado</p>
                </div>
                <DollarSign className="h-10 w-10 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Deuda Total Proveedores</p>
                  <p className="text-2xl font-bold text-orange-600">
                    ${deudaProveedores.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">A pagar</p>
                </div>
                <TrendingDown className="h-10 w-10 text-orange-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Pagos Realizados</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ${pagosRealizados.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">En el período seleccionado</p>
                </div>
                <DollarSign className="h-10 w-10 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Distribución de Fondos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Cajas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5 text-green-600" />
                  Cajas
                </span>
                <Link to={createPageUrl('Cajas')}>
                  <Button variant="ghost" size="sm">
                    Ver todas <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cajas.length === 0 ? (
                <p className="text-center text-slate-500 py-4">No hay cajas registradas</p>
              ) : (
                <div className="space-y-3">
                  {cajas.slice(0, 5).map(caja => (
                    <div key={caja.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{caja.nombre}</p>
                        {caja.ubicacion && (
                          <p className="text-sm text-slate-500">{caja.ubicacion}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">
                          ${(caja.saldo || 0).toLocaleString('es-AR')}
                        </p>
                        {!caja.activa && (
                          <Badge variant="outline" className="mt-1">Inactiva</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bancos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-blue-600" />
                  Bancos
                </span>
                <Link to={createPageUrl('Bancos')}>
                  <Button variant="ghost" size="sm">
                    Ver todas <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bancos.length === 0 ? (
                <p className="text-center text-slate-500 py-4">No hay cuentas bancarias registradas</p>
              ) : (
                <div className="space-y-3">
                  {bancos.slice(0, 5).map(banco => (
                    <div key={banco.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{banco.nombre}</p>
                        <p className="text-sm text-slate-500">{banco.numero_cuenta}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${banco.saldo < banco.saldo_minimo ? 'text-red-600' : 'text-blue-600'}`}>
                          ${(banco.saldo || 0).toLocaleString('es-AR')}
                        </p>
                        {banco.saldo < banco.saldo_minimo && (
                          <Badge variant="destructive" className="mt-1">Bajo mínimo</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cheques y Movimientos Recientes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cheques en Cartera */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-purple-600" />
                  Cheques en Cartera
                </span>
                <Link to={createPageUrl('Cheques')}>
                  <Button variant="ghost" size="sm">
                    Ver todos <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chequesEnCartera.length === 0 ? (
                <p className="text-center text-slate-500 py-4">No hay cheques en cartera</p>
              ) : (
                <div className="space-y-3">
                  {chequesEnCartera.slice(0, 5).map(cheque => (
                    <div key={cheque.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">N° {cheque.numero_cheque}</p>
                        <p className="text-sm text-slate-500">
                          Vence: {cheque.fecha_pago ? format(new Date(cheque.fecha_pago), 'dd/MM/yyyy', { locale: es }) : '-'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-purple-600">
                          ${(cheque.monto || 0).toLocaleString('es-AR')}
                        </p>
                        <Badge variant="outline" className="mt-1">{cheque.tipo}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Movimientos Recientes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-teal-600" />
                  Movimientos Recientes
                </span>
                <Link to={createPageUrl('MovimientosTesoreria')}>
                  <Button variant="ghost" size="sm">
                    Ver todos <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movimientosRecientes.length === 0 ? (
                <p className="text-center text-slate-500 py-4">No hay movimientos en el período seleccionado</p>
              ) : (
                <div className="space-y-3">
                  {movimientosRecientes.map(mov => (
                    <div key={mov.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{mov.concepto}</p>
                        <p className="text-xs text-slate-500">
                          {mov.fecha ? format(new Date(mov.fecha), 'dd/MM HH:mm', { locale: es }) : '-'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-teal-600">
                          ${(mov.monto || 0).toLocaleString('es-AR')}
                        </p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {mov.tipo_movimiento}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}