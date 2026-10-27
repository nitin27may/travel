'use client';

import { useId } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Icon } from './Icon';
import { cx } from './cx';
import './stepper.css';

export interface StepperProps {
  /** Visible label, also the group's name: "Adults". */
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  /** "Fewer adults", "More adults": the buttons' names (voice users say "click More adults"). */
  decLabel: string;
  incLabel: string;
  /** How the value reads: "Under 1" for an age of 0. */
  format?: (n: number) => string;
  className?: string;
}

/**
 * One number that moves by one inside a small range (components 2.12). Two real buttons, no spinbutton role. At a bound a button stays
 * focusable with `aria-disabled`, never `disabled`: a disabled button under the finger sends focus to `body`. The value is an
 * `<output>` that announces politely. Up and Down on either button step once.
 */
export function Stepper({ label, value, min, max, onChange, decLabel, incLabel, format, className }: StepperProps) {
  const id = useId();
  const step = (d: 1 | -1) => {
    const next = value + d;
    if (next < min || next > max) return;
    onChange(next);
  };
  // Safari does not focus a button on click; a stepper keeps focus on the button pressed, so repeated taps and the keys keep working
  const press = (d: 1 | -1) => (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.focus();
    step(d);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') step(1);
    else if (e.key === 'ArrowDown') step(-1);
    else return;
    e.preventDefault();
  };
  return (
    <div className={cx('stepper', className)} role="group" aria-labelledby={`${id}-l`}>
      <span className="stepper-label" id={`${id}-l`}>{label}</span>
      <div className="stepper-ctl">
        <button type="button" className="stepper-btn" aria-label={decLabel} aria-disabled={value <= min || undefined} onClick={press(-1)} onKeyDown={key}>
          <Icon name="minus" size={16} />
        </button>
        <output className="stepper-val num" aria-live="polite">{format ? format(value) : value}</output>
        <button type="button" className="stepper-btn" aria-label={incLabel} aria-disabled={value >= max || undefined} onClick={press(1)} onKeyDown={key}>
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  );
}
