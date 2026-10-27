'use client';

import { useEffect, useId, useRef } from 'react';
import { CHILD_MAX_AGE, PARTY_MAX_ADULTS, PARTY_MAX_CHILDREN, PARTY_MIN_ADULTS, type Party } from '@travel/core/trips/party.ts';
import { Select } from '@/components/ui/Select';
import { Stepper } from '@/components/ui/Stepper';

const AGES = Array.from({ length: CHILD_MAX_AGE + 1 }, (_, i) => i);

/**
 * Who is going (copy sheet, spec trip-and-places-ux-fixes.md 5.4, review UXB-2 M2): adults 1 to 12 and children 0 to 8 with the shared Stepper,
 * and one native age select per child ("Under 1" for 0). The same limits as the party editor on the page, so a party set there copies as set.
 * Adding a child moves focus to its select. Controlled: the sheet owns the party.
 */
export function Travellers({ party, onChange }: { party: Party; onChange: (p: Party) => void }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const focus = useRef<number | null>(null);
  const setChildren = (n: number) => {
    const children = party.children.slice(0, n);
    while (children.length < n) children.push(null);
    if (n > party.children.length) focus.current = n - 1;
    onChange({ ...party, children });
  };
  useEffect(() => {
    const i = focus.current;
    if (i === null) return;
    focus.current = null;
    box.current?.querySelector<HTMLSelectElement>(`select[data-child="${i}"]`)?.focus();
  }, [party.children.length]);
  return (
    <div className="trav-body" ref={box}>
      <Stepper label="Adults" value={party.adults} min={PARTY_MIN_ADULTS} max={PARTY_MAX_ADULTS} decLabel="Fewer adults" incLabel="More adults" onChange={(n) => onChange({ ...party, adults: n })} />
      <Stepper label="Children" value={party.children.length} min={0} max={PARTY_MAX_CHILDREN} decLabel="Fewer children" incLabel="More children" onChange={setChildren} />
      {party.children.map((age, i) => (
        <div className="trav-child" key={i}>
          <label htmlFor={`${id}-age-${i}`}>Child {i + 1} age</label>
          <Select id={`${id}-age-${i}`} data-child={i} value={age === null ? '' : String(age)} onChange={(e) => onChange({ ...party, children: party.children.map((a, j) => (j === i ? (e.target.value === '' ? null : Number(e.target.value)) : a)) })}>
            {age === null ? <option value="">Choose age</option> : null}
            {AGES.map((a) => (
              <option key={a} value={a}>{a === 0 ? 'Under 1' : a}</option>
            ))}
          </Select>
        </div>
      ))}
    </div>
  );
}
