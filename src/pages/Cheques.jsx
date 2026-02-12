import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import SearchableSelect from '@/components/SearchableSelect';
import { CreditCard, Plus, FileText, Loader2, Calendar, DollarSign, Building } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import CambiarEstadoChequeModal from '@/components/tesoreria/CambiarEstadoChequeModal';

export default function Cheques() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [estadoModalOpen, setEstadoModalOpen] = useState(false);
  const [chequeSeleccionado, setChequeSeleccionado] = useState(null);
  const [filtros, setFiltros] = useState({
    estado: 'Todos',
    tipo: 'Todos'
  });
  const [formData, setFormData] = useState({
    numero_cheque: '',
    tipo: 'Terceros',
    banco_id: '',
    cuit_emisor: '',
    fecha_emision: format(new Date(), 'yyyy-MM-dd'),
    fecha_pago: format(new Date(), 'yyyy-MM-dd'),
    monto: 0,
    emisor: '',
    beneficiario: '',
    titular: '',
    notas: ''
  });

  const { data: cheques = [], isLoading } = useQuery({
    queryKey: ['cheques'],
    queryFn: () => base44.entities.Cheque.list('-fecha_pago'),
  });

  const { data: bancosSistema = [] } = useQuery({
    queryKey: ['bancossistema'],
    queryFn: () => base44.entities.BancoSistema.list(),
  });

  const { data: bancosPropios = [] } = useQuery({
    queryKey: ['bancos'],
    queryFn: () => base44.entities.Banco.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Cheque.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cheques'] });
      toast.success('Cheque registrado exitosamente');
      closeModal();
    },
    onError: () => toast.error('Error al registrar cheque')
  });

  const openModal = () => {
    setFormData({
      numero_cheque: '',
      tipo: 'Terceros',
      banco_id: '',
      cuit_emisor: '',
      fecha_emision: format(new Date(), 'yyyy-MM-dd'),
      fecha_pago: format(new Date(), 'yyyy-MM-dd'),
      monto: 0,
      emisor: '',
      beneficiario: '',
      titular: '',
      notas: ''
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const bancoNombre = formData.tipo === 'Propio' 
      ? bancosPropios.find(b => b.id === formData.banco_id)?.nombre 
      : bancosSistema.find(b => b.id === formData.banco_id)?.nombre;

    createMutation.mutate({
      ...formData,
      banco_nombre: bancoNombre,
      estado: 'En Cartera',
      fecha_emision: new Date(formData.fecha_emision).toISOString(),
      fecha_pago: new Date(formData.fecha_pago).toISOString()
    });
  };

  const abrirCambioEstado = (cheque) => {
    setChequeSeleccionado(cheque);
    setEstadoModalOpen(true);
  };

  const chequesFiltrados = cheques.filter(ch => {
    if (filtros.estado !== 'Todos' && ch.estado !== filtros.estado) return false;
    if (filtros.tipo !== 'Todos' && ch.tipo !== filtros.tipo) return false;
    return true;
  });

  const estadoBadgeColor = (estado) => {
    switch (estado) {
      case 'En Cartera': return 'bg-blue-100 text-blue-800';
      case 'Depositado': return 'bg-green-100 text-green-800';
      case 'Endosado': return 'bg-purple-100 text-purple-800';
      case 'Entregado': return 'bg-orange-100 text-orange-800';
      case 'Rechazado': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const totalEnCartera = cheques.filter(ch => ch.estado === 'En Cartera').reduce((sum, ch) => sum + (ch.monto || 0), 0);
  const chequesProxVencer = cheques.filter(ch => {
    const diasRestantes = Math.floor((new Date(ch.fecha_pago) - new Date()) / (1000 * 60 * 60 * 24));
    return ch.estado === 'En Cartera' && diasRestantes <= 7 && diasRestantes >= 0;
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-purple-600" />
              Gestión de Cheques
            </h1>
            <p className="text-slate-500 mt-1">Administra cheques propios y de terceros</p>
          </div>
          <Button onClick={openModal} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Cheque
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">En Cartera</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ${totalEnCartera.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <DollarSign className="h-10 w-10 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Cheques</p>
                  <p className="text-2xl font-bold text-purple-600">{cheques.length}</p>
                </div>
                <CreditCard className="h-10 w-10 text-purple-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Próx. a Vencer</p>
                  <p className="text-2xl font-bold text-orange-600">{chequesProxVencer}</p>
                </div>
                <Calendar className="h-10 w-10 text-orange-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">De Terceros</p>
                  <p className="text-2xl font-bold text-slate-600">
                    {cheques.filter(ch => ch.tipo === 'Terceros').length}
                  </p>
                </div>
                <FileText className="h-10 w-10 text-slate-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Estado</Label>
                <select
                  value={filtros.estado}
                  onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="Todos">Todos los estados</option>
                  <option value="En Cartera">En Cartera</option>
                  <option value="Depositado">Depositado</option>
                  <option value="Endosado">Endosado</option>
                  <option value="Entregado">Entregado</option>
                  <option value="Rechazado">Rechazado</option>
                </select>
              </div>
              <div>
                <Label>Tipo</Label>
                <select
                  value={filtros.tipo}
                  onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="Todos">Todos los tipos</option>
                  <option value="Propio">Propios</option>
                  <option value="Terceros">De Terceros</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Cheques */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : chequesFiltrados.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CreditCard className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay cheques registrados</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {chequesFiltrados.map(cheque => (
              <Card key={cheque.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-purple-600" />
                        <span className="font-bold text-lg">Cheque N° {cheque.numero_cheque}</span>
                        <Badge className={estadoBadgeColor(cheque.estado)}>
                          {cheque.estado}
                        </Badge>
                        <Badge variant="outline">
                          {cheque.tipo}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Banco</p>
                          <p className="font-medium flex items-center gap-1">
                            <Building className="h-4 w-4" />
                            {cheque.banco_nombre}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Emisor</p>
                          <p className="font-medium">{cheque.emisor || '-'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Fecha Emisión</p>
                          <p className="font-medium">
                            {cheque.fecha_emision ? format(new Date(cheque.fecha_emision), 'dd/MM/yyyy', { locale: es }) : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Fecha Pago</p>
                          <p className="font-medium">
                            {cheque.fecha_pago ? format(new Date(cheque.fecha_pago), 'dd/MM/yyyy', { locale: es }) : '-'}
                          </p>
                        </div>
                      </div>

                      {cheque.notas && (
                        <div className="bg-slate-50 rounded-md p-3 text-sm">
                          <p className="text-slate-600">{cheque.notas}</p>
                        </div>
                      )}
                    </div>

                    <div className="text-right ml-6">
                      <p className="text-sm text-slate-500 mb-1">Monto</p>
                      <p className="text-2xl font-bold text-green-600">
                        ${(cheque.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                      <Button
                        onClick={() => abrirCambioEstado(cheque)}
                        variant="outline"
                        size="sm"
                        className="mt-3"
                      >
                        Cambiar Estado
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal Crear Cheque */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Nuevo Cheque</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo *</Label>
                    <select
                      value={formData.tipo}
                      onChange={(e) => setFormData({ ...formData, tipo: e.target.value, banco_id: '' })}
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Terceros">De Terceros</option>
                      <option value="Propio">Propio</option>
                    </select>
                  </div>
                  <div>
                    <Label>Número de Cheque *</Label>
                    <Input
                      value={formData.numero_cheque}
                      onChange={(e) => setFormData({ ...formData, numero_cheque: e.target.value })}
                      placeholder="Número"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Banco *</Label>
                  <SearchableSelect
                    options={formData.tipo === 'Propio' ? bancosPropios : bancosSistema}
                    value={formData.banco_id}
                    onChange={(id) => setFormData({ ...formData, banco_id: id })}
                    displayKey="nombre"
                    placeholder="Seleccionar banco..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>CUIT Emisor</Label>
                    <Input
                      value={formData.cuit_emisor}
                      onChange={(e) => setFormData({ ...formData, cuit_emisor: e.target.value })}
                      placeholder="XX-XXXXXXXX-X"
                    />
                  </div>
                  <div>
                    <Label>Titular</Label>
                    <Input
                      value={formData.titular}
                      onChange={(e) => setFormData({ ...formData, titular: e.target.value })}
                      placeholder="Titular de la cuenta"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Emisor *</Label>
                    <Input
                      value={formData.emisor}
                      onChange={(e) => setFormData({ ...formData, emisor: e.target.value })}
                      placeholder="Quien emite"
                      required
                    />
                  </div>
                  <div>
                    <Label>Beneficiario</Label>
                    <Input
                      value={formData.beneficiario}
                      onChange={(e) => setFormData({ ...formData, beneficiario: e.target.value })}
                      placeholder="A la orden de"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Fecha Emisión *</Label>
                    <Input
                      type="date"
                      value={formData.fecha_emision}
                      onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Fecha Pago *</Label>
                    <Input
                      type="date"
                      value={formData.fecha_pago}
                      onChange={(e) => setFormData({ ...formData, fecha_pago: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Monto *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.monto}
                      onChange={(e) => setFormData({ ...formData, monto: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Notas</Label>
                  <textarea
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm min-h-20"
                    placeholder="Notas adicionales..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Registrar Cheque
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Cambiar Estado */}
        <CambiarEstadoChequeModal
          open={estadoModalOpen && chequeSeleccionado !== null}
          cheque={chequeSeleccionado || {}}
          bancos={bancosPropios}
          onClose={() => {
            setEstadoModalOpen(false);
            setChequeSeleccionado(null);
          }}
        />
      </div>
    </div>
  );
}