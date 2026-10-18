// draw_suggested for one record, with the parent area's fame. One function for derive and for the validator's
// W_REL_DRAW_GAP, so the two cannot disagree (the parent QID is in the designation, lane brief 8.2).
import type { DrawTier, RelevanceRecord } from "../schema/relevance.ts";
import { THRESHOLDS, drawSuggested } from "./fit.ts";
import type { Thresholds } from "./fit.ts";

export interface Sig { languages: number | null; views: number | null }

export function suggestFor(r: RelevanceRecord, signals: Record<string, Sig>, th: Thresholds = THRESHOLDS): DrawTier {
  const qid = r.wikidata.state === "value" ? r.wikidata.v : null;
  const sig = (qid && signals[qid]) || { languages: null, views: null };
  const designations = r.signals.designations.state === "value" ? (r.signals.designations.v ?? []) : [];
  const editorial = r.signals.editorial.state === "value" ? (r.signals.editorial.v ?? []) : [];
  const parentQid = designations.find((d) => d.scope === "parent" && d.wikidata)?.wikidata ?? null;
  const ps = parentQid ? signals[parentQid] : undefined;
  const parentFame = ps ? drawSuggested({ ...ps, designations: [], editorial: [] }, th) : null;
  return drawSuggested({ ...sig, designations, editorial, parentFame }, th);
}
