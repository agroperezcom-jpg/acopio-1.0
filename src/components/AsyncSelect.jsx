/**
 * Select con búsqueda asíncrona en servidor.
 * NO carga la lista al inicio: hace .filter({ [searchField]: { $regex: term, $options: 'i' } }) mientras el usuario escribe.
 * Máximo 30 resultados por búsqueda para evitar 429.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { escapeRegex } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const LIMIT = 30;
const DEBOUNCE_MS = 350;

const entityConfig = {
  Cliente: { entity: 'Cliente', displayKey: 'nombre', valueKey: 'id', searchField: 'nombre', order: 'nombre' },
  Proveedor: { entity: 'Proveedor', displayKey: 'nombre', valueKey: 'id', searchField: 'nombre', order: 'nombre' },
  Producto: { entity: 'Producto', displayKey: 'nombre', valueKey: 'id', searchField: 'fruta', order: 'fruta' },
  Envase: { entity: 'Envase', displayKey: 'tipo', valueKey: 'id', searchField: 'tipo', order: 'tipo' },
  Fletero: { entity: 'Fletero', displayKey: 'nombre', valueKey: 'id', searchField: 'nombre', order: 'nombre' },
  EmpleadoAcopio: { entity: 'EmpleadoAcopio', displayKey: 'nombre', valueKey: 'id', searchField: 'nombre', order: 'nombre' },
  Banco: { entity: 'Banco', displayKey: 'nombre', valueKey: 'id', searchField: 'nombre', order: 'nombre' },
  Caja: { entity: 'Caja', displayKey: 'nombre', valueKey: 'id', searchField: 'nombre', order: 'nombre' },
  Cheque: { entity: 'Cheque', displayKey: 'numero_cheque', valueKey: 'id', searchField: 'numero_cheque', order: '-fecha_emision' },
};

function buildQuery(searchField, searchTerm, serverFilter = {}) {
  const term = (searchTerm || '').trim();
  if (!term) return serverFilter;
  return {
    ...serverFilter,
    [searchField]: { $regex: escapeRegex(term), $options: 'i' }
  };
}

function normalizeOption(opt, entityKey) {
  if (entityKey === 'Producto' && (opt.fruta || opt.variedad)) {
    return { ...opt, nombre: `${opt.fruta || ''} - ${opt.variedad || ''}`.replace(/^ - | - $/g, '').trim() || opt.fruta || opt.variedad };
  }
  return opt;
}

export default function AsyncSelect({
  entityKey,
  value,
  onChange,
  placeholder = "Buscar...",
  displayKey: displayKeyProp,
  valueKey: valueKeyProp,
  onCreateNew,
  createNewLabel = "Crear nuevo",
  disabled = false,
  initialOption = null,
  serverFilter = {},
  className
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const config = entityConfig[entityKey] || { entity: entityKey, displayKey: 'nombre', valueKey: 'id', searchField: 'nombre', order: 'nombre' };
  const displayKey = displayKeyProp ?? config.displayKey;
  const valueKey = valueKeyProp ?? config.valueKey;
  const searchField = config.searchField;
  const order = config.order;
  const entityName = config.entity;
  const serverFilterKey = JSON.stringify(serverFilter || {});
  const parsedServerFilter = useMemo(() => {
    try {
      return JSON.parse(serverFilterKey);
    } catch {
      return {};
    }
  }, [serverFilterKey]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const query = useMemo(
    () => buildQuery(searchField, debouncedSearch, parsedServerFilter),
    [searchField, debouncedSearch, parsedServerFilter]
  );

  const { data: options = [], isLoading: loading } = useQuery({
    queryKey: ['async-select', entityName, debouncedSearch, serverFilterKey],
    queryFn: async () => {
      const raw = await base44.entities[entityName].filter(query, order, LIMIT, 0);
      const list = Array.isArray(raw) ? raw : [];
      return list.map(opt => normalizeOption(opt, entityKey));
    },
    enabled: open,
    staleTime: 2 * 60 * 1000,
  });

  const selectedOption = useMemo(() => {
    if (initialOption && (initialOption[valueKey] === value || initialOption.id === value)) return initialOption;
    return options.find(opt => opt[valueKey] === value || opt.id === value);
  }, [options, value, valueKey, initialOption]);

  const displayValue = selectedOption
    ? (selectedOption[displayKey] ?? selectedOption.nombre ?? selectedOption.tipo ?? String(value))
    : placeholder;

  const handleSelect = (option) => {
    const normalized = normalizeOption(option, entityKey);
    onChange(normalized[valueKey], normalized);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn(!selectedOption && "text-muted-foreground")}>
            {displayValue}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="p-2 border-b">
          <div className="flex items-center gap-2 px-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Escriba para buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0 p-0 h-8"
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : options.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {debouncedSearch ? "No se encontraron resultados" : "Escriba para buscar"}
            </p>
          ) : (
            options.map((option) => {
              const norm = normalizeOption(option, entityKey);
              const label = norm[displayKey] ?? norm.nombre ?? norm.tipo ?? norm.id;
              const optValue = norm[valueKey] ?? norm.id;
              return (
                <button
                  key={optValue}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent",
                    value === optValue && "bg-accent"
                  )}
                >
                  <Check className={cn("h-4 w-4", value === optValue ? "opacity-100" : "opacity-0")} />
                  {label}
                </button>
              );
            })
          )}
        </div>
        {onCreateNew && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start text-primary"
              onClick={() => {
                onCreateNew();
                setOpen(false);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {createNewLabel}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
