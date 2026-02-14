import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Package, ArrowLeftRight, Trash2 } from "lucide-react";
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AsyncSelect from '@/components/AsyncSelect';
import QuickCreateModal from '@/components/QuickCreateModal';
import EnvaseLineItemSimple from '@/components/EnvaseLineItemSimple';
import GenericSuccessModal from '@/components/GenericSuccessModal';
import ConfirmEnvaseModal from '@/components/ConfirmEnvaseModal';
import { descargarPDFMovimientoEnvases, compartirWhatsAppMovimientoEnvases } from '@/components/MovimientoEnvasesPDFGenerator';
import { ajustarStockEnvase } from '@/services/StockService';
import { actualizarDeudaEnvase } from '@/services/SaldoEnvasesService';

export default function MovimientoEnvases() {
  const queryClient = useQueryClient();
  
  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [tipoEntidad, setTipoEntidad] = useState('Proveedor');
  const [proveedorId, setProveedorId] = useState('');
  const [proveedorData, setProveedorData] = useState(null);
  const [clienteId, setClienteId] = useState('');
  const [clienteData, setClienteData] = useState(null);
  const [fleteroId, setFleteroId] = useState('');
  const [fleteroData, setFleteroData] = useState(null);
  const [contabilizarViaje, setContabilizarViaje] = useState(false);
  
  const [envases, setEnvases] = useState([]);
  
  const [envaseActual, setEnvaseActual] = useState({
    envase_id: '',
    envase_tipo: '',
    cantidad_ingreso: 0,
    cantidad_salida: 0,
    contabilizar_viaje: false
  });
  

  const [createModal, setCreateModal] = useState({ open: false, type: null });
  const [successModal, setSuccessModal] = useState({ open: false, data: null });
  const [confirmEnvaseModal, setConfirmEnvaseModal] = useState({ open: false, envase: null });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: envasesList = [] } = useQuery({
    queryKey: ['envases'],
    queryFn: () => base44.entities.Envase.list('tipo', 100),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const handleProveedorSelect = (option) => {
    setProveedorId(option?.id || '');
    setProveedorData(option);
  };

  const handleClienteSelect = (option) => {
    setClienteId(option?.id || '');
    setClienteData(option);
  };

  const handleFleteroSelect = (option) => {
    setFleteroId(option?.id || '');
    setFleteroData(option);
  };

  const handleAgregarEnvase = () => {
    if (!envaseActual.envase_id) {
      alert('Por favor seleccione un tipo de envase');
      return;
    }
    
    if ((envaseActual.cantidad_ingreso || 0) === 0 && (envaseActual.cantidad_salida || 0) === 0) {
      alert('Por favor ingrese al menos una cantidad (ingreso o salida)');
      return;
    }
    
    // Mostrar modal de confirmación
    setConfirmEnvaseModal({ open: true, envase: envaseActual });
  };

  const confirmarEnvase = () => {
    setEnvases([...envases, {...confirmEnvaseModal.envase}]);
    setConfirmEnvaseModal({ open: false, envase: null });
    // Resetear envase actual
    setEnvaseActual({
      envase_id: '',
      envase_tipo: '',
      cantidad_ingreso: 0,
      cantidad_salida: 0,
      contabilizar_viaje: false
    });
  };

  const updateEnvaseActual = (data) => {
    setEnvaseActual(data);
  };

  const removeEnvase = (index) => {
    setEnvases(envases.filter((_, i) => i !== index));
  };

  const handleCreateSave = async (data) => {
    setIsSubmitting(true);
    try {
      if (createModal.type === 'proveedor') {
        const created = await base44.entities.Proveedor.create(data);
        setProveedorId(created.id);
        setProveedorData(created);
      } else if (createModal.type === 'cliente') {
        const created = await base44.entities.Cliente.create(data);
        setClienteId(created.id);
        setClienteData(created);
      } else if (createModal.type === 'fletero') {
        const created = await base44.entities.Fletero.create(data);
        setFleteroId(created.id);
        setFleteroData(created);
      } else if (createModal.type === 'envase') {
        await base44.entities.Envase.create(data);
        queryClient.invalidateQueries(['envases']);
      }
      setCreateModal({ open: false, type: null });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    const entidadId = tipoEntidad === 'Proveedor' ? proveedorId : clienteId;
    const entidadData = tipoEntidad === 'Proveedor' ? proveedorData : clienteData;

    if (!entidadId) {
      alert(`Por favor seleccione un ${tipoEntidad.toLowerCase()}`);
      return;
    }

    if (envases.length === 0) {
      alert('Por favor agregue al menos un movimiento de envases');
      return;
    }

    // Validar stock de envases VACÍOS antes de guardar
    for (const envase of envases) {
      if (envase.cantidad_salida > 0) {
        const envaseData = envasesList.find(e => e.id === envase.envase_id);
        if (!envaseData) continue;
        
        const stockDisponible = envaseData.stock_vacios || 0;
        
        if (envase.cantidad_salida > stockDisponible) {
          alert(`Error: Envase "${envaseData.tipo}" - Salida (${envase.cantidad_salida}) supera stock vacíos disponible (${stockDisponible}). Movimiento de Envases solo maneja envases vacíos.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const movimiento = {
        fecha: new Date(fecha).toISOString(),
        tipo_movimiento: 'Movimiento de Envases',
        tipo_entidad: tipoEntidad,
        ...(tipoEntidad === 'Proveedor' ? {
          proveedor_id: proveedorId,
          proveedor_nombre: proveedorData?.nombre || ''
        } : {
          cliente_id: clienteId,
          cliente_nombre: clienteData?.nombre || ''
        }),
        fletero_id: fleteroId || null,
        fletero_nombre: fleteroData?.nombre || '',
        movimiento_envases: envases.map(e => ({
          ...e,
          cantidad_ingreso: parseInt(e.cantidad_ingreso) || 0,
          cantidad_salida: parseInt(e.cantidad_salida) || 0,
          contabilizar_viaje: fleteroId ? (e.contabilizar_viaje || false) : false
        }))
      };

      const created = await base44.entities.Movimiento.create(movimiento);
      
      // ═══════════════════════════════════════════════════════════════
      // ACTUALIZAR STOCK ENVASES VACÍOS (Movimiento de Envases solo maneja vacíos)
      // ═══════════════════════════════════════════════════════════════
      for (const envase of movimiento.movimiento_envases) {
        const envaseData = envasesList.find(e => e.id === envase.envase_id);
        if (envaseData) {
          const ingreso = parseInt(envase.cantidad_ingreso) || 0;
          const salida = parseInt(envase.cantidad_salida) || 0;
          const deltaVacios = ingreso - salida;
          if (deltaVacios !== 0) {
            await ajustarStockEnvase(base44, envaseData.id, 0, deltaVacios);
          }
        }
      }

      const entidadId = tipoEntidad === 'Proveedor' ? proveedorId : clienteId;
      for (const envase of movimiento.movimiento_envases) {
        const tipoEnvase = envase.envase_tipo || envasesList.find(e => e.id === envase.envase_id)?.tipo;
        if (!tipoEnvase || !entidadId) continue;
        const ingreso = parseInt(envase.cantidad_ingreso) || 0;
        const salida = parseInt(envase.cantidad_salida) || 0;
        if (tipoEntidad === 'Proveedor') {
          const delta = salida - ingreso;
          if (delta !== 0) await actualizarDeudaEnvase(base44, 'Proveedor', entidadId, tipoEnvase, delta);
        } else {
          const delta = ingreso - salida;
          if (delta !== 0) await actualizarDeudaEnvase(base44, 'Cliente', entidadId, tipoEnvase, delta);
        }
      }
      
      // Refrescar datos ANTES de mostrar el modal de éxito
      await queryClient.invalidateQueries(['movimientos']);
      await queryClient.invalidateQueries(['envases']);
      await queryClient.refetchQueries(['movimientos']);
      await queryClient.refetchQueries(['envases']);
      
      setSuccessModal({ 
        open: true, 
        data: { ...movimiento, id: created.id, entidad_whatsapp: entidadData?.whatsapp }
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!successModal.data) return;
    const entidadId = successModal.data.proveedor_id || successModal.data.cliente_id;
    const tipo = successModal.data.tipo_entidad || 'Proveedor';
    const entidadData = tipo === 'Proveedor' ? proveedorData : clienteData;
    
    // Usar fleteroData del estado en lugar de buscar en array
    const saldosActualizados = calcularSaldosConMovimiento(entidadId, tipo, successModal.data.movimiento_envases);
    
    descargarPDFMovimientoEnvases(successModal.data, entidadData, fleteroData, saldosActualizados);
  };

  const handleShareWhatsApp = async () => {
    if (!successModal.data) return;
    const entidadId = successModal.data.proveedor_id || successModal.data.cliente_id;
    const tipo = successModal.data.tipo_entidad || 'Proveedor';
    const entidadData = tipo === 'Proveedor' ? proveedorData : clienteData;
    
    // Calcular saldos actualizados INCLUYENDO el movimiento actual
    const saldosActualizados = calcularSaldosConMovimiento(entidadId, tipo, successModal.data.movimiento_envases);
    
    compartirWhatsAppMovimientoEnvases(successModal.data, entidadData, successModal.data.entidad_whatsapp, saldosActualizados);
  };

  const calcularSaldosConMovimiento = (entidadId, tipo, movimientoEnvases) => {
    // Leer saldos desde la entidad (campo saldo_envases que debe existir)
    const entidadData = tipo === 'Proveedor' ? proveedorData : clienteData;
    const saldosActuales = entidadData?.saldo_envases || {};
    
    // Convertir a formato esperado
    const saldosPorTipo = { ...saldosActuales };
    
    // Aplicar el movimiento actual
    movimientoEnvases.forEach(e => {
      if (!saldosPorTipo[e.envase_tipo]) {
        saldosPorTipo[e.envase_tipo] = 0;
      }
      // Para proveedores y clientes: salida aumenta deuda, ingreso reduce deuda
      saldosPorTipo[e.envase_tipo] += (e.cantidad_salida || 0) - (e.cantidad_ingreso || 0);
    });
    
    // Convertir de vuelta a array, incluyendo todos los envases del movimiento
    const tiposEnMovimiento = movimientoEnvases.map(e => e.envase_tipo);
    const todosLosTipos = [...new Set([...Object.keys(saldosPorTipo), ...tiposEnMovimiento])];
    
    return todosLosTipos.map(tipo => ({
      envase_tipo: tipo,
      saldo: saldosPorTipo[tipo] || 0
    })).filter(s => s.saldo !== 0 || tiposEnMovimiento.includes(s.envase_tipo));
  };

  const getCreateFields = () => {
    switch (createModal.type) {
      case 'proveedor':
        return [
          { name: 'nombre', label: 'Nombre', placeholder: 'Nombre del proveedor' },
          { name: 'direccion', label: 'Dirección', placeholder: 'Dirección' },
          { name: 'cuit', label: 'CUIT', placeholder: 'XX-XXXXXXXX-X' },
          { name: 'whatsapp', label: 'WhatsApp', placeholder: '+54 9 11 XXXX-XXXX' }
        ];
      case 'cliente':
        return [
          { name: 'nombre', label: 'Nombre', placeholder: 'Nombre del cliente' },
          { name: 'direccion', label: 'Dirección', placeholder: 'Dirección' },
          { name: 'cuit', label: 'CUIT', placeholder: 'XX-XXXXXXXX-X' },
          { name: 'whatsapp', label: 'WhatsApp', placeholder: '+54 9 11 XXXX-XXXX' }
        ];
      case 'fletero':
        return [
          { name: 'nombre', label: 'Nombre', placeholder: 'Nombre del fletero' },
          { name: 'direccion', label: 'Dirección', placeholder: 'Dirección' },
          { name: 'whatsapp', label: 'WhatsApp', placeholder: '+54 9 11 XXXX-XXXX' }
        ];
      case 'envase':
        return [
          { name: 'tipo', label: 'Tipo de Envase', placeholder: 'Ej: Bin Plástico' },
          { name: 'tara', label: 'Tara (kg)', type: 'number', placeholder: '0.00' }
        ];
      default:
        return [];
    }
  };

  // Obtener saldos actuales de la entidad seleccionada (desde campo saldo_envases)
  const entidadId = tipoEntidad === 'Proveedor' ? proveedorId : clienteId;
  const entidadData = tipoEntidad === 'Proveedor' ? proveedorData : clienteData;
  const saldosActuales = React.useMemo(() => {
    if (!entidadData?.saldo_envases) return [];
    return Object.entries(entidadData.saldo_envases).map(([tipo, saldo]) => ({
      envase_tipo: tipo,
      saldo: Math.max(0, saldo)
    })).filter(s => s.saldo > 0);
  }, [entidadData]);

  const resetForm = () => {
    setFecha(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setTipoEntidad('Proveedor');
    setProveedorId('');
    setProveedorData(null);
    setClienteId('');
    setClienteData(null);
    setFleteroId('');
    setFleteroData(null);
    setContabilizarViaje(false);
    setEnvases([]);
    setEnvaseActual({
      envase_id: '',
      envase_tipo: '',
      cantidad_ingreso: 0,
      cantidad_salida: 0,
      contabilizar_viaje: false
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <ArrowLeftRight className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Movimiento de Envases</h1>
            <p className="text-slate-500 text-sm">Registrar entrada o salida de envases</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Datos Generales */}
          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Datos del Movimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Fecha y Hora</label>
                  <Input
                    type="datetime-local"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Tipo de Entidad *</label>
                  <Select value={tipoEntidad} onValueChange={(val) => {
                    setTipoEntidad(val);
                    setProveedorId('');
                    setClienteId('');
                    setProveedorData(null);
                    setClienteData(null);
                  }}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Proveedor">Proveedor</SelectItem>
                      <SelectItem value="Cliente">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">{tipoEntidad} *</label>
                  {tipoEntidad === 'Proveedor' ? (
                    <AsyncSelect
                      entityKey="Proveedor"
                      value={proveedorId}
                      onChange={handleProveedorSelect}
                      placeholder="Seleccionar proveedor..."
                      onCreateNew={() => setCreateModal({ open: true, type: 'proveedor' })}
                      createNewLabel="Crear nuevo proveedor"
                    />
                  ) : (
                    <AsyncSelect
                      entityKey="Cliente"
                      value={clienteId}
                      onChange={handleClienteSelect}
                      placeholder="Seleccionar cliente..."
                      onCreateNew={() => setCreateModal({ open: true, type: 'cliente' })}
                      createNewLabel="Crear nuevo cliente"
                    />
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Fletero (Opcional)</label>
                  <AsyncSelect
                    entityKey="Fletero"
                    value={fleteroId}
                    onChange={handleFleteroSelect}
                    placeholder="Seleccionar fletero..."
                    onCreateNew={() => setCreateModal({ open: true, type: 'fletero' })}
                    createNewLabel="Crear nuevo fletero"
                  />
                </div>
              </div>


            </CardContent>
          </Card>

          {/* Saldos Actuales */}
          {entidadId && saldosActuales.length > 0 && (
            <Card className="border-0 shadow-lg shadow-amber-100/50 bg-amber-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-amber-800">
                  Saldo Actual de Envases - {entidadData?.nombre}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {saldosActuales.map((s, i) => (
                    <div 
                      key={i}
                      className={`px-4 py-2 rounded-lg ${
                        s.saldo > 0 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      <span className="font-medium">{s.envase_tipo}:</span>
                      <span className="ml-2">
                        {s.saldo > 0 ? `Adeuda ${s.saldo}` : 'Sin deuda'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Movimiento de Envases */}
          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5 text-slate-400" />
                Nuevo Movimiento de Envase
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Formulario envase actual */}
                <EnvaseLineItemSimple
                  item={envaseActual}
                  index={0}
                  envases={envasesList}
                  onChange={(_, data) => updateEnvaseActual(data)}
                  onCreateEnvase={() => setCreateModal({ open: true, type: 'envase' })}
                  mostrarContabilizar={!!fleteroId}
                  fleteroData={fleteroData}
                />
                
                <div className="flex justify-end">
                  <Button 
                    onClick={handleAgregarEnvase}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar a Lista
                  </Button>
                </div>
              </div>

              {/* Lista de envases agregados */}
              {envases.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-700">Envases Agregados ({envases.length})</h4>
                  </div>
                  <div className="space-y-3">
                    {envases.map((envase, index) => (
                     <div key={index} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                       <div className="flex items-start justify-between">
                         <div className="flex-1">
                           <p className="font-medium text-slate-800">{envase.envase_tipo}</p>
                           <div className="flex flex-wrap gap-3 mt-1 text-sm">
                             {envase.cantidad_ingreso > 0 && (
                               <span className="text-green-600">
                                 Ingreso: +{envase.cantidad_ingreso}
                               </span>
                             )}
                             {envase.cantidad_salida > 0 && (
                               <span className="text-red-600">
                                 Salida: -{envase.cantidad_salida}
                               </span>
                             )}
                             {fleteroId && envase.contabilizar_viaje && (
                               <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded text-xs font-semibold">
                                 ✓ Contabilizado
                               </span>
                             )}
                           </div>
                         </div>
                         <Button
                           variant="ghost"
                           size="icon"
                           onClick={() => removeEnvase(index)}
                           className="text-red-500 hover:text-red-700 hover:bg-red-50 ml-2"
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
                     </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <div className="flex items-start gap-2">
                  <Package className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-900">
                    <p className="font-semibold mb-1">ℹ️ Movimiento de Envases Vacíos</p>
                    <p className="mb-1"><strong>Ingreso:</strong> {tipoEntidad === 'Proveedor' ? 'El proveedor devuelve' : 'El cliente devuelve'} envases vacíos al acopio (suma a Stock Vacíos)</p>
                    <p><strong>Salida:</strong> El acopio entrega envases vacíos al {tipoEntidad.toLowerCase()} (resta de Stock Vacíos)</p>
                    <p className="mt-2 text-blue-700 font-medium">Los envases llenos (con fruta) se gestionan en Ingreso/Salida de Fruta.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botón Guardar */}
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !entidadId}
              size="lg"
              className="bg-amber-600 hover:bg-amber-700 text-white px-8"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Package className="h-5 w-5 mr-2" />
              )}
              Registrar Movimiento
            </Button>
          </div>
        </div>
      </div>

      <QuickCreateModal
        open={createModal.open}
        onClose={() => setCreateModal({ open: false, type: null })}
        onSave={handleCreateSave}
        title={
          createModal.type === 'proveedor' ? 'Nuevo Proveedor' :
          createModal.type === 'cliente' ? 'Nuevo Cliente' :
          createModal.type === 'fletero' ? 'Nuevo Fletero' :
          'Nuevo Envase'
        }
        fields={getCreateFields()}
        isLoading={isSubmitting}
      />

      <ConfirmEnvaseModal
        open={confirmEnvaseModal.open}
        onClose={() => setConfirmEnvaseModal({ open: false, envase: null })}
        envase={confirmEnvaseModal.envase}
        onConfirm={confirmarEnvase}
        onEdit={() => setConfirmEnvaseModal({ open: false, envase: null })}
      />

      <GenericSuccessModal
        open={successModal.open}
        onClose={() => {
          setSuccessModal({ open: false, data: null });
          resetForm();
        }}
        title="¡Movimiento Registrado!"
        message="El movimiento se ha registrado correctamente"
        onDownloadPDF={handleDownloadPDF}
        onShareWhatsApp={handleShareWhatsApp}
      />

    </div>
  );
}