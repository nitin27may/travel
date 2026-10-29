// Apply and Rebuild for a built trip (edit-mode-spec 8, 13.1; STEP2-B2). The staged operations are tried on the document first, the build
// body is made from the result with the kept stops as constraints (lib/trip-edit/built.ts `rebuildInput`), the server engine builds it
// through the one data boundary (DataClient `planBuild`, P9), and the staged operations, the new build and the edits it leaves are saved
// as ONE undo step: Undo puts the previous build and inputs back in one press. A kept stop never moves (built.ts `editsAfterBuild`).
import { DEFAULT_CHILD_AGE } from '@travel/core/trips/party.ts';
import { readParty } from '@/lib/storage/partyKey';
import { buildOps, keptCounts, keptWords, outputsOfAnswer, rebuildInput, type BuildParty } from '@/lib/trip-edit/built';
import { applyOps, type PlanDraft, type PlanOp } from '@/lib/trip-edit/model';
import { rememberMatrix } from '@/lib/trip-edit/reflow';

export type RebuildResult = { ok: true } | { ok: false; message: string };

/** The party a rebuild plans for: the trip's own, else the device's (never sent anywhere but the build body). */
export function partyFor(doc: PlanDraft): BuildParty {
  if (doc.party === 'trip' && doc.travellers) return { adults: doc.travellers.adults, children: [...doc.travellers.children] };
  const p = readParty();
  return p ? { adults: p.adults, children: p.children.map((c) => c ?? DEFAULT_CHILD_AGE) } : { adults: 2, children: [] };
}

/** "Rebuilt 6 days · 3 kept and 2 added by you stayed": the toast, with Undo. */
function doneWords(doc: PlanDraft, days: number): string {
  const c = keptCounts(doc);
  const w = keptWords(c).replace(/ stays?$/, ' stayed').replace(/ stay$/, ' stayed');
  return `Rebuilt ${days} ${days === 1 ? 'day' : 'days'}${w ? ` · ${w}` : ''}`;
}

export async function runRebuild(
  doc: PlanDraft,
  staged: readonly PlanOp[],
  run: (ops: PlanOp[], label: string) => boolean,
  signal?: AbortSignal,
): Promise<RebuildResult> {
  const tried = applyOps(doc, staged);
  if (tried.skipped.length) return { ok: false, message: 'Those settings do not fit together. Nothing was changed.' };
  const next = tried.doc;
  const input = rebuildInput(next, partyFor(doc));
  if (!input) return { ok: false, message: 'Pick at least one place to build the days.' };
  let answer: Awaited<ReturnType<(typeof import('@/lib/client/data'))['planBuild']>>;
  try {
    const data = await import('@/lib/client/data');
    answer = await data.planBuild(input, signal);
  } catch (e) {
    if (signal?.aborted) return { ok: false, message: '' };
    const code = (e as { code?: string } | null)?.code;
    return { ok: false, message: code === 'too_large' ? 'The trip has more places than one build takes. Remove some and try again.' : 'Could not rebuild just now. Nothing was changed. Try again.' };
  }
  if (!answer) return { ok: false, message: 'Rebuilding needs the planner, which this site does not have yet. Nothing was changed.' };
  rememberMatrix(doc.id, answer.matrix);
  const build = outputsOfAnswer(answer);
  const ops = [...staged, ...buildOps(next, build)];
  const days = next.nights === null ? build.days.length : next.nights + 1;
  return run(ops, doneWords(next, days)) ? { ok: true } : { ok: false, message: 'Could not save the new days. Nothing was changed.' };
}
