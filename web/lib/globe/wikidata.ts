import { globeWikidata, type WikidataEntity } from '@/lib/client/data';

/** The facts a feature card shows from Wikidata, one row each (spec 4.2, 4.3). Item-valued properties (range, outflow, highest point) are left out: they need a second call. */
export interface FeatureFacts {
  rows: { label: string; value: string }[];
  /** The English label, which can be fuller than the tile's name. */
  label?: string;
  /** The English Wikipedia article, from the `enwiki` sitelink. */
  wikipedia?: string;
  where?: string;
}

type Claim = { mainsnak?: { datavalue?: { value?: unknown } } };
const first = (e: WikidataEntity, p: string): unknown => (e.claims?.[p] as Claim[] | undefined)?.[0]?.mainsnak?.datavalue?.value;
const amount = (v: unknown): number | null => {
  const a = (v as { amount?: string } | undefined)?.amount;
  const n = a === undefined ? NaN : Number(a);
  return Number.isFinite(n) ? n : null;
};
/** The unit item of a quantity, as its Q id, to tell square kilometres from hectares and kilometres from metres. */
const unitOf = (v: unknown): string => String((v as { unit?: string } | undefined)?.unit ?? '').replace(/^.*\//, '');

const nf = (n: number, digits = 0): string => n.toLocaleString('en-US', { maximumFractionDigits: digits });

/** Rows for a class of feature from one entity. Pure, so it is tested without the network. */
export function factRows(e: WikidataEntity, cls: string): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const pop = amount(first(e, 'P1082'));
  const area = first(e, 'P2046');
  const ele = amount(first(e, 'P2044'));
  const prom = amount(first(e, 'P2660'));
  const depth = amount(first(e, 'P4511'));
  const len = first(e, 'P2043');
  const sqkm = (() => { const a = amount(area); if (a === null) return null; const u = unitOf(area); return u === 'Q712226' ? a : u === 'Q35852' ? a / 100 : u === 'Q25343' ? a / 1e6 : u === 'Q232291' ? a * 2.58999 : null; })();
  const km = (() => { const a = amount(len); if (a === null) return null; const u = unitOf(len); return u === 'Q828224' ? a : u === 'Q11573' ? a / 1000 : u === 'Q253276' ? a * 1.609344 : null; })();
  if (cls === 'peak') {
    if (ele !== null) rows.push({ label: 'Elevation', value: `${nf(ele)} m` });
    if (prom !== null) rows.push({ label: 'Prominence', value: `${nf(prom)} m` });
  } else if (cls === 'river') {
    if (km !== null) rows.push({ label: 'Length', value: `${nf(km)} km` });
  } else if (cls === 'lake') {
    if (sqkm !== null) rows.push({ label: 'Area', value: `${nf(sqkm, sqkm < 10 ? 1 : 0)} km²` });
    if (ele !== null) rows.push({ label: 'Elevation', value: `${nf(ele)} m` });
    if (depth !== null) rows.push({ label: 'Max depth', value: `${nf(depth)} m` });
  } else if (cls === 'sea') {
    if (sqkm !== null) rows.push({ label: 'Area', value: `${nf(sqkm)} km²` });
  } else if (cls === 'park') {
    if (sqkm !== null) rows.push({ label: 'Area', value: `${nf(sqkm)} km²` });
  } else {
    if (pop !== null) rows.push({ label: 'Population', value: nf(pop) });
    if (ele !== null) rows.push({ label: 'Elevation', value: `${nf(ele)} m` });
  }
  return rows;
}

export const featureClass = (sourceLayer: string, kind: string): string =>
  sourceLayer === 'waterway' ? 'river' : sourceLayer === 'mountain_peak' ? 'peak' : sourceLayer === 'park' ? 'park' : sourceLayer === 'place' ? 'city' : /lake|reservoir|pond/.test(kind) ? 'lake' : 'sea';

export const CACHE_DAYS = 30;
export const TIMEOUT_MS = 1500;
const KEY = (qid: string) => `travel:v1:wd:${qid}`;

interface Cached { t: number; facts: FeatureFacts }

/**
 * Facts for a feature from Wikidata, after its card opens: one `wbgetentities` call (through the data module), cached 30 days in
 * localStorage, 1,500 ms timeout. Null on any failure: the card then shows no rows, not "unknown".
 */
export async function loadFeatureFacts(qid: string | null, cls: string, now = Date.now()): Promise<FeatureFacts | null> {
  if (!qid || !/^Q\d+$/.test(qid)) return null;
  try {
    const hit = JSON.parse(localStorage.getItem(KEY(qid)) ?? 'null') as Cached | null;
    if (hit && now - hit.t < CACHE_DAYS * 86_400_000) return hit.facts;
  } catch { /* storage unavailable or junk */ }
  const ctl = new AbortController();
  const timer = window.setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const e = await globeWikidata(qid, ctl.signal);
    if (!e) return null;
    const facts: FeatureFacts = { rows: factRows(e, cls), label: e.labels?.en?.value, wikipedia: e.sitelinks?.enwiki?.title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(e.sitelinks.enwiki.title.replace(/ /g, '_'))}` : undefined };
    try { localStorage.setItem(KEY(qid), JSON.stringify({ t: now, facts } satisfies Cached)); } catch { /* full or private */ }
    return facts;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}
