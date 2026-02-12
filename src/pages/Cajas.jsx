import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Landmark, Plus, Pencil, Trash2, Loader2, DollarSign, MapPin, User } from 'lucide-react';
import { toast } from 'sonner';

export default function Cajas() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCaja, setEditingCaja] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    ubicacion: '',
    saldo: 0,
    responsable: '',
    activa: true
  });

  const { data: cajas = [], isLoading } = useQuery({
    queryKey: ['cajas'],
    queryFn: () => base44.entities.Caja.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Caja.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cajas'] });
      toast.success('Caja creada exitosamente');
      closeModal();
    },
    onError: () => toast.error('Error al crear caja')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Caja.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cajas'] });
      toast.success('Caja actualizada exitosamente');
      closeModal();
    },
    onError: () => toast.error('Error al actualizar caja')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Caja.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cajas'] });
      toast.success('Caja eliminada exitosamente');
    },
    onError: () => toast.error('Error al eliminar caja')
  });

  const openModal = (caja = null) => {
    if (caja) {
      setEditingCaja(caja);
      setFormData({
        nombre: caja.nombre,
        ubicacion: caja.ubicacion || '',
        saldo: caja.saldo || 0,
        responsable: caja.responsable || '',
        activa: caja.activa !== false
      });
    } else {
      setEditingCaja(null);
      setFormData({
        nombre: '',
        ubicacion: '',
        saldo: 0,
        responsable: '',
        activa: true
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCaja(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCaja) {
      updateMutation.mutate({ id: editingCaja.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de eliminar esta caja?')) return;
    try {
      // Verificar movimientos con origen = Caja
      const movsOrigen = await base44.entities.MovimientoTesoreria.filter(
        { origen_tipo: 'Caja', origen_id: id },
        '-fecha',
        1
      );
      
      // Verificar movimientos con destino = Caja
      const movsDestino = await base44.entities.MovimientoTesoreria.filter(
        { destino_tipo: 'Caja', destino_id: id },
        '-fecha',
        1
      );
      
      if (movsOrigen.length > 0 || movsDestino.length > 0) {
        toast.error('No se puede borrar una cuenta con movimientos. Debes vaciarla o anular los movimientos primero.');
        return;
      }
      deleteMutation.mutate(id);
    } catch (err) {
      toast.error('Error al verificar movimientos');
    }
  };

  const totalSaldo = cajas.reduce((sum, c) => sum + (c.saldo || 0), 0);
  const cajasActivas = cajas.filter(c => c.activa !== false);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Landmark className="h-8 w-8 text-blue-600" />
              Gestión de Cajas
            </h1>
            <p className="text-slate-500 mt-1">Administra las cajas de efectivo</p>
          </div>
          <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Caja
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total en Cajas</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${totalSaldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <DollarSign className="h-10 w-10 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Cajas Activas</p>
                  <p className="text-2xl font-bold text-blue-600">{cajasActivas.length}</p>
                </div>
                <Landmark className="h-10 w-10 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Cajas</p>
                  <p className="text-2xl font-bold text-slate-600">{cajas.length}</p>
                </div>
                <Landmark className="h-10 w-10 text-slate-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Cajas */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : cajas.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Landmark className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay cajas registradas</p>
              <Button onClick={() => openModal()} variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Caja
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cajas.map(caja => (
              <Card key={caja.id} className={!caja.activa ? 'opacity-60' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Landmark className="h-5 w-5 text-blue-600" />
                      {caja.nombre}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openModal(caja)}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(caja.id)}
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="h-4 w-4" />
                      <span>{caja.ubicacion || 'Sin ubicación'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <User className="h-4 w-4" />
                      <span>{caja.responsable || 'Sin responsable'}</span>
                    </div>
                    <div className="pt-3 border-t">
                      <p className="text-sm text-slate-500">Saldo Actual</p>
                      <p className={`text-xl font-bold ${(caja.saldo || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${(caja.saldo || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {!caja.activa && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-2 text-center">
                        <p className="text-xs text-red-600 font-medium">INACTIVA</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCaja ? 'Editar Caja' : 'Nueva Caja'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Nombre *</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Caja Principal"
                    required
                  />
                </div>
                <div>
                  <Label>Ubicación</Label>
                  <Input
                    value={formData.ubicacion}
                    onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                    placeholder="Ej: Oficina Central"
                  />
                </div>
                <div>
                  <Label>Responsable</Label>
                  <Input
                    value={formData.responsable}
                    onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
                    placeholder="Nombre del responsable"
                  />
                </div>
                <div>
                  <Label>Saldo Inicial</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.saldo}
                    onChange={(e) => setFormData({ ...formData, saldo: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activa"
                    checked={formData.activa}
                    onChange={(e) => setFormData({ ...formData, activa: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="activa" className="cursor-pointer">Caja Activa</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingCaja ? 'Actualizar' : 'Crear'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}