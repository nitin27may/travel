// The trip's Summary tab model (trip-and-places-ux-fixes.md 3.5, W2; UXF-16 to UXF-18, UXF-23). Pure: the web adapter
// (web/lib/public/summary.ts) gathers the facts from the public trip, its place pages and the export model, and this function
// turns them into the light model the Summary renders. No fact is invented here: a region or park is named only when a place the
// plan visits lies in it, a total carries its coverage, and an overview trip (no days) gets a smaller model with flags (P8: light
// data; P9: one boundary, the adapter).

/** A place the plan as written visits (the default profile's timelines), in the order of first appearance in the days. */
export interface SummaryPlace {
  slug: string;
  /** Admin-1 (province, state, region) from the place's area chain; null when the chain has none. */
  region: string | null;
  /** The designations of the place (relevance `signals.designations`), own and inherited from the area it lies in. */
  designations: readonly { type: string; name: string }[];
}

export interface SummaryTrail {
  distanceKm: number | null;
  gainM: number | null;
}

export interface SummaryBooking {
  name: string;
  /** The window in words (`bookRuleText`), null when the plan only has a note. */
  rule: string | null;
  day: number | null;
  /** Days before Day 1 the window opens (`dayN - 1 + daysBefore`), for "earliest"; null without a rule. */
  opensBeforeDay1: number | null;
}

export interface HighlightCandidate {
  slug: string;
  name: string;
  days: readonly number[];
  /** A route judged by its payoff ("Takakkaw Falls Walk" to "Takakkaw Falls"): folded into the payoff when that is a highlight too. */
  payoffSlug: string | null;
  /** The place has its own licensed photo. */
  placePhoto: boolean;
}

export interface SummaryInput {
  depth: "full" | "summary" | "overview";
  nights: number | null;
  days: number;
  /** Country names (TRIP_COUNTRY and the places' area chains), for an overview trip's lead. */
  countries: readonly string[];
  bases: readonly { name: string; nights: number }[];
  visited: readonly SummaryPlace[];
  /** One entry per row of the Stops tab's Trails (all versions), with the plan's stats. */
  trails: readonly SummaryTrail[];
  /** Distinct rows of the other Stops categories. */
  sights: number;
  activities: number;
  food: number;
  bookings: readonly SummaryBooking[];
  highlights: readonly HighlightCandidate[];
  /** The trip gallery's sections in order, with the index of each section's first photo in the gallery. */
  gallery: { photos: number; sections: readonly { name: string; first: number }[] };
  /** Default-profile days per version audience: "whole family on 14 days, adults' hike on 1" (`versionsText`). */
  versions: readonly { audience: Audience; days: number }[];
}

export type ParkKind = "national" | "provincial" | "state" | "nature" | "regional" | "whs";

export interface SummaryPark {
  /** The full name; `parkShort` gives the lead line's "Banff". */
  name: string;
  kind: ParkKind;
  /** Visited places that lie in it. */
  places: number;
}

/** A highlight's photo: "place" (the place's own), a trip gallery index, or null ("No licensed photo yet"). Compact: the Summary stays under 2 KB. */
export type PhotoRef = "place" | number | null;

/**
 * A highlight card. A place highlight carries its page slug only: the card reads the name from the place card it already looks up
 * for the link (P8: the Summary stays under 2 KB with the Rockies' 13). An overview trip's gallery section has no page: it carries
 * its `name` and no days.
 */
export type SummaryHighlight = { slug: string; days: number[]; photo: PhotoRef } | { slug: null; name: string; days: []; photo: PhotoRef };

export interface TripSummary {
  depth: SummaryInput["depth"];
  /** What the Summary can draw: a block whose flag is false is omitted, never drawn empty (P4). */
  flags: { days: boolean; regions: boolean; parks: boolean; counts: boolean; bookings: boolean; highlights: boolean; photos: boolean; shape: boolean };
  nights: number | null;
  days: number;
  countries: string[];
  regions: { name: string; places: number }[];
  parks: SummaryPark[];
  /** The World Heritage Site(s) and whether every park-bearing visited place lies in one ("all in the ..."). */
  heritage: { name: string; places: number; all: boolean }[];
  counts: {
    bases: number;
    stays: number;
    trails: { count: number; km: number; kmKnown: number; gainM: number; gainKnown: number };
    sights: number;
    activities: number;
    food: number;
    bookings: { count: number; dated: number; earliest: { name: string; rule: string; day: number | null } | null };
    photos: number;
    highlights: number;
  };
  highlights: SummaryHighlight[];
  /** Who it suits, the part the trip does not already hold: default-profile days per audience (`versionsText`). Effort, the age, "written for", the season and the drive average are read from the trip itself, never copied here. */
  versions: { audience: Audience; days: number }[];
}

export const MAX_HIGHLIGHTS = 13;

