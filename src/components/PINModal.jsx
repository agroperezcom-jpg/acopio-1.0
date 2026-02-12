import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Loader2 } from "lucide-react";

export default function PINModal({ open, onClose, onConfirm, isLoading, title = "Confirmar con PIN" }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!pin || pin.length < 4) {
      setError('Por favor ingrese un PIN válido (mínimo 4 dígitos)');
      return;
    }
    
    setError('');
    const result = await onConfirm(pin);
    
    if (result === false) {
      setError('PIN incorrecto. Intente nuevamente.');
      setPin('');
    } else {
      setPin('');
      onClose();
    }
  };

  const handleClose = () => {
    setPin('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Ingrese PIN de Seguridad</label>
            <Input
              type="password"
              inputMode="numeric"
              placeholder="••••"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''));
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
          
          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded">
            <p>El PIN de seguridad protege las modificaciones críticas.</p>
            <p className="mt-1">PIN por defecto: <code className="bg-white px-1 py-0.5 rounded">0000</code></p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !pin}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Verificando...
              </>
            ) : (
              'Confirmar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}