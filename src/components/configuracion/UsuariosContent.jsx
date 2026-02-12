import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus } from "lucide-react";

export default function UsuariosContent({ currentUser, usuarios, onInvitar }) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <p className="text-sm text-indigo-900 font-medium mb-1">👤 Sistema de Usuarios</p>
        <p className="text-xs text-indigo-800">
          Tu usuario actual es <strong>{currentUser?.email}</strong>. Puedes invitar otros usuarios al sistema.
        </p>
      </div>

      <Button onClick={onInvitar} className="bg-indigo-600 hover:bg-indigo-700">
        <Plus className="h-4 w-4 mr-2" />
        Invitar Usuario
      </Button>

      <div className="space-y-2">
        <h3 className="font-semibold text-slate-700">Usuarios Registrados</h3>
        {!usuarios || usuarios.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No hay usuarios en el sistema</p>
          </div>
        ) : (
          <div className="space-y-2">
            {usuarios.map(user => (
              <Card key={user.id} className="border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-800">{user.full_name || user.email}</p>
                        <Badge variant="secondary">
                          Usuario
                        </Badge>
                        {user.id === currentUser?.id && (
                          <Badge className="bg-blue-100 text-blue-800">Tú</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">{user.email}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Registrado: {new Date(user.created_date).toLocaleDateString('es-AR', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mt-6">
        <p className="text-sm text-amber-900 font-medium mb-2">🔒 Seguridad de Acceso</p>
        <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
          <li>Solo usuarios invitados pueden acceder al sistema</li>
          <li>Los usuarios recibirán un email con un link para crear su contraseña</li>
          <li>El acceso a acciones sensibles está protegido por PIN global</li>
        </ul>
      </div>
    </div>
  );
}
