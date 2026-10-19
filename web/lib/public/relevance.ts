import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { incomingOf, primaryRef, type World } from '@travel/core/capture/records.ts';
import type { RelevanceRecord } from '@travel/core/schema/relevance.ts';
import { travelRoot } from '../data/root';
import { BASIS_LABEL, TextScrub, lookupFor, longDate, readOf, type SourceRow } from './vals';

// Relevance on place pages (relevance.md 3.2, 3.6, 3.7, 6.2; place-page-sections PS5, PS8 to PS10): the one badge, the `why`
// line and its provenance, "Similar nearby" (instead of), "Nearby, worth adding" (as well as), the far-visitor pointer and
// Plan B. Pure over the derived files (data/relevance/derived, written by core's derive) and the sidecar records. It ranks,
// filters and words; it draws nothing, and it never carries a rating, a review count or a rank from any platform.

export type BadgeKind = 'journey' | 'detour' | 'local';
export const BADGE_LABEL: Record<BadgeKind, string> = { journey: 'Worth the journey', detour: 'Worth a detour', local: 'Local favourite' };
const BADGE_OF_LABEL: Record<string, BadgeKind> = { 'Worth the journey': 'journey', 'Worth a detour': 'detour', 'Local favourite': 'local' };

export interface SubstituteRaw { ref: string; km: number; draw: string; standing: string; access_cost: string[]; family_effort: number | null }
export interface PairRaw {
  ref: string;
  km: number | null;
  how: string | null;
  extra_min: number | null;
  on_site_min?: number | null;
  on_site_estimated?: boolean;
  draw?: string;
  standing?: string;
  hand_picked?: boolean;
  reason?: string;
  src?: string;
}
/** One item of data/relevance/derived/<trip>.json. Only the fields the site reads are typed. */
export interface DerivedItem {
  ref: string;
  layer?: string;
  effective_draw: string;
  access_load: 'easy' | 'plan' | 'hard' | string;
  detour_min: number | null;
  substitutes: { near: SubstituteRaw[]; area: SubstituteRaw[] };
  far_pointer: { ref: string; km: number; draw: string; same_class: boolean } | null;
  pair_with: PairRaw[];
  part_of: string[];
  plan_b: { ref: string; km: number; draw: string; standing: string; access_cost: string[]; family_effort: number | null; hand_picked?: boolean; reason?: string } | null;
  role: string;
  flags: { go_clear_day: boolean; rainy_day: boolean; en_route: boolean; hidden_gem: boolean };
  badge: string | null;
  draw_from?: string;
  route_is_attraction?: boolean;
  from_hubs?: Record<string, number>;
  stale?: string[];
}

export interface WikidataSignal { read: string; label: string | null; sitelinks: { count: number; langs: string[] } }

export interface RelevanceContext {
  world: World;
  derived: Map<string, DerivedItem>;
  wikidata: Record<string, WikidataSignal>;
  scrub: TextScrub;
}

/** Reads every derived file and the Wikidata signals cache under `root`. */
export function loadRelevanceContext(world: World, root: string = travelRoot(), scrub: TextScrub = new TextScrub()): RelevanceContext {
  const derived = new Map<string, DerivedItem>();
  const dir = path.join(root, 'data', 'relevance', 'derived');
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      const doc = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as { items?: DerivedItem[] };
      for (const it of doc.items ?? []) if (!derived.has(it.ref)) derived.set(it.ref, it);
    }
  }
  let wikidata: Record<string, WikidataSignal> = {};
  const wd = path.join(root, 'data', 'relevance', 'signals', 'wikidata.json');
  if (existsSync(wd)) wikidata = (JSON.parse(readFileSync(wd, 'utf8')) as { items?: Record<string, WikidataSignal> }).items ?? {};
  return { world, derived, wikidata, scrub };
}

// ---- words ---------------------------------------------------------------------------------------------------------------

