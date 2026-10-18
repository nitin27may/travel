import { normalize, similarity, trigrams } from './normalize';
import type { SearchGroupId, SearchHit, SearchRecord, SearchResult } from './types';

interface Prepared {
  record: SearchRecord;
  name: string;
  nameWords: string[];
  nameGrams: Set<string>[];
  extra: string;
  extraWords: string[];
}

const GROUPS: { id: SearchGroupId; k: SearchRecord['k']; label: string; limit: number }[] = [
  { id: 'trips', k: 'trip', label: 'Trips', limit: 6 },
  { id: 'places', k: 'place', label: 'Places', limit: 8 },
  { id: 'areas', k: 'area', label: 'Areas', limit: 5 },
];

/** Below this a fuzzy (typo) match is noise. */
const FUZZY_MIN = 0.42;

const prepare = (record: SearchRecord): Prepared => {
  const name = normalize(record.n);
  const nameWords = name.split(' ').filter(Boolean);
  const extra = normalize(record.x);
  return { record, name, nameWords, nameGrams: nameWords.map(trigrams), extra, extraWords: extra.split(' ').filter(Boolean) };
};

/** Points one query word earns against one record; 0 means the word matches nothing. */
function tokenScore(p: Prepared, tok: string, tokGrams: Set<string> | null): number {
  if (p.name.startsWith(tok)) return 100;
  if (p.nameWords.some((w) => w.startsWith(tok))) return 80;
  if (p.extraWords.some((w) => w.startsWith(tok))) return 45;
  if (tok.length >= 3 && p.name.includes(tok)) return 50;
  if (tok.length >= 3 && p.extra.includes(tok)) return 25;
  if (tokGrams && tok.length >= 4) {
    let best = 0;
    for (const g of p.nameGrams) best = Math.max(best, similarity(tokGrams, g));
    if (best >= FUZZY_MIN) return 20 + 30 * best;
  }
  return 0;
}

export interface Searcher {
  search(query: string): SearchResult;
  size: number;
}

/**
 * Prefix plus trigram scoring (tech.md "Predictive search"). Every word of the query must match somewhere in
 * the record; names weigh more than the area and kind text; a typo of four letters or more falls back to
 * trigram similarity. Results are grouped Trips, Places, Areas with the full counts.
 */
export function createSearcher(records: readonly SearchRecord[]): Searcher {
  const all = records.map(prepare);
  return {
    size: all.length,
    search(query: string): SearchResult {
      const q = normalize(query);
      const toks = q.split(' ').filter(Boolean);
      const hits = new Map<SearchRecord['k'], SearchHit[]>([['trip', []], ['place', []], ['area', []]]);
      if (toks.length) {
        const grams = toks.map((t) => (t.length >= 4 ? trigrams(t) : null));
        for (const p of all) {
          let total = 0;
          let ok = true;
          for (let i = 0; i < toks.length; i++) {
            const s = tokenScore(p, toks[i], grams[i]);
            if (!s) { ok = false; break; }
            total += s;
          }
          if (ok) hits.get(p.record.k)!.push({ record: p.record, score: total });
        }
      }
      const groups = GROUPS.map((g) => {
        const list = hits.get(g.k)!;
        list.sort((a, b) => b.score - a.score || a.record.n.localeCompare(b.record.n));
        return { id: g.id, label: g.label, total: list.length, hits: list.slice(0, g.limit) };
      });
      return {
        query: q,
        counts: { trips: groups[0].total, places: groups[1].total, areas: groups[2].total },
        groups: groups.filter((g) => g.total > 0),
      };
    },
  };
}

/** "3 trips, 12 places, 2 areas", or "No results", for the polite live region. */
export function describeCounts(r: SearchResult): string {
  const parts = ([['trip', r.counts.trips], ['place', r.counts.places], ['area', r.counts.areas]] as const)
    .filter(([, n]) => n > 0)
    .map(([w, n]) => `${n} ${w}${n === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : 'No results';
}
