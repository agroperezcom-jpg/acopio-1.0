import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { ajustarStockEnvase } from '@/services/StockService';
import { usePinGuard } from '@/hooks/usePinGuard';

export default function AjusteManualEnvaseModal({ 
  open, 
  onClose, 
  envase, 
  tipoAjuste, 
  stockActual,
  onSuccess 
}) {
  const { askPin, PinGuardModal } = usePinGuard();
  const [stockNuevo, setStockNuevo] = useState(stockActual || 0);
  const [motivo, setMotivo] = useState('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const diferencia = stockNuevo - stockActual;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!motivo.trim()) {
      setError('Debe ingresar un motivo para el ajuste');
      return;
    }

    await askPin(async () => {
      setLoading(true);
      try {
        // Obtener usuario actual
        const user = await base44.auth.me();

        // Registrar ajuste manual en historial
        const ajuste = {
          fecha: new Date().toISOString(),
          envase_id: envase.id,
          envase_tipo: envase.tipo,
          tipo_ajuste: tipoAjuste,
          stock_anterior: stockActual,
          stock_nuevo: stockNuevo,
          diferencia: diferencia,
          motivo: motivo.trim(),
          usuario_email: user.email,
          notas: notas.trim() || null
        };

        await base44.entities.AjusteManualEnvase.create(ajuste);

        // Actualizar stock vivo del envase (incremental)
        const deltaOcupados = tipoAjuste === 'ocupados' ? diferencia : 0;
        const deltaVacios = tipoAjuste === 'vacios' ? diferencia : 0;
        if (deltaOcupados !== 0 || deltaVacios !== 0) {
          await ajustarStockEnvase(base44, envase.id, deltaOcupados, deltaVacios);
        }

        onSuccess();
        onClose();
      } catch (err) {
        console.error('Error al realizar ajuste:', err);
        setError('Error al realizar el ajuste. Intente nuevamente.');
      } finally {
        setLoading(false);
      }
    }, 'Confirmar ajuste manual');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Ajuste Manual de Envases
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 bg-slate-100 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Envase:</span>
              <span className="font-semibold">{envase?.tipo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Tipo de Ajuste:</span>
              <span className={`font-semibold ${tipoAjuste === 'vacios' ? 'text-teal-600' : 'text-orange-600'}`}>
                {tipoAjuste === 'vacios' ? 'Envases Vacíos' : 'Envases Ocupados'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Stock Actual:</span>
              <span className="font-bold">{stockActual}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nuevo Stock *</Label>
            <Input
              type="number"
              value={stockNuevo}
              onChange={(e) => setStockNuevo(parseInt(e.target.value) || 0)}
              min="0"
              required
            />
            {diferencia !== 0 && (
              <p className={`text-sm ${diferencia > 0 ? 'text-green-600' : 'text-red-600'}`}>
                Diferencia: {diferencia > 0 ? '+' : ''}{diferencia} envases
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Motivo del Ajuste *</Label>
            <Input
              type="text"
              placeholder="Ej: Conteo físico, envases rotos, etc."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Notas Adicionales</Label>
            <Textarea
              placeholder="Detalles adicionales del ajuste..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || diferencia === 0}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? 'Guardando...' : 'Confirmar Ajuste'}
            </Button>
          </div>
        </form>
        <PinGuardModal />
      </DialogContent>
    </Dialog>
  );
}