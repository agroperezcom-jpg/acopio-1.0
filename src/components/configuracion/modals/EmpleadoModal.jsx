import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function EmpleadoModal({ modal, onClose, onSave, isLoading }) {
  const getInitialData = () => {
    const defaultItem = { nombre: '', email: '', usuario: '', contrasena: '', activo: true };
    if (!modal.item) return defaultItem;
    const { permisos, ...rest } = modal.item;
    return { ...defaultItem, ...rest, contrasena: '' };
  };

  const [formData, setFormData] = useState(getInitialData());

  React.useEffect(() => {
    setFormData(getInitialData());
  }, [modal.item]);

  return (
    <Dialog open={modal.open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{formData.id ? 'Editar' : 'Nuevo'} Empleado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div>
            <Label>Nombre Completo *</Label>
            <Input value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} className="mt-1" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="mt-1" required />
            </div>
            <div>
              <Label>Usuario *</Label>
              <Input value={formData.usuario} onChange={(e) => setFormData({...formData, usuario: e.target.value})} className="mt-1" required />
            </div>
          </div>
          <div>
            <Label>Contraseña {!formData.id && '*'}</Label>
            <Input type="password" value={formData.contrasena} onChange={(e) => setFormData({...formData, contrasena: e.target.value})} className="mt-1" placeholder={formData.id ? "Dejar en blanco para no cambiar" : ""} />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) => setFormData({...formData, activo: e.target.checked})}
              className="h-4 w-4 rounded border-slate-300"
            />
            <Label>Empleado activo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(formData)} disabled={isLoading || !formData.nombre || !formData.email || !formData.usuario || (!formData.id && !formData.contrasena)}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
