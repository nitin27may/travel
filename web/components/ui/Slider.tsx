'use client';

import { useId } from 'react';
import type { CSSProperties } from 'react';
import { cx } from './cx';

interface SliderProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Text for the mono readout, e.g. `1.3×`. */
  format?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

/** Native range input restyled (components 2.6): 4 px track, amber fill, 20 px thumb, readout beside it. Arrow keys step; PageUp/PageDown take 10 steps. */
export function Slider({ label, value, onValueChange, min, max, step = 1, format, disabled, className }: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={cx('slider', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} style={{ '--fill': `${pct}%` } as CSSProperties} onChange={(e) => onValueChange(Number(e.target.value))} />
      <output htmlFor={id} className="slider-out">
        {format ? format(value) : value}
      </output>
    </div>
  );
}
