import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function InvitarUsuarioModal({ open, onClose, email, setEmail, rol, setRol, onInvitar, isLoading }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar Nuevo Usuario</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 font-medium mb-1">📧 Proceso de Invitación</p>
            <p className="text-xs text-blue-800">
              El usuario recibirá un correo electrónico con un enlace para crear su cuenta y establecer su contraseña.
            </p>
          </div>

          <div>
            <Label>Correo Electrónico *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Rol del Usuario *</Label>
            <Select value={rol} onValueChange={setRol}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuario Regular</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              {rol === 'admin' 
                ? '⚠️ Los administradores tienen acceso completo al sistema' 
                : 'Los usuarios regulares solo acceden a módulos asignados'}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={onInvitar} 
            disabled={isLoading || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar Invitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
