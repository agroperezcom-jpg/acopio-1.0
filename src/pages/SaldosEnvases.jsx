import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, AlertTriangle, CheckCircle, User, Users, ChevronDown, ChevronUp, FileDown, MessageCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { downloadResumenSaldosPDF } from '../components/PDFGenerator';
import { Button } from "@/components/ui/button";
import { format, subDays, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

const RANGO_DIAS_DEFAULT = 90;

export default function SaldosEnvases() {
  const [vistaActual, setVistaActual] = useState('saldos'); // 'saldos', 'stock' o 'pagados'
  const [filtroTipo, setFiltroTipo] = useState('Ambos');
  const [expandedEntity, setExpandedEntity] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const { desde, hasta } = useMemo(() => {
    const hoy = new Date();
    return {
      desde: subDays(hoy, RANGO_DIAS_DEFAULT),
      hasta: endOfDay(hoy)
    };
  }, []);

  const desdeISO = desde?.toISOString?.();
  const hastaISO = hasta?.toISOString?.();

  const { data: movimientos = [], isLoading: loadingMov, error: errorMov } = useQuery({
    queryKey: ['movimientos-saldosenvases', desdeISO, hastaISO],
    queryFn: () => base44.entities.Movimiento.filter(
      { fecha: { $gte: desdeISO, $lte: hastaISO } },
      '-fecha',
      500
    ),
    enabled: !!desdeISO && !!hastaISO,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: proveedores = [], isLoading: loadingProv } = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => base44.entities.Proveedor.list('nombre', 500),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: clientes = [], isLoading: loadingCli } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('nombre', 500),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: salidas = [], isLoading: loadingSal, error: errorSal } = useQuery({
    queryKey: ['salidas-saldosenvases', desdeISO, hastaISO],
    queryFn: () => base44.entities.SalidaFruta.filter(
      { fecha: { $gte: desdeISO, $lte: hastaISO } },
      '-fecha',
      500
    ),
    enabled: !!desdeISO && !!hastaISO,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const todosLosSaldos = useMemo(() => {
    const saldos = {};
    
    // Procesar movimientos de proveedores (envases vacíos)
    movimientos.forEach(m => {
      if (m.proveedor_id && m.movimiento_envases) {
        const key = `proveedor_${m.proveedor_id}`;
        if (!saldos[key]) {
          const prov = proveedores.find(p => p.id === m.proveedor_id);
          saldos[key] = {
            id: m.proveedor_id,
            nombre: m.proveedor_nombre || prov?.nombre || 'Desconocido',
            tipo: 'Proveedor',
            whatsapp: prov?.whatsapp,
            envases: {},
            historial: []
          };
        }
        
        m.movimiento_envases.forEach(e => {
          if (!e.envase_tipo) return;
          if (!saldos[key].envases[e.envase_tipo]) {
            saldos[key].envases[e.envase_tipo] = 0;
          }
          saldos[key].envases[e.envase_tipo] += (e.cantidad_salida || 0) - (e.cantidad_ingreso || 0);
        });
        
        // Agregar al historial
        saldos[key].historial.push({
          fecha: m.fecha,
          tipo: m.tipo_movimiento,
          envases: m.movimiento_envases
        });
      }
    });

    // Procesar ENVASES LLENOS en Ingreso de Fruta (devolución del proveedor)
    movimientos.forEach(m => {
      if (m.proveedor_id && m.tipo_movimiento === 'Ingreso de Fruta' && m.envases_llenos) {
        const key = `proveedor_${m.proveedor_id}`;
        if (!saldos[key]) {
          const prov = proveedores.find(p => p.id === m.proveedor_id);
          saldos[key] = {
            id: m.proveedor_id,
            nombre: m.proveedor_nombre || prov?.nombre || 'Desconocido',
            tipo: 'Proveedor',
            whatsapp: prov?.whatsapp,
            envases: {},
            historial: []
          };
        }
        
        // Los envases llenos que entrega el proveedor REDUCEN su deuda
        m.envases_llenos.forEach(e => {
          if (!e.envase_tipo) return;
          if (!saldos[key].envases[e.envase_tipo]) {
            saldos[key].envases[e.envase_tipo] = 0;
          }
          saldos[key].envases[e.envase_tipo] -= (e.cantidad || 0);
        });
        
        // Agregar al historial
        if (m.envases_llenos.length > 0) {
          saldos[key].historial.push({
            fecha: m.fecha,
            tipo: 'Ingreso de Fruta (Envases Llenos)',
            envases: m.envases_llenos.map(e => ({
              envase_tipo: e.envase_tipo,
              cantidad_ingreso: e.cantidad,
              cantidad_salida: 0
            }))
          });
        }
      }
    });

    // Procesar movimientos de clientes (DEUDA DEL ACOPIO HACIA CLIENTES)
    // Cuando cliente INGRESA envases → acopio le debe al cliente
    // Cuando acopio DEVUELVE (salida) → reduce deuda del acopio
    movimientos.forEach(m => {
      if (m.cliente_id && m.movimiento_envases) {
        const key = `cliente_${m.cliente_id}`;
        if (!saldos[key]) {
          const cli = clientes.find(c => c.id === m.cliente_id);
          saldos[key] = {
            id: m.cliente_id,
            nombre: m.cliente_nombre || cli?.nombre || 'Desconocido',
            tipo: 'Cliente',
            whatsapp: cli?.whatsapp,
            envases: {},
            historial: []
          };
        }
        
        m.movimiento_envases.forEach(e => {
          if (!e.envase_tipo) return;
          if (!saldos[key].envases[e.envase_tipo]) {
            saldos[key].envases[e.envase_tipo] = 0;
          }
          // INVERTIDO: ingreso suma (acopio debe), salida resta (acopio devuelve)
          saldos[key].envases[e.envase_tipo] += (e.cantidad_ingreso || 0) - (e.cantidad_salida || 0);
        });
        
        saldos[key].historial.push({
          fecha: m.fecha,
          tipo: m.tipo_movimiento,
          envases: m.movimiento_envases
        });
      }
    });
    
    // Procesar envases LLENOS en salidas de fruta (REDUCEN la deuda hacia cliente)
    salidas.forEach(s => {
      if (s.cliente_id && s.envases_llenos?.length > 0) {
        const key = `cliente_${s.cliente_id}`;
        if (!saldos[key]) {
          const cli = clientes.find(c => c.id === s.cliente_id);
          saldos[key] = {
            id: s.cliente_id,
            nombre: s.cliente_nombre || cli?.nombre || 'Desconocido',
            tipo: 'Cliente',
            whatsapp: cli?.whatsapp,
            envases: {},
            historial: []
          };
        }
        
        s.envases_llenos.forEach(e => {
          if (!e.envase_tipo) return;
          if (!saldos[key].envases[e.envase_tipo]) {
            saldos[key].envases[e.envase_tipo] = 0;
          }
          // RESTAR: cuando le mandas envases llenos al cliente, reduces lo que le debes
          saldos[key].envases[e.envase_tipo] -= (e.cantidad || 0);
        });
        
        // Agregar al historial
        saldos[key].historial.push({
          fecha: s.fecha,
          tipo: 'Salida de Fruta',
          remito: s.numero_remito,
          envases_llenos: s.envases_llenos
        });
      }
    });

    // Procesar envases vacíos en salidas de fruta (DEUDA DEL ACOPIO HACIA CLIENTES)
    salidas.forEach(s => {
      if (s.cliente_id && s.movimiento_envases) {
        const key = `cliente_${s.cliente_id}`;
        if (!saldos[key]) {
          const cli = clientes.find(c => c.id === s.cliente_id);
          saldos[key] = {
            id: s.cliente_id,
            nombre: s.cliente_nombre || cli?.nombre || 'Desconocido',
            tipo: 'Cliente',
            whatsapp: cli?.whatsapp,
            envases: {},
            historial: []
          };
        }
        
        s.movimiento_envases.forEach(e => {
          if (!e.envase_tipo) return;
          if (!saldos[key].envases[e.envase_tipo]) {
            saldos[key].envases[e.envase_tipo] = 0;
          }
          // INVERTIDO: ingreso suma (acopio debe), salida resta (acopio devuelve)
          saldos[key].envases[e.envase_tipo] += (e.cantidad_ingreso || 0) - (e.cantidad_salida || 0);
        });
      }
    });

    // Convertir a array y calcular totales (incluir TODOS, incluso los pagados)
    return Object.values(saldos)
      .map(s => {
        const envasesArray = Object.entries(s.envases)
          .map(([tipo, saldo]) => ({ tipo, saldo: Math.max(0, saldo) }));

        const totalAdeudado = envasesArray.reduce((sum, e) => sum + e.saldo, 0);

        return {
          ...s,
          envases: envasesArray,
          totalAdeudado,
          historial: s.historial.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        };
      })
      .filter(s => s.historial.length > 0) // Solo los que tienen historial
      .sort((a, b) => b.totalAdeudado - a.totalAdeudado);
    }, [movimientos, salidas, proveedores, clientes]);

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
        
        <h3>Historial de Movimientos</h3>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            ${entidad.historial.map(h => `
              <tr>
                <td>${format(new Date(h.fecha), 'dd/MM/yyyy HH:mm')}</td>
                <td>${h.tipo}</td>
                <td>${(h.envases || []).map(e => `${e.envase_tipo}: +${e.cantidad_ingreso||0}/-${e.cantidad_salida||0}`).join(', ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3>Saldo Actual</h3>
        <table>
          <thead>
            <tr>
              <th>Tipo de Envase</th>
              <th>Cantidad Adeudada</th>
            </tr>
          </thead>
          <tbody>
            ${entidad.envases.map(e => `
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
    let conDeuda = todosLosSaldos.filter(s => s.totalAdeudado > 0);
    if (filtroTipo !== 'Ambos') {
      conDeuda = conDeuda.filter(s => s.tipo === filtroTipo);
    }
    if (busqueda) {
      conDeuda = conDeuda.filter(s => 
        s.nombre.toLowerCase().includes(busqueda.toLowerCase())
      );
    }
    return conDeuda;
  }, [todosLosSaldos, filtroTipo, busqueda]);

  const saldosPagados = useMemo(() => {
    let pagados = todosLosSaldos.filter(s => s.totalAdeudado === 0);
    if (filtroTipo !== 'Ambos') {
      pagados = pagados.filter(s => s.tipo === filtroTipo);
    }
    if (busqueda) {
      pagados = pagados.filter(s => 
        s.nombre.toLowerCase().includes(busqueda.toLowerCase())
      );
    }
    return pagados;
  }, [todosLosSaldos, filtroTipo, busqueda]);

  const saldosPorProveedor = saldosFiltrados.filter(s => s.tipo === 'Proveedor');
  const saldosPorCliente = saldosFiltrados.filter(s => s.tipo === 'Cliente');

  const totalGeneral = saldosFiltrados.reduce((sum, s) => sum + s.totalAdeudado, 0);
  const totalProveedores = saldosPorProveedor.reduce((sum, p) => sum + p.totalAdeudado, 0);
  const totalClientes = saldosPorCliente.reduce((sum, c) => sum + c.totalAdeudado, 0);

  // Calcular stock disponible de envases (ingresos desde clientes - salidas a proveedores)
  const stockDisponible = useMemo(() => {
    const stock = {};
    
    // Ingresos/salidas desde movimientos con clientes
    movimientos.forEach(m => {
      if (m.cliente_id && m.movimiento_envases) {
        m.movimiento_envases.forEach(e => {
          if (!e.envase_tipo) return;
          if (!stock[e.envase_tipo]) stock[e.envase_tipo] = 0;
          stock[e.envase_tipo] += (e.cantidad_ingreso || 0) - (e.cantidad_salida || 0);
        });
      }
    });
    
    // Ingresos/salidas en salidas de fruta (a clientes)
    salidas.forEach(s => {
      if (s.movimiento_envases) {
        s.movimiento_envases.forEach(e => {
          if (!e.envase_tipo) return;
          if (!stock[e.envase_tipo]) stock[e.envase_tipo] = 0;
          stock[e.envase_tipo] += (e.cantidad_ingreso || 0) - (e.cantidad_salida || 0);
        });
      }
    });
    
    // Salidas a proveedores
    movimientos.forEach(m => {
      if (m.proveedor_id && m.movimiento_envases) {
        m.movimiento_envases.forEach(e => {
          if (!e.envase_tipo) return;
          if (!stock[e.envase_tipo]) stock[e.envase_tipo] = 0;
          stock[e.envase_tipo] -= (e.cantidad_salida || 0) - (e.cantidad_ingreso || 0);
        });
      }
    });
    
    return Object.entries(stock)
      .map(([tipo, cantidad]) => ({ tipo, stock: cantidad }))
      .sort((a, b) => b.stock - a.stock);
  }, [movimientos, salidas]);

  const totalStockDisponible = stockDisponible.reduce((sum, e) => sum + Math.max(0, e.stock), 0);

  const isLoading = loadingMov || loadingProv || loadingCli || loadingSal;
  const hasError = errorMov || errorSal;

  if (hasError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
          <Card className="border-red-200 bg-red-50 shadow-lg">
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-16 w-16 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-900 mb-2">Error al cargar datos</h3>
              <p className="text-red-700">No se pudieron cargar los movimientos. Intenta recargar la página.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
            {saldosFiltrados.map((entidad) => {
              const isExpanded = expandedEntity === `${entidad.tipo}_${entidad.id}`;
              return (
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
                    <Badge variant="destructive" className="text-base px-3 py-1">
                      {entidad.totalAdeudado} envases
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {entidad.envases.filter(e => e.saldo > 0).map((env, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg"
                      >
                        <Package className="h-4 w-4 text-red-500" />
                        <span className="font-medium text-red-800">{env.tipo}:</span>
                        <span className="font-bold text-red-600">{env.saldo}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedEntity(isExpanded ? null : `${entidad.tipo}_${entidad.id}`)}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                      Ver Historial
                    </Button>
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

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-3">Historial de Movimientos</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left p-2">Fecha</th>
                              <th className="text-left p-2">Tipo</th>
                              <th className="text-left p-2">Envases</th>
                            </tr>
                          </thead>
                          <tbody>
                           {entidad.historial.map((h, idx) => (
                             <tr key={idx} className="border-b">
                               <td className="p-2">{format(new Date(h.fecha), 'dd/MM/yy HH:mm', { locale: es })}</td>
                               <td className="p-2">
                                 <div className="flex flex-col">
                                   <span>{h.tipo}</span>
                                   {h.remito && <span className="text-xs text-slate-500">{h.remito}</span>}
                                 </div>
                               </td>
                               <td className="p-2 text-xs">
                                 {h.envases?.map((e, i) => (
                                   <div key={i}>
                                     {e.envase_tipo}: 
                                     {e.cantidad_ingreso > 0 && <span className="text-green-600"> +{e.cantidad_ingreso}</span>}
                                     {e.cantidad_salida > 0 && <span className="text-red-600"> -{e.cantidad_salida}</span>}
                                   </div>
                                 ))}
                                 {h.envases_llenos?.map((e, i) => (
                                   <div key={i} className="text-purple-600 font-medium">
                                     {e.envase_tipo}: -{e.cantidad} llenos
                                   </div>
                                 ))}
                               </td>
                             </tr>
                           ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )})}
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
            {saldosPagados.map((entidad) => {
              const isExpanded = expandedEntity === `${entidad.tipo}_${entidad.id}`;
              return (
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
                      onClick={() => setExpandedEntity(isExpanded ? null : `${entidad.tipo}_${entidad.id}`)}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                      Ver Historial
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generarPDFSaldo(entidad)}
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-3">Historial de Movimientos</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left p-2">Fecha</th>
                              <th className="text-left p-2">Tipo</th>
                              <th className="text-left p-2">Envases</th>
                            </tr>
                          </thead>
                          <tbody>
                           {entidad.historial.map((h, idx) => (
                             <tr key={idx} className="border-b">
                               <td className="p-2">{format(new Date(h.fecha), 'dd/MM/yy HH:mm', { locale: es })}</td>
                               <td className="p-2">
                                 <div className="flex flex-col">
                                   <span>{h.tipo}</span>
                                   {h.remito && <span className="text-xs text-slate-500">{h.remito}</span>}
                                 </div>
                               </td>
                               <td className="p-2 text-xs">
                                 {h.envases?.map((e, i) => (
                                   <div key={i}>
                                     {e.envase_tipo}: 
                                     {e.cantidad_ingreso > 0 && <span className="text-green-600"> +{e.cantidad_ingreso}</span>}
                                     {e.cantidad_salida > 0 && <span className="text-red-600"> -{e.cantidad_salida}</span>}
                                   </div>
                                 ))}
                                 {h.envases_llenos?.map((e, i) => (
                                   <div key={i} className="text-purple-600 font-medium">
                                     {e.envase_tipo}: -{e.cantidad} llenos
                                   </div>
                                 ))}
                               </td>
                             </tr>
                           ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )})}
          </div>
          ))}
          </div>
          </div>
          );
          }