import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Edit } from "lucide-react";

export default function ConfirmEnvaseModal({ open, onClose, envase, onConfirm, onEdit }) {
  if (!envase) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-center">
            Confirmar Movimiento de Envase
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <div className="bg-amber-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-slate-600">Tipo de Envase:</span>
              <span className="text-sm font-bold text-slate-800">
                {envase.envase_tipo || 'Sin especificar'}
              </span>
            </div>
            
            <div className="flex justify-between pt-2 border-t border-amber-200">
              <span className="text-sm font-medium text-slate-600">Ingreso (Devolución):</span>
              <span className="text-sm font-bold text-green-600">
                +{envase.cantidad_ingreso || 0} unidades
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm font-medium text-slate-600">Salida (Entrega):</span>
              <span className="text-sm font-bold text-red-600">
                -{envase.cantidad_salida || 0} unidades
              </span>
            </div>
          </div>

          <p className="text-sm text-center text-slate-500">
            ¿Deseas agregar este movimiento de envase?
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onEdit}
            className="w-full sm:w-auto"
          >
            <Edit className="h-4 w-4 mr-2" />
            No, Editar
          </Button>
          <Button
            onClick={onConfirm}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Sí, Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}