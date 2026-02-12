import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ImportBancosModal({ open, onClose, onImport }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Bancos del Sistema</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 font-medium mb-2">Formato del CSV:</p>
            <pre className="text-xs text-blue-800 bg-white p-2 rounded">
nombre,codigo,activo{'\n'}
Banco Nación,011,true{'\n'}
Banco Provincia,014,true{'\n'}
Banco Galicia,007,true{'\n'}
BBVA,017,true{'\n'}
Santander,072,true
            </pre>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-900">
              💡 <strong>Tip:</strong> Los bancos del sistema estarán disponibles en todo el módulo de Tesorería, Cheques, y cualquier operación bancaria.
            </p>
          </div>

          <div>
            <Label>Seleccionar archivo CSV</Label>
            <Input type="file" accept=".csv" onChange={onImport} className="mt-2" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
