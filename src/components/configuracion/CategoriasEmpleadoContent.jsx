import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Edit, Trash2 } from "lucide-react";

export default function CategoriasEmpleadoContent({ categorias, onEdit, onDelete }) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900 font-medium mb-1">💼 Categorías de Empleados</p>
        <p className="text-xs text-blue-800">
          Define categorías laborales con tipos de liquidación y conceptos predeterminados. Las categorías con "Sueldo Fijo" permiten configurar conceptos que se aplicarán automáticamente. Las de "Por Viaje" habilitan el registro de viajes detallados.
        </p>
      </div>

      <Button onClick={() => onEdit(null)} className="bg-indigo-600 hover:bg-indigo-700">
        <Plus className="h-4 w-4 mr-2" />
        Nueva Categoría de Empleado
      </Button>

      {categorias.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No hay categorías de empleado definidas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categorias.map(cat => (
            <Card key={cat.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-800">{cat.nombre}</p>
                      <Badge variant={cat.activo ? 'default' : 'secondary'}>
                        {cat.activo ? 'Activa' : 'Inactiva'}
                      </Badge>
                      <Badge variant="outline">{cat.tipo_liquidacion}</Badge>
                    </div>
                    {cat.conceptos_predeterminados && cat.conceptos_predeterminados.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-500 mb-1">Conceptos predeterminados:</p>
                        <div className="flex flex-wrap gap-1">
                          {cat.conceptos_predeterminados.map((c, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {c.nombre}: ${c.monto_default} ({c.tipo})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(cat)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(cat.id)} className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
