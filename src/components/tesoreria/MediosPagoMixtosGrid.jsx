import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import SearchableSelect from '@/components/SearchableSelect';
import { Plus, Trash2, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function MediosPagoMixtosGrid({ 
  montoTotal, 
  medios, 
  onChange, 
  bancos, 
  cajas, 
  cheques,
  esIngreso = false,
  onCrearCheque 
}) {
  const [filas, setFilas] = useState(medios || []);

  useEffect(() => {
    onChange(filas);
  }, [filas]);

  const agregarFila = () => {
    setFilas([...filas, {
      forma: 'Efectivo',
      tipo_cuenta: 'Caja',
      cuenta_id: '',
      importe: 0,
      cheque_datos: null
    }]);
  };

  const eliminarFila = (index) => {
    const nuevasFilas = filas.filter((_, i) => i !== index);
    setFilas(nuevasFilas);
  };

  const actualizarFila = (index, campo, valor) => {
    const nuevasFilas = [...filas];
    nuevasFilas[index] = { ...nuevasFilas[index], [campo]: valor };
    
    // Actualizar tipo_cuenta automáticamente según forma
    if (campo === 'forma') {
      if (valor === 'Efectivo') {
        nuevasFilas[index].tipo_cuenta = 'Caja';
        nuevasFilas[index].cuenta_id = '';
      } else if (valor === 'Transferencia') {
        nuevasFilas[index].tipo_cuenta = 'Banco';
        nuevasFilas[index].cuenta_id = '';
      } else if (valor === 'Cheque') {
        nuevasFilas[index].tipo_cuenta = 'Cheque';
        nuevasFilas[index].cuenta_id = '';
        nuevasFilas[index].cheque_datos = null;
      }
    }
    
    setFilas(nuevasFilas);
  };

  const totalParcial = filas.reduce((sum, f) => sum + (f.importe || 0), 0);
  const diferencia = montoTotal - totalParcial;
  const esValido = Math.abs(diferencia) < 0.01;

  const getCuentasDisponibles = (forma) => {
    if (forma === 'Efectivo') return cajas;
    if (forma === 'Transferencia') return bancos;
    if (forma === 'Cheque') {
      return esIngreso 
        ? cheques.filter(ch => ch.estado === 'Pendiente' && ch.origen === 'Terceros')
        : cheques.filter(ch => ch.estado === 'Pendiente' && ch.origen === 'Propio');
    }
    return [];
  };

  return (
    <Card className="border-2 border-purple-200 bg-purple-50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h5 className="font-semibold text-purple-900">💳 Medios de Pago/Cobro</h5>
            <p className="text-xs text-purple-700 mt-1">Distribuya el monto total entre diferentes medios</p>
          </div>
          <Button size="sm" onClick={agregarFila} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4 mr-1" />
            Agregar Medio
          </Button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-white rounded-lg border">
          <div>
            <p className="text-xs text-slate-500">Total a cobrar/pagar</p>
            <p className="font-bold text-slate-800">${montoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total distribuido</p>
            <p className={`font-bold ${esValido ? 'text-green-600' : 'text-red-600'}`}>
              ${totalParcial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Diferencia</p>
            <p className={`font-bold ${esValido ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.abs(diferencia).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {!esValido && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">La suma no coincide con el total</p>
              <p className="text-xs text-red-700 mt-1">
                {diferencia > 0 
                  ? `Faltan $${diferencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })} por distribuir`
                  : `Hay $${Math.abs(diferencia).toLocaleString('es-AR', { minimumFractionDigits: 2 })} de más`
                }
              </p>
            </div>
          </div>
        )}

        {esValido && filas.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-900">✓ La distribución es correcta</p>
          </div>
        )}

        {/* Grilla de medios */}
        <div className="space-y-3">
          {filas.map((fila, index) => (
            <Card key={index} className="bg-white border-2">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Badge className="mt-2 bg-purple-600">#{index + 1}</Badge>
                  
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Forma de Pago/Cobro */}
                    <div>
                      <label className="text-xs font-medium text-slate-700">Forma *</label>
                      <select
                        value={fila.forma}
                        onChange={(e) => actualizarFila(index, 'forma', e.target.value)}
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm mt-1"
                      >
                        <option value="Efectivo">💵 Efectivo</option>
                        <option value="Transferencia">🏦 Transferencia</option>
                        <option value="Cheque">📄 Cheque</option>
                      </select>
                    </div>

                    {/* Cuenta */}
                    <div>
                      <label className="text-xs font-medium text-slate-700">
                        {fila.forma === 'Efectivo' && 'Caja *'}
                        {fila.forma === 'Transferencia' && 'Banco *'}
                        {fila.forma === 'Cheque' && 'Cheque *'}
                      </label>
                      {fila.forma === 'Cheque' ? (
                        <select
                          value={fila.cuenta_id}
                          onChange={(e) => {
                            if (e.target.value === 'nuevo') {
                              onCrearCheque((nuevoChequeId) => {
                                actualizarFila(index, 'cuenta_id', nuevoChequeId);
                              });
                            } else {
                              actualizarFila(index, 'cuenta_id', e.target.value);
                            }
                          }}
                          className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm mt-1"
                        >
                          <option value="">Seleccionar...</option>
                          <option value="nuevo">➕ Registrar Nuevo Cheque</option>
                          {getCuentasDisponibles(fila.forma).map(ch => (
                            <option key={ch.id} value={ch.id}>
                              {ch.numero_cheque} - ${ch.monto.toLocaleString('es-AR')}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <SearchableSelect
                          options={getCuentasDisponibles(fila.forma)}
                          value={fila.cuenta_id}
                          onChange={(id) => actualizarFila(index, 'cuenta_id', id)}
                          displayKey="nombre"
                          placeholder="Seleccionar..."
                        />
                      )}
                    </div>

                    {/* Importe */}
                    <div>
                      <label className="text-xs font-medium text-slate-700">Importe *</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={fila.importe || ''}
                        onChange={(e) => actualizarFila(index, 'importe', parseFloat(e.target.value) || 0)}
                        className="h-9 mt-1"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => eliminarFila(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-7"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {filas.length === 0 && (
            <div className="text-center py-8 bg-white rounded-lg border-2 border-dashed border-slate-200">
              <p className="text-slate-500 text-sm mb-3">No hay medios agregados</p>
              <Button size="sm" onClick={agregarFila} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Primer Medio
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}