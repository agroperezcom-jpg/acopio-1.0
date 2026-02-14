import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfMonth, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { History, Search, ChevronDown, ChevronLeft, Filter, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { invalidarTodoElSistema } from '@/utils/queryHelpers';
import { recalcularSaldosEntidad, actualizarSaldoEntidad } from '@/utils/contabilidad';
import { ajustarStockProducto, ajustarStockEnvase } from '@/services/StockService';
import { actualizarDeudaEnvase } from '@/services/SaldoEnvasesService';
import { usePinGuard } from '@/hooks/usePinGuard';
import { generateMovimientoPDF, downloadPDF, shareWhatsApp } from '@/components/PDFGenerator';
import { generateSalidaPDF, downloadSalidaPDF, shareSalidaWhatsApp } from '@/components/SalidaPDFGenerator';
import { descargarPDFMovimientoEnvases, compartirWhatsAppMovimientoEnvases } from '@/components/MovimientoEnvasesPDFGenerator';
import EditarMovimientoModal from '@/components/EditarMovimientoModal';
import DateRangeSelector from '@/components/DateRangeSelector';
import TarjetaMovimiento from '@/components/TarjetaMovimiento';

export default function Historial() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [rangoFechas, setRangoFechas] = useState(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return { desde: startOfMonth(hoy), hasta: endOfDay(hoy) };
  });
  const [expandedId, setExpandedId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, tipo: null, registro: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [sugerirEliminarEntidad, setSugerirEliminarEntidad] = useState({ open: false, tipo: null, id: null, nombre: null });
  const [editDialog, setEditDialog] = useState({ open: false, movimiento: null });
  const [isProcessing, setIsProcessing] = useState(false);
  const [pagina, setPagina] = useState(1);
  const { askPin, PinGuardModal } = usePinGuard();
  
  const PAGE_SIZE = 20;

  // Filtro servidor: por tipo de movimiento (evita traer todos y filtrar en cliente)
  const queryMovimientos = useMemo(() => {
    if (tipoFilter === 'Ingreso de Fruta' || tipoFilter === 'Movimiento de Envases') {
      return { tipo_movimiento: tipoFilter };
    }
    return {};
  }, [tipoFilter]);

  const fechaDesde = rangoFechas?.desde;
  const fechaHasta = rangoFechas?.hasta;
  const fechaDesdeStr = fechaDesde?.toISOString?.();
  const fechaHastaStr = fechaHasta?.toISOString?.();

  const skip = (pagina - 1) * PAGE_SIZE;

  // Reset página cuando cambian los filtros
  useEffect(() => {
    setPagina(1);
  }, [fechaDesdeStr, fechaHastaStr, tipoFilter, search]);

  const {
    data: movimientos = [],
    isLoading: loadingMov,
    isFetching: fetchingMov
  } = useQuery({
    queryKey: ['movimientos', tipoFilter, fechaDesdeStr, fechaHastaStr, pagina],
    queryFn: async () => {
      if (tipoFilter === 'Salida de Fruta') return [];
      const filter = {
        ...queryMovimientos,
        fecha: {
          $gte: fechaDesde.toISOString(),
          $lte: fechaHasta.toISOString()
        }
      };
      return base44.entities.Movimiento.filter(filter, '-created_date', PAGE_SIZE, skip);
    },
    enabled: tipoFilter !== 'Salida de Fruta' && !!fechaDesde && !!fechaHasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData
  });

  const {
    data: salidas = [],
    isLoading: loadingSal,
    isFetching: fetchingSal
  } = useQuery({
    queryKey: ['salidas', tipoFilter, fechaDesdeStr, fechaHastaStr, pagina],
    queryFn: () =>
      base44.entities.SalidaFruta.filter(
        {
          fecha: {
            $gte: fechaDesde.toISOString(),
            $lte: fechaHasta.toISOString()
          }
        },
        '-created_date',
        PAGE_SIZE,
        skip
      ),
    enabled: (tipoFilter === 'todos' || tipoFilter === 'Salida de Fruta') && !!fechaDesde && !!fechaHasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData
  });

  const hasMoreMovimientos = movimientos?.length === PAGE_SIZE;
  const hasMoreSalidas = salidas?.length === PAGE_SIZE;
  const hasMore = hasMoreMovimientos || hasMoreSalidas;
  const loadingMore = fetchingMov || fetchingSal;

  const { data: proveedores = [] } = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => base44.entities.Proveedor.list('nombre', 100),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('nombre', 100),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: productos = [] } = useQuery({
    queryKey: ['productos'],
    queryFn: () => base44.entities.Producto.list('fruta', 100),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: envases = [] } = useQuery({
    queryKey: ['envases'],
    queryFn: () => base44.entities.Envase.list('tipo', 100),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: fleteros = [] } = useQuery({
    queryKey: ['fleteros'],
    queryFn: () => base44.entities.Fletero.list('nombre', 100),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const isLoading = loadingMov || loadingSal;

  const calcularSaldos = useMemo(() => {
    return (provId) => {
      if (!provId) return [];
      const saldosPorEnvase = {};
      
      // Movimientos de envases vacíos
      movimientos
        .filter(m => m.proveedor_id === provId)
        .forEach(m => {
          m.movimiento_envases?.forEach(e => {
            if (!saldosPorEnvase[e.envase_tipo]) {
              saldosPorEnvase[e.envase_tipo] = 0;
            }
            saldosPorEnvase[e.envase_tipo] += (e.cantidad_salida || 0) - (e.cantidad_ingreso || 0);
          });
        });

      // Restar envases llenos devueltos en Ingreso de Fruta
      movimientos
        .filter(m => m.proveedor_id === provId && m.tipo_movimiento === 'Ingreso de Fruta' && m.envases_llenos)
        .forEach(m => {
          m.envases_llenos.forEach(e => {
            if (!saldosPorEnvase[e.envase_tipo]) {
              saldosPorEnvase[e.envase_tipo] = 0;
            }
            saldosPorEnvase[e.envase_tipo] -= (e.cantidad || 0);
          });
        });

      return Object.entries(saldosPorEnvase).map(([tipo, saldo]) => ({
        envase_tipo: tipo,
        saldo: Math.max(0, saldo)
      }));
    };
  }, [movimientos]);

  const todosLosRegistros = useMemo(() => {
    const registros = [];
    
    // Agregar movimientos (ingresos y envases)
    movimientos.forEach(m => {
      // Determinar si es con cliente o proveedor
      const esConCliente = m.cliente_id && m.cliente_nombre;
      const esConProveedor = m.proveedor_id && m.proveedor_nombre;
      
      registros.push({
        ...m,
        tipo: m.tipo_movimiento,
        origen: 'movimiento',
        entidad_nombre: esConCliente ? m.cliente_nombre : (esConProveedor ? m.proveedor_nombre : '-'),
        entidad_tipo: esConCliente ? 'Cliente' : (esConProveedor ? 'Proveedor' : '-')
      });
    });
    
    // Agregar salidas
    salidas.forEach(s => {
      registros.push({
        ...s,
        tipo: 'Salida de Fruta',
        origen: 'salida',
        entidad_nombre: s.cliente_nombre,
        entidad_tipo: 'Cliente'
      });
    });
    
    // Ordenar por fecha descendente
    return registros.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [movimientos, salidas]);

  // Filtro por búsqueda en cliente (tipo ya aplicado en servidor)
  const filteredMovimientos = useMemo(() => {
    if (!search?.trim()) return todosLosRegistros;
    const term = search.trim().toLowerCase();
    return todosLosRegistros.filter(m =>
      m.entidad_nombre?.toLowerCase().includes(term) ||
      m.fletero_nombre?.toLowerCase().includes(term) ||
      m.numero_remito?.toLowerCase().includes(term) ||
      m.comprobante_cliente?.toLowerCase().includes(term)
    );
  }, [todosLosRegistros, search]);
  
  const handleDelete = async () => {
    if (!deleteDialog.id || !deleteDialog.tipo || !deleteDialog.registro) return;
    setIsDeleting(true);
    try {
      const registro = deleteDialog.registro;

      if (deleteDialog.tipo === 'movimiento') {
        // REVERSIÓN INTELIGENTE DE INGRESO DE FRUTA
        if (registro.tipo_movimiento === 'Ingreso de Fruta' && registro.pesajes?.length > 0) {
          // Agrupar kilos netos por producto
          const stockPorProducto = {};
          registro.pesajes.forEach(pesaje => {
            if (pesaje.producto_id && pesaje.peso_neto) {
              if (!stockPorProducto[pesaje.producto_id]) {
                stockPorProducto[pesaje.producto_id] = 0;
              }
              stockPorProducto[pesaje.producto_id] += pesaje.peso_neto;
            }
          });

          // Restar stock de cada producto (actualización incremental)
          for (const [productoId, totalNeto] of Object.entries(stockPorProducto)) {
            await ajustarStockProducto(base44, productoId, -totalNeto);
          }
        }

        // REVERSIÓN DE MOVIMIENTOS DE ENVASES (tanto ingreso como movimiento puro)
        if (registro.movimiento_envases?.length > 0) {
          // Agrupar ajustes por envase y tipo (vacío/ocupado)
          const ajustePorEnvase = {};
          registro.movimiento_envases.forEach(movEnv => {
            if (movEnv.envase_id) {
              if (!ajustePorEnvase[movEnv.envase_id]) {
                ajustePorEnvase[movEnv.envase_id] = { 
                  ingresoVacios: 0, 
                  ingresoOcupados: 0, 
                  salidaVacios: 0, 
                  salidaOcupados: 0 
                };
              }
              // Determinar si son vacíos u ocupados (con_fruta)
              const conFruta = movEnv.con_fruta !== undefined ? movEnv.con_fruta : true;
              
              if (conFruta) {
                ajustePorEnvase[movEnv.envase_id].ingresoOcupados += (movEnv.cantidad_ingreso || 0);
                ajustePorEnvase[movEnv.envase_id].salidaOcupados += (movEnv.cantidad_salida || 0);
              } else {
                ajustePorEnvase[movEnv.envase_id].ingresoVacios += (movEnv.cantidad_ingreso || 0);
                ajustePorEnvase[movEnv.envase_id].salidaVacios += (movEnv.cantidad_salida || 0);
              }
            }
          });

          // Revertir stocks de envases (actualización incremental)
          for (const [envaseId, ajustes] of Object.entries(ajustePorEnvase)) {
            const deltaOcupados = -ajustes.ingresoOcupados + ajustes.salidaOcupados;
            const deltaVacios = -ajustes.ingresoVacios + ajustes.salidaVacios;
            await ajustarStockEnvase(base44, envaseId, deltaOcupados, deltaVacios);
          }
        }

        // Revertir saldo vivo de envases (deuda)
        if (registro.envases_llenos?.length && registro.proveedor_id) {
          for (const e of registro.envases_llenos) {
            if (e.envase_tipo && (e.cantidad || 0) !== 0) {
              await actualizarDeudaEnvase(base44, 'Proveedor', registro.proveedor_id, e.envase_tipo, e.cantidad || 0);
            }
          }
        }
        if (registro.movimiento_envases?.length) {
          for (const e of registro.movimiento_envases) {
            const tipo = e.envase_tipo;
            if (!tipo) continue;
            const ing = (e.cantidad_ingreso || 0);
            const sal = (e.cantidad_salida || 0);
            if (registro.proveedor_id) await actualizarDeudaEnvase(base44, 'Proveedor', registro.proveedor_id, tipo, ing - sal);
            if (registro.cliente_id) await actualizarDeudaEnvase(base44, 'Cliente', registro.cliente_id, tipo, sal - ing);
          }
        }

        // Eliminar CuentaCorriente asociados (evitar datos huérfanos) y revertir saldo_actual
        // OPTIMIZACIÓN: Filtrar en servidor en lugar de descargar toda la tabla
        const movsCCIngreso = await base44.entities.CuentaCorriente.filter({
          comprobante_tipo: 'IngresoFruta',
          comprobante_id: deleteDialog.id
        });
        for (const movCC of movsCCIngreso) {
          if (registro.proveedor_id) {
            await actualizarSaldoEntidad(base44, 'Proveedor', registro.proveedor_id, -(movCC.monto || 0));
          }
          await base44.entities.CuentaCorriente.delete(movCC.id);
        }

        // Eliminar el movimiento
        await base44.entities.Movimiento.delete(deleteDialog.id);
        
        // Recalcular saldos de cuenta corriente si el movimiento afectaba una entidad
        if (registro.proveedor_id) {
          await recalcularSaldosEntidad(base44, registro.proveedor_id, 'Proveedor');
        } else if (registro.cliente_id) {
          await recalcularSaldosEntidad(base44, registro.cliente_id, 'Cliente');
        }
        
        // Invalidar todas las queries del sistema
        invalidarTodoElSistema(queryClient);

        // Verificación: si la entidad quedó sin movimientos, ofrecer eliminar la ficha (dato de prueba)
        const toArray = (r) => (Array.isArray(r) ? r : r ? [r] : []);
        if (registro.proveedor_id) {
          const restProv = await base44.entities.Movimiento.filter({ proveedor_id: registro.proveedor_id }, '-created_date', 1);
          if (toArray(restProv).length === 0) {
            toast.success('Movimiento eliminado correctamente.');
            setSugerirEliminarEntidad({ open: true, tipo: 'Proveedor', id: registro.proveedor_id, nombre: registro.proveedor_nombre || 'Sin nombre' });
            setDeleteDialog({ open: false, id: null, tipo: null, registro: null });
            setIsDeleting(false);
            return;
          }
        }
        if (registro.cliente_id) {
          const restCli = await base44.entities.Movimiento.filter({ cliente_id: registro.cliente_id }, '-created_date', 1);
          if (toArray(restCli).length === 0) {
            toast.success('Movimiento eliminado correctamente.');
            setSugerirEliminarEntidad({ open: true, tipo: 'Cliente', id: registro.cliente_id, nombre: registro.cliente_nombre || 'Sin nombre' });
            setDeleteDialog({ open: false, id: null, tipo: null, registro: null });
            setIsDeleting(false);
            return;
          }
        }

      } else if (deleteDialog.tipo === 'salida') {
        // REVERSIÓN DE SALIDA DE FRUTA
        if (registro.detalles?.length > 0) {
          // Agrupar kilos por producto (usar kilos efectivos si está confirmada)
          const stockPorProducto = {};
          registro.detalles.forEach(detalle => {
            if (detalle.producto_id) {
              if (!stockPorProducto[detalle.producto_id]) {
                stockPorProducto[detalle.producto_id] = 0;
              }
              // Si está confirmada, usar kilos efectivos, sino usar kilos_salida
              const kilosEfectivos = registro.estado === 'Confirmada'
                ? ((detalle.kilos_reales || detalle.kilos_salida) + (detalle.descuento_kg || 0))
                : detalle.kilos_salida;
              
              stockPorProducto[detalle.producto_id] += kilosEfectivos;
            }
          });

          // Devolver stock a cada producto (actualización incremental)
          for (const [productoId, totalKilos] of Object.entries(stockPorProducto)) {
            await ajustarStockProducto(base44, productoId, totalKilos);
          }
        }

        // REVERSIÓN DE MOVIMIENTOS DE ENVASES DE LA SALIDA
        if (registro.movimiento_envases?.length > 0) {
          const ajustePorEnvase = {};
          registro.movimiento_envases.forEach(movEnv => {
            if (movEnv.envase_id) {
              if (!ajustePorEnvase[movEnv.envase_id]) {
                ajustePorEnvase[movEnv.envase_id] = { 
                  ingresoVacios: 0, 
                  ingresoOcupados: 0, 
                  salidaVacios: 0, 
                  salidaOcupados: 0 
                };
              }
              const conFruta = movEnv.con_fruta !== undefined ? movEnv.con_fruta : false;
              
              if (conFruta) {
                ajustePorEnvase[movEnv.envase_id].ingresoOcupados += (movEnv.cantidad_ingreso || 0);
                ajustePorEnvase[movEnv.envase_id].salidaOcupados += (movEnv.cantidad_salida || 0);
              } else {
                ajustePorEnvase[movEnv.envase_id].ingresoVacios += (movEnv.cantidad_ingreso || 0);
                ajustePorEnvase[movEnv.envase_id].salidaVacios += (movEnv.cantidad_salida || 0);
              }
            }
          });

          for (const [envaseId, ajustes] of Object.entries(ajustePorEnvase)) {
            const deltaOcupados = -ajustes.ingresoOcupados + ajustes.salidaOcupados;
            const deltaVacios = -ajustes.ingresoVacios + ajustes.salidaVacios;
            await ajustarStockEnvase(base44, envaseId, deltaOcupados, deltaVacios);
          }
        }

        // Revertir saldo vivo de envases (deuda) de la salida
        if (registro.envases_llenos?.length && registro.cliente_id) {
          for (const e of registro.envases_llenos) {
            if (e.envase_tipo && (e.cantidad || 0) !== 0) {
              await actualizarDeudaEnvase(base44, 'Cliente', registro.cliente_id, e.envase_tipo, e.cantidad || 0);
            }
          }
        }
        if (registro.movimiento_envases?.length && registro.cliente_id) {
          for (const e of registro.movimiento_envases) {
            if (!e.envase_tipo) continue;
            const delta = (e.cantidad_salida || 0) - (e.cantidad_ingreso || 0);
            if (delta !== 0) await actualizarDeudaEnvase(base44, 'Cliente', registro.cliente_id, e.envase_tipo, delta);
          }
        }

        // Eliminar CuentaCorriente asociados (evitar datos huérfanos) y revertir saldo_actual
        // OPTIMIZACIÓN: Filtrar en servidor en lugar de descargar toda la tabla
        const movsCCSalida = await base44.entities.CuentaCorriente.filter({
          comprobante_tipo: 'SalidaFruta',
          comprobante_id: deleteDialog.id
        });
        for (const movCC of movsCCSalida) {
          if (registro.cliente_id) {
            await actualizarSaldoEntidad(base44, 'Cliente', registro.cliente_id, -(movCC.monto || 0));
          }
          await base44.entities.CuentaCorriente.delete(movCC.id);
        }

        await base44.entities.SalidaFruta.delete(deleteDialog.id);
        
        // Recalcular saldos de cuenta corriente si la salida afectaba un cliente
        if (registro.cliente_id) {
          await recalcularSaldosEntidad(base44, registro.cliente_id, 'Cliente');
        }
        
        // Invalidar todas las queries del sistema
        invalidarTodoElSistema(queryClient);

        // Verificación: si el cliente quedó sin salidas, ofrecer eliminar su ficha (dato de prueba)
        if (registro.cliente_id) {
          const toArray = (r) => (Array.isArray(r) ? r : r ? [r] : []);
          const restSalidas = await base44.entities.SalidaFruta.filter({ cliente_id: registro.cliente_id }, '-fecha', 1);
          if (toArray(restSalidas).length === 0) {
            toast.success('Salida eliminada correctamente.');
            setSugerirEliminarEntidad({ open: true, tipo: 'Cliente', id: registro.cliente_id, nombre: registro.cliente_nombre || 'Sin nombre' });
            setDeleteDialog({ open: false, id: null, tipo: null, registro: null });
            setIsDeleting(false);
            return;
          }
        }
      }

      setDeleteDialog({ open: false, id: null, tipo: null, registro: null });
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert('Error al eliminar el registro. Por favor, intente nuevamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    askPin(
      () => handleDelete(),
      'Confirmar eliminación'
    );
  };

  const handleDownloadPDF = (registro) => {
    if (registro.origen === 'movimiento') {
      let saldos = [];
      let entidadData = null;
      
      if (registro.proveedor_id) {
        saldos = calcularSaldos(registro.proveedor_id);
        entidadData = proveedores.find(p => p.id === registro.proveedor_id);
      } else if (registro.cliente_id) {
        // Calcular saldos para cliente
        const saldosPorEnvase = {};
        movimientos
          .filter(m => m.cliente_id === registro.cliente_id)
          .forEach(m => {
            m.movimiento_envases?.forEach(e => {
              if (!saldosPorEnvase[e.envase_tipo]) {
                saldosPorEnvase[e.envase_tipo] = 0;
              }
              saldosPorEnvase[e.envase_tipo] += (e.cantidad_salida || 0) - (e.cantidad_ingreso || 0);
            });
          });
        salidas
          .filter(s => s.cliente_id === registro.cliente_id)
          .forEach(s => {
            s.movimiento_envases?.forEach(e => {
              if (!saldosPorEnvase[e.envase_tipo]) {
                saldosPorEnvase[e.envase_tipo] = 0;
              }
              saldosPorEnvase[e.envase_tipo] += (e.cantidad_ingreso || 0) - (e.cantidad_salida || 0);
            });
            // Envases llenos que salieron (reducen deuda)
            s.envases_llenos?.forEach(e => {
              if (!saldosPorEnvase[e.envase_tipo]) {
                saldosPorEnvase[e.envase_tipo] = 0;
              }
              saldosPorEnvase[e.envase_tipo] -= (e.cantidad || 0);
            });
          });
        saldos = Object.entries(saldosPorEnvase).map(([tipo, saldo]) => ({
          envase_tipo: tipo,
          saldo: Math.max(0, saldo)
        }));
        entidadData = clientes.find(c => c.id === registro.cliente_id);
      }
      
      const fleteroData = fleteros.find(f => f.id === registro.fletero_id);
      
      // USAR SIEMPRE EL MISMO GENERADOR UNIFICADO
      const html = generateMovimientoPDF(registro, saldos);
      downloadPDF(html, `movimiento_${registro.id}.pdf`);
    } else {
      const html = generateSalidaPDF(registro);
      downloadSalidaPDF(html, registro.numero_remito);
    }
  };

  const handleShareWhatsApp = async (registro) => {
    if (registro.origen === 'movimiento') {
      let saldos = [];
      let entidadData = null;
      
      if (registro.proveedor_id) {
        saldos = calcularSaldos(registro.proveedor_id);
        entidadData = proveedores.find(p => p.id === registro.proveedor_id);
      } else if (registro.cliente_id) {
        // Calcular saldos para cliente
        const saldosPorEnvase = {};
        movimientos
          .filter(m => m.cliente_id === registro.cliente_id)
          .forEach(m => {
            m.movimiento_envases?.forEach(e => {
              if (!saldosPorEnvase[e.envase_tipo]) {
                saldosPorEnvase[e.envase_tipo] = 0;
              }
              saldosPorEnvase[e.envase_tipo] += (e.cantidad_salida || 0) - (e.cantidad_ingreso || 0);
            });
          });
        salidas
          .filter(s => s.cliente_id === registro.cliente_id)
          .forEach(s => {
            s.movimiento_envases?.forEach(e => {
              if (!saldosPorEnvase[e.envase_tipo]) {
                saldosPorEnvase[e.envase_tipo] = 0;
              }
              saldosPorEnvase[e.envase_tipo] += (e.cantidad_ingreso || 0) - (e.cantidad_salida || 0);
            });
            // Envases llenos que salieron (reducen deuda)
            s.envases_llenos?.forEach(e => {
              if (!saldosPorEnvase[e.envase_tipo]) {
                saldosPorEnvase[e.envase_tipo] = 0;
              }
              saldosPorEnvase[e.envase_tipo] -= (e.cantidad || 0);
            });
          });
        saldos = Object.entries(saldosPorEnvase).map(([tipo, saldo]) => ({
          envase_tipo: tipo,
          saldo: Math.max(0, saldo)
        }));
        entidadData = clientes.find(c => c.id === registro.cliente_id);
      }
      
      // USAR SIEMPRE EL MISMO GENERADOR UNIFICADO
      await shareWhatsApp(registro, saldos, entidadData?.whatsapp);
    } else {
      const cliente = clientes.find(c => c.id === registro.cliente_id);
      await shareSalidaWhatsApp(registro, cliente?.whatsapp);
    }
  };

  const toggleExpand = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handleDeleteClick = useCallback((registro) => {
    setDeleteDialog({ open: true, id: registro.id, tipo: registro.origen, registro });
  }, []);

  const handleEditarMovimiento = (registro) => {
    setEditDialog({ open: true, movimiento: registro });
  };

  const handleSaveEdicion = async (formData) => {
    const movimientoOriginal = editDialog.movimiento;
    await askPin(
      () => confirmarEdicion(movimientoOriginal, formData),
      'Confirmar Edición'
    );
  };

  const confirmarEdicion = async (movimientoOriginal, formData) => {
    setIsProcessing(true);
    try {
      if (!movimientoOriginal) return;
      
      // Preparar datos de actualización
      const updateData = {
        fecha: new Date(formData.fecha).toISOString(),
        notas: formData.notas
      };

      // Agregar campos específicos según tipo
      if (movimientoOriginal.origen === 'movimiento') {
        if (formData.proveedor_id) {
          const prov = proveedores.find(p => p.id === formData.proveedor_id);
          updateData.proveedor_id = formData.proveedor_id;
          updateData.proveedor_nombre = prov?.nombre;
        }
        if (formData.cliente_id) {
          const cli = clientes.find(c => c.id === formData.cliente_id);
          updateData.cliente_id = formData.cliente_id;
          updateData.cliente_nombre = cli?.nombre;
        }
        if (formData.fletero_id) {
          const flet = fleteros.find(f => f.id === formData.fletero_id);
          updateData.fletero_id = formData.fletero_id;
          updateData.fletero_nombre = flet?.nombre;
        }
        
        // Si hay cambios en movimiento_envases (checkboxes de contabilizar)
        if (formData.movimiento_envases) {
          updateData.movimiento_envases = formData.movimiento_envases;
        }

        await base44.entities.Movimiento.update(movimientoOriginal.id, updateData);
      } else {
        // Salida de fruta
        if (formData.cliente_id) {
          const cli = clientes.find(c => c.id === formData.cliente_id);
          updateData.cliente_id = formData.cliente_id;
          updateData.cliente_nombre = cli?.nombre;
        }
        if (formData.fletero_id) {
          const flet = fleteros.find(f => f.id === formData.fletero_id);
          updateData.fletero_id = formData.fletero_id;
          updateData.fletero_nombre = flet?.nombre;
        }
        if (formData.numero_remito) {
          updateData.numero_remito = formData.numero_remito;
        }
        if (formData.comprobante_cliente !== undefined) {
          updateData.comprobante_cliente = formData.comprobante_cliente;
        }
        
        await base44.entities.SalidaFruta.update(movimientoOriginal.id, updateData);
      }

      // Invalidar todas las queries del sistema
      invalidarTodoElSistema(queryClient);
      
      toast.success('Movimiento actualizado correctamente');
        
      setEditDialog({ open: false, movimiento: null });
    } catch (error) {
      console.error('Error al guardar edición:', error);
      toast.error('Error al guardar los cambios');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-8">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
            <History className="h-5 w-5 md:h-6 md:w-6 text-slate-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-800 break-words">Historial de Movimientos</h1>
            <p className="text-slate-500 text-xs md:text-sm">Consulta y gestiona todos los registros</p>
          </div>
        </div>

        {/* Filtros */}
        <Card className="border-0 shadow-lg shadow-slate-200/50 mb-6">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por entidad, fletero, remito..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="Ingreso de Fruta">Ingreso</SelectItem>
                    <SelectItem value="Salida de Fruta">Salida</SelectItem>
                    <SelectItem value="Movimiento de Envases">Envases</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DateRangeSelector
              startDate={rangoFechas.desde}
              endDate={rangoFechas.hasta}
              onChange={({ start, end }) => setRangoFechas({ desde: start, hasta: end })}
              className="border-t border-slate-100 pt-4"
            />
          </CardContent>
        </Card>

        {/* Lista de Movimientos */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">Cargando...</div>
          ) : filteredMovimientos.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No se encontraron movimientos
            </div>
          ) : (
            filteredMovimientos.map((mov) => (
              <TarjetaMovimiento
                key={mov.id}
                mov={mov}
                isExpanded={expandedId === mov.id}
                onToggleExpand={toggleExpand}
                onDownloadPDF={handleDownloadPDF}
                onShareWhatsApp={handleShareWhatsApp}
                onEditarMovimiento={handleEditarMovimiento}
                onDelete={handleDeleteClick}
              />
            ))
          )}

          {/* Barra de Paginación */}
          {!isLoading && filteredMovimientos.length > 0 && (
            <div className="mt-6 flex items-center justify-center gap-4 py-4 px-4 rounded-lg bg-slate-50 border border-slate-100">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1 || loadingMore}
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                className="gap-1.5 min-w-[100px]"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm font-medium text-slate-700 min-w-[80px] text-center">
                Página {pagina}
                {loadingMore && <Loader2 className="h-4 w-4 inline ml-1.5 animate-spin align-middle" />}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore || loadingMore}
                onClick={() => setPagina(p => p + 1)}
                className="gap-1.5 min-w-[100px]"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
      </div>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id, tipo: deleteDialog.tipo, registro: deleteDialog.registro })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro de eliminar este {deleteDialog.registro?.tipo === 'Ingreso de Fruta' ? 'ingreso' : deleteDialog.registro?.tipo === 'Salida de Fruta' ? 'salida' : 'movimiento'}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-amber-600">Esta acción actualizará stocks y saldos automáticamente:</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                {deleteDialog.registro?.tipo === 'Ingreso de Fruta' && deleteDialog.registro?.pesajes?.length > 0 && (
                  <>
                    <li>Se restarán <strong>{deleteDialog.registro.pesajes.reduce((s, p) => s + (p.peso_neto || 0), 0).toFixed(2)} kg netos</strong> del stock de productos</li>
                    {deleteDialog.registro.movimiento_envases?.some(e => e.cantidad_ingreso > 0 || e.cantidad_salida > 0) && (
                      <li>Se revertirán los movimientos de envases asociados</li>
                    )}
                  </>
                )}
                {deleteDialog.registro?.tipo === 'Salida de Fruta' && deleteDialog.registro?.detalles?.length > 0 && (
                  <>
                    <li>Se devolverán <strong>{deleteDialog.registro.detalles.reduce((s, d) => s + ((d.kilos_reales || d.kilos_salida) - (d.descuento_kg || 0)), 0).toFixed(2)} kg</strong> al stock de productos</li>
                    {deleteDialog.registro.movimiento_envases?.some(e => e.cantidad_ingreso > 0 || e.cantidad_salida > 0) && (
                      <li>Se revertirán los movimientos de envases asociados</li>
                    )}
                  </>
                )}
                {deleteDialog.registro?.tipo === 'Movimiento de Envases' && deleteDialog.registro?.movimiento_envases?.length > 0 && (
                  <li>Se revertirán los movimientos de envases y saldos por entidad</li>
                )}
              </ul>
              <p className="text-xs text-slate-500 mt-2">Esta acción no se puede deshacer.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Eliminando y actualizando...' : 'Sí, Eliminar y Actualizar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={sugerirEliminarEntidad.open} onOpenChange={(open) => !open && setSugerirEliminarEntidad({ open: false, tipo: null, id: null, nombre: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la ficha?</AlertDialogTitle>
            <AlertDialogDescription>
              El {sugerirEliminarEntidad.tipo === 'Proveedor' ? 'Proveedor' : 'Cliente'} <strong>{sugerirEliminarEntidad.nombre}</strong> no tiene más movimientos.
              ¿Desea eliminar su ficha?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener la ficha</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (!sugerirEliminarEntidad.id || !sugerirEliminarEntidad.tipo) return;
                try {
                  if (sugerirEliminarEntidad.tipo === 'Proveedor') {
                    await base44.entities.Proveedor.delete(sugerirEliminarEntidad.id);
                  } else {
                    await base44.entities.Cliente.delete(sugerirEliminarEntidad.id);
                  }
                  invalidarTodoElSistema(queryClient);
                  toast.success(`${sugerirEliminarEntidad.tipo} "${sugerirEliminarEntidad.nombre}" eliminado.`);
                } catch (err) {
                  console.error('Error al eliminar entidad:', err);
                  toast.error('No se pudo eliminar la entidad.');
                }
                setSugerirEliminarEntidad({ open: false, tipo: null, id: null, nombre: null });
              }}
            >
              Sí, eliminar ficha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditarMovimientoModal
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, movimiento: null })}
        movimiento={editDialog.movimiento}
        onSave={handleSaveEdicion}
        isLoading={isProcessing}
      />

      <PinGuardModal />
      </div>
    </div>
  );
}