import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2 } from "lucide-react";

export default function CategoriaEmpleadoModal({ modal, onClose, onSave, isLoading }) {
  const [formData, setFormData] = useState({
    nombre: '',
    tipo_liquidacion: 'Sueldo Fijo',
    conceptos_predeterminados: [],
    activo: true
  });

  React.useEffect(() => {
    setFormData(modal.item || {
      nombre: '',
      tipo_liquidacion: 'Sueldo Fijo',
      conceptos_predeterminados: [],
      activo: true
    });
  }, [modal.item, modal.open]);

  const agregarConcepto = () => {
    setFormData({
      ...formData,
      conceptos_predeterminados: [
        ...formData.conceptos_predeterminados,
        { nombre: '', tipo: 'suma', monto_default: 0 }
      ]
    });
  };

  const actualizarConcepto = (index, field, value) => {
    const nuevosConceptos = [...formData.conceptos_predeterminados];
    nuevosConceptos[index][field] = value;
    setFormData({ ...formData, conceptos_predeterminados: nuevosConceptos });
  };

  const eliminarConcepto = (index) => {
    setFormData({
      ...formData,
      conceptos_predeterminados: formData.conceptos_predeterminados.filter((_, i) => i !== index)
    });
  };

  return (
    <Dialog open={modal.open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{formData.id ? 'Editar' : 'Nueva'} Categoría de Empleado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nombre *</Label>
              <Input value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} className="mt-1" placeholder="Ej: Fletero, Administrativo" required />
            </div>
            <div>
              <Label>Tipo de Liquidación *</Label>
              <select
                value={formData.tipo_liquidacion}
                onChange={(e) => setFormData({...formData, tipo_liquidacion: e.target.value})}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm mt-1"
              >
                <option value="Sueldo Fijo">Sueldo Fijo</option>
                <option value="Por Viaje">Por Viaje</option>
              </select>
            </div>
          </div>

          {formData.tipo_liquidacion === 'Sueldo Fijo' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Conceptos Predeterminados</Label>
                <Button onClick={agregarConcepto} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {formData.conceptos_predeterminados.map((concepto, idx) => (
                  <div key={idx} className="flex gap-2 p-3 bg-slate-50 rounded-lg">
                    <Input
                      value={concepto.nombre}
                      onChange={(e) => actualizarConcepto(idx, 'nombre', e.target.value)}
                      placeholder="Nombre concepto"
                      className="flex-1"
                    />
                    <select
                      value={concepto.tipo}
                      onChange={(e) => actualizarConcepto(idx, 'tipo', e.target.value)}
                      className="flex h-10 w-32 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="suma">Suma</option>
                      <option value="descuento">Descuento</option>
                    </select>
                    <Input
                      type="number"
                      step="0.01"
                      value={concepto.monto_default}
                      onChange={(e) => actualizarConcepto(idx, 'monto_default', parseFloat(e.target.value) || 0)}
                      placeholder="$ Default"
                      className="w-28"
                    />
                    <Button variant="ghost" size="icon" onClick={() => eliminarConcepto(idx)} className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {formData.conceptos_predeterminados.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-3">No hay conceptos definidos</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) => setFormData({...formData, activo: e.target.checked})}
              className="h-4 w-4 rounded border-slate-300"
            />
            <Label>Categoría activa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(formData)} disabled={isLoading || !formData.nombre}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
