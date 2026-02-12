import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AsyncSelect from "./AsyncSelect";
import { Trash2 } from "lucide-react";

export default function EnvaseLineItemLlenos({
  item,
  index,
  onChange,
  onRemove,
  onCreateEnvase,
  showRemove = true
}) {
  const handleChange = (field, value) => {
    const finalValue = field === 'cantidad' 
      ? (value === '' || value === null || value === undefined ? 0 : parseInt(value) || 0)
      : value;
    onChange(index, { ...item, [field]: finalValue });
  };

  const handleEnvaseSelect = (envaseId, envase) => {
    onChange(index, {
      ...item,
      envase_id: envaseId,
      envase_tipo: envase.tipo
    });
  };

  return (
    <div className="space-y-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Tipo de Envase</label>
          <AsyncSelect
            entityKey="Envase"
            value={item.envase_id}
            onChange={handleEnvaseSelect}
            placeholder="Buscar envase..."
            onCreateNew={onCreateEnvase}
            createNewLabel="Crear nuevo envase"
          />
        </div>
        
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">
            Cantidad de Envases Llenos
          </label>
          <Input
            type="number"
            min="0"
            step="1"
            value={item.cantidad ?? 0}
            placeholder="0"
            onChange={(e) => {
              const val = e.target.value;
              const cantidad = val === '' ? 0 : parseInt(val) || 0;
              handleChange('cantidad', cantidad);
            }}
            onFocus={(e) => e.target.select()}
            className="text-center"
            inputMode="numeric"
          />
        </div>
      </div>

      {showRemove && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Eliminar
          </Button>
        </div>
      )}
    </div>
  );
}