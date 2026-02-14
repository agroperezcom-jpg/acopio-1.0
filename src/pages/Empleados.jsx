import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Users, Plus, DollarSign, FileText, Calendar, TrendingUp, AlertCircle, Edit, Trash2, MessageCircle, Loader2, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import LegajoEmpleadoModal from '@/components/empleados/LegajoEmpleadoModal';
import LiquidacionSueldoModal from '@/components/empleados/LiquidacionSueldoModal';
import LiquidacionFleteroModal from '@/components/empleados/LiquidacionFleteroModal';
import FleteroModal from '@/components/empleados/FleteroModal';
import { descargarPDFLiquidacion, compartirWhatsAppLiquidacion } from '@/components/LiquidacionPDFGenerator';
import DateRangeSelector from '@/components/DateRangeSelector';
import { base44 } from '@/api/base44Client';

export default function Empleados() {
  const queryClient = useQueryClient();
  const [rango, setRango] = useState(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return { desde: startOfMonth(hoy), hasta: endOfDay(hoy) };
  });
  const [activeTab, setActiveTab] = useState('empleados');
  const [legajoModal, setLegajoModal] = useState({ open: false, item: null });
  const [liquidacionModal, setLiquidacionModal] = useState(false);
  const [fleteroModal, setFleteroModal] = useState({ open: false, item: null });
  const [selectedFletero, setSelectedFletero] = useState(null);
  const [liquidacionFleteroModal, setLiquidacionFleteroModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ open: false, item: null, type: 'empleado' });
  const [whatsappModal, setWhatsappModal] = useState({ open: false, liquidacion: null, empleado: null });
  const [ajusteMontoModal, setAjusteMontoModal] = useState({ open: false, item: null });

  const { data: empleados = [] } = useQuery({
    queryKey: ['empleadosacopio'],
    queryFn: () => base44.entities.EmpleadoAcopio.list('-fecha_alta')
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categoriasempleado'],
    queryFn: () => base44.entities.CategoriaEmpleado.list('nombre')
  });

  const { data: liquidaciones = [] } = useQuery({
    queryKey: ['liquidaciones-empleados', rango?.desde, rango?.hasta],
    queryFn: async () => {
      const desde = rango.desde.toISOString();
      const hasta = rango.hasta.toISOString();
      return base44.entities.LiquidacionSueldo.filter(
        { fecha_liquidacion: { $gte: desde, $lte: hasta } },
        '-fecha_liquidacion',
        500
      );
    },
    enabled: !!rango?.desde && !!rango?.hasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: fleteros = [] } = useQuery({
    queryKey: ['fleteros'],
    queryFn: () => base44.entities.Fletero.list('nombre')
  });

  const { data: historialPrecios = [] } = useQuery({
    queryKey: ['historialpreciofletero'],
    queryFn: () => base44.entities.HistorialPrecioFletero.list('-fecha_desde', 200),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: movimientos = [] } = useQuery({
    queryKey: ['movimientos-empleados', rango?.desde, rango?.hasta],
    queryFn: async () => {
      const desde = rango.desde.toISOString();
      const hasta = rango.hasta.toISOString();
      return base44.entities.Movimiento.filter(
        { fecha: { $gte: desde, $lte: hasta } },
        '-fecha',
        500
      );
    },
    enabled: !!rango?.desde && !!rango?.hasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: salidas = [] } = useQuery({
    queryKey: ['salidas-empleados', rango?.desde, rango?.hasta],
    queryFn: async () => {
      const desde = rango.desde.toISOString();
      const hasta = rango.hasta.toISOString();
      return base44.entities.SalidaFruta.filter(
        { fecha: { $gte: desde, $lte: hasta } },
        '-fecha',
        500
      );
    },
    enabled: !!rango?.desde && !!rango?.hasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: liquidacionesFleteros = [] } = useQuery({
    queryKey: ['liquidacionesfleteros-empleados', rango?.desde, rango?.hasta],
    queryFn: async () => {
      const desde = rango.desde.toISOString();
      const hasta = rango.hasta.toISOString();
      return base44.entities.LiquidacionFletero.filter(
        { fecha_liquidacion: { $gte: desde, $lte: hasta } },
        '-fecha_liquidacion',
        500
      );
    },
    enabled: !!rango?.desde && !!rango?.hasta,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const guardarEmpleadoMutation = useMutation({
    mutationFn: async (data) => {
      const categoria = categorias.find(c => c.id === data.categoria_empleado_id);
      const empleadoData = {
        ...data,
        categoria_empleado_nombre: categoria?.nombre || ''
      };

      if (data.id) {
        const { id, ...rest } = empleadoData;
        return base44.entities.EmpleadoAcopio.update(id, rest);
      }
      return base44.entities.EmpleadoAcopio.create(empleadoData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['empleadosacopio']);
      setLegajoModal({ open: false, item: null });
      toast.success('Empleado guardado exitosamente');
    },
    onError: () => toast.error('Error al guardar empleado')
  });

  const eliminarEmpleadoMutation = useMutation({
    mutationFn: async (id) => {
      const liquidaciones = await base44.entities.LiquidacionSueldo.filter({ empleado_id: id }, '-fecha', 1);
      if (liquidaciones && liquidaciones.length > 0) {
        throw new Error('No se puede borrar un empleado con liquidaciones asociadas.');
      }
      return base44.entities.EmpleadoAcopio.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['empleadosacopio']);
      setDeleteModal({ open: false, item: null, type: 'empleado' });
      toast.success('Empleado eliminado');
    },
    onError: (error) => toast.error(error.message || 'Error al eliminar empleado')
  });

  const guardarFleteroMutation = useMutation({
    mutationFn: async (data) => {
      let result;
      if (data.id) {
        const { id, ...rest } = data;
        
        // Verificar si cambió el precio para crear historial
        const fleteroAnterior = fleteros.find(f => f.id === id);
        if (fleteroAnterior && (
          fleteroAnterior.precio_kg !== data.precio_kg || 
          fleteroAnterior.precio_por_viaje !== data.precio_por_viaje
        )) {
          // Crear registro de historial de precio
          await base44.entities.HistorialPrecioFletero.create({
            fletero_id: id,
            fletero_nombre: data.nombre,
            fecha_desde: new Date().toISOString(),
            precio_kg: data.precio_kg || 0,
            precio_por_viaje: data.precio_por_viaje || 0,
            notas: 'Actualización de precios'
          });
        }
        
        result = await base44.entities.Fletero.update(id, rest);
      } else {
        result = await base44.entities.Fletero.create(data);
        
        // Crear primer registro de historial
        await base44.entities.HistorialPrecioFletero.create({
          fletero_id: result.id,
          fletero_nombre: data.nombre,
          fecha_desde: new Date().toISOString(),
          precio_kg: data.precio_kg || 0,
          precio_por_viaje: data.precio_por_viaje || 0,
          notas: 'Precio inicial'
        });
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['fleteros']);
      queryClient.invalidateQueries(['historialpreciofletero']);
      setFleteroModal({ open: false, item: null });
      setSelectedFletero(null);
      toast.success('Fletero guardado exitosamente');
    },
    onError: () => toast.error('Error al guardar fletero')
  });

  const ajustarMontoMutation = useMutation({
    mutationFn: async ({ item, nuevoMonto }) => {
      if (item.tipo === 'Salida de Fruta') {
        return base44.entities.SalidaFruta.update(item.salidaId, {
          monto_flete_ajustado: nuevoMonto
        });
      }
      // Para movimientos de envases no se ajusta monto por ahora
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['salidas']);
      setAjusteMontoModal({ open: false, item: null });
      toast.success('Monto ajustado correctamente');
    },
    onError: () => toast.error('Error al ajustar monto')
  });

  const recalcularMontosMutation = useMutation({
    mutationFn: async (fleteroId) => {
      // Obtener todas las salidas del fletero sin ajuste manual
      const salidasFletero = salidas.filter(s => 
        s.fletero_id === fleteroId && 
        (s.monto_flete_ajustado === undefined || s.monto_flete_ajustado === null)
      );

      // Recalcular cada salida con el precio vigente de su fecha
      for (const salida of salidasFletero) {
        const kilosSalida = (salida.detalles || []).reduce((total, d) => 
          total + (d.kilos_reales || d.kilos_salida || 0), 0
        );
        const precioKgVigente = obtenerPrecioVigente(fleteroId, salida.fecha, 'kg');
        const nuevoMonto = kilosSalida * precioKgVigente;
        
        // Actualizar con el nuevo monto calculado
        await base44.entities.SalidaFruta.update(salida.id, {
          monto_flete_ajustado: nuevoMonto
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['salidas']);
      toast.success('Montos recalculados según precios históricos');
    },
    onError: () => toast.error('Error al recalcular montos')
  });

  const eliminarFleteroMutation = useMutation({
    mutationFn: async (id) => {
      const [liquidaciones, salidasFletero, movimientosEnvasesFletero] = await Promise.all([
        base44.entities.LiquidacionFletero.filter({ fletero_id: id }, '-fecha', 1),
        base44.entities.SalidaFruta.filter({ fletero_id: id }, '-fecha', 1),
        base44.entities.Movimiento.filter({ fletero_id: id, tipo_movimiento: 'Movimiento de Envases' }, '-fecha', 1)
      ]);
      const tieneLiquidaciones = liquidaciones && liquidaciones.length > 0;
      const tieneSalidas = salidasFletero && salidasFletero.length > 0;
      const tieneMovimientosEnvases = movimientosEnvasesFletero && movimientosEnvasesFletero.length > 0;
      if (tieneLiquidaciones || tieneSalidas || tieneMovimientosEnvases) {
        throw new Error('No se puede borrar un fletero con liquidaciones, salidas o movimientos de envases asociados.');
      }
      return base44.entities.Fletero.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['fleteros']);
      setDeleteModal({ open: false, item: null, type: 'fletero' });
      setSelectedFletero(null);
      toast.success('Fletero eliminado');
    },
    onError: (error) => toast.error(error.message || 'Error al eliminar fletero')
  });

  const { data: bancos = [] } = useQuery({
    queryKey: ['bancos'],
    queryFn: () => base44.entities.Banco.list('nombre', 100)
  });

  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas'],
    queryFn: () => base44.entities.Caja.list('nombre', 100)
  });

  const guardarLiquidacionMutation = useMutation({
    mutationFn: async (data) => {
      const { _pagarAhora, ...liquidacionData } = data;
      
      // Crear la liquidación
      const liquidacionCreada = await base44.entities.LiquidacionSueldo.create(liquidacionData);
      
      // Si se paga ahora, crear registro en Pagos y actualizar saldos
      if (_pagarAhora) {
        // Crear pago en tesorería
        const pagoData = {
          fecha: new Date(liquidacionData.fecha_liquidacion).toISOString(),
          tipo_pago: 'Aplicado',
          monto_disponible: 0,
          concepto: `Liquidación Sueldo - ${liquidacionData.periodo} - ${liquidacionData.empleado_nombre}`,
          monto: liquidacionData.total_liquidacion,
          forma_pago: liquidacionData.forma_pago,
          origen_tipo: liquidacionData.origen_tipo,
          origen_id: liquidacionData.origen_id,
          origen_nombre: liquidacionData.origen_nombre,
          cheque_id: liquidacionData.cheque_id || null,
          notas: `Pago de liquidación de sueldo. Período: ${liquidacionData.periodo}`,
          liquidacion_sueldo_id: liquidacionCreada.id,
          empleado_id: liquidacionData.empleado_id,
          empleado_nombre: liquidacionData.empleado_nombre
        };
        
        const pagoCreado = await base44.entities.Pago.create(pagoData);
        
        // Actualizar liquidación con ID del pago
        await base44.entities.LiquidacionSueldo.update(liquidacionCreada.id, {
          pago_id: pagoCreado.id
        });
        
        // Actualizar saldo de banco/caja
        if (liquidacionData.origen_tipo === 'Banco') {
          const banco = bancos.find(b => b.id === liquidacionData.origen_id);
          if (banco) {
            await base44.entities.Banco.update(banco.id, {
              saldo: (banco.saldo || 0) - liquidacionData.total_liquidacion
            });
          }
        } else {
          const caja = cajas.find(c => c.id === liquidacionData.origen_id);
          if (caja) {
            await base44.entities.Caja.update(caja.id, {
              saldo: (caja.saldo || 0) - liquidacionData.total_liquidacion
            });
          }
        }
        
        // Si es cheque, actualizar estado
        if (liquidacionData.forma_pago === 'Cheque' && liquidacionData.cheque_id) {
          await base44.entities.Cheque.update(liquidacionData.cheque_id, {
            estado: 'Cobrado'
          });
        }
      }
      
      return liquidacionCreada;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-empleados'] });
      queryClient.invalidateQueries(['pagos']);
      queryClient.invalidateQueries(['bancos']);
      queryClient.invalidateQueries(['cajas']);
      queryClient.invalidateQueries(['cheques']);
      setLiquidacionModal(false);
      const empleado = empleados.find(e => e.id === result.empleado_id);
      setWhatsappModal({ open: true, liquidacion: result, empleado });
      toast.success('Liquidación guardada exitosamente');
    },
    onError: () => toast.error('Error al guardar liquidación')
  });

  const guardarLiquidacionFleteroMutation = useMutation({
    mutationFn: async (data) => {
      const { _pagarAhora, ...liquidacionData } = data;
      
      // Crear la liquidación
      const liquidacionCreada = await base44.entities.LiquidacionFletero.create(liquidacionData);
      
      // Si se paga ahora, crear registro en Pagos y actualizar saldos
      if (_pagarAhora) {
        const pagoData = {
          fecha: new Date(liquidacionData.fecha_liquidacion).toISOString(),
          tipo_pago: 'Aplicado',
          monto_disponible: 0,
          concepto: `Liquidación Fletero - ${liquidacionData.periodo} - ${liquidacionData.fletero_nombre}`,
          monto: liquidacionData.total_liquidacion,
          forma_pago: liquidacionData.forma_pago,
          origen_tipo: liquidacionData.origen_tipo,
          origen_id: liquidacionData.origen_id,
          origen_nombre: liquidacionData.origen_nombre,
          cheque_id: liquidacionData.cheque_id || null,
          notas: `Pago de liquidación de fletero. Período: ${liquidacionData.periodo}`,
          proveedor_id: liquidacionData.fletero_id,
          proveedor_nombre: liquidacionData.fletero_nombre
        };
        
        const pagoCreado = await base44.entities.Pago.create(pagoData);
        
        // Actualizar liquidación con ID del pago
        await base44.entities.LiquidacionFletero.update(liquidacionCreada.id, {
          pago_id: pagoCreado.id
        });
        
        // Actualizar saldo de banco/caja
        if (liquidacionData.origen_tipo === 'Banco') {
          const banco = bancos.find(b => b.id === liquidacionData.origen_id);
          if (banco) {
            await base44.entities.Banco.update(banco.id, {
              saldo: (banco.saldo || 0) - liquidacionData.total_liquidacion
            });
          }
        } else {
          const caja = cajas.find(c => c.id === liquidacionData.origen_id);
          if (caja) {
            await base44.entities.Caja.update(caja.id, {
              saldo: (caja.saldo || 0) - liquidacionData.total_liquidacion
            });
          }
        }
        
        // Si es cheque, actualizar estado
        if (liquidacionData.forma_pago === 'Cheque' && liquidacionData.cheque_id) {
          await base44.entities.Cheque.update(liquidacionData.cheque_id, {
            estado: 'Cobrado'
          });
        }
      }
      
      return liquidacionCreada;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidacionesfleteros-empleados'] });
      queryClient.invalidateQueries(['pagos']);
      queryClient.invalidateQueries(['bancos']);
      queryClient.invalidateQueries(['cajas']);
      queryClient.invalidateQueries(['cheques']);
      setLiquidacionFleteroModal(false);
      toast.success('✅ Liquidación de fletero guardada exitosamente');
    },
    onError: () => toast.error('Error al guardar liquidación de fletero')
  });

  // Función auxiliar para obtener precio vigente según fecha
  const obtenerPrecioVigente = (fleteroId, fecha, tipoPrecio = 'kg') => {
    const preciosOrdenados = historialPrecios
      .filter(hp => hp.fletero_id === fleteroId)
      .sort((a, b) => new Date(b.fecha_desde) - new Date(a.fecha_desde));
    
    const fechaMovimiento = new Date(fecha);
    const precioVigente = preciosOrdenados.find(hp => new Date(hp.fecha_desde) <= fechaMovimiento);
    
    if (precioVigente) {
      return tipoPrecio === 'kg' ? precioVigente.precio_kg : precioVigente.precio_por_viaje;
    }
    
    // Fallback al precio actual del fletero
    const fletero = fleteros.find(f => f.id === fleteroId);
    return tipoPrecio === 'kg' ? (fletero?.precio_kg || 0) : (fletero?.precio_por_viaje || 0);
  };

  // Función para calcular datos económicos e históricos del fletero
  const calcularDatosFletero = (fleteroId) => {
    if (!fleteroId) return { 
      viajesEnvases: 0, 
      salidasFruta: 0, 
      totalKilosTransportados: 0,
      montoAPagar: 0,
      historial: []
    };
    
    const fletero = fleteros.find(f => f.id === fleteroId);
    
    // Contar líneas de movimiento_envases contabilizadas
    let viajesEnvases = 0;
    const movimientosEnvases = movimientos
      .filter(m => m.fletero_id === fleteroId && m.tipo_movimiento === 'Movimiento de Envases');
    
    movimientosEnvases.forEach(m => {
      if (m.movimiento_envases) {
        viajesEnvases += m.movimiento_envases.filter(env => env.contabilizar_viaje === true).length;
      }
    });
    
    // Contar salidas de fruta y kilos transportados
    const salidasFletero = salidas.filter(s => s.fletero_id === fleteroId);
    const totalKilosTransportados = salidasFletero.reduce((sum, s) => {
      const kilosSalida = (s.detalles || []).reduce((total, d) => 
        total + (d.kilos_reales || d.kilos_salida || 0), 0
      );
      return sum + kilosSalida;
    }, 0);
    
    // Calcular monto a pagar considerando ajustes manuales
    let montoAPagar = 0;
    salidasFletero.forEach(s => {
      if (s.monto_flete_ajustado !== undefined && s.monto_flete_ajustado !== null) {
        montoAPagar += s.monto_flete_ajustado;
      } else {
        const kilosSalida = (s.detalles || []).reduce((total, d) => 
          total + (d.kilos_reales || d.kilos_salida || 0), 0
        );
        const precioKgVigente = obtenerPrecioVigente(fleteroId, s.fecha, 'kg');
        montoAPagar += kilosSalida * precioKgVigente;
      }
    });
    
    // Agregar montos de viajes de envases contabilizados
    movimientosEnvases.forEach(m => {
      if (m.movimiento_envases) {
        const viajesContabilizados = m.movimiento_envases.filter(env => env.contabilizar_viaje === true);
        viajesContabilizados.forEach(() => {
          const precioViajeVigente = obtenerPrecioVigente(fleteroId, m.fecha, 'viaje');
          montoAPagar += precioViajeVigente;
        });
      }
    });
    
    // Generar historial combinado
    const historial = [];
    
    // Agregar salidas de fruta
    salidasFletero.forEach(s => {
      const kilosSalida = (s.detalles || []).reduce((total, d) => 
        total + (d.kilos_reales || d.kilos_salida || 0), 0
      );
      const precioKgVigente = obtenerPrecioVigente(fleteroId, s.fecha, 'kg');
      const montoCalculado = kilosSalida * precioKgVigente;
      const montoFinal = s.monto_flete_ajustado !== undefined && s.monto_flete_ajustado !== null
        ? s.monto_flete_ajustado
        : montoCalculado;
      
      historial.push({
        id: s.id,
        salidaId: s.id,
        fecha: s.fecha,
        tipo: 'Salida de Fruta',
        descripcion: `${s.cliente_nombre} - ${s.numero_remito}`,
        kilos: kilosSalida,
        monto: montoFinal,
        montoCalculado: montoCalculado,
        precioKgVigente: precioKgVigente,
        esAjusteManual: s.monto_flete_ajustado !== undefined && s.monto_flete_ajustado !== null,
        editable: true
      });
    });
    
    // Agregar movimientos de envases contabilizados
    movimientosEnvases.forEach(m => {
      if (m.movimiento_envases) {
        m.movimiento_envases
          .filter(env => env.contabilizar_viaje === true)
          .forEach(env => {
            const precioViajeVigente = obtenerPrecioVigente(fleteroId, m.fecha, 'viaje');
            historial.push({
              id: m.id,
              movimientoId: m.id,
              fecha: m.fecha,
              tipo: 'Mov. Envases',
              descripcion: `${m.proveedor_nombre || m.cliente_nombre} - ${env.envase_tipo}`,
              cantidad_envases: (env.cantidad_ingreso || 0) + (env.cantidad_salida || 0),
              kilos: 0,
              monto: precioViajeVigente,
              precioViajeVigente: precioViajeVigente,
              contabilizado: true
            });
          });
      }
    });
    
    // Ordenar por fecha descendente
    historial.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    return {
      viajesEnvases,
      salidasFruta: salidasFletero.length,
      totalKilosTransportados,
      montoAPagar,
      historial
    };
  };

  // KPIs - UNIFICADOS (Empleados + Fleteros)
  const empleadosActivos = empleados.filter(e => e.activo);
  const fleterosActivos = fleteros.filter(f => f.activo);
  const totalPersonalActivo = empleadosActivos.length + fleterosActivos.length;
  const totalPersonalGeneral = empleados.length + fleteros.length;
  const totalSueldosPagados = liquidaciones.filter(l => l.estado === 'Pagada').reduce((sum, l) => sum + (l.total_liquidacion || 0), 0);
  const totalSueldosPendientes = liquidaciones.filter(l => l.estado === 'Pendiente').reduce((sum, l) => sum + (l.total_liquidacion || 0), 0);
  const liquidacionesEnPeriodo = liquidaciones.length;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Users className="h-8 w-8 text-purple-600" />
            Gestión de Empleados
          </h1>
          <p className="text-slate-600 mt-1">Administración de personal, legajos y liquidación de sueldos</p>
          <div className="mt-4">
            <DateRangeSelector
              startDate={rango.desde}
              endDate={rango.hasta}
              onChange={({ start, end }) => setRango({ desde: start, hasta: end })}
            />
          </div>
        </div>

        {/* KPIs Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-700 uppercase tracking-wide mb-1">Empleados Activos</p>
                  <p className="text-3xl font-bold text-purple-800">{totalPersonalActivo}</p>
                  <p className="text-xs text-purple-600 mt-1">de {totalPersonalGeneral} totales</p>
                </div>
                <Users className="h-12 w-12 text-purple-500 opacity-40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-700 uppercase tracking-wide mb-1">Sueldos Pagados</p>
                  <p className="text-3xl font-bold text-green-800">${(totalSueldosPagados / 1000).toFixed(0)}K</p>
                  <p className="text-xs text-green-600 mt-1">En el período</p>
                </div>
                <DollarSign className="h-12 w-12 text-green-500 opacity-40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-700 uppercase tracking-wide mb-1">Sueldos Pendientes</p>
                  <p className="text-3xl font-bold text-amber-800">${(totalSueldosPendientes / 1000).toFixed(0)}K</p>
                  <p className="text-xs text-amber-600 mt-1">Por pagar</p>
                </div>
                <AlertCircle className="h-12 w-12 text-amber-500 opacity-40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-700 uppercase tracking-wide mb-1">Liquidaciones en período</p>
                  <p className="text-3xl font-bold text-blue-800">{liquidacionesEnPeriodo}</p>
                  <p className="text-xs text-blue-600 mt-1">En el rango seleccionado</p>
                </div>
                <Calendar className="h-12 w-12 text-blue-500 opacity-40" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs para Empleados y Fleteros */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="empleados" className="gap-2">
              <Users className="h-4 w-4" />
              Empleados
            </TabsTrigger>
            <TabsTrigger value="fleteros" className="gap-2">
              <Truck className="h-4 w-4" />
              Fleteros
            </TabsTrigger>
          </TabsList>

          {/* TAB EMPLEADOS */}
          <TabsContent value="empleados" className="space-y-6">
            {/* Acciones Principales */}
            <div className="flex gap-3">
              <Button onClick={() => setLegajoModal({ open: true, item: null })} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                Cargar Nuevo Empleado
              </Button>
              <Button onClick={() => setLiquidacionModal(true)} className="bg-green-600 hover:bg-green-700">
                <DollarSign className="h-4 w-4 mr-2" />
                Liquidar Sueldos
              </Button>
            </div>

            {/* Lista de Empleados */}
            <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Personal Registrado</h3>
            {empleados.length === 0 ? (
              <div className="text-center py-16">
                <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">No hay empleados registrados</p>
                <Button onClick={() => setLegajoModal({ open: true, item: null })} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Cargar Primer Empleado
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {empleados.map(emp => (
                  <Card key={emp.id} className="border hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-semibold text-slate-800 text-lg">{emp.nombre}</h4>
                            <Badge variant={emp.activo ? 'default' : 'secondary'}>
                              {emp.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                            <Badge variant="outline" className="bg-blue-50">
                              {emp.categoria_empleado_nombre}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-slate-600">
                            {emp.cuit_dni && (
                              <div>
                                <span className="text-xs text-slate-500">CUIL/DNI:</span>
                                <p className="font-medium">{emp.cuit_dni}</p>
                              </div>
                            )}
                            {emp.whatsapp && (
                              <div>
                                <span className="text-xs text-slate-500">WhatsApp:</span>
                                <p className="font-medium">{emp.whatsapp}</p>
                              </div>
                            )}
                            <div>
                              <span className="text-xs text-slate-500">Fecha Alta:</span>
                              <p className="font-medium">{format(new Date(emp.fecha_alta), 'dd/MM/yyyy', { locale: es })}</p>
                            </div>
                            {emp.sueldo_base > 0 && (
                              <div>
                                <span className="text-xs text-slate-500">Sueldo Base:</span>
                                <p className="font-semibold text-green-600">${emp.sueldo_base.toLocaleString('es-AR')}</p>
                              </div>
                            )}
                          </div>

                          {emp.direccion && (
                            <p className="text-sm text-slate-600 mt-2">📍 {emp.direccion}</p>
                          )}
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => setLegajoModal({ open: true, item: emp })}>
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteModal({ open: true, item: emp })} className="text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                </div>
                )}
                </CardContent>
                </Card>

                {/* Historial de Liquidaciones */}
                <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Historial de Liquidaciones</h3>
            </div>

            {liquidaciones.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No hay liquidaciones registradas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {liquidaciones.map(liq => (
                  <Card key={liq.id} className="border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-semibold text-slate-800">{liq.empleado_nombre}</h4>
                            <Badge variant={liq.estado === 'Pagada' ? 'default' : 'secondary'}>
                              {liq.estado}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-xs text-slate-500">Período:</span>
                              <p className="font-medium">{liq.periodo}</p>
                            </div>
                            <div>
                              <span className="text-xs text-slate-500">Fecha Pago:</span>
                              <p className="font-medium">{format(new Date(liq.fecha_pago), 'dd/MM/yyyy', { locale: es })}</p>
                            </div>
                            <div>
                              <span className="text-xs text-slate-500">Total:</span>
                              <p className="font-bold text-green-600">${liq.total_liquidacion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              const emp = empleados.find(e => e.id === liq.empleado_id);
                              descargarPDFLiquidacion(liq, emp);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-green-600"
                            onClick={() => {
                              const emp = empleados.find(e => e.id === liq.empleado_id);
                              setWhatsappModal({ open: true, liquidacion: liq, empleado: emp });
                            }}
                          >
                            <MessageCircle className="h-4 w-4 mr-1" />
                            Enviar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              )}
              </CardContent>
              </Card>
              </TabsContent>

              {/* TAB FLETEROS */}
              <TabsContent value="fleteros" className="space-y-6">
              <div className="flex gap-3">
                <Button onClick={() => setFleteroModal({ open: true, item: null })} className="bg-orange-600 hover:bg-orange-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Fletero
                </Button>
                {selectedFletero && (
                  <Button onClick={() => setLiquidacionFleteroModal(true)} className="bg-green-600 hover:bg-green-700">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Liquidar Sueldo
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Lista de Fleteros */}
              <Card className="lg:col-span-1 border-0 shadow-lg">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Truck className="h-5 w-5 text-orange-600" />
                    Fleteros Registrados
                  </h3>
                  {fleteros.length === 0 ? (
                    <div className="text-center py-8">
                      <Truck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">No hay fleteros registrados</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {fleteros.map(fletero => (
                        <button
                          key={fletero.id}
                          onClick={() => setSelectedFletero(fletero)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedFletero?.id === fletero.id 
                              ? 'bg-orange-50 border-orange-300 shadow-sm' 
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-slate-800 text-sm">{fletero.nombre}</p>
                            <Badge variant={fletero.activo ? 'default' : 'secondary'} className="text-xs">
                              {fletero.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </div>
                          {fletero.whatsapp && (
                            <p className="text-xs text-slate-600">📱 {fletero.whatsapp}</p>
                          )}
                          {fletero.precio_kg > 0 && (
                            <p className="text-xs text-green-600 font-semibold mt-1">
                              ${fletero.precio_kg}/kg
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Panel de Información del Fletero */}
              <Card className="lg:col-span-2 border-0 shadow-lg">
                <CardContent className="p-6">
                  {!selectedFletero ? (
                    <div className="text-center py-16">
                      <Truck className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">Seleccione un fletero para ver su información</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Header con acciones */}
                      <div className="flex items-start justify-between pb-4 border-b">
                        <div>
                          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Truck className="h-6 w-6 text-orange-600" />
                            {selectedFletero.nombre}
                          </h2>
                          <Badge variant={selectedFletero.activo ? 'default' : 'secondary'} className="mt-2">
                            {selectedFletero.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setFleteroModal({ open: true, item: selectedFletero })}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setDeleteModal({ open: true, item: selectedFletero, type: 'fletero' })} 
                            className="text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Información de Contacto */}
                      <div className="grid grid-cols-2 gap-4">
                        <Card className="bg-slate-50">
                          <CardContent className="p-4">
                            <p className="text-xs text-slate-500 mb-1">Dirección</p>
                            <p className="font-medium text-slate-800">
                              {selectedFletero.direccion || 'No especificada'}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-slate-50">
                          <CardContent className="p-4">
                            <p className="text-xs text-slate-500 mb-1">WhatsApp</p>
                            <p className="font-medium text-slate-800">
                              {selectedFletero.whatsapp || 'No especificado'}
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Resumen Económico */}
                      <div>
                        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          Resumen Económico
                        </h3>
                        {(() => {
                          const datos = calcularDatosFletero(selectedFletero.id);
                          return (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                                <CardContent className="p-4">
                                  <p className="text-xs text-blue-700 mb-1">Salidas de Fruta</p>
                                  <p className="text-2xl font-bold text-blue-700">
                                    {datos.salidasFruta}
                                  </p>
                                  <p className="text-xs text-blue-600 mt-1">
                                    Total transportado
                                  </p>
                                </CardContent>
                              </Card>
                              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                                <CardContent className="p-4">
                                  <p className="text-xs text-purple-700 mb-1">Kilos Totales</p>
                                  <p className="text-2xl font-bold text-purple-700">
                                    {datos.totalKilosTransportados.toFixed(0)}
                                  </p>
                                  <p className="text-xs text-purple-600 mt-1">
                                    kg transportados
                                  </p>
                                </CardContent>
                              </Card>
                              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                                <CardContent className="p-4">
                                  <p className="text-xs text-amber-700 mb-1">Viajes Envases</p>
                                  <p className="text-2xl font-bold text-amber-700">
                                    {datos.viajesEnvases}
                                  </p>
                                  <p className="text-xs text-amber-600 mt-1">
                                    Contabilizados
                                  </p>
                                </CardContent>
                              </Card>
                              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                                <CardContent className="p-4">
                                  <p className="text-xs text-green-700 mb-1">Monto a Pagar</p>
                                  <p className="text-2xl font-bold text-green-700">
                                    ${((datos.totalKilosTransportados * (selectedFletero.precio_kg || 0)) + (datos.viajesEnvases * (selectedFletero.precio_por_viaje || 0))).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </p>
                                  <p className="text-xs text-green-600 mt-1">
                                    Pendiente
                                  </p>
                                </CardContent>
                              </Card>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Configuración de Pagos */}
                      <div>
                        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-slate-600" />
                          Configuración de Pagos
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                            <CardContent className="p-4">
                              <p className="text-xs text-green-700 mb-1">Precio por Kilogramo</p>
                              <p className="text-2xl font-bold text-green-700">
                                ${selectedFletero.precio_kg?.toFixed(2) || '0.00'}
                              </p>
                              <p className="text-xs text-green-600 mt-1">
                                Para salidas de fruta
                              </p>
                            </CardContent>
                          </Card>
                          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                            <CardContent className="p-4">
                              <p className="text-xs text-orange-700 mb-1">Precio por Viaje</p>
                              <p className="text-2xl font-bold text-orange-700">
                                ${selectedFletero.precio_por_viaje?.toFixed(2) || '0.00'}
                              </p>
                              <p className="text-xs text-orange-600 mt-1">
                                Para movimientos de envases
                              </p>
                            </CardContent>
                          </Card>
                          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                            <CardContent className="p-4">
                              <p className="text-xs text-blue-700 mb-1">Frecuencia de Pago</p>
                              <p className="text-lg font-bold text-blue-700">
                                {selectedFletero.frecuencia_pago || 'No especificada'}
                              </p>
                            </CardContent>
                          </Card>
                          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                            <CardContent className="p-4">
                              <p className="text-xs text-purple-700 mb-1">Día de Vencimiento</p>
                              <p className="text-lg font-bold text-purple-700">
                                {selectedFletero.dia_vencimiento ? `Día ${selectedFletero.dia_vencimiento}` : 'No especificado'}
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {/* Historial de Movimientos */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-slate-600" />
                            Historial de Transportes
                          </h3>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => recalcularMontosMutation.mutate(selectedFletero.id)}
                            disabled={recalcularMontosMutation.isPending}
                          >
                            {recalcularMontosMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <TrendingUp className="h-4 w-4 mr-2" />
                            )}
                            Recalcular Montos
                          </Button>
                        </div>
                        {(() => {
                          const datos = calcularDatosFletero(selectedFletero.id);
                          return datos.historial.length === 0 ? (
                            <Card className="bg-slate-50">
                              <CardContent className="p-8 text-center">
                                <Truck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500">No hay transportes registrados para este fletero</p>
                              </CardContent>
                            </Card>
                          ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {datos.historial.map((item, idx) => (
                                <Card key={`${item.id}-${idx}`} className="border hover:shadow-sm transition-shadow">
                                  <CardContent className="p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <Badge variant={item.tipo === 'Salida de Fruta' ? 'default' : 'outline'} className="text-xs">
                                            {item.tipo}
                                          </Badge>
                                          {item.contabilizado && (
                                            <Badge className="bg-amber-200 text-amber-900 text-xs">
                                              ✓ Contabilizado
                                            </Badge>
                                          )}
                                          {item.esAjusteManual && (
                                            <Badge className="bg-orange-200 text-orange-900 text-xs">
                                              ⚙️ Ajuste Manual
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-sm font-medium text-slate-800 truncate">{item.descripcion}</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                          {format(new Date(item.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}
                                        </p>
                                        {item.esAjusteManual && (
                                          <p className="text-xs text-orange-600 mt-1">
                                            Original: ${item.montoCalculado.toLocaleString('es-AR', { minimumFractionDigits: 0 })} 
                                            {' '} (Dif: ${(item.monto - item.montoCalculado).toLocaleString('es-AR', { minimumFractionDigits: 0, signDisplay: 'always' })})
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right shrink-0">
                                        {item.kilos > 0 && (
                                          <>
                                            <p className="text-sm font-semibold text-purple-600">
                                              {item.kilos.toFixed(0)} kg
                                            </p>
                                            <div className="flex items-center gap-2">
                                              <p className="text-lg font-bold text-green-600">
                                                ${(item.kilos * (selectedFletero.precio_kg || 0)).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                              </p>
                                              {item.editable && (
                                                <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  className="h-6 w-6"
                                                  onClick={() => setAjusteMontoModal({ open: true, item })}
                                                >
                                                  <Edit className="h-3 w-3" />
                                                </Button>
                                              )}
                                            </div>
                                            <p className="text-xs text-slate-500">
                                              Precio: ${(selectedFletero.precio_kg || 0).toFixed(2)}/kg
                                            </p>
                                          </>
                                        )}
                                        {item.cantidad_envases > 0 && (
                                          <>
                                            <p className="text-sm text-slate-600">
                                              {item.cantidad_envases} envases
                                            </p>
                                            <p className="text-lg font-bold text-orange-600">
                                              ${(selectedFletero.precio_por_viaje || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                              Precio: ${(selectedFletero.precio_por_viaje || 0).toFixed(2)}/viaje
                                            </p>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Liquidaciones del Fletero */}
                      <div>
                        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-green-600" />
                          Historial de Liquidaciones
                        </h3>
                        {(() => {
                          const liquidacionesFletero = liquidacionesFleteros.filter(
                            liq => liq.fletero_id === selectedFletero.id
                          );
                          
                          return liquidacionesFletero.length === 0 ? (
                            <Card className="bg-slate-50">
                              <CardContent className="p-8 text-center">
                                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500">No hay liquidaciones registradas para este fletero</p>
                              </CardContent>
                            </Card>
                          ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {liquidacionesFletero.map(liq => (
                                <Card key={liq.id} className="border hover:shadow-sm transition-shadow">
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                          <Badge variant={liq.estado === 'Pagada' ? 'default' : 'secondary'} className="bg-green-100 text-green-800">
                                            {liq.estado}
                                          </Badge>
                                          <span className="text-sm font-semibold text-slate-800">{liq.periodo}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                          <div>
                                            <span className="text-xs text-slate-500">Salidas de fruta:</span>
                                            <p className="font-medium text-slate-700">
                                              {liq.salidas_fruta?.length || 0} salidas • ${(liq.total_salidas_fruta || 0).toLocaleString('es-AR')}
                                            </p>
                                          </div>
                                          <div>
                                            <span className="text-xs text-slate-500">Viajes de envases:</span>
                                            <p className="font-medium text-slate-700">
                                              {liq.viajes_envases?.length || 0} viajes • ${(liq.total_viajes_envases || 0).toLocaleString('es-AR')}
                                            </p>
                                          </div>
                                          <div>
                                            <span className="text-xs text-slate-500">Fecha Pago:</span>
                                            <p className="font-medium text-slate-700">
                                              {format(new Date(liq.fecha_pago), 'dd/MM/yyyy', { locale: es })}
                                            </p>
                                          </div>
                                          {liq.forma_pago && (
                                            <div>
                                              <span className="text-xs text-slate-500">Forma de Pago:</span>
                                              <p className="font-medium text-slate-700">{liq.forma_pago}</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="text-xs text-slate-500 mb-1">Total</p>
                                        <p className="text-2xl font-bold text-green-600">
                                          ${liq.total_liquidacion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </p>
                                        {liq.estado === 'Pago Parcial' && (
                                          <p className="text-xs text-amber-600 mt-1">
                                            Pagado: ${(liq.monto_pagado || 0).toLocaleString('es-AR')}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Notas */}
                      {selectedFletero.notas && (
                        <div>
                          <h3 className="font-semibold text-slate-800 mb-2">Notas Adicionales</h3>
                          <Card className="bg-amber-50 border-amber-200">
                            <CardContent className="p-4">
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                {selectedFletero.notas}
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
              </TabsContent>
              </Tabs>
              </div>

              {/* Modales */}
              <LegajoEmpleadoModal
        open={legajoModal.open}
        empleado={legajoModal.item}
        categorias={categorias}
        onClose={() => setLegajoModal({ open: false, item: null })}
        onSave={(data) => guardarEmpleadoMutation.mutate(data)}
        isLoading={guardarEmpleadoMutation.isPending}
      />

      <LiquidacionSueldoModal
        open={liquidacionModal}
        empleados={empleados.filter(e => e.activo)}
        categorias={categorias}
        onClose={() => setLiquidacionModal(false)}
        onSave={(data) => guardarLiquidacionMutation.mutate(data)}
        isLoading={guardarLiquidacionMutation.isPending}
      />

      <WhatsAppModal
        open={whatsappModal.open}
        liquidacion={whatsappModal.liquidacion}
        empleado={whatsappModal.empleado}
        onClose={() => setWhatsappModal({ open: false, liquidacion: null, empleado: null })}
      />

      <FleteroModal
        open={fleteroModal.open}
        fletero={fleteroModal.item}
        onClose={() => setFleteroModal({ open: false, item: null })}
        onSave={(data) => guardarFleteroMutation.mutate(data)}
        isLoading={guardarFleteroMutation.isPending}
      />

      <DeleteConfirmModal
        open={deleteModal.open}
        item={deleteModal.item}
        type={deleteModal.type}
        onClose={() => setDeleteModal({ open: false, item: null, type: 'empleado' })}
        onConfirm={() => {
          if (deleteModal.type === 'fletero') {
            eliminarFleteroMutation.mutate(deleteModal.item?.id);
          } else {
            eliminarEmpleadoMutation.mutate(deleteModal.item?.id);
          }
        }}
        isLoading={eliminarEmpleadoMutation.isPending || eliminarFleteroMutation.isPending}
      />

      <AjusteMontoModal
        open={ajusteMontoModal.open}
        item={ajusteMontoModal.item}
        onClose={() => setAjusteMontoModal({ open: false, item: null })}
        onSave={(nuevoMonto) => ajustarMontoMutation.mutate({ 
          item: ajusteMontoModal.item, 
          nuevoMonto 
        })}
        isLoading={ajustarMontoMutation.isPending}
      />

      <LiquidacionFleteroModal
        open={liquidacionFleteroModal}
        fleteros={fleteros.filter(f => f.activo)}
        historialPrecios={historialPrecios}
        movimientos={movimientos}
        salidas={salidas}
        onClose={() => setLiquidacionFleteroModal(false)}
        onSave={(data) => guardarLiquidacionFleteroMutation.mutate(data)}
        isLoading={guardarLiquidacionFleteroMutation.isPending}
      />
    </div>
  );
}

function AjusteMontoModal({ open, item, onClose, onSave, isLoading }) {
  const [nuevoMonto, setNuevoMonto] = useState(0);

  React.useEffect(() => {
    if (item) {
      setNuevoMonto(item.monto || 0);
    }
  }, [item]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar Monto de Transporte</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-semibold text-blue-900 mb-2">{item.descripcion}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-blue-700">Fecha:</span>
                <p className="font-medium text-blue-900">
                  {format(new Date(item.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}
                </p>
              </div>
              <div>
                <span className="text-xs text-blue-700">Kilos:</span>
                <p className="font-medium text-blue-900">{item.kilos?.toFixed(0)} kg</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-slate-50">
              <CardContent className="p-3">
                <p className="text-xs text-slate-500 mb-1">Monto Calculado</p>
                <p className="text-lg font-bold text-slate-700">
                  ${item.montoCalculado?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {item.kilos?.toFixed(0)} kg × ${(item.montoCalculado / item.kilos)?.toFixed(2)}/kg
                </p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-3">
                <p className="text-xs text-green-700 mb-1">Nuevo Monto</p>
                <Input
                  type="number"
                  step="0.01"
                  value={nuevoMonto}
                  onChange={(e) => setNuevoMonto(parseFloat(e.target.value) || 0)}
                  className="text-lg font-bold h-auto py-1"
                />
              </CardContent>
            </Card>
          </div>

          {nuevoMonto !== item.montoCalculado && (
            <div className={`p-3 rounded-lg border ${
              nuevoMonto > item.montoCalculado 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-sm font-semibold ${
                nuevoMonto > item.montoCalculado ? 'text-green-900' : 'text-red-900'
              }`}>
                Diferencia: ${(nuevoMonto - item.montoCalculado).toLocaleString('es-AR', { minimumFractionDigits: 2, signDisplay: 'always' })}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(nuevoMonto)} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar Ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WhatsAppModal({ open, liquidacion, empleado, onClose }) {
  const [numero, setNumero] = useState('');

  React.useEffect(() => {
    if (empleado?.whatsapp) {
      setNumero(empleado.whatsapp);
    }
  }, [empleado]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartir Liquidación por WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label>Número de WhatsApp</Label>
            <Input
              type="tel"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="+54 9 11 1234-5678"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => liquidacion && descargarPDFLiquidacion(liquidacion, empleado)}
              variant="outline"
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              Ver PDF
            </Button>
            <Button 
              onClick={() => {
                if (numero && liquidacion) {
                  compartirWhatsAppLiquidacion(liquidacion, empleado, numero);
                  onClose();
                }
              }}
              disabled={!numero}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmModal({ open, item, type, onClose, onConfirm, isLoading }) {
  const nombre = item?.nombre;
  const tipoTexto = type === 'fletero' ? 'fletero' : 'empleado';
  const mensajeAdicional = type === 'fletero' 
    ? 'Si el fletero tiene movimientos asociados, no se eliminará.'
    : 'Si el empleado tiene liquidaciones asociadas, no se eliminará.';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Eliminación</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-slate-700 mb-3">
            ¿Está seguro de eliminar {tipoTexto === 'fletero' ? 'al fletero' : 'el legajo de'} <strong>{nombre}</strong>?
          </p>
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium">⚠️ Advertencia</p>
            <p className="text-xs text-red-700 mt-1">
              Esta acción no se puede deshacer. {mensajeAdicional}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}