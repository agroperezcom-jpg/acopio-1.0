import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Seleccionar...",
  displayKey = "nombre",
  valueKey = "id",
  onCreateNew,
  createNewLabel = "Crear nuevo",
  disabled = false
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(opt => 
      String(opt[displayKey] || "").toLowerCase().includes(searchLower)
    );
  }, [options, search, displayKey]);

  const selectedOption = options.find(opt => opt[valueKey] === value);
  const displayValue = selectedOption ? selectedOption[displayKey] : placeholder;

  const handleSelect = (option) => {
    onChange(option[valueKey], option);
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
          className="w-full justify-between font-normal"
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
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0 p-0 h-8"
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filteredOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No se encontraron resultados
            </p>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option[valueKey]}
                onClick={() => handleSelect(option)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent",
                  value === option[valueKey] && "bg-accent"
                )}
              >
                <Check className={cn(
                  "h-4 w-4",
                  value === option[valueKey] ? "opacity-100" : "opacity-0"
                )} />
                {option[displayKey]}
              </button>
            ))
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