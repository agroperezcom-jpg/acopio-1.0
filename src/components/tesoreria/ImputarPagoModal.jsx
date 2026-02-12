import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ImputarPagoModal({ open, onClose, pago, movimientos, onImputar, isLoading }) {
  const [seleccionados, setSeleccionados] = useState([]);

  // Filtrar movimientos del proveedor que tienen deuda pendiente
  const movimientosPendientes = useMemo(() => {
    if (!pago) return [];
    return movimientos.filter(m => 
      m.proveedor_id === pago.proveedor_id &&
      m.tipo_movimiento === 'Ingreso de Fruta' &&
      (m.deuda_total || 0) > (m.monto_pagado || 0)
    );
  }, [movimientos, pago]);

  const montoDisponible = pago?.monto_disponible || 0;
  const montoAsignado = seleccionados.reduce((sum, s) => sum + (s.monto || 0), 0);
  const montoRestante = (montoDisponible || 0) - (montoAsignado || 0);

  const toggleSeleccion = (movimiento) => {
    const yaSeleccionado = seleccionados.find(s => s.movimiento_id === movimiento.id);
    
    if (yaSeleccionado) {
      setSeleccionados(seleccionados.filter(s => s.movimiento_id !== movimiento.id));
    } else {
      const deudaPendiente = (movimiento.deuda_total || 0) - (movimiento.monto_pagado || 0);
      const montoAAplicar = Math.min(deudaPendiente, montoRestante);
      
      if (montoAAplicar > 0) {
        setSeleccionados([...seleccionados, {
          movimiento_id: movimiento.id,
          monto: montoAAplicar
        }]);
      }
    }
  };

  const actualizarMonto = (movimientoId, nuevoMonto) => {
    const movimiento = movimientosPendientes.find(m => m.id === movimientoId);
    if (!movimiento) return;

    const deudaPendiente = (movimiento.deuda_total || 0) - (movimiento.monto_pagado || 0);
    const otrosMontos = seleccionados.filter(s => s.movimiento_id !== movimientoId).reduce((sum, s) => sum + (s.monto || 0), 0);
    const disponibleParaEste = montoDisponible - otrosMontos;
    
    const montoValido = Math.max(0, Math.min(nuevoMonto, deudaPendiente, disponibleParaEste));
    
    setSeleccionados(seleccionados.map(s => 
      s.movimiento_id === movimientoId ? { ...s, monto: montoValido } : s
    ));
  };

  const handleImputar = () => {
    if (seleccionados.length === 0) return;
    onImputar(seleccionados);
  };

  if (!pago) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Imputar Pago a Comprobantes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info del pago */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">Proveedor:</span>
                <p className="font-semibold">{pago.proveedor_nombre}</p>
              </div>
              <div>
                <span className="text-slate-500">Fecha:</span>
                <p className="font-semibold">{format(new Date(pago.fecha), 'dd/MM/yyyy', { locale: es })}</p>
              </div>
              <div>
                <span className="text-slate-500">Monto Disponible:</span>
                <p className="font-semibold text-blue-600">
                  ${(montoDisponible || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Monto Restante:</span>
                <p className="font-semibold text-orange-600">
                  ${(montoRestante || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Lista de movimientos pendientes */}
          <div>
            <h3 className="font-semibold mb-3">Comprobantes de Compra con Deuda Pendiente</h3>
            
            {movimientosPendientes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileText className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                <p>No hay comprobantes pendientes de este proveedor</p>
              </div>
            ) : (
              <div className="space-y-2">
                {movimientosPendientes.map(mov => {
                  const deudaPendiente = (mov.deuda_total || 0) - (mov.monto_pagado || 0);
                  const seleccionado = seleccionados.find(s => s.movimiento_id === mov.id);
                  
                  return (
                    <div
                      key={mov.id}
                      className={`border rounded-lg p-4 transition-all ${
                        seleccionado ? 'border-green-300 bg-green-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium">
                              {format(new Date(mov.fecha), 'dd/MM/yyyy', { locale: es })}
                            </span>
                            <Badge variant="outline">Ingreso de Fruta</Badge>
                          </div>
                          
                          <div className="text-sm text-slate-600">
                            <span>Deuda Total: ${(mov.deuda_total || 0).toLocaleString('es-AR')}</span>
                            <span className="mx-2">•</span>
                            <span>Pagado: ${(mov.monto_pagado || 0).toLocaleString('es-AR')}</span>
                            <span className="mx-2">•</span>
                            <span className="font-semibold text-orange-600">
                              Pendiente: ${(deudaPendiente || 0).toLocaleString('es-AR')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {seleccionado && (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={seleccionado.monto}
                                onChange={(e) => actualizarMonto(mov.id, parseFloat(e.target.value) || 0)}
                                className="w-32"
                                min="0"
                                max={deudaPendiente}
                                step="0.01"
                              />
                            </div>
                          )}
                          
                          <Button
                            variant={seleccionado ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleSeleccion(mov)}
                            disabled={!seleccionado && montoRestante <= 0}
                          >
                            {seleccionado ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Seleccionado
                              </>
                            ) : (
                              'Seleccionar'
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumen */}
          {seleccionados.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">
                    {seleccionados.length} comprobante(s) seleccionado(s)
                  </p>
                  <p className="text-lg font-bold text-green-700">
                    Total a Imputar: ${(montoAsignado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleImputar}
              disabled={seleccionados.length === 0 || isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Imputando...
                </>
              ) : (
                'Imputar Pago'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}