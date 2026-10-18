import type { AccessPoint, Fact, LinkGroup, LinkNone, PublicPlace } from '@/lib/public/types';
import type { LngLat } from '@/lib/map/types';

/* ---------- text helpers ---------- */

const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*';
// "6 Jun - 18 Oct 2026", "14 Jun - 11 Oct 2026" or "18 Oct 2026": a dated operator fact
const DATED = new RegExp(`\\s*\\b\\d{1,2}\\s+${MONTH}\\.?(?:\\s*(?:-|\\u2013|to)\\s*\\d{1,2}\\s+${MONTH}\\.?)?,?\\s+(20\\d\\d)\\b`, 'g');

/**
 * Operator dates are for one season. The public page says "observed 2026" instead of a calendar date, so it never
 * reads as a promise for another year (README 2.3 and the dateless rule).
 */
export function observed(text: string): string {
  return text.replace(DATED, (match, year: string, offset: number, whole: string) => {
    const before = whole.slice(0, offset).trimEnd();
    const lead = before && !/[(,;:]$/.test(before) ? ', ' : before ? ' ' : '';
    return `${lead}observed ${year}`;
  });
}

export type TextPart = { text: string; tel?: string };
const PHONE = /\+\d{1,3}(?:[ .\-/]?\(?\d{1,5}\)?){2,5}/g;

/** Splits text around international phone numbers so each can be a tel: link (public business numbers only). */
export function phoneParts(text: string): TextPart[] {
  const out: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(PHONE)) {
    const raw = m[0].trimEnd();
    const digits = raw.replace(/[^\d+]/g, '');
    if (digits.replace(/\D/g, '').length < 8) continue;
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at) });
    out.push({ text: raw, tel: digits });
    last = at + raw.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text }];
}

export const isUrl = (s: string): boolean => /^https?:\/\/\S+$/.test(s.trim());

/** The first number in a fact value: "450 m" -> 450, "3.5-4.5 h" -> 3.5. */
export function firstNumber(value: string | undefined): number | null {
  const m = /-?\d+(?:[.,]\d+)?/.exec(value ?? '');
  return m ? Number(m[0].replace(',', '.')) : null;
}

/* ---------- facts ---------- */

export const factByLabel = (facts: readonly Fact[], ...labels: string[]): Fact | undefined => {
  const want = labels.map((l) => l.toLowerCase());
  return facts.find((f) => want.includes(f.label.toLowerCase()));
};

export interface GlanceSlot {
  /** The label shown. */
  label: string;
  /** The fact, or null when nothing is recorded: the slot then says so in words. */
  fact: Fact | null;
  /** "No hours recorded yet" */
  empty: string;
}

interface Expect {
  label: string;
  from: string[];
  empty: string;
}

const E = (label: string, from: string[], empty: string): Expect => ({ label, from, empty });

