import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Receipt, Plus, Loader2, Calendar, Users, DollarSign, FileText, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import CobroConSalidasModal from '@/components/tesoreria/CobroConSalidasModal';
import { base44 } from '@/api/base44Client';
import { escapeRegex } from '@/lib/utils';
import { invalidarTodoElSistema } from '@/utils/queryHelpers';
import { recalcularSaldosEntidad, actualizarSaldoEntidad } from '@/utils/contabilidad';
import { usePinGuard } from '@/hooks/usePinGuard';

export default function Cobros() {
  const queryClient = useQueryClient();
  const { askPin, PinGuardModal } = usePinGuard();
  const [modalCobroOpen, setModalCobroOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, cobro: null });
  const [filtroCliente, setFiltroCliente] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const registrosPorPagina = 20;

  const PAGE_SIZE = 20;

  const queryCobros = React.useMemo(() => {
    const trimmed = filtroCliente?.trim();
    if (!trimmed) return {};
    return { cliente_nombre: { $regex: escapeRegex(trimmed), $options: 'i' } };
  }, [filtroCliente]);

  const {
    data: cobrosData,
    fetchNextPage: fetchMoreCobros,
    hasNextPage: hasMoreCobros,
    isFetchingNextPage: loadingMoreCobros,
    isLoading
  } = useInfiniteQuery({
    queryKey: ['cobros-infinite', filtroCliente],
    queryFn: ({ pageParam = 0 }) => {
      if (Object.keys(queryCobros).length === 0) {
        return base44.entities.Cobro.list('-fecha', PAGE_SIZE, pageParam);
      }
      return base44.entities.Cobro.filter(queryCobros, '-fecha', PAGE_SIZE, pageParam);
    },
    getNextPageParam: (lastPage, allPages) =>
      (lastPage?.length ?? 0) === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const cobros = React.useMemo(() => cobrosData?.pages?.flat() ?? [], [cobrosData]);

  const { data: salidas = [] } = useQuery({
    queryKey: ['salidas'],
    queryFn: () => base44.entities.SalidaFruta.list('-fecha', 50),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas'],
    queryFn: () => base44.entities.Caja.list('nombre', 50),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: bancos = [] } = useQuery({
    queryKey: ['bancos'],
    queryFn: () => base44.entities.Banco.list('nombre', 50),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: cheques = [] } = useQuery({
    queryKey: ['cheques'],
    queryFn: () => base44.entities.Cheque.list('-fecha_pago', 50),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: bancosSistema = [] } = useQuery({
    queryKey: ['bancossistema'],
    queryFn: () => base44.entities.BancoSistema.list('nombre', 50),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: movimientosTesoreria = [] } = useQuery({
    queryKey: ['movimientostesoreria'],
    queryFn: () => base44.entities.MovimientoTesoreria.list('-fecha', 50),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const deleteCobroMutation = useMutation({
    mutationFn: async (cobro) => {
      // Buscar TODOS los MovimientoTesoreria vinculados a este cobro
      const movimientosVinculados = movimientosTesoreria.filter(m => 
        m.referencia_origen_id === cobro.id && m.referencia_origen_tipo === 'Cobro'
      );

      // Revertir saldos de todos los medios de cobro
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
      }

      // Revertir estados de salidas aplicadas
      if (cobro.salidas_aplicadas && cobro.salidas_aplicadas.length > 0) {
        for (const aplicado of cobro.salidas_aplicadas) {
          const salida = salidas.find(s => s.id === aplicado.salida_id);
          if (salida) {
            const nuevoMontoCobrado = (salida.monto_cobrado || 0) - aplicado.monto_aplicado;
            let nuevoEstado = 'Pendiente';
            if (nuevoMontoCobrado >= (salida.deuda_total || 0)) {
              nuevoEstado = 'Cobrado';
            } else if (nuevoMontoCobrado > 0) {
              nuevoEstado = 'Pago Parcial';
            }
            await base44.entities.SalidaFruta.update(aplicado.salida_id, {
              monto_cobrado: nuevoMontoCobrado,
              estado_cobro: nuevoEstado
            });
          }
        }
      }

      // Eliminar movimientos de cuenta corriente relacionados (revertir saldo_actual antes)
      const [movsCCCobro, movsCCRetencion] = await Promise.all([
        base44.entities.CuentaCorriente.filter({ comprobante_tipo: 'Cobro', comprobante_id: cobro.id }),
        base44.entities.CuentaCorriente.filter({ comprobante_tipo: 'Retencion', comprobante_id: cobro.id })
      ]);
      const movsCCCobroTodos = [...(Array.isArray(movsCCCobro) ? movsCCCobro : [movsCCCobro]).filter(Boolean), ...(Array.isArray(movsCCRetencion) ? movsCCRetencion : [movsCCRetencion]).filter(Boolean)];
      for (const movCC of movsCCCobroTodos) {
        await actualizarSaldoEntidad(base44, 'Cliente', cobro.cliente_id, movCC.monto || 0);
        await base44.entities.CuentaCorriente.delete(movCC.id);
      }

      // Revertir estado de cheques de terceros en cartera
      const chequesVinculados = cheques.filter(ch => 
        ch.origen_movimiento_id === cobro.id && ch.origen_movimiento_tipo === 'Cobro'
      );
      for (const cheque of chequesVinculados) {
        await base44.entities.Cheque.update(cheque.id, {
          estado: 'Pendiente',
          origen_movimiento_id: null,
          origen_movimiento_tipo: null
        });
      }

      // No borramos IngresoVario: es inseguro sin un ID de enlace (cobro_id). Evitamos list() masivo y borrados por adivinación.
      // TODO: Implementar borrado seguro cuando exista cobro_id en IngresoVario.

      // Eliminar todos los movimientos de tesorería vinculados
      for (const mov of movimientosVinculados) {
        await base44.entities.MovimientoTesoreria.delete(mov.id);
      }

      // Eliminar el cobro
      await base44.entities.Cobro.delete(cobro.id);
      
      // Recalcular saldos de cuenta corriente del cliente usando función centralizada
      if (cobro.cliente_id) {
        await recalcularSaldosEntidad(base44, cobro.cliente_id, 'Cliente');
      }
      
      return cobro;
    },
    onSuccess: () => {
      // Invalidar todas las queries del sistema
      invalidarTodoElSistema(queryClient);
      
      toast.success('Cobro eliminado completamente');
      setDeleteDialog({ open: false, cobro: null });
    },
    onError: (error) => {
      console.error('Error al eliminar cobro:', error);
      toast.error('Error al eliminar el cobro');
    }
  });

  const guardarCobroMutation = useMutation({
    mutationFn: async (cobroData) => {
      // 1. Crear el cobro
      const cobro = await base44.entities.Cobro.create(cobroData);

      // 1.5. Registrar en IngresoVario para Estado de Resultados
      if (cobroData.cuenta_contable_id) {
        await base44.entities.IngresoVario.create({
          fecha: cobroData.fecha,
          tipo: 'Ingreso',
          cuenta_id: cobroData.cuenta_contable_id,
          cuenta_codigo: cobroData.cuenta_contable_codigo || '',
          cuenta_nombre: cobroData.cuenta_contable_nombre,
          concepto: cobroData.concepto || `Cobro de ${cobroData.cliente_nombre}`,
          monto: cobroData.monto_total,
          forma_ingreso: 'Transferencia',
          destino_tipo: 'Banco',
          destino_id: '',
          destino_nombre: '',
          cliente_id: cobroData.cliente_id,
          cliente_nombre: cobroData.cliente_nombre,
          comprobante: cobroData.comprobante || '',
          notas: `Cobro registrado automáticamente desde tesorería - ID: ${cobro.id}`
        });
      }

      // 2. Actualizar saldos de destino según medios de cobro
      for (const medio of cobroData.medios_cobro_detalles) {
        if (medio.destino_tipo === 'Caja') {
          const caja = cajas.find(c => c.id === medio.destino_id);
          if (caja) {
            await base44.entities.Caja.update(medio.destino_id, {
              saldo: (caja.saldo || 0) + medio.monto
            });
          }
        } else if (medio.destino_tipo === 'Banco') {
          const banco = bancos.find(b => b.id === medio.destino_id);
          if (banco) {
            await base44.entities.Banco.update(medio.destino_id, {
              saldo: (banco.saldo || 0) + medio.monto
            });
          }
        }

        // Crear movimiento de tesorería
        await base44.entities.MovimientoTesoreria.create({
          fecha: cobroData.fecha,
          tipo_movimiento: 'Ingreso Manual',
          destino_tipo: medio.destino_tipo,
          destino_id: medio.destino_id,
          destino_nombre: medio.destino_nombre,
          monto: medio.monto,
          concepto: `Cobro de ${cobroData.cliente_nombre} - ${cobroData.concepto}`,
          comprobante: cobroData.comprobante,
          referencia_origen_id: cobro.id,
          referencia_origen_tipo: 'Cobro'
        });

        // Si es cheque de terceros, actualizar el estado
        if (medio.tipo === 'Cheque' && medio.cheque_id) {
          await base44.entities.Cheque.update(medio.cheque_id, {
            estado: 'En Cartera',
            origen_movimiento_id: cobro.id,
            origen_movimiento_tipo: 'Cobro'
          });
        }
      }

      // 3. Actualizar salidas aplicadas y crear movimientos en cuenta corriente
      if (cobroData.tipo_cobro === 'Aplicado' && cobroData.salidas_aplicadas) {
        for (const aplicado of cobroData.salidas_aplicadas) {
          const salida = salidas.find(s => s.id === aplicado.salida_id);
          if (salida) {
            const nuevoMontoCobrado = (salida.monto_cobrado || 0) + aplicado.monto_aplicado;
            const deudaTotal = salida.deuda_total || 0;
            
            let nuevoEstado = 'Pendiente';
            if (nuevoMontoCobrado >= deudaTotal) {
              nuevoEstado = 'Cobrado';
            } else if (nuevoMontoCobrado > 0) {
              nuevoEstado = 'Pago Parcial';
            }

            await base44.entities.SalidaFruta.update(aplicado.salida_id, {
              monto_cobrado: nuevoMontoCobrado,
              estado_cobro: nuevoEstado
            });

            // Crear movimiento en cuenta corriente (Debe = disminuye deuda del cliente)
            await base44.entities.CuentaCorriente.create({
              fecha: cobroData.fecha,
              tipo_movimiento: 'Debe',
              entidad_tipo: 'Cliente',
              entidad_id: cobroData.cliente_id,
              entidad_nombre: cobroData.cliente_nombre,
              monto: aplicado.monto_aplicado,
              saldo_resultante: 0,
              concepto: `Cobro aplicado a salida ${salida.numero_remito}`,
              comprobante_id: cobro.id,
              comprobante_tipo: 'Cobro'
            });
            await actualizarSaldoEntidad(base44, 'Cliente', cobroData.cliente_id, -aplicado.monto_aplicado);
          }
        }

        // Recalcular saldos resultantes en filas de CC
        await recalcularSaldosEntidad(base44, cobroData.cliente_id, 'Cliente');
      } else if (cobroData.tipo_cobro === 'A Cuenta') {
        // Crear movimiento en cuenta corriente para cobro a cuenta
        await base44.entities.CuentaCorriente.create({
          fecha: cobroData.fecha,
          tipo_movimiento: 'Debe',
          entidad_tipo: 'Cliente',
          entidad_id: cobroData.cliente_id,
          entidad_nombre: cobroData.cliente_nombre,
          monto: cobroData.monto_total,
          saldo_resultante: 0,
          concepto: `Cobro a cuenta - ${cobroData.concepto}`,
          comprobante_id: cobro.id,
          comprobante_tipo: 'Cobro'
        });
        await actualizarSaldoEntidad(base44, 'Cliente', cobroData.cliente_id, -cobroData.monto_total);

        // Recalcular saldos resultantes en filas de CC
        await recalcularSaldosEntidad(base44, cobroData.cliente_id, 'Cliente');
      }

      // 4. Procesar retenciones si existen
      if (cobroData.retenciones && cobroData.retenciones.length > 0) {
        for (const retencion of cobroData.retenciones) {
          // Crear movimiento en cuenta corriente por retención
          await base44.entities.CuentaCorriente.create({
            fecha: cobroData.fecha,
            tipo_movimiento: 'Debe',
            entidad_tipo: 'Cliente',
            entidad_id: cobroData.cliente_id,
            entidad_nombre: cobroData.cliente_nombre,
            monto: retencion.monto,
            saldo_resultante: 0,
            concepto: `Retención: ${retencion.tipo_retencion}`,
            comprobante_id: cobro.id,
            comprobante_tipo: 'Retencion'
          });
          await actualizarSaldoEntidad(base44, 'Cliente', cobroData.cliente_id, -retencion.monto);
        }

        // Recalcular saldos resultantes en filas de CC
        await recalcularSaldosEntidad(base44, cobroData.cliente_id, 'Cliente');
      }

      return cobro;
    },
    onSuccess: async (cobro) => {
      // Recalcular saldos de cuenta corriente del cliente (ya se hizo en mutationFn, pero por seguridad)
      if (cobro.cliente_id) {
        await recalcularSaldosEntidad(base44, cobro.cliente_id, 'Cliente');
      }
      
      // Invalidar todas las queries del sistema
      invalidarTodoElSistema(queryClient);
      
      toast.success('Cobro registrado exitosamente');
      setModalCobroOpen(false);
    },
    onError: (error) => {
      console.error('Error al guardar cobro:', error);
      toast.error('Error al registrar el cobro');
    }
  });

  // Función para confirmar borrado con PIN
  const confirmarBorradoCobro = () => {
    if (!deleteDialog.cobro) return;
    askPin(
      () => deleteCobroMutation.mutate(deleteDialog.cobro),
      'Confirmar eliminación de cobro'
    );
  };

  // Filtrar cobros que tienen movimientos de tesorería vinculados y por nombre de cliente
  const cobrosValidos = cobros.filter(cobro => {
    const tieneMovimientos = movimientosTesoreria.some(m => 
      m.referencia_origen_id === cobro.id && m.referencia_origen_tipo === 'Cobro'
    );
    const cumpleFiltro = !filtroCliente || 
      (cobro.cliente_nombre && cobro.cliente_nombre.toLowerCase().includes(filtroCliente.toLowerCase()));
    return tieneMovimientos && cumpleFiltro;
  });

  const totalCobros = cobrosValidos.reduce((sum, c) => sum + (c.monto_total || 0), 0);
  const cobrosAplicados = cobrosValidos.filter(c => c.tipo_cobro === 'Aplicado').length;
  const cobrosACuenta = cobrosValidos.filter(c => c.tipo_cobro === 'A Cuenta').length;

  // Paginación
  const totalPaginas = Math.ceil(cobrosValidos.length / registrosPorPagina);
  const cobrosPaginados = cobrosValidos.slice(
    (paginaActual - 1) * registrosPorPagina,
    paginaActual * registrosPorPagina
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Receipt className="h-8 w-8 text-purple-600" />
              Cobros a Clientes
            </h1>
            <p className="text-slate-500 mt-1">Registra y gestiona cobros</p>
          </div>
          <Button onClick={() => setModalCobroOpen(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Cobro
          </Button>
        </div>

        {/* Filtro */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por nombre de cliente..."
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Cobrado</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ${totalCobros.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <DollarSign className="h-10 w-10 text-purple-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Cobros</p>
                  <p className="text-2xl font-bold text-slate-600">{cobrosValidos.length}</p>
                </div>
                <FileText className="h-10 w-10 text-slate-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Cobros Aplicados</p>
                  <p className="text-2xl font-bold text-green-600">{cobrosAplicados}</p>
                </div>
                <FileText className="h-10 w-10 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">A Cuenta</p>
                  <p className="text-2xl font-bold text-blue-600">{cobrosACuenta}</p>
                </div>
                <FileText className="h-10 w-10 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Cobros */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : cobrosValidos.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Receipt className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay cobros registrados</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {cobrosPaginados.map(cobro => (
                <Card key={cobro.id} className="hover:shadow-sm transition-shadow border-l-4 border-l-purple-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-sm text-slate-500 min-w-[90px]">
                          {cobro.fecha ? format(new Date(cobro.fecha), "dd/MM/yyyy", { locale: es }) : '-'}
                        </div>
                        
                        <Badge variant="outline" className={cobro.tipo_cobro === 'Aplicado' ? 'text-green-700 border-green-300' : 'text-blue-700 border-blue-300'}>
                          {cobro.tipo_cobro}
                        </Badge>

                        <div className="flex-1">
                          <div className="font-semibold text-slate-900">{cobro.cliente_nombre}</div>
                          <div className="text-sm text-slate-600">{cobro.concepto}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xl font-bold text-purple-600">
                            ${(cobro.monto_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </div>
                          {cobro.tipo_cobro === 'A Cuenta' && cobro.monto_disponible > 0 && (
                            <div className="text-xs text-blue-600">
                              Disp: ${cobro.monto_disponible.toLocaleString('es-AR')}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteDialog({ open: true, cobro })}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {hasMoreCobros && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchMoreCobros()}
                  disabled={loadingMoreCobros}
                >
                  {loadingMoreCobros ? 'Cargando...' : 'Cargar más cobros'}
                </Button>
              </div>
            )}

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-slate-600">
                  Mostrando {((paginaActual - 1) * registrosPorPagina) + 1} - {Math.min(paginaActual * registrosPorPagina, cobrosValidos.length)} de {cobrosValidos.length} cobros
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                    disabled={paginaActual === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                      let pageNum;
                      if (totalPaginas <= 5) {
                        pageNum = i + 1;
                      } else if (paginaActual <= 3) {
                        pageNum = i + 1;
                      } else if (paginaActual >= totalPaginas - 2) {
                        pageNum = totalPaginas - 4 + i;
                      } else {
                        pageNum = paginaActual - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={paginaActual === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPaginaActual(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual >= totalPaginas}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Alert Dialog para eliminar */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, cobro: deleteDialog.cobro })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este cobro?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Esta acción eliminará el cobro y revertirá todos los cambios asociados:</p>
                {deleteDialog.cobro && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                    <p className="font-semibold text-amber-900 mb-2">Cliente: {deleteDialog.cobro.cliente_nombre}</p>
                    <p className="text-slate-700">Concepto: {deleteDialog.cobro.concepto}</p>
                    <p className="text-slate-700">Monto: <strong>${(deleteDialog.cobro.monto_total || 0).toLocaleString('es-AR')}</strong></p>
                    <p className="text-slate-700 mt-2">Se revertirán saldos de cajas/bancos, estados de salidas y cuenta corriente.</p>
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">Esta acción no se puede deshacer.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteCobroMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmarBorradoCobro}
                disabled={deleteCobroMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteCobroMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  'Sí, Eliminar Cobro'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal Nuevo Cobro */}
        <CobroConSalidasModal
          open={modalCobroOpen}
          onClose={() => setModalCobroOpen(false)}
          onSave={(cobroData) => guardarCobroMutation.mutate(cobroData)}
          isLoading={guardarCobroMutation.isPending}
          clientes={[]}
          salidas={salidas}
          cajas={cajas}
          bancos={bancos}
          cheques={cheques}
        />

        {/* Modal de PIN para operaciones protegidas */}
        <PinGuardModal />
      </div>
    </div>
  );
}