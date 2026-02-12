import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { Settings, BookOpen, DollarSign, Database, Users, Wrench, Lock } from "lucide-react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { escapeRegex } from '@/lib/utils';
import { parseCSVLine } from '@/utils/parseCSV';
import { extraerMensajeError } from '@/utils/extraerMensajeError';
import { ejecutarCorreccionManual } from '@/utils/ejecutarCorreccionManual';
import { sincronizarSaldosEntidades } from '@/utils/contabilidad';
import { usePinGuard } from '@/hooks/usePinGuard';
import { useSecurity } from '@/lib/SecurityContext';

// Componentes de contenido
import ABMContent from '@/components/configuracion/ABMContent';
import PlanCuentasContent from '@/components/configuracion/PlanCuentasContent';
import PreciosContent from '@/components/configuracion/PreciosContent';
import MantenimientoContent from '@/components/configuracion/MantenimientoContent';
import SeguridadContent from '@/components/configuracion/SeguridadContent';
import CategoriasEmpleadoContent from '@/components/configuracion/CategoriasEmpleadoContent';
import ImportesConfigContent from '@/components/configuracion/ImportesConfigContent';
import UsuariosContent from '@/components/configuracion/UsuariosContent';

// Modales
import ABMModal from '@/components/configuracion/modals/ABMModal';
import CuentaModal from '@/components/configuracion/modals/CuentaModal';
import PrecioModal from '@/components/configuracion/modals/PrecioModal';
import ImporteModal from '@/components/configuracion/modals/ImporteModal';
import EmpleadoModal from '@/components/configuracion/modals/EmpleadoModal';
import DeleteConfirmModal from '@/components/configuracion/modals/DeleteConfirmModal';
import CategoriaEmpleadoModal from '@/components/configuracion/modals/CategoriaEmpleadoModal';
import ImportModal from '@/components/configuracion/modals/ImportModal';
import InvitarUsuarioModal from '@/components/configuracion/modals/InvitarUsuarioModal';
import ImportBancosModal from '@/components/configuracion/modals/ImportBancosModal';