/** Which facts each kind leads with (patterns 3.6). A missing fact shows the honest empty line, never a blank. */
const EXPECT: Record<string, Expect[]> = {
  trail: [E('Distance', ['Distance'], 'No distance recorded yet'), E('Climb', ['Climb', 'Descent'], 'No climb recorded yet'), E('Time', ['Time'], 'No time recorded yet'), E('Difficulty', ['Difficulty'], 'No difficulty recorded yet'), E('Shape', ['Shape'], 'No route shape recorded yet'), E('Minimum age', ['Minimum age', 'Kids'], 'No minimum age recorded yet')],
  lake: [E('Swimming', ['Swim', 'Swimming'], 'No swim information recorded yet'), E('Boats', ['Boat rental', 'Boats'], 'No boat rental recorded yet'), E('Parking', ['Parking', 'Lot'], 'No parking recorded yet'), E('Fee', ['Fee'], 'No fee recorded yet'), E('Lake loop', ['Lake loop', 'Distance'], 'No loop recorded yet'), E('Best time of day', ['Best time of day'], 'No best time of day recorded yet')],
  viewpoint: [E('Light', ['Best time of day', 'Light'], 'No best light recorded yet'), E('Walk from the car', ['Walk from the car', 'Time', 'Distance'], 'No walk from the car recorded yet'), E('Parking', ['Lot', 'Parking'], 'No parking recorded yet'), E('Fee', ['Fee'], 'No fee recorded yet'), E('Lift', ['Lift'], 'No lift recorded yet'), E('Exposure', ['Exposure'], 'No exposure recorded yet')],
  waterfall: [E('Walk', ['Time', 'Distance'], 'No walk recorded yet'), E('Parking', ['Lot', 'Parking'], 'No parking recorded yet'), E('Fee', ['Fee'], 'No fee recorded yet'), E('Season', ['Season'], 'No season recorded yet'), E('Difficulty', ['Difficulty'], 'No difficulty recorded yet'), E('Minimum age', ['Minimum age'], 'No minimum age recorded yet')],
  sight: [E('Hours', ['Hours', 'Opening hours'], 'No hours recorded yet'), E('Last entry', ['Last entry'], 'No last entry recorded yet'), E('Ticket', ['Ticket', 'Price', 'Fee'], 'No ticket price recorded yet'), E('Parking', ['Lot', 'Parking'], 'No parking recorded yet'), E('Season', ['Season'], 'No season recorded yet'), E('Minimum age', ['Minimum age'], 'No minimum age recorded yet')],
  stay: [E('Check-in', ['Check-in'], 'No check-in time recorded yet'), E('Cancellation', ['Cancellation'], 'No cancellation rule recorded yet'), E('Price', ['Price', 'Fee'], 'No price recorded yet'), E('Parking', ['Parking', 'Lot'], 'No parking recorded yet'), E('Season', ['Season'], 'No season recorded yet'), E('Booking', ['Booking page', 'Opens'], 'No booking window recorded yet')],
  activity: [E('Ages', ['Minimum age', 'Ages'], 'No age limit recorded yet'), E('Duration', ['Duration', 'Time'], 'No duration recorded yet'), E('Price', ['Price', 'Fee'], 'No price recorded yet'), E('Booking window', ['Opens', 'Booking page', 'Booking window'], 'No booking window recorded yet'), E('Season', ['Season'], 'No season recorded yet'), E('Parking', ['Lot', 'Parking'], 'No parking recorded yet')],
  lift: [E('Season', ['Season'], 'No season recorded yet'), E('Ticket', ['Fee', 'Price'], 'No ticket price recorded yet'), E('Time', ['Time'], 'No ride time recorded yet'), E('Parking', ['Lot', 'Parking'], 'No parking recorded yet'), E('Minimum age', ['Minimum age'], 'No minimum age recorded yet'), E('Difficulty', ['Difficulty'], 'No difficulty recorded yet')],
  eatery: [E('Hours', ['Hours', 'Opening hours'], 'No hours recorded yet'), E('What', ['What'], 'No menu recorded yet'), E('Season', ['Season'], 'No season recorded yet'), E('Time', ['Time'], 'No walking time recorded yet'), E('Booking', ['Booking page', 'Opens'], 'No booking recorded yet'), E('Phone', ['Phone'], 'No phone recorded yet')],
  town: [E('Parking', ['Parking', 'Lot'], 'No parking recorded yet'), E('Season', ['Season'], 'No season recorded yet'), E('Getting there', ['Shuttle'], 'No transport recorded yet'), E('Fee', ['Fee'], 'No fee recorded yet')],
  area: [E('Season', ['Season'], 'No season recorded yet'), E('Parking', ['Parking', 'Lot'], 'No parking recorded yet'), E('Fee', ['Fee', 'Price'], 'No entry fee recorded yet')],
};

export function glanceFor(place: Pick<PublicPlace, 'kind' | 'facts'>): GlanceSlot[] {
  const plan = EXPECT[place.kind] ?? EXPECT.area;
  const slots = plan.map((e) => ({ label: e.label, fact: factByLabel(place.facts, ...e.from) ?? null, empty: e.empty }));
  // the six that carry a fact come first, in the kind's order; a kind with fewer than six facts keeps its honest empty lines
  const found = slots.filter((s) => s.fact);
  const missing = slots.filter((s) => !s.fact);
  return [...found, ...missing].slice(0, 6);
}

