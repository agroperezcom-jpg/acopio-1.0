import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Edit } from "lucide-react";

export default function ConfirmPesajeModal({ open, onClose, pesaje, onConfirm, onEdit }) {
  if (!pesaje) return null;

  const taraTotal = pesaje.modo === 'libre' 
    ? (pesaje.tara_manual || 0)
    : ((pesaje.tara_unitaria || 0) * (pesaje.cantidad || 1));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-center">
            Confirmar Pesaje
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <div className="bg-blue-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-slate-600">Producto:</span>
              <span className="text-sm font-bold text-slate-800">
                {pesaje.producto_nombre || 'Sin especificar'}
              </span>
            </div>
            
            {pesaje.modo !== 'libre' && (
              <>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600">Envase:</span>
                  <span className="text-sm font-bold text-slate-800">
                    {pesaje.envase_tipo || 'Sin especificar'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600">Cantidad:</span>
                  <span className="text-sm font-bold text-slate-800">
                    {pesaje.cantidad || 1} bins
                  </span>
                </div>
              </>
            )}
            
            <div className="flex justify-between pt-2 border-t border-blue-200">
              <span className="text-sm font-medium text-slate-600">Peso Bruto:</span>
              <span className="text-sm font-bold text-blue-700">
                {(pesaje.peso_bruto || 0).toFixed(2)} kg
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm font-medium text-slate-600">Tara Total:</span>
              <span className="text-sm font-bold text-slate-600">
                {taraTotal.toFixed(2)} kg
              </span>
            </div>
            
            <div className="flex justify-between pt-2 border-t-2 border-blue-300">
              <span className="text-base font-semibold text-slate-700">Peso Neto:</span>
              <span className="text-lg font-bold text-green-700">
                {(pesaje.peso_neto || 0).toFixed(2)} kg
              </span>
            </div>
          </div>

          <p className="text-sm text-center text-slate-500">
            ¿Deseas agregar este pesaje a la lista?
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
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Sí, Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}