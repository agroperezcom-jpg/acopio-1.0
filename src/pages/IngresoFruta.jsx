import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, Loader2, Apple, Truck, Scale, Package, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AsyncSelect from '@/components/AsyncSelect';
import ConfirmPesajeModal from '@/components/ConfirmPesajeModal';
import EnvaseLineItemLlenos from '@/components/EnvaseLineItemLlenos';
import GenericSuccessModal from '@/components/GenericSuccessModal';
import PesajeLineItem from '@/components/PesajeLineItem';
import QuickCreateModal from '@/components/QuickCreateModal';
import { descargarPDFIngresoFruta, compartirWhatsAppIngresoFruta } from '@/components/PDFGeneratorIngresoFruta';
import { agruparKilosPorProducto } from '@/components/utils/precisionDecimal';
import { actualizarSaldoEntidad } from '@/utils/contabilidad';
import { invalidarTodoElSistema } from '@/utils/queryHelpers';
import { registrarMovimientoEnvase } from '@/services/SaldoEnvasesService';
import { ajustarStockProducto, ajustarStockEnvase } from '@/services/StockService';

export default function IngresoFruta({ embedded = false }) {
  const queryClient = useQueryClient();
  
  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [proveedorId, setProveedorId] = useState('');
  const [proveedorData, setProveedorData] = useState(null);
  const [fleteroId, setFleteroId] = useState('');
  const [fleteroData, setFleteroData] = useState(null);
  
  const [pesajes, setPesajes] = useState([]);
  
  const [pesajeActual, setPesajeActual] = useState({
    modo: 'estandar',
    cantidad: 1,
    envase_id: '',
    envase_tipo: '',
    tara_unitaria: 0,
    tara_manual: 0,
    producto_id: '',
    producto_nombre: '',
    peso_bruto: 0,
    peso_neto: 0
  });
  
  const [confirmPesajeModal, setConfirmPesajeModal] = useState({ open: false, pesaje: null });
  
  const [envasesLlenos, setEnvasesLlenos] = useState([]);
  const [envaseActual, setEnvaseActual] = useState({
    envase_id: '',
    envase_tipo: '',
    cantidad: 0
  });

  const [createModal, setCreateModal] = useState({ open: false, type: null });
  const [successModal, setSuccessModal] = useState({ open: false, data: null });
  const [isSubmitting, setIsSubmitting] = useState(false);




  const resumenPesajes = useMemo(() => {
    const resumen = {};
    pesajes.forEach(p => {
      if (!p.producto_nombre) return;
      const key = `${p.producto_nombre}_${p.envase_tipo || 'Sin envase'}`;
      if (!resumen[key]) {
        resumen[key] = {
          producto: p.producto_nombre,
          envase: p.envase_tipo || '-',
          cantidad: 0,
          pesoBruto: 0,
          tara: 0,
          pesoNeto: 0
        };
      }
      resumen[key].cantidad += p.cantidad || 1;
      resumen[key].pesoBruto += p.peso_bruto || 0;
      resumen[key].tara += p.modo === 'libre' ? (p.tara_manual || 0) : ((p.tara_unitaria || 0) * (p.cantidad || 1));
      resumen[key].pesoNeto += p.peso_neto || 0;
    });
    return Object.values(resumen);
  }, [pesajes]);

  const handleProveedorSelect = (id, prov) => {
    setProveedorId(id);
    setProveedorData(prov);
  };

  const handleFleteroSelect = (id, flet) => {
    setFleteroId(id);
    setFleteroData(flet);
  };

  const handleAgregarPesaje = () => {
    // Validar que tenga datos mínimos
    if (!pesajeActual.producto_id) {
      alert('Por favor seleccione un producto');
      return;
    }
    if (pesajeActual.modo !== 'libre' && !pesajeActual.envase_id) {
      alert('Por favor seleccione un tipo de envase');
      return;
    }
    if (pesajeActual.peso_bruto <= 0) {
      alert('Por favor ingrese un peso bruto válido');
      return;
    }
    
    // Validar tara no supere bruto
    const taraTotal = pesajeActual.modo === 'libre' 
      ? (pesajeActual.tara_manual || 0)
      : ((pesajeActual.tara_unitaria || 0) * (pesajeActual.cantidad || 1));
    
    if (taraTotal > pesajeActual.peso_bruto) {
      alert('La tara no puede superar el peso bruto');
      return;
    }
    
    // Mostrar modal de confirmación
    setConfirmPesajeModal({ open: true, pesaje: pesajeActual });
  };

  const confirmarPesaje = () => {
    setPesajes([...pesajes, confirmPesajeModal.pesaje]);
    setConfirmPesajeModal({ open: false, pesaje: null });
    // Resetear pesaje actual
    setPesajeActual({
      modo: 'estandar',
      cantidad: 1,
      envase_id: '',
      envase_tipo: '',
      tara_unitaria: 0,
      tara_manual: 0,
      producto_id: '',
      producto_nombre: '',
      peso_bruto: 0,
      peso_neto: 0
    });
  };

  const updatePesajeActual = (data) => {
    setPesajeActual(data);
  };

  const removePesaje = (index) => {
    setPesajes(pesajes.filter((_, i) => i !== index));
  };

  const handleCreateSave = async (data) => {
    setIsSubmitting(true);
    try {
      if (createModal.type === 'proveedor') {
        const created = await base44.entities.Proveedor.create(data);
        queryClient.invalidateQueries(['proveedores']);
        setProveedorId(created.id);
        setProveedorData(created);
      } else if (createModal.type === 'fletero') {
        const created = await base44.entities.Fletero.create(data);
        queryClient.invalidateQueries(['fleteros']);
        setFleteroId(created.id);
        setFleteroData(created);
      } else if (createModal.type === 'envase') {
        const created = await base44.entities.Envase.create(data);
        queryClient.invalidateQueries(['envases']);
      } else if (createModal.type === 'producto') {
        const productoData = {
          ...data,
          producto_completo: `${data.fruta} - ${data.variedad}`
        };
        await base44.entities.Producto.create(productoData);
        queryClient.invalidateQueries(['productos']);
      }
      setCreateModal({ open: false, type: null });
    } finally {
      setIsSubmitting(false);
    }
  };

  const { data: periodosPrecios = [] } = useQuery({
    queryKey: ['periodosprecios'],
    queryFn: () => base44.entities.PeriodoPrecio.list()
  });

  const handleSubmit = async () => {
    if (!proveedorId) {
      alert('Por favor seleccione un proveedor');
      return;
    }

    if (pesajes.length === 0) {
      alert('Por favor agregue al menos un pesaje');
      return;
    }

    setIsSubmitting(true);
    try {
      // Calcular deuda total del ingreso
      let deudaTotalIngreso = 0;
      pesajes.forEach(p => {
        const periodoVigente = periodosPrecios
          .filter(pp => pp.producto_id === p.producto_id && pp.activo)
          .sort((a, b) => new Date(b.fecha_desde) - new Date(a.fecha_desde))
          .find(pp => new Date(pp.fecha_desde) <= new Date(fecha));
        const precioCompra = periodoVigente?.precio_compra_kg || 0;
        deudaTotalIngreso += p.peso_neto * precioCompra;
      });

      const envasesLlenosFiltrados = envasesLlenos.filter(e => e.cantidad > 0);

      const movimiento = {
        fecha: new Date(fecha).toISOString(),
        tipo_movimiento: 'Ingreso de Fruta',
        proveedor_id: proveedorId,
        proveedor_nombre: proveedorData?.nombre || '',
        fletero_id: fleteroId || null,
        fletero_nombre: fleteroData?.nombre || '',
        estado_pago: 'Pendiente',
        monto_pagado: 0,
        deuda_total: deudaTotalIngreso,
        pesajes: pesajes.filter(p => p.peso_bruto > 0),
        envases_llenos: envasesLlenosFiltrados
      };

      const created = await base44.entities.Movimiento.create(movimiento);

      // Actualizar stock vivo de productos (incremental por servicio)
      const stockPorProducto = agruparKilosPorProducto(pesajes, 'peso_neto');
      for (const [productoId, totalNeto] of Object.entries(stockPorProducto)) {
        await ajustarStockProducto(base44, productoId, totalNeto);
      }

      // Stock físico: aumentar envases ocupados en depósito
      for (const envLleno of movimiento.envases_llenos || []) {
        if (envLleno.cantidad > 0 && envLleno.envase_id) {
          await ajustarStockEnvase(base44, envLleno.envase_id, envLleno.cantidad, 0);
        }
      }

      // Saldo de envases: proveedor devuelve llenos → RECEPCION (disminuye deuda)
      const itemsRecepcion = envasesLlenosFiltrados
        .filter(e => e.cantidad > 0 && e.envase_tipo)
        .map(e => ({ tipo_envase: e.envase_tipo, cantidad: e.cantidad }));
      if (itemsRecepcion.length > 0) {
        await registrarMovimientoEnvase('Proveedor', proveedorId, itemsRecepcion, 'RECEPCION');
      }
      
      // ═══════════════════════════════════════════════════════════════
      // CREAR MOVIMIENTO EN CUENTA CORRIENTE - AUMENTA DEUDA PROVEEDOR
      // ═══════════════════════════════════════════════════════════════
      // Obtener el saldo anterior de este proveedor
      const movimientosProveedor = await base44.entities.CuentaCorriente.filter({
        entidad_tipo: 'Proveedor',
        entidad_id: proveedorId
      }, '-fecha');
      const saldoAnterior = movimientosProveedor.length > 0 ? (movimientosProveedor[0].saldo_resultante || 0) : 0;
      const nuevoSaldo = saldoAnterior + deudaTotalIngreso;

      await base44.entities.CuentaCorriente.create({
        fecha: new Date(fecha).toISOString(),
        tipo_movimiento: 'Haber',
        entidad_tipo: 'Proveedor',
        entidad_id: proveedorId,
        entidad_nombre: proveedorData?.nombre || '',
        monto: deudaTotalIngreso,
        saldo_resultante: nuevoSaldo,
        concepto: `Ingreso de Fruta - ${format(new Date(fecha), 'dd/MM/yyyy')}`,
        comprobante_id: created.id,
        comprobante_tipo: 'IngresoFruta'
      });

      await actualizarSaldoEntidad(base44, 'Proveedor', proveedorId, deudaTotalIngreso);

      // Invalidar todas las queries del sistema
      invalidarTodoElSistema(queryClient);
      
      setSuccessModal({ 
        open: true, 
        data: { ...movimiento, id: created.id }
      });
    } catch (err) {
      const msg = err?.message || 'Error al registrar el ingreso';
      alert(`Error: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!successModal.data) return;
    descargarPDFIngresoFruta(successModal.data);
  };

  const handleShareWhatsApp = async () => {
    if (!successModal.data) return;
    compartirWhatsAppIngresoFruta(successModal.data, proveedorData?.whatsapp);
  };

  const getCreateFields = () => {
    switch (createModal.type) {
      case 'proveedor':
        return [
          { name: 'nombre', label: 'Nombre', placeholder: 'Nombre del proveedor' },
          { name: 'direccion', label: 'Dirección', placeholder: 'Dirección' },
          { name: 'cuit', label: 'CUIT', placeholder: 'XX-XXXXXXXX-X' },
          { name: 'whatsapp', label: 'WhatsApp', placeholder: '+54 9 11 XXXX-XXXX' }
        ];
      case 'fletero':
        return [
          { name: 'nombre', label: 'Nombre', placeholder: 'Nombre del fletero' },
          { name: 'direccion', label: 'Dirección', placeholder: 'Dirección' },
          { name: 'whatsapp', label: 'WhatsApp', placeholder: '+54 9 11 XXXX-XXXX' }
        ];
      case 'envase':
        return [
          { name: 'tipo', label: 'Tipo de Envase', placeholder: 'Ej: Bin Plástico' },
          { name: 'tara', label: 'Tara (kg)', type: 'number', placeholder: '0.00' }
        ];
      case 'producto':
        return [
          { name: 'fruta', label: 'Fruta', placeholder: 'Ej: Manzana' },
          { name: 'variedad', label: 'Variedad', placeholder: 'Ej: Red Delicious' }
        ];
      default:
        return [];
    }
  };

  const totalPesoNeto = pesajes.reduce((s, p) => s + (p.peso_neto || 0), 0);
  const totalPesoBruto = pesajes.reduce((s, p) => s + (p.peso_bruto || 0), 0);

  return (
    <div className={embedded ? "" : "min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50"}>
      <div className={embedded ? "" : "max-w-5xl mx-auto p-4 sm:p-6 lg:p-8"}>
        {!embedded && (
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Apple className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Ingreso de Fruta</h1>
              <p className="text-slate-500 text-sm">Registrar nuevo ingreso de frutas al acopio</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Datos Generales */}
          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Truck className="h-5 w-5 text-slate-400" />
                Datos del Ingreso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Fecha y Hora</label>
                  <Input
                    type="datetime-local"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Proveedor *</label>
                  <AsyncSelect
                    entityKey="Proveedor"
                    value={proveedorId}
                    onChange={handleProveedorSelect}
                    placeholder="Buscar proveedor..."
                    onCreateNew={() => setCreateModal({ open: true, type: 'proveedor' })}
                    createNewLabel="Crear nuevo proveedor"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Fletero</label>
                  <AsyncSelect
                    entityKey="Fletero"
                    value={fleteroId}
                    onChange={handleFleteroSelect}
                    placeholder="Buscar fletero..."
                    onCreateNew={() => setCreateModal({ open: true, type: 'fletero' })}
                    createNewLabel="Crear nuevo fletero"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pesajes */}
          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Scale className="h-5 w-5 text-slate-400" />
                Nuevo Pesaje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Formulario de pesaje actual */}
                <PesajeLineItem
                  item={pesajeActual}
                  index={0}
                  onChange={(_, data) => updatePesajeActual(data)}
                  onRemove={() => {}}
                  onCreateEnvase={() => setCreateModal({ open: true, type: 'envase' })}
                  onCreateProducto={() => setCreateModal({ open: true, type: 'producto' })}
                />
                
                <div className="flex justify-end">
                  <Button 
                    onClick={handleAgregarPesaje}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar a Lista
                  </Button>
                </div>
              </div>
              
              {/* Lista de pesajes agregados */}
              {pesajes.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-700">Pesajes Agregados ({pesajes.length})</h4>
                  </div>
                  <div className="space-y-3">
                    {pesajes.map((pesaje, index) => (
                      <div key={index} className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-slate-800">
                              {pesaje.producto_nombre || 'Producto sin especificar'}
                            </p>
                            <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-600">
                              {pesaje.modo !== 'libre' && (
                                <>
                                  <span>{pesaje.envase_tipo || 'Sin envase'}</span>
                                  <span>Cantidad: {pesaje.cantidad || 1}</span>
                                </>
                              )}
                              <span>Bruto: {(pesaje.peso_bruto || 0).toFixed(2)} kg</span>
                              <span className="font-semibold text-green-700">
                                Neto: {(pesaje.peso_neto || 0).toFixed(2)} kg
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePesaje(index)}
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

              {/* Resumen */}
              {resumenPesajes.length > 0 && (
                <div className="mt-6 p-4 bg-green-50 rounded-xl">
                  <h4 className="font-semibold text-green-800 mb-3">Resumen por Producto</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-green-700">
                          <th className="pb-2">Producto</th>
                          <th className="pb-2">Envase</th>
                          <th className="pb-2 text-right">Cant.</th>
                          <th className="pb-2 text-right">P. Bruto</th>
                          <th className="pb-2 text-right">Tara</th>
                          <th className="pb-2 text-right">P. Neto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumenPesajes.map((r, i) => (
                          <tr key={i} className="border-t border-green-200">
                            <td className="py-2">{r.producto}</td>
                            <td className="py-2">{r.envase}</td>
                            <td className="py-2 text-right">{r.cantidad}</td>
                            <td className="py-2 text-right">{r.pesoBruto.toFixed(2)} kg</td>
                            <td className="py-2 text-right">{r.tara.toFixed(2)} kg</td>
                            <td className="py-2 text-right font-semibold">{r.pesoNeto.toFixed(2)} kg</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-green-300 font-bold text-green-900">
                          <td colSpan={3} className="py-2">TOTAL</td>
                          <td className="py-2 text-right">{totalPesoBruto.toFixed(2)} kg</td>
                          <td className="py-2 text-right">{(totalPesoBruto - totalPesoNeto).toFixed(2)} kg</td>
                          <td className="py-2 text-right text-lg">{totalPesoNeto.toFixed(2)} kg</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Envases Llenos (Con Fruta) */}
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
                      <p>Los envases vacíos se gestionan en "Movimiento de Envases". Aquí solo registre envases que vienen llenos con fruta → impactan Stock Ocupados.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botón Guardar */}
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !proveedorId}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white px-8"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Apple className="h-5 w-5 mr-2" />
              )}
              Registrar Ingreso
            </Button>
          </div>
        </div>
      </div>

      <QuickCreateModal
        open={createModal.open}
        onClose={() => setCreateModal({ open: false, type: null })}
        onSave={handleCreateSave}
        title={
          createModal.type === 'proveedor' ? 'Nuevo Proveedor' :
          createModal.type === 'fletero' ? 'Nuevo Fletero' :
          createModal.type === 'envase' ? 'Nuevo Envase' :
          createModal.type === 'producto' ? 'Nuevo Producto' : ''
        }
        fields={getCreateFields()}
        isLoading={isSubmitting}
      />

      <ConfirmPesajeModal
        open={confirmPesajeModal.open}
        onClose={() => setConfirmPesajeModal({ open: false, pesaje: null })}
        pesaje={confirmPesajeModal.pesaje}
        onConfirm={confirmarPesaje}
        onEdit={() => setConfirmPesajeModal({ open: false, pesaje: null })}
      />

      <GenericSuccessModal
        open={successModal.open}
        onClose={() => {
          setSuccessModal({ open: false, data: null });
          // Resetear todo el formulario
          setFecha(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
          setProveedorId('');
          setProveedorData(null);
          setFleteroId('');
          setFleteroData(null);
          setPesajes([]);
          setPesajeActual({
            modo: 'estandar',
            cantidad: 1,
            envase_id: '',
            envase_tipo: '',
            tara_unitaria: 0,
            tara_manual: 0,
            producto_id: '',
            producto_nombre: '',
            peso_bruto: 0,
            peso_neto: 0
          });
          setEnvasesLlenos([]);
          setEnvaseActual({ envase_id: '', envase_tipo: '', cantidad: 0 });
        }}
        title="¡Ingreso Registrado!"
        message="El movimiento se ha registrado correctamente"
        onDownloadPDF={handleDownloadPDF}
        onShareWhatsApp={handleShareWhatsApp}
      />
    </div>
  );
}