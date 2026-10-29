// The one hand-off from the builder to the trip details page (Step 2 ruling R2; STEP2-B1). Build my days calls `handOffBuilt` and
// navigates to the address it returns; nothing else of the builder knows how the details page opens a built trip.
//
// CONTRACT (STEP2-B1 owns the page side):
//   in:  a built-mode `plan-draft/1` with `lastBuild` set (`outputsOf` of the build answer), `party: "trip"` with `travellers` (the party the build used, RB-004), an `id` that is a UUID v4
//        and an `identity` colour. The picks matrix is not part of it.
//   does: adds the document to the device list `plan-drafts/1` under the local key of keys.ts, newest first, replacing a document
//        of the same id; fires `travel:plans-changed` and the trip page's `travel:trip-doc-changed`; clears the builder's screen state.
//   out: `/t/<id>/?edit=1&built=1`. The page opens in edit mode on Days with the just-built line and removes `built=1` after its first
//        paint (README ruling C6). The caller navigates with `router.replace`, so Back leaves the builder (FLOW L9).
//   throws: `HandOffError` when the list cannot take the document: `cap` (the device list is full), `full`, `blocked`, `newer`, `toolarge`, or `unbuilt` (no `lastBuild`).
//   until B1 lands, the address answers the page's not-found state; that is expected.
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { DOC_CHANGED_EVENT, tripHref } from '@/lib/trip-edit/keys';
import { CHANGED_EVENT } from '@/lib/mine/keys';
import { clearFlow, saveDraft, type SaveFailure } from './store';

export type HandOffReason = SaveFailure | 'unbuilt';

export class HandOffError extends Error {
  constructor(readonly reason: HandOffReason) {
    super(`hand-off: ${reason}`);
    this.name = 'HandOffError';
  }
}

/** The address of a just-built trip. */
export const builtHref = (id: string): string => tripHref(id, 'edit=1&built=1');

export function handOffBuilt(draft: PlanDraft): string {
  if (!draft.lastBuild) throw new HandOffError('unbuilt');
  const r = saveDraft(draft);
  if (!r.ok) throw new HandOffError(r.reason);
  clearFlow();
  try {
    window.dispatchEvent(new Event(DOC_CHANGED_EVENT));
    window.dispatchEvent(new Event(CHANGED_EVENT));
  } catch {
    /* no window */
  }
  return builtHref(draft.id);
}
