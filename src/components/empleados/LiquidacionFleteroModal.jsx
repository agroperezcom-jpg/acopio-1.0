import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AsyncSelect from '@/components/AsyncSelect';
import { Loader2, Truck, Package, Calendar, DollarSign, CheckCircle2, Minus, Plus } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function LiquidacionFleteroModal({
  open,
  fleteros,
  historialPrecios,
  movimientos,
  salidas,
  onClose,
  onSave,
  isLoading
}) {
  const [selectedFletero, setSelectedFletero] = useState(null);
  const [paso, setPaso] = useState(1);
  const [pagarAhora, setPagarAhora] = useState(false);
  const [origenSeleccionado, setOrigenSeleccionado] = useState(null);
  
  const [formData, setFormData] = useState({
    periodo: format(new Date(), 'MMMM yyyy', { locale: es }),
    fecha_liquidacion: format(new Date(), 'yyyy-MM-dd'),
    fecha_pago: format(new Date(), 'yyyy-MM-dd'),
    salidas_fruta: [],
    viajes_envases: [],
    total_salidas_fruta: 0,
    total_viajes_envases: 0,
    otros_conceptos: 0,
    descuentos: 0,
    total_liquidacion: 0,
    forma_pago: 'Efectivo',
    origen_tipo: 'Caja',
    origen_id: '',
    cheque_id: '',
    notas: ''
  });

  const [salidasDisponibles, setSalidasDisponibles] = useState([]);
  const [viajesDisponibles, setViajesDisponibles] = useState([]);
  const [salidasSeleccionadas, setSalidasSeleccionadas] = useState(new Set());
  const [viajesSeleccionados, setViajesSeleccionados] = useState(new Set());

  useEffect(() => {
    if (!open) {
      setPaso(1);
      setSelectedFletero(null);
      setSalidasSeleccionadas(new Set());
      setViajesSeleccionados(new Set());
      setPagarAhora(false);
      setOrigenSeleccionado(null);
      setFormData({
        periodo: format(new Date(), 'MMMM yyyy', { locale: es }),
        fecha_liquidacion: format(new Date(), 'yyyy-MM-dd'),
        fecha_pago: format(new Date(), 'yyyy-MM-dd'),
        salidas_fruta: [],
        viajes_envases: [],
        total_salidas_fruta: 0,
        total_viajes_envases: 0,
        otros_conceptos: 0,
        descuentos: 0,
        total_liquidacion: 0,
        forma_pago: 'Efectivo',
        origen_tipo: 'Caja',
        origen_id: '',
        cheque_id: '',
        notas: ''
      });
    }
  }, [open]);

  useEffect(() => {
    if (selectedFletero) {
      // Obtener salidas de fruta del fletero
      const salidasFletero = salidas.filter(s => s.fletero_id === selectedFletero.id);
      setSalidasDisponibles(salidasFletero.map(s => {
        const kilosSalida = (s.detalles || []).reduce((total, d) => 
          total + (d.kilos_reales || d.kilos_salida || 0), 0
        );
        const precioKgVigente = obtenerPrecioVigente(selectedFletero.id, s.fecha, 'kg');
        const montoCalculado = kilosSalida * precioKgVigente;
        const montoFinal = s.monto_flete_ajustado !== undefined && s.monto_flete_ajustado !== null
          ? s.monto_flete_ajustado
          : montoCalculado;

        return {
          id: s.id,
          numero_remito: s.numero_remito,
          cliente_nombre: s.cliente_nombre,
          fecha: s.fecha,
          kilos: kilosSalida,
          precio_kg: precioKgVigente,
          monto: montoFinal
        };
      }));

      // Obtener viajes de envases contabilizados
      const movimientosEnvases = movimientos.filter(
        m => m.fletero_id === selectedFletero.id && m.tipo_movimiento === 'Movimiento de Envases'
      );
      
      const viajes = [];
      movimientosEnvases.forEach(m => {
        if (m.movimiento_envases) {
          m.movimiento_envases
            .filter(env => env.contabilizar_viaje === true)
            .forEach(env => {
              const precioViajeVigente = obtenerPrecioVigente(selectedFletero.id, m.fecha, 'viaje');
              viajes.push({
                movimiento_id: m.id,
                fecha: m.fecha,
                descripcion: `${m.proveedor_nombre || m.cliente_nombre} - ${env.envase_tipo}`,
                precio_viaje: precioViajeVigente,
                monto: precioViajeVigente
              });
            });
        }
      });
      setViajesDisponibles(viajes);
    }
  }, [selectedFletero, movimientos, salidas]);

  const obtenerPrecioVigente = (fleteroId, fecha, tipoPrecio = 'kg') => {
    const preciosOrdenados = historialPrecios
      .filter(hp => hp.fletero_id === fleteroId)
      .sort((a, b) => new Date(b.fecha_desde) - new Date(a.fecha_desde));
    
    const fechaMovimiento = new Date(fecha);
    const precioVigente = preciosOrdenados.find(hp => new Date(hp.fecha_desde) <= fechaMovimiento);
    
    if (precioVigente) {
      return tipoPrecio === 'kg' ? precioVigente.precio_kg : precioVigente.precio_por_viaje;
    }
    
    const fletero = fleteros.find(f => f.id === fleteroId);
    return tipoPrecio === 'kg' ? (fletero?.precio_kg || 0) : (fletero?.precio_por_viaje || 0);
  };

  const toggleSalida = (salida) => {
    const newSet = new Set(salidasSeleccionadas);
    if (newSet.has(salida.id)) {
      newSet.delete(salida.id);
    } else {
      newSet.add(salida.id);
    }
    setSalidasSeleccionadas(newSet);
  };

  const toggleViaje = (index) => {
    const newSet = new Set(viajesSeleccionados);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setViajesSeleccionados(newSet);
  };

  const calcularTotales = () => {
    const salidasArray = salidasDisponibles.filter(s => salidasSeleccionadas.has(s.id));
    const viajesArray = viajesDisponibles.filter((_, idx) => viajesSeleccionados.has(idx));

    const totalSalidas = salidasArray.reduce((sum, s) => sum + s.monto, 0);
    const totalViajes = viajesArray.reduce((sum, v) => sum + v.monto, 0);
    const total = totalSalidas + totalViajes + (formData.otros_conceptos || 0) - (formData.descuentos || 0);

    return {
      salidasArray,
      viajesArray,
      totalSalidas,
      totalViajes,
      total
    };
  };

  const handleGuardar = () => {
    const { salidasArray, viajesArray, totalSalidas, totalViajes, total } = calcularTotales();
    
    const liquidacion = {
      fletero_id: selectedFletero.id,
      fletero_nombre: selectedFletero.nombre,
      periodo: formData.periodo,
      fecha_liquidacion: new Date(formData.fecha_liquidacion).toISOString(),
      fecha_pago: new Date(formData.fecha_pago).toISOString(),
      salidas_fruta: salidasArray,
      viajes_envases: viajesArray,
      total_salidas_fruta: totalSalidas,
      total_viajes_envases: totalViajes,
      otros_conceptos: formData.otros_conceptos || 0,
      descuentos: formData.descuentos || 0,
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-orange-600" />
            Liquidar Sueldo de Fletero
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {paso === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Fletero *</Label>
                <AsyncSelect
                  entityKey="Fletero"
                  value={selectedFletero?.id}
                  onChange={(_id, fletero) => setSelectedFletero(fletero || null)}
                  serverFilter={{ activo: true }}
                  placeholder="Buscar fletero por nombre..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Período *</Label>
                  <Input
                    value={formData.periodo}
                    onChange={(e) => setFormData({...formData, periodo: e.target.value})}
                    placeholder={format(new Date(), 'MMMM yyyy', { locale: es })}
                  />
                </div>
                <div>
                  <Label>Fecha de Liquidación *</Label>
                  <Input
                    type="date"
                    value={formData.fecha_liquidacion}
                    onChange={(e) => setFormData({...formData, fecha_liquidacion: e.target.value})}
                  />
                </div>
              </div>

              <Button 
                onClick={() => setPaso(2)} 
                disabled={!selectedFletero}
                className="w-full"
              >
                Siguiente: Seleccionar Trabajos
              </Button>
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Seleccionar Trabajos a Liquidar</h3>
                <Button variant="outline" size="sm" onClick={() => setPaso(1)}>
                  Atrás
                </Button>
              </div>

              {/* Salidas de Fruta */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    Salidas de Fruta ({salidasDisponibles.length})
                  </h4>
                  {salidasDisponibles.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">
                      No hay salidas de fruta para este fletero
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {salidasDisponibles.map(salida => (
                        <button
                          key={salida.id}
                          onClick={() => toggleSalida(salida)}
                          className={`w-full p-3 rounded-lg border text-left transition-all ${
                            salidasSeleccionadas.has(salida.id)
                              ? 'bg-blue-50 border-blue-300 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">{salida.numero_remito}</Badge>
                                {salidasSeleccionadas.has(salida.id) && (
                                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                )}
                              </div>
                              <p className="font-medium text-slate-800 truncate">{salida.cliente_nombre}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {format(new Date(salida.fecha), 'dd/MM/yyyy', { locale: es })} • {salida.kilos.toFixed(0)} kg
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-lg font-bold text-green-600">
                                ${salida.monto.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                              </p>
                              <p className="text-xs text-slate-500">
                                ${salida.precio_kg.toFixed(2)}/kg
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Viajes de Envases */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Truck className="h-5 w-5 text-amber-600" />
                    Viajes de Envases Contabilizados ({viajesDisponibles.length})
                  </h4>
                  {viajesDisponibles.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">
                      No hay viajes de envases contabilizados para este fletero
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {viajesDisponibles.map((viaje, idx) => (
                        <button
                          key={idx}
                          onClick={() => toggleViaje(idx)}
                          className={`w-full p-3 rounded-lg border text-left transition-all ${
                            viajesSeleccionados.has(idx)
                              ? 'bg-amber-50 border-amber-300 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="bg-amber-50">Viaje</Badge>
                                {viajesSeleccionados.has(idx) && (
                                  <CheckCircle2 className="h-4 w-4 text-amber-600" />
                                )}
                              </div>
                              <p className="font-medium text-slate-800 truncate">{viaje.descripcion}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {format(new Date(viaje.fecha), 'dd/MM/yyyy', { locale: es })}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-lg font-bold text-orange-600">
                                ${viaje.monto.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPaso(1)} className="flex-1">
                  Atrás
                </Button>
                <Button 
                  onClick={() => setPaso(3)} 
                  disabled={salidasSeleccionadas.size === 0 && viajesSeleccionados.size === 0}
                  className="flex-1"
                >
                  Siguiente: Ajustes y Pago
                </Button>
              </div>
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Ajustes y Forma de Pago</h3>
                <Button variant="outline" size="sm" onClick={() => setPaso(2)}>
                  Atrás
                </Button>
              </div>

              {/* Resumen */}
              {(() => {
                const { totalSalidas, totalViajes, total } = calcularTotales();
                return (
                  <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-green-900 mb-3">Resumen de Liquidación</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-green-700">Salidas de fruta ({salidasSeleccionadas.size}):</span>
                          <span className="font-bold text-green-900">${totalSalidas.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Viajes de envases ({viajesSeleccionados.size}):</span>
                          <span className="font-bold text-green-900">${totalViajes.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-green-300">
                          <span className="text-green-700 font-semibold">TOTAL A PAGAR:</span>
                          <span className="font-bold text-green-900 text-lg">${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Ajustes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Otros Conceptos (+)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.otros_conceptos}
                    onChange={(e) => setFormData({...formData, otros_conceptos: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <Label>Descuentos (-)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.descuentos}
                    onChange={(e) => setFormData({...formData, descuentos: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div>
                <Label>Fecha de Pago</Label>
                <Input
                  type="date"
                  value={formData.fecha_pago}
                  onChange={(e) => setFormData({...formData, fecha_pago: e.target.value})}
                />
              </div>

              <div>
                <Label>Notas</Label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({...formData, notas: e.target.value})}
                  className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm min-h-20"
                  placeholder="Notas adicionales..."
                />
              </div>

              {/* Pagar Ahora */}
              <Card className="border-2 border-purple-200 bg-purple-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      id="pagar-ahora"
                      checked={pagarAhora}
                      onChange={(e) => setPagarAhora(e.target.checked)}
                      className="h-4 w-4 rounded border-purple-300"
                    />
                    <label htmlFor="pagar-ahora" className="font-semibold text-purple-900 cursor-pointer">
                      Pagar Ahora
                    </label>
                  </div>

                  {pagarAhora && (
                    <div className="space-y-3 pt-3 border-t border-purple-300">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Forma de Pago *</Label>
                          <select
                            value={formData.forma_pago}
                            onChange={(e) => setFormData({
                              ...formData,
                              forma_pago: e.target.value,
                              cheque_id: e.target.value === 'Cheque' ? formData.cheque_id : ''
                            })}
                            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Tarjeta">Tarjeta</option>
                          </select>
                        </div>
                        <div>
                          <Label>Origen *</Label>
                          <select
                            value={formData.origen_tipo}
                            onChange={(e) => {
                              setOrigenSeleccionado(null);
                              setFormData({...formData, origen_tipo: e.target.value, origen_id: ''});
                            }}
                            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="Banco">Banco</option>
                            <option value="Caja">Caja</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <Label>Cuenta Origen *</Label>
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
                          <Label>Cheque *</Label>
                          <AsyncSelect
                            entityKey="Cheque"
                            value={formData.cheque_id}
                            onChange={(id) => setFormData({ ...formData, cheque_id: id })}
                            serverFilter={{ estado: 'Pendiente' }}
                            placeholder="Buscar cheque por numero..."
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {paso === 3 && (
            <Button
              onClick={handleGuardar}
              disabled={isLoading || (pagarAhora && !formData.origen_id)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {pagarAhora ? 'Liquidar y Pagar' : 'Guardar Liquidación'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}