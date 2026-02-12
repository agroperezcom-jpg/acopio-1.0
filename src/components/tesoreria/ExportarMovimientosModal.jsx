import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, FileDown, Loader2 } from 'lucide-react';
import { format, differenceInMonths } from 'date-fns';
import * as XLSX from 'xlsx';

export default function ExportarMovimientosModal({ open, onClose, movimientos }) {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const validarFechas = () => {
    if (!fechaDesde || !fechaHasta) {
      setError('Debes seleccionar ambas fechas');
      return false;
    }

    const desde = new Date(fechaDesde);
    const hasta = new Date(fechaHasta);

    if (desde > hasta) {
      setError('La fecha "Desde" no puede ser posterior a la fecha "Hasta"');
      return false;
    }

    const mesesDiferencia = differenceInMonths(hasta, desde);
    if (mesesDiferencia > 3) {
      setError('El rango máximo permitido es de 3 meses');
      return false;
    }

    setError('');
    return true;
  };

  const exportarExcel = async () => {
    if (!validarFechas()) return;

    setExporting(true);
    
    try {
      // Filtrar movimientos por rango de fechas
      const desde = new Date(fechaDesde);
      desde.setHours(0, 0, 0, 0);
      const hasta = new Date(fechaHasta);
      hasta.setHours(23, 59, 59, 999);

      const movimientosFiltrados = movimientos.filter(mov => {
        const fechaMov = new Date(mov.fecha);
        return fechaMov >= desde && fechaMov <= hasta;
      });

      if (movimientosFiltrados.length === 0) {
        setError('No hay movimientos en el rango de fechas seleccionado');
        setExporting(false);
        return;
      }

      // Preparar datos para Excel
      const datosExcel = movimientosFiltrados.map(mov => ({
        'Fecha': mov.fecha ? format(new Date(mov.fecha), 'dd/MM/yyyy HH:mm') : '',
        'Tipo Movimiento': mov.tipo_movimiento || '',
        'Origen': mov.origen_nombre || '',
        'Tipo Origen': mov.origen_tipo || '',
        'Destino': mov.destino_nombre || '',
        'Tipo Destino': mov.destino_tipo || '',
        'Monto': mov.monto || 0,
        'Concepto': mov.concepto || '',
        'Comprobante': mov.comprobante || '',
        'Referencia Tipo': mov.referencia_origen_tipo || '',
        'Referencia ID': mov.referencia_origen_id || ''
      }));

      // Calcular totales
      const totalIngresos = movimientosFiltrados
        .filter(m => ['Ingreso Manual', 'Crédito Bancario'].includes(m.tipo_movimiento))
        .reduce((sum, m) => sum + (m.monto || 0), 0);

      const totalEgresos = movimientosFiltrados
        .filter(m => ['Egreso Manual', 'Débito Bancario'].includes(m.tipo_movimiento))
        .reduce((sum, m) => sum + (m.monto || 0), 0);

      const totalTransferencias = movimientosFiltrados
        .filter(m => m.tipo_movimiento === 'Transferencia Interna')
        .reduce((sum, m) => sum + (m.monto || 0), 0);

      // Crear hoja de cálculo
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(datosExcel);

      // Agregar encabezado antes de los datos
      XLSX.utils.sheet_add_aoa(ws, [
        ['SISTEMA DE GESTIÓN DE ACOPIO'],
        ['EXPORTACIÓN DE MOVIMIENTOS DE TESORERÍA'],
        ['Fecha de generación: ' + format(new Date(), 'dd/MM/yyyy HH:mm')],
        ['Período: ' + format(desde, 'dd/MM/yyyy') + ' al ' + format(hasta, 'dd/MM/yyyy')],
        [''],
        ['Total de movimientos: ' + movimientosFiltrados.length],
        [''],
      ], { origin: 'A1' });

      // Agregar totales al final
      const lastRow = datosExcel.length + 9; // 7 líneas de encabezado + 1 línea de datos + 1 para totales
      XLSX.utils.sheet_add_aoa(ws, [
        [''],
        ['RESUMEN'],
        ['Total Ingresos:', totalIngresos.toFixed(2)],
        ['Total Egresos:', totalEgresos.toFixed(2)],
        ['Total Transferencias:', totalTransferencias.toFixed(2)],
        ['Resultado Neto (Ingresos - Egresos):', (totalIngresos - totalEgresos).toFixed(2)]
      ], { origin: `A${lastRow}` });

      // Ajustar anchos de columnas
      const columnWidths = [
        { wch: 18 }, // Fecha
        { wch: 20 }, // Tipo Movimiento
        { wch: 25 }, // Origen
        { wch: 12 }, // Tipo Origen
        { wch: 25 }, // Destino
        { wch: 12 }, // Tipo Destino
        { wch: 15 }, // Monto
        { wch: 40 }, // Concepto
        { wch: 20 }, // Comprobante
        { wch: 15 }, // Referencia Tipo
        { wch: 30 }  // Referencia ID
      ];
      ws['!cols'] = columnWidths;

      // Agregar hoja al libro
      XLSX.utils.book_append_sheet(wb, ws, 'Movimientos Tesorería');

      // Generar archivo y descargar
      const nombreArchivo = `MovimientosTesoreria_${format(desde, 'yyyyMMdd')}_${format(hasta, 'yyyyMMdd')}.xlsx`;
      XLSX.writeFile(wb, nombreArchivo);

      // Cerrar modal y resetear
      setTimeout(() => {
        setExporting(false);
        onClose();
        setFechaDesde('');
        setFechaHasta('');
        setError('');
      }, 500);

    } catch (err) {
      console.error('Error al exportar:', err);
      setError('Error al generar el archivo. Por favor, intenta nuevamente.');
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
            <FileDown className="h-5 w-5 text-teal-600" />
            Exportar Movimientos de Tesorería
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="bg-blue-50 border-blue-200">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800">
              El rango de fechas es obligatorio. Máximo permitido: 3 meses.
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
            <p className="font-semibold mb-1">Campos incluidos en el archivo:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Fecha, Tipo de Movimiento, Origen/Destino</li>
              <li>Monto, Concepto, Comprobante</li>
              <li>Referencia (tipo y ID de origen)</li>
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
            onClick={exportarExcel}
            disabled={exporting || !fechaDesde || !fechaHasta}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar Excel
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}