import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Plus, Edit, Trash2 } from "lucide-react";

export default function PreciosContent({ periodosPrecios, onEdit, onDelete }) {
  const [searchTerm, setSearchTerm] = useState('');

  const periodosFiltrados = React.useMemo(() => {
    if (!searchTerm) return periodosPrecios;
    const term = searchTerm.toLowerCase();
    return periodosPrecios.filter(p => 
      (p.producto_nombre || '').toLowerCase().includes(term) ||
      (p.fecha_desde || '').includes(term) ||
      (p.fecha_hasta || '').includes(term)
    );
  }, [periodosPrecios, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => onEdit(null)} className="bg-green-600 hover:bg-green-700">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Período de Precio
        </Button>
        <Input
          placeholder="Buscar por producto o fecha..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {periodosPrecios.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No hay períodos de precio definidos.</p>
        </div>
      ) : periodosFiltrados.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-500">No se encontraron resultados para "{searchTerm}"</p>
        </div>
      ) : (
        <div className="space-y-2">
          {periodosFiltrados.map(periodo => (
            <div key={periodo.id} className="flex items-center justify-between p-4 bg-white rounded-lg border">
              <div className="flex-1">
                <p className="font-semibold text-slate-800">{periodo.producto_nombre}</p>
                <div className="flex gap-4 mt-2 text-sm text-slate-600">
                  <span>Desde: {periodo.fecha_desde}</span>
                  {periodo.fecha_hasta && <span>Hasta: {periodo.fecha_hasta}</span>}
                </div>
                <div className="flex gap-4 mt-1 text-sm">
                  <span className="text-blue-600">Compra: ${periodo.precio_compra_kg.toFixed(2)}/kg</span>
                  <span className="text-green-600">Venta: ${periodo.precio_venta_kg.toFixed(2)}/kg</span>
                  <span className="text-amber-600">Margen: ${(periodo.precio_venta_kg - periodo.precio_compra_kg).toFixed(2)}/kg</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => onEdit(periodo)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(periodo.id)} className="text-red-500">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
