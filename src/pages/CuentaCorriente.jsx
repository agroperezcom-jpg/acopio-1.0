import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Scale, Loader2, TrendingUp, TrendingDown, Search, FileText, DollarSign, Download, FileDown, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { exportarExcel } from '@/components/ExportarExcel';
import { escapeRegex } from '@/lib/utils';
import { toast } from 'sonner';

export default function CuentaCorriente() {
  const [filtros, setFiltros] = useState({
    entidad_tipo: 'Todos',
    busqueda: '',
    fecha_desde: '',
    fecha_hasta: '',
    proveedor_id: 'todos'
  });
  const [entidadSeleccionada, setEntidadSeleccionada] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [mostrarSaldosCero, setMostrarSaldosCero] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const ITEMS_POR_PAGINA = 25;

  // Pestañas: Cuentas con Saldos | Saldos en Cero
  const [activeTab, setActiveTab] = useState('con_saldo');
  const [pageConSaldo, setPageConSaldo] = useState(1);
  const [pageSaldoCero, setPageSaldoCero] = useState(1);
  const [filtroFechaSaldoCero, setFiltroFechaSaldoCero] = useState('mes_actual'); // 'mes_actual' | 'mes_anterior'

  const [paginaDatos, setPaginaDatos] = useState(1);
  const ITEMS_POR_PAGINA_API = 20;

  // Búsqueda en servidor (debounced desde filtros.busqueda)
  const [busquedaServidor, setBusquedaServidor] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setBusquedaServidor(filtros.busqueda.trim()), 400);
    return () => clearTimeout(t);
  }, [filtros.busqueda]);
  useEffect(() => {
    setPaginaDatos(1);
  }, [busquedaServidor]);

  const PAGE_SIZE_CC = 20;

  const queryMovimientosCC = useMemo(() => {
    const q = {};
    if (filtros.fecha_desde) {
      q.fecha = q.fecha || {};
      q.fecha.$gte = new Date(filtros.fecha_desde).toISOString();
    }
    if (filtros.fecha_hasta) {
      q.fecha = q.fecha || {};
      q.fecha.$lte = new Date(filtros.fecha_hasta + 'T23:59:59').toISOString();
    }
    if (filtros.proveedor_id && filtros.proveedor_id !== 'todos') {
      q.entidad_tipo = 'Proveedor';
      q.entidad_id = filtros.proveedor_id;
    }
    return q;
  }, [filtros.fecha_desde, filtros.fecha_hasta, filtros.proveedor_id]);

  const {
    data: movimientosCCData,
    fetchNextPage: fetchMoreMovimientosCC,
    hasNextPage: hasMoreMovimientosCC,
    isFetchingNextPage: loadingMoreMovimientosCC,
    isLoading
  } = useInfiniteQuery({
    queryKey: ['cuentacorriente-infinite', filtros.fecha_desde, filtros.fecha_hasta, filtros.proveedor_id],
    queryFn: ({ pageParam = 0 }) => {
      if (Object.keys(queryMovimientosCC).length === 0) {
        return base44.entities.CuentaCorriente.list('-fecha', PAGE_SIZE_CC, pageParam);
      }
      return base44.entities.CuentaCorriente.filter(queryMovimientosCC, '-fecha', PAGE_SIZE_CC, pageParam);
    },
    getNextPageParam: (lastPage, allPages) =>
      (lastPage?.length ?? 0) === PAGE_SIZE_CC ? allPages.length * PAGE_SIZE_CC : undefined,
    initialPageParam: 0,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const movimientosCC = useMemo(() => movimientosCCData?.pages?.flat() ?? [], [movimientosCCData]);

  // Vista detalle: movimientos de CuentaCorriente filtrados por entidad (solo cuando selectedEntity está definido)
  const PAGE_SIZE_DETALLE = 20;
  const {
    data: detalleCCData,
    fetchNextPage: fetchMoreDetalleCC,
    hasNextPage: hasMoreDetalleCC,
    isFetchingNextPage: loadingMoreDetalleCC,
    isLoading: isLoadingDetalleCC,
  } = useInfiniteQuery({
    queryKey: ['cuentacorriente-detalle', selectedEntity?.entidad_id, selectedEntity?.entidad_tipo],
    queryFn: ({ pageParam = 0 }) =>
      base44.entities.CuentaCorriente.filter(
        {
          entidad_id: selectedEntity.entidad_id,
          entidad_tipo: selectedEntity.entidad_tipo,
        },
        '-fecha',
        PAGE_SIZE_DETALLE,
        pageParam
      ),
    getNextPageParam: (lastPage, allPages) =>
      (lastPage?.length ?? 0) === PAGE_SIZE_DETALLE ? allPages.length * PAGE_SIZE_DETALLE : undefined,
    initialPageParam: 0,
    enabled: !!selectedEntity?.entidad_id && !!selectedEntity?.entidad_tipo,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const movimientosDetalle = useMemo(() => detalleCCData?.pages?.flat() ?? [], [detalleCCData]);

  const queryCliente = useMemo(() => {
    if (!busquedaServidor) return {};
    return { nombre: { $regex: escapeRegex(busquedaServidor), $options: 'i' } };
  }, [busquedaServidor]);
  const skipClientes = (paginaDatos - 1) * ITEMS_POR_PAGINA_API;
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', paginaDatos, busquedaServidor],
    queryFn: () => base44.entities.Cliente.filter(queryCliente, 'nombre', ITEMS_POR_PAGINA_API, skipClientes),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const queryProveedor = useMemo(() => {
    if (!busquedaServidor) return {};
    return { nombre: { $regex: escapeRegex(busquedaServidor), $options: 'i' } };
  }, [busquedaServidor]);
  const skipProveedores = (paginaDatos - 1) * ITEMS_POR_PAGINA_API;
  const { data: proveedores = [] } = useQuery({
    queryKey: ['proveedores', paginaDatos, busquedaServidor],
    queryFn: () => base44.entities.Proveedor.filter(queryProveedor, 'nombre', ITEMS_POR_PAGINA_API, skipProveedores),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Tab "Cuentas con Saldos": solo entidades con saldo_actual != 0 (filtro en servidor si admite $ne, sino en cliente). Limit 100 por tipo, paginación en cliente.
  const { data: clientesConSaldoRaw = [] } = useQuery({
    queryKey: ['clientes-con-saldo'],
    queryFn: async () => {
      try {
        const list = await base44.entities.Cliente.filter(
          { saldo_actual: { $ne: 0 } },
          'nombre',
          100,
          0
        );
        return Array.isArray(list) ? list : [];
      } catch {
        const list = await base44.entities.Cliente.list('nombre', 200, 0);
        const all = Array.isArray(list) ? list : [];
        return all.filter(c => (Number(c.saldo_actual) || 0) !== 0);
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: proveedoresConSaldoRaw = [] } = useQuery({
    queryKey: ['proveedores-con-saldo'],
    queryFn: async () => {
      try {
        const list = await base44.entities.Proveedor.filter(
          { saldo_actual: { $ne: 0 } },
          'nombre',
          100,
          0
        );
        return Array.isArray(list) ? list : [];
      } catch {
        const list = await base44.entities.Proveedor.list('nombre', 200, 0);
        const all = Array.isArray(list) ? list : [];
        return all.filter(p => (Number(p.saldo_actual) || 0) !== 0);
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Tab "Saldos en Cero": entidades con saldo_actual == 0
  const { data: clientesSaldoCeroRaw = [] } = useQuery({
    queryKey: ['clientes-saldo-cero'],
    queryFn: async () => {
      try {
        const list = await base44.entities.Cliente.filter({ saldo_actual: 0 }, 'nombre', 500, 0);
        return Array.isArray(list) ? list : [];
      } catch {
        const list = await base44.entities.Cliente.list('nombre', 500, 0);
        return (Array.isArray(list) ? list : []).filter(c => Math.abs(Number(c.saldo_actual) || 0) < 0.01);
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: proveedoresSaldoCeroRaw = [] } = useQuery({
    queryKey: ['proveedores-saldo-cero'],
    queryFn: async () => {
      try {
        const list = await base44.entities.Proveedor.filter({ saldo_actual: 0 }, 'nombre', 500, 0);
        return Array.isArray(list) ? list : [];
      } catch {
        const list = await base44.entities.Proveedor.list('nombre', 500, 0);
        return (Array.isArray(list) ? list : []).filter(p => Math.abs(Number(p.saldo_actual) || 0) < 0.01);
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Sin queries masivas de Movimiento/Cobro/Pago/MovimientoTesoreria: confiamos en CuentaCorriente y saldo_actual.
  const movimientosCCValidos = movimientosCC;

  // CLIENTES: Cobros realizados (movimientos tipo "Debe") - usando movimientos válidos
  const cobrosPorCliente = {};
  movimientosCCValidos
    .filter(m => m.entidad_tipo === 'Cliente' && m.tipo_movimiento === 'Debe')
    .forEach(m => {
      if (!cobrosPorCliente[m.entidad_id]) {
        cobrosPorCliente[m.entidad_id] = 0;
      }
      cobrosPorCliente[m.entidad_id] += m.monto || 0;
    });

  // PROVEEDORES: Pagos realizados (movimientos tipo "Debe") - usando movimientos válidos
  const pagosPorProveedor = {};
  movimientosCCValidos
    .filter(m => m.entidad_tipo === 'Proveedor' && m.tipo_movimiento === 'Debe')
    .forEach(m => {
      if (!pagosPorProveedor[m.entidad_id]) {
        pagosPorProveedor[m.entidad_id] = 0;
      }
      pagosPorProveedor[m.entidad_id] += m.monto || 0;
    });

  // Agrupar movimientos por entidad; deuda_real = saldo_actual de la entidad (saldo vivo)
  const movimientosPorEntidad = movimientosCCValidos.reduce((acc, mov) => {
    const key = `${mov.entidad_tipo}_${mov.entidad_id}`;
    if (!acc[key]) {
      acc[key] = {
        entidad_tipo: mov.entidad_tipo,
        entidad_id: mov.entidad_id,
        entidad_nombre: mov.entidad_nombre,
        movimientos: [],
        saldo: 0,
        deuda_real: 0
      };
    }
    acc[key].movimientos.push(mov);
    acc[key].saldo = mov.saldo_resultante || 0;
    return acc;
  }, {});

  // Asignar deuda_real desde saldo_actual de Cliente/Proveedor
  Object.keys(movimientosPorEntidad).forEach(key => {
    const entidad = movimientosPorEntidad[key];
    if (entidad.entidad_tipo === 'Cliente') {
      const cliente = clientes.find(c => c.id === entidad.entidad_id);
      entidad.deuda_real = Number(cliente?.saldo_actual) || 0;
    } else if (entidad.entidad_tipo === 'Proveedor') {
      const proveedor = proveedores.find(p => p.id === entidad.entidad_id);
      entidad.deuda_real = Number(proveedor?.saldo_actual) || 0;
    }
  });

  // Incluir clientes/proveedores con saldo_actual distinto de cero que no tengan movimientos CC cargados
  clientes.forEach(cliente => {
    const key = `Cliente_${cliente.id}`;
    const saldo = Number(cliente.saldo_actual) || 0;
    if (!movimientosPorEntidad[key] && saldo !== 0) {
      movimientosPorEntidad[key] = {
        entidad_tipo: 'Cliente',
        entidad_id: cliente.id,
        entidad_nombre: cliente.nombre,
        movimientos: [],
        saldo: 0,
        deuda_real: saldo
      };
    }
  });

  proveedores.forEach(proveedor => {
    const key = `Proveedor_${proveedor.id}`;
    const saldo = Number(proveedor.saldo_actual) || 0;
    if (!movimientosPorEntidad[key] && saldo !== 0) {
      movimientosPorEntidad[key] = {
        entidad_tipo: 'Proveedor',
        entidad_id: proveedor.id,
        entidad_nombre: proveedor.nombre,
        movimientos: [],
        saldo: 0,
        deuda_real: saldo
      };
    }
  });

  const entidadesConSaldo = Object.values(movimientosPorEntidad)
    .filter(e => {
      if (filtros.entidad_tipo !== 'Todos' && e.entidad_tipo !== filtros.entidad_tipo) return false;
      
      const coincideBusqueda = !filtros.busqueda || e.entidad_nombre.toLowerCase().includes(filtros.busqueda.toLowerCase());
      if (!coincideBusqueda) return false;
      
      // Filtrar por fecha de movimientos
      if (filtros.fecha_desde || filtros.fecha_hasta) {
        const movimientosFiltrados = e.movimientos.filter(m => {
          const fechaMov = new Date(m.fecha);
          if (filtros.fecha_desde && fechaMov < new Date(filtros.fecha_desde)) return false;
          if (filtros.fecha_hasta && fechaMov > new Date(filtros.fecha_hasta + 'T23:59:59')) return false;
          return true;
        });
        if (movimientosFiltrados.length === 0) return false;
      }
      
      // Ocultar saldos en cero SOLO si:
      // - No hay búsqueda activa
      // - El toggle está desactivado
      const tieneSaldo = e.deuda_real > 0 || e.movimientos.length > 0;
      const deudaEsCero = Math.abs(e.deuda_real) < 0.01;
      
      if (deudaEsCero && !mostrarSaldosCero && !filtros.busqueda) {
        return false;
      }
      
      return tieneSaldo;
    })
    .sort((a, b) => {
      // Ordenar: saldos != 0 primero (mayor a menor), luego saldos = 0
      const saldoA = Math.abs(a.deuda_real) < 0.01 ? 0 : a.deuda_real;
      const saldoB = Math.abs(b.deuda_real) < 0.01 ? 0 : b.deuda_real;
      
      if (saldoA === 0 && saldoB !== 0) return 1;
      if (saldoA !== 0 && saldoB === 0) return -1;
      if (saldoA !== 0 && saldoB !== 0) return saldoB - saldoA;
      return 0;
    });

  // Paginación
  const totalPaginas = Math.ceil(entidadesConSaldo.length / ITEMS_POR_PAGINA);
  const indicePrimerItem = (paginaActual - 1) * ITEMS_POR_PAGINA;
  const entidadesPaginadas = entidadesConSaldo.slice(indicePrimerItem, indicePrimerItem + ITEMS_POR_PAGINA);

  // Resetear página de la tabla al cambiar filtros
  React.useEffect(() => {
    setPaginaActual(1);
  }, [filtros.entidad_tipo, filtros.busqueda, filtros.fecha_desde, filtros.fecha_hasta, mostrarSaldosCero]);

  // Si hay búsqueda activa, el input ya filtra en servidor; el placeholder lo indica
  const tieneMasDatos = (clientes.length === ITEMS_POR_PAGINA_API || proveedores.length === ITEMS_POR_PAGINA_API);

  // Filas para Tab "Cuentas con Saldos": Nombre, Teléfono, Saldo
  const filasConSaldo = useMemo(() => {
    const listC = (clientesConSaldoRaw || []).map(c => ({
      entidad_tipo: 'Cliente',
      entidad_id: c.id,
      entidad_nombre: c.nombre,
      telefono: c.telefono || c.whatsapp || '',
      saldo_actual: Number(c.saldo_actual) || 0,
      raw: c,
    }));
    const listP = (proveedoresConSaldoRaw || []).map(p => ({
      entidad_tipo: 'Proveedor',
      entidad_id: p.id,
      entidad_nombre: p.nombre,
      telefono: p.telefono || p.whatsapp || '',
      saldo_actual: Number(p.saldo_actual) || 0,
      raw: p,
    }));
    return [...listC, ...listP].sort((a, b) => b.saldo_actual - a.saldo_actual);
  }, [clientesConSaldoRaw, proveedoresConSaldoRaw]);

  // Filas para Tab "Saldos en Cero", filtradas por Mes Actual / Mes Anterior (updated_at)
  const filasSaldoCero = useMemo(() => {
    const now = new Date();
    const inicioMesActual = startOfMonth(now);
    const finMesActual = endOfMonth(now);
    const inicioMesAnterior = startOfMonth(subMonths(now, 1));
    const finMesAnterior = endOfMonth(subMonths(now, 1));
    const [desde, hasta] = filtroFechaSaldoCero === 'mes_actual'
      ? [inicioMesActual, finMesActual]
      : [inicioMesAnterior, finMesAnterior];
    const enRango = (ent) => {
      const fecha = ent.updated_at || ent.updated_date;
      if (!fecha) return true;
      const d = new Date(fecha);
      return d >= desde && d <= hasta;
    };
    const listC = (clientesSaldoCeroRaw || []).filter(enRango).map(c => ({
      entidad_tipo: 'Cliente',
      entidad_id: c.id,
      entidad_nombre: c.nombre,
      telefono: c.telefono || c.whatsapp || '',
      saldo_actual: 0,
      raw: c,
    }));
    const listP = (proveedoresSaldoCeroRaw || []).filter(enRango).map(p => ({
      entidad_tipo: 'Proveedor',
      entidad_id: p.id,
      entidad_nombre: p.nombre,
      telefono: p.telefono || p.whatsapp || '',
      saldo_actual: 0,
      raw: p,
    }));
    return [...listC, ...listP].sort((a, b) => (a.entidad_nombre || '').localeCompare(b.entidad_nombre || ''));
  }, [clientesSaldoCeroRaw, proveedoresSaldoCeroRaw, filtroFechaSaldoCero]);

  const pageSizeTab = 20;
  const filasConSaldoPaginadas = useMemo(() => {
    const start = (pageConSaldo - 1) * pageSizeTab;
    return filasConSaldo.slice(start, start + pageSizeTab);
  }, [filasConSaldo, pageConSaldo]);
  const filasSaldoCeroPaginadas = useMemo(() => {
    const start = (pageSaldoCero - 1) * pageSizeTab;
    return filasSaldoCero.slice(start, start + pageSizeTab);
  }, [filasSaldoCero, pageSaldoCero]);

  const totalPaginasConSaldo = Math.ceil(filasConSaldo.length / pageSizeTab) || 1;
  const totalPaginasSaldoCero = Math.ceil(filasSaldoCero.length / pageSizeTab) || 1;

  const verDetalleDesdeTab = (fila) => {
    const movimientos = movimientosCCValidos.filter(
      m => m.entidad_tipo === fila.entidad_tipo && m.entidad_id === fila.entidad_id
    );
    const entidad = {
      entidad_tipo: fila.entidad_tipo,
      entidad_id: fila.entidad_id,
      entidad_nombre: fila.entidad_nombre,
      movimientos,
      deuda_real: fila.saldo_actual,
    };
    setSelectedEntity(entidad);
    setEntidadSeleccionada(entidad);
  };

  // Totales para KPIs (saldo vivo desde entidades; cobros/pagos desde movimientos CC)
  const totalCobrosClientes = Object.values(cobrosPorCliente).reduce((sum, d) => sum + d, 0);
  const totalPagosProveedores = Object.values(pagosPorProveedor).reduce((sum, d) => sum + d, 0);
  const totalDeudaClientes = clientes.reduce((sum, c) => sum + (Number(c.saldo_actual) || 0), 0);
  const totalDeudaProveedores = proveedores.reduce((sum, p) => sum + (Number(p.saldo_actual) || 0), 0);

  const verDetalle = (entidad) => {
    setEntidadSeleccionada(entidad);
  };

  const exportarEstadoCuentaPDF = (entidad, movimientos, filtros) => {
    if (!movimientos || movimientos.length === 0) {
      toast.error('No hay movimientos para exportar en el período seleccionado');
      return;
    }

    const nombreEntidad = entidad.entidad_nombre;
    const tipoEntidad = entidad.entidad_tipo;
    const montoTotal = entidad.deuda_real || 0;

    // Calcular totales de ingresos y pagos
    const totalDeudas = movimientos
      .filter(m => m.tipo_movimiento === 'Haber')
      .reduce((sum, m) => sum + (m.monto || 0), 0);
    
    const totalPagos = movimientos
      .filter(m => m.tipo_movimiento === 'Debe')
      .reduce((sum, m) => sum + (m.monto || 0), 0);

    const periodoTexto = filtros.fecha_desde && filtros.fecha_hasta
      ? `${format(new Date(filtros.fecha_desde), 'dd/MM/yyyy', { locale: es })} al ${format(new Date(filtros.fecha_hasta), 'dd/MM/yyyy', { locale: es })}`
      : 'Todo el período';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Estado de Cuenta - ${nombreEntidad}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            font-size: 10px; 
            padding: 20px;
            color: #1e293b;
          }
          .header { 
            text-align: center; 
            margin-bottom: 25px; 
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 15px;
          }
          .empresa { 
            font-size: 14px; 
            font-weight: bold; 
            color: #3b82f6;
            margin-bottom: 5px;
          }
          .title { 
            font-size: 20px; 
            font-weight: bold; 
            color: #1e293b;
            margin-bottom: 10px;
          }
          .entidad-info {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
          }
          .entidad-nombre {
            font-size: 16px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 5px;
          }
          .entidad-tipo {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 600;
            background: ${tipoEntidad === 'Cliente' ? '#dbeafe' : '#fef3c7'};
            color: ${tipoEntidad === 'Cliente' ? '#1e40af' : '#92400e'};
            margin-bottom: 10px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
          }
          .resumen {
            background: #f1f5f9;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin-bottom: 20px;
          }
          .resumen-title {
            font-size: 12px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 10px;
          }
          .monto-principal {
            font-size: 24px;
            font-weight: bold;
            color: ${montoTotal > 0 ? '#dc2626' : '#16a34a'};
            margin-top: 5px;
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
            padding: 10px 8px;
            border-bottom: 2px solid #cbd5e1;
            font-size: 9px;
            text-transform: uppercase;
            color: #475569;
          }
          td { 
            border-bottom: 1px solid #e2e8f0; 
            padding: 8px;
            vertical-align: top;
            font-size: 9px;
          }
          .text-right { text-align: right; }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 600;
          }
          .badge-deuda { background: #fef3c7; color: #92400e; }
          .badge-pago { background: #d1fae5; color: #065f46; }
          .monto-positivo { color: #16a34a; font-weight: 600; }
          .monto-negativo { color: #dc2626; font-weight: 600; }
          .saldo-cell { font-weight: bold; color: #1e293b; }
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 8px;
          }
          .periodo {
            font-size: 10px;
            color: #64748b;
            margin-bottom: 3px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="empresa">Sistema de Gestión de Acopio</div>
          <div class="title">ESTADO DE CUENTA</div>
          <div class="periodo">Período: ${periodoTexto}</div>
          <div class="periodo">Fecha de emisión: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}</div>
        </div>
        
        <div class="entidad-info">
          <div class="entidad-nombre">${nombreEntidad}</div>
          <span class="entidad-tipo">${tipoEntidad}</span>
          <div style="margin-top: 10px;">
            <div class="info-row">
              <span style="color: #64748b;">Total de movimientos:</span>
              <span style="font-weight: 600;">${movimientos.length}</span>
            </div>
          </div>
        </div>

        <div class="resumen">
          <div class="resumen-title">Resumen del Estado de Cuenta</div>
          <div class="info-row">
            <span>Total Deudas Generadas:</span>
            <span style="font-weight: 600;">$${totalDeudas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="info-row">
            <span>Total ${tipoEntidad === 'Cliente' ? 'Cobros' : 'Pagos'} Realizados:</span>
            <span style="font-weight: 600;">$${totalPagos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #cbd5e1;">
            <div class="info-row">
              <span style="font-weight: bold;">${tipoEntidad === 'Cliente' ? 'Monto Adeudado:' : 'Monto a Pagar:'}</span>
              <span class="monto-principal">$${montoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 12%">Fecha</th>
              <th style="width: 30%">Descripción</th>
              <th style="width: 15%">Tipo</th>
              <th style="width: 18%" class="text-right">Movimiento</th>
              <th style="width: 18%" class="text-right">Saldo Acum.</th>
            </tr>
          </thead>
          <tbody>
            ${movimientos.map(mov => {
              const montoMostrado = mov.monto ?? 0;
              const saldoMostrado = mov.tipo_movimiento === 'Haber' ? montoMostrado : (mov.saldo_resultante || 0);
              const esDeuda = mov.tipo_movimiento === 'Haber';
              
              return `
                <tr>
                  <td>${mov.fecha ? format(new Date(mov.fecha), "dd/MM/yyyy", { locale: es }) : '-'}</td>
                  <td>
                    <strong>${mov.concepto ?? '-'}</strong><br>
                    <span class="badge" style="background: #e0e7ff; color: #3730a3; margin-top: 2px; display: inline-block;">${mov.comprobante_tipo || 'N/A'}</span>
                  </td>
                  <td>
                    <span class="badge ${esDeuda ? 'badge-deuda' : 'badge-pago'}">
                      ${esDeuda ? 'Deuda' : (tipoEntidad === 'Cliente' ? 'Cobro' : 'Pago')}
                    </span>
                  </td>
                  <td class="text-right ${esDeuda ? 'monto-positivo' : 'monto-negativo'}">
                    ${esDeuda ? '+' : '-'} $${montoMostrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td class="text-right saldo-cell">
                    $${saldoMostrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p><strong>Documento generado automáticamente</strong></p>
          <p>Sistema de Gestión de Acopio • ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
        </div>
      </body>
      </html>
    `;

    const ventana = window.open('', '_blank');
    ventana.document.write(html);
    ventana.document.close();
    ventana.onload = () => ventana.print();
  };

  // Vista de detalle cuando se eligió una entidad desde las pestañas: oculta pestañas y muestra movimientos con useInfiniteQuery
  if (selectedEntity) {
    const volverALista = () => {
      setSelectedEntity(null);
      setEntidadSeleccionada(null);
    };
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-6xl mx-auto">
          <Button
            onClick={volverALista}
            variant="outline"
            className="mb-6"
          >
            ← Volver
          </Button>

          <div className="mb-6 pb-6 border-b border-slate-200">
            <h1 className="text-3xl font-bold text-slate-900">{selectedEntity.entidad_nombre}</h1>
            <p className="text-slate-600 mt-1">
              {selectedEntity.entidad_tipo === 'Cliente' ? 'Cliente' : 'Proveedor'} • Estado de Cuenta
            </p>
            <p className="text-lg font-semibold text-slate-700 mt-2">
              Saldo: ${(selectedEntity.deuda_real ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {isLoadingDetalleCC ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : movimientosDetalle.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-slate-500">
                No hay movimientos para esta entidad.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Fecha</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Tipo</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Comprobante</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Debe</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Haber</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Saldo Parcial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientosDetalle.map((mov) => {
                      const monto = mov.monto ?? 0;
                      const esDebe = mov.tipo_movimiento === 'Debe';
                      const saldoParcial = mov.saldo_resultante ?? '';
                      return (
                        <tr key={mov.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700">
                            {mov.fecha ? format(new Date(mov.fecha), 'dd/MM/yyyy', { locale: es }) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={esDebe ? 'outline' : 'secondary'} className="text-xs">
                              {esDebe ? 'Pago' : 'Ingreso'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {mov.comprobante_tipo ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {esDebe ? `$${Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {!esDebe ? `$${Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {saldoParcial !== '' ? `$${Number(saldoParcial).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {hasMoreDetalleCC && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => fetchMoreDetalleCC()}
                    disabled={loadingMoreDetalleCC}
                  >
                    {loadingMoreDetalleCC ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Cargar más movimientos
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (entidadSeleccionada) {
    let movimientosFiltrados = entidadSeleccionada.movimientos;
    
    if (filtros.fecha_desde) {
      movimientosFiltrados = movimientosFiltrados.filter(m => 
        new Date(m.fecha) >= new Date(filtros.fecha_desde)
      );
    }
    if (filtros.fecha_hasta) {
      movimientosFiltrados = movimientosFiltrados.filter(m => 
        new Date(m.fecha) <= new Date(filtros.fecha_hasta)
      );
    }

    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-6xl mx-auto">
          <Button 
            onClick={() => setEntidadSeleccionada(null)} 
            variant="outline" 
            className="mb-6"
          >
            ← Volver
          </Button>

          {/* Encabezado Profesional */}
          <div className="mb-6 pb-6 border-b border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  {entidadSeleccionada.entidad_nombre}
                </h1>
                <p className="text-slate-600 mt-1">
                  {entidadSeleccionada.entidad_tipo === 'Cliente' ? 'Cliente' : 'Proveedor'} • Estado de Cuenta
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {entidadSeleccionada.entidad_tipo === 'Cliente' ? 'Monto Adeudado' : 'Monto a Pagar'}
                </p>
                <p className="text-4xl font-bold text-slate-900">
                  ${(entidadSeleccionada.deuda_real || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                <Button
                  onClick={() => exportarEstadoCuentaPDF(entidadSeleccionada, movimientosFiltrados, filtros)}
                  className="mt-4 bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <Label className="text-xs text-slate-500">Fecha Desde</Label>
              <Input
                type="date"
                value={filtros.fecha_desde}
                onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Fecha Hasta</Label>
              <Input
                type="date"
                value={filtros.fecha_hasta}
                onChange={(e) => setFiltros({ ...filtros, fecha_hasta: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          {/* Tabla de Movimientos - Estilo Estado de Cuenta */}
          {movimientosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No hay movimientos para este período</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">Fecha</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">Descripción</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">Tipo</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-700">Movimiento</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-700">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosFiltrados.map((mov) => {
                    const montoMostrado = mov.monto ?? 0;
                    const saldoMostrado = mov.tipo_movimiento === 'Haber' ? montoMostrado : (mov.saldo_resultante || 0);
                    return (
                      <tr key={mov.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-700 font-medium">
                          {mov.fecha ? format(new Date(mov.fecha), "dd/MM/yyyy", { locale: es }) : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-slate-900 font-medium">{mov.concepto ?? '-'}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              <Badge variant="outline" className="mr-2 text-xs h-5">
                                {mov.comprobante_tipo}
                              </Badge>
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={mov.tipo_movimiento === 'Debe' ? 'outline' : 'secondary'} className="text-xs">
                            {mov.tipo_movimiento === 'Debe' ? 'Pago/Cobro' : 'Deuda'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-900">
                          {mov.tipo_movimiento === 'Debe' ? '-' : '+'} ${montoMostrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                          ${saldoMostrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 pb-6 border-b border-slate-200">
          <h1 className="text-3xl font-bold text-slate-900">Cuentas Corrientes</h1>
          <p className="text-slate-600 mt-1">Estados de cuenta de clientes y proveedores</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Deuda Total Clientes</p>
                  <p className="text-lg font-semibold text-rose-500">
                    ${totalDeudaClientes.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">A cobrar</p>
                </div>
                <TrendingUp className="h-8 w-8 text-rose-500 opacity-10" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Cobros Realizados</p>
                  <p className="text-lg font-semibold text-emerald-500">
                    ${totalCobrosClientes.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Ya cobrado</p>
                </div>
                <DollarSign className="h-8 w-8 text-emerald-500 opacity-10" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Deuda Total Proveedores</p>
                  <p className="text-lg font-semibold text-amber-500">
                    ${totalDeudaProveedores.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">A pagar</p>
                </div>
                <TrendingDown className="h-8 w-8 text-amber-500 opacity-10" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Pagos Realizados</p>
                  <p className="text-lg font-semibold text-sky-500">
                    ${totalPagosProveedores.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Ya pagado</p>
                </div>
                <DollarSign className="h-8 w-8 text-sky-500 opacity-10" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6 border-slate-100 shadow-sm">
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs">Tipo de Entidad</Label>
                  <select
                    value={filtros.entidad_tipo}
                    onChange={(e) => setFiltros({ ...filtros, entidad_tipo: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm mt-1"
                  >
                    <option value="Todos">Todas las entidades</option>
                    <option value="Cliente">Clientes</option>
                    <option value="Proveedor">Proveedores</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Buscar (filtra en servidor)</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={filtros.busqueda}
                      onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
                      placeholder="Nombre de cliente o proveedor..."
                      className="pl-10 h-9"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Fecha Desde</Label>
                  <Input
                    type="date"
                    value={filtros.fecha_desde}
                    onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })}
                    className="h-9 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fecha Hasta</Label>
                  <Input
                    type="date"
                    value={filtros.fecha_hasta}
                    onChange={(e) => setFiltros({ ...filtros, fecha_hasta: e.target.value })}
                    className="h-9 mt-1"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <Switch 
                  checked={mostrarSaldosCero} 
                  onCheckedChange={setMostrarSaldosCero}
                  id="saldos-cero"
                />
                <Label htmlFor="saldos-cero" className="text-xs text-slate-600 cursor-pointer">
                  Mostrar entidades con saldo en cero
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paginación de datos del servidor (cargar más entidades) */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-2">
          <span className="text-xs text-slate-600">
            Datos cargados: página {paginaDatos} · {clientes.length} clientes, {proveedores.length} proveedores
            {busquedaServidor && ` · búsqueda: "${busquedaServidor}"`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaginaDatos(p => Math.max(1, p - 1))}
              disabled={paginaDatos === 1}
              className="h-8 text-xs"
            >
              <ChevronLeft className="h-3 w-3 mr-1" />
              Anterior
            </Button>
            <span className="text-xs text-slate-600">Página {paginaDatos}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaginaDatos(p => p + 1)}
              disabled={!tieneMasDatos}
              className="h-8 text-xs"
            >
              Siguiente
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>

        {/* Lista de Entidades */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : entidadesConSaldo.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Scale className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay movimientos en cuenta corriente</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    const datosFormato = entidadesPaginadas.map(e => ({
                      'Entidad': e.entidad_nombre,
                      'Tipo': e.entidad_tipo,
                      'Movimientos': e.movimientos.length,
                      'Monto Adeudado': e.deuda_real
                    }));
                    exportarExcel(datosFormato, 'cuentas_corrientes');
                  }}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Excel
                </Button>
                <Button
                  onClick={() => {
                    const html = `
                      <!DOCTYPE html>
                      <html><head><meta charset="UTF-8"><title>Cuentas Corrientes</title>
                      <style>body{font-family:Arial;font-size:10px;padding:20px}h1{text-align:center;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#3b82f6;color:white;font-weight:bold}</style></head><body>
                      <h1>Cuentas Corrientes</h1>
                      <table><thead><tr><th>Entidad</th><th>Tipo</th><th>Movimientos</th><th>Monto Adeudado</th></tr></thead><tbody>
                      ${entidadesPaginadas.map(e => `<tr><td>${e.entidad_nombre}</td><td>${e.entidad_tipo}</td><td>${e.movimientos.length}</td><td>$${e.deuda_real.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td></tr>`).join('')}
                      </tbody></table>
                      <p style="margin-top:20px;text-align:right;font-size:9px">Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p></body></html>`;
                    const printWindow = window.open('', '_blank');
                    printWindow.document.write(html);
                    printWindow.document.close();
                    printWindow.onload = () => printWindow.print();
                  }}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
            </div>
            <div className="overflow-x-auto border border-slate-100 rounded-lg shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Entidad</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Movs.</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {entidadesPaginadas.map(entidad => {
                    const saldoCero = Math.abs(entidad.deuda_real) < 0.01;
                    const saldoColor = saldoCero ? 'text-slate-400' : (entidad.deuda_real > 0 ? 'text-rose-600' : 'text-emerald-600');
                    
                    return (
                      <tr 
                        key={`${entidad.entidad_tipo}_${entidad.entidad_id}`}
                        className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => verDetalle(entidad)}
                      >
                        <td className="px-4 py-2.5">
                          <p className="text-sm font-medium text-slate-900">{entidad.entidad_nombre}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge 
                            variant="outline" 
                            className={`text-[11px] ${entidad.entidad_tipo === 'Cliente' ? 'border-blue-200 text-blue-700 bg-blue-50' : 'border-amber-200 text-amber-700 bg-amber-50'}`}
                          >
                            {entidad.entidad_tipo}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <p className="text-sm text-slate-600">{entidad.movimientos.length}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <p className={`text-base font-semibold ${saldoColor}`}>
                            ${(entidad.deuda_real || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="text-xs text-slate-500">
                  Mostrando {indicePrimerItem + 1} - {Math.min(indicePrimerItem + ITEMS_POR_PAGINA, entidadesConSaldo.length)} de {entidadesConSaldo.length} entidades
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                    disabled={paginaActual === 1}
                    className="h-8 text-xs"
                  >
                    <ChevronLeft className="h-3 w-3 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-xs text-slate-600 px-3">
                    Página {paginaActual} de {totalPaginas}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual === totalPaginas}
                    className="h-8 text-xs"
                  >
                    Siguiente
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Botón Cargar Más Movimientos */}
            {!isLoading && hasMoreMovimientosCC && (
              <Card className="border-0 shadow-md mt-4">
                <CardContent className="p-4 text-center">
                  <Button
                    variant="outline"
                    onClick={fetchMoreMovimientosCC}
                    disabled={loadingMoreMovimientosCC}
                    className="w-full sm:w-auto"
                  >
                    {loadingMoreMovimientosCC ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Cargar más movimientos
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-slate-500 mt-2">
                    Mostrando {movimientosCC.length} movimientos de cuenta corriente
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}