import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import AsyncSelect from '@/components/AsyncSelect';

export default function PrecioModal({ modal, onClose, onSave, isLoading }) {
  const [formData, setFormData] = useState(modal.item || {
    producto_id: '',
    fecha_desde: '',
    fecha_hasta: '',
    precio_compra_kg: 0,
    precio_venta_kg: 0,
    activo: true
  });

  React.useEffect(() => {
    setFormData(modal.item || {
      producto_id: '',
      fecha_desde: '',
      fecha_hasta: '',
      precio_compra_kg: 0,
      precio_venta_kg: 0,
      activo: true
    });
  }, [modal.item]);

  return (
    <Dialog open={modal.open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{formData.id ? 'Editar' : 'Nuevo'} Período de Precio</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Producto *</Label>
            <AsyncSelect
              entityKey="Producto"
              value={formData.producto_id}
              onChange={(id) => setFormData({...formData, producto_id: id})}
              placeholder="Buscar producto..."
              initialOption={formData.producto_id && modal.item?.producto_nombre ? { id: formData.producto_id, nombre: modal.item.producto_nombre } : null}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha Desde *</Label>
              <Input type="date" value={formData.fecha_desde} onChange={(e) => setFormData({...formData, fecha_desde: e.target.value})} className="mt-1" required />
            </div>
            <div>
              <Label>Fecha Hasta (Opcional)</Label>
              <Input type="date" value={formData.fecha_hasta || ''} onChange={(e) => setFormData({...formData, fecha_hasta: e.target.value})} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Precio Compra ($/kg) *</Label>
              <Input type="number" step="0.01" value={formData.precio_compra_kg} onChange={(e) => setFormData({...formData, precio_compra_kg: parseFloat(e.target.value)})} className="mt-1" required />
            </div>
            <div>
              <Label>Precio Venta ($/kg) *</Label>
              <Input type="number" step="0.01" value={formData.precio_venta_kg} onChange={(e) => setFormData({...formData, precio_venta_kg: parseFloat(e.target.value)})} className="mt-1" required />
            </div>
          </div>

          {formData.precio_venta_kg > 0 && formData.precio_compra_kg > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                Margen de ganancia: <strong>${(formData.precio_venta_kg - formData.precio_compra_kg).toFixed(2)}/kg</strong>
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(formData)} disabled={isLoading || !formData.producto_id || !formData.fecha_desde}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