/** The audience of a day's version (core/src/schedule/types.ts DayVariant): who the chosen version is for. */
export type Audience = "adults" | "family" | "easy" | "any";
const AUDIENCE_WORDS: Record<Audience, string> = { family: "whole family", any: "everyone", adults: "adults' hike", easy: "easy day" };

/** "whole family on 14 days, adults' hike on 1"; "" when the plan has one version a day. */
export function versionsText(versions: readonly { audience: Audience; days: number }[]): string {
  if (versions.length < 2) return "";
  return versions.map((v, i) => `${AUDIENCE_WORDS[v.audience]} on ${v.days}${i === 0 ? ` ${v.days === 1 ? "day" : "days"}` : ""}`).join(", ");
}

const PARK_TYPES = new Set(["national_park", "provincial_or_state_park"]);

/** The park's kind from its designation type and its own name (the data has one type for provincial, state and nature parks). */
export function parkKind(type: string, name: string): ParkKind | null {
  if (type === "unesco_whs") return "whs";
  if (type === "national_park") return "national";
  if (type !== "provincial_or_state_park") return null;
  if (/\bprovincial park\b/i.test(name)) return "provincial";
  if (/\bstate park\b/i.test(name)) return "state";
  if (/\bnatur(?:e|al) park\b|\bnaturpark\b|\bparco naturale\b/i.test(name)) return "nature";
  return "regional";
}

