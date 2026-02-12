import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function DeleteConfirmModal({ modal, onClose, onConfirm, isLoading }) {
  return (
    <Dialog open={modal.open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Eliminación</DialogTitle>
        </DialogHeader>
        <p className="py-4">
          ¿Está seguro de eliminar <strong>{modal.item?.nombre || modal.item?.tipo || 'este registro'}</strong>?
          <br />
          <span className="text-sm text-red-600 mt-2 block">Esta acción no se puede deshacer.</span>
        </p>
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
