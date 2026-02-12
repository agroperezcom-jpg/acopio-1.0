import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, Info } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import SearchableSelect from '@/components/SearchableSelect';
import AsyncSelect from '@/components/AsyncSelect';
import MediosPagoMixtosGrid from '@/components/tesoreria/MediosPagoMixtosGrid';
import MultiplesChequesGrid from '@/components/tesoreria/MultiplesChequesGrid';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function CobroConSalidasModal({ open, onClose, onSave, isLoading, clientes, bancos, cajas, salidas, cheques }) {
  const { data: bancosSistema = [] } = useQuery({
    queryKey: ['bancossistema'],
    queryFn: () => base44.entities.BancoSistema.list('nombre')
  });

  const { data: cuentasContables = [] } = useQuery({
    queryKey: ['plandecuentas'],
    queryFn: () => base44.entities.PlanDeCuentas.filter({ activa: true, imputable: true }, 'codigo')
  });
  const [tipoCobro, setTipoCobro] = useState('Aplicado'); // 'Aplicado' o 'A Cuenta'
  const [formData, setFormData] = useState({
    fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    cliente_id: '',
    forma_cobro: 'Efectivo',
    destino_tipo: 'Caja',
    destino_id: '',
    cheque_id: '',
    monto: 0,
    concepto: '',
    comprobante: '',
    notas: '',
    cuenta_contable_id: '',
    cuenta_contable_codigo: '',
    cuenta_contable_nombre: ''
  });
  
  const [mediosMixtos, setMediosMixtos] = useState([]);
  const [chequesSeleccionados, setChequesSeleccionados] = useState([]);

  const [salidasSeleccionadas, setSalidasSeleccionadas] = useState([]);

  React.useEffect(() => {
    if (open) {
      setTipoCobro('Aplicado');
      setFormData({
        fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        cliente_id: '',
        forma_cobro: 'Efectivo',
        destino_tipo: 'Caja',
        destino_id: '',
        cheque_id: '',
        monto: 0,
        concepto: '',
        comprobante: '',
        notas: '',
        cuenta_contable_id: '',
        cuenta_contable_codigo: '',
        cuenta_contable_nombre: ''
      });
      setSalidasSeleccionadas([]);
      setMediosMixtos([]);
      setChequesSeleccionados([]);
    }
  }, [open]);

  const salidasDelCliente = formData.cliente_id 
    ? salidas.filter(s => 
        s.cliente_id === formData.cliente_id && 
        s.estado === 'Confirmada' &&
        s.estado_cobro !== 'Cobrado'
      )
    : [];

  const toggleSalida = (salida) => {
    const existe = salidasSeleccionadas.find(s => s.salida_id === salida.id);
    if (existe) {
      setSalidasSeleccionadas(salidasSeleccionadas.filter(s => s.salida_id !== salida.id));
    } else {
      const pendiente = (salida.deuda_total || 0) - (salida.monto_cobrado || 0);
      setSalidasSeleccionadas([...salidasSeleccionadas, {
        salida_id: salida.id,
        monto_aplicado: pendiente,
        deuda_total: salida.deuda_total || 0,
        monto_cobrado: salida.monto_cobrado || 0,
        numero_remito: salida.numero_remito
      }]);
    }
  };

  const actualizarMontoSalida = (salidaId, nuevoMonto) => {
    setSalidasSeleccionadas(salidasSeleccionadas.map(s => 
      s.salida_id === salidaId ? { ...s, monto_aplicado: nuevoMonto } : s
    ));
  };

  const totalAPagar = salidasSeleccionadas.reduce((sum, s) => sum + s.monto_aplicado, 0);
  
  const totalCheques = chequesSeleccionados.reduce((sum, ch) => {
    if (ch.tipo === 'existente' && ch.cheque_id) {
      const chequeData = chequesDisponibles.find(c => c.id === ch.cheque_id);
      return sum + (chequeData?.monto || 0);
    } else if (ch.tipo === 'nuevo') {
      return sum + (ch.monto || 0);
    }
    return sum;
  }, 0);

  const handleGuardar = async () => {
    if (isLoading) return; // Prevenir clics múltiples
    
    if (!formData.cuenta_contable_id) {
      alert('Por favor seleccione una cuenta contable');
      return;
    }
    
    // Preparar medios de cobro detallados
    let mediosCobro = [];
    
    if (formData.forma_cobro === 'Mixta') {
      mediosCobro = mediosMixtos;
    } else if (formData.forma_cobro === 'Cheque') {
      // Procesar cheques: crear nuevos si es necesario
      for (const ch of chequesSeleccionados) {
        if (ch.tipo === 'nuevo') {
          // Crear el cheque nuevo
          const nuevoCheque = await base44.entities.Cheque.create({
            numero_cheque: ch.numero_cheque,
            tipo: 'Terceros',
            banco_id: ch.banco_id,
            banco_nombre: ch.banco_nombre,
            fecha_emision: ch.fecha_emision || format(new Date(), 'yyyy-MM-dd'),
            fecha_pago: ch.fecha_pago || format(new Date(), 'yyyy-MM-dd'),
            monto: ch.monto,
            emisor: ch.emisor || formData.cliente_nombre,
            titular: ch.titular || formData.cliente_nombre,
            estado: 'En Cartera'
          });
          
          mediosCobro.push({
            tipo: 'Cheque',
            destino_tipo: 'Cheque',
            destino_id: null,
            destino_nombre: 'Cheque',
            cheque_id: nuevoCheque.id,
            monto: ch.monto
          });
        } else if (ch.tipo === 'existente') {
          const chequeData = chequesDisponibles.find(c => c.id === ch.cheque_id);
          mediosCobro.push({
            tipo: 'Cheque',
            destino_tipo: 'Cheque',
            destino_id: null,
            destino_nombre: 'Cheque',
            cheque_id: ch.cheque_id,
            monto: chequeData?.monto || 0
          });
        }
      }
    } else {
      // Efectivo o Transferencia simple
      const destino = destinosDisponibles.find(d => d.id === formData.destino_id);
      mediosCobro.push({
        tipo: formData.forma_cobro,
        destino_tipo: formData.destino_tipo,
        destino_id: formData.destino_id,
        destino_nombre: destino?.nombre || '',
        monto: tipoCobro === 'A Cuenta' ? formData.monto : totalAPagar
      });
    }
    
    if (tipoCobro === 'A Cuenta') {
      const montoTotal = mediosCobro.reduce((sum, m) => sum + (m.monto || 0), 0);
      
      const cobroData = {
        fecha: formData.fecha,
        cliente_id: formData.cliente_id,
        cliente_nombre: clientes.find(c => c.id === formData.cliente_id)?.nombre || '',
        monto_total: montoTotal,
        concepto: formData.concepto,
        comprobante: formData.comprobante,
        notas: formData.notas,
        tipo_cobro: 'A Cuenta',
        monto_disponible: montoTotal,
        salidas_aplicadas: [],
        medios_cobro_detalles: mediosCobro,
        retenciones: []
      };
      onSave(cobroData);
    } else {
      if (salidasSeleccionadas.length === 0) return;

      const cobroData = {
        fecha: formData.fecha,
        cliente_id: formData.cliente_id,
        cliente_nombre: clientes.find(c => c.id === formData.cliente_id)?.nombre || '',
        monto_total: totalAPagar,
        concepto: formData.concepto || `Cobro de ${salidasSeleccionadas.length} salida(s)`,
        comprobante: formData.comprobante,
        notas: formData.notas,
        tipo_cobro: 'Aplicado',
        salidas_aplicadas: salidasSeleccionadas.map(s => ({
          salida_id: s.salida_id,
          monto_aplicado: s.monto_aplicado
        })),
        medios_cobro_detalles: mediosCobro,
        retenciones: []
      };

      onSave(cobroData);
    }
  };

  const destinosDisponibles = formData.destino_tipo === 'Banco' ? bancos : cajas;
  const chequesDisponibles = cheques?.filter(ch => ch.estado === 'Pendiente' && ch.origen === 'Terceros') || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Cobro</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-4">
          {/* Tipo de Cobro */}
          <Card className="border-2 border-purple-200 bg-purple-50">
            <CardContent className="p-4">
              <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <Info className="h-5 w-5" />
                Tipo de Cobro
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setTipoCobro('Aplicado');
                    setSalidasSeleccionadas([]);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    tipoCobro === 'Aplicado'
                      ? 'bg-green-100 border-green-500 shadow-md'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-semibold text-slate-800 mb-1">Aplicar a Salidas</p>
                  <p className="text-xs text-slate-600">Asignar el cobro a salidas de fruta específicas</p>
                </button>
                <button
                  onClick={() => {
                    setTipoCobro('A Cuenta');
                    setSalidasSeleccionadas([]);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    tipoCobro === 'A Cuenta'
                      ? 'bg-amber-100 border-amber-500 shadow-md'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-semibold text-slate-800 mb-1">Cobro a Cuenta</p>
                  <p className="text-xs text-slate-600">Dinero adelantado sin asignar a movimientos (precios no confirmados)</p>
                </button>
              </div>
              {tipoCobro === 'A Cuenta' && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                  <p className="text-xs text-amber-900">
                    💡 <strong>Cobro a Cuenta:</strong> Úsalo cuando recibas dinero pero los precios finales aún no estén confirmados. 
                    Podrás aplicar este dinero a salidas específicas más adelante.
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
            <p className="text-xs text-slate-500 mt-1">Este cobro se registrará en el Estado de Resultados</p>
          </div>

          {/* Selección de Cliente (búsqueda asíncrona) */}
          <div>
            <label className="text-sm font-medium">Cliente *</label>
            <AsyncSelect
              entityKey="Cliente"
              value={formData.cliente_id}
              onChange={(id) => {
                setFormData({...formData, cliente_id: id});
                setSalidasSeleccionadas([]);
              }}
              placeholder="Buscar cliente..."
            />
          </div>

          {/* Salidas Pendientes - SOLO si es tipo "Aplicado" */}
          {tipoCobro === 'Aplicado' && formData.cliente_id && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-800">Salidas Pendientes de Cobro</h3>
              {salidasDelCliente.length === 0 ? (
                <Card className="bg-slate-50">
                  <CardContent className="p-6 text-center">
                    <CheckCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">No hay salidas pendientes de cobro para este cliente</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {salidasDelCliente.map(salida => {
                    const seleccionada = salidasSeleccionadas.find(s => s.salida_id === salida.id);
                    const pendiente = (salida.deuda_total || 0) - (salida.monto_cobrado || 0);
                    
                    return (
                      <Card key={salida.id} className={`border cursor-pointer transition-all ${
                        seleccionada ? 'bg-green-50 border-green-300 shadow-sm' : 'hover:border-slate-300'
                      }`}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={!!seleccionada}
                              onChange={() => toggleSalida(salida)}
                              className="h-4 w-4 mt-1 rounded border-slate-300"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-slate-800">{salida.numero_remito}</p>
                                <Badge variant="outline" className="text-xs">
                                  {format(new Date(salida.fecha), 'dd/MM/yyyy', { locale: es })}
                                </Badge>
                                {salida.estado_cobro === 'Pago Parcial' && (
                                  <Badge className="bg-amber-100 text-amber-800 text-xs">
                                    Pago Parcial
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                                <div>
                                  <span className="text-slate-500">Total:</span>
                                  <p className="font-semibold">${salida.deuda_total?.toLocaleString('es-AR')}</p>
                                </div>
                                <div>
                                  <span className="text-slate-500">Cobrado:</span>
                                  <p className="font-semibold text-green-600">${(salida.monto_cobrado || 0).toLocaleString('es-AR')}</p>
                                </div>
                                <div>
                                  <span className="text-slate-500">Pendiente:</span>
                                  <p className="font-bold text-red-600">${pendiente.toLocaleString('es-AR')}</p>
                                </div>
                              </div>
                            </div>
                            {seleccionada && (
                              <div className="w-32">
                                <label className="text-xs text-slate-500">Cobrar ahora:</label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={seleccionada.monto_aplicado}
                                  onChange={(e) => actualizarMontoSalida(salida.id, parseFloat(e.target.value) || 0)}
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

          {/* Resumen de Cobro - SOLO si es tipo "Aplicado" */}
          {tipoCobro === 'Aplicado' && salidasSeleccionadas.length > 0 && (
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4">
                <h4 className="font-semibold text-green-900 mb-3">Resumen del Cobro</h4>
                <div className="space-y-2 text-sm">
                  {salidasSeleccionadas.map(s => (
                    <div key={s.salida_id} className="flex justify-between">
                      <span className="text-slate-700">{s.numero_remito}:</span>
                      <span className="font-semibold">${s.monto_aplicado.toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 mt-2 border-t-2 border-green-300">
                    <span className="font-bold">TOTAL A COBRAR:</span>
                    <span className="font-bold text-xl text-green-700">${totalAPagar.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detalles del Cobro */}
          {(tipoCobro === 'A Cuenta' || salidasSeleccionadas.length > 0) && (
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <h4 className="font-semibold text-slate-800">Detalles del Cobro</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Fecha *</label>
                  <Input type="datetime-local" value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Forma de Cobro *</label>
                  <select
                    value={formData.forma_cobro}
                    onChange={(e) => {
                      const nuevaForma = e.target.value;
                      let nuevoDestinoTipo = formData.destino_tipo;
                      
                      // Determinar automáticamente el tipo de cuenta según la forma
                      if (nuevaForma === 'Efectivo') nuevoDestinoTipo = 'Caja';
                      else if (nuevaForma === 'Transferencia') nuevoDestinoTipo = 'Banco';
                      else if (nuevaForma === 'Cheque') nuevoDestinoTipo = 'Cheque';
                      
                      setFormData({
                        ...formData, 
                        forma_cobro: nuevaForma,
                        destino_tipo: nuevoDestinoTipo,
                        destino_id: ''
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
              {formData.forma_cobro === 'Mixta' ? (
                <MediosPagoMixtosGrid
                  montoTotal={tipoCobro === 'A Cuenta' ? formData.monto : totalAPagar}
                  medios={mediosMixtos}
                  onChange={setMediosMixtos}
                  bancos={bancos}
                  cajas={cajas}
                  cheques={cheques}
                  esIngreso={true}
                  onCrearCheque={(callback) => {
                    const numero_cheque = prompt('Número de cheque:');
                    const banco_id = bancosSistema[0]?.id;
                    if (numero_cheque && banco_id) {
                      const banco = bancosSistema.find(b => b.id === banco_id);
                      base44.entities.Cheque.create({
                        numero_cheque,
                        tipo: 'Físico',
                        origen: 'Terceros',
                        banco_id,
                        banco_nombre: banco?.nombre || '',
                        fecha_emision: format(new Date(), 'yyyy-MM-dd'),
                        fecha_pago: format(new Date(), 'yyyy-MM-dd'),
                        monto: 0,
                        estado: 'Pendiente',
                        origen_modulo: 'Cobro'
                      }).then((nuevoCheque) => {
                        callback(nuevoCheque.id);
                        toast.success('Cheque registrado');
                      });
                    }
                  }}
                />
              ) : (
                <>
                  {formData.forma_cobro !== 'Cheque' && (
                    <div>
                      <label className="text-sm font-medium">
                        {formData.forma_cobro === 'Efectivo' && 'Caja Destino *'}
                        {formData.forma_cobro === 'Transferencia' && 'Banco Destino *'}
                        {formData.forma_cobro === 'Tarjeta' && 'Cuenta Destino *'}
                      </label>
                      <SearchableSelect
                        options={destinosDisponibles}
                        value={formData.destino_id}
                        onChange={(id) => setFormData({...formData, destino_id: id})}
                        displayKey="nombre"
                        placeholder={`Seleccionar ${formData.destino_tipo === 'Banco' ? 'banco' : 'caja'}...`}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Monto - Solo para A Cuenta */}
              {tipoCobro === 'A Cuenta' && (
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
                <label className="text-sm font-medium">Concepto {tipoCobro === 'A Cuenta' ? '*' : ''}</label>
                <Input 
                  value={formData.concepto} 
                  onChange={(e) => setFormData({...formData, concepto: e.target.value})} 
                  className="mt-1" 
                  placeholder={tipoCobro === 'A Cuenta' ? 'Ej: Adelanto por futuras salidas' : 'Opcional, se genera automático'} 
                />
              </div>

              <div>
                <label className="text-sm font-medium">Comprobante</label>
                <Input value={formData.comprobante} onChange={(e) => setFormData({...formData, comprobante: e.target.value})} className="mt-1" />
              </div>

              {/* Datos de Cheques - Solo si forma_cobro es Cheque */}
              {formData.forma_cobro === 'Cheque' && (
                <Card className="border-2 border-purple-200 bg-purple-50">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-purple-900 mb-3">Cheques de Terceros</h4>
                    <MultiplesChequesGrid
                      cheques={chequesSeleccionados}
                      onChange={setChequesSeleccionados}
                      chequesDisponibles={chequesDisponibles}
                      bancosSistema={bancosSistema}
                      esTerceros={true}
                    />
                    <p className="text-xs text-purple-700 mt-3">
                      💡 Puedes seleccionar cheques existentes o crear nuevos cheques de terceros
                    </p>
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
              !formData.cliente_id || 
              (formData.forma_cobro !== 'Mixta' && formData.forma_cobro !== 'Cheque' && !formData.destino_id) ||
              (formData.forma_cobro === 'Mixta' && mediosMixtos.length === 0) ||
              (tipoCobro === 'Aplicado' && salidasSeleccionadas.length === 0) ||
              (tipoCobro === 'A Cuenta' && formData.forma_cobro !== 'Cheque' && formData.forma_cobro !== 'Mixta' && (formData.monto <= 0 || !formData.concepto)) ||
              (tipoCobro === 'A Cuenta' && !formData.concepto) ||
              (formData.forma_cobro === 'Cheque' && chequesSeleccionados.length === 0) ||
              (formData.forma_cobro === 'Cheque' && chequesSeleccionados.some(ch => 
                (ch.tipo === 'existente' && !ch.cheque_id) ||
                (ch.tipo === 'nuevo' && (!ch.numero_cheque || !ch.banco_id || ch.monto <= 0))
              ))
            }
            className={tipoCobro === 'A Cuenta' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {tipoCobro === 'A Cuenta' 
              ? `Guardar Cobro a Cuenta ($${(formData.forma_cobro === 'Cheque' ? totalCheques : formData.forma_cobro === 'Mixta' ? mediosMixtos.reduce((s, m) => s + (m.importe || 0), 0) : formData.monto).toLocaleString('es-AR')})`
              : `Guardar Cobro ($${totalAPagar.toLocaleString('es-AR')})`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}