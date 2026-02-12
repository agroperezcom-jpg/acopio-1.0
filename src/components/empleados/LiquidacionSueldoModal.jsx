import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, DollarSign, Truck, Users, CreditCard, Wallet } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from "sonner";
import AsyncSelect from '@/components/AsyncSelect';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function LiquidacionSueldoModal({ open, empleados, categorias, onClose, onSave, isLoading }) {
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);
  const [categoriaEmpleado, setCategoriaEmpleado] = useState(null);
  const [pagarAhora, setPagarAhora] = useState(false);
  const [origenSeleccionado, setOrigenSeleccionado] = useState(null);
  const [formData, setFormData] = useState({
    periodo: format(new Date(), 'MMMM yyyy', { locale: es }),
    fecha_liquidacion: format(new Date(), 'yyyy-MM-dd'),
    fecha_pago: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    viajes: [],
    conceptos: [],
    sueldo_base: 0,
    otros_conceptos: 0,
    descuentos: 0,
    notas: '',
    forma_pago: 'Transferencia',
    origen_tipo: 'Banco',
    origen_id: '',
    cheque_id: ''
  });

  const { data: importesConfig = [] } = useQuery({
    queryKey: ['importesconfig'],
    queryFn: () => base44.entities.ConfiguracionImportes.list()
  });

  React.useEffect(() => {
    if (open) {
      setEmpleadoSeleccionado(null);
      setCategoriaEmpleado(null);
      setPagarAhora(false);
      setOrigenSeleccionado(null);
      setFormData({
        periodo: format(new Date(), 'MMMM yyyy', { locale: es }),
        fecha_liquidacion: format(new Date(), 'yyyy-MM-dd'),
        fecha_pago: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        viajes: [],
        conceptos: [],
        sueldo_base: 0,
        otros_conceptos: 0,
        descuentos: 0,
        notas: '',
        forma_pago: 'Transferencia',
        origen_tipo: 'Banco',
        origen_id: '',
        cheque_id: ''
      });
    }
  }, [open]);

  const handleSelectEmpleado = (empleadoId, empleadoOption = null) => {
    const empleado = empleadoOption || empleados.find(e => e.id === empleadoId);
    if (!empleado) return;

    const categoria = categorias.find(c => c.id === empleado.categoria_empleado_id);
    setEmpleadoSeleccionado(empleado);
    setCategoriaEmpleado(categoria);

    // Inicializar según tipo de liquidación
    if (categoria?.tipo_liquidacion === 'Sueldo Fijo') {
      const conceptosIniciales = categoria?.conceptos_predeterminados?.map(c => ({
        nombre: c.nombre,
        tipo: c.tipo,
        monto: c.monto_default || 0
      })) || [];

      setFormData({
        ...formData,
        sueldo_base: empleado.sueldo_base || 0,
        conceptos: conceptosIniciales,
        viajes: []
      });
    } else {
      setFormData({
        ...formData,
        sueldo_base: empleado.sueldo_base || 0,
        conceptos: [],
        viajes: []
      });
    }
  };

  // Viajes (Para Por Viaje)
  const agregarViaje = () => {
    setFormData({
      ...formData,
      viajes: [...formData.viajes, {
        fecha_viaje: format(new Date(), 'yyyy-MM-dd'),
        ida_opcion1: '',
        ida_cantidad1: 0,
        ida_opcion2: '',
        ida_cantidad2: 0,
        vuelta_opcion1: '',
        vuelta_cantidad1: 0,
        vuelta_opcion2: '',
        vuelta_cantidad2: 0,
        importe_viaje: importesConfig[0]?.importe || 0,
        kilos_llevados: 0
      }]
    });
  };

  const actualizarViaje = (index, field, value) => {
    const nuevosViajes = [...formData.viajes];
    nuevosViajes[index][field] = value;
    setFormData({ ...formData, viajes: nuevosViajes });
  };

  const eliminarViaje = (index) => {
    setFormData({
      ...formData,
      viajes: formData.viajes.filter((_, i) => i !== index)
    });
  };

  // Conceptos (Para Sueldo Fijo)
  const actualizarConcepto = (index, monto) => {
    const nuevosConceptos = [...formData.conceptos];
    nuevosConceptos[index].monto = monto;
    setFormData({ ...formData, conceptos: nuevosConceptos });
  };

  // Cálculos
  const calcularTotales = () => {
    const totalViajes = formData.viajes.reduce((sum, v) => sum + (parseFloat(v.importe_viaje) || 0), 0);
    
    let totalConceptosSuma = 0;
    let totalConceptosDescuento = 0;
    formData.conceptos.forEach(c => {
      const monto = parseFloat(c.monto) || 0;
      if (c.tipo === 'suma') {
        totalConceptosSuma += monto;
      } else {
        totalConceptosDescuento += monto;
      }
    });

    const total = (parseFloat(formData.sueldo_base) || 0) 
                  + totalViajes 
                  + totalConceptosSuma
                  + (parseFloat(formData.otros_conceptos) || 0) 
                  - totalConceptosDescuento
                  - (parseFloat(formData.descuentos) || 0);
    
    return { totalViajes, totalConceptosSuma, totalConceptosDescuento, total };
  };

  const handleGuardar = () => {
    if (!empleadoSeleccionado) {
      toast.error('Debe seleccionar un empleado');
      return;
    }

    if (pagarAhora) {
      if (!formData.origen_id) {
        toast.error('Debe seleccionar un banco o caja para el pago');
        return;
      }
      if (formData.forma_pago === 'Cheque' && !formData.cheque_id) {
        toast.error('Debe seleccionar un cheque');
        return;
      }
    }

    const { totalViajes, total } = calcularTotales();

    const liquidacion = {
      empleado_id: empleadoSeleccionado.id,
      empleado_nombre: empleadoSeleccionado.nombre,
      periodo: formData.periodo,
      fecha_liquidacion: formData.fecha_liquidacion,
      fecha_pago: formData.fecha_pago,
      tipo_flete: categoriaEmpleado?.tipo_liquidacion === 'Por Viaje' ? 'Ida/Vuelta' : '',
      viajes: formData.viajes,
      sueldo_base: parseFloat(formData.sueldo_base) || 0,
      total_viajes: totalViajes,
      otros_conceptos: parseFloat(formData.otros_conceptos) || 0,
      descuentos: parseFloat(formData.descuentos) || 0,
      total_liquidacion: total,
      estado: pagarAhora ? 'Pagada' : 'Pendiente',
      monto_pagado: pagarAhora ? total : 0,
      forma_pago: pagarAhora ? formData.forma_pago : undefined,
      origen_tipo: pagarAhora ? formData.origen_tipo : undefined,
      origen_id: pagarAhora ? formData.origen_id : undefined,
      origen_nombre: pagarAhora ? (origenSeleccionado?.nombre || '') : undefined,
      cheque_id: pagarAhora && formData.forma_pago === 'Cheque' ? formData.cheque_id : undefined,
      notas: formData.notas,
      _pagarAhora: pagarAhora
    };

    onSave(liquidacion);
  };

  const { totalViajes, totalConceptosSuma, totalConceptosDescuento, total } = calcularTotales();
  const esLiquidacionPorViaje = categoriaEmpleado?.tipo_liquidacion === 'Por Viaje';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {empleadoSeleccionado ? `Liquidar Sueldo - ${empleadoSeleccionado.nombre}` : 'Nueva Liquidación de Sueldo'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Selector de Empleado */}
          {!empleadoSeleccionado ? (
            <div className="p-6 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
              <Label className="text-base font-semibold mb-3 block">Seleccionar Empleado *</Label>
              <AsyncSelect
                entityKey="EmpleadoAcopio"
                value=""
                onChange={handleSelectEmpleado}
                serverFilter={{ activo: true }}
                placeholder="Buscar empleado por nombre..."
              />
            </div>
          ) : (
            <>
              {/* Info Empleado Seleccionado */}
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg text-blue-900">{empleadoSeleccionado.nombre}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="bg-white">
                          {categoriaEmpleado?.nombre}
                        </Badge>
                        <Badge variant="outline" className="bg-white">
                          Tipo: {categoriaEmpleado?.tipo_liquidacion}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setEmpleadoSeleccionado(null)}>
                      Cambiar Empleado
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Datos Básicos de Liquidación */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Período *</Label>
                  <Input 
                    value={formData.periodo} 
                    onChange={(e) => setFormData({...formData, periodo: e.target.value})} 
                    className="mt-1"
                    placeholder={format(new Date(), 'MMMM yyyy', { locale: es })}
                  />
                </div>
                <div>
                  <Label>Fecha Liquidación *</Label>
                  <Input 
                    type="date"
                    value={formData.fecha_liquidacion} 
                    onChange={(e) => setFormData({...formData, fecha_liquidacion: e.target.value})} 
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Fecha de Pago *</Label>
                  <Input 
                    type="date"
                    value={formData.fecha_pago} 
                    onChange={(e) => setFormData({...formData, fecha_pago: e.target.value})} 
                    className="mt-1"
                  />
                </div>
              </div>

              {/* LIQUIDACIÓN POR VIAJE (Fleteros) */}
              {esLiquidacionPorViaje && (
                <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Viajes Realizados
                    </h3>
                    <Button onClick={agregarViaje} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar Viaje
                    </Button>
                  </div>

                  {importesConfig.length > 0 && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <p className="text-xs text-emerald-900 font-medium mb-2">⚡ Accesos Rápidos - Importes Predeterminados:</p>
                      <div className="flex flex-wrap gap-2">
                        {importesConfig.filter(ic => ic.activo).map(ic => (
                          <Button
                            key={ic.id}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const nuevoViaje = {
                                fecha_viaje: format(new Date(), 'yyyy-MM-dd'),
                                ida_opcion1: '',
                                ida_cantidad1: 0,
                                ida_opcion2: '',
                                ida_cantidad2: 0,
                                vuelta_opcion1: '',
                                vuelta_cantidad1: 0,
                                vuelta_opcion2: '',
                                vuelta_cantidad2: 0,
                                importe_viaje: ic.importe,
                                kilos_llevados: 0
                              };
                              setFormData({
                                ...formData,
                                viajes: [...formData.viajes, nuevoViaje]
                              });
                              toast.success(`Viaje agregado con ${ic.concepto}: $${ic.importe.toLocaleString('es-AR')}`);
                            }}
                            className="bg-white hover:bg-emerald-50"
                          >
                            {ic.concepto}: <strong className="ml-1">${ic.importe.toLocaleString('es-AR')}</strong>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {formData.viajes.map((viaje, idx) => (
                      <Card key={idx} className="bg-white">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-semibold text-sm text-slate-700">Viaje #{idx + 1}</h4>
                            <Button variant="ghost" size="icon" onClick={() => eliminarViaje(idx)} className="text-red-500 h-8 w-8">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <Label className="text-xs">Fecha del Viaje</Label>
                              <Input 
                                type="date" 
                                value={viaje.fecha_viaje} 
                                onChange={(e) => actualizarViaje(idx, 'fecha_viaje', e.target.value)} 
                                className="mt-1 h-9 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Kilos Transportados</Label>
                              <Input 
                                type="number" 
                                step="0.01"
                                value={viaje.kilos_llevados} 
                                onChange={(e) => actualizarViaje(idx, 'kilos_llevados', parseFloat(e.target.value) || 0)} 
                                className="mt-1 h-9 text-sm"
                                placeholder="0.00"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-3">
                            {/* IDA */}
                            <div className="space-y-2 p-3 bg-blue-50 rounded-lg">
                              <Label className="text-xs font-semibold text-blue-900">Ida (Opción 1)</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <select 
                                  value={viaje.ida_opcion1}
                                  onChange={(e) => actualizarViaje(idx, 'ida_opcion1', e.target.value)}
                                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                                >
                                  <option value="">Ninguno</option>
                                  <option value="Envases Vacíos">Envases Vacíos</option>
                                  <option value="Envases Llenos">Envases Llenos</option>
                                </select>
                                <Input 
                                  type="number"
                                  placeholder="Cantidad"
                                  value={viaje.ida_cantidad1}
                                  onChange={(e) => actualizarViaje(idx, 'ida_cantidad1', parseInt(e.target.value) || 0)}
                                  className="h-9 text-xs"
                                />
                              </div>
                              
                              <Label className="text-xs font-semibold text-blue-900">Ida (Opción 2)</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <select 
                                  value={viaje.ida_opcion2}
                                  onChange={(e) => actualizarViaje(idx, 'ida_opcion2', e.target.value)}
                                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                                >
                                  <option value="">Ninguno</option>
                                  <option value="Envases Vacíos">Envases Vacíos</option>
                                  <option value="Envases Llenos">Envases Llenos</option>
                                </select>
                                <Input 
                                  type="number"
                                  placeholder="Cantidad"
                                  value={viaje.ida_cantidad2}
                                  onChange={(e) => actualizarViaje(idx, 'ida_cantidad2', parseInt(e.target.value) || 0)}
                                  className="h-9 text-xs"
                                />
                              </div>
                            </div>

                            {/* VUELTA */}
                            <div className="space-y-2 p-3 bg-green-50 rounded-lg">
                              <Label className="text-xs font-semibold text-green-900">Vuelta (Opción 1)</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <select 
                                  value={viaje.vuelta_opcion1}
                                  onChange={(e) => actualizarViaje(idx, 'vuelta_opcion1', e.target.value)}
                                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                                >
                                  <option value="">Ninguno</option>
                                  <option value="Envases Vacíos">Envases Vacíos</option>
                                  <option value="Envases Llenos">Envases Llenos</option>
                                </select>
                                <Input 
                                  type="number"
                                  placeholder="Cantidad"
                                  value={viaje.vuelta_cantidad1}
                                  onChange={(e) => actualizarViaje(idx, 'vuelta_cantidad1', parseInt(e.target.value) || 0)}
                                  className="h-9 text-xs"
                                />
                              </div>
                              
                              <Label className="text-xs font-semibold text-green-900">Vuelta (Opción 2)</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <select 
                                  value={viaje.vuelta_opcion2}
                                  onChange={(e) => actualizarViaje(idx, 'vuelta_opcion2', e.target.value)}
                                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                                >
                                  <option value="">Ninguno</option>
                                  <option value="Envases Vacíos">Envases Vacíos</option>
                                  <option value="Envases Llenos">Envases Llenos</option>
                                </select>
                                <Input 
                                  type="number"
                                  placeholder="Cantidad"
                                  value={viaje.vuelta_cantidad2}
                                  onChange={(e) => actualizarViaje(idx, 'vuelta_cantidad2', parseInt(e.target.value) || 0)}
                                  className="h-9 text-xs"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Importe del Viaje */}
                          <div>
                            <Label className="text-xs">Importe del Viaje</Label>
                            <div className="flex gap-2 mt-1">
                              <select 
                                value={viaje.importe_viaje}
                                onChange={(e) => actualizarViaje(idx, 'importe_viaje', parseFloat(e.target.value) || 0)}
                                className="flex h-9 flex-1 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
                              >
                                <option value="">Personalizado</option>
                                {importesConfig.filter(ic => ic.activo).map(ic => (
                                  <option key={ic.id} value={ic.importe}>
                                    {ic.concepto} - ${ic.importe.toLocaleString('es-AR')}
                                  </option>
                                ))}
                              </select>
                              <Input 
                                type="number" 
                                step="0.01" 
                                value={viaje.importe_viaje} 
                                onChange={(e) => actualizarViaje(idx, 'importe_viaje', parseFloat(e.target.value) || 0)} 
                                className="w-36 h-9 text-sm font-semibold"
                                placeholder="$ Monto"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {formData.viajes.length === 0 && (
                      <p className="text-center text-slate-500 py-6 text-sm">
                        No hay viajes agregados. Haga clic en "Agregar Viaje" para comenzar.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* LIQUIDACIÓN SUELDO FIJO (Administrativos, etc.) */}
              {!esLiquidacionPorViaje && formData.conceptos.length > 0 && (
                <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Conceptos de Liquidación
                  </h3>
                  <div className="space-y-2">
                    {formData.conceptos.map((concepto, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                        <span className="flex-1 text-sm font-medium text-slate-700">{concepto.nombre}</span>
                        <Badge variant={concepto.tipo === 'suma' ? 'default' : 'destructive'} className="text-xs">
                          {concepto.tipo === 'suma' ? 'Suma' : 'Descuento'}
                        </Badge>
                        <Input
                          type="number"
                          step="0.01"
                          value={concepto.monto}
                          onChange={(e) => actualizarConcepto(idx, parseFloat(e.target.value) || 0)}
                          className="w-40"
                          placeholder="$ Monto"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Campos Adicionales */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Sueldo Base</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={formData.sueldo_base} 
                    onChange={(e) => setFormData({...formData, sueldo_base: parseFloat(e.target.value) || 0})} 
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Otros Conceptos (+)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={formData.otros_conceptos} 
                    onChange={(e) => setFormData({...formData, otros_conceptos: parseFloat(e.target.value) || 0})} 
                    className="mt-1"
                    placeholder="Bonos, extras..."
                  />
                </div>
                <div>
                  <Label>Descuentos (-)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={formData.descuentos} 
                    onChange={(e) => setFormData({...formData, descuentos: parseFloat(e.target.value) || 0})} 
                    className="mt-1"
                    placeholder="Adelantos, otros..."
                  />
                </div>
              </div>

              <div>
                <Label>Observaciones</Label>
                <Textarea 
                  value={formData.notas} 
                  onChange={(e) => setFormData({...formData, notas: e.target.value})} 
                  className="mt-1"
                  rows={2}
                  placeholder="Notas adicionales sobre esta liquidación..."
                />
              </div>

              {/* Opciones de Pago */}
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="checkbox"
                      checked={pagarAhora}
                      onChange={(e) => setPagarAhora(e.target.checked)}
                      className="h-5 w-5 rounded border-blue-300 text-blue-600"
                    />
                    <Label className="text-base font-semibold text-blue-900 cursor-pointer" onClick={() => setPagarAhora(!pagarAhora)}>
                      💰 Pagar Ahora (Registrar pago en Tesorería)
                    </Label>
                  </div>

                  {pagarAhora && (
                    <div className="space-y-4 pl-7">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm">Forma de Pago *</Label>
                          <select
                            value={formData.forma_pago}
                            onChange={(e) => setFormData({
                              ...formData,
                              forma_pago: e.target.value,
                              cheque_id: e.target.value === 'Cheque' ? formData.cheque_id : ''
                            })}
                            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm mt-1"
                          >
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Tarjeta">Tarjeta</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-sm">Origen *</Label>
                          <select
                            value={formData.origen_tipo}
                            onChange={(e) => {
                              setOrigenSeleccionado(null);
                              setFormData({
                                ...formData, 
                                origen_tipo: e.target.value,
                                origen_id: ''
                              });
                            }}
                            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm mt-1"
                          >
                            <option value="Banco">Banco</option>
                            <option value="Caja">Caja</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm">
                          {formData.origen_tipo === 'Banco' ? 'Banco *' : 'Caja *'}
                        </Label>
                        <AsyncSelect
                          entityKey={formData.origen_tipo}
                          value={formData.origen_id}
                          onChange={(id, option) => {
                            setOrigenSeleccionado(option || null);
                            setFormData({ ...formData, origen_id: id });
                          }}
                          placeholder={`Seleccionar ${formData.origen_tipo.toLowerCase()}...`}
                        />
                      </div>

                      {formData.forma_pago === 'Cheque' && (
                        <div>
                          <Label className="text-sm">Cheque Disponible *</Label>
                          <AsyncSelect
                            entityKey="Cheque"
                            value={formData.cheque_id}
                            onChange={(id) => setFormData({ ...formData, cheque_id: id })}
                            serverFilter={{ estado: 'Pendiente' }}
                            placeholder="Buscar cheque por numero..."
                          />
                        </div>
                      )}

                      <div className="p-3 bg-blue-100 border border-blue-300 rounded-lg">
                        <p className="text-xs text-blue-900">
                          <strong>ℹ️ Nota:</strong> Al marcar esta opción, se creará automáticamente un registro de pago en el módulo de Tesorería y se actualizará el saldo del {formData.origen_tipo.toLowerCase()} seleccionado.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Resumen de Totales */}
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-5">
                  <h3 className="font-bold text-green-900 mb-3">Resumen de Liquidación</h3>
                  <div className="space-y-2">
                    {formData.sueldo_base > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Sueldo Base:</span>
                        <span className="font-semibold">${formData.sueldo_base.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {esLiquidacionPorViaje && totalViajes > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Total Viajes ({formData.viajes.length}):</span>
                        <span className="font-semibold">${totalViajes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {totalConceptosSuma > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Conceptos (Sumas):</span>
                        <span className="font-semibold text-green-600">+${totalConceptosSuma.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {totalConceptosDescuento > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Conceptos (Descuentos):</span>
                        <span className="font-semibold text-red-600">-${totalConceptosDescuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {formData.otros_conceptos > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Otros Conceptos:</span>
                        <span className="font-semibold">${formData.otros_conceptos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {formData.descuentos > 0 && (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>Descuentos:</span>
                        <span className="font-semibold">-${formData.descuentos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between pt-3 mt-3 border-t-2 border-green-300">
                      <span className="font-bold text-base">TOTAL A PAGAR:</span>
                      <span className="font-bold text-2xl text-green-700">${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={handleGuardar} 
            disabled={isLoading || !empleadoSeleccionado} 
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar Liquidación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}