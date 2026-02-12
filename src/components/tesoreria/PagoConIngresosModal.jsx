import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, Info } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import SearchableSelect from '@/components/SearchableSelect';
import AsyncSelect from '@/components/AsyncSelect';
import MediosPagoMixtosGrid from '@/components/tesoreria/MediosPagoMixtosGrid';
import MultiplesChequesGrid from '@/components/tesoreria/MultiplesChequesGrid';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { usePreciosCache } from '@/components/hooks/usePreciosCache';

export default function PagoConIngresosModal({ open, onClose, onSave, isLoading, proveedores, bancos, cajas, movimientos, cheques }) {
  const { data: bancosSistema = [] } = useQuery({
    queryKey: ['bancossistema'],
    queryFn: () => base44.entities.BancoSistema.list('nombre')
  });

  const { data: cuentasContables = [] } = useQuery({
    queryKey: ['plandecuentas'],
    queryFn: () => base44.entities.PlanDeCuentas.filter({ activa: true, imputable: true }, 'codigo'),
    staleTime: 10 * 60 * 1000
  });

  const { data: movimientosCC = [] } = useQuery({
    queryKey: ['cuentacorriente'],
    queryFn: () => base44.entities.CuentaCorriente.list('-fecha', 500),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const [tipoPago, setTipoPago] = useState('Aplicado'); // 'Aplicado' o 'A Cuenta'
  const [formData, setFormData] = useState({
    fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    proveedor_id: '',
    forma_pago: 'Efectivo',
    origen_tipo: 'Caja',
    origen_id: '',
    cheque_id: '',
    monto: 0,
    concepto: '',
    comprobante: '',
    notas: '',
    cuenta_contable_id: '',
    cuenta_contable_nombre: ''
  });
  
  const [mediosMixtos, setMediosMixtos] = useState([]);
  const [chequesSeleccionados, setChequesSeleccionados] = useState([]);

  const [ingresosSeleccionados, setIngresosSeleccionados] = useState([]);

  React.useEffect(() => {
    if (open) {
      setTipoPago('Aplicado');
      setFormData({
        fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        proveedor_id: '',
        forma_pago: 'Efectivo',
        origen_tipo: 'Caja',
        origen_id: '',
        cheque_id: '',
        monto: 0,
        concepto: '',
        comprobante: '',
        notas: '',
        cuenta_contable_id: '',
        cuenta_contable_codigo: '',
        cuenta_contable_nombre: ''
      });
      setIngresosSeleccionados([]);
      setMediosMixtos([]);
      setChequesSeleccionados([]);
    }
  }, [open]);

  const ingresosDelProveedor = formData.proveedor_id 
    ? movimientos.filter(m => 
        m.tipo_movimiento === 'Ingreso de Fruta' &&
        m.proveedor_id === formData.proveedor_id && 
        m.estado_pago !== 'Pagado'
      )
    : [];

  const toggleIngreso = (ingreso) => {
    const existe = ingresosSeleccionados.find(i => i.movimiento_id === ingreso.id);
    if (existe) {
      setIngresosSeleccionados(ingresosSeleccionados.filter(i => i.movimiento_id !== ingreso.id));
    } else {
      const pendiente = (ingreso.deuda_total || 0) - (ingreso.monto_pagado || 0);
      setIngresosSeleccionados([...ingresosSeleccionados, {
        movimiento_id: ingreso.id,
        monto_aplicado: pendiente,
        deuda_total: ingreso.deuda_total || 0,
        monto_pagado: ingreso.monto_pagado || 0,
        fecha_ingreso: ingreso.fecha
      }]);
    }
  };

  const actualizarMontoIngreso = (ingresoId, nuevoMonto) => {
    setIngresosSeleccionados(ingresosSeleccionados.map(i => 
      i.movimiento_id === ingresoId ? { ...i, monto_aplicado: nuevoMonto } : i
    ));
  };

  const totalAPagar = ingresosSeleccionados.reduce((sum, i) => sum + i.monto_aplicado, 0);
  
  const totalCheques = chequesSeleccionados.reduce((sum, ch) => {
    if (ch.tipo === 'existente' && ch.cheque_id) {
      const chequeData = chequesDisponibles.find(c => c.id === ch.cheque_id);
      return sum + (chequeData?.monto || 0);
    } else if (ch.tipo === 'nuevo') {
      return sum + (ch.monto || 0);
    }
    return sum;
  }, 0);

  const handleGuardar = () => {
    if (isLoading) return; // Prevenir clics múltiples
    
    if (!formData.cuenta_contable_id) {
      alert('Por favor seleccione una cuenta contable');
      return;
    }
    
    if (tipoPago === 'A Cuenta') {
      // Pago a cuenta: sin seleccionar ingresos
      // Calcular monto según forma de pago
      let montoTotal = formData.monto;
      if (formData.forma_pago === 'Cheque') {
        montoTotal = totalCheques;
      } else if (formData.forma_pago === 'Mixta') {
        montoTotal = mediosMixtos.reduce((s, m) => s + (m.importe || 0), 0);
      }
      
      const pagoData = {
        ...formData,
        monto_total: montoTotal,
        tipo_pago: 'A Cuenta',
        monto_disponible: montoTotal,
        ingresos_aplicados: [],
        _mediosMixtos: formData.forma_pago === 'Mixta' ? mediosMixtos : null,
        _chequesSeleccionados: formData.forma_pago === 'Cheque' ? chequesSeleccionados : null
      };
      onSave(pagoData);
    } else {
      // Pago aplicado: con ingresos seleccionados
      if (ingresosSeleccionados.length === 0) {
        return;
      }

      const pagoData = {
        ...formData,
        tipo_pago: 'Aplicado',
        monto_total: totalAPagar,
        concepto: formData.concepto || `Pago de ${ingresosSeleccionados.length} ingreso(s)`,
        ingresos_aplicados: ingresosSeleccionados.map(i => ({
          movimiento_id: i.movimiento_id,
          monto_aplicado: i.monto_aplicado
        })),
        _mediosMixtos: formData.forma_pago === 'Mixta' ? mediosMixtos : null,
        _chequesSeleccionados: formData.forma_pago === 'Cheque' ? chequesSeleccionados : null
      };

      onSave(pagoData);
    }
  };

  const origenesDisponibles = formData.origen_tipo === 'Banco' ? bancos : cajas;
  const chequesDisponibles = cheques?.filter(ch => ch.estado === 'Pendiente' && ch.origen === 'Propio') || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Pago</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-4">
          {/* Tipo de Pago */}
          <Card className="border-2 border-purple-200 bg-purple-50">
            <CardContent className="p-4">
              <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <Info className="h-5 w-5" />
                Tipo de Pago
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setTipoPago('Aplicado');
                    setIngresosSeleccionados([]);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    tipoPago === 'Aplicado'
                      ? 'bg-red-100 border-red-500 shadow-md'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-semibold text-slate-800 mb-1">Aplicar a Ingresos</p>
                  <p className="text-xs text-slate-600">Asignar el pago a ingresos de fruta específicos</p>
                </button>
                <button
                  onClick={() => {
                    setTipoPago('A Cuenta');
                    setIngresosSeleccionados([]);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    tipoPago === 'A Cuenta'
                      ? 'bg-amber-100 border-amber-500 shadow-md'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-semibold text-slate-800 mb-1">Pago a Cuenta</p>
                  <p className="text-xs text-slate-600">Dinero adelantado sin asignar a movimientos (precios no confirmados)</p>
                </button>
              </div>
              {tipoPago === 'A Cuenta' && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                  <p className="text-xs text-amber-900">
                    💡 <strong>Pago a Cuenta:</strong> Úsalo cuando adelantes dinero pero los precios finales aún no estén confirmados. 
                    Podrás aplicar este dinero a ingresos específicos más adelante.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cuenta Contable */}
          <div>
            <label className="text-sm font-medium">Cuenta Contable *</label>
            <SearchableSelect
              options={cuentasContables.filter(c => c.activa !== false && c.imputable !== false)}
              value={formData.cuenta_contable_id}
              onChange={(id, cuenta) => {
                setFormData({
                  ...formData,
                  cuenta_contable_id: id,
                  cuenta_contable_codigo: cuenta?.codigo || '',
                  cuenta_contable_nombre: cuenta?.nombre || ''
                });
              }}
              displayKey="nombre"
              placeholder="Seleccionar cuenta contable..."
            />
            {formData.cuenta_contable_codigo && (
              <p className="text-xs text-slate-500 mt-1">Código: {formData.cuenta_contable_codigo}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">Este pago se registrará en el Estado de Resultados</p>
          </div>

          {/* Selección de Proveedor */}
          <div>
            <label className="text-sm font-medium">Proveedor *</label>
            <AsyncSelect
              entityKey="Proveedor"
              value={formData.proveedor_id}
              onChange={(id) => {
                setFormData({...formData, proveedor_id: id});
                setIngresosSeleccionados([]);
              }}
              placeholder="Buscar proveedor..."
            />
          </div>

          {/* Ingresos Pendientes - SOLO si es tipo "Aplicado" */}
          {tipoPago === 'Aplicado' && formData.proveedor_id && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-800">Ingresos Pendientes de Pago</h3>
              {ingresosDelProveedor.length === 0 ? (
                <Card className="bg-slate-50">
                  <CardContent className="p-6 text-center">
                    <CheckCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">No hay ingresos pendientes de pago para este proveedor</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {ingresosDelProveedor.map(ingreso => {
                    const seleccionado = ingresosSeleccionados.find(i => i.movimiento_id === ingreso.id);
                    // Obtener el saldo del proveedor desde Cuenta Corriente (más reciente)
                    const movimientosCCProveedor = movimientosCC.filter(m => m.entidad_id === formData.proveedor_id && m.entidad_tipo === 'Proveedor').sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                    const pendiente = movimientosCCProveedor.length > 0 ? movimientosCCProveedor[0].saldo_resultante || 0 : 0;
                    
                    return (
                      <Card key={ingreso.id} className={`border cursor-pointer transition-all ${
                        seleccionado ? 'bg-red-50 border-red-300 shadow-sm' : 'hover:border-slate-300'
                      }`}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={!!seleccionado}
                              onChange={() => toggleIngreso(ingreso)}
                              className="h-4 w-4 mt-1 rounded border-slate-300"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-slate-800">Ingreso {format(new Date(ingreso.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                                {ingreso.estado_pago === 'Pago Parcial' && (
                                  <Badge className="bg-amber-100 text-amber-800 text-xs">
                                    Pago Parcial
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                                <div>
                                 <span className="text-slate-500">Total:</span>
                                 <p className="font-semibold">${(ingreso.deuda_total || 0).toLocaleString('es-AR')}</p>
                                </div>
                                <div>
                                 <span className="text-slate-500">Pagado:</span>
                                 <p className="font-semibold text-green-600">${(ingreso.monto_pagado || 0).toLocaleString('es-AR')}</p>
                                </div>
                                <div>
                                 <span className="text-slate-500">Pendiente:</span>
                                 <p className="font-bold text-red-600">${(pendiente || 0).toLocaleString('es-AR')}</p>
                                </div>
                              </div>
                            </div>
                            {seleccionado && (
                              <div className="w-32">
                                <label className="text-xs text-slate-500">Pagar ahora:</label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={seleccionado.monto_aplicado}
                                  onChange={(e) => actualizarMontoIngreso(ingreso.id, parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm mt-1"
                                />
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Resumen de Pago - SOLO si es tipo "Aplicado" */}
          {tipoPago === 'Aplicado' && ingresosSeleccionados.length > 0 && (
            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <CardContent className="p-4">
                <h4 className="font-semibold text-red-900 mb-3">Resumen del Pago</h4>
                <div className="space-y-2 text-sm">
                  {ingresosSeleccionados.map(i => (
                   <div key={i.movimiento_id} className="flex justify-between">
                     <span className="text-slate-700">Ingreso {format(new Date(i.fecha_ingreso), 'dd/MM', { locale: es })}:</span>
                     <span className="font-semibold">${(i.monto_aplicado || 0).toLocaleString('es-AR')}</span>
                   </div>
                  ))}
                  <div className="flex justify-between pt-2 mt-2 border-t-2 border-red-300">
                   <span className="font-bold">TOTAL A PAGAR:</span>
                   <span className="font-bold text-xl text-red-700">${(totalAPagar || 0).toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detalles del Pago */}
          {(tipoPago === 'A Cuenta' || ingresosSeleccionados.length > 0) && (
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <h4 className="font-semibold text-slate-800">Detalles del Pago</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Fecha *</label>
                  <Input type="datetime-local" value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Forma de Pago *</label>
                  <select
                    value={formData.forma_pago}
                    onChange={(e) => {
                      const nuevaForma = e.target.value;
                      let nuevoOrigenTipo = formData.origen_tipo;
                      
                      // Determinar automáticamente el tipo de cuenta según la forma
                      if (nuevaForma === 'Efectivo') nuevoOrigenTipo = 'Caja';
                      else if (nuevaForma === 'Transferencia') nuevoOrigenTipo = 'Banco';
                      else if (nuevaForma === 'Cheque') nuevoOrigenTipo = 'Cheque';
                      
                      setFormData({
                        ...formData, 
                        forma_pago: nuevaForma,
                        origen_tipo: nuevoOrigenTipo,
                        origen_id: ''
                      });
                    }}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm mt-1"
                  >
                    <option value="Efectivo">💵 Efectivo → Caja</option>
                    <option value="Transferencia">🏦 Transferencia → Banco</option>
                    <option value="Cheque">📄 Cheque</option>
                    <option value="Mixta">💳 Mixta (varios medios)</option>
                  </select>
                </div>
              </div>

              {/* Forma MIXTA: mostrar grilla de medios */}
              {formData.forma_pago === 'Mixta' ? (
                <MediosPagoMixtosGrid
                  montoTotal={tipoPago === 'A Cuenta' ? formData.monto : totalAPagar}
                  medios={mediosMixtos}
                  onChange={setMediosMixtos}
                  bancos={bancos}
                  cajas={cajas}
                  cheques={cheques}
                  esIngreso={false}
                  onCrearCheque={(callback) => {
                    const numero_cheque = prompt('Número de cheque:');
                    const banco_id = bancosSistema[0]?.id;
                    if (numero_cheque && banco_id) {
                      const banco = bancosSistema.find(b => b.id === banco_id);
                      base44.entities.Cheque.create({
                        numero_cheque,
                        tipo: 'Físico',
                        origen: 'Propio',
                        banco_id,
                        banco_nombre: banco?.nombre || '',
                        fecha_emision: format(new Date(), 'yyyy-MM-dd'),
                        fecha_pago: format(new Date(), 'yyyy-MM-dd'),
                        monto: 0,
                        estado: 'Pendiente',
                        origen_modulo: 'Pago',
                        emisor: 'Empresa'
                      }).then((nuevoCheque) => {
                        callback(nuevoCheque.id);
                        toast.success('Cheque registrado');
                      });
                    }
                  }}
                />
              ) : (
                <>
                  {formData.forma_pago !== 'Cheque' && (
                    <div>
                      <label className="text-sm font-medium">
                        {formData.forma_pago === 'Efectivo' && 'Caja Origen *'}
                        {formData.forma_pago === 'Transferencia' && 'Banco Origen *'}
                        {formData.forma_pago === 'Tarjeta' && 'Cuenta Origen *'}
                      </label>
                      <SearchableSelect
                        options={origenesDisponibles}
                        value={formData.origen_id}
                        onChange={(id) => setFormData({...formData, origen_id: id})}
                        displayKey="nombre"
                        placeholder={`Seleccionar ${formData.origen_tipo === 'Banco' ? 'banco' : 'caja'}...`}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Monto - Solo para A Cuenta */}
              {tipoPago === 'A Cuenta' && (
                <div>
                  <label className="text-sm font-medium">Monto *</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={formData.monto} 
                    onChange={(e) => setFormData({...formData, monto: parseFloat(e.target.value) || 0})} 
                    className="mt-1" 
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Concepto {tipoPago === 'A Cuenta' ? '*' : ''}</label>
                <Input 
                  value={formData.concepto} 
                  onChange={(e) => setFormData({...formData, concepto: e.target.value})} 
                  className="mt-1" 
                  placeholder={tipoPago === 'A Cuenta' ? 'Ej: Adelanto por futuros ingresos' : 'Opcional, se genera automático'} 
                />
              </div>

              <div>
                <label className="text-sm font-medium">Comprobante</label>
                <Input value={formData.comprobante} onChange={(e) => setFormData({...formData, comprobante: e.target.value})} className="mt-1" />
              </div>

              {/* Datos de Cheques - Solo si forma_pago es Cheque */}
              {formData.forma_pago === 'Cheque' && (
                <Card className="border-2 border-amber-200 bg-amber-50">
                  <CardContent className="p-4">
                    <MultiplesChequesGrid
                      cheques={chequesSeleccionados}
                      onChange={setChequesSeleccionados}
                      chequesDisponibles={chequesDisponibles}
                      bancosSistema={bancosSistema}
                      esTerceros={false}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={handleGuardar} 
            disabled={
              isLoading || 
              !formData.proveedor_id ||
              !formData.cuenta_contable_id ||
              (formData.forma_pago !== 'Mixta' && formData.forma_pago !== 'Cheque' && !formData.origen_id) ||
              (formData.forma_pago === 'Mixta' && (mediosMixtos.length === 0 || Math.abs((tipoPago === 'A Cuenta' ? formData.monto : totalAPagar) - mediosMixtos.reduce((s, m) => s + (m.importe || 0), 0)) >= 0.01)) ||
              (tipoPago === 'Aplicado' && ingresosSeleccionados.length === 0) ||
              (tipoPago === 'A Cuenta' && (formData.monto <= 0 || !formData.concepto)) ||
              (formData.forma_pago === 'Cheque' && (chequesSeleccionados.length === 0 || Math.abs((tipoPago === 'A Cuenta' ? formData.monto : totalAPagar) - totalCheques) >= 0.01)) ||
              (formData.forma_pago === 'Cheque' && chequesSeleccionados.some(ch => 
                (ch.tipo === 'existente' && !ch.cheque_id) ||
                (ch.tipo === 'nuevo' && (!ch.numero_cheque || !ch.banco_id || ch.monto <= 0 || !ch.beneficiario))
              ))
            }
            className={tipoPago === 'A Cuenta' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {tipoPago === 'A Cuenta' 
              ? `Guardar Pago a Cuenta ($${(formData.forma_pago === 'Cheque' ? totalCheques : formData.forma_pago === 'Mixta' ? mediosMixtos.reduce((s, m) => s + (m.importe || 0), 0) : formData.monto || 0).toLocaleString('es-AR')})`
              : `Guardar Pago ($${(totalAPagar || 0).toLocaleString('es-AR')})`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}