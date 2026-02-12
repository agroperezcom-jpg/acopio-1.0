import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Truck } from "lucide-react";

export default function FleteroModal({ open, fletero, onClose, onSave, isLoading }) {
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    whatsapp: '',
    frecuencia_pago: '',
    dia_vencimiento: '',
    precio_kg: 0,
    precio_por_viaje: 0,
    activo: true,
    notas: ''
  });

  React.useEffect(() => {
    if (fletero) {
      setFormData(fletero);
    } else {
      setFormData({
        nombre: '',
        direccion: '',
        whatsapp: '',
        frecuencia_pago: '',
        dia_vencimiento: '',
        precio_kg: 0,
        precio_por_viaje: 0,
        activo: true,
        notas: ''
      });
    }
  }, [fletero, open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Truck className="h-5 w-5 text-orange-600" />
            {fletero ? 'Editar Fletero' : 'Nuevo Fletero'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Información Básica */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Información Básica
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nombre Completo *</Label>
                <Input 
                  value={formData.nombre} 
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})} 
                  className="mt-1"
                  placeholder="Nombre del fletero"
                  required 
                />
              </div>
              <div>
                <Label>Dirección</Label>
                <Input 
                  value={formData.direccion} 
                  onChange={(e) => setFormData({...formData, direccion: e.target.value})} 
                  className="mt-1"
                  placeholder="Calle 123, Ciudad"
                />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input 
                  value={formData.whatsapp} 
                  onChange={(e) => setFormData({...formData, whatsapp: e.target.value})} 
                  className="mt-1"
                  placeholder="+54 9 11 1234-5678"
                />
              </div>
            </div>
          </div>

          {/* Configuración de Pagos */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <h3 className="font-semibold text-slate-800">Configuración de Pagos</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Frecuencia de Pago</Label>
                <Select 
                  value={formData.frecuencia_pago} 
                  onValueChange={(value) => setFormData({...formData, frecuencia_pago: value})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccionar frecuencia..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Semanal">Semanal</SelectItem>
                    <SelectItem value="Quincenal">Quincenal</SelectItem>
                    <SelectItem value="Mensual">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Día de Vencimiento</Label>
                <Input 
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dia_vencimiento} 
                  onChange={(e) => setFormData({...formData, dia_vencimiento: parseInt(e.target.value) || ''})} 
                  className="mt-1"
                  placeholder="Ej: 5, 15, 30"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Día del mes (1-31) o semana (1-7)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Precio por Kilogramo</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <Input 
                    type="number"
                    step="0.01"
                    value={formData.precio_kg} 
                    onChange={(e) => setFormData({...formData, precio_kg: parseFloat(e.target.value) || 0})} 
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Precio por kilogramo de fruta transportada
                </p>
              </div>
              
              <div>
                <Label>Precio por Viaje de Envases Vacíos</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <Input 
                    type="number"
                    step="0.01"
                    value={formData.precio_por_viaje} 
                    onChange={(e) => setFormData({...formData, precio_por_viaje: parseFloat(e.target.value) || 0})} 
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded mt-1 border border-amber-200">
                  ⚠️ Solo para viajes de <strong>envases vacíos</strong> contabilizados. Los envases llenos (con fruta) usan el precio por kilogramo.
                </p>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <Label>Notas Adicionales</Label>
            <Textarea 
              value={formData.notas} 
              onChange={(e) => setFormData({...formData, notas: e.target.value})} 
              className="mt-1"
              placeholder="Información adicional sobre el fletero..."
              rows={3}
            />
          </div>

          {/* Estado */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) => setFormData({...formData, activo: e.target.checked})}
              className="h-4 w-4 rounded border-slate-300"
            />
            <Label>Fletero Activo</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={() => onSave(formData)} 
            disabled={isLoading || !formData.nombre}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar Fletero
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}