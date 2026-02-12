import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Calendar, User, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ajustarStockEnvase } from '@/services/StockService';
import { usePinGuard } from '@/hooks/usePinGuard';

export default function HistorialAjustesModal({ open, onClose, ajustes = [], onDelete }) {
  const { askPin, PinGuardModal } = usePinGuard();
  const [eliminandoId, setEliminandoId] = useState(null);
  const [error, setError] = useState('');

  const handleEliminar = async (ajuste) => {
    await askPin(async () => {
      try {
        // Revertir stock del envase (incremental inverso)
        const deltaOcupados = ajuste.tipo_ajuste === 'ocupados' ? -ajuste.diferencia : 0;
        const deltaVacios = ajuste.tipo_ajuste === 'vacios' ? -ajuste.diferencia : 0;
        if (deltaOcupados !== 0 || deltaVacios !== 0) {
          await ajustarStockEnvase(base44, ajuste.envase_id, deltaOcupados, deltaVacios);
        }

        await base44.entities.AjusteManualEnvase.delete(ajuste.id);
        
        toast.success('Ajuste eliminado correctamente');
        setEliminandoId(null);
        setError('');
        
        if (onDelete) {
          onDelete();
        }
      } catch (err) {
        console.error('Error al eliminar ajuste:', err);
        setError('Error al eliminar el ajuste');
      }
    }, 'Confirmar eliminación de ajuste');
  };

  const cancelarEliminacion = () => {
    setEliminandoId(null);
    setError('');
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial de Ajustes Manuales</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {ajustes.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No hay ajustes manuales registrados
            </div>
          ) : (
            ajustes.map((ajuste) => (
              <div 
                key={ajuste.id} 
                className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {eliminandoId === ajuste.id ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                      <p className="text-sm font-medium text-amber-900">
                        ¿Confirmar eliminación de este ajuste?
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        Esto revertirá el cambio de stock registrado
                      </p>
                    </div>
                    
                    {error && (
                      <p className="text-xs text-red-600 mt-1">{error}</p>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelarEliminacion}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleEliminar(ajuste)}
                        className="flex-1 bg-red-600 hover:bg-red-700"
                      >
                        Confirmar Eliminación
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-slate-800">
                            {ajuste.envase_tipo}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            ajuste.tipo_ajuste === 'vacios' 
                              ? 'bg-teal-100 text-teal-700' 
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {ajuste.tipo_ajuste === 'vacios' ? 'Vacíos' : 'Ocupados'}
                          </span>
                        </div>

                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(ajuste.fecha), "dd/MM/yyyy HH:mm", { locale: es })}
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <User className="h-3 w-3" />
                            {ajuste.usuario_email}
                          </div>
                        </div>

                        <div className="mt-2 p-2 bg-slate-50 rounded text-sm">
                          <span className="text-slate-600">Motivo:</span>{' '}
                          <span className="font-medium">{ajuste.motivo}</span>
                        </div>

                        {ajuste.notas && (
                          <div className="mt-2 text-xs text-slate-600">
                            <span className="font-medium">Notas:</span> {ajuste.notas}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <div className="text-xs text-slate-500 mb-1">Stock</div>
                          <div className="flex flex-col gap-1">
                            <div className="text-sm">
                              <span className="text-slate-600">Anterior:</span>{' '}
                              <span className="font-semibold">{ajuste.stock_anterior}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {ajuste.diferencia > 0 ? (
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-600" />
                              )}
                              <span className={`font-bold ${
                                ajuste.diferencia > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {ajuste.diferencia > 0 ? '+' : ''}{ajuste.diferencia}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-slate-600">Nuevo:</span>{' '}
                              <span className="font-bold text-indigo-600">{ajuste.stock_nuevo}</span>
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEliminandoId(ajuste.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <PinGuardModal />
      </DialogContent>
    </Dialog>
  );
}