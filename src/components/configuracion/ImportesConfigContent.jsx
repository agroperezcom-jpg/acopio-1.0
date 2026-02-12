import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Plus, Edit, Trash2 } from "lucide-react";

export default function ImportesConfigContent({ importes, onEdit, onDelete }) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
        <p className="text-sm text-emerald-900 font-medium mb-1">💰 Importes Predeterminados para Viajes</p>
        <p className="text-xs text-emerald-800">
          Configure importes estándar que se pueden aplicar rápidamente en liquidaciones de fleteros. Útil para distintos tipos de viajes (cortos, medios, largos).
        </p>
      </div>

      <Button onClick={() => onEdit(null)} className="bg-emerald-600 hover:bg-emerald-700">
        <Plus className="h-4 w-4 mr-2" />
        Nuevo Importe Predeterminado
      </Button>

      {importes.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No hay importes configurados</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {importes.map(imp => (
            <Card key={imp.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-semibold text-slate-800 truncate">{imp.concepto}</p>
                      <Badge variant={imp.activo ? 'default' : 'secondary'} className="shrink-0">
                        {imp.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600">
                      ${imp.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(imp)} className="h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(imp.id)} className="h-8 w-8 text-red-500">
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