export default function ConfiguracionUnificada() {
  const queryClient = useQueryClient();
  const { askPin, PinGuardModal } = usePinGuard();
  const { verifyPin, pinConfig } = useSecurity();
  const [activeTab, setActiveTab] = useState('abm');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Estados para PIN
  const [pinActual, setPinActual] = useState('');
  const [nuevoPin, setNuevoPin] = useState('');
  const [confirmarPin, setConfirmarPin] = useState('');

  // Estados para ABM (paginación y búsqueda en servidor)
  const [editModal, setEditModal] = useState({ open: false, type: null, item: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, type: null, item: null });
  const [abmSubTab, setAbmSubTab] = useState('proveedores');
  const [abmSearchTerm, setAbmSearchTerm] = useState('');
  const ABM_PAGE_SIZE = 20;

  const abmEntityConfig = useMemo(() => ({
    proveedores: { entity: 'Proveedor', order: 'nombre', searchField: 'nombre', displayKey: 'nombre' },
    clientes: { entity: 'Cliente', order: 'nombre', searchField: 'nombre', displayKey: 'nombre' },
    envases: { entity: 'Envase', order: 'tipo', searchField: 'tipo', displayKey: 'tipo' },
    productos: { entity: 'Producto', order: 'fruta', searchField: 'fruta', displayKey: 'nombre' },
    fleteros: { entity: 'Fletero', order: 'nombre', searchField: 'nombre', displayKey: 'nombre' },
    bancos: { entity: 'BancoSistema', order: 'nombre', searchField: 'nombre', displayKey: 'nombre' }
  }), []);

  const {
    data: abmDataRaw,
    fetchNextPage: fetchMoreAbm,
    hasNextPage: hasMoreAbm,
    isFetchingNextPage: loadingMoreAbm,
    isLoading: loadingAbm
  } = useInfiniteQuery({
    queryKey: ['abm', abmSubTab, abmSearchTerm],
    queryFn: async ({ pageParam = 0 }) => {
      const config = abmEntityConfig[abmSubTab];
      if (!config) return [];
      const trimmed = abmSearchTerm.trim();
      const query = trimmed
        ? { [config.searchField]: { $regex: escapeRegex(trimmed), $options: 'i' } }
        : {};
      const raw = await base44.entities[config.entity].filter(query, config.order, ABM_PAGE_SIZE, pageParam);
      const list = Array.isArray(raw) ? raw : [];
      if (abmSubTab === 'productos') {
        return list.map(p => ({ ...p, nombre: `${p.fruta || ''} - ${p.variedad || ''}`.replace(/^ - | - $/g, '').trim() }));
      }
      return list;
    },
    getNextPageParam: (lastPage, allPages) =>
      (lastPage?.length ?? 0) === ABM_PAGE_SIZE ? allPages.length * ABM_PAGE_SIZE : undefined,
    initialPageParam: 0,
    enabled: activeTab === 'abm',
    staleTime: 2 * 60 * 1000
  });

  const abmData = useMemo(() => abmDataRaw?.pages?.flat() ?? [], [abmDataRaw]);

  React.useEffect(() => {
    setAbmSearchTerm('');
  }, [abmSubTab]);

  // Estados para Plan de Cuentas
  const [cuentaModal, setCuentaModal] = useState({ open: false, item: null });
  const [importModal, setImportModal] = useState(false);
  const [planCuentasSearchTerm, setPlanCuentasSearchTerm] = useState('');
  const PLAN_CUENTAS_PAGE_SIZE = 50;

  // Estados para Períodos de Precio
  const [precioModal, setPrecioModal] = useState({ open: false, item: null });

  // Estados para Empleados
  const [empleadoModal, setEmpleadoModal] = useState({ open: false, item: null });
  const [invitarUsuarioModal, setInvitarUsuarioModal] = useState(false);
  const [emailInvitar, setEmailInvitar] = useState('');
  const [rolInvitar, setRolInvitar] = useState('user');

  const [categoriaModal, setCategoriaModal] = useState({ open: false, item: null });
  const [importeModal, setImporteModal] = useState({ open: false, item: null });
  const [importBancosModal, setImportBancosModal] = useState(false);
  const [ejecutandoCorreccion, setEjecutandoCorreccion] = useState(null);
  const [progresoSincronizacion, setProgresoSincronizacion] = useState('');

  // Cargar usuario actual
  React.useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error al obtener usuario:', error);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, []);

  // Queries (solo las necesarias fuera del ABM)
  
  // Plan de Cuentas con paginación infinita
  const {
    data: cuentasDataRaw,
    fetchNextPage: fetchMoreCuentas,
    hasNextPage: hasMoreCuentas,
    isFetchingNextPage: loadingMoreCuentas,
    isLoading: loadingCuentas
  } = useInfiniteQuery({
    queryKey: ['plancuentas', planCuentasSearchTerm],
    queryFn: async ({ pageParam = 0 }) => {
      const trimmed = planCuentasSearchTerm.trim();
      const query = trimmed
        ? {
            $or: [
              { codigo: { $regex: escapeRegex(trimmed), $options: 'i' } },
              { nombre: { $regex: escapeRegex(trimmed), $options: 'i' } },
              { tipo: { $regex: escapeRegex(trimmed), $options: 'i' } },
              { categoria: { $regex: escapeRegex(trimmed), $options: 'i' } }
            ]
          }
        : {};
      const raw = await base44.entities.PlanDeCuentas.filter(query, 'codigo', PLAN_CUENTAS_PAGE_SIZE, pageParam);
      return Array.isArray(raw) ? raw : [];
    },
    getNextPageParam: (lastPage, allPages) =>
      (lastPage?.length ?? 0) === PLAN_CUENTAS_PAGE_SIZE ? allPages.length * PLAN_CUENTAS_PAGE_SIZE : undefined,
    initialPageParam: 0,
    enabled: activeTab === 'plancuentas',
    staleTime: 10 * 60 * 1000
  });

  const cuentas = useMemo(() => cuentasDataRaw?.pages?.flat() ?? [], [cuentasDataRaw]);

  const { data: periodosPrecios = [] } = useQuery({
    queryKey: ['periodosprecios'],
    queryFn: () => base44.entities.PeriodoPrecio.list('-fecha_desde'),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: empleados = [] } = useQuery({
    queryKey: ['empleados'],
    queryFn: () => base44.entities.Empleado.list('nombre'),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: categoriasEmpleado = [] } = useQuery({
    queryKey: ['categoriasempleado'],
    queryFn: () => base44.entities.CategoriaEmpleado.list('nombre'),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: bancosSistema = [] } = useQuery({
    queryKey: ['bancossistema'],
    queryFn: () => base44.entities.BancoSistema.list('nombre', 100),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: importesConfig = [] } = useQuery({
    queryKey: ['importesconfig'],
    queryFn: () => base44.entities.ConfiguracionImportes.list()
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list('-created_date')
  });

  // Mutations para PIN
  const guardarPINMutation = useMutation({
    mutationFn: async ({ pinActual, nuevoPin }) => {
      console.log('=== GUARDANDO PIN ===');
      console.log('PIN Actual ingresado:', pinActual);
      console.log('Nuevo PIN:', nuevoPin);
      
      const esPinActualValido = await verifyPin(pinActual);
      if (!esPinActualValido) {
        console.error('PIN actual incorrecto');
        throw new Error('PIN actual incorrecto');
      }
      if (nuevoPin.length < 4 || nuevoPin.length > 6) {
        throw new Error('El PIN debe tener entre 4 y 6 dígitos');
      }
      if (!/^\d+$/.test(nuevoPin)) {
        throw new Error('El PIN debe contener solo números');
      }
      
      console.log('Validaciones OK, actualizando en BD...');
      
      if (pinConfig?.id) {
        await base44.entities.Configuracion.update(pinConfig.id, { valor: nuevoPin });
        console.log('PIN actualizado');
      } else {
        await base44.entities.Configuracion.create({
          clave: 'pin_seguridad',
          valor: nuevoPin,
          descripcion: 'PIN de seguridad para ediciones'
        });
        console.log('PIN creado');
      }
    },
    onSuccess: () => {
      console.log('=== PIN GUARDADO EXITOSAMENTE ===');
      queryClient.invalidateQueries({ queryKey: ['security', 'pin-config'] });
      setPinActual('');
      setNuevoPin('');
      setConfirmarPin('');
      toast.success('✅ PIN modificado exitosamente');
    },
    onError: (error) => {
      console.error('Error al guardar PIN:', error);
      toast.error(error.message || 'Error al actualizar PIN');
    }
  });

  // Mutations para ABM
  const guardarABMMutation = useMutation({
    mutationFn: async ({ type, item, isNew }) => {
      const entityMap = {
        proveedor: 'Proveedor',
        cliente: 'Cliente',
        envase: 'Envase',
        producto: 'Producto',
        fletero: 'Fletero',
        banco: 'BancoSistema'
      };
      const entityName = entityMap[type];
      
      if (type === 'producto' && item.fruta && item.variedad) {
        item.producto_completo = `${item.fruta} - ${item.variedad}`;
      }

      if (isNew) {
        return base44.entities[entityName].create(item);
      } else {
        const { id, ...data } = item;
        return base44.entities[entityName].update(id, data);
      }
    },
    onSuccess: (_, variables) => {
      const queryKey = variables.type === 'proveedor' ? 'proveedores' : 
                       variables.type === 'banco' ? 'bancossistema' : 
                       `${variables.type}s`;
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ['abm'] });
      setEditModal({ open: false, type: null, item: null });
      toast.success(`${variables.isNew ? 'Creado' : 'Actualizado'} exitosamente`);
    },
    onError: (error) => {
      const mensaje = extraerMensajeError(error, 'guardar');
      toast.error(mensaje);
    }
  });

  const eliminarABMMutation = useMutation({
    mutationFn: async ({ type, id, nombre }) => {
      const entityMap = {
        proveedor: 'Proveedor',
        cliente: 'Cliente',
        envase: 'Envase',
        producto: 'Producto',
        fletero: 'Fletero',
        banco: 'BancoSistema'
      };
      
      // Validar antes de eliminar Clientes o Proveedores
      if (type === 'cliente' || type === 'proveedor') {
        const [movimientos, cuentaCorriente] = await Promise.all([
          base44.entities.Movimiento.list(),
          base44.entities.CuentaCorriente.list()
        ]);
        
        const tieneMovimientos = movimientos.some(m => {
          if (type === 'cliente') {
            return m.cliente_id === id || (m.tipo_movimiento === 'Salida de Fruta' && m.cliente_id === id);
          } else {
            return m.proveedor_id === id || (m.tipo_movimiento === 'Ingreso de Fruta' && m.proveedor_id === id);
          }
        });
        
        const tieneCuentaCorriente = cuentaCorriente.some(cc => {
          const entidadTipo = type === 'cliente' ? 'Cliente' : 'Proveedor';
          return cc.entidad_tipo === entidadTipo && cc.entidad_id === id;
        });
        
        if (tieneMovimientos || tieneCuentaCorriente) {
          throw new Error(`No se puede eliminar: este ${type === 'cliente' ? 'cliente' : 'proveedor'} tiene historial contable`);
        }
      }
      
      return base44.entities[entityMap[type]].delete(id);
    },
    onSuccess: (_, variables) => {
      const queryKey = variables.type === 'proveedor' ? 'proveedores' : 
                       variables.type === 'banco' ? 'bancossistema' : 
                       `${variables.type}s`;
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ['abm'] });
      setDeleteConfirm({ open: false, type: null, item: null });
      toast.success('Eliminado exitosamente');
    },
    onError: (error) => {
      const mensaje = extraerMensajeError(error, 'eliminar');
      toast.error(mensaje);
    }
  });

  // Mutations para Plan de Cuentas
  const guardarCuentaMutation = useMutation({
    mutationFn: async (item) => {
      if (item.id) {
        const { id, ...data } = item;
        return base44.entities.PlanDeCuentas.update(id, data);
      }
      return base44.entities.PlanDeCuentas.create(item);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['plancuentas']);
      setCuentaModal({ open: false, item: null });
      toast.success('Cuenta guardada exitosamente');
    },
    onError: (error) => {
      const mensaje = extraerMensajeError(error, 'guardar cuenta');
      toast.error(mensaje);
    }
  });

  const eliminarCuentaMutation = useMutation({
    mutationFn: (id) => base44.entities.PlanDeCuentas.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['plancuentas']);
      toast.success('Cuenta eliminada');
    },
    onError: (error) => {
      const mensaje = extraerMensajeError(error, 'eliminar cuenta');
      toast.error(mensaje);
    }
  });

  const eliminarCuentasMultipleMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => base44.entities.PlanDeCuentas.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['plancuentas']);
      toast.success('Cuentas eliminadas exitosamente');
    },
    onError: (error) => {
      const mensaje = extraerMensajeError(error, 'eliminar cuentas');
      toast.error(mensaje);
    }
  });

  // Mutations para Períodos de Precio
  const guardarPrecioMutation = useMutation({
    mutationFn: async (item) => {
      // Buscar el producto en el servidor para obtener su nombre
      let itemConNombre = { ...item };
      
      if (item.producto_id) {
        try {
          const producto = await base44.entities.Producto.get(item.producto_id);
          itemConNombre.producto_nombre = producto ? `${producto.fruta} - ${producto.variedad}` : '';
        } catch (error) {
          console.warn('Error al obtener nombre del producto:', error);
          itemConNombre.producto_nombre = '';
        }
      }

      if (item.id) {
        const { id, ...data } = itemConNombre;
        return base44.entities.PeriodoPrecio.update(id, data);
      }
      return base44.entities.PeriodoPrecio.create(itemConNombre);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['periodosprecios']);
      setPrecioModal({ open: false, item: null });
      toast.success('Período de precio guardado');
    },
    onError: (error) => {
      const mensaje = extraerMensajeError(error, 'guardar período de precio');
      toast.error(mensaje);
    }
  });

  const eliminarPrecioMutation = useMutation({
    mutationFn: (id) => base44.entities.PeriodoPrecio.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['periodosprecios']);
      toast.success('Período eliminado');
    },
    onError: (error) => {
      const mensaje = extraerMensajeError(error, 'eliminar período');
      toast.error(mensaje);
    }
  });

  // Mutations para Categorías de Empleado
  const guardarCategoriaMutation = useMutation({
    mutationFn: async (item) => {
      if (item.id) {
        const { id, ...data } = item;
        return base44.entities.CategoriaEmpleado.update(id, data);
      }
      return base44.entities.CategoriaEmpleado.create(item);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categoriasempleado']);
      setCategoriaModal({ open: false, item: null });
      toast.success('Categoría guardada');
    },
    onError: (error) => {
      const mensaje = extraerMensajeError(error, 'guardar categoría');
      toast.error(mensaje);
    }
  });

  const eliminarCategoriaMutation = useMutation({
    mutationFn: (id) => base44.entities.CategoriaEmpleado.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['categoriasempleado']);
      toast.success('Categoría eliminada');
    },
    onError: (error) => {
      const mensaje = extraerMensajeError(error, 'eliminar categoría');
      toast.error(mensaje);
    }
  });

  const guardarImporteMutation = useMutation({
    mutationFn: async (item) => {
      if (item.id) {
        const { id, ...data } = item;
        return base44.entities.ConfiguracionImportes.update(id, data);
      }
      return base44.entities.ConfiguracionImportes.create(item);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['importesconfig']);
      setImporteModal({ open: false, item: null });
      toast.success('Importe guardado');
    },
    onError: (error) => {
      const mensaje = extraerMensajeError(error, 'guardar importe');
      toast.error(mensaje);
    }
  });

  const eliminarImporteMutation = useMutation({
    mutationFn: (id) => base44.entities.ConfiguracionImportes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['importesconfig']);
      toast.success('Importe eliminado');
    },
    onError: (error) => {
      const mensaje = extraerMensajeError(error, 'eliminar importe');
      toast.error(mensaje);
    }
  });

  // Mutations para Empleados
  const guardarEmpleadoMutation = useMutation({
    mutationFn: async (item) => {
      const { permisos, ...dataToSave } = item;
      if (item.id) {
        const { id, ...data } = dataToSave;
        return base44.entities.Empleado.update(id, data);
      }
      return base44.entities.Empleado.create(dataToSave);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['empleados']);
      setEmpleadoModal({ open: false, item: null });
      toast.success('Empleado guardado');
    },
    onError: (error) => {
      const mensaje = extraerMensajeError(error, 'guardar empleado');
      toast.error(mensaje);
    }
  });

  const eliminarEmpleadoMutation = useMutation({
    mutationFn: (id) => base44.entities.Empleado.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['empleados']);
      toast.success('Empleado eliminado');
    },
    onError: (error) => {
      const mensaje = extraerMensajeError(error, 'eliminar empleado');
      toast.error(mensaje);
    }
  });

  const invitarUsuarioMutation = useMutation({
    mutationFn: async ({ email, role }) => {
      return await base44.users.inviteUser(email, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['usuarios']);
      setInvitarUsuarioModal(false);
      setEmailInvitar('');
      setRolInvitar('user');
      toast.success('Invitación enviada exitosamente al correo electrónico');
    },
    onError: (error) => toast.error(error.message || 'Error al invitar usuario')
  });

  // Handlers para importar Plan de Cuentas
  const handleImportarCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = typeof event.target?.result === 'string' ? event.target.result : '';
      if (!text) {
        toast.error('Error al leer el archivo CSV');
        return;
      }
      const lines = text.split('\n');
      const cuentasImportadas = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const campos = parseCSVLine(line);
        const [codigo, nombre, tipo, categoria, nivel, cuenta_padre, imputable, activa] = campos;
        if (codigo && nombre && tipo) {
          cuentasImportadas.push({
            codigo: codigo.trim(),
            nombre: nombre.trim(),
            tipo: tipo.trim(),
            categoria: categoria?.trim() || '',
            nivel: parseInt(nivel) || 1,
            cuenta_padre: cuenta_padre?.trim() || '',
            imputable: imputable?.trim().toLowerCase() !== 'false',
            activa: activa?.trim().toLowerCase() !== 'false'
          });
        }
      }

      try {
        await base44.entities.PlanDeCuentas.bulkCreate(cuentasImportadas);
        queryClient.invalidateQueries(['plancuentas']);
        toast.success(`${cuentasImportadas.length} cuentas importadas exitosamente`);
        setImportModal(false);
      } catch (error) {
        const mensaje = extraerMensajeError(error, 'importar cuentas');
        toast.error(mensaje);
      }
    };
    reader.readAsText(file);
  };

  // Handler para importar Bancos
  const handleImportarBancosCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = typeof event.target?.result === 'string' ? event.target.result : '';
      if (!text) {
        toast.error('Error al leer el archivo CSV');
        return;
      }
      const lines = text.split('\n');
      const bancosImportados = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const campos = parseCSVLine(line);
        const [nombre, codigo, activo] = campos;
        if (nombre) {
          bancosImportados.push({
            nombre: nombre.trim(),
            codigo: codigo?.trim() || '',
            activo: activo?.trim().toLowerCase() !== 'false'
          });
        }
      }

      try {
        await base44.entities.BancoSistema.bulkCreate(bancosImportados);
        queryClient.invalidateQueries(['bancossistema']);
        toast.success(`${bancosImportados.length} bancos importados exitosamente`);
        setImportBancosModal(false);
      } catch (error) {
        const mensaje = extraerMensajeError(error, 'importar bancos');
        toast.error(mensaje);
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-500" />
          <p className="text-slate-600 mt-2">Cargando...</p>
        </div>
      </div>
    );
  }

  const sections = [
    { key: 'abm', label: 'ABM', icon: Database },
    { key: 'plancuentas', label: 'Cuentas', icon: BookOpen },
    { key: 'precios', label: 'Precios', icon: DollarSign },
    { key: 'categorias', label: 'Categorías', icon: Users },
    { key: 'importes', label: 'Importes', icon: DollarSign },
    { key: 'usuarios', label: 'Usuarios', icon: Users },
    { key: 'mantenimiento', label: 'Mantenimiento', icon: Wrench },
    { key: 'seguridad', label: 'PIN', icon: Lock }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Settings className="h-6 w-6 text-slate-600 shrink-0" />
              <div>
                <h1 className="text-xl font-bold text-slate-800">Configuración</h1>
                <p className="text-sm text-slate-600">Gestión del sistema</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 overflow-y-auto">
            <div className="space-y-1">
              {sections.map(section => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.key}
                    onClick={() => setActiveTab(section.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      activeTab === section.key
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="font-medium">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8">
            {activeTab === 'abm' && (
              <ABMContent
                subTab={abmSubTab}
                setSubTab={setAbmSubTab}
                searchTerm={abmSearchTerm}
                setSearchTerm={setAbmSearchTerm}
                data={abmData}
                hasMore={hasMoreAbm}
                onLoadMore={() => fetchMoreAbm()}
                isLoading={loadingAbm}
                isFetchingMore={loadingMoreAbm}
                displayKey={abmEntityConfig[abmSubTab]?.displayKey ?? 'nombre'}
                onEdit={(type, item) => setEditModal({ open: true, type, item })}
                onDelete={(type, item) => setDeleteConfirm({ open: true, type, item })}
                onImportarBancos={() => setImportBancosModal(true)}
              />
            )}

            {activeTab === 'plancuentas' && (
              <PlanCuentasContent
                cuentas={cuentas}
                searchTerm={planCuentasSearchTerm}
                setSearchTerm={setPlanCuentasSearchTerm}
                hasMore={hasMoreCuentas}
                onLoadMore={() => fetchMoreCuentas()}
                isLoading={loadingCuentas}
                isFetchingMore={loadingMoreCuentas}
                onEdit={(item) => setCuentaModal({ open: true, item })}
                onDelete={(id) => eliminarCuentaMutation.mutate(id)}
                onDeleteMultiple={(ids) => eliminarCuentasMultipleMutation.mutate(ids)}
                onImportar={() => setImportModal(true)}
                esAdmin={true}
              />
            )}

            {activeTab === 'precios' && (
              <PreciosContent
                periodosPrecios={periodosPrecios}
                onEdit={(item) => setPrecioModal({ open: true, item })}
                onDelete={(id) => eliminarPrecioMutation.mutate(id)}
              />
            )}

            {activeTab === 'categorias' && (
              <CategoriasEmpleadoContent
                categorias={categoriasEmpleado}
                onEdit={(item) => setCategoriaModal({ open: true, item })}
                onDelete={(id) => eliminarCategoriaMutation.mutate(id)}
              />
            )}

            {activeTab === 'importes' && (
              <ImportesConfigContent
                importes={importesConfig}
                onEdit={(item) => setImporteModal({ open: true, item })}
                onDelete={(id) => eliminarImporteMutation.mutate(id)}
              />
            )}

            {activeTab === 'usuarios' && (
              <UsuariosContent
                currentUser={currentUser}
                usuarios={usuarios}
                onInvitar={() => setInvitarUsuarioModal(true)}
              />
            )}

            {activeTab === 'mantenimiento' && (
              <MantenimientoContent
                ejecutandoCorreccion={ejecutandoCorreccion}
                progresoSincronizacion={progresoSincronizacion}
                onEjecutarCorreccion={async (tipo) => {
                  setEjecutandoCorreccion(tipo);
                  setProgresoSincronizacion('');
                  try {
                    if (tipo === 'sincronizarSaldos') {
                      const result = await sincronizarSaldosEntidades(base44, (msg) => setProgresoSincronizacion(msg));
                      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
                      queryClient.invalidateQueries({ queryKey: ['clientes'] });
                      queryClient.invalidateQueries({ queryKey: ['cuentacorriente'] });
                      toast.success(`Sincronización completada: ${result.proveedoresActualizados} proveedores, ${result.clientesActualizados} clientes.`);
                    } else {
                      await ejecutarCorreccionManual(tipo, base44, queryClient);
                      toast.success(`Corrección "${tipo}" completada exitosamente`);
                    }
                  } catch (error) {
                    console.error(`Error en corrección ${tipo}:`, error);
                    toast.error(`Error al ejecutar: ${error.message}`);
                  } finally {
                    setEjecutandoCorreccion(null);
                    setProgresoSincronizacion('');
                  }
                }}
              />
            )}

            {activeTab === 'seguridad' && (
              <SeguridadContent
                esAdmin={true}
                pinActual={pinActual}
                setPinActual={setPinActual}
                nuevoPin={nuevoPin}
                setNuevoPin={setNuevoPin}
                confirmarPin={confirmarPin}
                setConfirmarPin={setConfirmarPin}
                onGuardar={() => {
                  console.log('=== BOTÓN ACTUALIZAR PIN PRESIONADO ===');
                  console.log('PIN Actual:', pinActual);
                  console.log('Nuevo PIN:', nuevoPin);
                  console.log('Confirmar PIN:', confirmarPin);
                  
                  if (nuevoPin !== confirmarPin) {
                    toast.error('Los PINs no coinciden');
                    return;
                  }
                  
                  console.log('Iniciando mutación...');
                  askPin(
                    () => guardarPINMutation.mutate({ pinActual, nuevoPin }),
                    'Confirmar actualización de PIN'
                  );
                }}
                isLoading={guardarPINMutation.isPending}
              />
            )}
          </div>
        </main>
      </div>

      {/* Modales */}
      <ABMModal
        modal={editModal}
        onClose={() => setEditModal({ open: false, type: null, item: null })}
        onSave={(data) => guardarABMMutation.mutate(data)}
        isLoading={guardarABMMutation.isPending}
      />

      <DeleteConfirmModal
        modal={deleteConfirm}
        onClose={() => setDeleteConfirm({ open: false, type: null, item: null })}
        onConfirm={() => eliminarABMMutation.mutate({ 
          type: deleteConfirm.type, 
          id: deleteConfirm.item.id,
          nombre: deleteConfirm.item.nombre || deleteConfirm.item.tipo || deleteConfirm.item[deleteConfirm.type === 'envase' ? 'tipo' : 'nombre']
        })}
        isLoading={eliminarABMMutation.isPending}
      />

      <CuentaModal
        modal={cuentaModal}
        onClose={() => setCuentaModal({ open: false, item: null })}
        onSave={(data) => guardarCuentaMutation.mutate(data)}
        isLoading={guardarCuentaMutation.isPending}
        cuentas={cuentas}
      />

      <PrecioModal
        modal={precioModal}
        onClose={() => setPrecioModal({ open: false, item: null })}
        onSave={(data) => guardarPrecioMutation.mutate(data)}
        isLoading={guardarPrecioMutation.isPending}
      />

      <ImportModal
        open={importModal}
        onClose={() => setImportModal(false)}
        onImport={handleImportarCSV}
      />

      <EmpleadoModal
        modal={empleadoModal}
        onClose={() => setEmpleadoModal({ open: false, item: null })}
        onSave={(data) => guardarEmpleadoMutation.mutate(data)}
        isLoading={guardarEmpleadoMutation.isPending}
      />

      <CategoriaEmpleadoModal
        modal={categoriaModal}
        onClose={() => setCategoriaModal({ open: false, item: null })}
        onSave={(data) => guardarCategoriaMutation.mutate(data)}
        isLoading={guardarCategoriaMutation.isPending}
      />

      <ImporteModal
        modal={importeModal}
        onClose={() => setImporteModal({ open: false, item: null })}
        onSave={(data) => guardarImporteMutation.mutate(data)}
        isLoading={guardarImporteMutation.isPending}
      />

      <InvitarUsuarioModal
        open={invitarUsuarioModal}
        onClose={() => {
          setInvitarUsuarioModal(false);
          setEmailInvitar('');
          setRolInvitar('user');
        }}
        email={emailInvitar}
        setEmail={setEmailInvitar}
        rol={rolInvitar}
        setRol={setRolInvitar}
        onInvitar={() => invitarUsuarioMutation.mutate({ email: emailInvitar, role: rolInvitar })}
        isLoading={invitarUsuarioMutation.isPending}
      />

      <ImportBancosModal
        open={importBancosModal}
        onClose={() => setImportBancosModal(false)}
        onImport={handleImportarBancosCSV}
      />
      <PinGuardModal />
    </div>
  );
}
