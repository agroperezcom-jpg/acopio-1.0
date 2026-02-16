import React, { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const PRESETS = {
  hoy: 'hoy',
  ayer: 'ayer',
  esteMes: 'esteMes',
  mesPasado: 'mesPasado',
  personalizado: 'personalizado'
};

function getRangeForPreset(preset) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  switch (preset) {
    case PRESETS.hoy:
      return { desde: startOfDay(hoy), hasta: endOfDay(hoy) };
    case PRESETS.ayer: {
      const ayer = subDays(hoy, 1);
      return { desde: startOfDay(ayer), hasta: endOfDay(ayer) };
    }
    case PRESETS.esteMes:
      return { desde: startOfMonth(hoy), hasta: endOfDay(hoy) };
    case PRESETS.mesPasado: {
      const mesPasado = subMonths(hoy, 1);
      return { desde: startOfMonth(mesPasado), hasta: endOfMonth(mesPasado) };
    }
    default:
      return null;
  }
}

/**
 * Componente reutilizable para filtrar por rango de fechas, estilo ERP profesional.
 *
 * @param {Object} props
 * @param {string | Date} props.startDate - Fecha desde (yyyy-MM-dd o Date)
 * @param {string | Date} props.endDate - Fecha hasta (yyyy-MM-dd o Date)
 * @param {function({ start: Date, end: Date }): void} props.onChange - Callback al cambiar el rango
 * @param {string} [props.className] - Clases CSS adicionales
 */
export default function DateRangeSelector({ startDate, endDate, onChange, className }) {
  const toYMD = (d) => (d ? format(d instanceof Date ? d : new Date(d), 'yyyy-MM-dd') : '');

  const [preset, setPreset] = useState(PRESETS.personalizado);
  const [desde, setDesde] = useState(toYMD(startDate));
  const [hasta, setHasta] = useState(toYMD(endDate));

  useEffect(() => {
    setDesde(toYMD(startDate));
    setHasta(toYMD(endDate));
  }, [startDate, endDate]);

  const handlePresetChange = (e) => {
    const key = e.target.value;
    setPreset(key);

    if (key === PRESETS.personalizado) {
      return;
    }

    const range = getRangeForPreset(key);
    if (range) {
      const desdeStr = format(range.desde, 'yyyy-MM-dd');
      const hastaStr = format(range.hasta, 'yyyy-MM-dd');
      setDesde(desdeStr);
      setHasta(hastaStr);
      onChange?.({ start: range.desde, end: range.hasta });
    }
  };

  // Al tocar fechas manuales: dropdown → Personalizado; solo actualizamos 'desde', 'hasta' se mantiene
  const handleDesdeChange = (e) => {
    const value = e.target.value;
    setDesde(value);
    setPreset(PRESETS.personalizado);
    const start = value ? new Date(value) : null;
    const end = hasta ? new Date(hasta + 'T23:59:59') : null;
    if (start && end && start <= end) {
      onChange?.({ start, end });
    }
  };

  // Solo actualizamos 'hasta', 'desde' se mantiene
  const handleHastaChange = (e) => {
    const value = e.target.value;
    setHasta(value);
    setPreset(PRESETS.personalizado);
    const end = value ? new Date(value + 'T23:59:59') : null;
    const start = desde ? new Date(desde) : null;
    if (start && end && start <= end) {
      onChange?.({ start, end });
    }
  };

  const barraClase = 'h-10 box-border rounded-md border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <select
        value={preset}
        onChange={handlePresetChange}
        className={cn(barraClase, 'min-w-[140px] cursor-pointer')}
        aria-label="Preset de rango"
      >
        <option value={PRESETS.hoy}>Hoy</option>
        <option value={PRESETS.ayer}>Ayer</option>
        <option value={PRESETS.esteMes}>Este Mes</option>
        <option value={PRESETS.mesPasado}>Mes Pasado</option>
        <option value={PRESETS.personalizado}>Personalizado</option>
      </select>

      <label className="sr-only">Desde</label>
      <Input
        type="date"
        value={desde}
        onChange={handleDesdeChange}
        max={hasta || undefined}
        className={cn(barraClase, 'w-[140px] shrink-0 [&::-webkit-calendar-picker-indicator]:opacity-70')}
        aria-label="Fecha desde"
      />
      <span className="text-slate-400 text-sm font-medium shrink-0" aria-hidden="true">—</span>
      <label className="sr-only">Hasta</label>
      <Input
        type="date"
        value={hasta}
        onChange={handleHastaChange}
        min={desde || undefined}
        className={cn(barraClase, 'w-[140px] shrink-0 [&::-webkit-calendar-picker-indicator]:opacity-70')}
        aria-label="Fecha hasta"
      />
    </div>
  );
}