/** Hut and refuge facts for the route section's list under the profile. */
export function hutFacts(facts: readonly Fact[]): Fact[] {
  return facts.filter((f) => /^rifugio\b|^hut\b|huts?\b/i.test(f.label));
}

/** Facts not already shown in the glance strip, the access cards or the huts: the "Facts and sources" list. */
const ACCESS_LABELS = new Set(['lot', 'fee', 'capacity', 'fills by', 'shuttle', 'what', 'opens', 'booking page', 'parking']);
export function accessFacts(facts: readonly Fact[]): Fact[] {
  return facts.filter((f) => ACCESS_LABELS.has(f.label.toLowerCase()));
}

/* ---------- elevation profile ---------- */

export interface ProfileInput {
  km: number;
  gainM: number;
  startM: number;
  loop: boolean;
  highM: number | null;
}
export interface ProfilePoint {
  km: number;
  m: number;
}

/**
 * A sketch shaped by the published distance, climb and route shape. It is not a surveyed track, and the page says so.
 * Deterministic, so the static page and the client draw the same line.
 */
export function sampleProfile(i: ProfileInput, n = 48): ProfilePoint[] {
  const amp = i.loop ? i.gainM * 0.4 : i.gainM;
  const pts: ProfilePoint[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const shape = Math.sin(Math.PI * t) ** (i.loop ? 1.3 : 1.1);
    const wiggle = (Math.sin(t * 19) * i.gainM * 0.05 + Math.sin(t * 7.3) * i.gainM * 0.04) * 0.5 * Math.sin(Math.PI * t);
    pts.push({ km: i.km * t, m: i.startM + amp * shape + wiggle });
  }
  return pts;
}

export function profileSummary(pts: readonly ProfilePoint[]): string {
  if (!pts.length) return '';
  const top = pts.reduce((a, b) => (b.m > a.m ? b : a));
  const end = pts[pts.length - 1];
  const climb = Math.round(top.m - pts[0].m);
  return `${end.km.toFixed(1).replace(/\.0$/, '')} km, ${climb} m climb, high point ${Math.round(top.m).toLocaleString('en-CA')} m at ${top.km.toFixed(1)} km`;
}

/** Elevation at a distance along the sketch, by linear interpolation. */
export function elevationAt(pts: readonly ProfilePoint[], km: number): number {
  if (!pts.length) return 0;
  if (km <= pts[0].km) return pts[0].m;
  const end = pts[pts.length - 1];
  if (km >= end.km) return end.m;
  const i = pts.findIndex((p) => p.km >= km);
  const a = pts[i - 1];
  const b = pts[i];
  return a.m + ((b.m - a.m) * (km - a.km)) / (b.km - a.km || 1);
}

/** The straight-line position at a fraction of the way from one point to another. Used only as a guide marker. */
export function lerpPoint(a: LngLat, b: LngLat, t: number): LngLat {
  return { lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t };
}

/* ---------- directions ---------- */

/** The point "Directions" opens: the first stored car park (lift-start trails go to the valley car park), else the trailhead, else the pin. */
export function directionsTarget(place: Pick<PublicPlace, 'access' | 'point' | 'name'>): { at: LngLat; label: string; source: 'parking' | 'trailhead' | 'place' } | null {
  const p = place.access?.parking[0];
  if (p) return { at: { lat: p.lat, lng: p.lon }, label: p.name, source: 'parking' };
  const t = place.access?.trailhead;
  if (t) return { at: { lat: t.lat, lng: t.lon }, label: t.name, source: 'trailhead' };
  if (place.point) return { at: { lat: place.point.lat, lng: place.point.lon }, label: place.name, source: 'place' };
  return null;
}

export const pointAt = (p: Pick<AccessPoint, 'lat' | 'lon'>): LngLat => ({ lat: p.lat, lng: p.lon });