const ACCESS_WORDS: Record<string, string> = {
  permit_lottery: 'permit by lottery', timed_entry: 'timed entry', day_permit: 'day permit', daily_cap: 'daily cap', shuttle_only: 'shuttle or bus only',
  toll_reservation: 'reservation at the toll', lift_only: 'lift only', boat_or_ferry: 'boat or ferry', high_clearance_4wd: 'high-clearance 4WD',
  long_walk_in: 'long walk in', seasonal_road: 'seasonal road',
};
const DESIGNATION_LABEL: Record<string, string> = {
  unesco_whs: 'UNESCO World Heritage Site', national_park: 'National park', provincial_or_state_park: 'Provincial or state park',
  conservation_area: 'Conservation area', natural_monument: 'Natural monument', heritage_listed: 'Heritage listed', dark_sky: 'Dark sky place',
  ramsar: 'Ramsar wetland', official_highlight: 'Official highlight', signature_experience: 'Signature experience',
};
const EFFORT_NAMES = ['Stroll', 'Easy', 'Moderate', 'Hard', 'Technical'];

/** "shuttle or bus only · seat needed" / "no booking": the access load in words, from the cost items and the derived load. */
export function accessWords(costs: string[], load: string | undefined): string {
  const items = costs.map((c) => ACCESS_WORDS[c] ?? c.replace(/_/g, ' '));
  if (items.length > 0) return items.join(' · ');
  return load === 'plan' ? 'book ahead' : load === 'hard' ? 'hard to book' : 'no booking';
}

/** The name of any ref: its capture name, else the last path segment made readable. */
export function nameOfRef(world: World, ref: string): string {
  const cap = world.cap.get(primaryRef(world, ref))?.rec;
  if (cap?.name) return cap.name;
  const seg = ref.split('#')[0]!.split('/').pop() ?? ref;
  return seg.replace(/^[a-z]+:/, '').replace(/[-_]/g, ' ').replace(/^./, (s) => s.toUpperCase());
}

// ---- the result ------------------------------------------------------------------------------------------------------------

export interface RefLink { ref: string; name: string }

export interface Provenance {
  /** "Our judgement" and the note that names a signal */
  judgement: { note: string | null; basisLabel: string; read: string | null };
  designations: { type: string; label: string; name: string; scope: 'own' | 'parent'; scopeText: string | null }[];
  mentions: { publisher: string; title: string; year: number; list: 'top_list' | 'listed'; reach: string | null }[];
  /** the fame signal we compute: Wikipedia editions of the confirmed Wikidata item */
  fame: { wikipediaLanguages: number; read: string } | null;
  volume: { count: number; unit: string; scope: string; year: number } | null;
  sources: SourceRow[];
  /** shown as the last line of the popover */
  noRatings: string;
  /** when the judged fields were last read */
  read: string | null;
}

export interface SimilarPlace extends RefLink {
  km: number;
  badge: { kind: BadgeKind; label: string } | null;
  effortName: string | null;
  access: string;
  /** true when this is also the page's Plan B */
  planB: boolean;
}

export interface PairPlace extends RefLink {
  /** straight-line km; null when the pair has no point, and the page then shows no distance */
  km: number | null;
  how: string | null;
  extraMin: number | null;
  onSiteMin: number | null;
  onSiteEstimated: boolean;
  handPicked: boolean;
  reason: string | null;
  badge: { kind: BadgeKind; label: string } | null;
  /** "starts_here" when the pair is a route that starts at this place */
  relation: 'starts_here' | null;
}

export interface Pointer extends RefLink {
  km: number;
  draw: string;
  sameClass: boolean;
  text: string;
}

export interface PlanB extends RefLink {
  km: number;
  access: string;
  effortName: string | null;
  /** what can fail on this page's own access: "shuttle or bus only", "timed entry" */
  risk: string;
  /** why a person picked it (plan_b_pick); null for a derived Plan B */
  reason: string | null;
}

export interface PublicRelevance {
  ref: string;
  /** the ref whose judgement this page shows: the route itself, or the payoff place it reaches */
  judgedRef: string;
  /** true when the judgement is the payoff's ("To Sentinel Pass") */
  fromPayoff: boolean;
  payoff: RefLink | null;
  /** a route expected to have a payoff place and lacking one: "Payoff place not checked yet" */
  payoffMissing: boolean;
  badge: { kind: BadgeKind; label: string } | null;
  /** draw is R and not judged: the dashed badge "Worth the trip? Not checked yet" (Q30 recommended) */
  notJudged: boolean;
  why: string | null;
  provenance: Provenance | null;
  /** capture `part_of` parents: "Part of Lake Louise" (never the derived mutual part_of, F4) */
  partOf: RefLink[];
  similar: SimilarPlace[];
  /** same-class places 25 to 100 km away, for "show the full list" */
  similarArea: SimilarPlace[];
  pairs: PairPlace[];
  pointer: Pointer | null;
  planB: PlanB | null;
  role: string | null;
  flags: DerivedItem['flags'] | null;
  /** minutes from each public hub, for the day lens */
  fromHubs: Record<string, number>;
}

