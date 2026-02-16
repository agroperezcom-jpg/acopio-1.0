import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfMonth, endOfMonth } from 'date-fns';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Wallet, ChevronLeft, ChevronRight, Loader2, Eye, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import MonthNavigator from '@/components/MonthNavigator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { recalcularSaldoEntidad } from '@/services/ContabilidadService';

const PAGE_SIZE = 20;
const CONCURRENCY_HEALING = 3;

/** Ejecuta tareas con concurrencia limitada. */
async function runWithConcurrency(items, concurrency, fn) {
  const executing = new Set();
  for (const item of items) {
    const promise = Promise.resolve().then(() => fn(item));
    executing.add(promise);
    promise.finally(() => executing.delete(promise));
    if (executing.size >= concurrency) await Promise.race(executing);
  }
  await Promise.all(executing);
}

const COMPROBANTE_LABEL = {
  IngresoFruta: 'Ingreso Fruta',
  SalidaFruta: 'Salida Fruta',
  Cobro: 'Cobro',
  Pago: 'Pago',
  Retencion: 'Retención',
};

function DetalleCuentaEntidad({ entidadId, entidadTipo, entidadNombre, onVolver }) {
  const [pagina, setPagina] = useState(1);
  const skip = (pagina - 1) * PAGE_SIZE;

  const { data: movimientos = [], isLoading } = useQuery({
    queryKey: ['cuentacorriente-detalle', entidadTipo, entidadId, pagina],
    queryFn: () =>
      base44.entities.CuentaCorriente.filter(
        { entidad_id: entidadId, entidad_tipo: entidadTipo },
        'fecha',
        PAGE_SIZE,
        skip
      ),
    enabled: !!entidadId && !!entidadTipo,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const lista = Array.isArray(movimientos) ? movimientos : [];
  const hasMore = lista.length === PAGE_SIZE;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onVolver} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <h2 className="text-lg font-semibold text-slate-800">
          {entidadNombre} <span className="text-slate-500 font-normal">({entidadTipo})</span>
        </h2>
      </div>

      {isLoading && lista.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-slate-500">
          No hay movimientos en cuenta corriente
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Comprobante</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Debe</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Haber</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Saldo Parcial</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((mov) => {
                  const monto = Number(mov.monto) || 0;
                  const esDebe = mov.tipo_movimiento === 'Debe';
                  const esHaber = mov.tipo_movimiento === 'Haber';
                  const saldoResultante = mov.saldo_resultante != null ? Number(mov.saldo_resultante) : null;
                  const comprobante = mov.comprobante_tipo ? (COMPROBANTE_LABEL[mov.comprobante_tipo] || mov.comprobante_tipo) : '—';
                  return (
                    <tr key={mov.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-4 text-slate-700">
                        {mov.fecha ? format(new Date(mov.fecha), "dd/MM/yyyy HH:mm", { locale: es }) : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{comprobante}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800">
                        {esDebe ? monto.toFixed(2) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800">
                        {esHaber ? monto.toFixed(2) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-800">
                        {saldoResultante != null ? saldoResultante.toFixed(2) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(pagina > 1 || hasMore) && (
            <div className="flex items-center justify-center gap-4 py-4 px-4 border-t border-slate-100 bg-slate-50/50">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1 || isLoading}
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
                disabled={!hasMore || isLoading}
                onClick={() => setPagina((p) => p + 1)}
                className="gap-1.5"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ListaCuentasActivas({ onVerDetalle, saldosActualizados, setSaldosActualizados }) {
  const [pagina, setPagina] = useState(1);
  const skip = (pagina - 1) * PAGE_SIZE;
  const healingAbortedRef = useRef(false);

  /** Carga amplia: todas las entidades (sin filtrar por saldo != 0) para que el recálculo pueda corregir. */
  const { data: proveedores = [], isLoading: loadingProv } = useQuery({
    queryKey: ['proveedores-cuentacorriente', pagina],
    queryFn: () => base44.entities.Proveedor.list('nombre', PAGE_SIZE, skip),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: clientes = [], isLoading: loadingCli } = useQuery({
    queryKey: ['clientes-cuentacorriente', pagina],
    queryFn: () => base44.entities.Cliente.list('nombre', PAGE_SIZE, skip),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const filas = useMemo(() => {
    const prov = (Array.isArray(proveedores) ? proveedores : []).map((p) => {
      const id = `Proveedor-${p.id}`;
      const saldo = setSaldosActualizados && saldosActualizados[id] !== undefined
        ? saldosActualizados[id]
        : (Number(p.saldo_actual) || 0);
      return {
        id,
        entidadId: p.id,
        entidadTipo: 'Proveedor',
        nombre: p.nombre,
        tipo: 'Proveedor',
        telefono: p.telefono || p.whatsapp || '',
        saldo,
      };
    });
    const cli = (Array.isArray(clientes) ? clientes : []).map((c) => {
      const id = `Cliente-${c.id}`;
      const saldo = setSaldosActualizados && saldosActualizados[id] !== undefined
        ? saldosActualizados[id]
        : (Number(c.saldo_actual) || 0);
      return {
        id,
        entidadId: c.id,
        entidadTipo: 'Cliente',
        nombre: c.nombre,
        tipo: 'Cliente',
        telefono: c.telefono || c.whatsapp || '',
        saldo,
      };
    });
    return [...prov, ...cli].sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
  }, [proveedores, clientes, saldosActualizados]);

  const healingItems = useMemo(() => {
    const prov = (Array.isArray(proveedores) ? proveedores : []).map((p) => ({
      entidadTipo: 'Proveedor',
      entidadId: p.id,
      _key: `Proveedor-${p.id}`,
    }));
    const cli = (Array.isArray(clientes) ? clientes : []).map((c) => ({
      entidadTipo: 'Cliente',
      entidadId: c.id,
      _key: `Cliente-${c.id}`,
    }));
    return [...prov, ...cli];
  }, [proveedores, clientes, pagina]);

  /** Autocuración: recalcula saldo por entidad. No incluir saldosActualizados en deps (se actualiza dentro → bucle infinito). */
  useEffect(() => {
    if (healingItems.length === 0 || !setSaldosActualizados) return;
    healingAbortedRef.current = false;
    runWithConcurrency(healingItems, CONCURRENCY_HEALING, async ({ entidadTipo, entidadId, _key }) => {
      if (healingAbortedRef.current) return;
      try {
        const nuevoSaldo = await recalcularSaldoEntidad(entidadTipo, entidadId);
        if (healingAbortedRef.current) return;
        setSaldosActualizados((prev) => {
          const actual = prev[_key];
          if (actual !== undefined && Math.round(actual * 100) / 100 === Math.round(nuevoSaldo * 100) / 100) return prev;
          return { ...prev, [_key]: nuevoSaldo };
        });
      } catch (err) {
        console.warn('[CuentaCorriente] Error recalculando saldo:', _key, err?.message);
      }
    });
    return () => { healingAbortedRef.current = true; };
  }, [healingItems, setSaldosActualizados]);

  const hasMoreProv = (Array.isArray(proveedores) ? proveedores : []).length === PAGE_SIZE;
  const hasMoreCli = (Array.isArray(clientes) ? clientes : []).length === PAGE_SIZE;
  const hasMore = hasMoreProv || hasMoreCli;
  const isLoading = loadingProv || loadingCli;

  const handleVerDetalle = (fila) => {
    onVerDetalle?.({ entidadId: fila.entidadId, entidadTipo: fila.entidadTipo, entidadNombre: fila.nombre });
  };

  if (isLoading && filas.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (filas.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-slate-500">
        No hay proveedores ni clientes en esta página
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left py-3 px-4 font-medium text-slate-700">Entidad</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Tipo</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Teléfono</th>
              <th className="text-right py-3 px-4 font-medium text-slate-700">Saldo Actual</th>
              <th className="w-[100px]" />
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="py-3 px-4 font-medium text-slate-800">{fila.nombre}</td>
                <td className="py-3 px-4">
                  <Badge variant="outline" className={fila.tipo === 'Proveedor' ? 'border-amber-300 text-amber-700' : 'border-purple-300 text-purple-700'}>
                    {fila.tipo}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-slate-600">{fila.telefono || '—'}</td>
                <td className="py-3 px-4 text-right font-semibold">
                  <span className={fila.saldo > 0 ? 'text-red-600' : 'text-green-600'}>
                    {fila.saldo > 0 ? '+' : ''}{fila.saldo.toFixed(2)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVerDetalle(fila)}
                    className="gap-1.5"
                  >
                    <Eye className="h-4 w-4" />
                    Ver Detalle
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(pagina > 1 || hasMore) && (
        <div className="flex items-center justify-center gap-4 py-4 px-4 border-t border-slate-100 bg-slate-50/50">
          <Button
            variant="outline"
            size="sm"
            disabled={pagina <= 1 || isLoading}
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
            disabled={!hasMore || isLoading}
            onClick={() => setPagina((p) => p + 1)}
            className="gap-1.5"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function ListaCuentasCero({ onVerDetalle, saldosActualizados, setSaldosActualizados }) {
  const [fechaVisual, setFechaVisual] = useState(new Date());
  const [pagina, setPagina] = useState(1);
  const skip = (pagina - 1) * PAGE_SIZE;
  const healingAbortedRef = useRef(false);

  const fechaDesde = startOfMonth(fechaVisual);
  const fechaHasta = endOfMonth(fechaVisual);
  const desdeISO = fechaDesde.toISOString();
  const hastaISO = fechaHasta.toISOString();

  /** Lista amplia: entidades con saldo_actual 0 (opcionalmente filtradas por fecha de actualización). */
  const filtroSaldoCero = useMemo(
    () => ({
      saldo_actual: 0,
      $or: [
        { updated_at: { $gte: desdeISO, $lte: hastaISO } },
        { updated_date: { $gte: desdeISO, $lte: hastaISO } },
      ],
    }),
    [desdeISO, hastaISO]
  );

  useEffect(() => setPagina(1), [fechaVisual]);

  const { data: proveedores = [], isLoading: loadingProv } = useQuery({
    queryKey: ['proveedores-saldo-cero', fechaVisual, pagina],
    queryFn: () =>
      base44.entities.Proveedor.filter(filtroSaldoCero, 'nombre', PAGE_SIZE, skip),
    enabled: !!desdeISO && !!hastaISO,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: clientes = [], isLoading: loadingCli } = useQuery({
    queryKey: ['clientes-saldo-cero', fechaVisual, pagina],
    queryFn: () =>
      base44.entities.Cliente.filter(filtroSaldoCero, 'nombre', PAGE_SIZE, skip),
    enabled: !!desdeISO && !!hastaISO,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const filas = useMemo(() => {
    const prov = (Array.isArray(proveedores) ? proveedores : []).map((p) => {
      const id = `Proveedor-${p.id}`;
      const saldo = setSaldosActualizados && saldosActualizados[id] !== undefined
        ? saldosActualizados[id]
        : 0;
      return {
        id,
        entidadId: p.id,
        entidadTipo: 'Proveedor',
        nombre: p.nombre,
        tipo: 'Proveedor',
        telefono: p.telefono || p.whatsapp || '',
        saldo,
      };
    });
    const cli = (Array.isArray(clientes) ? clientes : []).map((c) => {
      const id = `Cliente-${c.id}`;
      const saldo = setSaldosActualizados && saldosActualizados[id] !== undefined
        ? saldosActualizados[id]
        : 0;
      return {
        id,
        entidadId: c.id,
        entidadTipo: 'Cliente',
        nombre: c.nombre,
        tipo: 'Cliente',
        telefono: c.telefono || c.whatsapp || '',
        saldo,
      };
    });
    return [...prov, ...cli].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [proveedores, clientes, saldosActualizados]);

  const healingItems = useMemo(() => {
    const prov = (Array.isArray(proveedores) ? proveedores : []).map((p) => ({
      entidadTipo: 'Proveedor',
      entidadId: p.id,
      _key: `Proveedor-${p.id}`,
    }));
    const cli = (Array.isArray(clientes) ? clientes : []).map((c) => ({
      entidadTipo: 'Cliente',
      entidadId: c.id,
      _key: `Cliente-${c.id}`,
    }));
    return [...prov, ...cli];
  }, [proveedores, clientes, pagina, fechaVisual]);

  /** Autocuración: recalcula saldo por entidad. No incluir saldosActualizados en deps (se actualiza dentro → bucle infinito). */
  useEffect(() => {
    if (healingItems.length === 0 || !setSaldosActualizados) return;
    healingAbortedRef.current = false;
    runWithConcurrency(healingItems, CONCURRENCY_HEALING, async ({ entidadTipo, entidadId, _key }) => {
      if (healingAbortedRef.current) return;
      try {
        const nuevoSaldo = await recalcularSaldoEntidad(entidadTipo, entidadId);
        if (healingAbortedRef.current) return;
        setSaldosActualizados((prev) => {
          const actual = prev[_key];
          if (actual !== undefined && Math.round(actual * 100) / 100 === Math.round(nuevoSaldo * 100) / 100) return prev;
          return { ...prev, [_key]: nuevoSaldo };
        });
      } catch (err) {
        console.warn('[CuentaCorriente] Error recalculando saldo:', _key, err?.message);
      }
    });
    return () => { healingAbortedRef.current = true; };
  }, [healingItems, setSaldosActualizados]);

  const hasMoreProv = (Array.isArray(proveedores) ? proveedores : []).length === PAGE_SIZE;
  const hasMoreCli = (Array.isArray(clientes) ? clientes : []).length === PAGE_SIZE;
  const hasMore = hasMoreProv || hasMoreCli;
  const isLoading = loadingProv || loadingCli;

  const handleVerDetalle = (fila) => {
    onVerDetalle?.({ entidadId: fila.entidadId, entidadTipo: fila.entidadTipo, entidadNombre: fila.nombre });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <MonthNavigator
          currentDate={fechaVisual}
          onMonthChange={setFechaVisual}
        />
      </div>

      {isLoading && filas.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : filas.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-slate-500">
          No hay cuentas con saldo cero actualizadas en este mes
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Entidad</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Teléfono</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Saldo</th>
                  <th className="w-[100px]" />
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-medium text-slate-800">{fila.nombre}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className={fila.tipo === 'Proveedor' ? 'border-amber-300 text-amber-700' : 'border-purple-300 text-purple-700'}>
                        {fila.tipo}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{fila.telefono || '—'}</td>
                    <td className="py-3 px-4 text-right font-semibold">
                      <span className={fila.saldo !== 0 ? (fila.saldo > 0 ? 'text-red-600' : 'text-green-600') : 'text-slate-600'}>
                        {fila.saldo !== 0 ? `${fila.saldo > 0 ? '+' : ''}${Number(fila.saldo).toFixed(2)}` : '0.00'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerDetalle(fila)}
                        className="gap-1.5"
                      >
                        <Eye className="h-4 w-4" />
                        Ver Detalle
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(pagina > 1 || hasMore) && (
            <div className="flex items-center justify-center gap-4 py-4 px-4 border-t border-slate-100 bg-slate-50/50">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1 || isLoading}
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
                disabled={!hasMore || isLoading}
                onClick={() => setPagina((p) => p + 1)}
                className="gap-1.5"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CuentaCorriente() {
  const [activeTab, setActiveTab] = useState('con_saldo');
  const [selectedEntity, setSelectedEntity] = useState(null);
  /** Saldos recalculados en tiempo real por el efecto sanador; clave = "Proveedor-id" | "Cliente-id". */
  const [saldosActualizados, setSaldosActualizados] = useState({});

  const handleVerDetalle = (entidad) => {
    setSelectedEntity(entidad);
  };

  const handleVolver = () => {
    setSelectedEntity(null);
  };

  if (selectedEntity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-8">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 md:h-6 md:w-6 text-slate-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-800 break-words">
                Cuenta Corriente
              </h1>
              <p className="text-slate-500 text-xs md:text-sm">
                Detalle de cuenta
              </p>
            </div>
          </div>
          <DetalleCuentaEntidad
            entidadId={selectedEntity.entidadId}
            entidadTipo={selectedEntity.entidadTipo}
            entidadNombre={selectedEntity.entidadNombre}
            onVolver={handleVolver}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-8">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 md:h-6 md:w-6 text-slate-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-800 break-words">
              Cuenta Corriente
            </h1>
            <p className="text-slate-500 text-xs md:text-sm">
              Cuentas con deuda e histórico en cero
            </p>
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('con_saldo')}
            className={cn(
              'flex-1 sm:flex-none px-4 py-3 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'con_saldo'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            Cuentas con Deuda
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('saldo_cero')}
            className={cn(
              'flex-1 sm:flex-none px-4 py-3 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'saldo_cero'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            Histórico / Saldos en Cero
          </button>
        </div>

        {/* Contenido según pestaña */}
        {activeTab === 'con_saldo' && (
          <ListaCuentasActivas
            onVerDetalle={handleVerDetalle}
            saldosActualizados={saldosActualizados}
            setSaldosActualizados={setSaldosActualizados}
          />
        )}
        {activeTab === 'saldo_cero' && (
          <ListaCuentasCero
            onVerDetalle={handleVerDetalle}
            saldosActualizados={saldosActualizados}
            setSaldosActualizados={setSaldosActualizados}
          />
        )}
      </div>
    </div>
  );
}
