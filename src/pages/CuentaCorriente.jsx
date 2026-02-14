import React, { useState, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DateRangeSelector from '@/components/DateRangeSelector';
import { base44 } from '@/api/base44Client';
import { startOfMonth, endOfDay } from 'date-fns';

const PAGE_SIZE_DETALLE = 20;
const ITEMS_POR_PAGINA = 25;

function toFilas(clientes, tipo) {
  return (clientes || []).map((c) => ({
    entidad_tipo: tipo,
    entidad_id: c.id,
    entidad_nombre: c.nombre,
    telefono: c.telefono || c.whatsapp || '',
    saldo_actual: Number(c.saldo_actual) || 0,
    updated_at: c.updated_at || c.updated_date,
  }));
}

export default function CuentaCorriente() {
  const [activeTab, setActiveTab] = useState('con_saldo');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [pageConSaldo, setPageConSaldo] = useState(1);
  const [pageSaldoCero, setPageSaldoCero] = useState(1);
  const [rangoSaldoCero, setRangoSaldoCero] = useState(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return { desde: startOfMonth(hoy), hasta: endOfDay(hoy) };
  });

  // Tab 1: Cuentas con Saldo (saldo_actual !== 0)
  const { data: clientesConSaldo = [], isLoading: loadingClientesSaldo } = useQuery({
    queryKey: ['clientes-con-saldo'],
    queryFn: async () => {
      try {
        const list = await base44.entities.Cliente.filter(
          { saldo_actual: { $ne: 0 } },
          'nombre',
          200,
          0
        );
        return Array.isArray(list) ? list : [];
      } catch {
        const list = await base44.entities.Cliente.list('nombre', 300, 0);
        return (Array.isArray(list) ? list : []).filter((c) => (Number(c.saldo_actual) || 0) !== 0);
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: proveedoresConSaldo = [], isLoading: loadingProveedoresSaldo } = useQuery({
    queryKey: ['proveedores-con-saldo'],
    queryFn: async () => {
      try {
        const list = await base44.entities.Proveedor.filter(
          { saldo_actual: { $ne: 0 } },
          'nombre',
          200,
          0
        );
        return Array.isArray(list) ? list : [];
      } catch {
        const list = await base44.entities.Proveedor.list('nombre', 300, 0);
        return (Array.isArray(list) ? list : []).filter((p) => (Number(p.saldo_actual) || 0) !== 0);
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Tab 2: Saldos en Cero (saldo_actual === 0)
  const { data: clientesSaldoCero = [], isLoading: loadingClientesCero } = useQuery({
    queryKey: ['clientes-saldo-cero'],
    queryFn: async () => {
      try {
        const list = await base44.entities.Cliente.filter({ saldo_actual: 0 }, 'nombre', 500, 0);
        return Array.isArray(list) ? list : [];
      } catch {
        const list = await base44.entities.Cliente.list('nombre', 500, 0);
        return (Array.isArray(list) ? list : []).filter((c) => Math.abs(Number(c.saldo_actual) || 0) < 0.01);
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: proveedoresSaldoCero = [], isLoading: loadingProveedoresCero } = useQuery({
    queryKey: ['proveedores-saldo-cero'],
    queryFn: async () => {
      try {
        const list = await base44.entities.Proveedor.filter({ saldo_actual: 0 }, 'nombre', 500, 0);
        return Array.isArray(list) ? list : [];
      } catch {
        const list = await base44.entities.Proveedor.list('nombre', 500, 0);
        return (Array.isArray(list) ? list : []).filter((p) => Math.abs(Number(p.saldo_actual) || 0) < 0.01);
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const filasConSaldo = useMemo(
    () =>
      [...toFilas(clientesConSaldo, 'Cliente'), ...toFilas(proveedoresConSaldo, 'Proveedor')].sort(
        (a, b) => Math.abs(b.saldo_actual) - Math.abs(a.saldo_actual)
      ),
    [clientesConSaldo, proveedoresConSaldo]
  );

  const filasSaldoCero = useMemo(() => {
    const desde = rangoSaldoCero?.desde ? new Date(rangoSaldoCero.desde).getTime() : null;
    const hasta = rangoSaldoCero?.hasta ? new Date(rangoSaldoCero.hasta).getTime() : null;
    let list = [...toFilas(clientesSaldoCero, 'Cliente'), ...toFilas(proveedoresSaldoCero, 'Proveedor')];
    if (desde != null && hasta != null) {
      list = list.filter((f) => {
        const u = f.updated_at ? new Date(f.updated_at).getTime() : 0;
        return u >= desde && u <= hasta;
      });
    }
    return list.sort((a, b) => (a.entidad_nombre || '').localeCompare(b.entidad_nombre || ''));
  }, [clientesSaldoCero, proveedoresSaldoCero, rangoSaldoCero]);

  const filasConSaldoPaginadas = useMemo(() => {
    const start = (pageConSaldo - 1) * ITEMS_POR_PAGINA;
    return filasConSaldo.slice(start, start + ITEMS_POR_PAGINA);
  }, [filasConSaldo, pageConSaldo]);

  const filasSaldoCeroPaginadas = useMemo(() => {
    const start = (pageSaldoCero - 1) * ITEMS_POR_PAGINA;
    return filasSaldoCero.slice(start, start + ITEMS_POR_PAGINA);
  }, [filasSaldoCero, pageSaldoCero]);

  const totalPaginasConSaldo = Math.ceil(filasConSaldo.length / ITEMS_POR_PAGINA) || 1;
  const totalPaginasSaldoCero = Math.ceil(filasSaldoCero.length / ITEMS_POR_PAGINA) || 1;

  // Detalle: useInfiniteQuery solo cuando hay entidad seleccionada
  const {
    data: detalleCCData,
    fetchNextPage: fetchMoreDetalleCC,
    hasNextPage: hasMoreDetalleCC,
    isFetchingNextPage: loadingMoreDetalleCC,
    isLoading: isLoadingDetalleCC,
  } = useInfiniteQuery({
    queryKey: ['cuentacorriente-detalle', selectedEntity?.entidad_id, selectedEntity?.entidad_tipo],
    queryFn: ({ pageParam = 0 }) =>
      base44.entities.CuentaCorriente.filter(
        {
          entidad_id: selectedEntity.entidad_id,
          entidad_tipo: selectedEntity.entidad_tipo,
        },
        '-fecha',
        PAGE_SIZE_DETALLE,
        pageParam
      ),
    getNextPageParam: (lastPage, allPages) =>
      (lastPage?.length ?? 0) === PAGE_SIZE_DETALLE ? allPages.length * PAGE_SIZE_DETALLE : undefined,
    initialPageParam: 0,
    enabled: !!selectedEntity?.entidad_id && !!selectedEntity?.entidad_tipo,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const movimientosDetalle = useMemo(() => detalleCCData?.pages?.flat() ?? [], [detalleCCData]);

  const verDetalle = (fila) => {
    setSelectedEntity({
      entidad_id: fila.entidad_id,
      entidad_tipo: fila.entidad_tipo,
      entidad_nombre: fila.entidad_nombre,
      deuda_real: fila.saldo_actual,
    });
  };

  // Vista de detalle (solo al hacer clic en Ver Detalle)
  if (selectedEntity) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-6xl mx-auto">
          <Button variant="outline" className="mb-6" onClick={() => setSelectedEntity(null)}>
            ← Volver
          </Button>
          <div className="mb-6 pb-6 border-b border-slate-200">
            <h1 className="text-3xl font-bold text-slate-900">{selectedEntity.entidad_nombre}</h1>
            <p className="text-slate-600 mt-1">
              {selectedEntity.entidad_tipo === 'Cliente' ? 'Cliente' : 'Proveedor'} • Estado de Cuenta
            </p>
            <p className="text-lg font-semibold text-slate-700 mt-2">
              Saldo: ${(selectedEntity.deuda_real ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          {isLoadingDetalleCC ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : movimientosDetalle.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-slate-500">No hay movimientos para esta entidad.</CardContent>
            </Card>
          ) : (
            <>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Fecha</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Tipo</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Comprobante</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Debe</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Haber</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Saldo Parcial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientosDetalle.map((mov) => {
                      const monto = mov.monto ?? 0;
                      const esDebe = mov.tipo_movimiento === 'Debe';
                      const saldoParcial = mov.saldo_resultante ?? '';
                      return (
                        <tr key={mov.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700">
                            {mov.fecha ? format(new Date(mov.fecha), 'dd/MM/yyyy', { locale: es }) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={esDebe ? 'outline' : 'secondary'} className="text-xs">
                              {esDebe ? 'Pago' : 'Ingreso'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{mov.comprobante_tipo ?? '-'}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {esDebe ? `$${Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {!esDebe ? `$${Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {saldoParcial !== '' ? `$${Number(saldoParcial).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {hasMoreDetalleCC && (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" onClick={() => fetchMoreDetalleCC()} disabled={loadingMoreDetalleCC}>
                    {loadingMoreDetalleCC ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Cargar más movimientos
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Vista principal: Tabs
  const loadingConSaldo = loadingClientesSaldo || loadingProveedoresSaldo;
  const loadingCero = loadingClientesCero || loadingProveedoresCero;

  const TablaFilas = ({ filas, loading }) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      );
    }
    if (filas.length === 0) {
      return (
        <Card>
          <CardContent className="p-12 text-center text-slate-500">No hay registros.</CardContent>
        </Card>
      );
    }
    return (
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Nombre</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Teléfono</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Saldo Actual</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={`${fila.entidad_tipo}_${fila.entidad_id}`} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{fila.entidad_nombre}</span>
                    <Badge
                      variant="outline"
                      className={fila.entidad_tipo === 'Cliente' ? 'border-blue-200 text-blue-700 bg-blue-50' : 'border-amber-200 text-amber-700 bg-amber-50'}
                    >
                      {fila.entidad_tipo}
                    </Badge>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{fila.telefono || '-'}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  ${fila.saldo_actual.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" onClick={() => verDetalle(fila)}>
                    Ver Detalle
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 pb-6 border-b border-slate-200">
          <h1 className="text-3xl font-bold text-slate-900">Cuentas Corrientes</h1>
          <p className="text-slate-600 mt-1">Estados de cuenta de clientes y proveedores</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="con_saldo">Cuentas con Saldo</TabsTrigger>
            <TabsTrigger value="cero">Saldos en Cero</TabsTrigger>
          </TabsList>
          <TabsContent value="con_saldo">
            <TablaFilas filas={filasConSaldoPaginadas} loading={loadingConSaldo} />
            {totalPaginasConSaldo > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageConSaldo <= 1}
                  onClick={() => setPageConSaldo((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="text-sm text-slate-600">
                  Página {pageConSaldo} de {totalPaginasConSaldo}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageConSaldo >= totalPaginasConSaldo}
                  onClick={() => setPageConSaldo((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="cero">
            <div className="mb-4">
              <DateRangeSelector
                startDate={rangoSaldoCero.desde}
                endDate={rangoSaldoCero.hasta}
                onChange={({ start, end }) => setRangoSaldoCero({ desde: start, hasta: end })}
                className="border border-slate-100 rounded-lg p-4 bg-slate-50/50"
              />
            </div>
            <TablaFilas filas={filasSaldoCeroPaginadas} loading={loadingCero} />
            {totalPaginasSaldoCero > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageSaldoCero <= 1}
                  onClick={() => setPageSaldoCero((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="text-sm text-slate-600">
                  Página {pageSaldoCero} de {totalPaginasSaldoCero}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageSaldoCero >= totalPaginasSaldoCero}
                  onClick={() => setPageSaldoCero((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