export interface RelevanceOptions {
  /** where the badge shows: a place page and a card allow all three; a trip entry follows relevance 6.2 */
  surface?: 'place' | 'card' | 'trip';
  /** nights of the trip when surface is `trip`: 4 or more shows "Worth the journey" on anchors only */
  nights?: number;
  /** the top stop of a short trip carries "Local favourite" (the caller decides which stop is the top) */
  topStop?: boolean;
  /** the owner decides the not-judged badge (Q30): false hides it */
  showNotJudged?: boolean;
}

const MAX_SIMILAR = 3;
const MAX_PAIRS = 3;

function badgeOf(label: string | null | undefined): { kind: BadgeKind; label: string } | null {
  const kind = label ? BADGE_OF_LABEL[label] : undefined;
  return kind ? { kind, label: BADGE_LABEL[kind] } : null;
}

/** Applies the lens rules of relevance 3.6 and 6.2 to the badge derive wrote. Precedence is already journey, detour, local. */
export function badgeFor(item: DerivedItem | undefined, opts: RelevanceOptions = {}): { kind: BadgeKind; label: string } | null {
  const b = badgeOf(item?.badge);
  if (!b || (opts.surface ?? 'place') !== 'trip') return b;
  // a trip entry: 4 or more nights marks anchors only; a short trip marks its top stop "Local favourite"
  if ((opts.nights ?? 0) >= 4) return b.kind === 'journey' ? b : null;
  return opts.topStop && b.kind === 'local' ? b : null;
}

function provenanceOf(ctx: RelevanceContext, rel: RelevanceRecord | undefined, file: string): Provenance | null {
  if (!rel) return null;
  const lookup = lookupFor({ file });
  const scrub = ctx.scrub;
  const where = `relevance ${rel.ref}`;
  const sources: SourceRow[] = [];
  const addSrc = (ids: string[] | undefined): void => {
    for (const s of lookup(ids)) if (!sources.some((x) => x.id === s.id)) sources.push(s);
  };
  const draw = rel.draw;
  addSrc(draw.src);
  const designations = rel.signals.designations.state === 'value' ? (rel.signals.designations.v ?? []) : [];
  addSrc(rel.signals.designations.src);
  const editorial = rel.signals.editorial.state === 'value' ? (rel.signals.editorial.v ?? []) : [];
  addSrc(rel.signals.editorial.src);
  const vol = rel.signals.volume && rel.signals.volume.state === 'value' ? rel.signals.volume.v : null;
  if (rel.signals.volume) addSrc(rel.signals.volume.src);

  const qid = rel.wikidata.state === 'value' ? rel.wikidata.v : null;
  const sig = qid ? ctx.wikidata[qid] : undefined;
  const reads = [readOf(draw, lookup(draw.src)), readOf(rel.standing, lookup(rel.standing.src)), sig?.read].filter((d): d is string => !!d).sort();

  return {
    judgement: { note: scrub.maybe(draw.note, `${where} draw`), basisLabel: BASIS_LABEL[draw.basis ?? 'our_inference'] ?? 'our judgement', read: readOf(draw, lookup(draw.src)) },
    designations: designations.map((d) => ({
      type: d.type,
      label: DESIGNATION_LABEL[d.type] ?? d.type.replace(/_/g, ' '),
      name: d.name,
      scope: d.scope,
      scopeText: d.scope === 'parent' ? 'inherited from the area it lies in' : null,
    })),
    mentions: editorial.map((m) => ({ publisher: m.publisher, title: m.title, year: m.year, list: m.list, reach: m.reach ?? null })),
    fame: sig ? { wikipediaLanguages: sig.sitelinks.count, read: sig.read } : null,
    volume: vol ? { count: vol.count, unit: vol.unit === 'cap_per_day' ? 'visitors a day (a cap)' : 'visits a year', scope: vol.scope, year: vol.year } : null,
    sources,
    noRatings: 'No ratings or review counts are used',
    read: reads.length ? reads[reads.length - 1]! : null,
  };
}

