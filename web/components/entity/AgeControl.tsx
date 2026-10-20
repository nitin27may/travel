'use client';

import { Icon } from '@/components/ui/Icon';

export const MAX_AGE = 17;
/** Quick picks beside the stepper (suitability-display 5): "Baby" is under one. */
const QUICK: { age: number; label: string }[] = [
  { age: 0, label: 'Baby' },
  { age: 3, label: '3' },
  { age: 6, label: '6' },
  { age: 9, label: '9' },
  { age: 12, label: '12' },
];

const isAge = (v: string | undefined): v is string => v !== undefined && /^\d{1,2}$/.test(v);

interface ControlProps {
  /** The selected age as written in the URL, or other values (an old kid-fit value) which the control treats as "no age". */
  selected: string[];
  onChange: (values: string[]) => void;
  /** One muted line at the foot of the menu. */
  note?: string;
}

/** Stepper and quick chips for the youngest child's age. "Any age" clears. No popover of its own, so the phone sheet can use it too. */
export function AgeControl({ selected, onChange, note }: ControlProps) {
  const age = isAge(selected[0]) ? Number(selected[0]) : null;
  const set = (n: number) => onChange([String(Math.min(MAX_AGE, Math.max(0, n)))]);
  return (
    <div className="age-control">
      <p className="popover-title">Youngest child</p>
      <div className="age-stepper" role="group" aria-label="Age of the youngest child">
        <button type="button" className="btn age-step" aria-label="One year younger" disabled={age === null || age <= 0} onClick={() => set((age ?? 1) - 1)}>
          <Icon name="minus" size={16} />
        </button>
        <output className="age-value num" aria-live="polite">
          {age === null ? 'Any' : age === 0 ? 'Baby' : age}
        </output>
        <button type="button" className="btn age-step" aria-label="One year older" disabled={age !== null && age >= MAX_AGE} onClick={() => set(age === null ? 6 : age + 1)}>
          <Icon name="plus" size={16} />
        </button>
      </div>
      <ul className="age-quick" aria-label="Quick ages">
        {QUICK.map((q) => (
          <li key={q.age}>
            <button type="button" className="chip age-chip" aria-pressed={age === q.age} data-on={age === q.age || undefined} onClick={() => set(q.age)}>
              {q.label}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="link-btn age-any" disabled={selected.length === 0} onClick={() => onChange([])}>
        Any age
      </button>
      {note ? <p className="muted age-note">{note}</p> : null}
    </div>
  );
}