/** Where a stored pin came from, as visitor-facing text plus a link to the record when there is one. */
export function pointSourceInfo(p: Pick<AccessPoint, 'pointSource' | 'pointChecked'>): { text: string; url: string | null } {
  const [kind, ref = ''] = p.pointSource.split(/[:\s]+/, 2);
  const osm = /^osm_(node|way|relation)$/.exec(kind);
  let text = 'Source recorded';
  let url: string | null = null;
  if (osm && /^\d+$/.test(ref)) {
    text = 'From OpenStreetMap';
    url = `https://www.openstreetmap.org/${osm[1]}/${ref}`;
  } else if (kind === 'official') text = 'From the operator';
  else if (kind === 'wikidata' && /^Q\d+$/.test(ref)) {
    text = 'From Wikidata';
    url = `https://www.wikidata.org/wiki/${ref}`;
  } else if (kind === 'prototype_approx') text = 'Approximate position';
  else if (kind === 'manual_pin') text = 'Placed by hand';
  return { text: `${text} · ${p.pointChecked ? 'checked by a person' : 'not yet checked'}`, url };
}

/** OSM relations in a place's route lines, as `{id, url}`, with a plain sentence about them. */
export function routeLineInfo(lines: readonly { ref: string }[], confirmed = false): { text: string; refs: { label: string; url: string }[] } | null {
  const refs = lines.flatMap((l) => {
    const m = /^osm_(relation|way):(\d+)$/.exec(l.ref);
    return m ? [{ label: `${m[1]} ${m[2]}`, url: `https://www.openstreetmap.org/${m[1]}/${m[2]}` }] : [];
  });
  if (!lines.length) return null;
  const n = refs.length;
  const what = n ? `Route from OpenStreetMap (${n} ${n === 1 ? 'record' : 'records'})` : 'Route line stored';
  return { text: `${what}; ${confirmed ? 'confirmed by a person' : 'not yet confirmed by a person'}.`, refs };
}

/* ---------- links ---------- */

export const LINK_TABS = [
  { id: 'official', label: 'Official', groups: ['Official'] },
  { id: 'booking', label: 'Booking', groups: ['Parking and transport'] },
  { id: 'route', label: 'Route', groups: ['Maps and tracks'] },
  { id: 'conditions', label: 'Conditions', groups: ['Conditions and weather'] },
  { id: 'report', label: 'Report', groups: ['Reports and videos'] },
] as const;

export interface LinkTab {
  id: string;
  label: string;
  links: LinkGroup['links'];
  /** Kinds searched here with nothing found: "none found (checked 18 Oct 2026)". */
  none: { label: string; checked: string }[];
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-10-18" -> "18 Oct 2026"; anything else is returned as written. */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${MON[Number(m[2]) - 1]} ${m[1]}` : iso;
}

/** Regroups the adapter's five link groups into the five tabs of patterns 3.6. A group with no links still gets its tab. */
export function linkTabs(groups: readonly LinkGroup[], none: readonly LinkNone[] = []): LinkTab[] {
  return LINK_TABS.map((t) => {
    const inTab = (g: string) => (t.groups as readonly string[]).includes(g);
    return {
      id: t.id,
      label: t.label,
      links: groups.filter((g) => inTab(g.group)).flatMap((g) => g.links),
      none: none.filter((n) => inTab(n.group)).map((n) => ({ label: n.label, checked: shortDate(n.date) })),
    };
  });
}

/** The most recent "read 18 Oct 2026" date in the fact provenance: when the researched links were read. */
export function lastRead(facts: readonly Fact[]): string | null {
  const dates = new Map<number, string>();
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  for (const f of facts) {
    for (const m of f.provenance.matchAll(/read (?:(\d{1,2}) )?([A-Z][a-z]{2}) (20\d\d)/g)) {
      const mi = months.indexOf(m[2].toLowerCase());
      if (mi < 0) continue;
      dates.set(Number(m[3]) * 10000 + (mi + 1) * 100 + Number(m[1] ?? 0), m[0].replace('read ', ''));
    }
  }
  const top = Math.max(...dates.keys());
  return Number.isFinite(top) ? (dates.get(top) ?? null) : null;
}

