import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function ImporteModal({ modal, onClose, onSave, isLoading }) {
  const [formData, setFormData] = useState({
    concepto: '',
    importe: 0,
    activo: true
  });

  React.useEffect(() => {
    setFormData(modal.item || {
      concepto: '',
      importe: 0,
      activo: true
    });
  }, [modal.item, modal.open]);

  return (
    <Dialog open={modal.open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{formData.id ? 'Editar' : 'Nuevo'} Importe Predeterminado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Concepto *</Label>
            <Input 
              value={formData.concepto} 
              onChange={(e) => setFormData({...formData, concepto: e.target.value})} 
              className="mt-1"
              placeholder="Ej: Viaje Corto, Viaje Largo"
              required 
            />
          </div>
          <div>
            <Label>Importe *</Label>
            <Input 
              type="number"
              step="0.01"
              value={formData.importe} 
              onChange={(e) => setFormData({...formData, importe: parseFloat(e.target.value) || 0})} 
              className="mt-1"
              placeholder="0.00"
              required 
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) => setFormData({...formData, activo: e.target.checked})}
              className="h-4 w-4 rounded border-slate-300"
            />
            <Label>Activo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(formData)} disabled={isLoading || !formData.concepto}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
