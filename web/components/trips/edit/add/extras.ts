// A place the document names that the trip's plan model does not carry (STEP2-E3): one the person found by search, took from a park or
// brought from Maybe. The timeline schedules only places it has a candidate for (`TimelineModel.addables`), so these are read once, by
// slug and in one call per hundred (P8), and merged into the model; with the build's API absent they stay out and the day shows without them.
import type { PlanDraft } from '@/lib/trip-edit/model';
import type { AddCandidate, TimelineModel } from '@/components/trips/timeline/model';

const PLACE = 'place/';

/** The places the document adds that the model has no candidate for, and that are not yet read. */
export function missingSlugs(doc: PlanDraft, model: TimelineModel, have: Readonly<Record<string, AddCandidate>>): string[] {
  const out = new Set<string>();
  for (const a of doc.template?.added ?? []) {
    if (!a.ref.startsWith(PLACE)) continue;
    const slug = a.ref.slice(PLACE.length);
    if (!model.addables[slug] && !have[slug]) out.add(slug);
  }
  return [...out].sort();
}

/** The model with these places added: as candidates, and in the list of the day each is added to (the timeline offers only what its day lists). */
export function withExtras(model: TimelineModel, extras: Readonly<Record<string, AddCandidate>>, doc: PlanDraft): TimelineModel {
  const slugs = Object.keys(extras);
  if (!slugs.length) return model;
  const addByDay: Record<number, string[]> = { ...model.addByDay };
  let changed = false;
  for (const a of doc.template?.added ?? []) {
    if (typeof a.day !== 'number' || !a.ref.startsWith(PLACE)) continue;
    const slug = a.ref.slice(PLACE.length);
    if (!extras[slug] || addByDay[a.day]?.includes(slug)) continue;
    addByDay[a.day] = [...(addByDay[a.day] ?? []), slug];
    changed = true;
  }
  const missing = slugs.some((s) => !model.addables[s]);
  if (!changed && !missing) return model;
  return { ...model, addables: { ...extras, ...model.addables }, addByDay };
}

/** The candidates of these slugs, read from the catalogue (lazy: the API reader loads with the first need). */
export async function readExtras(slugs: readonly string[]): Promise<Record<string, AddCandidate>> {
  const [{ rowsOf }, { candidateOf }] = await Promise.all([import('./source'), import('./place')]);
  const rows = (await rowsOf(slugs)) ?? [];
  return Object.fromEntries(rows.map((f) => [f.slug, candidateOf(f, null)]));
}
