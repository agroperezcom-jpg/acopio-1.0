import React, { useMemo, useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, AlertTriangle, CheckCircle, User, Users, FileDown, MessageCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { downloadResumenSaldosPDF } from '../components/PDFGenerator';
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { recalcularSaldoEnvasesEntidad } from '@/services/SaldoEnvasesService';

const PAGE_SIZE = 500;
const CONCURRENCY_HEALING = 3;

/**
 * Normaliza entidad.saldo_envases para lectura segura.
 */
function normalizarSaldoEnvases(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw };
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return {};
  } catch {
    try {
      const conDobles = String(raw).replace(/'/g, '"');
      const parsed = JSON.parse(conDobles);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      return {};
    } catch {
      return {};
    }
  }
}

/**
 * Convierte saldo_envases (objeto) a array de { tipo, saldo } (solo saldo !== 0).
 * Si el objeto está vacío, devuelve [] (se muestra como 0).
 */
function saldoEnvasesAArray(saldoObj) {
  if (!saldoObj || typeof saldoObj !== 'object') return [];
  return Object.entries(saldoObj)
    .map(([tipo, saldo]) => ({ tipo: String(tipo), saldo: Number(saldo) || 0 }))
    .filter((e) => e.saldo !== 0);
}

/**
 * Ejecuta una cola de tareas con concurrencia limitada.
 */