/** "Banff National Park" -> "Banff"; "Natural Park of the Ampezzo Dolomites" -> "Ampezzo Dolomites". */
export function parkShort(name: string): string {
  const s = name
    .replace(/\s+(?:National|Provincial|State|Nature|Natural|Regional)\s+Park$/i, "")
    .replace(/^(?:National|Provincial|State|Nature|Natural|Regional)\s+Park\s+of\s+(?:the\s+)?/i, "")
    .trim();
  return s || name;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Folds highlight candidates: one per page, a route into its payoff, two pages with one name into one card; days merged and sorted. */
function foldHighlights(cands: readonly HighlightCandidate[], gallery: SummaryInput["gallery"]): SummaryHighlight[] {
  const bySlug = new Map(cands.map((c) => [c.slug, c]));
  const out = new Map<string, { slug: string; name: string; days: Set<number>; placePhoto: boolean }>();
  const norm = (s: string): string => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  for (const c of cands) {
    const target = c.payoffSlug && c.payoffSlug !== c.slug && bySlug.has(c.payoffSlug) ? bySlug.get(c.payoffSlug)! : c;
    const key = norm(target.name);
    const row = out.get(key) ?? { slug: target.slug, name: target.name, days: new Set<number>(), placePhoto: false };
    for (const d of c.days) row.days.add(d);
    row.placePhoto ||= target.placePhoto;
    out.set(key, row);
  }
  const sections = gallery.sections.map((s) => ({ ...s, n: ` ${norm(s.name)} ` }));
  return [...out.values()]
    .map((h) => {
      const days = [...h.days].sort((a, b) => a - b);
      // the place's own photo; else the first gallery section that names the place as a whole phrase ("Lake Louise and Lake Agnes")
      const sec = sections.find((s) => s.n.includes(` ${norm(h.name)} `));
      const photo: PhotoRef = h.placePhoto ? "place" : sec ? sec.first : null;
      return { slug: h.slug, name: h.name, days, photo };
    })
    .sort((a, b) => (a.days[0] ?? 99) - (b.days[0] ?? 99) || a.name.localeCompare(b.name))
    .slice(0, MAX_HIGHLIGHTS)
    .map(({ slug, days, photo }) => ({ slug, days, photo }));
}

export function tripSummary(i: SummaryInput): TripSummary {
  const overview = i.depth === "overview" || i.days === 0;

  // regions and parks: only from places the plan visits, in the order they first appear
  const regions = new Map<string, number>();
  const parks = new Map<string, SummaryPark>();
  const heritage = new Map<string, number>();
  let parkPlaces = 0;
  let parkPlacesInWhs = 0;
  if (!overview) {
    for (const p of i.visited) {
      if (p.region) regions.set(p.region, (regions.get(p.region) ?? 0) + 1);
      const seen = new Set<string>();
      let inPark = false;
      let inWhs = false;
      for (const d of p.designations) {
        const kind = parkKind(d.type, d.name);
        if (!kind || seen.has(d.name)) continue;
        seen.add(d.name);
        if (kind === "whs") {
          heritage.set(d.name, (heritage.get(d.name) ?? 0) + 1);
          inWhs = true;
          continue;
        }
        if (!PARK_TYPES.has(d.type)) continue;
        inPark = true;
        const row = parks.get(d.name) ?? { name: d.name, kind, places: 0 };
        row.places += 1;
        parks.set(d.name, row);
      }
      if (inPark) {
        parkPlaces += 1;
        if (inWhs) parkPlacesInWhs += 1;
      }
    }
  }

  const kmRows = i.trails.filter((t) => t.distanceKm !== null);
  const gainRows = i.trails.filter((t) => t.gainM !== null);
  const dated = i.bookings.filter((b) => b.rule !== null);
  const earliest = [...dated].filter((b) => b.opensBeforeDay1 !== null).sort((a, b) => b.opensBeforeDay1! - a.opensBeforeDay1!)[0] ?? dated[0] ?? null;

  const highlights: SummaryHighlight[] = overview
    ? i.gallery.sections.slice(0, MAX_HIGHLIGHTS).map((s): SummaryHighlight => ({ slug: null, name: s.name, days: [], photo: s.first }))
    : foldHighlights(i.highlights, i.gallery);

  const counts: TripSummary["counts"] = {
    bases: new Set(i.bases.map((b) => b.name)).size,
    stays: i.bases.length,
    trails: { count: i.trails.length, km: round1(kmRows.reduce((s, t) => s + t.distanceKm!, 0)), kmKnown: kmRows.length, gainM: gainRows.reduce((s, t) => s + t.gainM!, 0), gainKnown: gainRows.length },
    sights: i.sights,
    activities: i.activities,
    food: i.food,
    bookings: { count: i.bookings.length, dated: dated.length, earliest: earliest && earliest.rule ? { name: earliest.name, rule: earliest.rule, day: earliest.day } : null },
    photos: i.gallery.photos,
    highlights: highlights.length,
  };

  return {
    depth: i.depth,
    flags: {
      days: !overview,
      regions: regions.size > 0,
      parks: parks.size > 0,
      counts: !overview && (counts.trails.count + counts.sights + counts.activities + counts.food + counts.stays) > 0,
      bookings: !overview && counts.bookings.count > 0,
      highlights: highlights.length > 0,
      photos: counts.photos > 0,
      shape: !overview,
    },
    nights: i.nights,
    days: i.days,
    countries: [...i.countries],
    regions: [...regions].map(([name, places]) => ({ name, places })),
    parks: [...parks.values()],
    heritage: [...heritage].map(([name, places]) => ({ name, places, all: parkPlaces > 0 && parkPlacesInWhs === parkPlaces })),
    counts,
    highlights,
    versions: overview ? [] : i.versions.map((v) => ({ ...v })),
  };
}

// ---- words --------------------------------------------------------------------------------------------------------------

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const numberWord = (n: number): string => WORDS[n] ?? String(n);
const listWords = (xs: readonly string[]): string => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const KIND_WORDS: Record<Exclude<ParkKind, "whs">, [string, string]> = {
  national: ["national park", "national parks"],
  provincial: ["provincial park", "provincial parks"],
  state: ["state park", "state parks"],
  nature: ["nature park", "nature parks"],
  regional: ["regional park", "regional parks"],
};

/**
 * The Summary's lead line (3.5): "15 days through Alberta and British Columbia, in four national parks (Banff, Jasper, Yoho,
 * Kootenay) and two provincial parks (Mount Robson, Peter Lougheed), all in the Canadian Rocky Mountain Parks World Heritage
 * Site". An overview trip: "10 nights in Costa Rica. This plan has not been converted to days yet." Words only from the model.
 */
export function summaryLead(s: TripSummary): string {
  if (!s.flags.days) {
    const len = s.nights === 0 ? "A day trip" : s.nights !== null ? `${s.nights} ${s.nights === 1 ? "night" : "nights"}` : "A trip";
    const where = s.countries.length ? ` in ${listWords(s.countries.map((c) => (/^(?:United|Netherlands|Czech Republic|Philippines|Bahamas)\b/.test(c) ? `the ${c}` : c)))}` : "";
    return `${len}${where}. This plan has not been converted to days yet.`;
  }
  const head = `${s.days} ${s.days === 1 ? "day" : "days"}${s.regions.length ? ` through ${listWords(s.regions.map((r) => r.name))}` : ""}`;
  const groups = (Object.keys(KIND_WORDS) as (keyof typeof KIND_WORDS)[])
    .map((k) => {
      const ps = s.parks.filter((p) => p.kind === k);
      if (!ps.length) return "";
      const [one, many] = KIND_WORDS[k];
      return `${numberWord(ps.length)} ${ps.length === 1 ? one : many} (${ps.map((p) => parkShort(p.name)).join(", ")})`;
    })
    .filter(Boolean);
  const inParks = groups.length ? `, in ${listWords(groups)}` : "";
  const whs = s.heritage[0];
  const site = whs ? `the ${whs.name.replace(/^the\s+/i, "")} World Heritage Site` : "";
  const tail = whs ? (whs.all && groups.length ? `, all in ${site}` : `, with ${whs.places === 1 ? "one stop" : `${numberWord(whs.places)} stops`} in ${site}`) : "";
  return `${head}${inParks}${tail}`;
}
