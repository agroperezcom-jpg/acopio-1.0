import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function CuentaModal({ modal, onClose, onSave, isLoading, cuentas }) {
  const [formData, setFormData] = useState(modal.item || {
    codigo: '',
    nombre: '',
    tipo: 'Activo',
    categoria: '',
    nivel: 1,
    cuenta_padre: '',
    imputable: true,
    activa: true
  });

  React.useEffect(() => {
    setFormData(modal.item || {
      codigo: '',
      nombre: '',
      tipo: 'Activo',
      categoria: '',
      nivel: 1,
      cuenta_padre: '',
      imputable: true,
      activa: true
    });
  }, [modal.item]);

  return (
    <Dialog open={modal.open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{formData.id ? 'Editar' : 'Nueva'} Cuenta Contable</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Código *</Label>
              <Input value={formData.codigo} onChange={(e) => setFormData({...formData, codigo: e.target.value})} className="mt-1" required />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={(val) => setFormData({...formData, tipo: val})}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Pasivo">Pasivo</SelectItem>
                  <SelectItem value="Patrimonio Neto">Patrimonio Neto</SelectItem>
                  <SelectItem value="Ingresos">Ingresos</SelectItem>
                  <SelectItem value="Costos">Costos</SelectItem>
                  <SelectItem value="Gastos">Gastos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Nombre *</Label>
            <Input value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} className="mt-1" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoría</Label>
              <Input value={formData.categoria} onChange={(e) => setFormData({...formData, categoria: e.target.value})} className="mt-1" />
            </div>
            <div>
              <Label>Nivel</Label>
              <Input type="number" value={formData.nivel} onChange={(e) => setFormData({...formData, nivel: parseInt(e.target.value)})} className="mt-1" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(formData)} disabled={isLoading || !formData.codigo || !formData.nombre}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
