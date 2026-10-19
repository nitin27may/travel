import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { publicSentences } from './dateless';
import { TRIP_SLUGS, kebab } from './slugs';
import { folderVisibility, type Sources } from './sources';
import type { AreaRef, Fact, LinkGroup, LinkNone, Point } from './types';

// A trail page for every trail route of every public trip (backlog 3.8). The routes come from the capture records
// (data/capture/<trip>/*.json, layer route, type nature.trail.*); the Rockies add their trails.json research. Nothing here
// invents a point: a trail has the payoff's point only when its Wikidata item carries one, and the trailhead only as text.

export interface TrailSeed {
  /** Capture ref, stable: the slug key. */
  ref: string;
  name: string;
  subkind: 'hike' | 'walk';
  areaChain: AreaRef[];
  areaLabel: string;
  point: Point | null;
  tripFolder: string;
  facts: Fact[];
  hazards: string[];
  links: { kind: string; label: string; url: string; linkOnly: boolean }[];
  none: LinkNone[];
  seasonNote: string | null;
  summary: string;
  stats: { distanceKm: number | null; gainM: number | null; hours: string | null };
  /** Name of the place the route reaches, when the capture records one. */
  payoff: string | null;
  datedSource: boolean;
  hasFacts: boolean;
  /** A sight, offer or other place of the same trip carries this name: the name lookup must not point it at the trail page. */
  ambiguous: boolean;
}

const country = (name: string, slug: string): AreaRef => ({ level: 'country', name, slug });
const area = (level: 'state' | 'district', name: string): AreaRef => ({ level, name, slug: kebab(name) });
const chain = (c: AreaRef, state: string, district: string): AreaRef[] => [c, area('state', state), area('district', district)];

const CA = country('Canada', 'ca');
const US = country('United States', 'us');
const AR = country('Argentina', 'ar');
const IS = country('Iceland', 'is');
const FR = country('France', 'fr');
const IT = country('Italy', 'it');

const BC_PARKS = /^(Yoho|Kootenay|Mount Robson|Mount Assiniboine|Elk Lakes)/;
/** Rockies trails.json `park` -> district name (the park, or the area when it is a town). */
function rockiesChain(park: string): AreaRef[] {
  const district = park.replace(/\s*\(.*\)$/, '').replace(/ Provincial Park$/, '').replace(/ National Park$/, '');
  return chain(CA, BC_PARKS.test(park) ? 'British Columbia' : 'Alberta', district);
}

