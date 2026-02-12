import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import AsyncSelect from "./AsyncSelect";
import { calcularPesoNeto, multiplicaExacta } from "./utils/precisionDecimal";

export default function PesajeLineItem({
  item,
  index,
  onChange,
  onRemove,
  onCreateEnvase,
  onCreateProducto
}) {
  const handleChange = (field, value) => {
    const updated = { ...item, [field]: value };
    
    // Recalcular peso neto con precisión decimal exacta
    if (updated.modo === 'libre') {
      updated.peso_neto = calcularPesoNeto(updated.peso_bruto || 0, updated.tara_manual || 0);
    } else {
      const taraTotal = multiplicaExacta(updated.tara_unitaria || 0, updated.cantidad || 0);
      updated.peso_neto = calcularPesoNeto(updated.peso_bruto || 0, taraTotal);
    }
    
    onChange(index, updated);
  };

  const handleEnvaseSelect = (envaseId, envase) => {
    const updated = {
      ...item,
      envase_id: envaseId,
      envase_tipo: envase.tipo,
      tara_unitaria: envase.tara
    };
    const taraTotal = multiplicaExacta(envase.tara, updated.cantidad || 0);
    updated.peso_neto = calcularPesoNeto(updated.peso_bruto || 0, taraTotal);
    onChange(index, updated);
  };

  const handleProductoSelect = (productoId, producto) => {
    handleChange('producto_id', productoId);
    const nombre = producto.nombre || producto.producto_completo || `${producto.fruta || ''} - ${producto.variedad || ''}`.trim();
    onChange(index, {
      ...item,
      producto_id: productoId,
      producto_nombre: nombre || producto.fruta || producto.variedad
    });
  };

  const handleModoChange = (checked) => {
    const modo = checked ? 'libre' : 'estandar';
    const updated = { ...item, modo };
    if (modo === 'libre') {
      updated.peso_neto = calcularPesoNeto(updated.peso_bruto || 0, updated.tara_manual || 0);
    } else {
      const taraTotal = multiplicaExacta(updated.tara_unitaria || 0, updated.cantidad || 0);
      updated.peso_neto = calcularPesoNeto(updated.peso_bruto || 0, taraTotal);
    }
    onChange(index, updated);
  };

  const taraTotal = item.modo === 'libre' 
    ? (item.tara_manual || 0)
    : multiplicaExacta(item.tara_unitaria || 0, item.cantidad || 0);

  return (
    <div className="p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            id={`modo-${index}`}
            checked={item.modo === 'libre'}
            onCheckedChange={handleModoChange}
          />
          <Label htmlFor={`modo-${index}`} className="text-sm font-medium cursor-pointer">
            {item.modo === 'libre' ? 'Modo Libre (Tara Manual)' : 'Modo Estándar'}
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Producto</label>
          <AsyncSelect
            entityKey="Producto"
            value={item.producto_id}
            onChange={handleProductoSelect}
            placeholder="Buscar producto..."
            onCreateNew={onCreateProducto}
            createNewLabel="Crear nuevo producto"
          />
        </div>

        {item.modo !== 'libre' && (
          <>
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
              <label className="text-xs font-medium text-slate-500 mb-1 block">Cantidad</label>
              <Input
                type="number"
                min="0"
                step="1"
                value={item.cantidad ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  handleChange('cantidad', val === '' ? 1 : parseInt(val) || 1);
                }}
                onFocus={(e) => e.target.select()}
                placeholder="1"
                className="text-center"
                inputMode="numeric"
              />
            </div>
          </>
        )}

        {item.modo === 'libre' && (
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Tara Manual (kg)</label>
            <Input
              type="number"
              min="0"
              step="any"
              value={item.tara_manual ?? ''}
              placeholder="0.00"
              onChange={(e) => {
                const val = e.target.value;
                handleChange('tara_manual', val === '' ? 0 : parseFloat(val) || 0);
              }}
              onFocus={(e) => e.target.select()}
              className="text-center font-semibold"
              inputMode="decimal"
            />
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Peso Bruto (kg)</label>
          <Input
            type="number"
            min="0"
            step="any"
            value={item.peso_bruto ?? ''}
            placeholder="0.00"
            onChange={(e) => {
              const val = e.target.value;
              handleChange('peso_bruto', val === '' ? 0 : parseFloat(val) || 0);
            }}
            onFocus={(e) => e.target.select()}
            className="text-center font-semibold"
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100">
        <div className="text-sm">
          <span className="text-slate-500">Tara Total:</span>
          <span className="ml-1 font-medium">{taraTotal.toFixed(2)} kg</span>
        </div>
        <div className="text-sm">
          <span className="text-slate-500">Peso Neto:</span>
          <span className="ml-1 font-bold text-green-700 text-lg">{(item.peso_neto || 0).toFixed(2)} kg</span>
        </div>
      </div>
    </div>
  );
}