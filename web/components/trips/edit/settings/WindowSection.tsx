'use client';

import { Field } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { PlanOp } from '@/lib/trip-edit/model';
import { newOpId } from '@/lib/trip-edit/stopOps';

export interface WindowChoice {
  id: string;
  label: string;
}

interface Props {
  windows: readonly WindowChoice[];
  current: string | null;
  run: (ops: PlanOp[], label: string) => boolean;
}

/** The best-time window the copy is planned for (OVR-1); only drawn for a trip that has windows. Empty is the window our plan was written for. */
export function WindowSection({ windows, current, run }: Props) {
  return (
    <Field label="When to go" help="Which of our researched windows this copy is planned for.">
      {(c) => (
        <Select
          {...c}
          value={current ?? ''}
          onChange={(e) => {
            const id = e.target.value || null;
            run([{ kind: 'setWindow', id: newOpId(), window: id }], id ? `Planned for ${windows.find((w) => w.id === id)?.label ?? 'that window'}` : 'Planned for the window our plan was written for');
          }}
        >
          <option value="">The window our plan was written for</option>
          {windows.map((w) => (
            <option key={w.id} value={w.id}>{w.label}</option>
          ))}
        </Select>
      )}
    </Field>
  );
}
