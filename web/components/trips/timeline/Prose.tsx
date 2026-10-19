'use client';

import { useMemo } from 'react';
import { usePrefs } from '@/lib/format/prefs';
import { formatDistance, formatElevation, formatTemperature, type Prefs } from '@/lib/format/units';
import { quantityRuns, type ProseRun } from '@/lib/public/quantities';

type Qty = Extract<ProseRun, { qty: number }>;

const one = (v: number, r: Qty, prefs: Prefs): string => {
  if (r.dim === 'temperature') return formatTemperature(v, prefs.temperature);
  if (r.dim === 'elevation') return formatElevation(v, prefs.elevation);
  // a short distance carried as km (30 m): shown in the elevation unit, whole numbers
  if (r.decimals === 3) return prefs.elevation === 'ft' ? `${Math.round(v * 3280.84)} ft` : `${Math.round(v * 1000)} m`;
  return prefs.distance === 'km' && Number.isInteger(v) && r.decimals === 0 ? `${v} km` : formatDistance(v, prefs.distance);
};

/** One quantity in the visitor's units. A range shares its unit: "10-12 km". */
export function qtyText(r: Qty, prefs: Prefs): string {
  const a = one(r.qty, r, prefs);
  if (r.to === undefined) return a;
  const b = one(r.to, r, prefs);
  const unit = / [^\d\s]+$/.exec(b)?.[0] ?? '';
  return `${a.endsWith(unit) ? a.slice(0, -unit.length) : a}-${b}`;
}

/** Note text with its quantities in the unit preference, so a note and the item line beside it agree (spec 5.2). */
export function Prose({ text, className }: { text: string; className?: string }) {
  const [prefs] = usePrefs();
  const runs = useMemo(() => quantityRuns(text), [text]);
  return <span className={className}>{runs.map((r, i) => ('text' in r ? r.text : <span key={i}>{qtyText(r, prefs)}</span>))}</span>;
}