function effortName(grade: number | null | undefined): string | null {
  return typeof grade === 'number' && grade >= 1 && grade <= 5 ? EFFORT_NAMES[grade - 1]! : null;
}

/** Refs that a pair or a pointer must never name: ways to the place, its payoff, its parts and parents, its start (X9, PS9). */
function relatedRefs(ctx: RelevanceContext, ref: string): Set<string> {
  const w = ctx.world;
  const cap = w.cap.get(ref)?.rec;
  const inc = incomingOf(w, ref);
  const out = new Set<string>([ref]);
  const add = (xs: (string | undefined)[] | undefined): void => {
    for (const x of xs ?? []) if (x) out.add(primaryRef(w, x));
  };
  add(cap?.reaches);
  add(cap?.part_of);
  add(cap?.starts_at);
  add(cap?.ends_at);
  add(cap?.passes?.map((p) => p.ref));
  add(inc.reached_by);
  add(inc.children);
  // offers at or on this record are listed in "At this place you can also" (section 10), so they are not a pair (S1b, owner Q31 spirit: one home)
  add(inc.at);
  add(inc.on);
  return out;
}

/**
 * Everything the relevance blocks of a place, route or offer page need. A route with no judgement of its own takes its
 * draw, standing, class, photo and badge from the first place it reaches (CC-adapter 3); an offer reads its own record.
 */
