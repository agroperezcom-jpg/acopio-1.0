import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
import SearchableSelect from '@/components/SearchableSelect';
import ExportarMovimientosModal from '@/components/tesoreria/ExportarMovimientosModal';
import ExportarMovimientosPDFModal from '@/components/tesoreria/ExportarMovimientosPDFModal';
import EditarFechaMovimientoModal from '@/components/tesoreria/EditarFechaMovimientoModal';
import { usePinGuard } from '@/hooks/usePinGuard';
import { ArrowLeftRight, Plus, Loader2, Calendar, DollarSign, TrendingUp, TrendingDown, Trash2, FileDown, FileText, Filter, ChevronLeft, ChevronRight, Edit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { actualizarSaldoEntidad } from '@/utils/contabilidad';

export default function MovimientosTesoreria() {
  const queryClient = useQueryClient();
  const { askPin, PinGuardModal } = usePinGuard();
  const [modalOpen, setModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [editarFechaModal, setEditarFechaModal] = useState({ open: false, movimiento: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, movimiento: null });
  
  // Estados de paginación y filtros
  const [pagina, setPagina] = useState(1);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroOrigen, setFiltroOrigen] = useState('todos');
  const ITEMS_POR_PAGINA = 20;
  const [formData, setFormData] = useState({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    tipo_movimiento: 'Transferencia Interna',
    origen_tipo: 'Caja',
    origen_id: '',
    destino_tipo: 'Banco',
    destino_id: '',
    monto: 0,
    concepto: '',
    comprobante: ''
  });

  // Consulta paginada con filtros
  const { data: movimientos = [], isLoading } = useQuery({
    queryKey: ['movimientostesoreria', pagina, filtroTipo, filtroOrigen],
    queryFn: async () => {
      let query = {};
      
      // Aplicar filtros
      if (filtroTipo !== 'todos') {
        if (filtroTipo === 'ingresos') {
          query.tipo_movimiento = { $in: ['Ingreso Manual', 'Crédito Bancario'] };
        } else if (filtroTipo === 'egresos') {
          query.tipo_movimiento = { $in: ['Egreso Manual', 'Débito Bancario'] };
        } else if (filtroTipo === 'transferencias') {
          query.tipo_movimiento = 'Transferencia Interna';
        }
      }
      
      if (filtroOrigen !== 'todos') {
        if (filtroOrigen === 'cobros') {
          query.referencia_origen_tipo = 'Cobro';
        } else if (filtroOrigen === 'pagos') {
          query.referencia_origen_tipo = 'Pago';
        } else if (filtroOrigen === 'ingresos_varios') {
          query.referencia_origen_tipo = 'IngresoVario';
        } else if (filtroOrigen === 'egresos_varios') {
          query.referencia_origen_tipo = 'Egreso';
        }
      }
      
      const skip = (pagina - 1) * ITEMS_POR_PAGINA;
      return base44.entities.MovimientoTesoreria.filter(query, '-fecha', ITEMS_POR_PAGINA, skip);
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Consulta para contar total de movimientos (para paginación)
  const { data: totalMovimientos = 0 } = useQuery({
    queryKey: ['movimientostesoreria-count', filtroTipo, filtroOrigen],
    queryFn: async () => {
      let query = {};
      
      if (filtroTipo !== 'todos') {
        if (filtroTipo === 'ingresos') {
          query.tipo_movimiento = { $in: ['Ingreso Manual', 'Crédito Bancario'] };
        } else if (filtroTipo === 'egresos') {
          query.tipo_movimiento = { $in: ['Egreso Manual', 'Débito Bancario'] };
        } else if (filtroTipo === 'transferencias') {
          query.tipo_movimiento = 'Transferencia Interna';
        }
      }
      
      if (filtroOrigen !== 'todos') {
        if (filtroOrigen === 'cobros') {
          query.referencia_origen_tipo = 'Cobro';
        } else if (filtroOrigen === 'pagos') {
          query.referencia_origen_tipo = 'Pago';
        } else if (filtroOrigen === 'ingresos_varios') {
          query.referencia_origen_tipo = 'IngresoVario';
        } else if (filtroOrigen === 'egresos_varios') {
          query.referencia_origen_tipo = 'Egreso';
        }
      }
      
      const todos = await base44.entities.MovimientoTesoreria.filter(query);
      return todos.length;
    },
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

  const { data: cobros = [] } = useQuery({
    queryKey: ['cobros'],
    queryFn: () => base44.entities.Cobro.list('-fecha', 50),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: pagos = [] } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => base44.entities.Pago.list('-fecha', 50),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: ingresosVarios = [] } = useQuery({
    queryKey: ['ingresosvarios'],
    queryFn: () => base44.entities.IngresoVario.list('-fecha', 50),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: egresosVarios = [] } = useQuery({
    queryKey: ['egresos'],
    queryFn: () => base44.entities.Egreso.list('-fecha', 50),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: salidas = [] } = useQuery({
    queryKey: ['salidas'],
    queryFn: () => base44.entities.SalidaFruta.list('-fecha', 50),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: movimientosIngresos = [] } = useQuery({
    queryKey: ['movimientos'],
    queryFn: () => base44.entities.Movimiento.list('-fecha', 50),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const deleteMutation = useMutation({
    mutationFn: async (movimiento) => {
      // ═══════════════════════════════════════════════════════════
      // ELIMINACIÓN COMPLETA EN CASCADA DE COBROS
      // ═══════════════════════════════════════════════════════════
      if (movimiento.referencia_origen_id && movimiento.referencia_origen_tipo) {
        if (movimiento.referencia_origen_tipo === 'Cobro') {
          const cobro = cobros.find(c => c.id === movimiento.referencia_origen_id);
          if (!cobro) {
            console.warn('Cobro no encontrado, solo eliminando MovimientoTesoreria');
            await base44.entities.MovimientoTesoreria.delete(movimiento.id);
            return;
          }

          console.log('🗑️ INICIANDO ELIMINACIÓN TOTAL DEL COBRO:', cobro.id);

          // PASO 1: Buscar TODOS los MovimientoTesoreria vinculados
          const movimientosVinculados = movimientos.filter(m => 
            m.referencia_origen_id === cobro.id && m.referencia_origen_tipo === 'Cobro'
          );
          console.log('📋 Movimientos vinculados a eliminar:', movimientosVinculados.length);

          // PASO 2: Revertir saldos de cajas/bancos (deshacer ingresos)
          for (const mov of movimientosVinculados) {
            if (mov.destino_id && mov.destino_tipo) {
              console.log(`💰 Revirtiendo saldo en ${mov.destino_tipo}: ${mov.destino_nombre}`);
              
              if (mov.destino_tipo === 'Caja') {
                const caja = cajas.find(c => c.id === mov.destino_id);
                if (caja) {
                  const nuevoSaldo = (caja.saldo || 0) - mov.monto;
                  await base44.entities.Caja.update(mov.destino_id, { saldo: nuevoSaldo });
                  console.log(`  ✓ Caja ${caja.nombre}: $${caja.saldo} → $${nuevoSaldo}`);
                }
              } else if (mov.destino_tipo === 'Banco') {
                const banco = bancos.find(b => b.id === mov.destino_id);
                if (banco) {
                  const nuevoSaldo = (banco.saldo || 0) - mov.monto;
                  await base44.entities.Banco.update(mov.destino_id, { saldo: nuevoSaldo });
                  console.log(`  ✓ Banco ${banco.nombre}: $${banco.saldo} → $${nuevoSaldo}`);
                }
              }
            }
          }

          // PASO 3: Revertir estados de SalidaFruta (volver deudas)
          if (cobro.salidas_aplicadas && cobro.salidas_aplicadas.length > 0) {
            console.log('📦 Revirtiendo estados de salidas aplicadas:', cobro.salidas_aplicadas.length);
            
            for (const aplicado of cobro.salidas_aplicadas) {
              const salida = salidas.find(s => s.id === aplicado.salida_id);
              if (salida) {
                const montoOriginal = salida.monto_cobrado || 0;
                const nuevoMontoCobrado = montoOriginal - aplicado.monto_aplicado;
                
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
                console.log(`  ✓ Salida ${salida.numero_remito}: cobrado $${montoOriginal} → $${nuevoMontoCobrado}, estado: ${nuevoEstado}`);
              }
            }
          }

          // PASO 4: Revertir saldo_actual y eliminar registros de CuentaCorriente vinculados al cobro
          console.log('🧾 Eliminando movimientos de Cuenta Corriente del cobro...');
          const todosMovimientosCC = await base44.entities.CuentaCorriente.list();
          const movsCCCobro = todosMovimientosCC.filter(m => 
            m.comprobante_id === cobro.id && m.comprobante_tipo === 'Cobro'
          );
          
          for (const movCC of movsCCCobro) {
            await actualizarSaldoEntidad(base44, 'Cliente', cobro.cliente_id, movCC.monto || 0);
            await base44.entities.CuentaCorriente.delete(movCC.id);
            console.log(`  ✓ Eliminado movimiento CC: ${movCC.concepto} ($${movCC.monto})`);
          }

          // PASO 5: Recalcular TODOS los saldos de cuenta corriente del cliente
          console.log('🔄 Recalculando saldos de Cuenta Corriente del cliente...');
          const movsCCCliente = todosMovimientosCC
            .filter(m => 
              m.entidad_id === cobro.cliente_id && 
              m.entidad_tipo === 'Cliente' && 
              !movsCCCobro.some(mcc => mcc.id === m.id) // Excluir los que acabamos de eliminar
            )
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

          let saldoAcumulado = 0;
          for (const m of movsCCCliente) {
            if (m.tipo_movimiento === 'Haber') {
              saldoAcumulado += m.monto;
            } else {
              saldoAcumulado -= m.monto;
            }
            await base44.entities.CuentaCorriente.update(m.id, {
              saldo_resultante: saldoAcumulado
            });
          }
          console.log(`  ✓ Saldo final recalculado del cliente: $${saldoAcumulado}`);

          // PASO 6: Eliminar IngresoVario del Estado de Resultados
          console.log('📊 Eliminando registros del Estado de Resultados...');
          const ingresosRelacionados = ingresosVarios.filter(iv => 
            (iv.notas && iv.notas.includes(`ID: ${cobro.id}`)) ||
            (iv.concepto && iv.concepto.includes(cobro.concepto || ''))
          );
          
          for (const ingreso of ingresosRelacionados) {
            await base44.entities.IngresoVario.delete(ingreso.id);
            console.log(`  ✓ Eliminado IngresoVario: ${ingreso.concepto}`);
          }

          // PASO 7: Eliminar TODOS los MovimientoTesoreria vinculados
          console.log('💸 Eliminando movimientos de tesorería vinculados...');
          for (const mov of movimientosVinculados) {
            await base44.entities.MovimientoTesoreria.delete(mov.id);
            console.log(`  ✓ Eliminado MovimientoTesoreria: ${mov.concepto}`);
          }

          // PASO 8: Eliminar el COBRO definitivamente
          console.log('🔥 Eliminando el Cobro del sistema...');
          await base44.entities.Cobro.delete(cobro.id);
          console.log('✅ COBRO ELIMINADO COMPLETAMENTE DEL SISTEMA');
          
          return; // Finalizar sin ejecutar lógica adicional
        } else if (movimiento.referencia_origen_tipo === 'Pago') {
          const pago = pagos.find(p => p.id === movimiento.referencia_origen_id);
          if (pago) {
            // Buscar TODOS los MovimientoTesoreria vinculados a este pago
            const movimientosVinculados = movimientos.filter(m => 
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
                const movimientoIngreso = movimientosIngresos.find(m => m.id === aplicado.movimiento_id);
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

            // Revertir saldo_actual y eliminar movimientos de cuenta corriente relacionados
            const movimientosCC = await base44.entities.CuentaCorriente.list();
            const movsCCPago = movimientosCC.filter(m => 
              m.comprobante_id === pago.id && m.comprobante_tipo === 'Pago'
            );
            for (const movCC of movsCCPago) {
              await actualizarSaldoEntidad(base44, 'Proveedor', pago.proveedor_id, movCC.monto || 0);
              await base44.entities.CuentaCorriente.delete(movCC.id);
            }

            // Recalcular saldos resultantes en filas de CC del proveedor
            const movsCCProveedor = movimientosCC
              .filter(m => m.entidad_id === pago.proveedor_id && m.entidad_tipo === 'Proveedor' && m.comprobante_id !== pago.id)
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

            // Eliminar Egreso del Estado de Resultados si existe
            const egresosRelacionados = egresosVarios.filter(eg => 
              eg.notas && eg.notas.includes(`ID: ${pago.id}`)
            );
            for (const egreso of egresosRelacionados) {
              await base44.entities.Egreso.delete(egreso.id);
            }

            // Eliminar todos los movimientos de tesorería vinculados
            for (const mov of movimientosVinculados) {
              await base44.entities.MovimientoTesoreria.delete(mov.id);
            }

            // Eliminar el pago
            await base44.entities.Pago.delete(pago.id);
          }
          return; // Salir sin ejecutar la lógica de abajo
        } else if (movimiento.referencia_origen_tipo === 'IngresoVario') {
          const ingreso = ingresosVarios.find(i => i.id === movimiento.referencia_origen_id);
          if (ingreso) {
            // Buscar movimientos de tesorería vinculados
            const movimientosVinculados = movimientos.filter(m => 
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
          }
          return;
        } else if (movimiento.referencia_origen_tipo === 'Egreso') {
          const egreso = egresosVarios.find(e => e.id === movimiento.referencia_origen_id);
          if (egreso) {
            // Buscar movimientos de tesorería vinculados
            const movimientosVinculados = movimientos.filter(m => 
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
          }
          return;
        }
      }

      // Revertir saldos según tipo de movimiento
      if (movimiento.tipo_movimiento === 'Transferencia Interna') {
        // Revertir origen: devolver el dinero que salió
        if (movimiento.origen_id && movimiento.origen_tipo) {
          if (movimiento.origen_tipo === 'Caja') {
            const caja = cajas.find(c => c.id === movimiento.origen_id);
            if (caja) {
              await base44.entities.Caja.update(movimiento.origen_id, {
                saldo: (caja.saldo || 0) + movimiento.monto
              });
            }
          } else if (movimiento.origen_tipo === 'Banco') {
            const banco = bancos.find(b => b.id === movimiento.origen_id);
            if (banco) {
              await base44.entities.Banco.update(movimiento.origen_id, {
                saldo: (banco.saldo || 0) + movimiento.monto
              });
            }
          }
        }

        // Revertir destino: restar el dinero que entró
        if (movimiento.destino_id && movimiento.destino_tipo) {
          if (movimiento.destino_tipo === 'Caja') {
            const caja = cajas.find(c => c.id === movimiento.destino_id);
            if (caja) {
              await base44.entities.Caja.update(movimiento.destino_id, {
                saldo: (caja.saldo || 0) - movimiento.monto
              });
            }
          } else if (movimiento.destino_tipo === 'Banco') {
            const banco = bancos.find(b => b.id === movimiento.destino_id);
            if (banco) {
              await base44.entities.Banco.update(movimiento.destino_id, {
                saldo: (banco.saldo || 0) - movimiento.monto
              });
            }
          }
        }
      } else if (movimiento.tipo_movimiento === 'Ingreso Manual' || movimiento.tipo_movimiento === 'Crédito Bancario') {
        // Revertir ingreso: restar del destino
        if (movimiento.destino_id && movimiento.destino_tipo) {
          if (movimiento.destino_tipo === 'Caja') {
            const caja = cajas.find(c => c.id === movimiento.destino_id);
            if (caja) {
              await base44.entities.Caja.update(movimiento.destino_id, {
                saldo: (caja.saldo || 0) - movimiento.monto
              });
            }
          } else if (movimiento.destino_tipo === 'Banco') {
            const banco = bancos.find(b => b.id === movimiento.destino_id);
            if (banco) {
              await base44.entities.Banco.update(movimiento.destino_id, {
                saldo: (banco.saldo || 0) - movimiento.monto
              });
            }
          }
        }
      } else if (movimiento.tipo_movimiento === 'Egreso Manual' || movimiento.tipo_movimiento === 'Débito Bancario') {
        // Revertir egreso: devolver al origen
        if (movimiento.origen_id && movimiento.origen_tipo) {
          if (movimiento.origen_tipo === 'Caja') {
            const caja = cajas.find(c => c.id === movimiento.origen_id);
            if (caja) {
              await base44.entities.Caja.update(movimiento.origen_id, {
                saldo: (caja.saldo || 0) + movimiento.monto
              });
            }
          } else if (movimiento.origen_tipo === 'Banco') {
            const banco = bancos.find(b => b.id === movimiento.origen_id);
            if (banco) {
              await base44.entities.Banco.update(movimiento.origen_id, {
                saldo: (banco.saldo || 0) + movimiento.monto
              });
            }
          }
        }
      }

      // Eliminar el registro
      await base44.entities.MovimientoTesoreria.delete(movimiento.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientostesoreria'] });
      queryClient.invalidateQueries({ queryKey: ['cajas'] });
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      queryClient.invalidateQueries({ queryKey: ['cobros'] });
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      queryClient.invalidateQueries({ queryKey: ['ingresosvarios'] });
      queryClient.invalidateQueries({ queryKey: ['egresos'] });
      queryClient.invalidateQueries({ queryKey: ['cuentacorriente'] });
      queryClient.invalidateQueries({ queryKey: ['salidas'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos'] });
      toast.success('Movimiento eliminado completamente');
      setDeleteDialog({ open: false, movimiento: null });
    },
    onError: (error) => {
      console.error('Error al eliminar:', error);
      toast.error('Error al eliminar el movimiento');
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Obtener nombres de origen y destino
      let origenNombre = '';
      let destinoNombre = '';

      if (data.origen_id) {
        if (data.origen_tipo === 'Caja') {
          const caja = cajas.find(c => c.id === data.origen_id);
          origenNombre = caja?.nombre || '';
          // Actualizar saldo de caja origen
          if (caja) {
            await base44.entities.Caja.update(data.origen_id, {
              saldo: (caja.saldo || 0) - data.monto
            });
          }
        } else if (data.origen_tipo === 'Banco') {
          const banco = bancos.find(b => b.id === data.origen_id);
          origenNombre = banco?.nombre || '';
          // Actualizar saldo de banco origen
          if (banco) {
            await base44.entities.Banco.update(data.origen_id, {
              saldo: (banco.saldo || 0) - data.monto
            });
          }
        }
      }

      if (data.destino_id) {
        if (data.destino_tipo === 'Caja') {
          const caja = cajas.find(c => c.id === data.destino_id);
          destinoNombre = caja?.nombre || '';
          // Actualizar saldo de caja destino
          if (caja) {
            await base44.entities.Caja.update(data.destino_id, {
              saldo: (caja.saldo || 0) + data.monto
            });
          }
        } else if (data.destino_tipo === 'Banco') {
          const banco = bancos.find(b => b.id === data.destino_id);
          destinoNombre = banco?.nombre || '';
          // Actualizar saldo de banco destino
          if (banco) {
            await base44.entities.Banco.update(data.destino_id, {
              saldo: (banco.saldo || 0) + data.monto
            });
          }
        }
      }

      // Crear movimiento de tesorería
      return base44.entities.MovimientoTesoreria.create({
        ...data,
        origen_nombre: origenNombre,
        destino_nombre: destinoNombre,
        fecha: new Date(data.fecha).toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientostesoreria'] });
      queryClient.invalidateQueries({ queryKey: ['cajas'] });
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      toast.success('Movimiento registrado exitosamente');
      closeModal();
    },
    onError: () => toast.error('Error al registrar movimiento')
  });

  const openModal = () => {
    setFormData({
      fecha: format(new Date(), 'yyyy-MM-dd'),
      tipo_movimiento: 'Transferencia Interna',
      origen_tipo: 'Caja',
      origen_id: '',
      destino_tipo: 'Banco',
      destino_id: '',
      monto: 0,
      concepto: '',
      comprobante: ''
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getOrigenOptions = () => {
    return formData.origen_tipo === 'Caja' ? cajas : bancos;
  };

  const getDestinoOptions = () => {
    return formData.destino_tipo === 'Caja' ? cajas : bancos;
  };

  const tipoMovimientoBadge = (tipo) => {
    switch (tipo) {
      case 'Transferencia Interna': return 'bg-blue-100 text-blue-800';
      case 'Ingreso Manual': return 'bg-green-100 text-green-800';
      case 'Egreso Manual': return 'bg-red-100 text-red-800';
      case 'Débito Bancario': return 'bg-orange-100 text-orange-800';
      case 'Crédito Bancario': return 'bg-purple-100 text-purple-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Totales de la página actual
  const totalIngresos = movimientos
    .filter(m => ['Ingreso Manual', 'Crédito Bancario'].includes(m.tipo_movimiento))
    .reduce((sum, m) => sum + (m.monto || 0), 0);

  const totalEgresos = movimientos
    .filter(m => ['Egreso Manual', 'Débito Bancario'].includes(m.tipo_movimiento))
    .reduce((sum, m) => sum + (m.monto || 0), 0);

  const totalPaginas = Math.ceil(totalMovimientos / ITEMS_POR_PAGINA);

  const handleResetFiltros = () => {
    setFiltroTipo('todos');
    setFiltroOrigen('todos');
    setPagina(1);
  };

  const exportarPDF = async (fechaDesde, fechaHasta) => {
    try {
      const desde = new Date(fechaDesde);
      desde.setHours(0, 0, 0, 0);
      const hasta = new Date(fechaHasta);
      hasta.setHours(23, 59, 59, 999);
      const desdeISO = desde.toISOString();
      const hastaISO = hasta.toISOString();

      // Filtro en servidor por rango de fechas
      const movimientosFiltrados = await base44.entities.MovimientoTesoreria.filter(
        { fecha: { $gte: desdeISO, $lte: hastaISO } },
        '-fecha',
        1000
      );

      if (!movimientosFiltrados?.length) {
        toast.error('No hay movimientos en el rango de fechas seleccionado');
        return;
      }

      // Calcular totales
      const totalIng = movimientosFiltrados
        .filter(m => ['Ingreso Manual', 'Crédito Bancario'].includes(m.tipo_movimiento))
        .reduce((sum, m) => sum + (m.monto || 0), 0);

      const totalEgr = movimientosFiltrados
        .filter(m => ['Egreso Manual', 'Débito Bancario'].includes(m.tipo_movimiento))
        .reduce((sum, m) => sum + (m.monto || 0), 0);

      const resultadoNeto = totalIng - totalEgr;

      // Generar HTML del PDF
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Informe de Movimientos de Tesorería</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              font-size: 10px; 
              padding: 20px;
              color: #1e293b;
            }
            .header { 
              text-align: center; 
              margin-bottom: 20px; 
              border-bottom: 2px solid #0d9488;
              padding-bottom: 15px;
            }
            .title { 
              font-size: 18px; 
              font-weight: bold; 
              color: #0d9488;
              margin-bottom: 8px;
            }
            .subtitle {
              font-size: 11px;
              color: #64748b;
            }
            .info-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 10px;
              margin-bottom: 20px;
              border-radius: 4px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 15px 0;
            }
            th { 
              background: #f1f5f9; 
              font-weight: 600; 
              text-align: left;
              padding: 8px;
              border-bottom: 2px solid #cbd5e1;
              font-size: 9px;
              text-transform: uppercase;
            }
            td { 
              border-bottom: 1px solid #e2e8f0; 
              padding: 6px 8px;
              vertical-align: top;
            }
            .monto { 
              text-align: right; 
              font-weight: 600;
            }
            .totales { 
              background: #f8fafc; 
              font-weight: bold;
              margin-top: 20px;
              padding: 15px;
              border: 2px solid #0d9488;
              border-radius: 4px;
            }
            .totales table {
              margin: 0;
            }
            .totales td {
              border: none;
              padding: 5px 10px;
            }
            .ingreso { color: #16a34a; }
            .egreso { color: #dc2626; }
            .resultado { 
              color: ${resultadoNeto >= 0 ? '#16a34a' : '#dc2626'};
              font-size: 12px;
            }
            .tipo-badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 8px;
              font-weight: 600;
            }
            .tipo-ingreso { background: #dcfce7; color: #166534; }
            .tipo-egreso { background: #fee2e2; color: #991b1b; }
            .tipo-transferencia { background: #dbeafe; color: #1e40af; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">INFORME DE MOVIMIENTOS DE TESORERÍA</div>
            <div class="subtitle">Sistema de Gestión de Acopio</div>
          </div>
          
          <div class="info-box">
            <strong>Período:</strong> ${format(desde, 'dd/MM/yyyy', { locale: es })} al ${format(hasta, 'dd/MM/yyyy', { locale: es })}<br>
            <strong>Fecha de generación:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}<br>
            <strong>Total de movimientos:</strong> ${movimientosFiltrados.length}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 12%">Fecha</th>
                <th style="width: 15%">Tipo</th>
                <th style="width: 28%">Descripción</th>
                <th style="width: 15%">Origen</th>
                <th style="width: 15%">Cuenta</th>
                <th style="width: 15%">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${movimientosFiltrados.map(mov => {
                let tipoBadgeClass = 'tipo-transferencia';
                if (['Ingreso Manual', 'Crédito Bancario'].includes(mov.tipo_movimiento)) {
                  tipoBadgeClass = 'tipo-ingreso';
                } else if (['Egreso Manual', 'Débito Bancario'].includes(mov.tipo_movimiento)) {
                  tipoBadgeClass = 'tipo-egreso';
                }
                
                return `
                  <tr>
                    <td>${format(new Date(mov.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}</td>
                    <td><span class="tipo-badge ${tipoBadgeClass}">${mov.tipo_movimiento}</span></td>
                    <td>${mov.concepto || '-'}</td>
                    <td>${mov.origen_nombre || mov.referencia_origen_tipo || '-'}</td>
                    <td>${mov.destino_nombre || mov.origen_nombre || '-'}</td>
                    <td class="monto">$${(mov.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="totales">
            <table>
              <tr>
                <td><strong>Total Ingresos:</strong></td>
                <td class="monto ingreso">$${totalIng.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td><strong>Total Egresos:</strong></td>
                <td class="monto egreso">$${totalEgr.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr style="border-top: 2px solid #cbd5e1;">
                <td><strong>Resultado Neto:</strong></td>
                <td class="monto resultado">$${resultadoNeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
              </tr>
            </table>
          </div>
        </body>
        </html>
      `;

      // Abrir ventana de impresión
      const ventana = window.open('', '_blank');
      ventana.document.write(html);
      ventana.document.close();
      ventana.onload = () => ventana.print();

    } catch (error) {
      console.error('Error al generar PDF:', error);
      toast.error('Error al generar el PDF');
      throw error;
    }
  };

  const editarFechaMutation = useMutation({
    mutationFn: async ({ movimiento, nuevaFecha, motivo }) => {
      // Obtener usuario actual
      const user = await base44.auth.me();

      // Crear registro de auditoría
      await base44.entities.AuditoriaMovimientoTesoreria.create({
        movimiento_tesoreria_id: movimiento.id,
        fecha_original: movimiento.fecha,
        fecha_nueva: new Date(nuevaFecha).toISOString(),
        usuario_email: user.email,
        fecha_cambio: new Date().toISOString(),
        motivo: motivo || 'Sin motivo especificado'
      });

      // Actualizar solo la fecha del movimiento
      await base44.entities.MovimientoTesoreria.update(movimiento.id, {
        fecha: new Date(nuevaFecha).toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientostesoreria'] });
      queryClient.invalidateQueries({ queryKey: ['movimientostesoreria-count'] });
      toast.success('Fecha actualizada correctamente', {
        description: 'El cambio ha sido registrado en auditoría'
      });
      setEditarFechaModal({ open: false, movimiento: null });
    },
    onError: (error) => {
      console.error('Error al editar fecha:', error);
      throw error;
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <ArrowLeftRight className="h-8 w-8 text-teal-600" />
              Movimientos de Tesorería
            </h1>
            <p className="text-slate-500 mt-1">Transferencias y movimientos internos</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setExportModalOpen(true)} 
              variant="outline"
              className="border-teal-600 text-teal-600 hover:bg-teal-50"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button 
              onClick={() => setPdfModalOpen(true)} 
              variant="outline"
              className="border-teal-600 text-teal-600 hover:bg-teal-50"
            >
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button onClick={openModal} className="bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Movimiento
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Filtros:</span>
              </div>
              
              <div className="flex-1 min-w-[200px]">
                <Select value={filtroTipo} onValueChange={(v) => { setFiltroTipo(v); setPagina(1); }}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los tipos</SelectItem>
                    <SelectItem value="ingresos">Solo Ingresos</SelectItem>
                    <SelectItem value="egresos">Solo Egresos</SelectItem>
                    <SelectItem value="transferencias">Solo Transferencias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <Select value={filtroOrigen} onValueChange={(v) => { setFiltroOrigen(v); setPagina(1); }}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los orígenes</SelectItem>
                    <SelectItem value="cobros">Desde Cobros</SelectItem>
                    <SelectItem value="pagos">Desde Pagos</SelectItem>
                    <SelectItem value="ingresos_varios">Desde Ingresos Varios</SelectItem>
                    <SelectItem value="egresos_varios">Desde Egresos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(filtroTipo !== 'todos' || filtroOrigen !== 'todos') && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleResetFiltros}
                  className="text-slate-600"
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Movimientos</p>
                  <p className="text-2xl font-bold text-teal-600">{movimientos.length}</p>
                </div>
                <ArrowLeftRight className="h-10 w-10 text-teal-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Ingresos</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <TrendingUp className="h-10 w-10 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Egresos</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${totalEgresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <TrendingDown className="h-10 w-10 text-red-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Movimientos */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          </div>
        ) : movimientos.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <ArrowLeftRight className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">
                {filtroTipo !== 'todos' || filtroOrigen !== 'todos' 
                  ? 'No hay movimientos que coincidan con los filtros'
                  : 'No hay movimientos registrados'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {movimientos.map(mov => (
              <Card key={mov.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-slate-400" />
                        <span className="font-medium">
                          {mov.fecha ? format(new Date(mov.fecha), "dd/MM/yyyy HH:mm", { locale: es }) : '-'}
                        </span>
                        <Badge className={tipoMovimientoBadge(mov.tipo_movimiento)}>
                          {mov.tipo_movimiento}
                        </Badge>
                      </div>

                      <p className="text-slate-700">{mov.concepto}</p>

                      <div className="flex items-center gap-4 text-sm">
                        {mov.origen_nombre && (
                          <div>
                            <span className="text-slate-500">Origen: </span>
                            <span className="font-medium">{mov.origen_nombre} ({mov.origen_tipo})</span>
                          </div>
                        )}
                        {mov.origen_nombre && mov.destino_nombre && (
                          <ArrowLeftRight className="h-4 w-4 text-slate-400" />
                        )}
                        {mov.destino_nombre && (
                          <div>
                            <span className="text-slate-500">Destino: </span>
                            <span className="font-medium">{mov.destino_nombre} ({mov.destino_tipo})</span>
                          </div>
                        )}
                      </div>

                      {mov.comprobante && (
                        <div className="text-xs text-slate-500">
                          Comprobante: {mov.comprobante}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 ml-6">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-teal-600">
                          ${(mov.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditarFechaModal({ open: true, movimiento: mov })}
                        className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                        title="Editar fecha"
                      >
                        <Edit className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteDialog({ open: true, movimiento: mov })}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Eliminar"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <Card className="mt-4">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                      Página {pagina} de {totalPaginas} • {totalMovimientos} movimientos totales
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPagina(p => Math.max(1, p - 1))}
                        disabled={pagina === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                        disabled={pagina === totalPaginas}
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Alert Dialog para eliminar */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, movimiento: deleteDialog.movimiento })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este movimiento?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Esta acción revertirá automáticamente los saldos afectados:</p>
                {deleteDialog.movimiento && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                    <p className="font-semibold text-amber-900 mb-2">{deleteDialog.movimiento.tipo_movimiento}</p>
                    <p className="text-slate-700">Concepto: {deleteDialog.movimiento.concepto}</p>
                    <p className="text-slate-700">Monto: <strong>${(deleteDialog.movimiento.monto || 0).toLocaleString('es-AR')}</strong></p>
                    {deleteDialog.movimiento.origen_nombre && (
                      <p className="text-slate-700">Origen: {deleteDialog.movimiento.origen_nombre}</p>
                    )}
                    {deleteDialog.movimiento.destino_nombre && (
                      <p className="text-slate-700">Destino: {deleteDialog.movimiento.destino_nombre}</p>
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">Esta acción no se puede deshacer.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  deleteDialog.movimiento &&
                  askPin(
                    () => deleteMutation.mutate(deleteDialog.movimiento),
                    'Confirmar eliminación de movimiento'
                  )
                }
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  'Sí, Eliminar y Revertir'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nuevo Movimiento de Tesorería</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Fecha *</Label>
                    <Input
                      type="date"
                      value={formData.fecha}
                      onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Tipo de Movimiento *</Label>
                    <select
                      value={formData.tipo_movimiento}
                      onChange={(e) => setFormData({ ...formData, tipo_movimiento: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Transferencia Interna">Transferencia Interna</option>
                      <option value="Ingreso Manual">Ingreso Manual</option>
                      <option value="Egreso Manual">Egreso Manual</option>
                      <option value="Débito Bancario">Débito Bancario</option>
                      <option value="Crédito Bancario">Crédito Bancario</option>
                    </select>
                  </div>
                </div>

                {formData.tipo_movimiento === 'Transferencia Interna' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tipo Origen *</Label>
                        <select
                          value={formData.origen_tipo}
                          onChange={(e) => setFormData({ ...formData, origen_tipo: e.target.value, origen_id: '' })}
                          className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="Caja">Caja</option>
                          <option value="Banco">Banco</option>
                        </select>
                      </div>
                      <div>
                        <Label>Origen *</Label>
                        <SearchableSelect
                          options={getOrigenOptions()}
                          value={formData.origen_id}
                          onChange={(id) => setFormData({ ...formData, origen_id: id })}
                          displayKey="nombre"
                          placeholder="Seleccionar origen..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tipo Destino *</Label>
                        <select
                          value={formData.destino_tipo}
                          onChange={(e) => setFormData({ ...formData, destino_tipo: e.target.value, destino_id: '' })}
                          className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="Caja">Caja</option>
                          <option value="Banco">Banco</option>
                        </select>
                      </div>
                      <div>
                        <Label>Destino *</Label>
                        <SearchableSelect
                          options={getDestinoOptions()}
                          value={formData.destino_id}
                          onChange={(id) => setFormData({ ...formData, destino_id: id })}
                          displayKey="nombre"
                          placeholder="Seleccionar destino..."
                        />
                      </div>
                    </div>
                  </>
                )}

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

                <div>
                  <Label>Concepto *</Label>
                  <Input
                    value={formData.concepto}
                    onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                    placeholder="Descripción del movimiento"
                    required
                  />
                </div>

                <div>
                  <Label>Comprobante</Label>
                  <Input
                    value={formData.comprobante}
                    onChange={(e) => setFormData({ ...formData, comprobante: e.target.value })}
                    placeholder="Número de comprobante"
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
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Registrar Movimiento
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modales de Exportación */}
        <ExportarMovimientosModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          movimientos={movimientos}
        />
        
        <ExportarMovimientosPDFModal
          open={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          onExportar={exportarPDF}
        />

        <EditarFechaMovimientoModal
          open={editarFechaModal.open}
          onClose={() => setEditarFechaModal({ open: false, movimiento: null })}
          movimiento={editarFechaModal.movimiento}
          onGuardar={(datos) =>
            askPin(
              () => editarFechaMutation.mutateAsync(datos),
              'Confirmar cambio de fecha'
            )
          }
        />
        <PinGuardModal />
      </div>
    </div>
  );
}