import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { format, differenceInMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ExportarMovimientosPDFModal({ open, onClose, onExportar }) {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const validarFechas = () => {
    if (!fechaDesde || !fechaHasta) {
      setError('Debes seleccionar ambas fechas para exportar');
      return false;
    }

    const desde = new Date(fechaDesde);
    const hasta = new Date(fechaHasta);

    if (desde > hasta) {
      setError('La fecha "Desde" no puede ser posterior a la fecha "Hasta"');
      return false;
    }

    const mesesDiferencia = differenceInMonths(hasta, desde);
    if (mesesDiferencia > 6) {
      setError('El rango máximo permitido es de 6 meses');
      return false;
    }

    setError('');
    return true;
  };

  const handleExportar = async () => {
    if (!validarFechas()) return;

    setExporting(true);
    
    try {
      await onExportar(fechaDesde, fechaHasta);
      
      setTimeout(() => {
        setExporting(false);
        handleClose();
      }, 500);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      setError('Error al generar el PDF. Por favor, intenta nuevamente.');
      setExporting(false);
    }
  };

  const handleClose = () => {
    if (!exporting) {
      setFechaDesde('');
      setFechaHasta('');
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600" />
            Exportar PDF - Movimientos de Tesorería
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-800">
              <strong>Obligatorio:</strong> Debes seleccionar un rango de fechas. Máximo: 6 meses.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div>
              <Label htmlFor="fechaDesde">Fecha Desde *</Label>
              <Input
                id="fechaDesde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                disabled={exporting}
              />
            </div>

            <div>
              <Label htmlFor="fechaHasta">Fecha Hasta *</Label>
              <Input
                id="fechaHasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                disabled={exporting}
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
            <p className="font-semibold mb-1">El PDF incluirá:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Fecha, Tipo, Descripción</li>
              <li>Origen, Cuenta, Monto</li>
              <li>Totales: Ingresos, Egresos, Resultado Neto</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={exporting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExportar}
            disabled={exporting || !fechaDesde || !fechaHasta}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generando PDF...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}