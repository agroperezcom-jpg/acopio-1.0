import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ImportModal({ open, onClose, onImport }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Plan de Cuentas</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 font-medium mb-2">Formato del CSV:</p>
            <pre className="text-xs text-blue-800 bg-white p-2 rounded">
codigo,nombre,tipo,categoria,nivel,cuenta_padre,imputable,activa{'\n'}
1,Activo,Activo,,1,,true,true{'\n'}
1.1,Caja y Bancos,Activo,Disponibilidades,2,1,true,true
            </pre>
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
