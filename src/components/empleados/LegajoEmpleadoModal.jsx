import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileText, Users } from "lucide-react";
import { format } from 'date-fns';
import { toast } from "sonner";
import SearchableSelect from '@/components/SearchableSelect';

export default function LegajoEmpleadoModal({ open, empleado, categorias, onClose, onSave, isLoading }) {
  const [formData, setFormData] = useState({
    nombre: '',
    cuit_dni: '',
    direccion: '',
    whatsapp: '',
    categoria_empleado_id: '',
    fecha_alta: format(new Date(), 'yyyy-MM-dd'),
    sueldo_base: 0,
    jornadas: '',
    contrato_url: '',
    activo: true,
    notas: ''
  });
  const [uploadingContract, setUploadingContract] = useState(false);

  React.useEffect(() => {
    if (empleado) {
      setFormData(empleado);
    } else {
      setFormData({
        nombre: '',
        cuit_dni: '',
        direccion: '',
        whatsapp: '',
        categoria_empleado_id: '',
        fecha_alta: format(new Date(), 'yyyy-MM-dd'),
        sueldo_base: 0,
        jornadas: '',
        contrato_url: '',
        activo: true,
        notas: ''
      });
    }
  }, [empleado, open]);

  const handleUploadContract = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingContract(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, contrato_url: result.file_url });
      toast.success('Contrato subido exitosamente');
    } catch (error) {
      toast.error('Error al subir contrato');
    } finally {
      setUploadingContract(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {empleado ? 'Editar Legajo' : 'Nuevo Legajo de Empleado'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Información Personal */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Información Personal
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <Label>Nombre Completo *</Label>
                <Input 
                  value={formData.nombre} 
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})} 
                  className="mt-1"
                  placeholder="Juan Pérez"
                  required 
                />
              </div>
              <div>
                <Label>CUIL/DNI *</Label>
                <Input 
                  value={formData.cuit_dni} 
                  onChange={(e) => setFormData({...formData, cuit_dni: e.target.value})} 
                  className="mt-1"
                  placeholder="20-12345678-9"
                  required 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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

          {/* Información Laboral */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Información Laboral
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoría de Empleado *</Label>
                <SearchableSelect
                  options={categorias.filter(c => c.activo)}
                  value={formData.categoria_empleado_id}
                  onChange={(id) => setFormData({...formData, categoria_empleado_id: id})}
                  displayKey="nombre"
                  placeholder="Seleccionar categoría..."
                />
              </div>
              <div>
                <Label>Fecha de Alta *</Label>
                <Input 
                  type="date"
                  value={formData.fecha_alta} 
                  onChange={(e) => setFormData({...formData, fecha_alta: e.target.value})} 
                  className="mt-1"
                  required 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sueldo Base Mensual</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={formData.sueldo_base} 
                  onChange={(e) => setFormData({...formData, sueldo_base: parseFloat(e.target.value) || 0})} 
                  className="mt-1"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <Label>Jornadas Laborales (Horarios/Semanas)</Label>
              <Textarea 
                value={formData.jornadas} 
                onChange={(e) => setFormData({...formData, jornadas: e.target.value})} 
                className="mt-1"
                placeholder="Ej: Lunes a Viernes 8:00 a 17:00"
                rows={2}
              />
            </div>

            <div>
              <Label>Contrato (PDF/Word)</Label>
              <div className="mt-1 space-y-2">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleUploadContract}
                  disabled={uploadingContract}
                />
                {uploadingContract && (
                  <p className="text-sm text-blue-600 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subiendo contrato...
                  </p>
                )}
                {formData.contrato_url && (
                  <a 
                    href={formData.contrato_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <FileText className="h-4 w-4" />
                    Ver contrato subido
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Notas y Estado */}
          <div className="space-y-4">
            <div>
              <Label>Notas Adicionales</Label>
              <Textarea 
                value={formData.notas} 
                onChange={(e) => setFormData({...formData, notas: e.target.value})} 
                className="mt-1"
                placeholder="Información adicional sobre el empleado..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.activo}
                onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                className="h-4 w-4 rounded border-slate-300"
              />
              <Label>Empleado Activo</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={() => onSave(formData)} 
            disabled={isLoading || !formData.nombre || !formData.cuit_dni || !formData.categoria_empleado_id}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar Legajo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}