export function publicRelevance(ctx: RelevanceContext, rawRef: string, opts: RelevanceOptions = {}): PublicRelevance {
  const w = ctx.world;
  const ref = primaryRef(w, rawRef);
  const item = ctx.derived.get(ref);
  const cap = w.cap.get(ref)?.rec;
  const judgedRef = item?.draw_from ? primaryRef(w, item.draw_from) : ref;
  const fromPayoff = judgedRef !== ref;
  const relLoc = w.rel.get(judgedRef) ?? w.rel.get(ref);
  const rel = relLoc?.rec;
  const judgedItem = fromPayoff ? (ctx.derived.get(judgedRef) ?? item) : item;
  const badge = badgeFor(judgedItem, opts);

  const hasOwnJudgement = !!rel;
  const payoff: RefLink | null = fromPayoff ? { ref: judgedRef, name: nameOfRef(w, judgedRef) } : null;
  const expectsPayoff = cap?.layer === 'route' && cap.route_is_attraction !== true && !fromPayoff;
  const judged = hasOwnJudgement && rel!.draw.state !== 'gap';
  const notJudged = (opts.showNotJudged ?? true) && !judged;

  // "Part of": the capture relation only; the derived part_of is mutual (F4)
  const partOf: RefLink[] = (cap?.part_of ?? []).map((r) => ({ ref: primaryRef(w, r), name: nameOfRef(w, r) }));

  const asSimilar = (s: SubstituteRaw, planBRef: string | undefined): SimilarPlace => {
    const sub = ctx.derived.get(primaryRef(w, s.ref));
    return {
      ref: s.ref,
      name: nameOfRef(w, s.ref),
      km: s.km,
      badge: badgeFor(sub, { surface: 'place' }),
      effortName: effortName(s.family_effort),
      access: accessWords(s.access_cost, sub?.access_load),
      planB: s.ref === planBRef,
    };
  };
  const planBRef = item?.plan_b?.ref;
  const nearRefs = new Set((item?.substitutes.near ?? []).map((s) => s.ref));
  const skip = relatedRefs(ctx, ref);
  const similarAll = (item?.substitutes.near ?? []).filter((s) => !skip.has(primaryRef(w, s.ref)));
  const similar = similarAll.slice(0, MAX_SIMILAR).map((s) => asSimilar(s, planBRef));
  const similarArea = (item?.substitutes.area ?? []).filter((s) => !nearRefs.has(s.ref) && !skip.has(primaryRef(w, s.ref))).map((s) => asSimilar(s, planBRef));

  // pairs: hand-picked first (derive already sorts them so), never a way, payoff, part or the start of this record
  const pairs: PairPlace[] = [];
  for (const p of item?.pair_with ?? []) {
    const target = primaryRef(w, p.ref);
    if (skip.has(target)) continue;
    const startsHere = (w.cap.get(target)?.rec.starts_at ?? []).some((r) => primaryRef(w, r) === ref);
    pairs.push({
      ref: p.ref,
      name: nameOfRef(w, p.ref),
      km: p.km ?? null,
      how: p.how ?? null,
      extraMin: p.extra_min ?? null,
      onSiteMin: p.on_site_min ?? null,
      onSiteEstimated: p.on_site_estimated === true,
      handPicked: p.hand_picked === true,
      reason: ctx.scrub.maybe(p.reason, `pair ${ref} to ${p.ref}`),
      badge: badgeFor(ctx.derived.get(target), { surface: 'place' }),
      relation: startsHere ? 'starts_here' : null,
    });
  }
  pairs.sort((a, b) => Number(b.handPicked) - Number(a.handPicked));

  // the pointer: a local or regional place only, and never to a parent, a payoff or a part of itself (PS9, F1)
  let pointer: Pointer | null = null;
  const fp = item?.far_pointer;
    const pointerType = fp ? (w.cap.get(primaryRef(w, fp.ref))?.rec.type ?? '') : '';
  // the whitelist: a viewpoint, a trail, a summit, a landform, a lake or other water body, a waterfall, a heritage or culture site. Never a cruise, a drive, a ride, a town, a region or a stop.
  const visitable = /^(nature\.(viewpoint|trail|summit|landform|geo)|water\.(body|falls|river)|culture)\b/.test(pointerType);
  if (fp && visitable && (item?.effective_draw === 'local' || item?.effective_draw === 'regional') && !skip.has(primaryRef(w, fp.ref)) && !(item?.part_of ?? []).some((r) => primaryRef(w, r) === primaryRef(w, fp.ref))) {
    const name = nameOfRef(w, fp.ref);
    pointer = { ref: fp.ref, name, km: fp.km, draw: fp.draw, sameClass: fp.same_class, text: `Coming from far? Nearby, ${name} is the one people travel for.` };
  }

  // Plan B: for an anchor whose own access cost can fail
  let planB: PlanB | null = null;
  if (item?.plan_b && !skip.has(primaryRef(w, item.plan_b.ref))) {
    const own = rel?.access_cost.state === 'value' ? (rel.access_cost.v ?? []).map((i) => i.type) : [];
    planB = {
      ref: item.plan_b.ref,
      name: nameOfRef(w, item.plan_b.ref),
      km: item.plan_b.km,
      access: accessWords(item.plan_b.access_cost, ctx.derived.get(primaryRef(w, item.plan_b.ref))?.access_load),
      effortName: effortName(item.plan_b.family_effort),
      risk: own.map((t) => ACCESS_WORDS[t] ?? t).join(' · '),
      reason: item.plan_b.hand_picked ? ctx.scrub.maybe(item.plan_b.reason, `plan b ${ref}`) : null,
    };
  }

  return {
    ref,
    judgedRef,
    fromPayoff,
    payoff,
    payoffMissing: expectsPayoff && !rel,
    badge,
    notJudged,
    why: ctx.scrub.maybe(rel?.why, `relevance ${judgedRef} why`),
    provenance: provenanceOf(ctx, rel, relLoc?.file ?? ''),
    partOf,
    similar,
    similarArea,
    pairs: pairs.slice(0, MAX_PAIRS),
    pointer,
    planB,
    role: judgedItem?.role ?? null,
    flags: judgedItem?.flags ?? null,
    fromHubs: item?.from_hubs ?? {},
  };
}

/** Provenance lines for the popover, in the order of PS5: judgement, designations with scope, mentions, signals with read dates. */
export function provenanceLines(p: Provenance): string[] {
  const lines: string[] = [];
  lines.push(`Our judgement${p.judgement.read ? ` · read ${longDate(p.judgement.read)}` : ''}${p.judgement.note ? `: ${p.judgement.note}` : ''}`);
  for (const d of p.designations) lines.push(`${d.label}: ${d.name}${d.scopeText ? ` (${d.scopeText})` : ''}`);
  for (const m of p.mentions) lines.push(`${m.publisher}, ${m.title} (${m.year})`);
  if (p.fame) lines.push(`Wikipedia in ${p.fame.wikipediaLanguages} languages · read ${longDate(p.fame.read)}`);
  if (p.volume) lines.push(`${p.volume.count.toLocaleString('en-CA')} ${p.volume.unit} (${p.volume.year})`);
  lines.push(p.noRatings);
  return lines;
}
