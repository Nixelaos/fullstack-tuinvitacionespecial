import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface GuestStepperProps {
  value: number;
  min?: number;
  max: number;
  disabled?: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  singularLabel?: string;
  pluralLabel?: string;
  containerClassName?: string;
  buttonClassName?: string;
  valueClassName?: string;
  valueStyle?: React.CSSProperties;
  sublabelClassName?: string;
}

/**
 * Control numérico accesible (+ / -) para selección de cantidad de asistentes.
 * Reutilizable en distintas plantillas de invitación mediante clases personalizables.
 */
export function GuestStepper({
  value,
  min = 1,
  max,
  disabled = false,
  onDecrement,
  onIncrement,
  singularLabel = 'persona confirmada',
  pluralLabel = 'personas confirmadas',
  containerClassName = 'bg-white/80 border border-[#DFCBB5] rounded-xl p-2.5 flex items-center justify-between',
  buttonClassName = 'w-9 h-9 rounded-lg bg-[#F5ECE0] hover:bg-[#FAF3E8] disabled:opacity-30 disabled:cursor-not-allowed border border-[#DFCBB5] flex items-center justify-center text-[#2F2420] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8864E]/60',
  valueClassName = 'font-serif text-xl sm:text-2xl text-[#2F2420] font-bold leading-none',
  valueStyle = { fontFamily: "'Cormorant Garamond', Georgia, serif" },
  sublabelClassName = 'text-[10px] text-[#8C6947] font-medium uppercase tracking-wider',
}: GuestStepperProps) {
  return (
    <div className={containerClassName}>
      <button
        type="button"
        onClick={onDecrement}
        disabled={disabled || value <= min}
        aria-label="Disminuir asistentes"
        className={buttonClassName}
      >
        <Minus className="w-4 h-4" aria-hidden="true" />
      </button>

      <div className="flex flex-col items-center" aria-live="polite">
        <span className={valueClassName} style={valueStyle}>
          {value}
        </span>
        <span className={sublabelClassName}>
          {value === 1 ? singularLabel : pluralLabel}
        </span>
      </div>

      <button
        type="button"
        onClick={onIncrement}
        disabled={disabled || value >= max}
        aria-label="Aumentar asistentes"
        className={buttonClassName}
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
