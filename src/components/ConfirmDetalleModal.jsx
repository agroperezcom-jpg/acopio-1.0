import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Edit } from "lucide-react";

export default function ConfirmDetalleModal({ open, onClose, detalle, onConfirm, onEdit }) {
  if (!detalle) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-center">
            Confirmar Detalle de Salida
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <div className="bg-purple-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-slate-600">Producto:</span>
              <span className="text-sm font-bold text-slate-800">
                {detalle.producto_nombre || 'Sin especificar'}
              </span>
            </div>
            
            <div className="flex justify-between pt-2 border-t border-purple-200">
              <span className="text-sm font-medium text-slate-600">Kilos a Salir:</span>
              <span className="text-lg font-bold text-purple-700">
                {(detalle.kilos_salida || 0).toFixed(2)} kg
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm font-medium text-slate-600">Stock Disponible:</span>
              <span className="text-sm font-bold text-slate-600">
                {(detalle.stock_disponible || 0).toFixed(2)} kg
              </span>
            </div>
            
            <div className="flex justify-between pt-2 border-t border-purple-200">
              <span className="text-sm font-medium text-slate-600">Stock Restante:</span>
              <span className={`text-sm font-bold ${
                (detalle.stock_disponible - detalle.kilos_salida) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {((detalle.stock_disponible || 0) - (detalle.kilos_salida || 0)).toFixed(2)} kg
              </span>
            </div>
          </div>

          <p className="text-sm text-center text-slate-500">
            ¿Deseas agregar este detalle a la salida?
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
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Sí, Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}