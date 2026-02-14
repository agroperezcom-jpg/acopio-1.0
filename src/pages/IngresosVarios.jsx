import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { TrendingUp, Plus, Loader2, Calendar, DollarSign, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SearchableSelect from '@/components/SearchableSelect';
import AsyncSelect from '@/components/AsyncSelect';
import DateRangeSelector from '@/components/DateRangeSelector';
import { base44 } from '@/api/base44Client';

export default function IngresosVarios() {
  const queryClient = useQueryClient();
  const [rango, setRango] = useState(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return { desde: startOfMonth(hoy), hasta: endOfDay(hoy) };
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, ingreso: null });
  const [formData, setFormData] = useState({
    fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    tipo: 'Ingreso',
    cuenta_id: '',
    concepto: '',
    monto: 0,
    forma_ingreso: 'Efectivo',
    destino_tipo: 'Caja',
    destino_id: '',
    cheque_id: '',
    cliente_id: '',
    comprobante: '',
    notas: ''
  });

  const { data: ingresos = [], isLoading } = useQuery({
    queryKey: ['ingresosvarios', rango?.desde, rango?.hasta],
    queryFn: async () => {
      const desde = rango.desde.toISOString();
      const hasta = rango.hasta.toISOString();
      return base44.entities.IngresoVario.filter(
        { fecha: { $gte: desde, $lte: hasta } },
        '-fecha',
        200
      );
    },
    enabled: !!rango?.desde && !!rango?.hasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: cuentas = [] } = useQuery({
    queryKey: ['plandecuentas'],
    queryFn: () => base44.entities.PlanDeCuentas.filter({ activa: true, imputable: true }, 'codigo'),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas'],
    queryFn: () => base44.entities.Caja.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: bancos = [] } = useQuery({
    queryKey: ['bancos'],
    queryFn: () => base44.entities.Banco.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: movimientosTesoreria = [] } = useQuery({
    queryKey: ['movimientostesoreria-ingresosvarios', rango?.desde, rango?.hasta],
    queryFn: async () => {
      const desde = rango.desde.toISOString();
      const hasta = rango.hasta.toISOString();
      return base44.entities.MovimientoTesoreria.filter(
        { fecha: { $gte: desde, $lte: hasta }, referencia_origen_tipo: 'IngresoVario' },
        '-fecha',
        200
      );
    },
    enabled: !!rango?.desde && !!rango?.hasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const guardarIngresoMutation = useMutation({
    mutationFn: async (ingresoData) => {
      // Obtener datos de la cuenta
      const cuenta = cuentas.find(c => c.id === ingresoData.cuenta_id);
      if (!cuenta) throw new Error('Cuenta no encontrada');

      // Obtener datos del destino
      const destinos = ingresoData.destino_tipo === 'Banco' ? bancos : cajas;
      const destino = destinos.find(d => d.id === ingresoData.destino_id);
      if (!destino) throw new Error('Destino no encontrado');

      // Cachear datos
      const datosCompletos = {
        ...ingresoData,
        cuenta_codigo: cuenta.codigo,
        cuenta_nombre: cuenta.nombre,
        destino_nombre: destino.nombre
      };

      // Cliente opcional
      if (ingresoData.cliente_id) {
        const clienteResult = await base44.entities.Cliente.filter({ id: ingresoData.cliente_id });
        if (clienteResult?.[0]) {
          datosCompletos.cliente_nombre = clienteResult[0].nombre;
        }
      }

      // 1. Crear el ingreso
      const ingreso = await base44.entities.IngresoVario.create(datosCompletos);

      // 2. Actualizar saldo del destino
      if (ingresoData.destino_tipo === 'Caja') {
        await base44.entities.Caja.update(ingresoData.destino_id, {
          saldo: (destino.saldo || 0) + ingresoData.monto
        });
      } else {
        await base44.entities.Banco.update(ingresoData.destino_id, {
          saldo: (destino.saldo || 0) + ingresoData.monto
        });
      }

      // 3. Crear movimiento de tesorería
      await base44.entities.MovimientoTesoreria.create({
        fecha: ingresoData.fecha,
        tipo_movimiento: 'Ingreso Manual',
        destino_tipo: ingresoData.destino_tipo,
        destino_id: ingresoData.destino_id,
        destino_nombre: destino.nombre,
        monto: ingresoData.monto,
        concepto: `Ingreso Vario: ${ingresoData.concepto}`,
        comprobante: ingresoData.comprobante,
        referencia_origen_id: ingreso.id,
        referencia_origen_tipo: 'IngresoVario'
      });

      return ingreso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingresosvarios'] });
      queryClient.invalidateQueries({ queryKey: ['movimientostesoreria-ingresosvarios'] });
      queryClient.invalidateQueries({ queryKey: ['cajas'] });
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      toast.success('Ingreso registrado exitosamente');
      cerrarModal();
    },
    onError: (error) => {
      console.error('Error al guardar ingreso:', error);
      toast.error('Error al registrar el ingreso');
    }
  });

  const abrirModalNuevo = () => {
    setFormData({
      fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      tipo: 'Ingreso',
      cuenta_id: '',
      cuenta_codigo: '',
      cuenta_nombre: '',
      concepto: '',
      monto: 0,
      forma_ingreso: 'Efectivo',
      destino_tipo: 'Caja',
      destino_id: '',
      cheque_id: '',
      cliente_id: '',
      comprobante: '',
      notas: ''
    });
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
  };

  const handleGuardar = () => {
    if (!formData.cuenta_id) {
      toast.error('Por favor seleccione una cuenta contable');
      return;
    }
    if (!formData.concepto || !formData.destino_id || formData.monto <= 0) {
      toast.error('Complete todos los campos obligatorios');
      return;
    }
    guardarIngresoMutation.mutate(formData);
  };

  const eliminarMutation = useMutation({
    mutationFn: async (ingreso) => {
      // Buscar movimientos de tesorería vinculados
      const movimientosVinculados = movimientosTesoreria.filter(m => 
        m.referencia_origen_id === ingreso.id && m.referencia_origen_tipo === 'IngresoVario'
      );

      // Revertir saldos de destino
      for (const mov of movimientosVinculados) {
        if (mov.destino_id && mov.destino_tipo) {
          if (mov.destino_tipo === 'Caja') {
            const caja = cajas.find(c => c.id === mov.destino_id);
            if (caja) {
              await base44.entities.Caja.update(mov.destino_id, {
                saldo: (caja.saldo || 0) - mov.monto
              });
            }
          } else if (mov.destino_tipo === 'Banco') {
            const banco = bancos.find(b => b.id === mov.destino_id);
            if (banco) {
              await base44.entities.Banco.update(mov.destino_id, {
                saldo: (banco.saldo || 0) - mov.monto
              });
            }
          }
        }

        // Eliminar movimiento de tesorería
        await base44.entities.MovimientoTesoreria.delete(mov.id);
      }

      // Eliminar el ingreso
      await base44.entities.IngresoVario.delete(ingreso.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingresosvarios'] });
      queryClient.invalidateQueries({ queryKey: ['movimientostesoreria-ingresosvarios'] });
      queryClient.invalidateQueries({ queryKey: ['cajas'] });
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      toast.success('Ingreso eliminado completamente');
      setDeleteDialog({ open: false, ingreso: null });
    },
    onError: (error) => {
      console.error('Error al eliminar ingreso:', error);
      toast.error('Error al eliminar el ingreso');
    }
  });

  // Filtrar ingresos que tienen movimientos de tesorería vinculados
  const ingresosValidos = ingresos.filter(ingreso => {
    const tieneMovimientos = movimientosTesoreria.some(m => 
      m.referencia_origen_id === ingreso.id && m.referencia_origen_tipo === 'IngresoVario'
    );
    return tieneMovimientos;
  });

  const cuentasIngresos = cuentas.filter(c => c.activa !== false && c.imputable !== false);
  const destinosDisponibles = formData.destino_tipo === 'Banco' ? bancos : cajas;
  const totalIngresos = ingresosValidos.reduce((sum, i) => sum + (i.monto || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-600" />
                Ingresos Varios
              </h1>
              <p className="text-slate-500 mt-1">Registra ingresos que no provienen de ventas de fruta</p>
            </div>
            <Button onClick={abrirModalNuevo} className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Ingreso
          </Button>
          </div>
          <DateRangeSelector
            startDate={rango.desde}
            endDate={rango.hasta}
            onChange={({ start, end }) => setRango({ desde: start, hasta: end })}
          />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Ingresos en período</p>
                  <p className="text-2xl font-bold text-green-600">
                    {!rango ? '—' : `$${totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
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
                  <p className="text-sm text-slate-500">Cantidad</p>
                  <p className="text-2xl font-bold text-slate-600">{ingresosValidos.length}</p>
                </div>
                <FileText className="h-10 w-10 text-slate-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Promedio</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ${ingresosValidos.length > 0 ? (totalIngresos / ingresosValidos.length).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '0.00'}
                  </p>
                </div>
                <TrendingUp className="h-10 w-10 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Ingresos */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          </div>
        ) : !rango ? (
          <Card>
            <CardContent className="p-12 text-center">
              <TrendingUp className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Cargando rango de fechas...</p>
            </CardContent>
          </Card>
        ) : ingresosValidos.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <TrendingUp className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay ingresos varios en el período seleccionado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {ingresosValidos.map(ingreso => (
              <Card key={ingreso.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-slate-400" />
                        <span className="font-medium">
                          {ingreso.fecha ? format(new Date(ingreso.fecha), "dd/MM/yyyy HH:mm", { locale: es }) : '-'}
                        </span>
                        <Badge className="bg-green-100 text-green-800">
                          {ingreso.tipo}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <p className="font-semibold text-lg text-slate-800">{ingreso.concepto}</p>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="font-mono">{ingreso.cuenta_codigo}</span>
                          <span>•</span>
                          <span>{ingreso.cuenta_nombre}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {ingreso.forma_ingreso} → {ingreso.destino_nombre}
                        </Badge>
                        {ingreso.cliente_nombre && (
                          <Badge variant="outline">Cliente: {ingreso.cliente_nombre}</Badge>
                        )}
                        {ingreso.comprobante && (
                          <Badge variant="outline">Comp: {ingreso.comprobante}</Badge>
                        )}
                      </div>

                      {ingreso.notas && (
                        <div className="bg-slate-50 rounded-md p-3 text-sm">
                          <p className="text-slate-600">{ingreso.notas}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 ml-6">
                      <div className="text-right">
                        <p className="text-sm text-slate-500 mb-1">Monto</p>
                        <p className="text-2xl font-bold text-green-600">
                          ${(ingreso.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteDialog({ open: true, ingreso })}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Alert Dialog para eliminar */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, ingreso: deleteDialog.ingreso })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este ingreso?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Esta acción eliminará el ingreso y revertirá todos los cambios asociados:</p>
                {deleteDialog.ingreso && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                    <p className="font-semibold text-amber-900 mb-2">{deleteDialog.ingreso.tipo}: {deleteDialog.ingreso.concepto}</p>
                    <p className="text-slate-700">Cuenta: {deleteDialog.ingreso.cuenta_nombre}</p>
                    <p className="text-slate-700">Monto: <strong>${(deleteDialog.ingreso.monto || 0).toLocaleString('es-AR')}</strong></p>
                    <p className="text-slate-700 mt-2">Se revertirán saldos de cajas/bancos y movimientos de tesorería.</p>
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">Esta acción no se puede deshacer.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={eliminarMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteDialog.ingreso && eliminarMutation.mutate(deleteDialog.ingreso)}
                disabled={eliminarMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {eliminarMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  'Sí, Eliminar Ingreso'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal Nuevo Ingreso */}
        <Dialog open={modalOpen} onOpenChange={cerrarModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nuevo Ingreso Vario</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fecha *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.fecha}
                    onChange={(e) => setFormData({...formData, fecha: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Tipo *</Label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="Ingreso">Ingreso</option>
                    <option value="Otro Ingreso">Otro Ingreso</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>Cuenta Contable *</Label>
                <SearchableSelect
                  options={cuentasIngresos}
                  value={formData.cuenta_id}
                  onChange={(id, cuenta) => {
                    setFormData({
                      ...formData,
                      cuenta_id: id,
                      cuenta_codigo: cuenta?.codigo || '',
                      cuenta_nombre: cuenta?.nombre || ''
                    });
                  }}
                  displayKey="nombre"
                  placeholder="Seleccionar cuenta de ingresos..."
                />
                {formData.cuenta_id && cuentasIngresos.find(c => c.id === formData.cuenta_id) && (
                  <p className="text-xs text-slate-500 mt-1">
                    Código: {cuentasIngresos.find(c => c.id === formData.cuenta_id)?.codigo}
                  </p>
                )}
              </div>

              <div>
                <Label>Concepto *</Label>
                <Input
                  value={formData.concepto}
                  onChange={(e) => setFormData({...formData, concepto: e.target.value})}
                  placeholder="Descripción del ingreso"
                />
              </div>

              <div>
                <Label>Monto *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.monto}
                  onChange={(e) => setFormData({...formData, monto: parseFloat(e.target.value) || 0})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Forma de Ingreso *</Label>
                  <select
                    value={formData.forma_ingreso}
                    onChange={(e) => {
                      const forma = e.target.value;
                      setFormData({
                        ...formData,
                        forma_ingreso: forma,
                        destino_tipo: forma === 'Efectivo' ? 'Caja' : 'Banco',
                        destino_id: ''
                      });
                    }}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="Efectivo">💵 Efectivo → Caja</option>
                    <option value="Transferencia">🏦 Transferencia → Banco</option>
                    <option value="Cheque">📄 Cheque</option>
                  </select>
                </div>
                <div>
                  <Label>Destino *</Label>
                  <SearchableSelect
                    options={destinosDisponibles}
                    value={formData.destino_id}
                    onChange={(id) => setFormData({...formData, destino_id: id})}
                    displayKey="nombre"
                    placeholder={`Seleccionar ${formData.destino_tipo === 'Banco' ? 'banco' : 'caja'}...`}
                  />
                </div>
              </div>

              <div>
                <Label>Cliente (Opcional)</Label>
                <AsyncSelect
                  entityKey="Cliente"
                  value={formData.cliente_id}
                  onChange={(option) => setFormData({...formData, cliente_id: option?.id || ''})}
                  placeholder="Seleccionar cliente..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Comprobante</Label>
                  <Input
                    value={formData.comprobante}
                    onChange={(e) => setFormData({...formData, comprobante: e.target.value})}
                    placeholder="Número de comprobante"
                  />
                </div>
              </div>

              <div>
                <Label>Notas</Label>
                <Input
                  value={formData.notas}
                  onChange={(e) => setFormData({...formData, notas: e.target.value})}
                  placeholder="Notas adicionales"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={cerrarModal}>Cancelar</Button>
              <Button
                onClick={handleGuardar}
                disabled={guardarIngresoMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {guardarIngresoMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Guardar Ingreso
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}