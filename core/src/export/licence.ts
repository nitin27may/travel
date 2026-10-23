import type { Point } from './publicTypes.ts';

/**
 * The export guard. A point may leave the site only when we can show where it came from and the source lets us give it
 * away (kinds README 5; map-stack research, "What we may store"). Anything else is dropped from the file and counted.
 *
 * Allowed `pointSource` prefixes: osm_node, osm_way, osm_relation, official:<url>, wikidata:<QID>, gps:, manual_pin,
 * prototype_approx (our own rough pin, exported with a warning). Everything else is rejected, and anything that looks
 * like Google, Apple or Bing is rejected twice over. A Commons file location (a photo's geotag) is not a place
 * coordinate and is rejected too: its licence is the photo's, not ours to bundle into a track file.
 */

export type Verdict = { ok: true; attribution: string; approximate: boolean } | { ok: false; reason: string };

const OSM = /^osm_(node|way|relation):\d+$/;
const WIKIDATA = /^wikidata:Q\d+$/;
const OFFICIAL = /^official:https?:\/\/\S+$/;
/** A routed leg of a trip (TRP2b): `route:<trip>:<day>:<n>`, a line OpenRouteService drew over OpenStreetMap data. Licensed ODbL, credited with its router. */
const ROUTE = /^route:[a-z0-9-]+:\d+:\d+$/;
const FOREIGN = /google|gmaps|maps\.app|apple|bing|here\.com|tomtom/i;
/** Licences that allow reuse with attribution. "unknown" and anything not on this list is a refusal for official data. */
const OPEN_LICENCE = /^(ODbL|CC0|CC-BY(-SA)?(-\d(\.\d)?)?|OGL.*|Open Government.*|PDDL|own)$/i;

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)';
export const ROUTING_ATTRIBUTION = 'Road routes by OpenRouteService (openrouteservice.org)';

export function checkPoint(p: Pick<Point, 'pointSource' | 'sourceLicence'> | null | undefined): Verdict {
  if (!p) return { ok: false, reason: 'no point' };
  const src = (p.pointSource ?? '').trim();
  const licence = (p.sourceLicence ?? '').trim();
  if (!src) return { ok: false, reason: 'no point_source' };
  if (FOREIGN.test(src) || FOREIGN.test(licence)) return { ok: false, reason: 'third-party map data' };
  if (OSM.test(src)) return licence === 'ODbL' ? { ok: true, attribution: OSM_ATTRIBUTION, approximate: false } : { ok: false, reason: 'OSM point without ODbL licence' };
  if (WIKIDATA.test(src)) return licence === 'CC0' ? { ok: true, attribution: 'Wikidata, CC0 1.0', approximate: false } : { ok: false, reason: 'Wikidata point without CC0 licence' };
  if (OFFICIAL.test(src)) {
    if (!OPEN_LICENCE.test(licence)) return { ok: false, reason: 'official source without an open licence' };
    return { ok: true, attribution: `${src.slice('official:'.length)} (${licence})`, approximate: false };
  }
  if (src === 'manual_pin' || src.startsWith('gps:')) return { ok: true, attribution: 'Pin placed by the trip authors', approximate: false };
  if (src === 'prototype_approx') return { ok: true, attribution: 'Approximate position from the trip authors', approximate: true };
  return { ok: false, reason: `source "${src.split(':')[0]}" is not one of ours` };
}

export const pointExportable = (p: Pick<Point, 'pointSource' | 'sourceLicence'> | null | undefined): boolean => checkPoint(p).ok;

export interface LineLike {
  ref: string;
  exportable: boolean;
  licence: string;
}

/** A line is exported only when LD marked it exportable AND its ref and licence pass on their own. */
export function lineExportable(l: LineLike): boolean {
  if (!l.exportable) return false;
  if (FOREIGN.test(l.ref) || FOREIGN.test(l.licence)) return false;
  if (OSM.test(l.ref) || ROUTE.test(l.ref)) return l.licence === 'ODbL';
  if (/^official:/.test(l.ref)) return OPEN_LICENCE.test(l.licence);
  return false;
}

/**
 * The source line every export carries (principle P8): where the file came from and that it is for the reader's own use.
 * The same sentence in GPX, KML, CSV and the calendar.
 */
export function sourceLine(url: string): string {
  return `Source: Trip Plans, ${url}. For your own use; please do not republish.`;
}

/** The attribution lines a file must carry for the points and lines it holds. */
export function attributionFor(points: Pick<Point, 'pointSource' | 'sourceLicence'>[], lines: LineLike[] = []): string[] {
  const out = new Set<string>();
  for (const p of points) {
    const v = checkPoint(p);
    if (v.ok && !v.approximate) out.add(v.attribution);
  }
  for (const l of lines) {
    if (!lineExportable(l)) continue;
    if (ROUTE.test(l.ref)) {
      out.add(OSM_ATTRIBUTION);
      out.add(ROUTING_ATTRIBUTION);
    } else out.add(OSM.test(l.ref) ? OSM_ATTRIBUTION : `${l.ref} (${l.licence})`);
  }
  return [...out];
}

/** The same sentence in every format for a point that is only roughly placed; null for a surveyed or pinned one. */
export function approxNote(p: Pick<Point, 'pointSource' | 'sourceLicence'>): string | null {
  const v = checkPoint(p);
  return v.ok && v.approximate ? 'Approximate position, not surveyed' : null;
}

/**
 * The notice a file carries for each route line it holds: the licence, where the line came from (the OSM records) and when it was
 * read. `label` is "OpenStreetMap relation 3985745, read 2026-10-19".
 */
export function trackNotice(lines: (LineLike & { label: string })[]): string[] {
  return lines.filter(lineExportable).map((l) => `Route line: ${l.label}. ${OSM.test(l.ref) || ROUTE.test(l.ref) ? 'Data © OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright' : l.licence}.${ROUTE.test(l.ref) ? ` ${ROUTING_ATTRIBUTION}.` : ''}`);
}
