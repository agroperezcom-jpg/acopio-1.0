import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function EditarFechaMovimientoModal({ open, onClose, movimiento, onGuardar }) {
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (open && movimiento) {
      // Establecer la fecha actual del movimiento como valor inicial
      const fecha = new Date(movimiento.fecha);
      setNuevaFecha(format(fecha, 'yyyy-MM-dd'));
      setMotivo('');
      setError('');
    }
  }, [open, movimiento]);

  const validarYGuardar = async () => {
    // Validaciones
    if (!nuevaFecha) {
      setError('Debes seleccionar una fecha');
      return;
    }

    // Verificar que la fecha haya cambiado
    const fechaOriginal = format(new Date(movimiento.fecha), 'yyyy-MM-dd');
    if (nuevaFecha === fechaOriginal) {
      setError('La fecha seleccionada es igual a la fecha actual');
      return;
    }

    setGuardando(true);
    setError('');

    try {
      await onGuardar({
        movimiento,
        nuevaFecha,
        motivo
      });

      // Limpiar y cerrar
      handleClose();
    } catch (err) {
      console.error('Error al guardar:', err);
      setError(err.message || 'Error al guardar el cambio de fecha');
      setGuardando(false);
    }
  };

  const handleClose = () => {
    if (!guardando) {
      setNuevaFecha('');
      setMotivo('');
      setError('');
      onClose();
    }
  };

  if (!movimiento) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-teal-600" />
            Editar Fecha de Movimiento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-800">
              <strong>Atención:</strong> Solo se modificará la fecha. Los montos y saldos no cambiarán.
            </AlertDescription>
          </Alert>

          <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1">
            <p><strong>Movimiento:</strong> {movimiento.concepto}</p>
            <p><strong>Fecha actual:</strong> {format(new Date(movimiento.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
            <p><strong>Monto:</strong> ${(movimiento.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          </div>

          <div>
            <Label htmlFor="nuevaFecha">Nueva Fecha *</Label>
            <Input
              id="nuevaFecha"
              type="date"
              value={nuevaFecha}
              onChange={(e) => setNuevaFecha(e.target.value)}
              disabled={guardando}
            />
          </div>

          <div>
            <Label htmlFor="motivo">Motivo del Cambio (opcional)</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Error en registro original, ajuste contable..."
              rows={3}
              disabled={guardando}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button
            onClick={validarYGuardar}
            disabled={guardando}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {guardando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4 mr-2" />
                Confirmar Cambio
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}