async function runWithConcurrency(items, concurrency, fn) {
  const executing = new Set();
  for (const item of items) {
    const promise = Promise.resolve().then(() => fn(item));
    executing.add(promise);
    promise.finally(() => executing.delete(promise));
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

/**
 * Compara dos objetos de saldo (solo claves numéricas) para ver si son iguales.
 */
function saldosIguales(a, b) {
  const keysA = Object.keys(a || {}).sort();
  const keysB = Object.keys(b || {}).sort();
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (Number(a[k]) !== Number(b[k])) return false;
  }
  return true;
}

export default function SaldosEnvases() {
  const [vistaActual, setVistaActual] = useState('saldos');
  const [filtroTipo, setFiltroTipo] = useState('Ambos');
  const [busqueda, setBusqueda] = useState('');
  /** Mapa `${tipo}_${id}` → saldo_envases recalculado (objeto). Se actualiza cuando el "efecto sanador" termina para esa entidad. */
  const [saldosActualizados, setSaldosActualizados] = useState({});
  const healingAbortedRef = useRef(false);

  const { data: proveedores = [], isLoading: loadingProv } = useQuery({
    queryKey: ['proveedores-saldosenvases', busqueda],
    queryFn: async () => {
      if (busqueda.trim()) {
        try {
          const filtered = await base44.entities.Proveedor.filter(
            { nombre: { $regex: busqueda.trim(), $options: 'i' } },
            'nombre',
            PAGE_SIZE
          );
          return Array.isArray(filtered) ? filtered : [filtered];
        } catch {
          const list = await base44.entities.Proveedor.list('nombre', PAGE_SIZE);
          return (Array.isArray(list) ? list : []).filter(p =>
            (p.nombre || '').toLowerCase().includes(busqueda.toLowerCase())
          );
        }
      }
      return base44.entities.Proveedor.list('nombre', PAGE_SIZE);
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: clientes = [], isLoading: loadingCli } = useQuery({
    queryKey: ['clientes-saldosenvases', busqueda],
    queryFn: async () => {
      if (busqueda.trim()) {
        try {
          const filtered = await base44.entities.Cliente.filter(
            { nombre: { $regex: busqueda.trim(), $options: 'i' } },
            'nombre',
            PAGE_SIZE
          );
          return Array.isArray(filtered) ? filtered : [filtered];
        } catch {
          const list = await base44.entities.Cliente.list('nombre', PAGE_SIZE);
          return (Array.isArray(list) ? list : []).filter(c =>
            (c.nombre || '').toLowerCase().includes(busqueda.toLowerCase())
          );
        }
      }
      return base44.entities.Cliente.list('nombre', PAGE_SIZE);
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: envases = [], isLoading: loadingEnv } = useQuery({
    queryKey: ['envases'],
    queryFn: () => base44.entities.Envase.list('tipo', 200),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  /** Lista unificada: todas las entidades a mostrar (proveedores + clientes), con saldo efectivo = saldosActualizados o el de la API. Incluye a todos; saldo 0 se muestra como 0. */
  const entidadesConSaldoEfectivo = useMemo(() => {
    const lista = [];
    const prov = Array.isArray(proveedores) ? proveedores : [];
    const cli = Array.isArray(clientes) ? clientes : [];

    prov.forEach((p) => {
      if (!p || (p.id == null && p.nombre == null)) return;
      const key = `Proveedor_${p.id}`;
      const efectivo = saldosActualizados[key] !== undefined ? saldosActualizados[key] : normalizarSaldoEnvases(p.saldo_envases);
      const envasesArray = saldoEnvasesAArray(efectivo);
      const totalAdeudado = envasesArray.filter((e) => e.saldo > 0).reduce((sum, e) => sum + e.saldo, 0);
      const totalAFavor = envasesArray.filter((e) => e.saldo < 0).reduce((sum, e) => sum + Math.abs(e.saldo), 0);
      lista.push({
        id: p.id,
        nombre: p.nombre || 'Desconocido',
        tipo: 'Proveedor',
        whatsapp: p.whatsapp,
        envases: envasesArray,
        totalAdeudado,
        totalAFavor,
        _key: key,
      });
    });

    cli.forEach((c) => {
      if (!c || (c.id == null && c.nombre == null)) return;
      const key = `Cliente_${c.id}`;
      const efectivo = saldosActualizados[key] !== undefined ? saldosActualizados[key] : normalizarSaldoEnvases(c.saldo_envases);
      const envasesArray = saldoEnvasesAArray(efectivo);
      const totalAdeudado = envasesArray.filter((e) => e.saldo > 0).reduce((sum, e) => sum + e.saldo, 0);
      const totalAFavor = envasesArray.filter((e) => e.saldo < 0).reduce((sum, e) => sum + Math.abs(e.saldo), 0);
      lista.push({
        id: c.id,
        nombre: c.nombre || 'Desconocido',
        tipo: 'Cliente',
        whatsapp: c.whatsapp,
        envases: envasesArray,
        totalAdeudado,
        totalAFavor,
        _key: key,
      });
    });

    return lista.sort((a, b) => (b.totalAdeudado || 0) - (a.totalAdeudado || 0));
  }, [proveedores, clientes, saldosActualizados]);

  /** Entidades visibles según filtro tipo y búsqueda (misma lista que se muestra en la tabla). */
  const entidadesVisibles = useMemo(() => {
    let list = entidadesConSaldoEfectivo;
    if (filtroTipo !== 'Ambos') {
      list = list.filter((e) => e.tipo === filtroTipo);
    }
    return list;
  }, [entidadesConSaldoEfectivo, filtroTipo]);

  /** Cola de entidades para el efecto sanador: solo depende de datos cargados y filtros, no de saldosActualizados. */
  const healingItems = useMemo(() => {
    const list = [];
    const q = (busqueda || '').trim().toLowerCase();
    (Array.isArray(proveedores) ? proveedores : []).forEach((p) => {
      if (!p || p.id == null) return;
      if (filtroTipo === 'Cliente') return;
      if (q && !(p.nombre || '').toLowerCase().includes(q)) return;
      list.push({ tipo: 'Proveedor', id: p.id, _key: `Proveedor_${p.id}` });
    });
    (Array.isArray(clientes) ? clientes : []).forEach((c) => {
      if (!c || c.id == null) return;
      if (filtroTipo === 'Proveedor') return;
      if (q && !(c.nombre || '').toLowerCase().includes(q)) return;
      list.push({ tipo: 'Cliente', id: c.id, _key: `Cliente_${c.id}` });
    });
    return list;
  }, [proveedores, clientes, filtroTipo, busqueda]);

  /** Efecto sanador: al cargar la lista visible, recalcula saldos en segundo plano (máx 3 a la vez) y actualiza la UI si cambian.
   * IMPORTANTE: No incluir saldosActualizados en las deps: se actualiza dentro del efecto y provocaría bucle infinito. */
  useEffect(() => {
    if (healingItems.length === 0) return;

    healingAbortedRef.current = false;

    runWithConcurrency(healingItems, CONCURRENCY_HEALING, async ({ tipo, id, _key }) => {
      if (healingAbortedRef.current) return;
      try {
        const nuevoSaldo = await recalcularSaldoEnvasesEntidad(tipo, id);
        if (healingAbortedRef.current) return;
        setSaldosActualizados((prev) => {
          const actual = prev[_key];
          if (saldosIguales(actual, nuevoSaldo)) return prev;
          return { ...prev, [_key]: nuevoSaldo };
        });
      } catch (err) {
        console.warn('[SaldosEnvases] Error recalculando saldo:', _key, err?.message);
      }
    });

    return () => {
      healingAbortedRef.current = true;
    };
  }, [healingItems]);

  const generarPDFSaldo = (entidad) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Saldo de Envases - ${entidad.nombre}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #dc2626; padding-bottom: 10px; }
          .title { font-size: 20px; font-weight: bold; color: #991b1b; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #fee; font-weight: 600; }
          .total { background: #fca; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">SALDO DE ENVASES</div>
          <p>${entidad.tipo}: ${entidad.nombre}</p>
          <p>Fecha: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
        </div>

        <h3>Saldo Actual</h3>
        <table>
          <thead>
            <tr>
              <th>Tipo de Envase</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            ${(Array.isArray(entidad.envases) ? entidad.envases : []).map((e) => {
              const saldo = Number(e.saldo);
              const color = saldo > 0 ? '#dc2626' : saldo < 0 ? '#15803d' : '#64748b';
              const label = saldo > 0 ? ' (deuda)' : saldo < 0 ? ' (a favor)' : '';
              return `<tr><td>${e.tipo || '-'}</td><td style="color: ${color}; font-weight: bold;">${e.saldo}${label}</td></tr>`;
            }).join('')}
            ${(Array.isArray(entidad.envases) && entidad.envases.length) === 0 ? '<tr><td colspan="2">Saldo en cero</td></tr>' : ''}
            <tr class="total">
              <td>Deuda total</td>
              <td>${entidad.totalAdeudado ?? 0}</td>
            </tr>
            <tr class="total">
              <td>A favor total</td>
              <td>${entidad.totalAFavor ?? 0}</td>
            </tr>
          </tbody>
        </table>
        <p style="font-size: 10px; color: #64748b; margin-top: 16px;">El historial detallado de movimientos se consulta en la página Historial.</p>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  const compartirWhatsAppSaldo = async (entidad) => {
    if (!entidad?.whatsapp) {
      alert('No hay número de WhatsApp registrado para esta entidad');
      return;
    }
    const envs = Array.isArray(entidad.envases) ? entidad.envases : [];
    const lineas = envs.length ? envs.map((e) => `• ${e.tipo}: ${e.saldo} ${Number(e.saldo) < 0 ? '(a favor)' : '(deuda)'}`) : ['Saldo en cero'];
    const mensaje =
      `📦 *SALDO DE ENVASES*\n\n` +
      `${entidad.tipo}: ${entidad.nombre}\n\n` +
      lineas.join('\n') + '\n\n' +
      `💼 Deuda: ${entidad.totalAdeudado || 0} | A favor: ${entidad.totalAFavor || 0}`;
    const cleanNumber = String(entidad.whatsapp).replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  };

  const saldosConDeuda = useMemo(() => {
    return entidadesVisibles.filter((s) => (s.totalAdeudado || 0) > 0 || (s.totalAFavor || 0) > 0);
  }, [entidadesVisibles]);

  const saldosPagados = useMemo(() => {
    return entidadesVisibles.filter((s) => (s.totalAdeudado || 0) === 0 && (s.totalAFavor || 0) === 0);
  }, [entidadesVisibles]);

  const saldosPorProveedor = saldosConDeuda.filter((s) => s.tipo === 'Proveedor');
  const saldosPorCliente = saldosConDeuda.filter((s) => s.tipo === 'Cliente');
  const totalProveedores = saldosPorProveedor.reduce((sum, p) => sum + (p.totalAdeudado || 0), 0);
  const totalClientes = saldosPorCliente.reduce((sum, c) => sum + (c.totalAdeudado || 0), 0);

  const stockDisponible = useMemo(() => {
    return (Array.isArray(envases) ? envases : [])
      .map((e) => ({ tipo: e.tipo || 'Sin tipo', stock: Math.max(0, Number(e.stock_vacios) || 0) }))
      .filter((e) => e.tipo)
      .sort((a, b) => b.stock - a.stock);
  }, [envases]);

  const totalStockDisponible = stockDisponible.reduce((sum, e) => sum + e.stock, 0);
  const isLoading = loadingProv || loadingCli || (vistaActual === 'stock' ? loadingEnv : false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <Package className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Saldos de Envases</h1>
              <p className="text-slate-500 text-sm">Stock disponible y envases adeudados · Se recalculan al cargar</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant={vistaActual === 'stock' ? 'default' : 'outline'}
              onClick={() => setVistaActual('stock')}
              className={vistaActual === 'stock' ? 'bg-teal-600 hover:bg-teal-700' : ''}
            >
              Stock Disponible
            </Button>
            <Button
              variant={vistaActual === 'saldos' ? 'default' : 'outline'}
              onClick={() => setVistaActual('saldos')}
              className={vistaActual === 'saldos' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              Saldos por Entidad
            </Button>
            <Button
              variant={vistaActual === 'pagados' ? 'default' : 'outline'}
              onClick={() => setVistaActual('pagados')}
              className={vistaActual === 'pagados' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              Saldos Pagados
            </Button>

            {vistaActual === 'saldos' && saldosConDeuda.length > 0 && (
              <Button
                variant="outline"
                onClick={() => downloadResumenSaldosPDF(saldosConDeuda, filtroTipo)}
                className="ml-auto"
              >
                <FileDown className="h-4 w-4 mr-1" />
                Descargar Resumen PDF
              </Button>
            )}

            {(vistaActual === 'saldos' || vistaActual === 'pagados') && (
              <>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar cliente o proveedor..."
                    className="pl-10"
                  />
                </div>
                <div className="w-full sm:w-64">
                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ambos">Ambos</SelectItem>
                      <SelectItem value="Proveedor">Solo Proveedores</SelectItem>
                      <SelectItem value="Cliente">Solo Clientes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </div>

        {vistaActual === 'stock' && (
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mb-6">
            <Card className="border-0 shadow-lg shadow-slate-200/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
                    <Package className="h-8 w-8 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Stock Disponible en Acopio</p>
                    <p className="text-3xl font-bold text-teal-600">{totalStockDisponible} envases</p>
                    <p className="text-xs text-slate-500 mt-1">Listos para entregar a proveedores</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {vistaActual === 'saldos' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-0 shadow-lg shadow-slate-200/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Proveedores con saldo pendiente</p>
                    <p className="text-2xl font-bold text-red-600">{saldosPorProveedor.length}</p>
                    <p className="text-xs text-slate-400">{totalProveedores} envases (deuda)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg shadow-slate-200/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Proveedores</p>
                    <p className="text-2xl font-bold text-blue-600">{entidadesVisibles.filter((e) => e.tipo === 'Proveedor').length}</p>
                    <p className="text-xs text-slate-500">{saldosPorProveedor.length} con saldo ≠ 0</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg shadow-slate-200/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Clientes con saldo pendiente</p>
                    <p className="text-2xl font-bold text-purple-600">{totalClientes}</p>
                    <p className="text-xs text-slate-500">{saldosPorCliente.length} con saldo ≠ 0</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {vistaActual === 'stock' && (
          isLoading ? (
            <div className="text-center py-12 text-slate-500">Cargando...</div>
          ) : stockDisponible.length === 0 ? (
            <Card className="border-0 shadow-lg shadow-slate-200/50">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Sin stock de envases</h3>
                <p className="text-slate-500">No hay envases disponibles en el acopio</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-lg shadow-slate-200/50">
              <CardHeader>
                <CardTitle>Stock de Envases por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 font-semibold text-slate-700">Tipo de Envase</th>
                        <th className="text-right p-4 font-semibold text-slate-700">Stock Disponible</th>
                        <th className="text-right p-4 font-semibold text-slate-700">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockDisponible.map((item, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Package className="h-5 w-5 text-slate-400" />
                              <span className="font-medium text-slate-800">{item.tipo}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <span className={`text-2xl font-bold ${item.stock >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                              {item.stock}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            {item.stock > 0 ? (
                              <Badge className="bg-teal-100 text-teal-700 border-teal-300">Disponible</Badge>
                            ) : item.stock < 0 ? (
                              <Badge variant="destructive">Déficit</Badge>
                            ) : (
                              <Badge variant="outline">Agotado</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )
        )}

        {vistaActual === 'saldos' && (isLoading ? (
          <div className="text-center py-12 text-slate-500">Cargando lista...</div>
        ) : entidadesVisibles.length === 0 ? (
          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardContent className="p-12 text-center">
              <p className="text-slate-500">No hay entidades que coincidan con el filtro o la búsqueda.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {entidadesVisibles.map((entidad) => (
              <Card key={entidad._key} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={entidad.tipo === 'Proveedor' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}>
                        {entidad.tipo === 'Proveedor' ? 'Proveedor (Me debe)' : 'Cliente (Le debo)'}
                      </Badge>
                      <CardTitle className="text-lg font-semibold">{entidad.nombre}</CardTitle>
                    </div>
                    {entidad.totalAdeudado > 0 ? (
                      <Badge variant="destructive" className="text-base px-3 py-1">
                        {entidad.totalAdeudado} envases (deuda)
                      </Badge>
                    ) : (entidad.totalAFavor || 0) > 0 ? (
                      <Badge className="text-base px-3 py-1 bg-green-100 text-green-800 border-green-300">Saldo a favor</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-base px-3 py-1">0 · Al día</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {(Array.isArray(entidad.envases) && entidad.envases.length) > 0 ? (
                      entidad.envases.map((env, i) => {
                        const esDeuda = Number(env.saldo) > 0;
                        const esAFavor = Number(env.saldo) < 0;
                        return (
                          <div
                            key={i}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                              esDeuda ? 'bg-red-50 border-red-200' : esAFavor ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <Package className={`h-4 w-4 ${esDeuda ? 'text-red-500' : esAFavor ? 'text-green-600' : 'text-slate-500'}`} />
                            <span className={`font-medium ${esDeuda ? 'text-red-800' : esAFavor ? 'text-green-800' : 'text-slate-700'}`}>{env.tipo}:</span>
                            <span className={`font-bold ${esDeuda ? 'text-red-600' : esAFavor ? 'text-green-700' : 'text-slate-600'}`}>{env.saldo}</span>
                            {esAFavor && <span className="text-xs text-green-600">(a favor)</span>}
                            {!esDeuda && !esAFavor && <span className="text-xs text-slate-500">(al día)</span>}
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-slate-50 border-slate-200">
                        <Package className="h-4 w-4 text-slate-500" />
                        <span className="font-medium text-slate-700">Saldo:</span>
                        <span className="font-bold text-slate-600">0</span>
                        <span className="text-xs text-slate-500">(al día)</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-3 border-t">
                    <Button variant="outline" size="sm" onClick={() => generarPDFSaldo(entidad)}>
                      <FileDown className="h-4 w-4 mr-1" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => compartirWhatsAppSaldo(entidad)} className="text-green-600">
                      <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}

        {vistaActual === 'pagados' && (isLoading ? (
          <div className="text-center py-12 text-slate-500">Cargando...</div>
        ) : saldosPagados.length === 0 ? (
          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Sin saldos pagados</h3>
              <p className="text-slate-500">
                No hay {filtroTipo === 'Ambos' ? 'proveedores o clientes' : filtroTipo === 'Proveedor' ? 'proveedores' : 'clientes'} con saldo 0 en la lista actual
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {saldosPagados.map((entidad) => (
              <Card key={entidad._key} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={entidad.tipo === 'Proveedor' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}>
                        {entidad.tipo}
                      </Badge>
                      <CardTitle className="text-lg font-semibold">{entidad.nombre}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-base px-3 py-1 bg-slate-100 text-slate-700 border-slate-300">Saldo 0 · Al día</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg mb-3">
                    <CheckCircle className="h-5 w-5 text-slate-500" />
                    <span className="text-sm text-slate-700 font-medium">Saldo en cero</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-3 border-t">
                    <Button variant="outline" size="sm" onClick={() => generarPDFSaldo(entidad)}>
                      <FileDown className="h-4 w-4 mr-1" /> PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
