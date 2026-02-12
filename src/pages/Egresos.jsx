import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingDown, Calendar, FileText, Trash2, Edit, Plus, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import SearchableSelect from '@/components/SearchableSelect';
import AsyncSelect from '@/components/AsyncSelect';
import { toast } from 'sonner';
import DateRangeToolbar from '@/components/DateRangeToolbar';

export default function Egresos() {
  const queryClient = useQueryClient();
  const [rango, setRango] = useState(null);
  const [activeTab, setActiveTab] = useState('costos');
  const [showForm, setShowForm] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, egreso: null });

  const [formData, setFormData] = useState({
    fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    tipo: 'Costo',
    clasificacion: 'Fijo',
    cuenta_id: '',
    concepto: '',
    monto: 0,
    forma_pago: 'Efectivo',
    origen_tipo: 'Caja',
    origen_id: '',
    cheque_id: '',
    proveedor_id: '',
    comprobante: '',
    notas: ''
  });

  const { data: egresos = [] } = useQuery({
    queryKey: ['egresos', rango?.desde, rango?.hasta],
    queryFn: async () => {
      const desde = rango.desde.toISOString();
      const hasta = rango.hasta.toISOString();
      return base44.entities.Egreso.filter(
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
    queryFn: () => base44.entities.PlanDeCuentas.filter({ activa: true, imputable: true }, 'codigo')
  });

  const { data: bancos = [] } = useQuery({
    queryKey: ['bancos'],
    queryFn: () => base44.entities.Banco.list('nombre')
  });

  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas'],
    queryFn: () => base44.entities.Caja.list('nombre')
  });

  const { data: cheques = [] } = useQuery({
    queryKey: ['cheques'],
    queryFn: () => base44.entities.Cheque.list('-fecha_pago')
  });

  const { data: movimientosTesoreria = [] } = useQuery({
    queryKey: ['movimientostesoreria-egresos', rango?.desde, rango?.hasta],
    queryFn: async () => {
      const desde = rango.desde.toISOString();
      const hasta = rango.hasta.toISOString();
      return base44.entities.MovimientoTesoreria.filter(
        { fecha: { $gte: desde, $lte: hasta }, referencia_origen_tipo: 'Egreso' },
        '-fecha',
        200
      );
    },
    enabled: !!rango?.desde && !!rango?.hasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const crearMutation = useMutation({
    mutationFn: async (data) => {
      // 1. Crear el egreso
      const egreso = await base44.entities.Egreso.create(data);

      // 2. Actualizar saldo del origen si existe
      if (data.origen_id) {
        if (data.origen_tipo === 'Caja') {
          const caja = cajas.find(c => c.id === data.origen_id);
          if (caja) {
            await base44.entities.Caja.update(data.origen_id, {
              saldo: (caja.saldo || 0) - data.monto
            });
          }
        } else if (data.origen_tipo === 'Banco') {
          const banco = bancos.find(b => b.id === data.origen_id);
          if (banco) {
            await base44.entities.Banco.update(data.origen_id, {
              saldo: (banco.saldo || 0) - data.monto
            });
          }
        }

        // 3. Crear movimiento de tesorería
        await base44.entities.MovimientoTesoreria.create({
          fecha: data.fecha,
          tipo_movimiento: 'Egreso Manual',
          origen_tipo: data.origen_tipo,
          origen_id: data.origen_id,
          origen_nombre: data.origen_nombre,
          monto: data.monto,
          concepto: `${data.tipo}: ${data.concepto}`,
          comprobante: data.comprobante,
          referencia_origen_id: egreso.id,
          referencia_origen_tipo: 'Egreso'
        });
      }

      return egreso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['egresos'] });
      queryClient.invalidateQueries({ queryKey: ['movimientostesoreria-egresos'] });
      queryClient.invalidateQueries({ queryKey: ['cajas'] });
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      toast.success('Egreso registrado exitosamente');
      resetForm();
    }
  });

  const eliminarMutation = useMutation({
    mutationFn: async (egreso) => {
      // Buscar movimientos de tesorería vinculados
      const movimientosVinculados = movimientosTesoreria.filter(m => 
        m.referencia_origen_id === egreso.id && m.referencia_origen_tipo === 'Egreso'
      );

      // Revertir saldos de origen
      for (const mov of movimientosVinculados) {
        if (mov.origen_id && mov.origen_tipo) {
          if (mov.origen_tipo === 'Caja') {
            const caja = cajas.find(c => c.id === mov.origen_id);
            if (caja) {
              await base44.entities.Caja.update(mov.origen_id, {
                saldo: (caja.saldo || 0) + mov.monto
              });
            }
          } else if (mov.origen_tipo === 'Banco') {
            const banco = bancos.find(b => b.id === mov.origen_id);
            if (banco) {
              await base44.entities.Banco.update(mov.origen_id, {
                saldo: (banco.saldo || 0) + mov.monto
              });
            }
          }
        }

        // Eliminar movimiento de tesorería
        await base44.entities.MovimientoTesoreria.delete(mov.id);
      }

      // Eliminar el egreso
      await base44.entities.Egreso.delete(egreso.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['egresos'] });
      queryClient.invalidateQueries({ queryKey: ['movimientostesoreria-egresos'] });
      queryClient.invalidateQueries({ queryKey: ['cajas'] });
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      toast.success('Egreso eliminado completamente');
      setDeleteDialog({ open: false, egreso: null });
    },
    onError: (error) => {
      console.error('Error al eliminar egreso:', error);
      toast.error('Error al eliminar el egreso');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.cuenta_id) {
      toast.error('Por favor seleccione una cuenta contable');
      return;
    }
    if (!formData.concepto || formData.monto <= 0) {
      toast.error('Complete todos los campos requeridos');
      return;
    }

    const cuenta = cuentas.find(c => c.id === formData.cuenta_id);
    
    // Obtener nombre del proveedor si existe
    let proveedorNombre = '';
    if (formData.proveedor_id) {
      const proveedor = await base44.entities.Proveedor.filter({ id: formData.proveedor_id });
      proveedorNombre = proveedor?.[0]?.nombre || '';
    }
    
    let origen;
    if (formData.origen_id) {
      if (formData.origen_tipo === 'Banco') {
        origen = bancos.find(b => b.id === formData.origen_id);
      } else {
        origen = cajas.find(c => c.id === formData.origen_id);
      }
    }

    crearMutation.mutate({
      ...formData,
      fecha: new Date(formData.fecha).toISOString(),
      tipo: activeTab === 'costos' ? 'Costo' : 'Gasto',
      cuenta_codigo: cuenta?.codigo,
      cuenta_nombre: cuenta?.nombre,
      proveedor_nombre: proveedorNombre,
      origen_nombre: origen?.nombre || ''
    });
  };

  const resetForm = () => {
    setFormData({
      fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      tipo: activeTab === 'costos' ? 'Costo' : 'Gasto',
      clasificacion: 'Fijo',
      cuenta_id: '',
      concepto: '',
      monto: 0,
      forma_pago: 'Efectivo',
      origen_tipo: 'Caja',
      origen_id: '',
      cheque_id: '',
      proveedor_id: '',
      comprobante: '',
      notas: ''
    });
    setShowForm(false);
  };

  // Filtrar egresos que tienen movimientos de tesorería vinculados
  const egresosValidos = egresos.filter(egreso => {
    const tieneMovimientos = movimientosTesoreria.some(m => 
      m.referencia_origen_id === egreso.id && m.referencia_origen_tipo === 'Egreso'
    );
    return tieneMovimientos;
  });

  const egresosFiltrados = egresosValidos.filter(e => e.tipo === (activeTab === 'costos' ? 'Costo' : 'Gasto'));
  const totalFiltrado = egresosFiltrados.reduce((sum, e) => sum + (e.monto || 0), 0);

  const totalFijos = egresosFiltrados.filter(e => e.clasificacion === 'Fijo').reduce((sum, e) => sum + (e.monto || 0), 0);
  const totalVariables = egresosFiltrados.filter(e => e.clasificacion === 'Variable').reduce((sum, e) => sum + (e.monto || 0), 0);

  const cuentasFiltradas = cuentas.filter(c => c.activa !== false && c.imputable !== false);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-800 flex items-center gap-2 md:gap-3">
            <TrendingDown className="h-6 w-6 md:h-8 md:w-8 text-red-600" />
            Egresos
          </h1>
          <p className="text-sm md:text-base text-slate-600 mt-1">Gestión de costos y gastos</p>
          <div className="mt-4">
            <DateRangeToolbar
              onRangeChange={({ desde, hasta }) => setRango({ desde, hasta })}
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(val) => {
          setActiveTab(val);
          setShowForm(false);
        }}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="costos">Costos</TabsTrigger>
            <TabsTrigger value="gastos">Gastos</TabsTrigger>
          </TabsList>

          <div className="mb-4 md:mb-6">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                      <DollarSign className="h-5 w-5 md:h-6 md:w-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-slate-500">Total {activeTab === 'costos' ? 'Costos' : 'Gastos'} en período</p>
                      <p className="text-2xl md:text-3xl font-bold text-red-600">
                        {!rango ? '—' : `$${totalFiltrado.toFixed(2)}`}
                      </p>
                      <div className="flex flex-wrap gap-2 md:gap-3 text-xs text-slate-400 mt-1">
                        <span>Fijos: ${totalFijos.toFixed(2)}</span>
                        <span>•</span>
                        <span>Var: ${totalVariables.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => setShowForm(!showForm)} className="bg-red-600 hover:bg-red-700 w-full sm:w-auto text-sm md:text-base">
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Nuevo {activeTab === 'costos' ? 'Costo' : 'Gasto'}</span>
                    <span className="sm:hidden">Nuevo</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {showForm && (
            <Card className="border-0 shadow-lg mb-6">
              <CardHeader>
                <CardTitle>Registrar {activeTab === 'costos' ? 'Costo' : 'Gasto'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Fecha *</label>
                      <Input
                        type="datetime-local"
                        value={formData.fecha}
                        onChange={(e) => setFormData({...formData, fecha: e.target.value})}
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Clasificación *</label>
                      <select
                        value={formData.clasificacion}
                        onChange={(e) => setFormData({...formData, clasificacion: e.target.value})}
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                        required
                      >
                        <option value="Fijo">Fijo</option>
                        <option value="Variable">Variable</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Cuenta Contable *</label>
                      <SearchableSelect
                        options={cuentasFiltradas}
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
                        placeholder="Seleccionar cuenta..."
                      />
                      {formData.cuenta_id && cuentasFiltradas.find(c => c.id === formData.cuenta_id) && (
                        <p className="text-xs text-slate-500 mt-1">
                          Código: {cuentasFiltradas.find(c => c.id === formData.cuenta_id)?.codigo}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Concepto *</label>
                      <Input
                        value={formData.concepto}
                        onChange={(e) => setFormData({...formData, concepto: e.target.value})}
                        placeholder="Descripción del egreso"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Monto *</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.monto}
                        onChange={(e) => setFormData({...formData, monto: parseFloat(e.target.value)})}
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Forma de Pago</label>
                      <select
                        value={formData.forma_pago}
                        onChange={(e) => setFormData({...formData, forma_pago: e.target.value, cheque_id: ''})}
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="Efectivo">Efectivo</option>
                        <option value="Transferencia">Transferencia</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Tarjeta">Tarjeta</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Tipo Origen</label>
                      <select
                        value={formData.origen_tipo}
                        onChange={(e) => setFormData({...formData, origen_tipo: e.target.value, origen_id: ''})}
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="Banco">Banco</option>
                        <option value="Caja">Caja</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Origen (Banco/Caja)</label>
                      <SearchableSelect
                        options={formData.origen_tipo === 'Banco' ? bancos : cajas}
                        value={formData.origen_id}
                        onChange={(id) => setFormData({...formData, origen_id: id})}
                        displayKey="nombre"
                        placeholder={`Seleccionar ${formData.origen_tipo.toLowerCase()}...`}
                      />
                    </div>

                    {formData.forma_pago === 'Cheque' && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Cheque</label>
                        <SearchableSelect
                          options={cheques.filter(ch => ch.estado === 'Pendiente')}
                          value={formData.cheque_id}
                          onChange={(id) => setFormData({...formData, cheque_id: id})}
                          displayKey="numero_cheque"
                          placeholder="Seleccionar cheque (opcional)..."
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Proveedor (Opcional)</label>
                      <AsyncSelect
                        entityKey="Proveedor"
                        value={formData.proveedor_id}
                        onChange={(option) => setFormData({...formData, proveedor_id: option?.id || ''})}
                        placeholder="Seleccionar proveedor..."
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Comprobante</label>
                      <Input
                        value={formData.comprobante}
                        onChange={(e) => setFormData({...formData, comprobante: e.target.value})}
                        placeholder="Número de factura/recibo"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Notas</label>
                    <Textarea
                      value={formData.notas}
                      onChange={(e) => setFormData({...formData, notas: e.target.value})}
                      placeholder="Notas adicionales..."
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="bg-red-600 hover:bg-red-700">
                      Guardar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <TabsContent value="costos" className="mt-0">
            <EgresosLista 
              egresos={egresosFiltrados}
              onEliminar={(egreso) => setDeleteDialog({ open: true, egreso })}
              tipo="Costo"
            />
          </TabsContent>

          <TabsContent value="gastos" className="mt-0">
            <EgresosLista 
              egresos={egresosFiltrados}
              onEliminar={(egreso) => setDeleteDialog({ open: true, egreso })}
              tipo="Gasto"
            />
          </TabsContent>
        </Tabs>

        {/* Alert Dialog para eliminar */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, egreso: deleteDialog.egreso })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este egreso?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Esta acción eliminará el egreso y revertirá todos los cambios asociados:</p>
                {deleteDialog.egreso && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                    <p className="font-semibold text-amber-900 mb-2">{deleteDialog.egreso.tipo}: {deleteDialog.egreso.concepto}</p>
                    <p className="text-slate-700">Cuenta: {deleteDialog.egreso.cuenta_nombre}</p>
                    <p className="text-slate-700">Monto: <strong>${(deleteDialog.egreso.monto || 0).toLocaleString('es-AR')}</strong></p>
                    <p className="text-slate-700 mt-2">Se revertirán saldos de cajas/bancos y movimientos de tesorería.</p>
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">Esta acción no se puede deshacer.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={eliminarMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteDialog.egreso && eliminarMutation.mutate(deleteDialog.egreso)}
                disabled={eliminarMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {eliminarMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  'Sí, Eliminar Egreso'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function EgresosLista({ egresos, onEliminar, tipo }) {
  if (egresos.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-12 text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No hay {tipo.toLowerCase()}s registrados</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {egresos.map(egreso => (
        <Card key={egreso.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
                    {egreso.cuenta_codigo}
                  </Badge>
                  <Badge variant={egreso.clasificacion === 'Fijo' ? 'default' : 'secondary'} className="text-xs">
                    {egreso.clasificacion}
                  </Badge>
                  <span className="font-semibold text-sm md:text-base text-slate-800 break-words">{egreso.concepto}</span>
                </div>
                <p className="text-sm text-slate-600 mb-1">{egreso.cuenta_nombre}</p>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(egreso.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </span>
                  {egreso.proveedor_nombre && (
                    <span>Proveedor: {egreso.proveedor_nombre}</span>
                  )}
                  {egreso.comprobante && (
                    <span>Comp: {egreso.comprobante}</span>
                  )}
                </div>
                {egreso.notas && (
                  <p className="text-xs text-slate-500 mt-2">{egreso.notas}</p>
                )}
              </div>
              <div className="flex items-center gap-2 sm:ml-4 shrink-0">
                <div className="text-right">
                  <p className="text-xl md:text-2xl font-bold text-red-600 whitespace-nowrap">${egreso.monto.toFixed(2)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEliminar(egreso)}
                  className="text-red-500 hover:text-red-700 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}