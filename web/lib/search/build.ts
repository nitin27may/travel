import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { travelRoot } from '@/lib/data/root';
import { zoomForRank } from '@/lib/globe/search';
import { globeIndex, listPlaces, listTrips } from '@/lib/public';
import type { GlobeNode } from '@/lib/public';
import type { SearchManifest, SearchPartRef, SearchRecord } from './types';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** A record and the country it belongs to (lower-case ISO alpha-2, or `xx` when a trip has none). */
interface Located {
  cc: string;
  record: SearchRecord;
}

function areaRecords(node: GlobeNode, path: string[], parents: string[], out: Located[]): void {
  const here = [...path, node.slug];
  const counts = [node.trips ? plural(node.trips, 'trip') : '', node.places ? plural(node.places, 'place') : ''].filter(Boolean).join(' · ');
  const level = here.length === 1 ? 'Country' : here.length === 2 ? 'State or region' : 'District';
  out.push({
    cc: here[0],
    record: {
      k: 'area',
      h: `/globe/${here.join('/')}/`,
      n: node.name,
      s: [parents.length ? parents.join(', ') : level, counts].filter(Boolean).join(' · '),
      x: parents.join(' '),
    },
  });
  for (const c of node.children) areaRecords(c, here, [node.name, ...parents], out);
}

const FEATURE_LABEL: Record<string, string> = { ocean: 'Ocean', sea: 'Sea', bay: 'Bay', gulf: 'Gulf', strait: 'Strait', channel: 'Channel' };

/**
 * Seas, oceans, ranges and other landforms from the globe's gazetteer, so "alps", "atlantic" and "mediterranean" find
 * something. Public geographic data: a name, a kind and a camera on the globe (`/globe/?c=lng,lat,zoom`). One part
 * (`area-sea` and `area-land`), so they load with the other area parts and a country page never needs them.
 */
function featureRecords(): Located[] {
  const file = path.join(travelRoot(), 'legacy', 'globe', 'assets', 'data', 'gazetteer.json');
  if (!existsSync(file)) return [];
  const rows = JSON.parse(readFileSync(file, 'utf8')) as [string, string, number, number, string | null, string | null, number?][];
  const out: Located[] = [];
  for (const [kind, name, lng, lat, , extra, rank] of rows) {
    // the notable ones only: oceans, seas and the ranks of landform that a visitor would name (the rest stay on the globe's own search)
    if ((kind !== 'physical' && kind !== 'marine') || (rank ?? 9) > (kind === 'marine' ? 4 : 3)) continue;
    const label = kind === 'marine' ? (FEATURE_LABEL[String(extra).toLowerCase()] ?? 'Sea or ocean') : /range|mtn/i.test(String(extra)) ? 'Mountain range' : 'Landform';
    out.push({ cc: kind === 'marine' ? 'sea' : 'land', record: { k: 'area', h: `/globe/?c=${lng.toFixed(2)},${lat.toFixed(2)},${zoomForRank(rank ?? 5).toFixed(1)}`, n: name, s: label, x: '' } });
  }
  return out;
}

/**
 * Every searchable thing, with its country. From the public adapter only: listed trips, every place, and the
 * globe's areas. Private trips are never in listTrips(), so they cannot reach the index (README 2.3).
 *
 * Principle P8: the index carries names and areas only. A record has the display name, one line of kind and
 * area (or a length for a trip), and match text made of the kind and the area chain. No tags, summaries, facts,
 * links or notes.
 */
function locatedRecords(): Located[] {
  const g = globeIndex();
  const tripCountry = new Map(g.pins.filter((p) => p.kind === 'trip').map((p) => [p.slug, p.path[0] ?? 'xx'] as const));
  const out: Located[] = [];
  for (const t of listTrips()) {
    out.push({
      cc: tripCountry.get(t.slug) ?? 'xx',
      record: {
        k: 'trip',
        h: `/trips/${t.slug}/`,
        n: t.title,
        s: [t.region, t.daysCount ? plural(t.daysCount, 'day') : ''].filter(Boolean).join(' · '),
        x: [t.region, t.firstBase ?? ''].join(' '),
      },
    });
  }
  for (const p of listPlaces()) {
    out.push({
      cc: p.areaChain[0]?.slug ?? 'xx',
      record: {
        k: 'place',
        h: `/places/${p.slug}/`,
        n: p.name,
        s: [p.kindLabel, p.areaLabel].filter(Boolean).join(' · '),
        x: [p.kindLabel, p.kind, p.subkind ?? '', ...p.areaChain.map((a) => a.name)].join(' '),
        kind: p.kind,
      },
    });
  }
  for (const c of g.continents) for (const country of c.countries) areaRecords(country, [], [], out);
  out.push(...featureRecords());
  return out;
}

/** The whole index as one list. Tests and the splitter use it; the site never serves it as one file (P8, backlog 2.20). */
export function buildSearchIndex(): SearchRecord[] {
  return locatedRecords().map((l) => l.record);
}

export const partId = (k: SearchRecord['k'], cc: string): string => `${k}-${cc}`;

export interface SearchParts {
  manifest: SearchManifest;
  parts: Record<string, SearchRecord[]>;
}

const KIND_ORDER: Record<SearchRecord['k'], number> = { trip: 0, area: 1, place: 2 };

/**
 * The index split by kind and country, one part per pair. The manifest lists the parts with their sizes so a client
 * can load only what it needs (a country page loads that country), and the full-site search loads them all, trips and
 * areas first because they are small. A server search later replaces this module without changing the callers.
 */
export function buildSearchParts(): SearchParts {
  const parts: Record<string, SearchRecord[]> = {};
  const refs = new Map<string, SearchPartRef>();
  for (const { cc, record } of locatedRecords()) {
    const id = partId(record.k, cc);
    (parts[id] ??= []).push(record);
    refs.set(id, { id, k: record.k, cc, n: parts[id].length });
  }
  const list = [...refs.values()].sort((a, b) => KIND_ORDER[a.k] - KIND_ORDER[b.k] || a.cc.localeCompare(b.cc));
  return { manifest: { v: 1, parts: list }, parts };
}
