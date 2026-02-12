import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function ABMModal({ modal, onClose, onSave, isLoading }) {
  const [formData, setFormData] = useState(modal.item || {});
  const isNew = !modal.item?.id;

  React.useEffect(() => {
    setFormData(modal.item || {});
  }, [modal.item]);

  const getFields = () => {
    switch (modal.type) {
      case 'proveedor':
        return [
          { key: 'nombre', label: 'Nombre', type: 'text', required: true },
          { key: 'direccion', label: 'Dirección', type: 'text' },
          { key: 'cuit', label: 'CUIT', type: 'text' },
          { key: 'whatsapp', label: 'WhatsApp', type: 'text' },
          { key: 'alias', label: 'Alias / CBU / CVU', type: 'text' },
          { key: 'banco', label: 'Banco', type: 'text' }
        ];
      case 'cliente':
        return [
          { key: 'nombre', label: 'Nombre', type: 'text', required: true },
          { key: 'direccion', label: 'Dirección', type: 'text' },
          { key: 'cuit', label: 'CUIT', type: 'text' },
          { key: 'whatsapp', label: 'WhatsApp', type: 'text' }
        ];
      case 'banco':
        return [
          { key: 'nombre', label: 'Nombre del Banco', type: 'text', required: true },
          { key: 'codigo', label: 'Código', type: 'text' }
        ];
      case 'envase':
        return [
          { key: 'tipo', label: 'Tipo de Envase', type: 'text', required: true },
          { key: 'tara', label: 'Tara (kg)', type: 'number', required: true }
        ];
      case 'producto':
        return [
          { key: 'fruta', label: 'Fruta', type: 'text', required: true },
          { key: 'variedad', label: 'Variedad', type: 'text', required: true },
          { key: 'stock', label: 'Stock Inicial (kg)', type: 'number' },
          { key: 'precio_kg', label: 'Precio por Kg', type: 'number' }
        ];
      case 'fletero':
        return [
          { key: 'nombre', label: 'Nombre', type: 'text', required: true },
          { key: 'direccion', label: 'Dirección', type: 'text' },
          { key: 'whatsapp', label: 'WhatsApp', type: 'text' }
        ];
      default:
        return [];
    }
  };

  return (
    <Dialog open={modal.open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? 'Crear' : 'Editar'} {modal.type?.charAt(0).toUpperCase() + modal.type?.slice(1)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {getFields().map(field => (
            <div key={field.key}>
              <Label>{field.label} {field.required && <span className="text-red-500">*</span>}</Label>
              <Input
                type={field.type}
                step={field.type === 'number' ? 'any' : undefined}
                value={formData[field.key] ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  [field.key]: field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                })}
                required={field.required}
                className="mt-1"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ type: modal.type, item: formData, isNew })} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
