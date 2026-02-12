import React from 'react';
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import AsyncSelect from "./AsyncSelect";

export default function DetalleLineItem({
  item,
  index,
  onChange,
  onCreateProducto
}) {
  const handleChange = (field, value) => {
    onChange(index, { ...item, [field]: value });
  };

  const handleProductoSelect = (productoId, producto) => {
    const nombre = producto.nombre || producto.producto_completo || `${producto.fruta || ''} - ${producto.variedad || ''}`.trim();
    onChange(index, {
      ...item,
      producto_id: productoId,
      producto_nombre: nombre || producto.fruta,
      stock_disponible: producto.stock || 0
    });
  };

  const handleKilosChange = (value) => {
    const kilos = value === '' ? 0 : parseFloat(value) || 0;
    onChange(index, {
      ...item,
      kilos_salida: kilos
    });
  };

  const stockInsuficiente = (item.kilos_salida || 0) > (item.stock_disponible || 0);
  const stockRestante = (item.stock_disponible || 0) - (item.kilos_salida || 0);

  return (
    <div className="p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Kilos a Salir</label>
          <Input
            type="number"
            min="0"
            step="any"
            value={item.kilos_salida ?? 0}
            onChange={(e) => handleKilosChange(e.target.value)}
            onBlur={(e) => {
              if (e.target.value === '') {
                handleKilosChange(0);
              }
            }}
            inputMode="decimal"
            className={stockInsuficiente ? "border-red-500" : ""}
          />
        </div>
      </div>

      {item.producto_id && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">
            Stock disponible: <strong>{(item.stock_disponible || 0).toFixed(2)} kg</strong>
          </span>
          {item.kilos_salida > 0 && (
            <span className={stockRestante >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
              Stock restante: {stockRestante.toFixed(2)} kg
            </span>
          )}
        </div>
      )}

      {stockInsuficiente && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Stock insuficiente. Disponible: {(item.stock_disponible || 0).toFixed(2)} kg | Faltante: {Math.abs(stockRestante).toFixed(2)} kg
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}