import React, { useMemo, useState } from 'react';
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

const PAGE_SIZE = 500;

/** Normaliza saldo_envases: puede ser objeto, string JSON o null/undefined. */
function normalizarSaldoEnvases(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** True si hay al menos un envase pendiente (cualquier clave con valor distinto de 0). */
function tieneAlgunPendiente(saldoEnvases) {
  const obj = normalizarSaldoEnvases(saldoEnvases);
  return Object.values(obj).some((v) => Number(v) !== 0);
}

/** True si tiene al menos una clave en saldo_envases (está en el tracking de envases). */
function tieneTrackingEnvases(saldoEnvases) {
  const obj = normalizarSaldoEnvases(saldoEnvases);
  return Object.keys(obj).length > 0;
}

/** Convierte saldo_envases a array de { tipo, saldo } con saldo !== 0 (positivo o negativo). */
function saldoEnvasesAArray(saldoEnvases) {
  const obj = normalizarSaldoEnvases(saldoEnvases);
  return Object.entries(obj)
    .map(([tipo, saldo]) => ({ tipo, saldo: Number(saldo) || 0 }))
    .filter((e) => e.saldo !== 0);
}

export default function SaldosEnvases() {
  const [vistaActual, setVistaActual] = useState('saldos');
  const [filtroTipo, setFiltroTipo] = useState('Ambos');
  const [busqueda, setBusqueda] = useState('');

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

  const todosLosSaldos = useMemo(() => {
    const lista = [];

    proveedores.forEach((p) => {
      if (!tieneTrackingEnvases(p.saldo_envases)) return;
      const envasesArray = saldoEnvasesAArray(p.saldo_envases);
      const totalAdeudado = envasesArray.filter((e) => e.saldo > 0).reduce((sum, e) => sum + e.saldo, 0);
      lista.push({
        id: p.id,
        nombre: p.nombre || 'Desconocido',
        tipo: 'Proveedor',
        whatsapp: p.whatsapp,
        envases: envasesArray,
        totalAdeudado,
        historial: [],
      });
    });

    clientes.forEach((c) => {
      if (!tieneTrackingEnvases(c.saldo_envases)) return;
      const envasesArray = saldoEnvasesAArray(c.saldo_envases);
      const totalAdeudado = envasesArray.filter((e) => e.saldo > 0).reduce((sum, e) => sum + e.saldo, 0);
      lista.push({
        id: c.id,
        nombre: c.nombre || 'Desconocido',
        tipo: 'Cliente',
        whatsapp: c.whatsapp,
        envases: envasesArray,
        totalAdeudado,
        historial: [],
      });
    });

    return lista.sort((a, b) => b.totalAdeudado - a.totalAdeudado);
  }, [proveedores, clientes]);

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
              <th>Cantidad Adeudada</th>
            </tr>
          </thead>
          <tbody>
            ${(entidad.envases || []).map(e => `
              <tr>
                <td>${e.tipo}</td>
                <td style="color: #dc2626; font-weight: bold;">${e.saldo}</td>
              </tr>
            `).join('')}
            <tr class="total">
              <td>TOTAL</td>
              <td>${entidad.totalAdeudado}</td>
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
    if (!entidad.whatsapp) {
      alert('No hay número de WhatsApp registrado para esta entidad');
      return;
    }
    
    const mensaje = `🔴 *SALDO DE ENVASES*\n\n` +
      `${entidad.tipo}: ${entidad.nombre}\n\n` +
      `📦 *Envases Adeudados:*\n` +
      entidad.envases.map(e => `• ${e.tipo}: ${e.saldo} unidades`).join('\n') +
      `\n\n💼 *Total: ${entidad.totalAdeudado} envases*`;
    
    const cleanNumber = entidad.whatsapp.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  };

  const saldosFiltrados = useMemo(() => {
    let conPendiente = todosLosSaldos.filter((s) => s.envases.length > 0);
    if (filtroTipo !== 'Ambos') {
      conPendiente = conPendiente.filter((s) => s.tipo === filtroTipo);
    }
    return conPendiente;
  }, [todosLosSaldos, filtroTipo]);

  const saldosPagados = useMemo(() => {
    let pagados = todosLosSaldos.filter((s) => s.envases.length === 0);
    if (filtroTipo !== 'Ambos') {
      pagados = pagados.filter((s) => s.tipo === filtroTipo);
    }
    return pagados;
  }, [todosLosSaldos, filtroTipo]);

  const saldosPorProveedor = saldosFiltrados.filter(s => s.tipo === 'Proveedor');
  const saldosPorCliente = saldosFiltrados.filter(s => s.tipo === 'Cliente');

  const totalGeneral = saldosFiltrados.reduce((sum, s) => sum + s.totalAdeudado, 0);
  const totalProveedores = saldosPorProveedor.reduce((sum, p) => sum + p.totalAdeudado, 0);
  const totalClientes = saldosPorCliente.reduce((sum, c) => sum + c.totalAdeudado, 0);

  const stockDisponible = useMemo(() => {
    return (Array.isArray(envases) ? envases : [])
      .map(e => ({ tipo: e.tipo || 'Sin tipo', stock: Math.max(0, Number(e.stock_vacios) || 0) }))
      .filter(e => e.tipo)
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
              <p className="text-slate-500 text-sm">Stock disponible y envases adeudados</p>
            </div>
          </div>
          
          {/* Selector de vista */}
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

            {vistaActual === 'saldos' && saldosFiltrados.length > 0 && (
              <Button
                variant="outline"
                onClick={() => downloadResumenSaldosPDF(saldosFiltrados, filtroTipo)}
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

        {/* Resumen General - Stock Disponible */}
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

        {/* Resumen General - Saldos por Entidad */}
        {vistaActual === 'saldos' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Proveedores con Deuda</p>
                  <p className="text-2xl font-bold text-red-600">{saldosPorProveedor.length}</p>
                  <p className="text-xs text-slate-400">{totalProveedores} envases totales</p>
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
                  <p className="text-2xl font-bold text-blue-600">{totalProveedores}</p>
                  <p className="text-xs text-slate-500">{saldosPorProveedor.length} con deuda</p>
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
                  <p className="text-xs text-slate-500">Clientes (Acopio Debe)</p>
                  <p className="text-2xl font-bold text-purple-600">{totalClientes}</p>
                  <p className="text-xs text-slate-500">{saldosPorCliente.length} pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        )}

        {/* Vista Stock Disponible */}
        {vistaActual === 'stock' && (
          isLoading ? (
            <div className="text-center py-12 text-slate-500">Cargando...</div>
          ) : stockDisponible.length === 0 ? (
            <Card className="border-0 shadow-lg shadow-slate-200/50">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  Sin stock de envases
                </h3>
                <p className="text-slate-500">
                  No hay envases disponibles en el acopio
                </p>
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
                              <Badge className="bg-teal-100 text-teal-700 border-teal-300">
                                Disponible
                              </Badge>
                            ) : item.stock < 0 ? (
                              <Badge variant="destructive">
                                Déficit
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                Agotado
                              </Badge>
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

        {/* Lista de Entidades - Saldos CON Deuda */}
        {vistaActual === 'saldos' && (isLoading ? (
          <div className="text-center py-12 text-slate-500">Cargando...</div>
        ) : saldosFiltrados.length === 0 ? (
          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                ¡Sin deudas de envases!
              </h3>
              <p className="text-slate-500">
                {filtroTipo === 'Ambos' 
                  ? 'Todos los proveedores y clientes tienen sus envases al día'
                  : `Todos los ${filtroTipo === 'Proveedor' ? 'proveedores' : 'clientes'} tienen sus envases al día`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {saldosFiltrados.map((entidad) => (
              <Card key={`${entidad.tipo}_${entidad.id}`} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={entidad.tipo === 'Proveedor' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}>
                        {entidad.tipo === 'Proveedor' ? 'Proveedor (Me debe)' : 'Cliente (Le debo)'}
                      </Badge>
                      <CardTitle className="text-lg font-semibold">
                        {entidad.nombre}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="destructive"
                      className="text-base px-3 py-1"
                    >
                      {entidad.totalAdeudado > 0
                        ? `${entidad.totalAdeudado} envases`
                        : 'Saldo a favor'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {entidad.envases.map((env, i) => {
                      const esDeuda = env.saldo > 0;
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                            esDeuda
                              ? 'bg-red-50 border-red-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <Package className={`h-4 w-4 ${esDeuda ? 'text-red-500' : 'text-slate-500'}`} />
                          <span className={`font-medium ${esDeuda ? 'text-red-800' : 'text-slate-700'}`}>
                            {env.tipo}:
                          </span>
                          <span className={`font-bold ${esDeuda ? 'text-red-600' : 'text-slate-600'}`}>
                            {env.saldo}
                          </span>
                          {!esDeuda && (
                            <span className="text-xs text-slate-500">(a favor)</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generarPDFSaldo(entidad)}
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => compartirWhatsAppSaldo(entidad)}
                      className="text-green-600"
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      WhatsApp
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          ))}

          {/* Lista de Entidades - Saldos PAGADOS (sin deuda) */}
          {vistaActual === 'pagados' && (isLoading ? (
          <div className="text-center py-12 text-slate-500">Cargando...</div>
          ) : saldosPagados.length === 0 ? (
          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Sin saldos pagados
              </h3>
              <p className="text-slate-500">
                Aún no hay {filtroTipo === 'Ambos' ? 'proveedores o clientes' : filtroTipo === 'Proveedor' ? 'proveedores' : 'clientes'} que hayan devuelto todos sus envases
              </p>
            </CardContent>
          </Card>
          ) : (
          <div className="space-y-4">
            {saldosPagados.map((entidad) => (
              <Card key={`${entidad.tipo}_${entidad.id}`} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={entidad.tipo === 'Proveedor' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}>
                        {entidad.tipo}
                      </Badge>
                      <CardTitle className="text-lg font-semibold">
                        {entidad.nombre}
                      </CardTitle>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-300 text-base px-3 py-1">
                      ✓ Al día
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg mb-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm text-green-800 font-medium">
                      Todos los envases han sido devueltos
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generarPDFSaldo(entidad)}
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      PDF
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