/** Areas of the trips that have no trails.json: the park, valley or town the trail is in, written out from the trip's bases. */
const AREAS: Record<string, [AreaRef[], string?]> = {
  'trail:laguna de los tres': [chain(AR, 'Santa Cruz', 'El Chalten')],
  'trail:laguna capri': [chain(AR, 'Santa Cruz', 'El Chalten')],
  'trail:mirador de los condores': [chain(AR, 'Santa Cruz', 'El Chalten')],
  'trail:mirador de las aguilas': [chain(AR, 'Santa Cruz', 'El Chalten')],
  'trail:chorrillo del salto': [chain(AR, 'Santa Cruz', 'El Chalten')],
  'trail:coastal path': [chain(AR, 'Tierra del Fuego', 'Ushuaia')],
  'trail:laguna esmeralda': [chain(AR, 'Tierra del Fuego', 'Ushuaia')],
  'sight:dettifoss#walk': [chain(IS, 'Northeast Iceland', 'Jokulsargljufur')],
  'trail:arnarstapi to hellnar': [chain(IS, 'West Iceland', 'Snaefellsnes')],
  'trail:fjadrargljufur canyon': [chain(IS, 'South Iceland', 'Fjadrargljufur')],
  'trail:skaftafell svartifoss': [chain(IS, 'South Iceland', 'Skaftafell')],
  'trail:thingvellir': [chain(IS, 'South Iceland', 'Thingvellir')],
  'trail:col des montets': [chain(FR, 'Auvergne-Rhone-Alpes', 'Chamonix Valley')],
  'trail:lac blanc via flegere': [chain(FR, 'Auvergne-Rhone-Alpes', 'Chamonix Valley')],
  'trail:plan de l aiguille': [chain(FR, 'Auvergne-Rhone-Alpes', 'Chamonix Valley')],
  'trail:narrows from the temple of sinawava': [chain(US, 'Utah', 'Zion')],
  'trail:angels landing chains view or scout lookout': [chain(US, 'Utah', 'Zion')],
  'trail:pa rus trail': [chain(US, 'Utah', 'Zion')],
  'trail:riverside walk': [chain(US, 'Utah', 'Zion')],
  'trail:navajo loop and queens garden': [chain(US, 'Utah', 'Bryce Canyon')],
  'trail:lower calf creek falls': [chain(US, 'Utah', 'Grand Staircase-Escalante')],
  'trail:hickman bridge': [chain(US, 'Utah', 'Capitol Reef')],
  'trail:delicate arch trail': [chain(US, 'Utah', 'Arches')],
  'trail:devils garden': [chain(US, 'Utah', 'Arches')],
  'trail:windows section': [chain(US, 'Utah', 'Arches')],
  'trail:mesa arch': [chain(US, 'Utah', 'Canyonlands')],
  'trail:upheaval dome': [chain(US, 'Utah', 'Canyonlands')],
  'viewpoint:grand view point#walk': [chain(US, 'Utah', 'Canyonlands')],
  'trail:stowe recreation path': [chain(US, 'Vermont', 'Stowe')],
  'trail:solitaire lake trail': [chain(CA, 'Ontario', 'Lake of Bays')],
  'trail:track and tower trail': [chain(CA, 'Ontario', 'Algonquin Park')],
};
/** Where a trip's routes sit when nothing finer is written: the Dolomites walks around a lake, the Banff walks of the Rockies. */
const DEFAULT_AREA: Record<string, AreaRef[]> = { 'dolomites-2027': chain(IT, 'South Tyrol', 'Dolomites') };

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function readDate(iso: string | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${Number(m[3])} ${MON[Number(m[2]) - 1]} ${m[1]}` : null;
}

interface CaptureRec { ref: string; type: string; layer: string; name: string; reaches?: string[]; starts_at?: string[] }
interface RockiesTrail { id: string; name: string; park: string; jurisdiction?: string; difficulty?: string; km?: number; gain_m?: number; hours?: string; trailhead?: string; map_url?: string; alltrails_url?: string | null; official_url?: string; parking_or_shuttle?: string; child_note?: string; sept_notes?: string; hazards?: string; source_urls?: string[]; checked?: string; alltrails_alternative?: unknown; alltrails_checked?: boolean }

const readJson = <T>(file: string): T | null => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null);

function wikidataPoint(root: string): Map<string, Point> {
  const doc = readJson<{ points: Record<string, { lat: number; lon: number; coord_src: string; point_source: string }> }>(path.join(root, 'data', 'relevance', 'inputs', 'points.json'));
  const out = new Map<string, Point>();
  for (const [ref, v] of Object.entries(doc?.points ?? {})) {
    const q = /\bQ\d+\b/.exec(v.point_source)?.[0];
    if (v.coord_src === 'wikidata' && q) out.set(ref, { lat: v.lat, lon: v.lon, pointSource: `wikidata:${q}`, pointChecked: null, sourceLicence: 'CC0' });
  }
  return out;
}

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

/**
 * One seed per trail route of a public trip. Trips whose folder fails the visibility check are skipped (fail closed: a trip not
 * in the manifest, or marked private, gets no trail pages).
 */
export function trailSeeds(src: Sources): TrailSeed[] {
  const dir = path.join(src.root, 'data', 'capture');
  if (!existsSync(dir)) return [];
  const folderOfTrip = new Map(Object.entries(TRIP_SLUGS).map(([folder, slug]) => [slug, folder]));
  const points = wikidataPoint(src.root);
  const rockies = new Map((src.rockies?.trails as unknown as RockiesTrail[] | undefined)?.map((t) => [t.id, t]) ?? []);
  const out: TrailSeed[] = [];
  const others = new Map<string, Set<string>>();
  for (const trip of readdirSync(dir).sort()) {
    const tdir = path.join(dir, trip);
    if (['splits', 'runs'].includes(trip) || !statSync(tdir).isDirectory()) continue;
    const folder = folderOfTrip.get(trip);
    const mf = folder ? src.manifest.get(folder) : undefined;
    if (!folder || !mf?.served || folderVisibility(mf) === 'private') continue;
    for (const file of readdirSync(tdir).filter((n) => n.endsWith('.json')).sort()) {
      const doc = readJson<{ records?: CaptureRec[] }>(path.join(tdir, file));
      const byRef = new Map((doc?.records ?? []).map((r) => [r.ref, r]));
      const names = others.get(trip) ?? new Set<string>();
      for (const r of doc?.records ?? []) if (r.layer !== 'route') names.add(norm(r.name));
      others.set(trip, names);
      for (const r of doc?.records ?? []) {
        if (r.layer !== 'route' || !/^nature\.trail\./.test(r.type)) continue;
        const subkind = r.type.endsWith('.walk') ? 'walk' : 'hike';
        const short = r.ref.replace(/^(part\/)?(trip\/[^/]+\/|place\/)/, '');
        const rk = /\/trails\/([^/#]+)$/.exec(r.ref)?.[1];
        const rt = rk ? rockies.get(rk) : undefined;
        const reach = r.reaches?.[0];
        const payoffRec = reach ? byRef.get(reach) : undefined;
        const [chainOf] = AREAS[short] ?? [rt ? rockiesChain(rt.park) : DEFAULT_AREA[trip] ?? chain(CA, 'Alberta', 'Banff')];
        const point = reach ? (points.get(reach) ?? null) : null;
        const read = readDate(rt?.checked);
        const prov = (src0: string) => [src0, read ? `read ${read}` : null].filter(Boolean).join(', ');
        const facts: Fact[] = [];
        const add = (label: string, value: string | undefined | null, p = 'Our research') => {
          const v = (value ?? '').toString().trim();
          if (v) facts.push({ label, value: v, provenance: prov(p), conflicts: [] });
        };
        const links: TrailSeed['links'] = [];
        const none: LinkNone[] = [];
        const seen = new Set<string>();
        const link = (kind: string, label: string, url: string | undefined | null, linkOnly = false) => {
          if (!url || !/^https?:\/\//.test(url) || seen.has(url)) return;
          seen.add(url);
          links.push({ kind, label, url, linkOnly });
        };
        let hazards: string[] = [];
        if (rt) {
          add('Distance', rt.km ? `${rt.km} km` : null);
          add('Climb', rt.gain_m ? `${rt.gain_m} m` : null);
          add('Time', rt.hours);
          add('Difficulty', rt.difficulty ? rt.difficulty[0].toUpperCase() + rt.difficulty.slice(1) : null);
          add('Trailhead', publicSentences(rt.trailhead));
          add('Parking', publicSentences(rt.parking_or_shuttle));
          add('Kids', publicSentences(rt.child_note));
          hazards = publicSentences(rt.hazards) ? [publicSentences(rt.hazards)] : [];
          link('official', `Official page (${hostOf(rt.official_url ?? '')})`, rt.official_url);
          for (const u of rt.source_urls ?? []) link('official', `Source page (${hostOf(u)})`, u);
          link('other', 'Map search (Google Maps, link only)', rt.map_url, true);
          link('alltrails', 'AllTrails', rt.alltrails_url, true);
          if (!rt.alltrails_url && rt.alltrails_checked && rt.checked) none.push({ group: 'Maps and tracks', kind: 'alltrails', label: 'AllTrails', date: rt.checked });
        }
        const tripPayoff = payoffRec && payoffRec.ref !== r.ref ? payoffRec.name : null;
        out.push({
          ref: r.ref,
          name: r.name,
          subkind,
          areaChain: chainOf,
          areaLabel: `${chainOf[2].name}, ${chainOf[0].name}`,
          point,
          tripFolder: folder,
          facts,
          hazards,
          links,
          none,
          seasonNote: rt ? publicSentences(rt.sept_notes) || null : null,
          summary: '',
          stats: { distanceKm: rt?.km ?? null, gainM: rt?.gain_m ?? null, hours: rt?.hours ?? null },
          payoff: tripPayoff,
          datedSource: !!read,
          hasFacts: facts.length > 0 || links.length > 0,
          ambiguous: false,
        });
      }
    }
  }
  // Rockies sights and adventures live in their own datasets, not only in the capture records
  const rk = src.rockies;
  const rockiesNames = new Set([...(rk?.sights ?? []), ...(rk?.adventures ?? [])].map((r) => norm(String(r.name))));
  for (const s of out) s.ambiguous = (others.get(TRIP_SLUGS[s.tripFolder]) ?? new Set()).has(norm(s.name)) || (s.tripFolder === 'canadian-rockies-sept-2029' && rockiesNames.has(norm(s.name)));
  return out;
}

/** The link groups for a seed, in the order the Links tabs use. */
export function groupLinks(src: Sources, links: TrailSeed['links']): LinkGroup[] {
  const kinds = new Map(src.snapshot.linkKinds.map((k) => [k.kind, k]));
  const groups = new Map<string, LinkGroup>();
  for (const l of links) {
    const g = kinds.get(l.kind)?.group ?? 'Reports and videos';
    if (!groups.has(g)) groups.set(g, { group: g, links: [] });
    groups.get(g)!.links.push(l);
  }
  return src.snapshot.linkGroups.filter((g) => groups.has(g)).map((g) => groups.get(g)!);
}
