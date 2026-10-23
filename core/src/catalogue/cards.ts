// Card search ordering (D-E7, store.ts A28), written once: the store-independent half of the rule. A source scores the candidate rows
// (JsonSource.cards: BM25 over the card text of the query's country scope); the order, the cap and the counts are decided here, so
// JsonStore, StubStore and SupabaseStore cannot order the same scores two ways.
import type { CardHits, PlaceRow } from "../schema/api/index.ts";
import { compareCodePoints, sortKey } from "./sortKey.ts";

export interface CardScored {
  row: PlaceRow;
  score: number;
}

/** A score rounded to six decimals, so a SQL sum and a JavaScript sum that differ in the last bits order rows the same way. */
export const roundScore = (s: number): number => Math.round(s * 1e6) / 1e6;

/** Best first: score (rounded), then sortKey(name), then ref, in code-point order (A15). At most `limit` rows; `total` counts every match. */
export function cardHitsOf(scored: readonly CardScored[], terms: readonly string[], limit: number): CardHits {
  const sorted = scored
    .map((h) => ({ row: h.row, score: roundScore(h.score), name: sortKey(h.row.name) }))
    .sort((a, b) => b.score - a.score || compareCodePoints(a.name, b.name) || compareCodePoints(a.row.ref, b.row.ref));
  const items = sorted.slice(0, limit).map((h) => h.row);
  return { items, total: sorted.length, truncated: sorted.length > items.length, terms: [...terms] };
}
