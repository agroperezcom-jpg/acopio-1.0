import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, FileText, Package, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { toast } from "sonner";
import { generateSalidaPDF, downloadSalidaPDF, shareSalidaWhatsApp } from "@/components/SalidaPDFGenerator";
import { toFixed2, restaExacta } from "../components/utils/precisionDecimal";
import { validarPerdidasNoRetornan } from "../components/utils/correccionRetroactivaPerdidas";
import { actualizarSaldoEntidad } from '@/utils/contabilidad';

export default function ConfirmarSalida({ embedded = false }) {
  const queryClient = useQueryClient();
  const [salidaSeleccionada, setSalidaSeleccionada] = useState(null);
  const [comprobanteCliente, setComprobanteCliente] = useState('');
  const [ajustes, setAjustes] = useState([]);

  const { data: salidas = [], isLoading } = useQuery({
    queryKey: ['salidas-pendientes-confirmacion'],
    queryFn: () =>
      base44.entities.SalidaFruta.filter(
        { estado: 'Pendiente de Confirmación' },
        '-created_date',
        100
      ),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('nombre', 100),
    staleTime: 10 * 60 * 1000
  });

  const { data: productos = [] } = useQuery({
    queryKey: ['productos'],
    queryFn: () => base44.entities.Producto.list('fruta', 100),
    staleTime: 10 * 60 * 1000
  });

  const salidasPendientes = salidas;

  const { data: periodosPrecios = [] } = useQuery({
    queryKey: ['periodosprecios'],
    queryFn: () => base44.entities.PeriodoPrecio.list(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const confirmarSalidaMutation = useMutation({
    mutationFn: async ({ salida, comprobante, ajustes }) => {
      // ═══════════════════════════════════════════════════════════════════
      // OBTENER PRECIO DE VENTA VIGENTE PARA CADA PRODUCTO
      // ═══════════════════════════════════════════════════════════════════
      const obtenerPrecioVigente = (productoId, fecha) => {
        const preciosOrdenados = periodosPrecios
          .filter(pp => pp.producto_id === productoId && pp.activo)
          .sort((a, b) => new Date(b.fecha_desde) - new Date(a.fecha_desde));
        
        const fechaSalida = new Date(fecha);
        const precioVigente = preciosOrdenados.find(pp => {
          const desde = new Date(pp.fecha_desde);
          const hasta = pp.fecha_hasta ? new Date(pp.fecha_hasta) : new Date('2099-12-31');
          return fechaSalida >= desde && fechaSalida <= hasta;
        });
        
        return precioVigente?.precio_venta_kg || 0;
      };

      // Calcular deuda total con precios vigentes
      let deudaTotal = 0;
      const detallesActualizados = salida.detalles.map((d, index) => {
        const ajuste = ajustes[index];
        const kilosEfectivos = (ajuste.kilos_reales || d.kilos_salida) - (ajuste.descuento_kg || 0);
        
        // OBTENER PRECIO VIGENTE DEL PERIODO
        const precioVigente = obtenerPrecioVigente(d.producto_id, salida.fecha);
        const deuda = kilosEfectivos * precioVigente;
        deudaTotal += deuda;

        return {
          ...d,
          kilos_reales: ajuste.kilos_reales || d.kilos_salida,
          descuento_kg: ajuste.descuento_kg || 0,
          motivo_ajuste: ajuste.motivo_ajuste || '',
          precio_kg: precioVigente // GUARDAR EL PRECIO VIGENTE
        };
      });

      // Actualizar salida
      const salidaActualizada = await base44.entities.SalidaFruta.update(salida.id, {
        estado: 'Confirmada',
        estado_cobro: 'Pendiente',
        monto_cobrado: 0,
        comprobante_cliente: comprobante,
        detalles: detallesActualizados,
        deuda_total: deudaTotal
      });

      // ═══════════════════════════════════════════════════════════════════
      // CREAR MOVIMIENTO EN CUENTA CORRIENTE DEL CLIENTE
      // ═══════════════════════════════════════════════════════════════════
      if (salida.cliente_id && deudaTotal > 0) {
        // Verificar si ya existe un movimiento de CC para esta salida
        const movimientosCC = await base44.entities.CuentaCorriente.filter({
          comprobante_tipo: 'SalidaFruta',
          comprobante_id: salida.id
        });

        if (movimientosCC.length === 0) {
          // Obtener el último saldo del cliente para calcular saldo resultante
          const ultimosMovs = await base44.entities.CuentaCorriente.filter(
            { entidad_id: salida.cliente_id, entidad_tipo: 'Cliente' },
            '-fecha',
            1
          );
          
          const saldoAnterior = ultimosMovs.length > 0 ? (ultimosMovs[0].saldo_resultante || 0) : 0;
          const nuevoSaldo = saldoAnterior + deudaTotal;

          await base44.entities.CuentaCorriente.create({
            fecha: salida.fecha,
            tipo_movimiento: 'Haber',
            entidad_tipo: 'Cliente',
            entidad_id: salida.cliente_id,
            entidad_nombre: salida.cliente_nombre,
            monto: deudaTotal,
            saldo_resultante: nuevoSaldo,
            concepto: `Salida de fruta - ${salida.numero_remito}`,
            comprobante_id: salida.id,
            comprobante_tipo: 'SalidaFruta'
          });
          await actualizarSaldoEntidad(base44, 'Cliente', salida.cliente_id, deudaTotal);
        } else {
          // Ya existe, actualizar el monto si cambió
          if (movimientosCC[0].monto !== deudaTotal) {
            const diferencia = deudaTotal - movimientosCC[0].monto;
            await base44.entities.CuentaCorriente.update(movimientosCC[0].id, {
              monto: deudaTotal,
              saldo_resultante: (movimientosCC[0].saldo_resultante || 0) + diferencia
            });
            await actualizarSaldoEntidad(base44, 'Cliente', salida.cliente_id, diferencia);
          }
        }
      }

      // CORRECCIÓN ABSOLUTA: PÉRDIDAS IRREVERSIBLES - NUNCA VUELVEN AL STOCK
      // ═══════════════════════════════════════════════════════════════════
      // 
      // LÓGICA INQUEBRANTABLE RETROACTIVA:
      // 1. Al crear la salida en SalidaFruta.jsx: Stock fue RESTADO por kilos_salida originales
      // 2. En confirmación (AQUÍ): Las pérdidas son DEFINITIVAS, NO se revierten
      // 3. Stock NO se modifica en confirmación - todo lo que salió YA está fuera permanentemente
      // 4. RETROACTIVAMENTE: Corrección elimina sumas erróneas de pérdidas en registros viejos
      //
      // FLUJO DE PÉRDIDAS:
      // - Kilos Salida Original (ej: 2637.00 kg) → YA RESTADOS DEL STOCK en SalidaFruta
      // - Kilos Reales Recibidos (ej: 2632.00 kg) → lo que llegó al cliente
      // - PÉRDIDA BÁSCULA = Originales - Reales (ej: 2637.00 - 2632.00 = 5.00 kg)
      // - PÉRDIDA CALIDAD = Descuento en Kilos (ej: 78.96 kg por clasificación/calidad)
      // - PÉRDIDA TOTAL = Báscula + Calidad (ej: 5.00 + 78.96 = 83.96 kg DEFINITIVOS)
      // - Kilos Efectivos a Cobrar = Reales - Descuento (ej: 2632.00 - 78.96 = 2553.04 kg)
      //
      // VALIDACIÓN Y REGISTRO DE PÉRDIDAS (sin impacto en stock):
      
      let perdidaTotalGlobal = 0;
      
      for (let i = 0; i < salida.detalles.length; i++) {
        const detalle = salida.detalles[i];
        const ajuste = ajustes[i];
        
        if (detalle.producto_id) {
          const kilosOriginales = detalle.kilos_salida;
          const kilosReales = ajuste.kilos_reales || kilosOriginales;
          const descuentoKg = ajuste.descuento_kg || 0;
          const kilosEfectivos = kilosReales - descuentoKg;
          
          // Cálculo de AJUSTES DE BÁSCULA (pérdida o ganancia) + DESCUENTO DE CALIDAD
          const ajusteBascula = toFixed2(kilosReales - kilosOriginales); // positivo = ganancia, negativo = pérdida
          const perdidaCalidad = descuentoKg;
          const ajusteTotal = toFixed2(ajusteBascula - perdidaCalidad); // ganancia neta o pérdida neta
          
          // Solo registrar en pérdidas globales si hay pérdida neta
          if (ajusteTotal < 0) {
            perdidaTotalGlobal += Math.abs(ajusteTotal);
          }
          
          // VALIDACIÓN: Si hay pérdida neta, verificar que NO vuelva al stock
          if (ajusteTotal < 0) {
            const producto = await base44.entities.Producto.filter({ id: detalle.producto_id });
            if (producto && producto.length > 0) {
              validarPerdidasNoRetornan(producto[0], Math.abs(ajusteTotal));
            }
          }
        }
      }

      return salidaActualizada;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['salidas'] });
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['envases'] });
      queryClient.invalidateQueries({ queryKey: ['cuentascorrientes'] });
      
      const cliente = clientes.find(c => c.id === data.cliente_id);
      
      toast.success('Salida confirmada exitosamente', {
        action: {
          label: 'Ver PDF',
          onClick: () => {
            const html = generateSalidaPDF(data);
            downloadSalidaPDF(html, data.numero_remito);
          },
        },
      });

      // Opción para compartir por WhatsApp
      if (cliente?.whatsapp) {
        setTimeout(() => {
          toast.info('¿Compartir por WhatsApp?', {
            action: {
              label: 'Compartir',
              onClick: () => shareSalidaWhatsApp(data, cliente.whatsapp),
            },
          });
        }, 1000);
      }

      setSalidaSeleccionada(null);
      setComprobanteCliente('');
      setAjustes([]);
    },
  });

  const handleSeleccionarSalida = (salida) => {
    setSalidaSeleccionada(salida);
    setComprobanteCliente('');
    setAjustes(salida.detalles.map(d => ({
      kilos_reales: d.kilos_salida,
      descuento_kg: 0,
      motivo_ajuste: ''
    })));
  };

  const handleAjusteChange = (index, field, value) => {
    const nuevosAjustes = [...ajustes];
    nuevosAjustes[index] = {
      ...nuevosAjustes[index],
      [field]: field === 'motivo_ajuste' ? value : parseFloat(value) || 0
    };
    setAjustes(nuevosAjustes);
  };

  const handleConfirmar = () => {
    if (!comprobanteCliente.trim()) {
      alert('Por favor ingrese el comprobante del cliente');
      return;
    }

    // VALIDACIONES FLEXIBLES - PÉRDIDAS Y GANANCIAS DE BÁSCULA
    for (let i = 0; i < ajustes.length; i++) {
      const ajuste = ajustes[i];
      const original = salidaSeleccionada.detalles[i].kilos_salida;
      const nombreProducto = salidaSeleccionada.detalles[i].producto_nombre;
      
      // Validar que descuento no exceda reales
      if (ajuste.descuento_kg > ajuste.kilos_reales) {
        alert(`❌ ERROR - ${nombreProducto}: El descuento por calidad (${ajuste.descuento_kg.toFixed(2)} kg) no puede exceder los kilos reales recibidos (${ajuste.kilos_reales.toFixed(2)} kg).`);
        return;
      }
      
      // Validar que no haya valores negativos
      if (ajuste.kilos_reales < 0 || ajuste.descuento_kg < 0) {
        alert(`❌ ERROR - ${nombreProducto}: Los valores no pueden ser negativos.`);
        return;
      }
    }

    confirmarSalidaMutation.mutate({
      salida: salidaSeleccionada,
      comprobante: comprobanteCliente,
      ajustes: ajustes
    });
  };

  return (
    <div className={embedded ? "" : "min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8"}>
      <div className={embedded ? "" : "max-w-6xl mx-auto space-y-6"}>
        {!embedded && (
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              Confirmar Salidas de Fruta
            </h1>
            <p className="text-slate-600 mt-1">Registrar comprobante del cliente y ajustar kilos reales recibidos</p>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-slate-500">Cargando salidas...</div>
        ) : salidasPendientes.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                No hay salidas pendientes
              </h3>
              <p className="text-slate-500">Todas las salidas están confirmadas</p>
            </CardContent>
          </Card>
        ) : !salidaSeleccionada ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-700">Salidas Pendientes ({salidasPendientes.length})</h2>
            {salidasPendientes.map((salida) => (
              <Card key={salida.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => handleSeleccionarSalida(salida)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5 text-purple-600" />
                        {salida.numero_remito}
                      </CardTitle>
                      <p className="text-sm text-slate-600 mt-1">
                        {format(new Date(salida.fecha), "dd/MM/yyyy HH:mm", { locale: es })}
                      </p>
                    </div>
                    <Badge className="bg-amber-500">Pendiente</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-slate-500">Cliente</p>
                      <p className="font-semibold text-slate-800">{salida.cliente_nombre}</p>
                    </div>
                    {salida.fletero_nombre && (
                      <div>
                        <p className="text-xs text-slate-500">Fletero</p>
                        <p className="font-semibold text-slate-800">{salida.fletero_nombre}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Productos</p>
                    <div className="flex flex-wrap gap-2">
                      {salida.detalles?.map((d, i) => (
                        <Badge key={i} variant="outline" className="bg-purple-50">
                          {d.producto_nombre}: {d.kilos_salida.toFixed(2)} kg
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Confirmación de {salidaSeleccionada.numero_remito}</CardTitle>
                  <Button variant="outline" onClick={() => setSalidaSeleccionada(null)}>
                    Volver a lista
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-100 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-500">Cliente</p>
                    <p className="font-semibold">{salidaSeleccionada.cliente_nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Fecha Original</p>
                    <p className="font-semibold">{format(new Date(salidaSeleccionada.fecha), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Comprobante del Cliente *
                  </label>
                  <Input
                    placeholder="Ej: FAC-A-00001234"
                    value={comprobanteCliente}
                    onChange={(e) => setComprobanteCliente(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">Número de factura, remito u otro documento del cliente</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    Ajuste de Kilos y Clasificación
                  </h3>
                  
                  <div className="space-y-4">
                    {salidaSeleccionada.detalles?.map((detalle, index) => {
                      const ajuste = ajustes[index];
                      const kilosEfectivos = (ajuste?.kilos_reales || detalle.kilos_salida) - (ajuste?.descuento_kg || 0);
                      const deuda = kilosEfectivos * (detalle.precio_kg || 0);
                      
                      return (
                        <Card key={index} className="bg-amber-50 border-amber-200">
                          <CardContent className="pt-4 space-y-4">
                            <div>
                              <h4 className="font-semibold text-slate-800 mb-1">{detalle.producto_nombre}</h4>
                              <p className="text-sm text-slate-600">
                                Precio: {detalle.precio_kg > 0 ? `$${detalle.precio_kg.toFixed(2)}/kg` : 'No configurado'}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">
                                  Kilos Salida Original
                                </label>
                                <Input
                                  type="number"
                                  value={detalle.kilos_salida.toFixed(2)}
                                  disabled
                                  className="bg-slate-200 text-slate-700 font-semibold"
                                />
                              </div>

                              <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">
                                  Kilos Reales Recibidos (Báscula Cliente) *
                                </label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={ajuste?.kilos_reales ?? detalle.kilos_salida}
                                  placeholder={detalle.kilos_salida.toFixed(2)}
                                  onChange={(e) => handleAjusteChange(index, 'kilos_reales', e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className={`font-semibold ${(ajuste?.kilos_reales || detalle.kilos_salida) > detalle.kilos_salida ? 'text-green-700' : (ajuste?.kilos_reales || detalle.kilos_salida) < detalle.kilos_salida ? 'text-red-600' : ''}`}
                                  inputMode="decimal"
                                />
                                {ajuste?.kilos_reales && ajuste.kilos_reales !== detalle.kilos_salida && (
                                  <p className={`text-xs mt-1 font-medium ${ajuste.kilos_reales > detalle.kilos_salida ? 'text-green-700' : 'text-red-600'}`}>
                                    {ajuste.kilos_reales > detalle.kilos_salida ? '▲' : '▼'} {Math.abs(ajuste.kilos_reales - detalle.kilos_salida).toFixed(2)} kg {ajuste.kilos_reales > detalle.kilos_salida ? '(Ganancia báscula)' : '(Pérdida báscula)'}
                                  </p>
                                )}
                              </div>

                              <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">
                                  Descuento por Calidad (kg)
                                </label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={ajuste?.descuento_kg ?? ''}
                                  placeholder="0.00"
                                  onChange={(e) => handleAjusteChange(index, 'descuento_kg', e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className="text-red-600 font-semibold"
                                  inputMode="decimal"
                                />
                                <p className="text-xs text-slate-500 mt-1">Clasificación, calidad, etc.</p>
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-medium text-slate-600 mb-1 block">
                                Motivo de Ajuste (Opcional)
                              </label>
                              <Textarea
                                placeholder="Ej: Clasificación por calidad, producto en mal estado..."
                                value={ajuste?.motivo_ajuste || ''}
                                onChange={(e) => handleAjusteChange(index, 'motivo_ajuste', e.target.value)}
                                rows={2}
                              />
                            </div>

                            <div className="p-3 bg-white rounded-lg border-2 border-green-200">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium text-slate-600">Kilos Efectivos a Cobrar:</span>
                                <span className="text-lg font-bold text-green-700">
                                  {kilosEfectivos.toFixed(2)} kg
                                </span>
                              </div>
                              {detalle.precio_kg > 0 && (
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-slate-600">Deuda del Cliente:</span>
                                  <span className="text-xl font-bold text-green-800">
                                    ${deuda.toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  <div className="mt-6 p-4 bg-green-100 rounded-lg border-2 border-green-300">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-green-900">TOTAL KILOS EFECTIVOS:</span>
                      <span className="text-2xl font-bold text-green-900">
                        {ajustes.reduce((sum, aj, i) => {
                          const kilosEfectivos = (aj.kilos_reales || salidaSeleccionada.detalles[i].kilos_salida) - (aj.descuento_kg || 0);
                          return sum + kilosEfectivos;
                        }, 0).toFixed(2)} kg
                      </span>
                    </div>
                    {salidaSeleccionada.detalles?.some(d => d.precio_kg > 0) && (
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-green-300">
                        <span className="text-lg font-semibold text-green-900">DEUDA TOTAL CLIENTE:</span>
                        <span className="text-3xl font-bold text-green-900">
                          ${ajustes.reduce((sum, aj, i) => {
                            const detalle = salidaSeleccionada.detalles[i];
                            const kilosEfectivos = (aj.kilos_reales || detalle.kilos_salida) - (aj.descuento_kg || 0);
                            return sum + (kilosEfectivos * (detalle.precio_kg || 0));
                          }, 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setSalidaSeleccionada(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirmar}
                    disabled={confirmarSalidaMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    {confirmarSalidaMutation.isPending ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        Confirmar Salida
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}