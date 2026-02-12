import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Banknote, Plus, Pencil, Trash2, Loader2, DollarSign, CreditCard, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function Bancos() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanco, setEditingBanco] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    numero_cuenta: '',
    tipo_cuenta: 'Cuenta Corriente',
    saldo: 0,
    saldo_minimo: 0,
    activa: true
  });

  const { data: bancos = [], isLoading } = useQuery({
    queryKey: ['bancos'],
    queryFn: () => base44.entities.Banco.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Banco.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      toast.success('Banco creado exitosamente');
      closeModal();
    },
    onError: () => toast.error('Error al crear banco')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Banco.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      toast.success('Banco actualizado exitosamente');
      closeModal();
    },
    onError: () => toast.error('Error al actualizar banco')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Banco.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      toast.success('Banco eliminado exitosamente');
    },
    onError: () => toast.error('Error al eliminar banco')
  });

  const openModal = (banco = null) => {
    if (banco) {
      setEditingBanco(banco);
      setFormData({
        nombre: banco.nombre,
        numero_cuenta: banco.numero_cuenta,
        tipo_cuenta: banco.tipo_cuenta || 'Cuenta Corriente',
        saldo: banco.saldo || 0,
        saldo_minimo: banco.saldo_minimo || 0,
        activa: banco.activa !== false
      });
    } else {
      setEditingBanco(null);
      setFormData({
        nombre: '',
        numero_cuenta: '',
        tipo_cuenta: 'Cuenta Corriente',
        saldo: 0,
        saldo_minimo: 0,
        activa: true
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingBanco(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingBanco) {
      updateMutation.mutate({ id: editingBanco.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de eliminar este banco?')) return;
    try {
      // Verificar movimientos con origen = Banco
      const movsOrigen = await base44.entities.MovimientoTesoreria.filter(
        { origen_tipo: 'Banco', origen_id: id },
        '-fecha',
        1
      );
      
      // Verificar movimientos con destino = Banco
      const movsDestino = await base44.entities.MovimientoTesoreria.filter(
        { destino_tipo: 'Banco', destino_id: id },
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

  const totalSaldo = bancos.reduce((sum, b) => sum + (b.saldo || 0), 0);
  const bancosActivos = bancos.filter(b => b.activa !== false);
  const bancosConAlerta = bancos.filter(b => (b.saldo || 0) < (b.saldo_minimo || 0));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Banknote className="h-8 w-8 text-indigo-600" />
              Gestión de Bancos
            </h1>
            <p className="text-slate-500 mt-1">Administra las cuentas bancarias de la empresa</p>
          </div>
          <Button onClick={() => openModal()} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Cuenta
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total en Bancos</p>
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
                  <p className="text-sm text-slate-500">Cuentas Activas</p>
                  <p className="text-2xl font-bold text-indigo-600">{bancosActivos.length}</p>
                </div>
                <Banknote className="h-10 w-10 text-indigo-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Cuentas</p>
                  <p className="text-2xl font-bold text-slate-600">{bancos.length}</p>
                </div>
                <CreditCard className="h-10 w-10 text-slate-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className={bancosConAlerta.length > 0 ? 'border-amber-300 bg-amber-50' : ''}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Con Alerta</p>
                  <p className={`text-2xl font-bold ${bancosConAlerta.length > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                    {bancosConAlerta.length}
                  </p>
                </div>
                <AlertTriangle className={`h-10 w-10 opacity-20 ${bancosConAlerta.length > 0 ? 'text-amber-600' : 'text-slate-600'}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Bancos */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : bancos.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Banknote className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay cuentas bancarias registradas</p>
              <Button onClick={() => openModal()} variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Cuenta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bancos.map(banco => {
              const saldoBajoMinimo = (banco.saldo || 0) < (banco.saldo_minimo || 0);
              return (
                <Card key={banco.id} className={`${!banco.activa ? 'opacity-60' : ''} ${saldoBajoMinimo ? 'border-amber-300' : ''}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Banknote className="h-5 w-5 text-indigo-600" />
                        {banco.nombre}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openModal(banco)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(banco.id)}
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-slate-500">Tipo de Cuenta</p>
                        <p className="text-sm font-medium text-slate-700">{banco.tipo_cuenta}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Número de Cuenta</p>
                        <p className="text-sm font-medium text-slate-700">{banco.numero_cuenta}</p>
                      </div>
                      <div className="pt-3 border-t">
                        <p className="text-sm text-slate-500">Saldo Actual</p>
                        <p className={`text-xl font-bold ${(banco.saldo || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${(banco.saldo || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      {saldoBajoMinimo && (
                        <div className="bg-amber-50 border border-amber-200 rounded-md p-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <p className="text-xs text-amber-700">
                              Saldo por debajo del mínimo (${(banco.saldo_minimo || 0).toLocaleString('es-AR')})
                            </p>
                          </div>
                        </div>
                      )}
                      {!banco.activa && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-2 text-center">
                          <p className="text-xs text-red-600 font-medium">INACTIVA</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingBanco ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Nombre del Banco *</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Banco Nación"
                    required
                  />
                </div>
                <div>
                  <Label>Número de Cuenta *</Label>
                  <Input
                    value={formData.numero_cuenta}
                    onChange={(e) => setFormData({ ...formData, numero_cuenta: e.target.value })}
                    placeholder="Ej: 1234567890"
                    required
                  />
                </div>
                <div>
                  <Label>Tipo de Cuenta *</Label>
                  <select
                    value={formData.tipo_cuenta}
                    onChange={(e) => setFormData({ ...formData, tipo_cuenta: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="Cuenta Corriente">Cuenta Corriente</option>
                    <option value="Caja de Ahorro">Caja de Ahorro</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Saldo Inicial</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.saldo}
                      onChange={(e) => setFormData({ ...formData, saldo: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Saldo Mínimo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.saldo_minimo}
                      onChange={(e) => setFormData({ ...formData, saldo_minimo: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activa"
                    checked={formData.activa}
                    onChange={(e) => setFormData({ ...formData, activa: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="activa" className="cursor-pointer">Cuenta Activa</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingBanco ? 'Actualizar' : 'Crear'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}