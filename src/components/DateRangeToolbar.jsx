import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, subDays, endOfDay, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Presets disponibles para el rango de fechas */
export const DATE_RANGE_PRESETS = {
  today: 'today',
  thisMonth: 'thisMonth',
  lastMonth: 'lastMonth',
  last3Months: 'last3Months',
  thisYear: 'thisYear',
  custom: 'custom'
};

/** Obtiene el rango de fechas según el preset */
export function getRangeForPreset(preset) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  switch (preset) {
    case DATE_RANGE_PRESETS.today:
      return {
        desde: startOfDay(hoy),
        hasta: endOfDay(hoy)
      };
    case DATE_RANGE_PRESETS.thisMonth:
      return {
        desde: startOfMonth(hoy),
        hasta: endOfDay(hoy)
      };
    case DATE_RANGE_PRESETS.lastMonth:
      const mesPasado = subMonths(hoy, 1);
      return {
        desde: startOfMonth(mesPasado),
        hasta: endOfDay(endOfMonth(mesPasado))
      };
    case DATE_RANGE_PRESETS.last3Months:
      return {
        desde: subDays(hoy, 90),
        hasta: endOfDay(hoy)
      };
    case DATE_RANGE_PRESETS.thisYear:
      return {
        desde: startOfYear(hoy),
        hasta: endOfDay(hoy)
      };
    default:
      return {
        desde: startOfMonth(hoy),
        hasta: new Date(hoy)
      };
  }
}

/**
 * Toolbar reutilizable para filtrar dashboards por rango de fechas.
 * Dispara onRangeChange al montar con el rango por defecto.
 *
 * @param {Object} props
 * @param {function({ desde: Date, hasta: Date }): void} props.onRangeChange - Callback al cambiar el rango
 * @param {string} [props.defaultRange='thisMonth'] - Preset por defecto: 'thisMonth' | 'lastMonth' | 'last3Months' | 'thisYear'
 * @param {string} [props.className] - Clases CSS adicionales
 * @param {boolean} [props.compact] - Modo compacto (solo botones, sin inputs)
 */
export default function DateRangeToolbar({
  onRangeChange,
  defaultRange = DATE_RANGE_PRESETS.thisMonth,
  className,
  compact = false
}) {
  const preset = defaultRange in DATE_RANGE_PRESETS ? defaultRange : DATE_RANGE_PRESETS.thisMonth;
  const initialRange = getRangeForPreset(preset);

  const [desde, setDesde] = useState(initialRange.desde);
  const [hasta, setHasta] = useState(initialRange.hasta);
  const [activePreset, setActivePreset] = useState(preset);

  const applyRange = useCallback((desdeDate, hastaDate, presetKey = DATE_RANGE_PRESETS.custom) => {
    setDesde(desdeDate);
    setHasta(hastaDate);
    setActivePreset(presetKey);
    onRangeChange?.({ desde: desdeDate, hasta: hastaDate });
  }, [onRangeChange]);

  // Disparar onRangeChange al montar con el rango por defecto
  useEffect(() => {
    onRangeChange?.({ desde: initialRange.desde, hasta: initialRange.hasta });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Solo al montar

  const handlePresetClick = (presetKey) => {
    const { desde: d, hasta: h } = getRangeForPreset(presetKey);
    applyRange(d, h, presetKey);
  };

  const handleDesdeChange = (e) => {
    const value = e.target.value;
    if (!value) return;
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    const h = new Date(hasta);
    if (d > h) return; // Evitar rango inválido
    applyRange(d, h, DATE_RANGE_PRESETS.custom);
  };

  const handleHastaChange = (e) => {
    const value = e.target.value;
    if (!value) return;
    const h = new Date(value + 'T23:59:59');
    const d = new Date(desde);
    if (d > h) return;
    applyRange(d, h, DATE_RANGE_PRESETS.custom);
  };

  const desdeStr = format(desde, 'yyyy-MM-dd');
  const hastaStr = format(hasta, 'yyyy-MM-dd');

  const presets = [
    { key: DATE_RANGE_PRESETS.today, label: 'Hoy' },
    { key: DATE_RANGE_PRESETS.thisMonth, label: 'Este Mes' },
    { key: DATE_RANGE_PRESETS.lastMonth, label: 'Mes Pasado' },
    { key: DATE_RANGE_PRESETS.last3Months, label: 'Últimos 3 Meses' },
    { key: DATE_RANGE_PRESETS.thisYear, label: 'Este Año' }
  ];

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      <div className="flex flex-wrap gap-2">
        {presets.map(({ key, label }) => (
          <Button
            key={key}
            type="button"
            variant={activePreset === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(key)}
            className="text-xs"
          >
            {label}
          </Button>
        ))}
      </div>

      {!compact && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Input
              type="date"
              value={desdeStr}
              onChange={handleDesdeChange}
              className="w-[140px] h-8 text-sm"
              max={hastaStr}
            />
          </div>
          <span className="text-slate-400 text-sm">—</span>
          <Input
            type="date"
            value={hastaStr}
            onChange={handleHastaChange}
            className="w-[140px] h-8 text-sm"
            min={desdeStr}
          />
        </div>
      )}
    </div>
  );
}
