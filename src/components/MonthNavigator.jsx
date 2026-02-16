import React from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Navegador de mes: permite moverse solo de mes en mes (sin rango libre).
 * Muestra mes y año centrados con botones anterior/siguiente.
 *
 * @param {Object} props
 * @param {Date} props.currentDate - Fecha actual que representa el mes mostrado
 * @param {function(Date): void} props.onMonthChange - Callback al cambiar de mes (recibe la nueva fecha)
 * @param {string} [props.className] - Clases CSS adicionales
 */
export default function MonthNavigator({ currentDate, onMonthChange, className }) {
  const handleAnterior = () => {
    onMonthChange(subMonths(currentDate, 1));
  };

  const handleSiguiente = () => {
    onMonthChange(addMonths(currentDate, 1));
  };

  const mesAnio = format(currentDate, 'LLLL yyyy', { locale: es });

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm',
        className
      )}
      role="toolbar"
      aria-label="Navegación por mes"
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleAnterior}
        aria-label="Mes anterior"
        className="h-9 w-9 shrink-0"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <span className="min-w-[140px] text-center text-base font-semibold text-slate-800">
        {mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleSiguiente}
        aria-label="Mes siguiente"
        className="h-9 w-9 shrink-0"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
