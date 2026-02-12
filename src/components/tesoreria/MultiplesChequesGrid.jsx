import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import SearchableSelect from '@/components/SearchableSelect';
import { format } from 'date-fns';

export default function MultiplesChequesGrid({ 
  cheques, 
  onChange, 
  chequesDisponibles, 
  bancosSistema,
  esTerceros = true // true para cobros (terceros), false para pagos (propios)
}) {
  const agregarCheque = () => {
    onChange([...cheques, {
      id: `temp_${Date.now()}`,
      tipo: 'existente',
      cheque_id: '',
      // Datos para nuevo cheque
      numero_cheque: '',
      tipo_cheque: 'Físico',
      banco_id: '',
      fecha_emision: format(new Date(), 'yyyy-MM-dd'),
      fecha_pago: format(new Date(), 'yyyy-MM-dd'),
      monto: 0,
      emisor: '',
      beneficiario: '',
      titular: '',
      notas: ''
    }]);
  };

  const eliminarCheque = (id) => {
    onChange(cheques.filter(ch => ch.id !== id));
  };

  const actualizarCheque = (id, campo, valor) => {
    onChange(cheques.map(ch => 
      ch.id === id ? { ...ch, [campo]: valor } : ch
    ));
  };

  const totalCheques = cheques.reduce((sum, ch) => {
    if (ch.tipo === 'existente' && ch.cheque_id) {
      const chequeData = chequesDisponibles.find(c => c.id === ch.cheque_id);
      return sum + (chequeData?.monto || 0);
    } else if (ch.tipo === 'nuevo') {
      return sum + (ch.monto || 0);
    }
    return sum;
  }, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold text-amber-900">Cheques</h5>
        <Button 
          type="button"
          size="sm" 
          onClick={agregarCheque}
          className="bg-amber-600 hover:bg-amber-700"
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar Cheque
        </Button>
      </div>

      {cheques.length === 0 ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center text-sm text-amber-700">
          No hay cheques agregados. Haz clic en "Agregar Cheque" para comenzar.
        </div>
      ) : (
        <div className="space-y-2">
          {cheques.map((cheque, index) => (
            <Card key={cheque.id} className="border-2 border-amber-200 bg-amber-50">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Cheque #{index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => eliminarCheque(cheque.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div>
                      <label className="text-xs font-medium">Tipo de Cheque</label>
                      <select
                        value={cheque.tipo}
                        onChange={(e) => {
                          actualizarCheque(cheque.id, 'tipo', e.target.value);
                          if (e.target.value === 'existente') {
                            actualizarCheque(cheque.id, 'cheque_id', '');
                          }
                        }}
                        className="flex h-9 w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm mt-1"
                      >
                        <option value="existente">Cheque Existente</option>
                        <option value="nuevo">Registrar Nuevo Cheque</option>
                      </select>
                    </div>

                    {cheque.tipo === 'existente' ? (
                      <div>
                        <label className="text-xs font-medium">Seleccionar Cheque *</label>
                        <select
                          value={cheque.cheque_id}
                          onChange={(e) => actualizarCheque(cheque.id, 'cheque_id', e.target.value)}
                          className="flex h-9 w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm mt-1"
                        >
                          <option value="">Seleccionar...</option>
                          {chequesDisponibles
                            .filter(ch => !cheques.some(c => c.tipo === 'existente' && c.cheque_id === ch.id && c.id !== cheque.id))
                            .map(ch => (
                              <option key={ch.id} value={ch.id}>
                                {ch.numero_cheque} - {ch.banco_nombre} - ${ch.monto.toLocaleString('es-AR')}
                              </option>
                            ))}
                        </select>
                        {cheque.cheque_id && chequesDisponibles.find(ch => ch.id === cheque.cheque_id) && (
                          <p className="text-xs text-green-700 mt-1 font-semibold">
                            Monto: ${chequesDisponibles.find(ch => ch.id === cheque.cheque_id)?.monto.toLocaleString('es-AR')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium">Número de Cheque *</label>
                            <Input
                              value={cheque.numero_cheque}
                              onChange={(e) => actualizarCheque(cheque.id, 'numero_cheque', e.target.value)}
                              className="h-9 text-sm mt-1"
                              placeholder="12345678"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium">Tipo *</label>
                            <select
                              value={cheque.tipo_cheque}
                              onChange={(e) => actualizarCheque(cheque.id, 'tipo_cheque', e.target.value)}
                              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm mt-1"
                            >
                              <option value="Físico">Físico</option>
                              <option value="Electrónico">Electrónico</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium">Banco Emisor *</label>
                          <SearchableSelect
                            options={bancosSistema}
                            value={cheque.banco_id}
                            onChange={(id) => actualizarCheque(cheque.id, 'banco_id', id)}
                            displayKey="nombre"
                            placeholder="Seleccionar banco..."
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium">Fecha Emisión *</label>
                            <Input
                              type="date"
                              value={cheque.fecha_emision}
                              onChange={(e) => actualizarCheque(cheque.id, 'fecha_emision', e.target.value)}
                              className="h-9 text-sm mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium">Fecha Vencimiento *</label>
                            <Input
                              type="date"
                              value={cheque.fecha_pago}
                              onChange={(e) => actualizarCheque(cheque.id, 'fecha_pago', e.target.value)}
                              className="h-9 text-sm mt-1"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium">Monto *</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={cheque.monto}
                            onChange={(e) => actualizarCheque(cheque.id, 'monto', parseFloat(e.target.value) || 0)}
                            className="h-9 text-sm mt-1"
                          />
                        </div>

                        {esTerceros ? (
                          <div>
                            <label className="text-xs font-medium">Emisor</label>
                            <Input
                              value={cheque.emisor}
                              onChange={(e) => actualizarCheque(cheque.id, 'emisor', e.target.value)}
                              className="h-9 text-sm mt-1"
                              placeholder="Nombre del emisor"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="text-xs font-medium">Beneficiario *</label>
                            <Input
                              value={cheque.beneficiario}
                              onChange={(e) => actualizarCheque(cheque.id, 'beneficiario', e.target.value)}
                              className="h-9 text-sm mt-1"
                              placeholder="A favor de..."
                            />
                          </div>
                        )}

                        <div>
                          <label className="text-xs font-medium">CUIT del Emisor</label>
                          <Input
                            value={cheque.titular}
                            onChange={(e) => actualizarCheque(cheque.id, 'titular', e.target.value)}
                            className="h-9 text-sm mt-1"
                            placeholder="CUIT del emisor"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="border-2 border-green-300 bg-green-50">
            <CardContent className="p-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700">TOTAL CHEQUES:</span>
                <span className="font-bold text-xl text-green-700">${totalCheques.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}