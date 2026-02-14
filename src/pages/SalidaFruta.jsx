import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, ShoppingCart, Truck, Trash2, Package } from "lucide-react";
import { format } from "date-fns";
import AsyncSelect from "@/components/AsyncSelect";
import DetalleLineItem from "@/components/DetalleLineItem";
import EnvaseLineItemLlenos from "@/components/EnvaseLineItemLlenos";
import ConfirmDetalleModal from "@/components/ConfirmDetalleModal";
import ConfirmEnvaseModal from "@/components/ConfirmEnvaseModal";
import QuickCreateModal from "@/components/QuickCreateModal";
import GenericSuccessModal from "@/components/GenericSuccessModal";
import { toast } from "sonner";
import { toFixed2 } from "@/components/utils/precisionDecimal";
import { invalidarTodoElSistema } from '@/utils/queryHelpers';
import { actualizarSaldoEntidad } from '@/utils/contabilidad';
import { ajustarStockProducto, ajustarStockEnvase } from '@/services/StockService';
import { actualizarDeudaEnvase } from '@/services/SaldoEnvasesService';

export default function SalidaFruta({ embedded = false }) {
  const queryClient = useQueryClient();
  
  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [numeroRemito, setNumeroRemito] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [clienteData, setClienteData] = useState(null);
  const [fleteroId, setFleteroId] = useState('');
  const [fleteroData, setFleteroData] = useState(null);
  const [notas, setNotas] = useState('');
  const [detalles, setDetalles] = useState([]);
  const [envasesLlenos, setEnvasesLlenos] = useState([]);
  const [envaseActual, setEnvaseActual] = useState({
    envase_id: '',
    envase_tipo: '',
    cantidad: 0
  });
  
  const [detalleActual, setDetalleActual] = useState({
    producto_id: '',
    producto_nombre: '',
    kilos_salida: 0,
    stock_disponible: 0
  });

  const [confirmDetalleModal, setConfirmDetalleModal] = useState({ open: false, detalle: null });
  const [createModal, setCreateModal] = useState({ open: false, type: null });
  const [successModal, setSuccessModal] = useState({ open: false, data: null });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: salidas = [] } = useQuery({
    queryKey: ['salidas'],
    queryFn: () => base44.entities.SalidaFruta.list('-created_date'),
  });

  const { data: envases = [] } = useQuery({
    queryKey: ['envases'],
    queryFn: () => base44.entities.Envase.list('tipo'),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: periodosPrecios = [] } = useQuery({
    queryKey: ['periodosprecios'],
    queryFn: () => base44.entities.PeriodoPrecio.list()
  });

  // Autogenerar remito al inicio
  React.useEffect(() => {
    if (!numeroRemito) {
      setNumeroRemito(generarNumeroRemito());
    }
  }, [salidas]);

  // Stock de envases ocupados desde campo vivo (envase.stock_ocupados)
  const stockEnvasesOcupados = React.useMemo(() => {
    const stockPorTipo = {};
    envases.forEach(e => {
      stockPorTipo[e.id] = {
        tipo: e.tipo,
        ocupados: Math.max(0, Number(e.stock_ocupados) || 0)
      };
    });
    return stockPorTipo;
  }, [envases]);

  const crearClienteMutation = useMutation({
    mutationFn: (data) => base44.entities.Cliente.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setCreateModal({ open: false, type: null });
      toast.success('Cliente creado exitosamente');
    },
  });

  const crearFleteroMutation = useMutation({
    mutationFn: (data) => base44.entities.Fletero.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleteros'] });
      setCreateModal({ open: false, type: null });
      toast.success('Fletero creado exitosamente');
    },
  });

  const crearProductoMutation = useMutation({
    mutationFn: async (data) => {
      const nuevoProducto = {
        ...data,
        producto_completo: `${data.fruta} - ${data.variedad}`,
        stock: 0
      };
      return base44.entities.Producto.create(nuevoProducto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      setCreateModal({ open: false, type: null });
      toast.success('Producto creado exitosamente');
    },
  });

  const crearEnvaseMutation = useMutation({
    mutationFn: (data) => base44.entities.Envase.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['envases'] });
      setCreateModal({ open: false, type: null });
      toast.success('Envase creado exitosamente');
    },
  });

  const handleAgregarDetalle = () => {
    if (!detalleActual.producto_id) {
      alert('Por favor seleccione un producto');
      return;
    }
    if (detalleActual.kilos_salida <= 0) {
      alert('Por favor ingrese kilos válidos');
      return;
    }
    if (detalleActual.kilos_salida > detalleActual.stock_disponible) {
      alert(`Stock insuficiente. Disponible: ${detalleActual.stock_disponible.toFixed(2)} kg | Solicitado: ${detalleActual.kilos_salida.toFixed(2)} kg | Faltante: ${(detalleActual.kilos_salida - detalleActual.stock_disponible).toFixed(2)} kg`);
      return;
    }
    
    setConfirmDetalleModal({ open: true, detalle: detalleActual });
  };

  const confirmarDetalle = () => {
    setDetalles([...detalles, {
      ...confirmDetalleModal.detalle,
      kilos_reales: confirmDetalleModal.detalle.kilos_salida,
      descuento_kg: 0
    }]);
    setConfirmDetalleModal({ open: false, detalle: null });
    setDetalleActual({
      producto_id: '',
      producto_nombre: '',
      kilos_salida: 0,
      stock_disponible: 0
    });
  };

  const updateDetalleActual = (data) => {
    setDetalleActual(data);
  };

  const removeDetalle = (index) => {
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  const generarNumeroRemito = () => {
    const ultimaSalida = salidas[0];
    if (!ultimaSalida?.numero_remito) {
      return 'R00001-00000001';
    }
    
    const [parte1, parte2] = ultimaSalida.numero_remito.split('-');
    const numero = parseInt(parte2) + 1;
    return `R00001-${numero.toString().padStart(8, '0')}`;
  };

  const handleSubmit = async () => {
    if (!clienteId) {
      alert('Por favor seleccione un cliente');
      return;
    }

    if (detalles.length === 0) {
      alert('Por favor agregue al menos un producto');
      return;
    }

    if (!numeroRemito.trim()) {
      alert('Por favor ingrese un número de remito');
      return;
    }

    // Validar que no exista duplicado
    const existeRemito = salidas.find(s => s.numero_remito === numeroRemito.trim());
    if (existeRemito) {
      alert(`El remito "${numeroRemito}" ya existe. Por favor use un número diferente.`);
      return;
    }

    // Validar stock de productos
    for (const detalle of detalles) {
      const producto = productos.find(p => p.id === detalle.producto_id);
      if (producto && detalle.kilos_salida > (producto.stock || 0)) {
        alert(`Error: Producto "${detalle.producto_nombre}" - Stock insuficiente. Disponible: ${producto.stock.toFixed(2)} kg, Solicitado: ${detalle.kilos_salida.toFixed(2)} kg`);
        return;
      }
    }

    // Validar stock de envases llenos por tipo (usar stock REAL calculado)
    for (const envLleno of envasesLlenos) {
      if (envLleno.cantidad > 0) {
        const stockReal = stockEnvasesOcupados[envLleno.envase_id];
        const disponible = Math.max(0, stockReal?.ocupados || 0);
        if (envLleno.cantidad > disponible) {
          alert(`Error: Stock de "${envLleno.envase_tipo}" ocupados insuficiente. Disponible: ${disponible}, Solicitado: ${envLleno.cantidad}`);
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      const clienteNombre = clienteData?.nombre || '';
      const fleteroNombre = fleteroData?.nombre || '';

      // Obtener precios vigentes para cada producto
      const obtenerPrecioVigente = (productoId, fecha) => {
        const preciosOrdenados = periodosPrecios
          .filter(pp => pp.producto_id === productoId && pp.activo)
          .sort((a, b) => new Date(b.fecha_desde) - new Date(a.fecha_desde));
        
        const fechaMovimiento = new Date(fecha);
        const precioVigente = preciosOrdenados.find(pp => new Date(pp.fecha_desde) <= fechaMovimiento);
        
        if (precioVigente) {
          return precioVigente.precio_venta_kg;
        }
        
        const precioMasReciente = preciosOrdenados[0];
        return precioMasReciente?.precio_venta_kg || 0;
      };

      // Agregar precio_kg a cada detalle (precio de venta)
      const detallesConPrecio = detalles.map(d => {
        const precioVenta = obtenerPrecioVigente(d.producto_id, fecha);
        return {
          ...d,
          precio_kg: precioVenta,
          kilos_reales: d.kilos_salida,
          descuento_kg: 0,
          motivo_ajuste: ''
        };
      });

      // Calcular deuda total de la salida
      const deudaTotalSalida = detallesConPrecio.reduce((sum, d) => {
        return sum + (d.kilos_salida * d.precio_kg);
      }, 0);

      const salidaData = {
        numero_remito: numeroRemito.trim(),
        fecha: new Date(fecha).toISOString(),
        cliente_id: clienteId,
        cliente_nombre: clienteNombre,
        fletero_id: fleteroId || null,
        fletero_nombre: fleteroNombre,
        estado: 'Pendiente de Confirmación',
        detalles: detallesConPrecio,
        envases_llenos: envasesLlenos.filter(e => e.cantidad > 0),
        deuda_total: deudaTotalSalida,
        estado_cobro: 'Pendiente',
        monto_cobrado: 0,
        notas: notas
      };

      const nuevaSalida = await base44.entities.SalidaFruta.create(salidaData);

      // Agrupar detalles por producto y sumar kilos a restar
      const stockAPorProducto = {};
      detalles.forEach(detalle => {
        if (detalle.producto_id && detalle.kilos_salida) {
          if (!stockAPorProducto[detalle.producto_id]) {
            stockAPorProducto[detalle.producto_id] = 0;
          }
          stockAPorProducto[detalle.producto_id] += detalle.kilos_salida;
        }
      });
      
      // Ajustar stock vivo de productos (incremental, negativo = salida)
      for (const [productoId, totalSalida] of Object.entries(stockAPorProducto)) {
        await ajustarStockProducto(base44, productoId, -totalSalida);
      }

      // Ajustar stock vivo de envases ocupados (restar)
      for (const envLleno of nuevaSalida.envases_llenos || []) {
        if (envLleno.cantidad > 0 && envLleno.envase_id) {
          await ajustarStockEnvase(base44, envLleno.envase_id, -envLleno.cantidad, 0);
        }
      }

      // Actualizar saldo vivo de envases: cliente se lleva envases llenos → su deuda con nosotros AUMENTA
      for (const envLleno of nuevaSalida.envases_llenos || []) {
        if (envLleno.cantidad > 0 && envLleno.envase_tipo && clienteId) {
          await actualizarDeudaEnvase(base44, 'Cliente', clienteId, envLleno.envase_tipo, envLleno.cantidad);
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // CREAR MOVIMIENTO EN CUENTA CORRIENTE - AUMENTA DEUDA CLIENTE
      // ═══════════════════════════════════════════════════════════════
      if (deudaTotalSalida > 0) {
        // Obtener el saldo anterior de este cliente
        const movimientosCliente = await base44.entities.CuentaCorriente.filter({
          entidad_tipo: 'Cliente',
          entidad_id: clienteId
        }, '-fecha');
        const saldoAnterior = movimientosCliente.length > 0 ? (movimientosCliente[0].saldo_resultante || 0) : 0;
        const nuevoSaldo = saldoAnterior + deudaTotalSalida;

        await base44.entities.CuentaCorriente.create({
          fecha: new Date(fecha).toISOString(),
          tipo_movimiento: 'Haber',
          entidad_tipo: 'Cliente',
          entidad_id: clienteId,
          entidad_nombre: clienteNombre,
          monto: deudaTotalSalida,
          saldo_resultante: nuevoSaldo,
          concepto: `Salida de Fruta - ${numeroRemito.trim()}`,
          comprobante_id: nuevaSalida.id,
          comprobante_tipo: 'SalidaFruta'
        });
        await actualizarSaldoEntidad(base44, 'Cliente', clienteId, deudaTotalSalida);
      }

      // Invalidar todas las queries del sistema
      invalidarTodoElSistema(queryClient);

      setSuccessModal({ open: true, data: { ...nuevaSalida, cliente_whatsapp: cliente?.whatsapp } });
      
    } catch (error) {
      console.error('Error al registrar salida:', error);
      alert('Error al registrar la salida');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = () => {
    import('@/components/SalidaPDFGenerator').then(({ generateSalidaPDF, downloadSalidaPDF }) => {
      const html = generateSalidaPDF(successModal.data);
      downloadSalidaPDF(html, successModal.data.numero_remito);
    });
  };

  const handleShareWhatsApp = async () => {
    const { shareSalidaWhatsApp } = await import('@/components/SalidaPDFGenerator');
    await shareSalidaWhatsApp(successModal.data, clienteData?.whatsapp);
  };

  const resetForm = () => {
    setFecha(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setNumeroRemito(generarNumeroRemito());
    setClienteId('');
    setClienteData(null);
    setFleteroId('');
    setFleteroData(null);
    setNotas('');
    setDetalles([]);
    setEnvasesLlenos([]);
    setEnvaseActual({ envase_id: '', envase_tipo: '', cantidad: 0 });
    setDetalleActual({
      producto_id: '',
      producto_nombre: '',
      kilos_salida: 0,
      stock_disponible: 0
    });
  };

  return (
    <div className={embedded ? "" : "min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8"}>
      <div className={embedded ? "" : "max-w-5xl mx-auto space-y-6"}>
        {!embedded && (
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-purple-600" />
              Salida de Fruta
            </h1>
            <p className="text-slate-600 mt-1">Registrar salida de productos a clientes</p>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Información General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Comprobante Asociado (Remito R) *</label>
                  <Input
                    type="text"
                    value={numeroRemito}
                    onChange={(e) => setNumeroRemito(e.target.value)}
                    className="font-mono"
                    placeholder="R00001-00000001"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">Número completo editable</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Fecha y Hora</label>
                  <Input
                    type="datetime-local"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Cliente *</label>
                  <AsyncSelect
                    entityKey="Cliente"
                    value={clienteId}
                    onChange={(id, option) => { setClienteId(id); setClienteData(option); }}
                    placeholder="Buscar cliente..."
                    onCreateNew={() => setCreateModal({ open: true, type: 'cliente' })}
                    createNewLabel="Crear nuevo cliente"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Fletero (Opcional)</label>
                  <AsyncSelect
                    entityKey="Fletero"
                    value={fleteroId}
                    onChange={(id, option) => { setFleteroId(id); setFleteroData(option); }}
                    placeholder="Buscar fletero..."
                    onCreateNew={() => setCreateModal({ open: true, type: 'fletero' })}
                    createNewLabel="Crear nuevo fletero"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-slate-400" />
                Nuevo Detalle de Salida
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <DetalleLineItem
                  item={detalleActual}
                  index={0}
                  onChange={(_, data) => updateDetalleActual(data)}
                  onCreateProducto={() => setCreateModal({ open: true, type: 'producto' })}
                />
                
                <div className="flex justify-end">
                  <Button 
                    type="button"
                    onClick={handleAgregarDetalle}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar a Lista
                  </Button>
                </div>
              </div>

              {detalles.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-700">Productos Agregados ({detalles.length})</h4>
                    <span className="text-sm text-slate-600">
                      Total: <strong>{detalles.reduce((s, d) => s + d.kilos_salida, 0).toFixed(2)} kg</strong>
                    </span>
                  </div>
                  <div className="space-y-3">
                    {detalles.map((detalle, index) => (
                      <div key={index} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-slate-800">{detalle.producto_nombre}</p>
                            <p className="text-sm text-slate-600 mt-1">
                              Kilos: <strong className="text-purple-700">{detalle.kilos_salida.toFixed(2)} kg</strong>
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDetalle(index)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 ml-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5 text-slate-400" />
                Envases Llenos con Fruta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <EnvaseLineItemLlenos
                  item={envaseActual}
                  index={0}
                  onChange={(_, data) => setEnvaseActual(data)}
                  onRemove={() => {}}
                  onCreateEnvase={() => setCreateModal({ open: true, type: 'envase' })}
                  showRemove={false}
                />
                
                <div className="flex justify-end">
                  <Button 
                    type="button"
                    onClick={() => {
                      if (!envaseActual.envase_id || envaseActual.cantidad <= 0) {
                        alert('Seleccione un envase y cantidad válida');
                        return;
                      }
                      setEnvasesLlenos([...envasesLlenos, envaseActual]);
                      setEnvaseActual({ envase_id: '', envase_tipo: '', cantidad: 0 });
                    }}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </div>

                {/* Lista de envases agregados */}
                {envasesLlenos.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-semibold text-slate-700 mb-3">Envases Llenos Agregados</h4>
                    <div className="space-y-2">
                      {envasesLlenos.map((env, idx) => (
                        <div key={idx} className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-800">{env.envase_tipo}</p>
                            <p className="text-sm text-amber-700">Cantidad: {env.cantidad} llenos</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setEnvasesLlenos(envasesLlenos.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <Package className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-900">
                      <p className="font-semibold mb-1">ℹ️ Nota importante:</p>
                      <p>Los envases vacíos se gestionan en "Movimiento de Envases". Aquí solo registre envases que salen llenos con fruta → se restan de Stock Ocupados.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardContent className="pt-6">
              <label className="text-sm font-medium text-slate-700 mb-1 block">Notas Adicionales</label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Observaciones adicionales..."
                rows={3}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button 
              type="submit" 
              size="lg" 
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Registrar Salida
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      <ConfirmDetalleModal
        open={confirmDetalleModal.open}
        onClose={() => setConfirmDetalleModal({ open: false, detalle: null })}
        detalle={confirmDetalleModal.detalle}
        onConfirm={confirmarDetalle}
        onEdit={() => setConfirmDetalleModal({ open: false, detalle: null })}
      />

      <QuickCreateModal
        open={createModal.open && createModal.type === 'cliente'}
        onClose={() => setCreateModal({ open: false, type: null })}
        onSave={(data) => crearClienteMutation.mutate(data)}
        title="Crear Nuevo Cliente"
        fields={[
          { name: 'nombre', label: 'Nombre', placeholder: 'Nombre del cliente', type: 'text' },
          { name: 'direccion', label: 'Dirección', placeholder: 'Dirección', type: 'text' },
          { name: 'cuit', label: 'CUIT', placeholder: 'CUIT', type: 'text' },
          { name: 'whatsapp', label: 'WhatsApp', placeholder: '+54...', type: 'text' }
        ]}
        isLoading={crearClienteMutation.isPending}
      />

      <QuickCreateModal
        open={createModal.open && createModal.type === 'fletero'}
        onClose={() => setCreateModal({ open: false, type: null })}
        onSave={(data) => crearFleteroMutation.mutate(data)}
        title="Crear Nuevo Fletero"
        fields={[
          { name: 'nombre', label: 'Nombre', placeholder: 'Nombre del fletero', type: 'text' },
          { name: 'direccion', label: 'Dirección', placeholder: 'Dirección', type: 'text' },
          { name: 'whatsapp', label: 'WhatsApp', placeholder: '+54...', type: 'text' }
        ]}
        isLoading={crearFleteroMutation.isPending}
      />

      <QuickCreateModal
        open={createModal.open && createModal.type === 'producto'}
        onClose={() => setCreateModal({ open: false, type: null })}
        onSave={(data) => crearProductoMutation.mutate(data)}
        title="Crear Nuevo Producto"
        fields={[
          { name: 'fruta', label: 'Fruta', placeholder: 'Ej: Manzana', type: 'text' },
          { name: 'variedad', label: 'Variedad', placeholder: 'Ej: Red Delicious', type: 'text' }
        ]}
        isLoading={crearProductoMutation.isPending}
      />

      <QuickCreateModal
        open={createModal.open && createModal.type === 'envase'}
        onClose={() => setCreateModal({ open: false, type: null })}
        onSave={(data) => crearEnvaseMutation.mutate(data)}
        title="Crear Nuevo Envase"
        fields={[
          { name: 'tipo', label: 'Tipo de Envase', placeholder: 'Ej: Bin Plástico', type: 'text' },
          { name: 'tara', label: 'Tara (kg)', placeholder: '0.00', type: 'number' }
        ]}
        isLoading={crearEnvaseMutation.isPending}
      />

      <GenericSuccessModal
        open={successModal.open}
        onClose={() => {
          setSuccessModal({ open: false, data: null });
          resetForm();
        }}
        title="¡Salida Registrada!"
        message="El movimiento se ha registrado correctamente"
        onDownloadPDF={handleDownloadPDF}
        onShareWhatsApp={handleShareWhatsApp}
      />
    </div>
  );
}