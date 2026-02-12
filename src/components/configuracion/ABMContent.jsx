import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, Upload, Loader2 } from "lucide-react";

const ENTIDADES = [
  { key: 'proveedores', label: 'Proveedores', type: 'proveedor', displayKey: 'nombre' },
  { key: 'clientes', label: 'Clientes', type: 'cliente', displayKey: 'nombre' },
  { key: 'bancos', label: 'Bancos', type: 'banco', displayKey: 'nombre' },
  { key: 'envases', label: 'Envases', type: 'envase', displayKey: 'tipo' },
  { key: 'productos', label: 'Productos', type: 'producto', displayKey: 'nombre' },
  { key: 'fleteros', label: 'Fleteros', type: 'fletero', displayKey: 'nombre' }
];

export default function ABMContent({
  subTab,
  setSubTab,
  searchTerm,
  setSearchTerm,
  data,
  hasMore,
  onLoadMore,
  isLoading,
  isFetchingMore,
  displayKey = 'nombre',
  onEdit,
  onDelete,
  onImportarBancos
}) {
  const currentEntidad = ENTIDADES.find(e => e.key === subTab);
  const type = currentEntidad?.type ?? 'proveedor';
  const keyDisplay = currentEntidad?.displayKey ?? displayKey;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-48 shrink-0">
        <div className="bg-slate-50 rounded-lg p-2 space-y-1">
          {ENTIDADES.map(ent => (
            <button
              key={ent.key}
              onClick={() => setSubTab(ent.key)}
              className={`w-full text-left px-4 py-2.5 rounded-md transition-colors text-sm ${
                subTab === ent.key
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              {ent.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex gap-2 mb-4">
          <Button onClick={() => onEdit(type, null)}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar
          </Button>
          {type === 'banco' && (
            <Button onClick={onImportarBancos} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>
          )}
          <Input
            placeholder="Buscar en servidor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-center text-slate-500 py-8">
            {searchTerm ? 'No se encontraron resultados' : 'No hay registros'}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {data.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300"
                >
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{item[keyDisplay]}</p>
                    {item.direccion && <p className="text-sm text-slate-600">{item.direccion}</p>}
                    {type === 'producto' && (
                      <div className="text-sm text-slate-600">
                        <span>Stock: {(item.stock || 0).toFixed(2)} kg</span>
                        {item.precio_kg > 0 && <span className="ml-3">• Precio: ${item.precio_kg.toFixed(2)}/kg</span>}
                      </div>
                    )}
                    {type === 'envase' && <p className="text-sm text-slate-600">Tara: {item.tara} kg</p>}
                    {type === 'banco' && item.codigo && <p className="text-sm text-slate-600">Código: {item.codigo}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(type, item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(type, item)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => onLoadMore()}
                  disabled={isFetchingMore}
                >
                  {isFetchingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Cargar más
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
