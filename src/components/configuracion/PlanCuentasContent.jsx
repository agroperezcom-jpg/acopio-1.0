import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BookOpen, Plus, Edit, Trash2, Upload, Loader2 } from "lucide-react";

export default function PlanCuentasContent({ 
  cuentas, 
  searchTerm,
  setSearchTerm,
  hasMore,
  onLoadMore,
  isLoading,
  isFetchingMore,
  onEdit, 
  onDelete, 
  onDeleteMultiple, 
  onImportar, 
  esAdmin 
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDeleteMultiple, setConfirmDeleteMultiple] = useState(false);

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === cuentas.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(cuentas.map(c => c.id));
    }
  };

  const handleDeleteSelected = () => {
    setConfirmDeleteMultiple(true);
  };

  const confirmDelete = () => {
    onDeleteMultiple(selectedIds);
    setSelectedIds([]);
    setConfirmDeleteMultiple(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => onEdit(null)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Cuenta
        </Button>
        <Button onClick={onImportar} variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Importar CSV/XLSX
        </Button>
        {esAdmin && selectedIds.length > 0 && (
          <Button 
            onClick={handleDeleteSelected} 
            variant="destructive"
            className="ml-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar {selectedIds.length} seleccionada{selectedIds.length > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      <Input
        placeholder="Buscar en servidor por código, nombre, tipo o categoría..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-md"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : cuentas.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">
            {searchTerm ? `No se encontraron resultados para "${searchTerm}"` : 'No hay cuentas en el plan. Agregue o importe cuentas.'}
          </p>
        </div>
      ) : (
        <>
          {esAdmin && cuentas.length > 0 && (
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border">
              <input
                type="checkbox"
                checked={selectedIds.length === cuentas.length && cuentas.length > 0}
                onChange={handleToggleSelectAll}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-600">
                Seleccionar todas ({cuentas.length})
              </span>
            </div>
          )}
          <div className="space-y-2">
            {cuentas.map(cuenta => (
              <div key={cuenta.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                {esAdmin && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(cuenta.id)}
                    onChange={() => handleToggleSelect(cuenta.id)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <code className="bg-slate-100 px-2 py-0.5 rounded text-sm font-mono">{cuenta.codigo}</code>
                    <span className="font-medium">{cuenta.nombre}</span>
                    <span className="text-xs text-slate-500">• {cuenta.tipo}</span>
                  </div>
                  {cuenta.categoria && <p className="text-sm text-slate-600 mt-1">{cuenta.categoria}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(cuenta)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(cuenta.id)} className="text-red-500">
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
                Cargar más cuentas
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modal de confirmación para borrado múltiple */}
      <Dialog open={confirmDeleteMultiple} onOpenChange={setConfirmDeleteMultiple}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación Múltiple</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-700 mb-3">
              ¿Está seguro de eliminar <strong>{selectedIds.length}</strong> cuenta{selectedIds.length > 1 ? 's' : ''}?
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">⚠️ Advertencia</p>
              <p className="text-xs text-red-700 mt-1">Esta acción no se puede deshacer. Las cuentas con movimientos asociados no se eliminarán.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteMultiple(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Confirmar Eliminación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
