import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, TrendingUp, TrendingDown, DollarSign, Calendar, Download, FileDown, Scale, Apple, Package, AlertTriangle, Users, Box, CheckCircle, ChevronLeft, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SearchableSelect from "@/components/SearchableSelect";
import { format, parseISO, isWithinInterval, startOfMonth, subMonths, startOfYear, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePreciosCache } from '@/components/hooks/usePreciosCache';
import { exportarExcel } from '@/components/ExportarExcel';
import { toast } from 'sonner';

export default function InformesContables() {
  const [activeTab, setActiveTab] = useState('situacion');
  const [fechaDesde, setFechaDesde] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [fechaHasta, setFechaHasta] = useState(format(new Date(), "yyyy-MM-dd"));
  const [productoSeleccionadoIndex, setProductoSeleccionadoIndex] = React.useState(0);
  const [informeGenerado, setInformeGenerado] = useState(false);
  const [advertenciaTruncado, setAdvertenciaTruncado] = useState(false);
  
  // Estados para Informe de Proveedores
  const [proveedoresInforme, setProveedoresInforme] = useState([]);
  const [fechaDesdeProveedores, setFechaDesdeProveedores] = useState('');
  const [fechaHastaProveedores, setFechaHastaProveedores] = useState('');
  const [productosFiltroProveedores, setProductosFiltroProveedores] = useState([]);
  

  
  // Hook centralizado para caché de precios
  const { obtenerPrecioVigente: obtenerPrecioVigenteCache } = usePreciosCache();

  // Estados para Informes Operativos
  const [tipoInforme, setTipoInforme] = useState('proveedor');
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState([]);
  const [clientesSeleccionados, setClientesSeleccionados] = useState([]);
  const [fechaDesdeOp, setFechaDesdeOp] = useState('');
  const [fechaHastaOp, setFechaHastaOp] = useState('');
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [busquedaProveedor, setBusquedaProveedor] = useState('');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const registrosPorPagina = 20;
  const [camposSeleccionados, setCamposSeleccionados] = useState({
    fecha: true,
    tipo: true,
    fletero: true,
    remito: true,
    comprobante: true,
    productos: true,
    pesajes_detallados: false,
    envases: true,
    totales: true,
    saldos: false
  });

  const { data: movimientos = [], isLoading: loadingMovimientos } = useQuery({
    queryKey: ['movimientos', fechaDesde, fechaHasta],
    queryFn: async () => {
      const desde = new Date(fechaDesde).toISOString();
      const hasta = new Date(fechaHasta + 'T23:59:59').toISOString();
      return base44.entities.Movimiento.filter(
        { fecha: { $gte: desde, $lte: hasta } },
        '-fecha',
        1000
      );
    },
    enabled: informeGenerado,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: salidas = [], isLoading: loadingSalidas } = useQuery({
    queryKey: ['salidas', fechaDesde, fechaHasta],
    queryFn: async () => {
      const desde = new Date(fechaDesde).toISOString();
      const hasta = new Date(fechaHasta + 'T23:59:59').toISOString();
      return base44.entities.SalidaFruta.filter(
        { fecha: { $gte: desde, $lte: hasta } },
        '-fecha',
        1000
      );
    },
    enabled: informeGenerado,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: egresos = [], isLoading: loadingEgresos } = useQuery({
    queryKey: ['egresos', fechaDesde, fechaHasta],
    queryFn: async () => {
      const desde = new Date(fechaDesde).toISOString();
      const hasta = new Date(fechaHasta + 'T23:59:59').toISOString();
      return base44.entities.Egreso.filter(
        { fecha: { $gte: desde, $lte: hasta } },
        '-fecha',
        1000
      );
    },
    enabled: informeGenerado,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: ingresosvarios = [], isLoading: loadingIngresos } = useQuery({
    queryKey: ['ingresosvarios', fechaDesde, fechaHasta],
    queryFn: async () => {
      const desde = new Date(fechaDesde).toISOString();
      const hasta = new Date(fechaHasta + 'T23:59:59').toISOString();
      return base44.entities.IngresoVario.filter(
        { fecha: { $gte: desde, $lte: hasta } },
        '-fecha',
        1000
      );
    },
    enabled: informeGenerado,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: pagos = [], isLoading: loadingPagos } = useQuery({
    queryKey: ['pagos', fechaDesde, fechaHasta],
    queryFn: async () => {
      const desde = new Date(fechaDesde).toISOString();
      const hasta = new Date(fechaHasta + 'T23:59:59').toISOString();
      return base44.entities.Pago.filter(
        { fecha: { $gte: desde, $lte: hasta } },
        '-fecha',
        1000
      );
    },
    enabled: informeGenerado,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: cobros = [], isLoading: loadingCobros } = useQuery({
    queryKey: ['cobros', fechaDesde, fechaHasta],
    queryFn: async () => {
      const desde = new Date(fechaDesde).toISOString();
      const hasta = new Date(fechaHasta + 'T23:59:59').toISOString();
      return base44.entities.Cobro.filter(
        { fecha: { $gte: desde, $lte: hasta } },
        '-fecha',
        1000
      );
    },
    enabled: informeGenerado,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: movimientosTesoreria = [], isLoading: loadingMovTesoreria } = useQuery({
    queryKey: ['movimientostesoreria', fechaDesde, fechaHasta],
    queryFn: async () => {
      const desde = new Date(fechaDesde).toISOString();
      const hasta = new Date(fechaHasta + 'T23:59:59').toISOString();
      return base44.entities.MovimientoTesoreria.filter(
        { fecha: { $gte: desde, $lte: hasta } },
        '-fecha',
        1000
      );
    },
    enabled: informeGenerado,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: productos = [] } = useQuery({
    queryKey: ['productos'],
    queryFn: () => base44.entities.Producto.list('fruta', 200),
    enabled: activeTab === 'operativos' && informeGenerado, // Solo carga en tab operativos
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: proveedores = [] } = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => base44.entities.Proveedor.list('nombre', 200),
    enabled: activeTab === 'operativos' && informeGenerado, // Solo carga en tab operativos
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('nombre', 200),
    enabled: activeTab === 'operativos' && informeGenerado, // Solo carga en tab operativos
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: envases = [] } = useQuery({
    queryKey: ['envases'],
    queryFn: () => base44.entities.Envase.list('tipo', 100),
    enabled: activeTab === 'situacion' && informeGenerado, // Solo carga en tab situación
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: ajustesManuales = [] } = useQuery({
    queryKey: ['ajustes-manuales'],
    queryFn: () => base44.entities.AjusteManualEnvase.list(),
    enabled: false, // No se usa actualmente, mantener desactivado
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Queries específicas para KPIs del Dashboard "Situación Actual"
  const { data: envasesKPI = [] } = useQuery({
    queryKey: ['envases-kpi'],
    queryFn: () => base44.entities.Envase.list('tipo', 100), // Envases suelen ser pocos (<50)
    enabled: activeTab === 'situacion' && informeGenerado,
    staleTime: 30 * 60 * 1000, // Cache de 30 min (los stocks se actualizan con movimientos)
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: productosKPI = [] } = useQuery({
    queryKey: ['productos-kpi'],
    queryFn: () => base44.entities.Producto.filter(
      { stock: { $gt: 0 } }, // Solo productos con stock
      'fruta',
      200
    ),
    enabled: activeTab === 'situacion' && informeGenerado,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Detectar si alguna query alcanzó el límite de 1000
  React.useEffect(() => {
    if (!informeGenerado) return;
    
    const alcanzaLimite = 
      movimientos.length === 1000 ||
      salidas.length === 1000 ||
      egresos.length === 1000 ||
      ingresosvarios.length === 1000 ||
      pagos.length === 1000 ||
      cobros.length === 1000 ||
      movimientosTesoreria.length === 1000;
    
    setAdvertenciaTruncado(alcanzaLimite);
  }, [movimientos.length, salidas.length, egresos.length, ingresosvarios.length, pagos.length, cobros.length, movimientosTesoreria.length, informeGenerado]);

  const isLoadingInforme = loadingMovimientos || loadingSalidas || loadingEgresos || loadingIngresos || loadingPagos || loadingCobros || loadingMovTesoreria;

  const aplicarRangoRapido = (desde, hasta) => {
    setFechaDesde(format(desde, "yyyy-MM-dd"));
    setFechaHasta(format(hasta, "yyyy-MM-dd"));
    setInformeGenerado(false);
  };

  const handleGenerarInforme = () => {
    if (!fechaDesde || !fechaHasta) {
      toast.error('Por favor seleccione un rango de fechas');
      return;
    }
    
    const desde = new Date(fechaDesde);
    const hasta = new Date(fechaHasta + 'T23:59:59');
    const diasDiferencia = Math.ceil((hasta - desde) / (1000 * 60 * 60 * 24));
    
    if (diasDiferencia > 365) {
      toast.error('El rango máximo permitido es de 1 año (365 días)');
      return;
    }

    if (diasDiferencia > 180) {
      toast.warning('Estás solicitando un periodo muy largo. El sistema limitará los resultados a los primeros 1000 registros por seguridad.');
    }
    
    setInformeGenerado(true);
    setAdvertenciaTruncado(false);
  };

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD SITUACIÓN ACTUAL DEL ACOPIO
  // ═══════════════════════════════════════════════════════════════════
  
  const perdidasEfectivas = useMemo(() => {
    const salidasConfirmadas = salidas.filter(s => s.estado === 'Confirmada');
    let perdidaBascula = 0;
    let perdidaCalidad = 0;
    
    salidasConfirmadas.forEach(s => {
      s.detalles?.forEach(d => {
        const original = d.kilos_salida || 0;
        const reales = d.kilos_reales || original;
        const descuento = d.descuento_kg || 0;
        
        perdidaBascula += (original - reales);
        perdidaCalidad += descuento;
      });
    });
    
    const total = perdidaBascula + perdidaCalidad;
    return { bascula: perdidaBascula, calidad: perdidaCalidad, total };
  }, [salidas]);

  const ingresosTotalesPorProducto = useMemo(() => {
    const ingresosMap = {};
    
    movimientos.forEach(m => {
      if (m.tipo_movimiento === 'Ingreso de Fruta' && m.pesajes) {
        m.pesajes.forEach(p => {
          if (p.producto_id && p.peso_neto > 0) {
            if (!ingresosMap[p.producto_id]) {
              ingresosMap[p.producto_id] = {
                id: p.producto_id,
                nombre: p.producto_nombre || 'Producto sin nombre',
                kilosAcumulados: 0
              };
            }
            ingresosMap[p.producto_id].kilosAcumulados += p.peso_neto;
          }
        });
      }
    });
    
    return Object.values(ingresosMap)
      .filter(p => p.kilosAcumulados > 0)
      .sort((a, b) => b.kilosAcumulados - a.kilosAcumulados);
  }, [movimientos]);

  const totalIngresosAcumulados = useMemo(() => {
    return ingresosTotalesPorProducto.reduce((sum, p) => sum + p.kilosAcumulados, 0);
  }, [ingresosTotalesPorProducto]);

  const frutaRealACobrar = useMemo(() => {
    return totalIngresosAcumulados - perdidasEfectivas.total;
  }, [totalIngresosAcumulados, perdidasEfectivas]);

  const perdidasPorProducto = useMemo(() => {
    const perdidasMap = {};
    
    salidas.forEach(s => {
      if (s.estado === 'Confirmada' && s.detalles) {
        s.detalles.forEach(d => {
          if (d.producto_id) {
            if (!perdidasMap[d.producto_id]) {
              perdidasMap[d.producto_id] = 0;
            }
            const original = d.kilos_salida || 0;
            const reales = d.kilos_reales || original;
            const descuento = d.descuento_kg || 0;
            const perdidaTotal = (original - reales) + descuento;
            perdidasMap[d.producto_id] += perdidaTotal;
          }
        });
      }
    });
    
    return perdidasMap;
  }, [salidas]);

  const gananciaPotencial = useMemo(() => {
    let totalCompra = 0;
    let totalVenta = 0;
    
    movimientos.forEach(m => {
      if (m.tipo_movimiento === 'Ingreso de Fruta' && m.pesajes) {
        m.pesajes.forEach(p => {
          if (p.producto_id && p.peso_neto > 0) {
            const precioCompra = obtenerPrecioVigenteCache(p.producto_id, m.fecha, 'compra');
            const precioVenta = obtenerPrecioVigenteCache(p.producto_id, m.fecha, 'venta');
            
            const costoCompra = p.peso_neto * precioCompra;
            
            const perdidasProducto = perdidasPorProducto[p.producto_id] || 0;
            const ingresosTotalesProducto = ingresosTotalesPorProducto.find(ing => ing.id === p.producto_id)?.kilosAcumulados || p.peso_neto;
            const proporcionPerdida = ingresosTotalesProducto > 0 ? perdidasProducto / ingresosTotalesProducto : 0;
            const kilosReales = p.peso_neto * (1 - proporcionPerdida);
            const ingresoVenta = kilosReales * precioVenta;
            
            totalCompra += costoCompra;
            totalVenta += ingresoVenta;
          }
        });
      }
    });
    
    const ganancia = totalVenta - totalCompra;
    
    return {
      totalCompra,
      totalVenta,
      ganancia,
      margen: totalCompra > 0 ? (ganancia / totalCompra) * 100 : 0
    };
  }, [movimientos, obtenerPrecioVigenteCache, perdidasPorProducto, ingresosTotalesPorProducto]);

  const statsAcopio = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const movHoy = movimientos.filter(m => new Date(m.fecha) >= hoy);
    const ingresosHoy = movHoy.filter(m => m.tipo_movimiento === 'Ingreso de Fruta');
    
    const pesoNetoHoy = ingresosHoy.reduce((sum, m) => 
      sum + (m.pesajes?.reduce((s, p) => s + (p.peso_neto || 0), 0) || 0), 0
    );

    // Stock de envases: lectura desde queries KPI optimizadas (stocks vivos)
    const totalVacios = envasesKPI.reduce((sum, e) => sum + (Number(e.stock_vacios) || 0), 0);
    const totalOcupados = envasesKPI.reduce((sum, e) => sum + (Number(e.stock_ocupados) || 0), 0);
    const stockTotalKilos = productosKPI.reduce((sum, p) => sum + (p.stock || 0), 0);

    return {
      ingresosHoy: ingresosHoy.length,
      pesoNetoHoy,
      totalVacios,
      totalOcupados,
      stockTotalKilos
    };
  }, [movimientos, envasesKPI, productosKPI]);

  // ═══════════════════════════════════════════════════════════════════
  // FIN DASHBOARD SITUACIÓN ACTUAL
  // ═══════════════════════════════════════════════════════════════════

  const estadoResultado = useMemo(() => {
    const desde = parseISO(fechaDesde);
    const hasta = parseISO(fechaHasta);

    // ═══════════════════════════════════════════════════════════════════
    // INGRESOS: Solo ventas cobradas (cobros realizados)
    // ═══════════════════════════════════════════════════════════════════
    let ingresosPorVentas = 0;
    const cobrosPeriodo = cobros.filter(c => {
      const fechaCobro = parseISO(c.fecha);
      if (!isWithinInterval(fechaCobro, { start: desde, end: hasta })) return false;
      
      // SOLO cobros con MovimientoTesoreria (efectivamente realizados)
      const tieneMovimientos = movimientosTesoreria.some(m => 
        m.referencia_origen_id === c.id && m.referencia_origen_tipo === 'Cobro'
      );
      return tieneMovimientos;
    });
    
    ingresosPorVentas = cobrosPeriodo.reduce((sum, c) => sum + (c.monto_total || 0), 0);

    // ═══════════════════════════════════════════════════════════════════
    // OTROS INGRESOS: Solo IngresoVario con MovimientoTesoreria
    // ═══════════════════════════════════════════════════════════════════
    const ingresosPorCuenta = {};
    const ingresosVariosPeriodo = ingresosvarios.filter(iv => {
      const fechaIV = parseISO(iv.fecha);
      if (!isWithinInterval(fechaIV, { start: desde, end: hasta })) return false;
      
      // SOLO ingresos con MovimientoTesoreria (efectivamente realizados)
      const tieneMovimientos = movimientosTesoreria.some(m => 
        m.referencia_origen_id === iv.id && m.referencia_origen_tipo === 'IngresoVario'
      );
      return tieneMovimientos;
    });
    
    ingresosVariosPeriodo.forEach(iv => {
      const cuentaKey = iv.cuenta_nombre || 'Sin categoría';
      if (!ingresosPorCuenta[cuentaKey]) {
        ingresosPorCuenta[cuentaKey] = 0;
      }
      ingresosPorCuenta[cuentaKey] += iv.monto || 0;
    });

    const totalIngresosVarios = Object.values(ingresosPorCuenta).reduce((sum, v) => sum + v, 0);

    // ═══════════════════════════════════════════════════════════════════
    // COSTO DE VENTAS: SOLO costo de compra de fruta (UNA SOLA VEZ)
    // Se calcula: kilos comprados × precio de compra vigente
    // NO incluir: pagos, deudas, egresos, ni otros conceptos
    // ═══════════════════════════════════════════════════════════════════
    let costoCompraFruta = 0;
    const movimientosPeriodo = movimientos.filter(m => {
      const fechaMov = parseISO(m.fecha);
      return m.tipo_movimiento === 'Ingreso de Fruta' && isWithinInterval(fechaMov, { start: desde, end: hasta });
    });

    movimientosPeriodo.forEach(mov => {
      mov.pesajes?.forEach(pesaje => {
        const pesoNeto = pesaje.peso_neto || 0;
        const precioCompra = obtenerPrecioVigenteCache(pesaje.producto_id, mov.fecha, 'compra');
        costoCompraFruta += pesoNeto * precioCompra;
      });
    });

    // ═══════════════════════════════════════════════════════════════════
    // GASTOS OPERATIVOS: Solo egresos clasificados como "Gasto"
    // NO incluir pagos de deudas comerciales
    // ═══════════════════════════════════════════════════════════════════
    const gastosPorCuenta = {};
    const gastosPeriodo = egresos.filter(e => {
      const fechaEgr = parseISO(e.fecha);
      return e.tipo === 'Gasto' && isWithinInterval(fechaEgr, { start: desde, end: hasta });
    });
    
    gastosPeriodo.forEach(e => {
      const cuentaKey = e.cuenta_nombre || 'Sin categoría';
      if (!gastosPorCuenta[cuentaKey]) {
        gastosPorCuenta[cuentaKey] = 0;
      }
      gastosPorCuenta[cuentaKey] += e.monto || 0;
    });

    const totalGastos = Object.values(gastosPorCuenta).reduce((sum, v) => sum + v, 0);

    // ═══════════════════════════════════════════════════════════════════
    // CÁLCULOS FINALES
    // ═══════════════════════════════════════════════════════════════════
    const ingresosTotales = ingresosPorVentas + totalIngresosVarios;
    const costoVentasTotal = costoCompraFruta; // SOLO costo de compra de fruta
    const utilidadBruta = ingresosTotales - costoVentasTotal;
    const resultadoOperativo = utilidadBruta - totalGastos;
    const resultadoNeto = resultadoOperativo;

    return {
      ingresosPorVentas,
      ingresosPorCuenta,
      totalIngresosVarios,
      ingresosTotales,
      costoCompraFruta,
      costoVentasTotal,
      utilidadBruta,
      gastosPorCuenta,
      totalGastos,
      resultadoOperativo,
      resultadoNeto,
      margenBruto: ingresosTotales > 0 ? (utilidadBruta / ingresosTotales * 100) : 0,
      margenNeto: ingresosTotales > 0 ? (resultadoNeto / ingresosTotales * 100) : 0
    };
  }, [movimientos, salidas, egresos, ingresosvarios, pagos, cobros, obtenerPrecioVigenteCache, fechaDesde, fechaHasta, movimientosTesoreria]);

  // Informes Operativos
  const movimientosFiltrados = useMemo(() => {
    if (tipoInforme === 'proveedor') {
      if (proveedoresSeleccionados.length === 0) return [];
      return movimientos.filter(m => {
        // Solo mostrar Ingreso de Fruta, no Movimiento de Envases
        if (m.tipo_movimiento !== 'Ingreso de Fruta') return false;
        if (!proveedoresSeleccionados.includes(m.proveedor_id)) return false;
        const fechaMov = new Date(m.fecha);
        if (fechaDesdeOp && fechaMov < new Date(fechaDesdeOp)) return false;
        if (fechaHastaOp && fechaMov > new Date(fechaHastaOp + 'T23:59:59')) return false;
        return true;
      });
    } else {
      if (clientesSeleccionados.length === 0) return [];
      const movCliente = movimientos.filter(m => {
        if (!clientesSeleccionados.includes(m.cliente_id)) return false;
        const fechaMov = new Date(m.fecha);
        if (fechaDesdeOp && fechaMov < new Date(fechaDesdeOp)) return false;
        if (fechaHastaOp && fechaMov > new Date(fechaHastaOp + 'T23:59:59')) return false;
        return true;
      });

      const salidasCliente = salidas.filter(s => {
        if (!clientesSeleccionados.includes(s.cliente_id)) return false;
        const fechaSal = new Date(s.fecha);
        if (fechaDesdeOp && fechaSal < new Date(fechaDesdeOp)) return false;
        if (fechaHastaOp && fechaSal > new Date(fechaHastaOp + 'T23:59:59')) return false;
        return true;
      });

      return [...movCliente, ...salidasCliente].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }
  }, [movimientos, salidas, tipoInforme, proveedoresSeleccionados, clientesSeleccionados, fechaDesdeOp, fechaHastaOp]);

  const totalesOperativos = useMemo(() => {
    const totalesProductos = {};
    const todosLosProductos = new Set();

    if (tipoInforme === 'proveedor') {
      movimientosFiltrados.forEach(m => {
        if (m.tipo_movimiento === 'Ingreso de Fruta' && m.pesajes) {
          m.pesajes.forEach(p => {
            if (!productosSeleccionados.length || productosSeleccionados.includes(p.producto_id)) {
              todosLosProductos.add(p.producto_nombre);
              if (!totalesProductos[p.producto_nombre]) totalesProductos[p.producto_nombre] = 0;
              totalesProductos[p.producto_nombre] += p.peso_neto || 0;
            }
          });
        }
      });
    } else {
      movimientosFiltrados.forEach(item => {
        if (item.detalles) {
          item.detalles.forEach(d => {
            if (!productosSeleccionados.length || productosSeleccionados.includes(d.producto_id)) {
              todosLosProductos.add(d.producto_nombre);
              const efectivos = (d.kilos_reales || d.kilos_salida) - (d.descuento_kg || 0);
              if (!totalesProductos[d.producto_nombre]) totalesProductos[d.producto_nombre] = { efectivos: 0 };
              totalesProductos[d.producto_nombre].efectivos += efectivos;
            }
          });
        }
      });
    }
    return { totalesProductos, todosLosProductos: Array.from(todosLosProductos).sort() };
  }, [movimientosFiltrados, productosSeleccionados, tipoInforme]);

  const entidadesSeleccionadas = tipoInforme === 'proveedor'
    ? proveedores.filter(p => proveedoresSeleccionados.includes(p.id))
    : clientes.filter(c => clientesSeleccionados.includes(c.id));
  
  const nombreEntidades = entidadesSeleccionadas.length === 0 
    ? 'Ninguno' 
    : entidadesSeleccionadas.length === 1 
      ? entidadesSeleccionadas[0].nombre 
      : `${entidadesSeleccionadas.length} ${tipoInforme === 'proveedor' ? 'proveedores' : 'clientes'}`;



  const exportarPDF = () => {
    const periodoText = `${fechaDesdeOp ? format(new Date(fechaDesdeOp), 'dd/MM/yyyy') : 'Inicio'} - ${fechaHastaOp ? format(new Date(fechaHastaOp), 'dd/MM/yyyy') : 'Hoy'}`;
    let headers = [];
    if (camposSeleccionados.fecha) headers.push('<th>Fecha</th>');
    if (entidadesSeleccionadas.length > 1) {
      headers.push(`<th>${tipoInforme === 'proveedor' ? 'Proveedor' : 'Cliente'}</th>`);
    }
    if (tipoInforme === 'cliente') {
      if (camposSeleccionados.remito) headers.push('<th>Remito R</th>');
      if (camposSeleccionados.comprobante) headers.push('<th>Comp. Cliente</th>');
    } else {
      if (camposSeleccionados.fletero) headers.push('<th>Fletero</th>');
    }
    
    totalesOperativos.todosLosProductos.forEach(prod => {
      headers.push(`<th>${prod} (kg)</th>`);
    });
    headers.push('<th>Total (kg)</th>');
    
    let movimientosHTML = movimientosFiltrados.map(item => {
      let cells = [];
      if (camposSeleccionados.fecha) cells.push(`<td>${format(new Date(item.fecha), 'dd/MM/yyyy HH:mm')}</td>`);
      if (entidadesSeleccionadas.length > 1) {
        cells.push(`<td>${tipoInforme === 'proveedor' ? item.proveedor_nombre : item.cliente_nombre}</td>`);
      }
      if (tipoInforme === 'cliente') {
        if (camposSeleccionados.remito) cells.push(`<td>${item.numero_remito || '-'}</td>`);
        if (camposSeleccionados.comprobante) cells.push(`<td>${item.comprobante_cliente || '-'}</td>`);
      }
      if (tipoInforme === 'proveedor' && camposSeleccionados.fletero) cells.push(`<td>${item.fletero_nombre || '-'}</td>`);
      
      const productosPorIngreso = {};
      let totalIngreso = 0;
      
      if (tipoInforme === 'proveedor' && item.pesajes) {
        item.pesajes.forEach(p => {
          if (!productosSeleccionados.length || productosSeleccionados.includes(p.producto_id)) {
            if (!productosPorIngreso[p.producto_nombre]) productosPorIngreso[p.producto_nombre] = 0;
            productosPorIngreso[p.producto_nombre] += p.peso_neto || 0;
            totalIngreso += p.peso_neto || 0;
          }
        });
      } else if (item.detalles) {
        item.detalles.forEach(d => {
          if (!productosSeleccionados.length || productosSeleccionados.includes(d.producto_id)) {
            const efectivos = (d.kilos_reales || d.kilos_salida) - (d.descuento_kg || 0);
            if (!productosPorIngreso[d.producto_nombre]) productosPorIngreso[d.producto_nombre] = 0;
            productosPorIngreso[d.producto_nombre] += efectivos;
            totalIngreso += efectivos;
          }
        });
      }
      
      totalesOperativos.todosLosProductos.forEach(prod => {
        const valor = productosPorIngreso[prod] || 0;
        cells.push(`<td style="text-align:right">${valor > 0 ? valor.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '-'}</td>`);
      });
      cells.push(`<td style="text-align:right;font-weight:bold">${totalIngreso.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>`);
      
      return `<tr>${cells.join('')}</tr>`;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>Informe - ${nombreEntidades}</title>
      <style>body{font-family:Arial;font-size:10px;padding:20px}.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #3b82f6;padding-bottom:10px}
      .title{font-size:18px;font-weight:bold;color:#1e40af}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #ddd;padding:6px;text-align:left}
      th{background:#eff6ff;font-weight:600;font-size:9px}.totales{background:#dbeafe;font-weight:bold}</style></head><body>
      <div class="header"><div class="title">INFORME ${tipoInforme === 'proveedor' ? 'DE PROVEEDOR' : 'DE CLIENTE'}</div>
      <p>${nombreEntidades}</p><p>Período: ${periodoText}</p></div>
      ${headers.length > 0 ? `<h3>Detalle de Movimientos</h3><table><thead><tr>${headers.join('')}</tr></thead><tbody>${movimientosHTML}</tbody></table>` : ''}
      ${camposSeleccionados.totales ? '<h3>Totales del Período</h3><table><thead><tr><th>Producto</th><th>Total Peso Neto</th></tr></thead><tbody>' + 
        Object.entries(totalesOperativos.totalesProductos).map(([prod, datos]) => 
          `<tr><td>${prod}</td><td>${tipoInforme === 'proveedor' ? datos.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : datos.efectivos.toLocaleString('es-AR', { minimumFractionDigits: 2 })} kg</td></tr>`
        ).join('') + '</tbody></table>' : ''}
      <p>Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p></body></html>`;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  const exportarExcelOperativo = () => {
    const datosExportar = movimientosFiltrados.map(item => {
      const fila = {};
      
      if (camposSeleccionados.fecha) {
        fila['Fecha'] = format(new Date(item.fecha), 'dd/MM/yyyy HH:mm');
      }
      if (entidadesSeleccionadas.length > 1) {
        fila[tipoInforme === 'proveedor' ? 'Proveedor' : 'Cliente'] = tipoInforme === 'proveedor' ? item.proveedor_nombre : item.cliente_nombre;
      }
      if (tipoInforme === 'proveedor' && camposSeleccionados.fletero) {
        fila['Fletero'] = item.fletero_nombre || '';
      }
      if (tipoInforme === 'cliente') {
        if (camposSeleccionados.remito) fila['Remito R'] = item.numero_remito || '';
        if (camposSeleccionados.comprobante) fila['Comp. Cliente'] = item.comprobante_cliente || '';
      }
      
      const productosPorIngreso = {};
      let totalIngreso = 0;
      
      if (tipoInforme === 'proveedor' && item.pesajes) {
        item.pesajes.forEach(p => {
          if (!productosSeleccionados.length || productosSeleccionados.includes(p.producto_id)) {
            if (!productosPorIngreso[p.producto_nombre]) productosPorIngreso[p.producto_nombre] = 0;
            productosPorIngreso[p.producto_nombre] += p.peso_neto || 0;
            totalIngreso += p.peso_neto || 0;
          }
        });
      } else if (item.detalles) {
        item.detalles.forEach(d => {
          if (!productosSeleccionados.length || productosSeleccionados.includes(d.producto_id)) {
            const efectivos = (d.kilos_reales || d.kilos_salida) - (d.descuento_kg || 0);
            if (!productosPorIngreso[d.producto_nombre]) productosPorIngreso[d.producto_nombre] = 0;
            productosPorIngreso[d.producto_nombre] += efectivos;
            totalIngreso += efectivos;
          }
        });
      }
      
      totalesOperativos.todosLosProductos.forEach(prod => {
        const valor = productosPorIngreso[prod] || 0;
        fila[`${prod} (kg)`] = parseFloat(valor.toFixed(2));
      });
      fila['Total (kg)'] = parseFloat(totalIngreso.toFixed(2));
      
      return fila;
    });

    const nombreArchivo = entidadesSeleccionadas.length === 1 
      ? entidadesSeleccionadas[0].nombre.replace(/\s+/g, '_')
      : `${entidadesSeleccionadas.length}_${tipoInforme}s`;
    exportarExcel(datosExportar, `informe_${nombreArchivo}_${format(new Date(), 'yyyyMMdd')}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-800 flex items-center gap-2 md:gap-3">
            <FileText className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
            Informes
          </h1>
          <p className="text-sm md:text-base text-slate-600 mt-1">Informes contables y operativos</p>
        </div>

        {/* Panel de Control de Rango de Fechas */}
        <Card className="border-0 shadow-lg mb-6 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => aplicarRangoRapido(startOfMonth(new Date()), new Date())}
                className="text-xs"
              >
                Este Mes
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => aplicarRangoRapido(
                  startOfMonth(subMonths(new Date(), 1)),
                  endOfMonth(subMonths(new Date(), 1))
                )}
                className="text-xs"
              >
                Mes Pasado
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => aplicarRangoRapido(
                  startOfMonth(subMonths(new Date(), 2)),
                  new Date()
                )}
                className="text-xs"
              >
                Últimos 3 Meses
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => aplicarRangoRapido(startOfYear(new Date()), new Date())}
                className="text-xs"
              >
                Este Año
              </Button>
            </div>
            <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Fecha Desde *</label>
                  <Input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => {
                      setFechaDesde(e.target.value);
                      setInformeGenerado(false);
                    }}
                    className="bg-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Fecha Hasta *</label>
                  <Input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => {
                      setFechaHasta(e.target.value);
                      setInformeGenerado(false);
                    }}
                    className="bg-white"
                  />
                </div>
              </div>
              <Button
                onClick={handleGenerarInforme}
                disabled={isLoadingInforme || !fechaDesde || !fechaHasta}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
              >
                {isLoadingInforme ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5 mr-2" />
                    Generar Informe
                  </>
                )}
              </Button>
            </div>
            
            {advertenciaTruncado && (
              <div className="mt-4 p-3 bg-amber-100 border border-amber-300 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p className="font-semibold mb-1">⚠️ Informe truncado</p>
                  <p>Se alcanzó el límite de 1.000 registros. Los datos pueden estar incompletos. Por favor, reduce el rango de fechas para un informe más preciso.</p>
                </div>
              </div>
            )}
            
            {!informeGenerado && (
              <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">ℹ️ Selecciona un rango de fechas</p>
                  <p>Para evitar sobrecargas, debes seleccionar un período específico (máximo 1 año). Luego haz clic en "Generar Informe".</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 mb-4 md:mb-6">
                <TabsTrigger value="situacion" className="text-xs md:text-sm">
                  <Scale className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Situación</span>
                  <span className="sm:hidden">Sit.</span>
                </TabsTrigger>
                <TabsTrigger value="contables" className="text-xs md:text-sm">
                  <DollarSign className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Resultados</span>
                  <span className="sm:hidden">Res.</span>
                </TabsTrigger>
                <TabsTrigger value="operativos" className="text-xs md:text-sm">
                  <FileText className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Operativos</span>
                  <span className="sm:hidden">Op.</span>
                </TabsTrigger>
                <TabsTrigger value="proveedores" className="text-xs md:text-sm">
                  <Users className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Proveedores</span>
                  <span className="sm:hidden">Prov.</span>
                </TabsTrigger>
              </TabsList>

              {/* TAB SITUACIÓN ACTUAL */}
              <TabsContent value="situacion">
                {!informeGenerado ? (
                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-12 text-center">
                      <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-700 mb-2">
                        Informe no generado
                      </h3>
                      <p className="text-slate-500">
                        Selecciona un rango de fechas y haz clic en "Generar Informe"
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                <div className="space-y-6">
                  {/* Dashboards principales */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-green-100">
                      <CardContent className="p-5">
                        {ingresosTotalesPorProducto.length > 0 ? (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <button
                                onClick={() => setProductoSeleccionadoIndex(productoSeleccionadoIndex === 0 ? ingresosTotalesPorProducto.length - 1 : productoSeleccionadoIndex - 1)}
                                className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow hover:shadow-md transition-shadow"
                                disabled={ingresosTotalesPorProducto.length <= 1}
                              >
                                <ChevronLeft className="h-5 w-5 text-green-700" />
                              </button>
                              <div className="text-center flex-1">
                                <p className="text-xs text-green-700 mb-1 font-medium">Ingresos Totales Acumulados</p>
                                <p className="text-sm text-green-600 truncate px-2">
                                  {ingresosTotalesPorProducto[productoSeleccionadoIndex]?.nombre}
                                </p>
                              </div>
                              <button
                                onClick={() => setProductoSeleccionadoIndex(productoSeleccionadoIndex === ingresosTotalesPorProducto.length - 1 ? 0 : productoSeleccionadoIndex + 1)}
                                className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow hover:shadow-md transition-shadow"
                                disabled={ingresosTotalesPorProducto.length <= 1}
                              >
                                <ChevronRight className="h-5 w-5 text-green-700" />
                              </button>
                            </div>
                            <div className="flex items-center justify-center gap-3">
                              <Scale className="h-10 w-10 text-green-600 opacity-50" />
                              <p className="text-3xl font-bold text-green-800">
                                {ingresosTotalesPorProducto[productoSeleccionadoIndex]?.kilosAcumulados.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                              </p>
                            </div>
                            {ingresosTotalesPorProducto.length > 1 && (
                              <p className="text-xs text-green-600 text-center mt-2">
                                {productoSeleccionadoIndex + 1} de {ingresosTotalesPorProducto.length} productos
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-4">
                            <Scale className="h-10 w-10 text-green-400 mx-auto mb-2 opacity-50" />
                            <p className="text-xs text-green-700">Sin ingresos registrados</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-100">
                      <CardContent className="p-5">
                        <div className="text-center mb-2">
                          <p className="text-xs text-blue-700 mb-1 font-medium">Ganancia Potencial</p>
                          <p className="text-sm text-blue-600">
                            {gananciaPotencial.totalVenta > 0 ? 'Basado en períodos de precio' : 'Configure precios'}
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <DollarSign className="h-10 w-10 text-blue-600 opacity-50" />
                          <div className="text-center">
                            <p className="text-3xl font-bold text-blue-800">
                              ${gananciaPotencial.ganancia.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            {gananciaPotencial.margen > 0 && (
                              <p className="text-xs text-blue-600 mt-1">
                                Margen: {gananciaPotencial.margen.toFixed(1)}%
                              </p>
                            )}
                          </div>
                        </div>
                        {gananciaPotencial.totalVenta > 0 && (
                          <div className="mt-3 pt-3 border-t border-blue-200">
                            <div className="flex justify-between text-xs text-blue-700">
                              <span>Costo compra:</span>
                              <span className="font-semibold">${gananciaPotencial.totalCompra.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-xs text-blue-700 mt-1">
                              <span>Ingreso venta:</span>
                              <span className="font-semibold">${gananciaPotencial.totalVenta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card className="border-0 shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <Scale className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Stock Total</p>
                            <p className="text-xl font-bold text-slate-800">{statsAcopio.stockTotalKilos.toFixed(0)} kg</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Ingresos Hoy</p>
                            <p className="text-xl font-bold text-slate-800">{statsAcopio.ingresosHoy}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <Package className="h-5 w-5 text-teal-600" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Envases Vacíos</p>
                            <p className="text-xl font-bold text-teal-600">{statsAcopio.totalVacios}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Box className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Envases Ocupados</p>
                            <p className="text-xl font-bold text-orange-600">{statsAcopio.totalOcupados}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Users className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Proveedores</p>
                            <p className="text-xl font-bold text-slate-800">{proveedores.length}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Fruta Real a Cobrar y Pérdidas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Card className="border-0 shadow-md bg-gradient-to-br from-teal-50 to-teal-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-teal-700 uppercase tracking-wide mb-1">Fruta Real a Cobrar</p>
                            <p className="text-2xl font-bold text-teal-800">
                              {frutaRealACobrar.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                            </p>
                            <p className="text-[10px] text-teal-600 mt-1">Ingresos totales - Pérdidas</p>
                          </div>
                          <CheckCircle className="h-9 w-9 text-teal-500 opacity-40" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-red-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-red-700 uppercase tracking-wide mb-1">Pérdidas Efectivas Totales</p>
                            <p className="text-2xl font-bold text-red-800">
                              {perdidasEfectivas.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                            </p>
                            <p className="text-[10px] text-red-600 mt-1">Báscula + Calidad</p>
                          </div>
                          <AlertTriangle className="h-9 w-9 text-red-500 opacity-40" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                )}
              </TabsContent>

              {/* TAB CONTABLES */}
              <TabsContent value="contables">
                {!informeGenerado ? (
                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-12 text-center">
                      <DollarSign className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-700 mb-2">
                        Informe no generado
                      </h3>
                      <p className="text-slate-500">
                        Selecciona un rango de fechas y genera el informe primero
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                <>
                <Card className="border-0 shadow-md mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Seleccionar Período</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Fecha Desde</label>
                        <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Fecha Hasta</label>
                        <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardHeader className="bg-blue-50 flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-xl text-blue-900">Estado de Resultados</CardTitle>
                      <p className="text-sm text-blue-700 mt-1">
                        Período: {format(parseISO(fechaDesde), 'dd/MM/yyyy', { locale: es })} - {format(parseISO(fechaHasta), 'dd/MM/yyyy', { locale: es })}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        const datosExportar = [
                          { Concepto: 'Ingresos por Ventas', Monto: estadoResultado.ingresosPorVentas },
                          { Concepto: 'Total Otros Ingresos', Monto: estadoResultado.totalIngresosVarios },
                          { Concepto: 'Total Ingresos', Monto: estadoResultado.ingresosTotales },
                          { Concepto: 'Costo de Compra de Fruta', Monto: estadoResultado.costoCompraFruta },
                          { Concepto: 'Total Costo Ventas', Monto: estadoResultado.costoVentasTotal },
                          { Concepto: 'Utilidad Bruta', Monto: estadoResultado.utilidadBruta },
                          { Concepto: 'Gastos Operativos', Monto: estadoResultado.totalGastos },
                          { Concepto: 'Resultado Neto', Monto: estadoResultado.resultadoNeto }
                        ];
                        exportarExcel(datosExportar, `estado_resultados_${format(new Date(), 'yyyyMMdd')}`);
                      }}
                      size="sm"
                      variant="outline"
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Exportar
                    </Button>
                  </CardHeader>
                  <CardContent className="p-6">
            <div className="space-y-6">
              {/* INGRESOS */}
              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <h3 className="font-bold text-lg text-slate-800">INGRESOS</h3>
                  </div>
                </div>
                <div className="ml-7 space-y-1">
                 <div className="flex justify-between text-slate-700">
                   <span>Ingresos por Ventas (Cobros Realizados)</span>
                   <span className="font-semibold">${estadoResultado.ingresosPorVentas.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                 </div>
                 {Object.entries(estadoResultado.ingresosPorCuenta).map(([cuenta, monto]) => (
                   <div key={cuenta} className="flex justify-between text-slate-600 text-sm pl-4">
                     <span>{cuenta}</span>
                     <span className="font-semibold">${monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                   </div>
                 ))}
                 {Object.keys(estadoResultado.ingresosPorCuenta).length > 0 && (
                   <div className="flex justify-between text-slate-700 pt-1">
                     <span className="pl-4">Total Otros Ingresos</span>
                     <span className="font-semibold">${estadoResultado.totalIngresosVarios.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                   </div>
                 )}
                 <div className="flex justify-between font-bold text-green-700 pt-2 border-t mt-2">
                   <span>Total Ingresos</span>
                   <span>${estadoResultado.ingresosTotales.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                 </div>
                </div>
              </div>

              {/* COSTO DE VENTAS */}
              <div className="border-b pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <h3 className="font-bold text-lg text-slate-800">COSTO DE VENTAS</h3>
                </div>
                <div className="ml-7 space-y-1">
                  <div className="flex justify-between font-semibold text-red-600">
                    <span>Costo de Compra de Fruta</span>
                    <span>${estadoResultado.costoCompraFruta.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <p className="text-[10px] text-slate-500 italic">
                      ℹ️ Calculado: kilos comprados × precio de compra. NO incluye pagos, deudas ni otros egresos.
                    </p>
                  </div>
                </div>
              </div>

              {/* UTILIDAD BRUTA */}
              <div className="border-b pb-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg text-slate-800">UTILIDAD BRUTA</h3>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">${estadoResultado.utilidadBruta.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-sm text-slate-500">{estadoResultado.margenBruto.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% margen</p>
                  </div>
                </div>
              </div>

              {/* GASTOS OPERATIVOS */}
              <div className="border-b pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <h3 className="font-bold text-lg text-slate-800">GASTOS OPERATIVOS</h3>
                </div>
                <div className="ml-7 space-y-1">
                  {Object.entries(estadoResultado.gastosPorCuenta).map(([cuenta, monto]) => (
                    <div key={cuenta} className="flex justify-between text-slate-600 text-sm">
                      <span>{cuenta}</span>
                      <span className="font-semibold">${monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold text-red-600 pt-2 border-t mt-2">
                    <span>Total Gastos</span>
                    <span>${estadoResultado.totalGastos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* RESULTADO OPERATIVO */}
              <div className="border-b pb-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg text-slate-800">RESULTADO OPERATIVO</h3>
                  <p className={`text-2xl font-bold ${estadoResultado.resultadoOperativo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${estadoResultado.resultadoOperativo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* RESULTADO NETO */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                    <h3 className="font-bold text-xl text-blue-900">RESULTADO NETO</h3>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${estadoResultado.resultadoNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${estadoResultado.resultadoNeto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-slate-600">{estadoResultado.margenNeto.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% margen neto</p>
                  </div>
                </div>
              </div>
                  </div>
                </CardContent>
              </Card>
              </>
              )}
            </TabsContent>

            {/* TAB OPERATIVOS */}
            <TabsContent value="operativos">
              {!informeGenerado ? (
                <Card className="border-0 shadow-lg">
                  <CardContent className="p-12 text-center">
                    <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                      Informe no generado
                    </h3>
                    <p className="text-slate-500">
                      Genera el informe primero para ver los datos operativos
                    </p>
                  </CardContent>
                </Card>
              ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-4">
                  <Card className="border-0 shadow-md">
                    <CardHeader>
                      <CardTitle className="text-lg">Filtros</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-2 block">Tipo *</label>
                        <select
                          value={tipoInforme}
                          onChange={(e) => {
                            setTipoInforme(e.target.value);
                            setProveedoresSeleccionados([]);
                            setClientesSeleccionados([]);
                          }}
                          className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="proveedor">Proveedor</option>
                          <option value="cliente">Cliente</option>
                        </select>
                      </div>

                      {tipoInforme === 'proveedor' ? (
                        <div>
                          <label className="text-sm font-medium text-slate-700 mb-2 flex items-center justify-between">
                            <span>Proveedores *</span>
                            <button
                              onClick={() => {
                                const proveedoresFiltrados = proveedores.filter(p => 
                                  p.nombre.toLowerCase().includes(busquedaProveedor.toLowerCase())
                                );
                                if (proveedoresSeleccionados.length === proveedoresFiltrados.length) {
                                  setProveedoresSeleccionados(proveedoresSeleccionados.filter(id => 
                                    !proveedoresFiltrados.some(p => p.id === id)
                                  ));
                                } else {
                                  const nuevosIds = proveedoresFiltrados.map(p => p.id).filter(id => 
                                    !proveedoresSeleccionados.includes(id)
                                  );
                                  setProveedoresSeleccionados([...proveedoresSeleccionados, ...nuevosIds]);
                                }
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              Marcar todos
                            </button>
                          </label>
                          <Input
                            type="text"
                            placeholder="Buscar proveedor..."
                            value={busquedaProveedor}
                            onChange={(e) => setBusquedaProveedor(e.target.value)}
                            className="mb-2"
                          />
                          <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-50 rounded-lg border">
                            {proveedores.length === 0 ? (
                              <p className="text-sm text-slate-500 text-center">No hay proveedores</p>
                            ) : (
                              proveedores
                                .filter(p => p.nombre.toLowerCase().includes(busquedaProveedor.toLowerCase()))
                                .map(p => (
                                  <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-2 rounded">
                                    <input
                                      type="checkbox"
                                      checked={proveedoresSeleccionados.includes(p.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setProveedoresSeleccionados([...proveedoresSeleccionados, p.id]);
                                        } else {
                                          setProveedoresSeleccionados(proveedoresSeleccionados.filter(id => id !== p.id));
                                        }
                                      }}
                                      className="rounded"
                                    />
                                    <span className="text-sm">{p.nombre}</span>
                                  </label>
                                ))
                            )}
                          </div>
                          {proveedoresSeleccionados.length > 0 && (
                            <p className="text-xs text-slate-600 mt-2">
                              {proveedoresSeleccionados.length} seleccionado(s)
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label className="text-sm font-medium text-slate-700 mb-2 flex items-center justify-between">
                            <span>Clientes *</span>
                            <button
                              onClick={() => {
                                const clientesFiltrados = clientes.filter(c => 
                                  c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase())
                                );
                                if (clientesSeleccionados.length === clientesFiltrados.length) {
                                  setClientesSeleccionados(clientesSeleccionados.filter(id => 
                                    !clientesFiltrados.some(c => c.id === id)
                                  ));
                                } else {
                                  const nuevosIds = clientesFiltrados.map(c => c.id).filter(id => 
                                    !clientesSeleccionados.includes(id)
                                  );
                                  setClientesSeleccionados([...clientesSeleccionados, ...nuevosIds]);
                                }
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              Marcar todos
                            </button>
                          </label>
                          <Input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={busquedaCliente}
                            onChange={(e) => setBusquedaCliente(e.target.value)}
                            className="mb-2"
                          />
                          <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-50 rounded-lg border">
                            {clientes.length === 0 ? (
                              <p className="text-sm text-slate-500 text-center">No hay clientes</p>
                            ) : (
                              clientes
                                .filter(c => c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()))
                                .map(c => (
                                  <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-2 rounded">
                                    <input
                                      type="checkbox"
                                      checked={clientesSeleccionados.includes(c.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setClientesSeleccionados([...clientesSeleccionados, c.id]);
                                        } else {
                                          setClientesSeleccionados(clientesSeleccionados.filter(id => id !== c.id));
                                        }
                                      }}
                                      className="rounded"
                                    />
                                    <span className="text-sm">{c.nombre}</span>
                                  </label>
                                ))
                            )}
                          </div>
                          {clientesSeleccionados.length > 0 && (
                            <p className="text-xs text-slate-600 mt-2">
                              {clientesSeleccionados.length} seleccionado(s)
                            </p>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Fecha Desde</label>
                        <Input type="date" value={fechaDesdeOp} onChange={(e) => setFechaDesdeOp(e.target.value)} />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Fecha Hasta</label>
                        <Input type="date" value={fechaHastaOp} onChange={(e) => setFechaHastaOp(e.target.value)} />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-2 block">Productos</label>
                        <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-50 rounded-lg border">
                          {productos.map(p => (
                            <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={productosSeleccionados.includes(p.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setProductosSeleccionados([...productosSeleccionados, p.id]);
                                  } else {
                                    setProductosSeleccionados(productosSeleccionados.filter(id => id !== p.id));
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm">{p.producto_completo || `${p.fruta} - ${p.variedad}`}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {(proveedoresSeleccionados.length > 0 || clientesSeleccionados.length > 0) && movimientosFiltrados.length > 0 && (
                    <Card className="border-0 shadow-md">
                      <CardHeader>
                        <CardTitle className="text-lg">Exportar</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Button onClick={exportarPDF} className="w-full text-sm">
                          <FileDown className="h-4 w-4 mr-2" />
                          PDF
                        </Button>
                        <Button onClick={exportarExcelOperativo} className="w-full text-sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Excel
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="lg:col-span-3">
                  {(tipoInforme === 'proveedor' ? proveedoresSeleccionados.length === 0 : clientesSeleccionados.length === 0) ? (
                    <Card className="border-0 shadow-md">
                      <CardContent className="p-12 text-center">
                        <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">
                          Seleccione {tipoInforme === 'proveedor' ? 'proveedores' : 'clientes'}
                        </h3>
                        <p className="text-slate-500 text-sm">
                          Marque uno o más en los filtros
                        </p>
                      </CardContent>
                    </Card>
                  ) : movimientosFiltrados.length === 0 ? (
                    <Card className="border-0 shadow-md">
                      <CardContent className="p-12 text-center">
                        <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">No hay datos para el período seleccionado</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {camposSeleccionados.totales && Object.keys(totalesOperativos.totalesProductos).length > 0 && (
                        <Card className="border-0 shadow-md mb-4">
                          <CardHeader>
                            <CardTitle className="text-base">Totales del Período</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                              {Object.entries(totalesOperativos.totalesProductos).map(([prod, datos]) => (
                                <div key={prod} className="p-3 bg-slate-50 rounded-lg">
                                  <p className="text-xs text-slate-600 mb-1">{prod}</p>
                                  <p className="text-lg font-bold text-blue-700">
                                    {tipoInforme === 'proveedor' 
                                      ? datos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                      : datos.efectivos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    } kg
                                  </p>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      <Card className="border-0 shadow-md">
                        <CardHeader>
                          <CardTitle className="text-base md:text-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <span className="break-words">Informe - {nombreEntidades}</span>
                            <Badge className="shrink-0">{movimientosFiltrados.length} mov.</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto -mx-4 md:mx-0">
                            <table className="w-full text-xs md:text-sm min-w-full">
                              <thead className="bg-slate-100">
                                <tr>
                                  {camposSeleccionados.fecha && <th className="text-left p-2 md:p-3 whitespace-nowrap sticky left-0 bg-slate-100 z-10">Fecha</th>}
                                  {entidadesSeleccionadas.length > 1 && <th className="text-left p-2 md:p-3 whitespace-nowrap">{tipoInforme === 'proveedor' ? 'Proveedor' : 'Cliente'}</th>}
                                  {tipoInforme === 'cliente' && camposSeleccionados.remito && <th className="text-left p-2 md:p-3 whitespace-nowrap">Remito</th>}
                                  {tipoInforme === 'proveedor' && camposSeleccionados.fletero && <th className="text-left p-2 md:p-3 whitespace-nowrap">Fletero</th>}
                                  {totalesOperativos.todosLosProductos.map(prod => (
                                    <th key={prod} className="text-right p-2 md:p-3 whitespace-nowrap">{prod} (kg)</th>
                                  ))}
                                  <th className="text-right p-2 md:p-3 whitespace-nowrap bg-blue-100 font-bold">Total (kg)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {movimientosFiltrados
                                  .slice((paginaActual - 1) * registrosPorPagina, paginaActual * registrosPorPagina)
                                  .map((item, idx) => {
                                    const productosPorIngreso = {};
                                    let totalIngreso = 0;
                                    
                                    if (tipoInforme === 'proveedor' && item.pesajes) {
                                      item.pesajes.forEach(p => {
                                        if (!productosSeleccionados.length || productosSeleccionados.includes(p.producto_id)) {
                                          if (!productosPorIngreso[p.producto_nombre]) productosPorIngreso[p.producto_nombre] = 0;
                                          productosPorIngreso[p.producto_nombre] += p.peso_neto || 0;
                                          totalIngreso += p.peso_neto || 0;
                                        }
                                      });
                                    } else if (item.detalles) {
                                      item.detalles.forEach(d => {
                                        if (!productosSeleccionados.length || productosSeleccionados.includes(d.producto_id)) {
                                          const efectivos = (d.kilos_reales || d.kilos_salida) - (d.descuento_kg || 0);
                                          if (!productosPorIngreso[d.producto_nombre]) productosPorIngreso[d.producto_nombre] = 0;
                                          productosPorIngreso[d.producto_nombre] += efectivos;
                                          totalIngreso += efectivos;
                                        }
                                      });
                                    }
                                    
                                    return (
                                      <tr key={idx} className="border-b hover:bg-slate-50">
                                        {camposSeleccionados.fecha && <td className="p-2 md:p-3 whitespace-nowrap text-xs sticky left-0 bg-white">{format(new Date(item.fecha), 'dd/MM/yyyy HH:mm')}</td>}
                                        {entidadesSeleccionadas.length > 1 && (
                                          <td className="p-2 md:p-3 text-xs font-medium">
                                            {tipoInforme === 'proveedor' ? item.proveedor_nombre : item.cliente_nombre}
                                          </td>
                                        )}
                                        {tipoInforme === 'cliente' && camposSeleccionados.remito && <td className="p-2 md:p-3 text-xs">{item.numero_remito || '-'}</td>}
                                        {tipoInforme === 'proveedor' && camposSeleccionados.fletero && <td className="p-2 md:p-3 text-xs truncate max-w-[100px]">{item.fletero_nombre || '-'}</td>}
                                        {totalesOperativos.todosLosProductos.map(prod => {
                                          const valor = productosPorIngreso[prod] || 0;
                                          return (
                                            <td key={prod} className="p-2 md:p-3 text-right text-xs">
                                              {valor > 0 ? valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                            </td>
                                          );
                                        })}
                                        <td className="p-2 md:p-3 text-right text-xs font-bold bg-blue-50">
                                          {totalIngreso.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>

                          {movimientosFiltrados.length > registrosPorPagina && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                              <p className="text-sm text-slate-600">
                                Mostrando {((paginaActual - 1) * registrosPorPagina) + 1} - {Math.min(paginaActual * registrosPorPagina, movimientosFiltrados.length)} de {movimientosFiltrados.length} registros
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                                  disabled={paginaActual === 1}
                                >
                                  Anterior
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPaginaActual(p => Math.min(Math.ceil(movimientosFiltrados.length / registrosPorPagina), p + 1))}
                                  disabled={paginaActual >= Math.ceil(movimientosFiltrados.length / registrosPorPagina)}
                                >
                                  Siguiente
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
                </div>
                )}
                </TabsContent>

                {/* TAB INFORME DE PROVEEDORES */}
                <TabsContent value="proveedores">
                  {!informeGenerado ? (
                    <Card className="border-0 shadow-lg">
                      <CardContent className="p-12 text-center">
                        <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">
                          Informe no generado
                        </h3>
                        <p className="text-slate-500">
                          Genera el informe primero para ver el análisis de proveedores
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-1 space-y-4">
                      <Card className="border-0 shadow-md">
                        <CardHeader>
                          <CardTitle className="text-lg">Filtros</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-2 flex items-center justify-between">
                              <span>Proveedores *</span>
                              <button
                                onClick={() => {
                                  if (proveedoresInforme.length === proveedores.length) {
                                    setProveedoresInforme([]);
                                  } else {
                                    setProveedoresInforme(proveedores.map(p => p.id));
                                  }
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700"
                              >
                                {proveedoresInforme.length === proveedores.length ? 'Desmarcar todos' : 'Todos'}
                              </button>
                            </label>
                            <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-50 rounded-lg border">
                              {proveedores.map(p => (
                                <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-2 rounded">
                                  <input
                                    type="checkbox"
                                    checked={proveedoresInforme.includes(p.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setProveedoresInforme([...proveedoresInforme, p.id]);
                                      } else {
                                        setProveedoresInforme(proveedoresInforme.filter(id => id !== p.id));
                                      }
                                    }}
                                    className="rounded"
                                  />
                                  <span className="text-sm">{p.nombre}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-slate-700 mb-1 block">Desde</label>
                              <Input type="date" value={fechaDesdeProveedores} onChange={(e) => setFechaDesdeProveedores(e.target.value)} />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700 mb-1 block">Hasta</label>
                              <Input type="date" value={fechaHastaProveedores} onChange={(e) => setFechaHastaProveedores(e.target.value)} />
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-2 block">Productos (opcional)</label>
                            <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-slate-50 rounded-lg border">
                              {productos.map(p => (
                                <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded text-xs">
                                  <input
                                    type="checkbox"
                                    checked={productosFiltroProveedores.includes(p.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setProductosFiltroProveedores([...productosFiltroProveedores, p.id]);
                                      } else {
                                        setProductosFiltroProveedores(productosFiltroProveedores.filter(id => id !== p.id));
                                      }
                                    }}
                                    className="rounded"
                                  />
                                  <span>{p.producto_completo || `${p.fruta} - ${p.variedad}`}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="lg:col-span-3">
                      {proveedoresInforme.length === 0 ? (
                        <Card className="border-0 shadow-md">
                          <CardContent className="p-12 text-center">
                            <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Seleccione proveedores</h3>
                            <p className="text-slate-500 text-sm">Marque uno o más proveedores para generar el informe</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="border-0 shadow-lg">
                          <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 flex flex-row items-center justify-between">
                            <CardTitle className="text-xl text-orange-900">Informe de Proveedores</CardTitle>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => {
                                  const todasVariedades = new Set();
                                  const datosProveedores = [];

                                  proveedoresInforme.forEach(provId => {
                                    const proveedor = proveedores.find(p => p.id === provId);
                                    if (!proveedor) return;

                                    const variedadesKg = {};
                                    let totalKg = 0;

                                    movimientos.forEach(m => {
                                      if (m.tipo_movimiento === 'Ingreso de Fruta' && m.proveedor_id === provId) {
                                        const fechaMov = new Date(m.fecha);
                                        const cumpleFecha = (!fechaDesdeProveedores || fechaMov >= new Date(fechaDesdeProveedores)) &&
                                                          (!fechaHastaProveedores || fechaMov <= new Date(fechaHastaProveedores + 'T23:59:59'));
                                        if (cumpleFecha && m.pesajes) {
                                          m.pesajes.forEach(p => {
                                            if (!productosFiltroProveedores.length || productosFiltroProveedores.includes(p.producto_id)) {
                                              const nombre = p.producto_nombre || 'Sin nombre';
                                              todasVariedades.add(nombre);
                                              if (!variedadesKg[nombre]) {
                                                variedadesKg[nombre] = { kg: 0, producto_id: p.producto_id };
                                              }
                                              variedadesKg[nombre].kg += p.peso_neto || 0;
                                              totalKg += p.peso_neto || 0;
                                            }
                                          });
                                        }
                                      }
                                    });

                                    let totalAPagar = 0;
                                    Object.entries(variedadesKg).forEach(([variedad, data]) => {
                                      const precio = obtenerPrecioVigenteCache(data.producto_id, new Date(), 'compra');
                                      totalAPagar += data.kg * precio;
                                    });

                                    const totalPagadoCalculado = pagos
                                      .filter(p => {
                                        if (p.proveedor_id !== provId) return false;
                                        return movimientosTesoreria.some(m => 
                                          m.referencia_origen_id === p.id && m.referencia_origen_tipo === 'Pago'
                                        );
                                      })
                                      .reduce((sum, p) => sum + (p.monto_total || 0), 0);

                                    const totalPagado = Math.min(totalPagadoCalculado, totalAPagar);
                                    const saldoPendiente = Math.max(0, totalAPagar - totalPagado);

                                    datosProveedores.push({
                                      proveedor: proveedor.nombre,
                                      totalKg,
                                      variedadesKg,
                                      totalAPagar,
                                      totalPagado,
                                      saldoPendiente
                                    });
                                  });

                                  const variedadesArray = Array.from(todasVariedades).sort();
                                  
                                  let variedadesHeaders = variedadesArray.map(v => `<th class="p-2 text-right">Kg ${v}</th>`).join('');
                                  let filasHTML = datosProveedores.map(d => {
                                    let variedadesCells = variedadesArray.map(v => 
                                      `<td class="p-2 text-right">${(d.variedadesKg[v]?.kg || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>`
                                    ).join('');
                                    
                                    return `<tr>
                                      <td class="p-2 font-medium">${d.proveedor}</td>
                                      <td class="p-2 text-right font-semibold" style="background:#f1f5f9">${d.totalKg.toLocaleString('es-AR', { minimumFractionDigits: 2 })} kg</td>
                                      ${variedadesCells}
                                      <td class="p-2 text-right font-semibold" style="background:#fefce8">$${d.totalAPagar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                      <td class="p-2 text-right font-semibold" style="background:#f0fdf4">$${d.totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                      <td class="p-2 text-right font-semibold" style="background:#eff6ff">${d.saldoPendiente > 0 ? `$${d.saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}</td>
                                    </tr>`;
                                  }).join('');

                                  const periodoText = `${fechaDesdeProveedores ? format(new Date(fechaDesdeProveedores), 'dd/MM/yyyy') : 'Inicio'} - ${fechaHastaProveedores ? format(new Date(fechaHastaProveedores), 'dd/MM/yyyy') : 'Actual'}`;

                                  const html = `
                                    <!DOCTYPE html>
                                    <html><head><meta charset="UTF-8"><title>Informe de Proveedores</title>
                                    <style>
                                      body { font-family: Arial; font-size: 10px; padding: 20px; }
                                      .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #f97316; padding-bottom: 10px; }
                                      .title { font-size: 18px; font-weight: bold; color: #9a3412; }
                                      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                                      th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                                      th { background: #fff7ed; font-weight: 600; font-size: 9px; }
                                    </style></head><body>
                                    <div class="header">
                                      <div class="title">INFORME DE PROVEEDORES</div>
                                      <p>Período: ${periodoText}</p>
                                      <p>Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                                    </div>
                                    <table>
                                      <thead>
                                        <tr>
                                          <th class="p-2">Proveedor</th>
                                          <th class="p-2 text-right">Kg Totales</th>
                                          ${variedadesHeaders}
                                          <th class="p-2 text-right">Total a Pagar</th>
                                          <th class="p-2 text-right">Total Pagado</th>
                                          <th class="p-2 text-right">Saldo Pendiente</th>
                                        </tr>
                                      </thead>
                                      <tbody>${filasHTML}</tbody>
                                    </table>
                                    </body></html>`;
                                  
                                  const printWindow = window.open('', '_blank');
                                  printWindow.document.write(html);
                                  printWindow.document.close();
                                  printWindow.onload = () => printWindow.print();
                                }}
                                size="sm"
                                variant="outline"
                                className="gap-2"
                              >
                                <FileDown className="h-4 w-4" />
                                PDF
                              </Button>
                              <Button
                                onClick={() => {
                                  const todasVariedades = new Set();
                                  const datosProveedores = [];

                                  proveedoresInforme.forEach(provId => {
                                    const proveedor = proveedores.find(p => p.id === provId);
                                    if (!proveedor) return;

                                    const variedadesKg = {};
                                    let totalKg = 0;

                                    movimientos.forEach(m => {
                                      if (m.tipo_movimiento === 'Ingreso de Fruta' && m.proveedor_id === provId) {
                                        const fechaMov = new Date(m.fecha);
                                        const cumpleFecha = (!fechaDesdeProveedores || fechaMov >= new Date(fechaDesdeProveedores)) &&
                                                          (!fechaHastaProveedores || fechaMov <= new Date(fechaHastaProveedores + 'T23:59:59'));
                                        if (cumpleFecha && m.pesajes) {
                                          m.pesajes.forEach(p => {
                                            if (!productosFiltroProveedores.length || productosFiltroProveedores.includes(p.producto_id)) {
                                              const nombre = p.producto_nombre || 'Sin nombre';
                                              todasVariedades.add(nombre);
                                              if (!variedadesKg[nombre]) {
                                                variedadesKg[nombre] = { kg: 0, producto_id: p.producto_id };
                                              }
                                              variedadesKg[nombre].kg += p.peso_neto || 0;
                                              totalKg += p.peso_neto || 0;
                                            }
                                          });
                                        }
                                      }
                                    });

                                    let totalAPagar = 0;
                                    Object.entries(variedadesKg).forEach(([variedad, data]) => {
                                      const precio = obtenerPrecioVigenteCache(data.producto_id, new Date(), 'compra');
                                      totalAPagar += data.kg * precio;
                                    });

                                    const totalPagadoCalculado = pagos
                                      .filter(p => {
                                        if (p.proveedor_id !== provId) return false;
                                        return movimientosTesoreria.some(m => 
                                          m.referencia_origen_id === p.id && m.referencia_origen_tipo === 'Pago'
                                        );
                                      })
                                      .reduce((sum, p) => sum + (p.monto_total || 0), 0);

                                    const totalPagado = Math.min(totalPagadoCalculado, totalAPagar);
                                    const saldoPendiente = Math.max(0, totalAPagar - totalPagado);

                                    datosProveedores.push({
                                      proveedor: proveedor.nombre,
                                      totalKg,
                                      variedadesKg,
                                      totalAPagar,
                                      totalPagado,
                                      saldoPendiente
                                    });
                                  });

                                  const variedadesArray = Array.from(todasVariedades).sort();
                                  const datosExportar = datosProveedores.map(d => {
                                    const fila = {
                                      'Proveedor': d.proveedor,
                                      'Kg Totales': parseFloat(d.totalKg.toFixed(2))
                                    };

                                    variedadesArray.forEach(v => {
                                      fila[`Kg ${v}`] = parseFloat((d.variedadesKg[v]?.kg || 0).toFixed(2));
                                    });

                                    fila['Total a Pagar'] = parseFloat(d.totalAPagar.toFixed(2));
                                    fila['Total Pagado'] = parseFloat(d.totalPagado.toFixed(2));
                                    fila['Saldo Pendiente'] = parseFloat(d.saldoPendiente.toFixed(2));

                                    return fila;
                                  });

                                  exportarExcel(datosExportar, `informe_proveedores_${format(new Date(), 'yyyyMMdd')}`);
                                }}
                                size="sm"
                                variant="outline"
                                className="gap-2"
                              >
                                <Download className="h-4 w-4" />
                                Excel
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="p-6">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-slate-100">
                                  <tr>
                                    <th className="text-left p-2 sticky left-0 bg-slate-100 z-10">Proveedor</th>
                                    <th className="text-right p-2 whitespace-nowrap bg-slate-200">Kg Totales</th>
                                    {(() => {
                                      const todasVariedades = new Set();
                                      movimientos.forEach(m => {
                                        if (m.tipo_movimiento === 'Ingreso de Fruta' && proveedoresInforme.includes(m.proveedor_id)) {
                                          const fechaMov = new Date(m.fecha);
                                          const cumpleFecha = (!fechaDesdeProveedores || fechaMov >= new Date(fechaDesdeProveedores)) &&
                                                            (!fechaHastaProveedores || fechaMov <= new Date(fechaHastaProveedores + 'T23:59:59'));
                                          if (cumpleFecha && m.pesajes) {
                                            m.pesajes.forEach(p => {
                                              if (!productosFiltroProveedores.length || productosFiltroProveedores.includes(p.producto_id)) {
                                                todasVariedades.add(p.producto_nombre);
                                              }
                                            });
                                          }
                                        }
                                      });
                                      return Array.from(todasVariedades).sort().map(v => (
                                        <th key={`kg_${v}`} className="text-right p-2 whitespace-nowrap">Kg {v}</th>
                                      ));
                                    })()}
                                    <th className="text-right p-2 whitespace-nowrap bg-yellow-50">Total a Pagar</th>
                                    <th className="text-right p-2 whitespace-nowrap bg-green-50">Total Pagado</th>
                                    <th className="text-right p-2 whitespace-nowrap bg-blue-50">Saldo Pendiente</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {proveedoresInforme.map(provId => {
                                    const proveedor = proveedores.find(p => p.id === provId);
                                    if (!proveedor) return null;

                                    const variedadesKg = {};
                                    let totalKg = 0;

                                    movimientos.forEach(m => {
                                      if (m.tipo_movimiento === 'Ingreso de Fruta' && m.proveedor_id === provId) {
                                        const fechaMov = new Date(m.fecha);
                                        const cumpleFecha = (!fechaDesdeProveedores || fechaMov >= new Date(fechaDesdeProveedores)) &&
                                                          (!fechaHastaProveedores || fechaMov <= new Date(fechaHastaProveedores + 'T23:59:59'));
                                        if (cumpleFecha && m.pesajes) {
                                          m.pesajes.forEach(p => {
                                            if (!productosFiltroProveedores.length || productosFiltroProveedores.includes(p.producto_id)) {
                                              const nombre = p.producto_nombre || 'Sin nombre';
                                              if (!variedadesKg[nombre]) {
                                                variedadesKg[nombre] = { kg: 0, producto_id: p.producto_id };
                                              }
                                              variedadesKg[nombre].kg += p.peso_neto || 0;
                                              totalKg += p.peso_neto || 0;
                                            }
                                          });
                                        }
                                      }
                                    });

                                    let totalAPagar = 0;
                                    Object.entries(variedadesKg).forEach(([variedad, data]) => {
                                      const precio = obtenerPrecioVigenteCache(data.producto_id, new Date(), 'compra');
                                      totalAPagar += data.kg * precio;
                                    });

                                    // Total pagado = SOLO pagos con MovimientoTesoreria (pagos reales efectuados)
                                    const totalPagadoCalculado = pagos
                                      .filter(p => {
                                        if (p.proveedor_id !== provId) return false;
                                        // Verificar que el pago tenga movimientos de tesorería vinculados (pago real)
                                        return movimientosTesoreria.some(m => 
                                          m.referencia_origen_id === p.id && m.referencia_origen_tipo === 'Pago'
                                        );
                                      })
                                      .reduce((sum, p) => sum + (p.monto_total || 0), 0);

                                    // Aplicar tope contable: nunca mayor al total a pagar
                                    const totalPagado = Math.min(totalPagadoCalculado, totalAPagar);

                                    // Saldo pendiente nunca negativo
                                    const saldoPendiente = Math.max(0, totalAPagar - totalPagado);

                                    const todasVariedades = new Set();
                                    movimientos.forEach(m => {
                                      if (m.tipo_movimiento === 'Ingreso de Fruta' && proveedoresInforme.includes(m.proveedor_id)) {
                                        const fechaMov = new Date(m.fecha);
                                        const cumpleFecha = (!fechaDesdeProveedores || fechaMov >= new Date(fechaDesdeProveedores)) &&
                                                          (!fechaHastaProveedores || fechaMov <= new Date(fechaHastaProveedores + 'T23:59:59'));
                                        if (cumpleFecha && m.pesajes) {
                                          m.pesajes.forEach(p => {
                                            if (!productosFiltroProveedores.length || productosFiltroProveedores.includes(p.producto_id)) {
                                              todasVariedades.add(p.producto_nombre);
                                            }
                                          });
                                        }
                                      }
                                    });

                                    return (
                                      <tr key={provId} className="border-b hover:bg-slate-50">
                                        <td className="p-2 font-medium sticky left-0 bg-white">{proveedor.nombre}</td>
                                        <td className="p-2 text-right font-semibold text-slate-800 bg-slate-100">
                                          {totalKg.toLocaleString('es-AR', { minimumFractionDigits: 2 })} kg
                                        </td>
                                        {Array.from(todasVariedades).sort().map(v => (
                                          <td key={`kg_${provId}_${v}`} className="p-2 text-right text-slate-600">
                                            {(variedadesKg[v]?.kg || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                          </td>
                                        ))}
                                        <td className="p-2 text-right font-semibold text-yellow-700 bg-yellow-50">
                                          ${totalAPagar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-2 text-right font-semibold text-green-700 bg-green-50">
                                          ${totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className={`p-2 text-right font-semibold bg-blue-50 ${saldoPendiente > 0 ? 'text-red-600' : saldoPendiente < 0 ? 'text-green-600' : 'text-slate-600'}`}>
                                          ${saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                  )}
                </TabsContent>

                </Tabs>
                </CardContent>
                </Card>
                </div>
                </div>
                );
                }