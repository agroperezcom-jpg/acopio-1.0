import React, { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const PRESETS = {
  hoy: 'hoy',
  ayer: 'ayer',
  esteMes: 'esteMes',
  mesPasado: 'mesPasado',
  ultimos3Meses: 'ultimos3Meses',
  esteAnio: 'esteAnio',
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
    case PRESETS.ultimos3Meses:
      return { desde: subDays(hoy, 90), hasta: endOfDay(hoy) };
    case PRESETS.esteAnio:
      return { desde: startOfYear(hoy), hasta: endOfDay(hoy) };
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

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <div className="flex items-center gap-2">
        <select
          value={preset}
          onChange={handlePresetChange}
          className="flex h-9 min-w-[140px] rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value={PRESETS.hoy}>Hoy</option>
          <option value={PRESETS.ayer}>Ayer</option>
          <option value={PRESETS.esteMes}>Este Mes</option>
          <option value={PRESETS.mesPasado}>Mes Pasado</option>
          <option value={PRESETS.ultimos3Meses}>Últimos 3 Meses</option>
          <option value={PRESETS.esteAnio}>Este Año</option>
          <option value={PRESETS.personalizado}>Personalizado</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <div>
          <label className="sr-only">Desde</label>
          <Input
            type="date"
            value={desde}
            onChange={handleDesdeChange}
            max={hasta || undefined}
            className="h-9 w-[130px] text-sm"
            aria-label="Fecha desde"
          />
        </div>
        <span className="text-slate-400 text-sm font-medium">—</span>
        <div>
          <label className="sr-only">Hasta</label>
          <Input
            type="date"
            value={hasta}
            onChange={handleHastaChange}
            min={desde || undefined}
            className="h-9 w-[130px] text-sm"
            aria-label="Fecha hasta"
          />
        </div>
      </div>
    </div>
  );
}
