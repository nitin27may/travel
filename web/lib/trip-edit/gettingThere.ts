// The getting-there words for the first and last day of a built trip by air (FLOW stage 6, kept by ruling R2; RB-016). What the build holds
// is said plainly (the departure airport the person chose, and the first drive from the airport); what it lacks is said too, with the one way
// to add it. The flight itself is not planned: no flight time is invented. Pure.
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';

export interface GettingThere {
  end: 'in' | 'out';
  label: string;
  text: string;
  /** the build lacks the departure airport; the line offers Settings */
  missing: boolean;
}

const dur = (min: number): string => {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m / 60} h`;
};
const title = (id: string): string => id.replace(/(^|-)([a-z])/g, (_m, sep: string, c: string) => `${sep ? ' ' : ''}${c.toUpperCase()}`);

/** Where the person flies from, in words: the airport code, or the city. */
function fromWords(d: Pick<PlanDraft, 'origin'>): string | null {
  const o = d.origin;
  if (!o) return null;
  if (o.kind === 'airport') return o.iata;
  return title(o.id.split('-').slice(-1)[0] ?? o.id);
}

export function gettingThere(d: Pick<PlanDraft, 'template' | 'where' | 'nights' | 'origin' | 'lastBuild'>, day: number): GettingThere | null {
  if (d.template || d.where.mode !== 'trip' || !d.lastBuild) return null;
  const days = d.lastBuild.days;
  const last = Math.max(days.length, (d.nights ?? 0) + 1);
  const from = fromWords(d);
  if (day === 1) {
    if (!from) return { end: 'in', label: 'Getting there', missing: true, text: 'No departure airport is chosen, so the flight and the drive from the airport are not planned.' };
    const first = days.find((x) => x.day === 1)?.items[0];
    const drive = first && first.driveMin ? ` Then ${dur(first.driveMin)}${first.basis === 'routed' ? '' : ' ≈'} by hire car to ${first.name}.` : '';
    return { end: 'in', label: 'Getting there', missing: false, text: `Fly from ${from} to the area. Day 1 starts when you land.${drive}` };
  }
  if (day === last) {
    if (!from) return { end: 'out', label: 'Getting home', missing: true, text: 'No departure airport is chosen, so the flight home is not planned.' };
    const prev = days.find((x) => x.day === day - 1)?.base ?? days.find((x) => x.day === day)?.base ?? null;
    const base = prev ? (d.lastBuild.bases.find((b) => b.town === prev)?.name ?? null) : null;
    return { end: 'out', label: 'Getting home', missing: false, text: `Fly home to ${from}. Leave ${base ?? 'your base'} in time for the airport; the flight time is yours to set.` };
  }
  return null;
}
