import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import SearchableSelect from '@/components/SearchableSelect';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function CambiarEstadoChequeModal({ open, cheque, bancos, onClose }) {
  const queryClient = useQueryClient();
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [bancoId, setBancoId] = useState('');

  if (!cheque || !cheque.id) return null;

  const cambiarEstadoMutation = useMutation({
    mutationFn: async ({ chequeId, estado, bancoDestinoId }) => {
      // Actualizar estado del cheque
      await base44.entities.Cheque.update(chequeId, { estado });

      // Si es depósito, actualizar saldo del banco
      if (estado === 'Depositado' && bancoDestinoId) {
        const banco = bancos.find(b => b.id === bancoDestinoId);
        if (banco) {
          await base44.entities.Banco.update(bancoDestinoId, {
            saldo: (banco.saldo || 0) + cheque.monto
          });

          // Registrar movimiento de tesorería
          await base44.entities.MovimientoTesoreria.create({
            fecha: new Date().toISOString(),
            tipo_movimiento: 'Crédito Bancario',
            destino_tipo: 'Banco',
            destino_id: bancoDestinoId,
            destino_nombre: banco.nombre,
            origen_tipo: 'Cheque',
            origen_id: chequeId,
            monto: cheque.monto,
            concepto: `Depósito de cheque N° ${cheque.numero_cheque}`,
            comprobante: cheque.numero_cheque
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cheques'] });
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      queryClient.invalidateQueries({ queryKey: ['movimientostesoreria'] });
      toast.success('Estado del cheque actualizado');
      onClose();
    },
    onError: () => toast.error('Error al cambiar estado del cheque')
  });

  const handleCambiarEstado = () => {
    if (!nuevoEstado) {
      toast.error('Seleccione un estado');
      return;
    }

    if (nuevoEstado === 'Depositado' && !bancoId) {
      toast.error('Seleccione el banco de destino');
      return;
    }

    cambiarEstadoMutation.mutate({
      chequeId: cheque.id,
      estado: nuevoEstado,
      bancoDestinoId: bancoId
    });
  };

  const estadosDisponibles = () => {
    if (cheque.tipo === 'Terceros') {
      if (cheque.estado === 'En Cartera') {
        return ['Depositado', 'Endosado', 'Rechazado'];
      }
    } else {
      // Cheque Propio
      if (cheque.estado === 'En Cartera') {
        return ['Entregado'];
      }
    }
    return [];
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar Estado del Cheque</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-slate-100 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Cheque N°:</span>
              <span className="font-bold">{cheque.numero_cheque}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Estado Actual:</span>
              <span className="font-bold text-blue-600">{cheque.estado}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Monto:</span>
              <span className="font-bold text-green-600">
                ${(cheque.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {estadosDisponibles().length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                No hay cambios de estado disponibles para este cheque en su estado actual.
              </p>
            </div>
          ) : (
            <>
              <div>
                <Label>Nuevo Estado *</Label>
                <select
                  value={nuevoEstado}
                  onChange={(e) => setNuevoEstado(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar estado...</option>
                  {estadosDisponibles().map(estado => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </select>
              </div>

              {nuevoEstado === 'Depositado' && (
                <div>
                  <Label>Banco de Destino *</Label>
                  <SearchableSelect
                    options={bancos.filter(b => b.activa !== false)}
                    value={bancoId}
                    onChange={(id) => setBancoId(id)}
                    displayKey="nombre"
                    placeholder="Seleccionar banco..."
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    El saldo del banco se actualizará automáticamente
                  </p>
                </div>
              )}

              {nuevoEstado === 'Rechazado' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">
                    ⚠️ Al marcar como rechazado, se generará un ajuste en la cuenta corriente correspondiente.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {estadosDisponibles().length > 0 && (
            <Button
              onClick={handleCambiarEstado}
              disabled={cambiarEstadoMutation.isPending || !nuevoEstado}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {cambiarEstadoMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirmar Cambio
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}