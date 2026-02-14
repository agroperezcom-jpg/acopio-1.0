import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { HandCoins, Plus, Loader2, Calendar, Building2, DollarSign, FileText, Trash2, Search, ChevronLeft, ChevronRight, FileCheck, Download } from 'lucide-react';
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
import { base44 } from '@/api/base44Client';
import { escapeRegex } from '@/lib/utils';
import { invalidarTodoElSistema } from '@/utils/queryHelpers';
import { recalcularSaldosEntidad, actualizarSaldoEntidad } from '@/utils/contabilidad';
import { usePinGuard } from '@/hooks/usePinGuard';
import PagoConIngresosModal from '@/components/tesoreria/PagoConIngresosModal';
import ImputarPagoModal from '@/components/tesoreria/ImputarPagoModal';
import { generarOrdenDePagoPDF } from '@/components/tesoreria/OrdenDePagoPDF';

export default function Pagos() {
  const queryClient = useQueryClient();
  const { askPin, PinGuardModal } = usePinGuard();
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, pago: null });
  const [imputarDialog, setImputarDialog] = useState({ open: false, pago: null });
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const registrosPorPagina = 20;

  const PAGE_SIZE = 20;

  const queryPagos = React.useMemo(() => {
    const trimmed = filtroProveedor?.trim();
    if (!trimmed) return {};
    return { proveedor_nombre: { $regex: escapeRegex(trimmed), $options: 'i' } };
  }, [filtroProveedor]);

  const {
    data: pagosData,
    fetchNextPage: fetchMorePagos,
    hasNextPage: hasMorePagos,
    isFetchingNextPage: loadingMorePagos,
    isLoading
  } = useInfiniteQuery({
    queryKey: ['pagos-infinite', filtroProveedor],
    queryFn: ({ pageParam = 0 }) => {
      if (Object.keys(queryPagos).length === 0) {
        return base44.entities.Pago.list('-fecha', PAGE_SIZE, pageParam);
      }
      return base44.entities.Pago.filter(queryPagos, '-fecha', PAGE_SIZE, pageParam);
    },
    getNextPageParam: (lastPage, allPages) =>
      (lastPage?.length ?? 0) === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const pagos = React.useMemo(() => pagosData?.pages?.flat() ?? [], [pagosData]);

  const { data: movimientos = [] } = useQuery({
    queryKey: ['movimientos'],
    queryFn: () => base44.entities.Movimiento.list('-fecha', 50),
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

  const { data: movimientosTesoreria = [] } = useQuery({
    queryKey: ['movimientostesoreria'],
    queryFn: () => base44.entities.MovimientoTesoreria.list('-fecha', 50),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const deletePagoMutation = useMutation({
    mutationFn: async (pago) => {
      // Buscar TODOS los MovimientoTesoreria vinculados a este pago
      const movimientosVinculados = movimientosTesoreria.filter(m => 
        m.referencia_origen_id === pago.id && m.referencia_origen_tipo === 'Pago'
      );

      // Revertir saldos de todos los medios de pago
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
      }

      // Revertir estados de ingresos aplicados
      if (pago.ingresos_aplicados && pago.ingresos_aplicados.length > 0) {
        for (const aplicado of pago.ingresos_aplicados) {
          const movimientoIngreso = movimientos.find(m => m.id === aplicado.movimiento_id);
          if (movimientoIngreso) {
            const nuevoMontoPagado = (movimientoIngreso.monto_pagado || 0) - aplicado.monto_aplicado;
            let nuevoEstado = 'Pendiente';
            if (nuevoMontoPagado >= (movimientoIngreso.deuda_total || 0)) {
              nuevoEstado = 'Pagado';
            } else if (nuevoMontoPagado > 0) {
              nuevoEstado = 'Pago Parcial';
            }
            await base44.entities.Movimiento.update(aplicado.movimiento_id, {
              monto_pagado: nuevoMontoPagado,
              estado_pago: nuevoEstado
            });
          }
        }
      }

      // Eliminar movimientos de cuenta corriente relacionados (revertir saldo_actual antes)
      const movsCCPago = await base44.entities.CuentaCorriente.filter({
        comprobante_tipo: 'Pago',
        comprobante_id: pago.id
      });
      for (const movCC of movsCCPago) {
        await actualizarSaldoEntidad(base44, 'Proveedor', pago.proveedor_id, movCC.monto || 0);
        await base44.entities.CuentaCorriente.delete(movCC.id);
      }

      // Recalcular saldos resultantes en filas de CC del proveedor
      await recalcularSaldosEntidad(base44, pago.proveedor_id, 'Proveedor');

      // Revertir estado de cheques propios entregados
      const chequesVinculados = cheques.filter(ch => 
        ch.origen_movimiento_id === pago.id && ch.origen_movimiento_tipo === 'Pago'
      );
      for (const cheque of chequesVinculados) {
        await base44.entities.Cheque.update(cheque.id, {
          estado: 'Disponible',
          origen_movimiento_id: null,
          origen_movimiento_tipo: null
        });
      }

      // TODO: Implementar borrado seguro cuando exista un campo de enlace (pago_id). No queremos borrar egresos adivinando.
      // (Al crear el pago se registra un Egreso para Estado de Resultados; sin pago_id en Egreso no hay forma segura de identificarlo.)

      // Eliminar todos los movimientos de tesorería vinculados
      for (const mov of movimientosVinculados) {
        await base44.entities.MovimientoTesoreria.delete(mov.id);
      }

      // Eliminar el pago
      await base44.entities.Pago.delete(pago.id);
      
      return pago;
    },
    onSuccess: () => {
      // Invalidar todas las queries del sistema
      invalidarTodoElSistema(queryClient);
      
      toast.success('Pago eliminado completamente');
      setDeleteDialog({ open: false, pago: null });
    },
    onError: (error) => {
      console.error('Error al eliminar pago:', error);
      toast.error('Error al eliminar el pago');
    }
  });

  const guardarPagoMutation = useMutation({
    mutationFn: async (pagoData) => {
      // Obtener proveedor
      const proveedor = proveedores.find(p => p.id === pagoData.proveedor_id);
      if (!proveedor) throw new Error('Proveedor no encontrado');

      // Preparar medios de pago detallados
      let mediosPago = [];
      
      if (pagoData._mediosMixtos && pagoData._mediosMixtos.length > 0) {
        mediosPago = pagoData._mediosMixtos;
      } else if (pagoData._chequesSeleccionados && pagoData._chequesSeleccionados.length > 0) {
        // Procesar cheques: crear nuevos si es necesario
        for (const ch of pagoData._chequesSeleccionados) {
          if (ch.tipo === 'nuevo') {
            const nuevoCheque = await base44.entities.Cheque.create({
              numero_cheque: ch.numero_cheque,
              tipo: 'Propio',
              banco_id: ch.banco_id,
              banco_nombre: ch.banco_nombre,
              fecha_emision: ch.fecha_emision || format(new Date(), 'yyyy-MM-dd'),
              fecha_pago: ch.fecha_pago || format(new Date(), 'yyyy-MM-dd'),
              monto: ch.monto,
              beneficiario: ch.beneficiario || proveedor.nombre,
              emisor: 'Empresa',
              estado: 'Entregado'
            });
            
            mediosPago.push({
              tipo: 'Cheque',
              origen_tipo: 'Cheque',
              origen_id: null,
              origen_nombre: 'Cheque',
              cheque_id: nuevoCheque.id,
              monto: ch.monto
            });
          } else if (ch.tipo === 'existente') {
            const chequeData = cheques.find(c => c.id === ch.cheque_id);
            mediosPago.push({
              tipo: 'Cheque',
              origen_tipo: 'Cheque',
              origen_id: null,
              origen_nombre: 'Cheque',
              cheque_id: ch.cheque_id,
              monto: chequeData?.monto || 0
            });
          }
        }
      } else {
        // Efectivo o Transferencia simple
        const origen = pagoData.origen_tipo === 'Banco' 
          ? bancos.find(b => b.id === pagoData.origen_id)
          : cajas.find(c => c.id === pagoData.origen_id);
        
        mediosPago.push({
          tipo: pagoData.forma_pago,
          origen_tipo: pagoData.origen_tipo,
          origen_id: pagoData.origen_id,
          origen_nombre: origen?.nombre || '',
          monto: pagoData.monto_total
        });
      }

      // 1. Crear el pago con medios detallados
      const pago = await base44.entities.Pago.create({
        fecha: pagoData.fecha,
        tipo_pago: pagoData.tipo_pago,
        proveedor_id: pagoData.proveedor_id,
        proveedor_nombre: proveedor.nombre,
        monto_total: pagoData.monto_total,
        concepto: pagoData.concepto,
        comprobante: pagoData.comprobante,
        notas: pagoData.notas,
        medios_pago_detalles: mediosPago,
        ingresos_aplicados: pagoData.ingresos_aplicados || [],
        monto_disponible: pagoData.monto_disponible || 0
      });

      // 1.5. Registrar en Egresos para Estado de Resultados
      if (pagoData.cuenta_contable_id) {
        await base44.entities.Egreso.create({
          fecha: pagoData.fecha,
          tipo: 'Costo',
          clasificacion: 'Variable',
          cuenta_id: pagoData.cuenta_contable_id,
          cuenta_codigo: pagoData.cuenta_contable_codigo || '',
          cuenta_nombre: pagoData.cuenta_contable_nombre,
          concepto: pagoData.concepto || `Pago a ${proveedor.nombre}`,
          monto: pagoData.monto_total,
          forma_pago: 'Transferencia',
          origen_tipo: 'Banco',
          origen_id: '',
          origen_nombre: '',
          proveedor_id: pagoData.proveedor_id,
          proveedor_nombre: proveedor.nombre,
          comprobante: pagoData.comprobante || '',
          notas: `Pago registrado automáticamente desde tesorería - ID: ${pago.id}`
        });
      }

      // 2. Procesar medios de pago: actualizar saldos y crear movimientos de tesorería
      for (const medio of mediosPago) {
        if (medio.origen_tipo === 'Caja' && medio.origen_id) {
          const caja = cajas.find(c => c.id === medio.origen_id);
          if (caja) {
            await base44.entities.Caja.update(medio.origen_id, {
              saldo: (caja.saldo || 0) - medio.monto
            });
          }
        } else if (medio.origen_tipo === 'Banco' && medio.origen_id) {
          const banco = bancos.find(b => b.id === medio.origen_id);
          if (banco) {
            await base44.entities.Banco.update(medio.origen_id, {
              saldo: (banco.saldo || 0) - medio.monto
            });
          }
        }

        // Crear movimiento de tesorería
        await base44.entities.MovimientoTesoreria.create({
          fecha: pagoData.fecha,
          tipo_movimiento: 'Egreso Manual',
          origen_tipo: medio.origen_tipo,
          origen_id: medio.origen_id,
          origen_nombre: medio.origen_nombre,
          monto: medio.monto,
          concepto: `Pago a ${proveedor.nombre} - ${pagoData.concepto}`,
          comprobante: pagoData.comprobante,
          referencia_origen_id: pago.id,
          referencia_origen_tipo: 'Pago'
        });

        // Si es cheque propio, actualizar estado
        if (medio.tipo === 'Cheque' && medio.cheque_id) {
          await base44.entities.Cheque.update(medio.cheque_id, {
            estado: 'Entregado',
            origen_movimiento_id: pago.id,
            origen_movimiento_tipo: 'Pago'
          });
        }
      }

      // 3. Actualizar movimientos aplicados y crear movimientos en cuenta corriente
      if (pagoData.tipo_pago === 'Aplicado' && pagoData.ingresos_aplicados) {
        for (const aplicado of pagoData.ingresos_aplicados) {
          const movimiento = movimientos.find(m => m.id === aplicado.movimiento_id);
          if (movimiento) {
            const nuevoMontoPagado = (movimiento.monto_pagado || 0) + aplicado.monto_aplicado;
            const deudaTotal = movimiento.deuda_total || 0;
            
            let nuevoEstado = 'Pendiente';
            if (nuevoMontoPagado >= deudaTotal) {
              nuevoEstado = 'Pagado';
            } else if (nuevoMontoPagado > 0) {
              nuevoEstado = 'Pago Parcial';
            }

            await base44.entities.Movimiento.update(aplicado.movimiento_id, {
              monto_pagado: nuevoMontoPagado,
              estado_pago: nuevoEstado
            });

            // Crear movimiento en cuenta corriente (Debe = disminuye deuda)
            await base44.entities.CuentaCorriente.create({
              fecha: pagoData.fecha,
              tipo_movimiento: 'Debe',
              entidad_tipo: 'Proveedor',
              entidad_id: pagoData.proveedor_id,
              entidad_nombre: proveedor.nombre,
              monto: aplicado.monto_aplicado,
              saldo_resultante: 0,
              concepto: `Pago aplicado a ingreso de fruta`,
              comprobante_id: pago.id,
              comprobante_tipo: 'Pago'
            });
            await actualizarSaldoEntidad(base44, 'Proveedor', pagoData.proveedor_id, -aplicado.monto_aplicado);
          }
        }

        // Recalcular saldos resultantes en filas de CC
        await recalcularSaldosEntidad(base44, pagoData.proveedor_id, 'Proveedor');
      } else if (pagoData.tipo_pago === 'A Cuenta') {
        // Crear movimiento en cuenta corriente para pago a cuenta
        await base44.entities.CuentaCorriente.create({
          fecha: pagoData.fecha,
          tipo_movimiento: 'Debe',
          entidad_tipo: 'Proveedor',
          entidad_id: pagoData.proveedor_id,
          entidad_nombre: proveedor.nombre,
          monto: pagoData.monto_total,
          saldo_resultante: 0,
          concepto: `Pago a cuenta - ${pagoData.concepto}`,
          comprobante_id: pago.id,
          comprobante_tipo: 'Pago'
        });
        await actualizarSaldoEntidad(base44, 'Proveedor', pagoData.proveedor_id, -pagoData.monto_total);

        // Recalcular saldos resultantes en filas de CC
        await recalcularSaldosEntidad(base44, pagoData.proveedor_id, 'Proveedor');
      }

      return pago;
    },
    onSuccess: async (pago) => {
      // Recalcular saldos de cuenta corriente del proveedor (ya se hizo en mutationFn, pero por seguridad)
      if (pago.proveedor_id) {
        await recalcularSaldosEntidad(base44, pago.proveedor_id, 'Proveedor');
      }
      
      // Invalidar todas las queries del sistema
      invalidarTodoElSistema(queryClient);
      
      toast.success('Pago registrado exitosamente');
      setModalPagoOpen(false);
    },
    onError: (error) => {
      console.error('Error al guardar pago:', error);
      toast.error('Error al registrar el pago');
    }
  });

  const imputarPagoMutation = useMutation({
    mutationFn: async ({ pago, imputaciones }) => {
      // Actualizar cada movimiento aplicado
      for (const imputacion of imputaciones) {
        const movimiento = movimientos.find(m => m.id === imputacion.movimiento_id);
        if (movimiento) {
          const nuevoMontoPagado = (movimiento.monto_pagado || 0) + imputacion.monto;
          const deudaTotal = movimiento.deuda_total || 0;
          
          let nuevoEstado = 'Pendiente';
          if (nuevoMontoPagado >= deudaTotal) {
            nuevoEstado = 'Pagado';
          } else if (nuevoMontoPagado > 0) {
            nuevoEstado = 'Pago Parcial';
          }

          await base44.entities.Movimiento.update(imputacion.movimiento_id, {
            monto_pagado: nuevoMontoPagado,
            estado_pago: nuevoEstado
          });

          // Crear movimiento en cuenta corriente
          await base44.entities.CuentaCorriente.create({
            fecha: pago.fecha,
            tipo_movimiento: 'Debe',
            entidad_tipo: 'Proveedor',
            entidad_id: pago.proveedor_id,
            entidad_nombre: pago.proveedor_nombre,
            monto: imputacion.monto,
            saldo_resultante: 0,
            concepto: `Pago imputado a ingreso de fruta`,
            comprobante_id: pago.id,
            comprobante_tipo: 'Pago'
          });
          await actualizarSaldoEntidad(base44, 'Proveedor', pago.proveedor_id, -imputacion.monto);
        }
      }

      // Actualizar el pago
      const ingresosPrevios = pago.ingresos_aplicados || [];
      const nuevoMontoDisponible = (pago.monto_disponible || 0) - imputaciones.reduce((sum, i) => sum + i.monto, 0);
      
      // Normalizar imputaciones para que tengan ambos campos (compatibilidad PDF)
      const imputacionesNormalizadas = imputaciones.map(imp => ({
        movimiento_id: imp.movimiento_id,
        monto: imp.monto,
        monto_aplicado: imp.monto  // Para compatibilidad
      }));
      
      await base44.entities.Pago.update(pago.id, {
        ingresos_aplicados: [...ingresosPrevios, ...imputacionesNormalizadas],
        monto_disponible: nuevoMontoDisponible,
        tipo_pago: nuevoMontoDisponible > 0 ? 'A Cuenta' : 'Aplicado'
      });

      // Recalcular saldos de cuenta corriente
      const todosMovCC = await base44.entities.CuentaCorriente.list();
      const movsCCProveedor = todosMovCC
        .filter(m => m.entidad_id === pago.proveedor_id && m.entidad_tipo === 'Proveedor')
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      let saldoAcumulado = 0;
      for (const m of movsCCProveedor) {
        if (m.tipo_movimiento === 'Haber') {
          saldoAcumulado += m.monto;
        } else {
          saldoAcumulado -= m.monto;
        }
        await base44.entities.CuentaCorriente.update(m.id, {
          saldo_resultante: saldoAcumulado
        });
      }
    },
    onSuccess: async (_, variables) => {
      // Recalcular saldos de cuenta corriente del proveedor
      if (variables.pago?.proveedor_id) {
        await recalcularSaldosEntidad(base44, variables.pago.proveedor_id, 'Proveedor');
      }
      
      // Invalidar todas las queries del sistema
      invalidarTodoElSistema(queryClient);
      
      toast.success('Pago imputado exitosamente');
      setImputarDialog({ open: false, pago: null });
    },
    onError: (error) => {
      console.error('Error al imputar pago:', error);
      toast.error('Error al imputar el pago');
    }
  });

  // Función para confirmar borrado con PIN
  const confirmarBorradoPago = () => {
    if (!deleteDialog.pago) return;
    askPin(
      () => deletePagoMutation.mutate(deleteDialog.pago),
      'Confirmar eliminación de pago'
    );
  };

  const handleDescargarOrdenPago = (pago) => {
    const proveedor = proveedores.find(p => p.id === pago.proveedor_id);
    if (!proveedor) {
      toast.error('Proveedor no encontrado');
      return;
    }
    generarOrdenDePagoPDF(pago, proveedor);
    toast.success('Orden de pago descargada');
  };

  // Filtrar pagos que tienen movimientos de tesorería vinculados y por nombre de proveedor
  const pagosValidos = pagos.filter(pago => {
    const tieneMovimientos = movimientosTesoreria.some(m => 
      m.referencia_origen_id === pago.id && m.referencia_origen_tipo === 'Pago'
    );
    const cumpleFiltro = !filtroProveedor || 
      (pago.proveedor_nombre && pago.proveedor_nombre.toLowerCase().includes(filtroProveedor.toLowerCase()));
    return tieneMovimientos && cumpleFiltro;
  });

  const totalPagos = pagosValidos.reduce((sum, p) => sum + (p.monto_total || 0), 0);
  const pagosAplicados = pagosValidos.filter(p => p.tipo_pago === 'Aplicado').length;
  const pagosACuenta = pagosValidos.filter(p => p.tipo_pago === 'A Cuenta').length;

  // Paginación
  const totalPaginas = Math.ceil(pagosValidos.length / registrosPorPagina);
  const pagosPaginados = pagosValidos.slice(
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
              <HandCoins className="h-8 w-8 text-orange-600" />
              Pagos a Proveedores
            </h1>
            <p className="text-slate-500 mt-1">Registra y gestiona pagos</p>
          </div>
          <Button onClick={() => setModalPagoOpen(true)} className="bg-orange-600 hover:bg-orange-700">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Pago
          </Button>
        </div>

        {/* Filtro */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por nombre de proveedor..."
              value={filtroProveedor}
              onChange={(e) => setFiltroProveedor(e.target.value)}
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
                  <p className="text-sm text-slate-500">Total Pagado</p>
                  <p className="text-2xl font-bold text-orange-600">
                    ${(totalPagos || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <DollarSign className="h-10 w-10 text-orange-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Pagos</p>
                  <p className="text-2xl font-bold text-slate-600">{pagosValidos.length}</p>
                </div>
                <FileText className="h-10 w-10 text-slate-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Pagos Aplicados</p>
                  <p className="text-2xl font-bold text-green-600">{pagosAplicados}</p>
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
                  <p className="text-2xl font-bold text-blue-600">{pagosACuenta}</p>
                </div>
                <FileText className="h-10 w-10 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Pagos */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          </div>
        ) : pagosValidos.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <HandCoins className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay pagos registrados</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {pagosPaginados.map(pago => (
                <Card key={pago.id} className="hover:shadow-sm transition-shadow border-l-4 border-l-orange-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-sm text-slate-500 min-w-[90px]">
                          {pago.fecha ? format(new Date(pago.fecha), "dd/MM/yyyy", { locale: es }) : '-'}
                        </div>
                        
                        <Badge variant="outline" className={pago.tipo_pago === 'Aplicado' ? 'text-green-700 border-green-300' : 'text-blue-700 border-blue-300'}>
                          {pago.tipo_pago}
                        </Badge>

                        <div className="flex-1">
                          <div className="font-semibold text-slate-900">{pago.proveedor_nombre}</div>
                          <div className="text-sm text-slate-600">{pago.concepto}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-xl font-bold text-orange-600">
                            ${(pago.monto_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </div>
                          {pago.tipo_pago === 'A Cuenta' && pago.monto_disponible > 0 && (
                            <div className="text-xs text-blue-600">
                              Disp: ${(pago.monto_disponible || 0).toLocaleString('es-AR')}
                            </div>
                          )}
                        </div>
                        
                        {pago.tipo_pago === 'A Cuenta' && pago.monto_disponible > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setImputarDialog({ open: true, pago })}
                            className="text-blue-600 hover:text-blue-700"
                            title="Imputar a comprobantes"
                          >
                            <FileCheck className="h-4 w-4" />
                          </Button>
                        )}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDescargarOrdenPago(pago)}
                          className="text-green-600 hover:text-green-700"
                          title="Descargar Orden de Pago"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteDialog({ open: true, pago })}
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

            {hasMorePagos && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchMorePagos()}
                  disabled={loadingMorePagos}
                >
                  {loadingMorePagos ? 'Cargando...' : 'Cargar más pagos'}
                </Button>
              </div>
            )}

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-slate-600">
                  Mostrando {((paginaActual - 1) * registrosPorPagina) + 1} - {Math.min(paginaActual * registrosPorPagina, pagosValidos.length)} de {pagosValidos.length} pagos
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
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, pago: deleteDialog.pago })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este pago?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Esta acción eliminará el pago y revertirá todos los cambios asociados:</p>
                {deleteDialog.pago && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                    <p className="font-semibold text-amber-900 mb-2">Proveedor: {deleteDialog.pago.proveedor_nombre}</p>
                    <p className="text-slate-700">Concepto: {deleteDialog.pago.concepto}</p>
                    <p className="text-slate-700">Monto: <strong>${(deleteDialog.pago.monto_total || 0).toLocaleString('es-AR')}</strong></p>
                    <p className="text-slate-700 mt-2">Se revertirán saldos de cajas/bancos, estados de ingresos y cuenta corriente.</p>
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">Esta acción no se puede deshacer.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletePagoMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmarBorradoPago}
                disabled={deletePagoMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deletePagoMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  'Sí, Eliminar Pago'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal Nuevo Pago */}
        <PagoConIngresosModal
          open={modalPagoOpen}
          onClose={() => setModalPagoOpen(false)}
          onSave={(pagoData) => guardarPagoMutation.mutate(pagoData)}
          isLoading={guardarPagoMutation.isPending}
          proveedores={[]}
          movimientos={movimientos}
          cajas={cajas}
          bancos={bancos}
          cheques={cheques}
        />

        {/* Modal Imputar Pago */}
        <ImputarPagoModal
          open={imputarDialog.open}
          pago={imputarDialog.pago}
          movimientos={movimientos}
          onClose={() => setImputarDialog({ open: false, pago: null })}
          onImputar={(imputaciones) => imputarPagoMutation.mutate({ pago: imputarDialog.pago, imputaciones })}
          isLoading={imputarPagoMutation.isPending}
        />

        {/* Modal de PIN para operaciones protegidas */}
        <PinGuardModal />
      </div>
    </div>
  );
}