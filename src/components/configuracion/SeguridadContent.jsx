import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Save, Loader2 } from "lucide-react";

export default function SeguridadContent({ esAdmin, pinActual, setPinActual, nuevoPin, setNuevoPin, confirmarPin, setConfirmarPin, onGuardar, isLoading }) {
  if (!esAdmin) {
    return (
      <div className="p-8 text-center bg-red-50 border border-red-200 rounded-lg">
        <Lock className="h-12 w-12 text-red-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Acceso Restringido</h3>
        <p className="text-red-800">Solo el administrador principal puede configurar el PIN de seguridad.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900 font-medium mb-1">¿Para qué se usa el PIN?</p>
        <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
          <li>Proteger la edición de movimientos guardados</li>
          <li>Prevenir modificaciones accidentales de datos críticos</li>
          <li>Mantener la integridad del sistema</li>
        </ul>
      </div>

      <div className="space-y-4">
        <div>
          <Label>PIN Actual</Label>
          <Input
            type="password"
            inputMode="numeric"
            placeholder="••••"
            value={pinActual}
            onChange={(e) => setPinActual(e.target.value.replace(/\D/g, ''))}
            maxLength={6}
            className="max-w-xs mt-1"
          />
          <p className="text-xs text-slate-500 mt-1">PIN por defecto: <code className="bg-slate-100 px-1 py-0.5 rounded">0000</code></p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nuevo PIN (4-6 dígitos)</Label>
            <Input
              type="password"
              inputMode="numeric"
              placeholder="••••"
              value={nuevoPin}
              onChange={(e) => setNuevoPin(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Confirmar Nuevo PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              placeholder="••••"
              value={confirmarPin}
              onChange={(e) => setConfirmarPin(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              className="mt-1"
            />
          </div>
        </div>

        <Button onClick={onGuardar} disabled={!pinActual || !nuevoPin || !confirmarPin || isLoading} className={`bg-green-600 hover:bg-green-700 transition-all ${isLoading ? 'opacity-75 cursor-wait' : ''}`}>
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {isLoading ? 'Actualizando PIN...' : 'Actualizar PIN'}
        </Button>
      </div>
    </div>
  );
}
