// Autosave (FLOW 6, TF13): every change writes the screen state, and once there is a pick it also writes the document to the device list,
// so the draft is in the list from its first pick. Pure over store.ts; the component calls it after a short pause.
import type { PlanIdentity } from '@travel/core/schema/plan-draft.ts';
import { draftOf, nextIdentity } from './draft';
import type { FlowState } from './flow';
import { readDrafts, saveDraft, writeFlow, type SaveResult } from './store';

export function persistFlow(flow: FlowState): SaveResult | null {
  writeFlow(flow);
  if (!flow.picks.length) return null;
  const list = readDrafts();
  const mine = list.drafts.find((d) => d.id === flow.id);
  const identity: PlanIdentity = mine?.identity ?? nextIdentity(list.drafts.map((d) => d.identity));
  const doc = draftOf(flow, identity, null);
  if (!doc) return null;
  // a document that was already built keeps its build until the person builds again
  return saveDraft(mine?.lastBuild ? { ...doc, lastBuild: mine.lastBuild } : doc);
}
