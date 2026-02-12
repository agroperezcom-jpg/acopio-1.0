import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Edit } from "lucide-react";
import { format } from 'date-fns';
import AsyncSelect from "./AsyncSelect";

export default function EditarMovimientoModal({ 
  open, 
  onClose, 
  movimiento, 
  onSave, 
  isLoading
}) {
  const [formData, setFormData] = useState({});
  const [envasesEditables, setEnvasesEditables] = useState([]);

  useEffect(() => {
    if (movimiento && open) {
      setFormData({
        fecha: movimiento.fecha ? format(new Date(movimiento.fecha), "yyyy-MM-dd'T'HH:mm") : '',
        notas: movimiento.notas || '',
        proveedor_id: movimiento.proveedor_id || '',
        cliente_id: movimiento.cliente_id || '',
        fletero_id: movimiento.fletero_id || '',
        numero_remito: movimiento.numero_remito || '',
        comprobante_cliente: movimiento.comprobante_cliente || ''
      });
      
      // Cargar envases editables si es movimiento de envases
      if (movimiento.movimiento_envases) {
        setEnvasesEditables(movimiento.movimiento_envases.map(e => ({ ...e })));
      } else {
        setEnvasesEditables([]);
      }
    }
  }, [movimiento, open]);

  const handleSave = () => {
    // Si hay envases editables, incluirlos en el formData
    const dataToSave = esMovEnvases 
      ? { ...formData, movimiento_envases: envasesEditables }
      : formData;
    onSave(dataToSave);
  };

  const toggleContabilizar = (index) => {
    const nuevosEnvases = [...envasesEditables];
    nuevosEnvases[index].contabilizar_viaje = !nuevosEnvases[index].contabilizar_viaje;
    setEnvasesEditables(nuevosEnvases);
  };

  if (!movimiento) return null;

  const esIngreso = movimiento.tipo === 'Ingreso de Fruta';
  const esSalida = movimiento.tipo === 'Salida de Fruta';
  const esMovEnvases = movimiento.tipo === 'Movimiento de Envases';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-blue-600" />
            Editar {movimiento.tipo}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Campos editables */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Fecha y Hora</label>
              <Input
                type="datetime-local"
                value={formData.fecha}
                onChange={(e) => setFormData({...formData, fecha: e.target.value})}
              />
            </div>

            {/* Proveedor (si aplica) */}
            {(esIngreso || (esMovEnvases && movimiento.proveedor_id)) && (
              <div>
                <label className="text-sm font-medium mb-2 block">Proveedor</label>
                <AsyncSelect
                  entityKey="Proveedor"
                  value={formData.proveedor_id}
                  onChange={(id) => setFormData({...formData, proveedor_id: id})}
                  placeholder="Buscar proveedor..."
                  initialOption={formData.proveedor_id ? { id: formData.proveedor_id, nombre: movimiento.proveedor_nombre } : null}
                />
              </div>
            )}

            {/* Cliente (si aplica) */}
            {(esSalida || (esMovEnvases && movimiento.cliente_id)) && (
              <div>
                <label className="text-sm font-medium mb-2 block">Cliente</label>
                <AsyncSelect
                  entityKey="Cliente"
                  value={formData.cliente_id}
                  onChange={(id) => setFormData({...formData, cliente_id: id})}
                  placeholder="Buscar cliente..."
                  initialOption={formData.cliente_id ? { id: formData.cliente_id, nombre: movimiento.cliente_nombre } : null}
                />
              </div>
            )}

            {/* Fletero */}
            {movimiento.fletero_id && (
              <div>
                <label className="text-sm font-medium mb-2 block">Fletero</label>
                <AsyncSelect
                  entityKey="Fletero"
                  value={formData.fletero_id}
                  onChange={(id) => setFormData({...formData, fletero_id: id})}
                  placeholder="Buscar fletero..."
                  initialOption={formData.fletero_id ? { id: formData.fletero_id, nombre: movimiento.fletero_nombre } : null}
                />
              </div>
            )}

            {/* Número de remito (si es salida) */}
            {esSalida && (
              <div>
                <label className="text-sm font-medium mb-2 block">Número de Remito</label>
                <Input
                  value={formData.numero_remito}
                  onChange={(e) => setFormData({...formData, numero_remito: e.target.value})}
                  placeholder="R00001-00000001"
                />
              </div>
            )}

            {/* Comprobante cliente (si es salida confirmada) */}
            {esSalida && movimiento.estado === 'Confirmada' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Comprobante del Cliente</label>
                <Input
                  value={formData.comprobante_cliente}
                  onChange={(e) => setFormData({...formData, comprobante_cliente: e.target.value})}
                  placeholder="FAC-A-00001234"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Notas</label>
              <Textarea
                value={formData.notas}
                onChange={(e) => setFormData({...formData, notas: e.target.value})}
                rows={3}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>

          {/* Vista de datos del movimiento */}
          <div className="border-t pt-4 space-y-3">
            <h4 className="font-semibold text-sm text-slate-700">Resumen del Movimiento</h4>
            
            {esIngreso && movimiento.pesajes?.length > 0 && (
              <div className="text-xs bg-green-50 p-3 rounded">
                <p className="font-medium mb-1">Pesajes: {movimiento.pesajes.length}</p>
                <p>Total Neto: {movimiento.pesajes.reduce((s, p) => s + (p.peso_neto || 0), 0).toFixed(2)} kg</p>
              </div>
            )}

            {esSalida && movimiento.detalles?.length > 0 && (
              <div className="text-xs bg-purple-50 p-3 rounded">
                <p className="font-medium mb-1">Productos: {movimiento.detalles.length}</p>
                <p>Total: {movimiento.detalles.reduce((s, d) => s + (d.kilos_salida || 0), 0).toFixed(2)} kg</p>
              </div>
            )}

            {esMovEnvases && envasesEditables.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-slate-700">Movimientos de Envases</h4>
                {envasesEditables.map((env, idx) => (
                  <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">{env.envase_tipo}</p>
                        <div className="flex gap-4 mt-1 text-sm">
                          {env.cantidad_ingreso > 0 && (
                            <span className="text-green-600">Ingreso: +{env.cantidad_ingreso}</span>
                          )}
                          {env.cantidad_salida > 0 && (
                            <span className="text-red-600">Salida: -{env.cantidad_salida}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Checkbox Contabilizar */}
                    {formData.fletero_id && (
                      <div className="pt-3 border-t border-amber-300">
                        <div className="flex items-start gap-3 p-2 bg-white rounded border border-amber-200">
                          <input
                            type="checkbox"
                            checked={env.contabilizar_viaje || false}
                            onChange={() => toggleContabilizar(idx)}
                            className="h-5 w-5 mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                          />
                          <div className="flex-1">
                            <label className="text-sm font-semibold text-amber-900 cursor-pointer">
                              Contabilizar viaje para pago
                            </label>
                            <p className="text-xs text-amber-700">
                              {env.contabilizar_viaje 
                                ? 'Este viaje está contabilizado y se pagará al fletero'
                                : 'Marque para incluir en el pago del fletero'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs">
            <p className="font-medium text-amber-900">⚠️ Aviso Importante</p>
            <p className="text-amber-800 mt-1">
              Esta operación requiere PIN de seguridad. Los stocks y saldos se recalcularán automáticamente.
            </p>
            {!esMovEnvases && (
              <p className="text-amber-700 mt-1 font-medium">
                NOTA: Pesajes, detalles de productos y envases NO son editables por seguridad. Solo se pueden editar datos generales.
              </p>
            )}
            {esMovEnvases && formData.fletero_id && (
              <p className="text-amber-700 mt-1 font-medium">
                NOTA: Puede editar si los viajes se contabilizan o no para el pago del fletero. Esto afectará el monto a pagar en el módulo de Empleados.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : (
              'Guardar Cambios'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}