/** Month states for the season strip: written months are `open`; the rest are `closed` (nothing is guessed). */
export function seasonMonths(months: readonly number[]): ('open' | 'closed')[] {
  return Array.from({ length: 12 }, (_, i) => (months.includes(i + 1) ? 'open' : 'closed'));
}

/* ---------- public text: no internal capture notes ---------- */

// Sentences that describe how a place was captured, not the place: file names, "stop 8 of the road trip post",
// "already in the Utah parks plan". They are dropped at render time (the adapter still carries them).
const INTERNAL = /\.\s?(?:md|json|txt|csv)\b|\bloose line\b|\broad ?trip\b|\bstops? \d+\b|\bposts?\b|\bplans?\b|\bfrom memory\b|\bfolders?\b|\blegacy\b|\bno details\b|\bsaved\b|\binstagram\b|\bosm[ _](?:node|way|relation)\b|\bconfirm this\b|\bprototype\b|\bcatalogue\b|\bresearch notes\b/i;
const INTERNAL_PAREN = /\s*\((?:from memory|unverified)[^)]*\)/gi;

/** Keeps the sentences that are about the place. Returns '' when nothing public is left. */
export function publicText(text: string | null | undefined): string {
  if (!text) return '';
  const cleaned = text.replace(INTERNAL_PAREN, '');
  const sentences = cleaned.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).map((s) => s.trim()).filter(Boolean);
  return sentences.filter((s) => !INTERNAL.test(s)).join(' ').trim();
}

/** A source line in visitor words: no file names, no internal record ids, no pipeline names. */
export function publicProvenance(text: string): string {
  return text
    .replace(/\bPLAN\.md\b/g, 'Our research')
    .replace(/\b[\w-]+\.md\b/gi, 'Our research')
    .replace(/\bexisting prototype catalogue\b/gi, 'Our research')
    .replace(/\btrails-and-media research\b/gi, 'Our research')
    .replace(/\bOpenStreetMap (?:node|way|relation) \d+/g, 'OpenStreetMap')
    .replace(/\bOverpass query\b/g, 'OpenStreetMap query')
    .replace(/\s*\(OSM: ([^)]*)\)/g, ' (OpenStreetMap: $1)');
}

/** The text the page would show for a place's one-line summary: the sanitised summary, else its kind and area. */
export function summaryOrKind(summary: string, kindLabel: string, areaLabel: string): string {
  return publicText(summary) || `${kindLabel} in ${areaLabel}.`;
}

/* ---------- elevation profile axes follow the units preference ---------- */

const KM_PER_MI = 1.609344;
const FT_PER_M = 3.280839895;

/**
 * Axis ticks for the profile. Geometry stays in km and metres; each tick has its value in the display unit (`label`)
 * and its place on the km or metre scale (`at`), so distance and elevation both follow the preference.
 */
export function profileTicks(
  loM: number,
  hiM: number,
  maxKm: number,
  distance: 'km' | 'mi',
  elevation: 'm' | 'ft',
): { x: { at: number; label: string }[]; y: { at: number; label: string }[]; distanceUnit: string } {
  const fd = distance === 'mi' ? 1 / KM_PER_MI : 1;
  const fe = elevation === 'ft' ? FT_PER_M : 1;
  const maxD = maxKm * fd;
  const xStep = maxD > 10 ? 2 : maxD > 4 ? 1 : 0.5;
  const x: { at: number; label: string }[] = [];
  for (let v = 0; v <= maxD + 1e-6; v += xStep) x.push({ at: v / fd, label: `${Number.isInteger(v) ? v : v.toFixed(1)} ${distance}` });
  const loE = loM * fe;
  const hiE = hiM * fe;
  const span = hiE - loE;
  const yStep = elevation === 'ft' ? (span > 2000 ? 1000 : span > 800 ? 500 : 200) : span > 600 ? 200 : 100;
  const y: { at: number; label: string }[] = [];
  for (let v = Math.ceil(loE / yStep) * yStep; v <= hiE + 1e-6; v += yStep) y.push({ at: v / fe, label: String(v) });
  return { x, y, distanceUnit: distance };
}
