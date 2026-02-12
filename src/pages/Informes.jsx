import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, FileDown, MessageCircle, AlertTriangle } from "lucide-react";
import { format, startOfMonth, subMonths, startOfYear, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import SearchableSelect from "@/components/SearchableSelect";
import { toast } from 'sonner';

export default function Informes() {
  const [tipoInforme, setTipoInforme] = useState('proveedor');
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState([]);
  const [clientesSeleccionados, setClientesSeleccionados] = useState([]);
  const [fechaDesde, setFechaDesde] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [fechaHasta, setFechaHasta] = useState(format(new Date(), "yyyy-MM-dd"));
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [advertenciaLimite, setAdvertenciaLimite] = useState(false);
  
  // Campos seleccionables para el informe
  const [camposSeleccionados, setCamposSeleccionados] = useState({
    fecha: true,
    tipo: true,
    fletero: true,
    remito: true,
    comprobante: true,
    productos: true,
    pesajes_detallados: false,
    envases: true,
    totales: true,
    saldos: false
  });

  const { data: proveedores = [] } = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => base44.entities.Proveedor.list('nombre'),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('nombre'),
  });

  const desdeISO = fechaDesde ? new Date(fechaDesde).toISOString() : null;
  const hastaISO = fechaHasta ? new Date(fechaHasta + 'T23:59:59').toISOString() : null;

  const { data: movimientos = [] } = useQuery({
    queryKey: ['movimientos-informes', tipoInforme, proveedoresSeleccionados, clientesSeleccionados, desdeISO, hastaISO],
    queryFn: async () => {
      if (tipoInforme === 'proveedor' && proveedoresSeleccionados.length === 0) return [];
      if (tipoInforme === 'cliente' && clientesSeleccionados.length === 0) return [];
      const query = { fecha: { $gte: desdeISO, $lte: hastaISO } };
      if (tipoInforme === 'proveedor') {
        query.proveedor_id = { $in: proveedoresSeleccionados };
      } else {
        query.cliente_id = { $in: clientesSeleccionados };
      }
      return base44.entities.Movimiento.filter(query, '-created_date', 1000);
    },
    enabled: !!desdeISO && !!hastaISO && (
      (tipoInforme === 'proveedor' && proveedoresSeleccionados.length > 0) ||
      (tipoInforme === 'cliente' && clientesSeleccionados.length > 0)
    ),
    staleTime: 2 * 60 * 1000
  });

  const { data: salidas = [] } = useQuery({
    queryKey: ['salidas-informes', clientesSeleccionados, desdeISO, hastaISO],
    queryFn: async () => {
      if (clientesSeleccionados.length === 0) return [];
      return base44.entities.SalidaFruta.filter(
        { cliente_id: { $in: clientesSeleccionados }, fecha: { $gte: desdeISO, $lte: hastaISO } },
        '-created_date',
        1000
      );
    },
    enabled: !!desdeISO && !!hastaISO && tipoInforme === 'cliente' && clientesSeleccionados.length > 0,
    staleTime: 2 * 60 * 1000
  });

  const aplicarRangoRapido = (desde, hasta) => {
    setFechaDesde(format(desde, "yyyy-MM-dd"));
    setFechaHasta(format(hasta, "yyyy-MM-dd"));
  };

  // Efecto para detectar si se alcanzó el límite
  React.useEffect(() => {
    const alcanzaLimite = movimientos.length === 1000 || salidas.length === 1000;
    setAdvertenciaLimite(alcanzaLimite);
  }, [movimientos.length, salidas.length]);

  // Validación de rango seguro: advertir si > 180 días
  React.useEffect(() => {
    if (!fechaDesde || !fechaHasta) return;
    const desde = new Date(fechaDesde);
    const hasta = new Date(fechaHasta + 'T23:59:59');
    const diasDiferencia = Math.ceil((hasta - desde) / (1000 * 60 * 60 * 24));
    if (diasDiferencia > 180) {
      toast.warning('Estás solicitando un periodo muy largo. El sistema limitará los resultados a los primeros 1000 registros por seguridad.');
    }
  }, [fechaDesde, fechaHasta]);

  const { data: productos = [] } = useQuery({
    queryKey: ['productos'],
    queryFn: () => base44.entities.Producto.list(),
  });

  const movimientosFiltrados = useMemo(() => {
    if (tipoInforme === 'proveedor') return movimientos;
    return [...movimientos, ...salidas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [movimientos, salidas, tipoInforme]);

  const totales = useMemo(() => {
    const totalesProductos = {};
    const totalesEnvases = {};
    let totalDescuentos = 0;

    if (tipoInforme === 'proveedor') {
      movimientosFiltrados.forEach(m => {
        if (m.tipo_movimiento === 'Ingreso de Fruta' && m.pesajes) {
          m.pesajes.forEach(p => {
            if (!productosSeleccionados.length || productosSeleccionados.includes(p.producto_id)) {
              if (!totalesProductos[p.producto_nombre]) {
                totalesProductos[p.producto_nombre] = 0;
              }
              totalesProductos[p.producto_nombre] += p.peso_neto || 0;
            }
          });
        }

        if (m.movimiento_envases) {
          m.movimiento_envases.forEach(e => {
            if (!totalesEnvases[e.envase_tipo]) {
              totalesEnvases[e.envase_tipo] = { ingreso: 0, salida: 0 };
            }
            totalesEnvases[e.envase_tipo].ingreso += e.cantidad_ingreso || 0;
            totalesEnvases[e.envase_tipo].salida += e.cantidad_salida || 0;
          });
        }
      });
    } else {
      movimientosFiltrados.forEach(item => {
        if (item.detalles) {
          item.detalles.forEach(d => {
            if (!productosSeleccionados.length || productosSeleccionados.includes(d.producto_id)) {
              const kilosReales = d.kilos_reales || d.kilos_salida;
              const descuento = d.descuento_kg || 0;
              const efectivos = kilosReales - descuento;
              
              if (!totalesProductos[d.producto_nombre]) {
                totalesProductos[d.producto_nombre] = { originales: 0, efectivos: 0, descuentos: 0 };
              }
              totalesProductos[d.producto_nombre].originales += d.kilos_salida;
              totalesProductos[d.producto_nombre].efectivos += efectivos;
              totalesProductos[d.producto_nombre].descuentos += descuento;
              totalDescuentos += descuento;
            }
          });
        }

        if (item.movimiento_envases) {
          item.movimiento_envases.forEach(e => {
            if (!totalesEnvases[e.envase_tipo]) {
              totalesEnvases[e.envase_tipo] = { ingreso: 0, salida: 0 };
            }
            totalesEnvases[e.envase_tipo].ingreso += e.cantidad_ingreso || 0;
            totalesEnvases[e.envase_tipo].salida += e.cantidad_salida || 0;
          });
        }
      });
    }

    return { totalesProductos, totalesEnvases, totalDescuentos };
  }, [movimientosFiltrados, productosSeleccionados, tipoInforme]);

  const entidadesSeleccionadas = tipoInforme === 'proveedor'
    ? proveedores.filter(p => proveedoresSeleccionados.includes(p.id))
    : clientes.filter(c => clientesSeleccionados.includes(c.id));
  
  const nombreEntidades = entidadesSeleccionadas.length === 0 
    ? 'Ninguno' 
    : entidadesSeleccionadas.length === 1 
      ? entidadesSeleccionadas[0].nombre 
      : `${entidadesSeleccionadas.length} ${tipoInforme === 'proveedor' ? 'proveedores' : 'clientes'}`;

  const exportarPDF = () => {
    const periodoText = `${fechaDesde ? format(new Date(fechaDesde), 'dd/MM/yyyy') : 'Inicio'} - ${fechaHasta ? format(new Date(fechaHasta), 'dd/MM/yyyy') : 'Hoy'}`;
    
    // Construir encabezados dinámicos
    let headers = [];
    if (camposSeleccionados.fecha) headers.push('<th>Fecha</th>');
    if (camposSeleccionados.tipo) headers.push('<th>Tipo</th>');
    if (entidadesSeleccionadas.length > 1) {
      headers.push(`<th>${tipoInforme === 'proveedor' ? 'Proveedor' : 'Cliente'}</th>`);
    }
    if (tipoInforme === 'cliente') {
      if (camposSeleccionados.remito) headers.push('<th>Remito R</th>');
      if (camposSeleccionados.comprobante) headers.push('<th>Comp. Cliente</th>');
    } else {
      if (camposSeleccionados.fletero) headers.push('<th>Fletero</th>');
    }
    if (camposSeleccionados.productos) headers.push('<th>Productos</th>');
    if (camposSeleccionados.envases) headers.push('<th>Envases</th>');
    
    let movimientosHTML = '';
    if (tipoInforme === 'proveedor') {
      movimientosHTML = movimientosFiltrados.map(m => {
        let cells = [];
        if (camposSeleccionados.fecha) cells.push(`<td>${format(new Date(m.fecha), 'dd/MM/yyyy HH:mm')}</td>`);
        if (camposSeleccionados.tipo) cells.push(`<td>${m.tipo_movimiento}</td>`);
        if (entidadesSeleccionadas.length > 1) cells.push(`<td>${m.proveedor_nombre}</td>`);
        if (camposSeleccionados.fletero) cells.push(`<td>${m.fletero_nombre || '-'}</td>`);
        if (camposSeleccionados.productos) {
          const productosHTML = camposSeleccionados.pesajes_detallados && m.pesajes
            ? m.pesajes.map(p => `${p.producto_nombre}: Cant=${p.cantidad||1}, Bruto=${(p.peso_bruto||0).toFixed(2)}kg, Neto=${(p.peso_neto||0).toFixed(2)}kg`).join('<br>')
            : (m.pesajes?.map(p => `${p.producto_nombre}: ${(p.peso_neto || 0).toFixed(2)} kg`).join('<br>') || '-');
          cells.push(`<td>${productosHTML}</td>`);
        }
        if (camposSeleccionados.envases) {
          cells.push(`<td>${m.movimiento_envases?.map(e => `${e.envase_tipo}: +${e.cantidad_ingreso || 0}/-${e.cantidad_salida || 0}`).join('<br>') || '-'}</td>`);
        }
        return `<tr>${cells.join('')}</tr>`;
      }).join('');
    } else {
      movimientosHTML = movimientosFiltrados.map(item => {
        let cells = [];
        if (camposSeleccionados.fecha) cells.push(`<td>${format(new Date(item.fecha), 'dd/MM/yyyy HH:mm')}</td>`);
        if (camposSeleccionados.tipo) cells.push(`<td>${item.detalles ? 'Salida de Fruta' : 'Movimiento de Envases'}</td>`);
        if (entidadesSeleccionadas.length > 1) cells.push(`<td>${item.cliente_nombre}</td>`);
        if (camposSeleccionados.remito) cells.push(`<td>${item.numero_remito || '-'}</td>`);
        if (camposSeleccionados.comprobante) cells.push(`<td>${item.comprobante_cliente || '-'}</td>`);
        if (camposSeleccionados.productos) {
          const productosText = item.detalles?.map(d => {
            const efectivos = (d.kilos_reales || d.kilos_salida) - (d.descuento_kg || 0);
            return `${d.producto_nombre}: ${efectivos.toFixed(2)} kg`;
          }).join('<br>') || '-';
          cells.push(`<td>${productosText}</td>`);
        }
        if (camposSeleccionados.envases) {
          cells.push(`<td>${item.movimiento_envases?.map(e => `${e.envase_tipo}: +${e.cantidad_ingreso || 0}/-${e.cantidad_salida || 0}`).join('<br>') || '-'}</td>`);
        }
        return `<tr>${cells.join('')}</tr>`;
      }).join('');
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Informe - ${entidadSeleccionada?.nombre}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
          .title { font-size: 20px; font-weight: bold; color: #1e40af; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #eff6ff; font-weight: 600; }
          .totales { background: #dbeafe; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">INFORME ${tipoInforme === 'proveedor' ? 'DE PROVEEDOR(ES)' : 'DE CLIENTE(S)'}</div>
          <p>${nombreEntidades}</p>
          <p>Período: ${periodoText}</p>
        </div>
        
        ${headers.length > 0 ? `
        <h3>Detalle de Movimientos</h3>
        <table>
          <thead>
            <tr>
              ${headers.join('')}
            </tr>
          </thead>
          <tbody>
            ${movimientosHTML}
          </tbody>
        </table>` : ''}

        ${camposSeleccionados.totales ? '<h3>Totales del Período</h3>' : ''}
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Total Peso Neto</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(totales.totalesProductos).map(([prod, datos]) => `
              <tr>
                <td>${prod}</td>
                <td>${tipoInforme === 'proveedor' ? datos.toFixed(2) : datos.efectivos.toFixed(2)} kg</td>
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

  const exportarCSV = () => {
    let csv = `Informe ${tipoInforme === 'proveedor' ? 'de Proveedor(es)' : 'de Cliente(s)'} - ${nombreEntidades}\n`;
    csv += `Período: ${fechaDesde || 'Inicio'} - ${fechaHasta || 'Actual'}\n\n`;

    // Encabezados dinámicos basados en campos seleccionados
    let headers = [];
    if (camposSeleccionados.fecha) headers.push('Fecha');
    if (camposSeleccionados.tipo) headers.push('Tipo');
    if (entidadesSeleccionadas.length > 1) headers.push(tipoInforme === 'proveedor' ? 'Proveedor' : 'Cliente');
    if (tipoInforme === 'proveedor' && camposSeleccionados.fletero) headers.push('Fletero');
    if (tipoInforme === 'cliente') {
      if (camposSeleccionados.remito) headers.push('Remito R');
      if (camposSeleccionados.comprobante) headers.push('Comp. Cliente');
    }
    if (camposSeleccionados.productos) headers.push('Productos');
    if (camposSeleccionados.envases) headers.push('Envases');
    
    csv += headers.join(',') + '\n';

    if (tipoInforme === 'proveedor') {
      movimientosFiltrados.forEach(m => {
        let row = [];
        if (camposSeleccionados.fecha) row.push(`"${format(new Date(m.fecha), 'dd/MM/yyyy HH:mm')}"`);
        if (camposSeleccionados.tipo) row.push(`"${m.tipo_movimiento}"`);
        if (entidadesSeleccionadas.length > 1) row.push(`"${m.proveedor_nombre}"`);
        if (camposSeleccionados.fletero) row.push(`"${m.fletero_nombre || ''}"`);
        if (camposSeleccionados.productos) {
          const productos = m.pesajes?.map(p => `${p.producto_nombre}:${p.peso_neto}kg`).join(';') || '';
          row.push(`"${productos}"`);
        }
        if (camposSeleccionados.envases) {
          const envases = m.movimiento_envases?.map(e => `${e.envase_tipo}:+${e.cantidad_ingreso}/-${e.cantidad_salida}`).join(';') || '';
          row.push(`"${envases}"`);
        }
        csv += row.join(',') + '\n';
      });
    } else {
      movimientosFiltrados.forEach(item => {
        let row = [];
        if (camposSeleccionados.fecha) row.push(`"${format(new Date(item.fecha), 'dd/MM/yyyy HH:mm')}"`);
        if (camposSeleccionados.tipo) row.push(`"${item.detalles ? 'Salida de Fruta' : 'Movimiento de Envases'}"`);
        if (entidadesSeleccionadas.length > 1) row.push(`"${item.cliente_nombre}"`);
        if (camposSeleccionados.remito) row.push(`"${item.numero_remito || ''}"`);
        if (camposSeleccionados.comprobante) row.push(`"${item.comprobante_cliente || ''}"`);
        if (camposSeleccionados.productos) {
          const productos = item.detalles?.map(d => {
            const efectivos = (d.kilos_reales || d.kilos_salida) - (d.descuento_kg || 0);
            return `${d.producto_nombre}:${efectivos.toFixed(2)}kg`;
          }).join(';') || '';
          row.push(`"${productos}"`);
        }
        if (camposSeleccionados.envases) {
          const envases = item.movimiento_envases?.map(e => `${e.envase_tipo}:+${e.cantidad_ingreso}/-${e.cantidad_salida}`).join(';') || '';
          row.push(`"${envases}"`);
        }
        csv += row.join(',') + '\n';
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const nombreArchivo = entidadesSeleccionadas.length === 1 
      ? entidadesSeleccionadas[0].nombre.replace(/\s+/g, '_')
      : `${entidadesSeleccionadas.length}_${tipoInforme}s`;
    link.download = `informe_${nombreArchivo}_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" />
            Informes
          </h1>
          <p className="text-slate-600 mt-1">Generar reportes detallados de proveedores y clientes</p>
        </div>

        {advertenciaLimite && (
          <Card className="border-0 shadow-lg bg-amber-50 border-l-4 border-amber-500">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold mb-1">⚠️ Límite alcanzado</p>
                <p>Se cargaron los últimos 1,000 registros. Para búsquedas específicas o datos más antiguos, utiliza el módulo Historial con filtros de fecha.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Filtros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Tipo de Entidad *</label>
                  <Select value={tipoInforme} onValueChange={(val) => {
                    setTipoInforme(val);
                    setProveedoresSeleccionados([]);
                    setClientesSeleccionados([]);
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proveedor">Proveedor</SelectItem>
                      <SelectItem value="cliente">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {tipoInforme === 'proveedor' ? (
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 flex items-center justify-between">
                      <span>Proveedores *</span>
                      <button
                        onClick={() => {
                          if (proveedoresSeleccionados.length === proveedores.length) {
                            setProveedoresSeleccionados([]);
                          } else {
                            setProveedoresSeleccionados(proveedores.map(p => p.id));
                          }
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        {proveedoresSeleccionados.length === proveedores.length ? 'Desmarcar todos' : 'Marcar todos'}
                      </button>
                    </label>
                    <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-50 rounded-lg border">
                      {proveedores.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center">No hay proveedores</p>
                      ) : (
                        proveedores.map(p => (
                          <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={proveedoresSeleccionados.includes(p.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setProveedoresSeleccionados([...proveedoresSeleccionados, p.id]);
                                } else {
                                  setProveedoresSeleccionados(proveedoresSeleccionados.filter(id => id !== p.id));
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{p.nombre}</span>
                          </label>
                        ))
                      )}
                    </div>
                    {proveedoresSeleccionados.length > 0 && (
                      <p className="text-xs text-slate-600 mt-2">
                        {proveedoresSeleccionados.length} seleccionado(s)
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 flex items-center justify-between">
                      <span>Clientes *</span>
                      <button
                        onClick={() => {
                          if (clientesSeleccionados.length === clientes.length) {
                            setClientesSeleccionados([]);
                          } else {
                            setClientesSeleccionados(clientes.map(c => c.id));
                          }
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        {clientesSeleccionados.length === clientes.length ? 'Desmarcar todos' : 'Marcar todos'}
                      </button>
                    </label>
                    <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-50 rounded-lg border">
                      {clientes.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center">No hay clientes</p>
                      ) : (
                        clientes.map(c => (
                          <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={clientesSeleccionados.includes(c.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setClientesSeleccionados([...clientesSeleccionados, c.id]);
                                } else {
                                  setClientesSeleccionados(clientesSeleccionados.filter(id => id !== c.id));
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{c.nombre}</span>
                          </label>
                        ))
                      )}
                    </div>
                    {clientesSeleccionados.length > 0 && (
                      <p className="text-xs text-slate-600 mt-2">
                        {clientesSeleccionados.length} seleccionado(s)
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Rango de Fechas</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => aplicarRangoRapido(startOfMonth(new Date()), new Date())}
                      className="text-xs h-7"
                    >
                      Este Mes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => aplicarRangoRapido(
                        startOfMonth(subMonths(new Date(), 1)),
                        endOfMonth(subMonths(new Date(), 1))
                      )}
                      className="text-xs h-7"
                    >
                      Mes Pasado
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => aplicarRangoRapido(
                        startOfMonth(subMonths(new Date(), 2)),
                        new Date()
                      )}
                      className="text-xs h-7"
                    >
                      Últimos 3 Meses
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => aplicarRangoRapido(startOfYear(new Date()), new Date())}
                      className="text-xs h-7"
                    >
                      Este Año
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Desde</label>
                      <Input
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Hasta</label>
                      <Input
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Productos</label>
                  <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-50 rounded-lg border">
                    {productos.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center">No hay productos</p>
                    ) : (
                      productos.map(p => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={productosSeleccionados.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setProductosSeleccionados([...productosSeleccionados, p.id]);
                              } else {
                                setProductosSeleccionados(productosSeleccionados.filter(id => id !== p.id));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{p.producto_completo || `${p.fruta} - ${p.variedad}`}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {productosSeleccionados.length > 0 && (
                    <button
                      onClick={() => setProductosSeleccionados([])}
                      className="text-xs text-blue-600 hover:text-blue-700 mt-2"
                    >
                      Limpiar selección ({productosSeleccionados.length})
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Campos a Incluir</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={camposSeleccionados.fecha}
                      onChange={(e) => setCamposSeleccionados({...camposSeleccionados, fecha: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">Fecha</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={camposSeleccionados.tipo}
                      onChange={(e) => setCamposSeleccionados({...camposSeleccionados, tipo: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">Tipo de Movimiento</span>
                  </label>
                  {tipoInforme === 'proveedor' && (
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={camposSeleccionados.fletero}
                        onChange={(e) => setCamposSeleccionados({...camposSeleccionados, fletero: e.target.checked})}
                        className="rounded"
                      />
                      <span className="text-sm">Fletero</span>
                    </label>
                  )}
                  {tipoInforme === 'cliente' && (
                    <>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={camposSeleccionados.remito}
                          onChange={(e) => setCamposSeleccionados({...camposSeleccionados, remito: e.target.checked})}
                          className="rounded"
                        />
                        <span className="text-sm">Remito R</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={camposSeleccionados.comprobante}
                          onChange={(e) => setCamposSeleccionados({...camposSeleccionados, comprobante: e.target.checked})}
                          className="rounded"
                        />
                        <span className="text-sm">Comprobante Cliente</span>
                      </label>
                    </>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={camposSeleccionados.productos}
                      onChange={(e) => setCamposSeleccionados({...camposSeleccionados, productos: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">Productos</span>
                  </label>
                  {tipoInforme === 'proveedor' && (
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded ml-4">
                      <input
                        type="checkbox"
                        checked={camposSeleccionados.pesajes_detallados}
                        onChange={(e) => setCamposSeleccionados({...camposSeleccionados, pesajes_detallados: e.target.checked})}
                        className="rounded"
                        disabled={!camposSeleccionados.productos}
                      />
                      <span className="text-sm text-slate-600">Pesajes Detallados</span>
                    </label>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={camposSeleccionados.envases}
                      onChange={(e) => setCamposSeleccionados({...camposSeleccionados, envases: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">Movimiento de Envases</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={camposSeleccionados.totales}
                      onChange={(e) => setCamposSeleccionados({...camposSeleccionados, totales: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">Totales del Período</span>
                  </label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => setCamposSeleccionados({
                    fecha: true,
                    tipo: true,
                    fletero: true,
                    remito: true,
                    comprobante: true,
                    productos: true,
                    pesajes_detallados: false,
                    envases: true,
                    totales: true,
                    saldos: false
                  })}
                >
                  Seleccionar Todos
                </Button>
              </CardContent>
            </Card>

            {(proveedoresSeleccionados.length > 0 || clientesSeleccionados.length > 0) && movimientosFiltrados.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Exportar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button onClick={exportarPDF} className="w-full" variant="default">
                    <FileDown className="h-4 w-4 mr-2" />
                    Exportar a PDF
                  </Button>
                  <Button onClick={exportarCSV} className="w-full" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar a CSV
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-3">
            {(tipoInforme === 'proveedor' ? proveedoresSeleccionados.length === 0 : clientesSeleccionados.length === 0) ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-12 text-center">
                  <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    Seleccione {tipoInforme === 'proveedor' ? 'proveedores' : 'clientes'}
                  </h3>
                  <p className="text-slate-500">
                    Marque uno o más {tipoInforme === 'proveedor' ? 'proveedores' : 'clientes'} en el panel de filtros para generar el informe
                  </p>
                </CardContent>
              </Card>
            ) : movimientosFiltrados.length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-12 text-center">
                  <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin movimientos</h3>
                  <p className="text-slate-500">No hay datos para el período seleccionado</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Informe - {nombreEntidades}</span>
                      <Badge variant="outline">
                        {movimientosFiltrados.length} movimiento(s)
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            {camposSeleccionados.fecha && <th className="text-left p-3 font-semibold">Fecha</th>}
                            {camposSeleccionados.tipo && <th className="text-left p-3 font-semibold">Tipo</th>}
                            {entidadesSeleccionadas.length > 1 && <th className="text-left p-3 font-semibold">{tipoInforme === 'proveedor' ? 'Proveedor' : 'Cliente'}</th>}
                            {tipoInforme === 'cliente' && (
                              <>
                                {camposSeleccionados.remito && <th className="text-left p-3 font-semibold">Remito R</th>}
                                {camposSeleccionados.comprobante && <th className="text-left p-3 font-semibold">Comp. Cliente</th>}
                              </>
                            )}
                            {tipoInforme === 'proveedor' && camposSeleccionados.fletero && <th className="text-left p-3 font-semibold">Fletero</th>}
                            {camposSeleccionados.productos && <th className="text-left p-3 font-semibold">Productos</th>}
                            {camposSeleccionados.envases && <th className="text-left p-3 font-semibold">Envases</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {movimientosFiltrados.map((item, idx) => {
                            const esMovimiento = item.tipo_movimiento !== undefined;
                            const esSalida = item.detalles !== undefined;
                            
                            return (
                              <tr key={idx} className="border-b hover:bg-slate-50">
                                {camposSeleccionados.fecha && <td className="p-3">{format(new Date(item.fecha), 'dd/MM/yyyy HH:mm')}</td>}
                                {camposSeleccionados.tipo && (
                                  <td className="p-3">
                                    <Badge variant="outline">
                                      {esMovimiento ? item.tipo_movimiento : 'Salida de Fruta'}
                                    </Badge>
                                  </td>
                                )}
                                {entidadesSeleccionadas.length > 1 && (
                                  <td className="p-3 text-sm font-medium">
                                    {tipoInforme === 'proveedor' ? item.proveedor_nombre : item.cliente_nombre}
                                  </td>
                                )}
                                {tipoInforme === 'cliente' && (
                                  <>
                                    {camposSeleccionados.remito && <td className="p-3 font-mono text-xs">{item.numero_remito || '-'}</td>}
                                    {camposSeleccionados.comprobante && <td className="p-3 text-xs">{item.comprobante_cliente || '-'}</td>}
                                  </>
                                )}
                                {tipoInforme === 'proveedor' && camposSeleccionados.fletero && <td className="p-3">{item.fletero_nombre || '-'}</td>}
                                {camposSeleccionados.productos && (
                                  <td className="p-3">
                                    {item.pesajes?.map((p, i) => (
                                      <div key={i} className="text-xs">
                                        {p.producto_nombre}: <span className="font-semibold text-green-700">{(p.peso_neto || 0).toFixed(2)} kg</span>
                                      </div>
                                    ))}
                                    {item.detalles?.map((d, i) => {
                                      const efectivos = (d.kilos_reales || d.kilos_salida) - (d.descuento_kg || 0);
                                      return (
                                        <div key={i} className="text-xs">
                                          {d.producto_nombre}: <span className="font-semibold text-purple-700">{efectivos.toFixed(2)} kg</span>
                                          {d.descuento_kg > 0 && <span className="text-red-600"> (-{d.descuento_kg.toFixed(2)})</span>}
                                        </div>
                                      );
                                    })}
                                    {!item.pesajes && !item.detalles && '-'}
                                  </td>
                                )}
                                {camposSeleccionados.envases && (
                                  <td className="p-3">
                                    {item.movimiento_envases?.map((e, i) => (
                                      <div key={i} className="text-xs">
                                        {e.envase_tipo}: 
                                        {e.cantidad_ingreso > 0 && <span className="text-green-600"> +{e.cantidad_ingreso}</span>}
                                        {e.cantidad_salida > 0 && <span className="text-red-600"> -{e.cantidad_salida}</span>}
                                      </div>
                                    )) || '-'}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {camposSeleccionados.totales && (
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Totales del Período</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {Object.keys(totales.totalesProductos).length > 0 && (
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-3">Total por Producto</h4>
                        <div className="space-y-2">
                          {Object.entries(totales.totalesProductos).map(([prod, datos]) => (
                            <div key={prod} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                              <span className="font-medium">{prod}</span>
                              <span className="text-lg font-bold text-blue-700">
                                {tipoInforme === 'proveedor' 
                                  ? `${datos.toFixed(2)} kg` 
                                  : `${datos.efectivos.toFixed(2)} kg efectivos`
                                }
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Object.keys(totales.totalesEnvases).length > 0 && (
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-3">Total Movimiento de Envases</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="text-left p-2">Tipo</th>
                                <th className="text-right p-2">Ingresos</th>
                                <th className="text-right p-2">Salidas</th>
                                <th className="text-right p-2">Saldo Período</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(totales.totalesEnvases).map(([tipo, datos]) => {
                                const saldo = datos.salida - datos.ingreso;
                                return (
                                  <tr key={tipo} className="border-b">
                                    <td className="p-2">{tipo}</td>
                                    <td className="p-2 text-right text-green-600 font-semibold">+{datos.ingreso}</td>
                                    <td className="p-2 text-right text-red-600 font-semibold">-{datos.salida}</td>
                                    <td className={`p-2 text-right font-bold ${saldo > 0 ? 'text-red-600' : saldo < 0 ? 'text-green-600' : 'text-slate-600'}`}>
                                      {saldo > 0 ? '+' : ''}{saldo}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}