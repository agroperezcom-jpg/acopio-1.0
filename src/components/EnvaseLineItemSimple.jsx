import React from 'react';
import { Input } from "@/components/ui/input";
import SearchableSelect from "./SearchableSelect";

export default function EnvaseLineItemSimple({
  item,
  index,
  envases,
  onChange,
  onCreateEnvase,
  mostrarContabilizar = false,
  fleteroData = null
}) {
  const handleChange = (field, value) => {
    const finalValue = (field === 'cantidad_ingreso' || field === 'cantidad_salida') 
      ? (value === '' || value === null || value === undefined ? 0 : parseInt(value) || 0)
      : value;
    onChange(index, { ...item, [field]: finalValue });
  };

  const handleEnvaseSelect = (envaseId, envase) => {
    onChange(index, {
      ...item,
      envase_id: envaseId,
      envase_tipo: envase.tipo,
      tara: envase.tara
    });
  };

  return (
    <div className="space-y-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Tipo de Envase</label>
        <SearchableSelect
          options={envases}
          value={item.envase_id}
          onChange={handleEnvaseSelect}
          displayKey="tipo"
          placeholder="Seleccionar envase..."
          onCreateNew={onCreateEnvase}
          createNewLabel="Crear nuevo envase"
        />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">
            Ingreso (Devolución Vacíos)
          </label>
          <Input
            type="number"
            min="0"
            step="1"
            value={item.cantidad_ingreso ?? 0}
            placeholder="0"
            onChange={(e) => {
              const val = e.target.value;
              const cantidad = val === '' ? 0 : parseInt(val) || 0;
              handleChange('cantidad_ingreso', cantidad);
            }}
            onFocus={(e) => e.target.select()}
            className="text-center"
            inputMode="numeric"
          />
          <p className="text-xs text-slate-500 mt-1">Envases vacíos devueltos</p>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">
            Salida (Entrega Vacíos)
          </label>
          <Input
            type="number"
            min="0"
            step="1"
            value={item.cantidad_salida ?? 0}
            placeholder="0"
            onChange={(e) => {
              const val = e.target.value;
              const cantidad = val === '' ? 0 : parseInt(val) || 0;
              handleChange('cantidad_salida', cantidad);
            }}
            onFocus={(e) => e.target.select()}
            className="text-center"
            inputMode="numeric"
          />
          <p className="text-xs text-slate-500 mt-1">Envases vacíos entregados</p>
        </div>
      </div>

      {/* Checkbox Contabilizar Viaje */}
      {mostrarContabilizar && fleteroData && (
        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <input
              type="checkbox"
              checked={item.contabilizar_viaje || false}
              onChange={(e) => handleChange('contabilizar_viaje', e.target.checked)}
              className="h-5 w-5 mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            <div className="flex-1">
              <label className="text-sm font-semibold text-amber-900 block mb-1 cursor-pointer">
                Contabilizar viaje para {fleteroData.nombre}
              </label>
              <p className="text-xs text-amber-700">
                {fleteroData.precio_kg > 0 
                  ? `Se pagará $${fleteroData.precio_kg}/kg transportado`
                  : 'Configure precio/kg del fletero en Empleados'
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}