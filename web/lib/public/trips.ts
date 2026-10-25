import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { suitabilityFromTitle } from './party';
import { undatedTitle, DropLog, relativeSun, sunRange, undated, undatedSentences } from './dateless';
import { honesty, uniqueHonesty } from './honesty';
import { fileFromUrl, makePhoto } from './photos';
import { scrubMarkers, stripMarkers } from './prose';
import { attachTimeline } from './timeline';
import { normName, type PlaceBuild } from './places';
import { PUBLIC_TRIP_FOLDER, TRIP_SLUGS, kebab } from './slugs';
import { folderVisibility, type ProtoPubTrip, type ProtoStop, type RockiesDay, type RockiesTrack, type Sources } from './sources';
import { STOP_KINDS, categoryOf, mapPrototypeKind, type DayItemKind } from './taxonomy';
import {
  CATEGORIES,
  type BookRule,
  type Category,
  type CategoryItem,
  type DayItem,
  type Honesty,
  type Photo,
  type PublicBase,
  type PublicDay,
  type PublicTrip,
  type Season,
  type TripSchedule,
  type Track,
} from './types';

/**
 * The one age a plan states it suits from. A plan whose own file names a family profile ("families with a child from about 6", the profile's
 * youngest age) states that age; every other plan states its typed `ageFit`. The card tag, the hero chip, the plan bar and the filter all start
 * from this number, so the Rockies cannot read 5 on a card and 6 in the hero (review 4.24, suitability-display "Age wording").
 */
export function statedAge(typed: number | null, schedule: TripSchedule | null): number | null {
  const p = schedule?.defaultProfile;
  if (p?.party !== 'family' || typeof p.youngest !== 'number') return typed;
  // The default setting (the youngest the page opens on) is not the age the plan suits from: the plan states that in `writtenFor`
  // ("families with a child from about 6"). Falls back to the default only when the sentence names no age.
  const written = /\bfrom about (\d{1,2})\b/.exec(schedule?.writtenFor ?? '');
  return written ? Number(written[1]) : p.youngest;
}

export interface TripBuild {
  trips: PublicTrip[];
  /** public trip folder -> slug, for the trips that are built */
  built: Map<string, string>;
}

const emptyCategories = (): Record<Category, CategoryItem[]> =>
  Object.fromEntries(CATEGORIES.map((c) => [c, [] as CategoryItem[]])) as unknown as Record<Category, CategoryItem[]>;

/** The timeline fields of a day, filled in by attachTimeline once the bases are known. */
const noTimeline = () => ({ scheduleInput: null, variants: [], know: [], summaryProse: null, light: null });

function statsLine(s: { distanceKm: number | null; gainM: number | null; hours: string | null } | null): string | null {
  if (!s) return null;
  const parts = [s.distanceKm !== null ? `${s.distanceKm} km` : null, s.gainM !== null ? `${s.gainM} m up` : null, s.hours ? (/h/.test(s.hours) ? s.hours : `${s.hours} h`) : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** One entry per distinct item; a place visited on two days is one row with days [3, 5]. */
function collectCategories(days: PublicDay[], extra: CategoryItem[]): Record<Category, CategoryItem[]> {
  const cats = emptyCategories();
  const index = new Map<string, CategoryItem>();
  for (const d of days) {
    const items = d.tracks ? d.tracks.flatMap((t) => t.items) : d.items;
    for (const it of items) {
      if (!it.category) continue;
      // two names that resolve to one page (a merged duplicate: the sight and the adventure of one place) are one stop of the trip, one row (3.62b)
      const nm = normName(it.name);
      const key = it.placeSlug ?? `${it.kind}:${nm}`;
      const found = index.get(key);
      if (found) {
        if (!found.days.includes(d.n)) found.days.push(d.n);
        continue;
      }
      const row: CategoryItem = {
        key, category: it.category, name: it.name, kind: it.kind, placeSlug: it.placeSlug, days: [d.n], time: it.time, areaLabel: null,
        detail: [statsLine(it.stats), it.access].filter(Boolean).join(' · ') || null, nights: null, bookRule: null, bookNote: null,
      };
      index.set(key, row);
      cats[it.category].push(row);
    }
  }
  for (const e of extra) cats[e.category].push(e);
  for (const c of CATEGORIES) {
    cats[c].forEach((r) => r.days.sort((a, b) => a - b));
    cats[c].sort((a, b) => (a.days[0] ?? 0) - (b.days[0] ?? 0) || (a.time ?? '').localeCompare(b.time ?? '') || a.name.localeCompare(b.name));
  }
  return cats;
}

/** Runs of the same base across consecutive days -> bases with nights. The last day (departure) has no night. */
function basesFromRuns(days: { n: number; base: string | null }[], nights: number | null): PublicBase[] {
  const runs: PublicBase[] = [];
  for (const d of days) {
    if (!d.base) continue;
    const last = runs[runs.length - 1];
    if (last && last.name === d.base) {
      last.days.push(d.n);
      last.nights += 1;
    } else runs.push({ id: kebab(d.base), name: d.base, nights: 1, days: [d.n], point: null });
  }
  if (nights !== null) {
    let over = runs.reduce((s, r) => s + r.nights, 0) - nights;
    for (let i = runs.length - 1; i >= 0 && over > 0; i--) {
      const cut = Math.min(over, runs[i].nights - 1);
      runs[i].nights -= cut;
      over -= cut;
    }
  }
  return runs;
}

function stayRows(bases: PublicBase[]): CategoryItem[] {
  return bases.map((b) => ({
    key: `stay:${b.id}`, category: 'stays' as const, name: b.name, kind: 'stay', placeSlug: null, days: b.days, time: null, areaLabel: null,
    detail: `${b.nights} night${b.nights === 1 ? '' : 's'}`, nights: b.nights, bookRule: null, bookNote: null,
  }));
}

function parseDriveMin(text: string): number | null {
  const m = /(\d+)\s*min/.exec(text);
  if (m) return Number(m[1]);
  const h = /(\d+(?:\.\d+)?)\s*h(?:ours?)?\b/.exec(text);
  return h ? Math.round(Number(h[1]) * 60) : null;
}

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** [4,5,9] -> "April to May and September": a season label made from the months alone. */
export function monthsLabel(months: number[]): string {
  const runs: number[][] = [];
  for (const m of [...months].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1];
    if (last && m === last[last.length - 1] + 1) last.push(m);
    else runs.push([m]);
  }
  return runs.map((r) => (r.length === 1 ? MONTH_NAMES[r[0]] : `${MONTH_NAMES[r[0]]} to ${MONTH_NAMES[r[r.length - 1]]}`)).join(' and ');
}

/** data/trips/stop-refs.json as folder -> normalised stop name -> capture ref. */
function readStopRefs(root: string): Record<string, Record<string, string>> {
  const file = path.join(root, 'data', 'trips', 'stop-refs.json');
  if (!existsSync(file)) return {};
  const doc = JSON.parse(readFileSync(file, 'utf8')) as { trips?: Record<string, Record<string, string>> };
  return Object.fromEntries(Object.entries(doc.trips ?? {}).map(([folder, stops]) => [folder, Object.fromEntries(Object.entries(stops).map(([n, ref]) => [normName(n), ref]))]));
}

/** data/trips/covers.json: the trips whose cover is a photo of their own gallery instead of the legacy page hero, by legacy folder (R4-T2, review M8). */
function readCovers(root: string): Record<string, { from: 'gallery'; index: number }> {
  const file = path.join(root, 'data', 'trips', 'covers.json');
  if (!existsSync(file)) return {};
  const doc = JSON.parse(readFileSync(file, 'utf8')) as { trips?: Record<string, { from?: string; index?: number }> };
  return Object.fromEntries(Object.entries(doc.trips ?? {}).flatMap(([folder, c]) => (c.from === 'gallery' && Number.isInteger(c.index) && (c.index as number) >= 0 ? [[folder, { from: 'gallery' as const, index: c.index as number }]] : [])));
}

export function buildTrips(src: Sources, pb: PlaceBuild, log: DropLog): TripBuild {
  const snap = src.snapshot;
  const protoPlace = new Map(snap.places.map((p) => [p.id, p]));
  const pubTrip = new Map<string, ProtoPubTrip>(snap.publicTrips.map((t) => [PUBLIC_TRIP_FOLDER[t.id], t]));
  const built = new Map<string, string>();
  const trips: PublicTrip[] = [];

  // a stop joins its place by capture ref first (data/trips/stop-refs.json), by name only when the stop is not listed there (backlog 3.40)
  const stopRefs = readStopRefs(src.root);
  const covers = readCovers(src.root);
  // Kind-aware (3.54, 3.57): when a name belongs to a trail page and a sight or place page, a trail stop takes the trail and any other stop takes the place.
  const pagesByName = new Map<string, typeof pb.places>();
  for (const pg of pb.places) pagesByName.set(normName(pg.name), [...(pagesByName.get(normName(pg.name)) ?? []), pg]);
  const slugForName = (name: string, folder = '', kind?: string): string | null => {
    const ref = stopRefs[folder]?.[normName(name)];
    const byRef = ref ? pb.byCaptureRef.get(ref) : undefined;
    if (byRef) return byRef;
    const hit = pb.byName.get(normName(name));
    if (hit?.length === 1) return hit[0]!;
    if (!kind) return null;
    // the name lookup leaves out a name two pages share (a trail and its trailhead lake); the stop's own kind tells them apart
    const wantTrail = kind === 'trail';
    const same = (hit?.length ? hit.map((slug) => pb.bySlug.get(slug)).filter((p): p is NonNullable<typeof p> => !!p) : (pagesByName.get(normName(name)) ?? []));
    const fit = same.filter((p) => (p.kind === 'trail') === wantTrail && p.kind !== 'stay');
    return fit.length === 1 ? fit[0]!.slug : null;
  };

  for (const folder of Object.keys(TRIP_SLUGS).sort()) {
    const vis = folderVisibility(src.manifest.get(folder));
    if (vis === 'private' || !src.manifest.get(folder)?.served) continue;
    const slug = TRIP_SLUGS[folder];
    const hub = src.hub.get(folder);
    const pub = pubTrip.get(folder);
    const where = `trip ${slug}`;
    const full = folder === 'dolomites-july-2027' ? 'dolomites' : folder === 'canadian-rockies-sept-2029' && src.rockies ? 'rockies' : null;
    const depth = full ? 'full' : pub ? 'summary' : 'overview';

    // ---- title, season, length ----
    const rawTitle = pub?.title ?? '';
    let title = undatedTitle(pub?.title ?? (hub?.title ?? folder.replace(/-/g, ' ')).split(' — ')[0]);
    if (!pub) title = undated(title, `${where} title`, log) ?? kebab(folder.replace(/-?(19|20)\d\d$/, '')).replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
    const subtitle = [undatedSentences(pub?.summary ?? hub?.subtitle ?? '', `${where} subtitle`, log), suitabilityFromTitle(rawTitle)].filter(Boolean).join(' ');
    const season: Season | null = pub
      ? {
          months: pub.season.months,
          label: undated(pub.season.label, `${where} season label`, log) ?? monthsLabel(pub.season.months),
          why: undatedSentences(pub.season.why, `${where} season reason`, log),
          weather: {
            tempC: pub.season.weather.tempC,
            rain: undatedSentences(pub.season.weather.rain, `${where} weather`, log),
            daylight: undatedSentences(pub.season.weather.daylight, `${where} weather`, log),
            notes: pub.season.weather.notes.map((n) => undatedSentences(n, `${where} weather note`, log)).filter(Boolean),
          },
        }
      : null;
    const hubNights = hub ? Number(/(\d+)\s+nights?/.exec(hub.duration)?.[1] ?? (/(\d+)\s+days?/.exec(hub.duration) ? Number(/(\d+)\s+days?/.exec(hub.duration)![1]) - 1 : NaN)) : NaN;
    let nights: number | null = Number.isFinite(hubNights) ? hubNights : null;
    if (full === 'dolomites') nights = snap.trip.nights;
    else if (full === 'rockies') nights = src.rockies!.itinerary.recommended.nights;
    else if (pub) nights = pub.nights;

    // ---- days ----
    let days: PublicDay[] = [];
    let bases: PublicBase[] = [];
    let extraCats: CategoryItem[] = [];
    const sunMonths = season?.months ?? [];

    if (full === 'dolomites') {
      const dolo = pub!;
      const placeOf = (id: string) => protoPlace.get(id)!;
      const town = (id: string | null) => (id ? placeOf(id) : null);
      days = snap.trip.days.map((d, i) => {
        const items: DayItem[] = [];
        for (const it of d.items) {
          const p = placeOf(it.placeId);
          const km = mapPrototypeKind(p.kind);
          let kind: DayItemKind = 'sight';
          let subkind: string | null = null;
          if (p.kind === 'airport') kind = 'airport';
          else if (p.kind === 'parking') kind = 'parking';
          else if (km) ({ kind, subkind } = km);
          const placeSlug = pb.byProtoId.get(it.placeId) ?? null;
          const place = placeSlug ? pb.bySlug.get(placeSlug) : null;
          let note: string | null = it.note ?? null;
          if (note) {
            const range = sunRange(p.lat, p.lng, snap.trip.zone, sunMonths);
            note = undatedSentences(relativeSun(note, range), `${where} day ${d.n} note`, log) || null;
          }
          items.push({
            id: it.id, name: p.name, kind, subkind, category: categoryOf(kind), foldedInto: null, placeSlug, time: it.time ?? null, variant: it.variant ?? null,
            durationMin: p.durationMin ?? null, note, stats: place && kind === 'trail' ? place.stats : null, access: null,
          });
        }
        // a car park is folded into the walk or lake it serves
        items.forEach((it, idx) => {
          if (it.kind !== 'parking') return;
          const target = items.slice(idx + 1).find((x) => x.kind !== 'parking') ?? null;
          it.foldedInto = target?.id ?? null;
          if (target) target.access = `Park at ${it.name.replace(/ parking$/i, '')}`;
        });
        const bt = town(d.baseTown);
        return {
          n: d.n, title: undated(d.title, `${where} day ${d.n} title`, log) ?? `Day ${d.n}`, baseId: d.baseTown, base: bt?.name ?? null,
          driveMin: dolo.days[i]?.driveMin ?? null, driveIsEstimate: true, summary: null, items, tracks: null, ...noTimeline(),
        };
      });
      bases = basesFromRuns(days.map((d) => ({ n: d.n, base: d.base })), nights);
      for (const b of bases) {
        const bp = [...protoPlace.values()].find((p) => p.name === b.name);
        const ps = bp ? pb.byProtoId.get(bp.id) : null;
        b.point = ps ? (pb.bySlug.get(ps)?.point ?? null) : null;
        b.id = bp?.id ?? b.id;
      }
      days.forEach((d) => {
        const b = bases.find((x) => x.days.includes(d.n));
        d.baseId = b?.id ?? null;
      });
      extraCats = stayRows(bases);
      for (const l of snap.trip.logistics) {
        const rule: BookRule | null = (l as { bookRule?: { daysBefore: number; dayN: number | null; time: string | null; tz: string | null } }).bookRule ?? null;
        extraCats.push({
          key: `logistics:${l.id}`, category: 'logistics', name: l.label, kind: l.kind, placeSlug: null, days: l.dayN ? [l.dayN] : [], time: null, areaLabel: null,
          detail: rule ? `Opens ${rule.daysBefore} days before Day ${rule.dayN}` : (l.bookNote ?? null), nights: null, bookRule: rule, bookNote: l.bookNote ?? null,
        });
      }
    } else if (full === 'rockies') {
      const R = src.rockies!;
      const byId = <T extends { id?: unknown }>(rows: T[]) => new Map(rows.map((r) => [String(r.id), r as Record<string, unknown>]));
      const trails = byId(R.trails);
      const sights = byId(R.sights);
      const adventures = byId(R.adventures);
      const baseName = new Map(R.bases.map((b) => [b.id, b.name]));
      const bookings = byId(R.bookings);
      const labels: Record<'A' | 'B' | 'C', string> = { A: 'Adults', B: 'Whole family', C: 'Easy day' };
      const trackItems = (day: RockiesDay, id: 'A' | 'B' | 'C', t: RockiesTrack): Track => {
        const items: DayItem[] = [];
        const seen = new Set<string>();
        const mk = (kind: DayItemKind, subkind: string | null, rec: Record<string, unknown>, n: number): DayItem => {
          const name = String(rec.name);
          const stats = kind === 'trail' ? { distanceKm: typeof rec.km === 'number' ? rec.km : null, gainM: typeof rec.gain_m === 'number' ? rec.gain_m : null, hours: rec.hours ? String(rec.hours) : null } : null;
          return {
            id: `${day.n}-${id}-${n}`, name, kind, subkind, category: categoryOf(kind), foldedInto: null, placeSlug: slugForName(name, folder, kind), time: null, variant: id, durationMin: null,
            note: null, stats, access: null,
          };
        };
        // an adventure that is also a sight (the gondola) is one item, the adventure
        for (const a of t.adventure_ids ?? []) {
          const rec = adventures.get(a);
          if (!rec || seen.has(a)) continue;
          seen.add(a);
          const type = String(rec.type);
          items.push(mk(type === 'gondola' ? 'lift' : 'activity', type, rec, items.length + 1));
        }
        for (const s of t.sight_ids ?? []) {
          const rec = sights.get(s);
          if (!rec || seen.has(s)) continue;
          seen.add(s);
          // a sight and an adventure that name one page are one stop (3.62b): the adventure, added first, stays
          const item = mk('sight', 'landmark', rec, items.length + 1);
          if (item.placeSlug && items.some((o) => o.placeSlug === item.placeSlug)) continue;
          items.push(item);
        }
        for (const tr of t.trail_ids ?? []) {
          const rec = trails.get(tr);
          if (!rec || seen.has(tr)) continue;
          seen.add(tr);
          items.push(mk('trail', 'hike', rec, items.length + 1));
        }
        items.sort((a, b) => ['trail', 'sight', 'viewpoint', 'lift', 'activity'].indexOf(a.kind) - ['trail', 'sight', 'viewpoint', 'lift', 'activity'].indexOf(b.kind));
        return { id, label: labels[id], title: undated(t.title, `${where} day ${day.n} track ${id}`, log) ?? `Track ${id}`, items, notes: undatedSentences(t.notes, `${where} day ${day.n} track ${id} notes`, log) || null };
      };
      days = R.itinerary.days.map((d) => {
        const tracks: Track[] = [];
        if (d.track_a) tracks.push(trackItems(d, 'A', d.track_a));
        if (d.track_b) tracks.push(trackItems(d, 'B', d.track_b));
        if (d.track_c) tracks.push(trackItems(d, 'C', d.track_c));
        const union: DayItem[] = [];
        for (const t of tracks) for (const it of t.items) if (!union.some((u) => u.name === it.name || (it.placeSlug && u.placeSlug === it.placeSlug))) union.push(it);
        return {
          n: d.n, title: undated(d.track_b?.title ?? d.summary, `${where} day ${d.n} title`, log) ?? `Day ${d.n}`, baseId: d.base_id, base: baseName.get(d.base_id) ?? null,
          driveMin: parseDriveMin(d.drive), driveIsEstimate: true, summary: undatedSentences(stripMarkers(d.summary).text, `${where} day ${d.n} summary`, log) || null, items: union, tracks, ...noTimeline(),
        };
      });
      let cursor = 0;
      bases = R.itinerary.bases.map((b, i) => {
        const span = days.slice(cursor, cursor + b.nights).map((d) => d.n);
        cursor += b.nights;
        return { id: `${b.base_id}-${i + 1}`, name: baseName.get(b.base_id) ?? b.base_id, nights: b.nights, days: span, point: null };
      });
      const dayBase = new Map<number, string>();
      bases.forEach((b) => b.days.forEach((n) => dayBase.set(n, b.id)));
      days.forEach((d) => { d.baseId = dayBase.get(d.n) ?? d.baseId; });
      extraCats = stayRows(bases);
      const used = new Map<string, number[]>();
      for (const d of R.itinerary.days) for (const b of d.booking_ids) used.set(b, [...(used.get(b) ?? []), d.n]);
      for (const [id, dns] of used) {
        const b = bookings.get(id);
        if (!b || /lodging/.test(id)) continue;
        extraCats.push({
          key: `logistics:${id}`, category: 'logistics', name: String(b.item), kind: 'booking', placeSlug: null, days: dns, time: null, areaLabel: null,
          detail: null, nights: null, bookRule: null,
          bookNote: undatedSentences(String(b.deadline_note ?? b.sells_out_note ?? ''), `${where} booking ${id}`, log) || null,
        });
      }
    } else if (pub) {
      days = pub.days.map((d) => {
        const items: DayItem[] = [];
        d.stops.forEach((s: ProtoStop, i) => {
          const sk = STOP_KINDS[s.kind];
          if (!sk) return; // a drive stop is the day's drive, not an item
          items.push({
            id: `${d.n}-${i + 1}`, name: s.name, kind: sk.kind, subkind: sk.subkind, category: categoryOf(sk.kind), foldedInto: null, placeSlug: slugForName(s.name, folder, sk.kind), time: null,
            variant: null, durationMin: s.durationMin, note: s.note ? undatedSentences(s.note, `${where} day ${d.n} stop`, log) || null : null, stats: null, access: null,
          });
        });
        return { n: d.n, title: undated(d.title, `${where} day ${d.n} title`, log) ?? `Day ${d.n}`, baseId: kebab(d.base), base: d.base, driveMin: d.driveMin, driveIsEstimate: true, summary: null, items, tracks: null, ...noTimeline() };
      });
      bases = basesFromRuns(days.map((d) => ({ n: d.n, base: d.base })), nights);
      // a base that is also a place page with a point is a signpost on the route map, so a day of unplaced stops can frame its base (T5)
      for (const b of bases) {
        const hit = pb.byName.get(normName(b.name));
        if (hit?.length === 1) b.point = pb.bySlug.get(hit[0]!)?.point ?? null;
      }
      days.forEach((d) => { d.baseId = bases.find((b) => b.days.includes(d.n))?.id ?? null; });
      extraCats = stayRows(bases);
    }

    const categories = depth === 'overview' ? emptyCategories() : collectCategories(days, extraCats);

    // ---- the timeline: scheduler inputs per day and the default profile's schedule ----
    const schedule =
      depth === 'overview'
        ? null
        : attachTimeline({
            kind: full ?? 'summary', slug, src, days, bases, seasonMonths: sunMonths, ageFit: pub?.ageFit ?? null, log,
            ...(full === 'dolomites' ? { protoPlaces: protoPlace, protoDays: snap.trip.days } : {}),
            ...(full === null && pub ? { pub } : {}),
          });

    // ---- photos ----
    const gallery: Photo[] = [];
    for (const sec of src.galleries.get(folder)?.sections ?? []) {
      for (const ph of sec.photos) {
        const p = makePhoto(ph.file, src.credits, { caption: ph.caption ?? '', author: ph.author, licence: ph.license, group: sec.place });
        if (p) gallery.push(p);
      }
    }
    const heroFile = fileFromUrl(hub?.img);
    const hero = heroFile ? makePhoto(heroFile, src.credits, { width: 1600, caption: title }) : null;
    // a trip may name a photo of its own gallery as the cover (data/trips/covers.json); otherwise the page hero, then the first gallery photo
    const chosen = covers[folder]?.from === 'gallery' ? gallery[covers[folder]!.index] : undefined;
    const cover = (chosen ? { ...chosen, url: chosen.url.replace(/width=\d+/, 'width=1600'), width: 1600 } : null) ?? hero ?? (gallery[0] ? { ...gallery[0], url: gallery[0].url.replace(/width=\d+/, 'width=1600'), width: 1600 } : null);

    // ---- honesty and status ----
    const h: Honesty[] = [];
    if (depth === 'overview') h.push(honesty('overview_only', 'This plan has not been converted to days yet.'));
    if (depth === 'summary') h.push(honesty('condensed', 'A shorter day list with the main stops, not the whole plan.'));
    if (days.some((d) => d.driveIsEstimate)) h.push(honesty('drive_estimated', 'Drive times are estimates, not routed.'));
    const startYear = hub?.date ? Number(hub.date.slice(0, 4)) : 0;
    if (depth !== 'overview' && startYear >= 2027) h.push(honesty('pattern_2026', 'Opening times and prices were read in 2026 and are used as a pattern.'));
    let isDone = false;
    if (hub?.date && nights !== null) isDone = Date.parse(hub.date) + (nights + 1) * 86_400_000 < Date.parse(src.today);

    const region = pub?.region ?? hub?.region ?? '';
    const effort = pub?.effort ?? null;
    const built1: PublicTrip = {
      schedule,
      slug, title, subtitle, depth, visibility: vis, nights, daysCount: days.length || (nights !== null ? nights + 1 : null), seasonNotSet: !season, isDone, region, cover, season,
      firstBase: bases[0]?.name ?? (region.split(',')[0]?.trim() || null), legacyUrl: `/${folder}/`, honesty: uniqueHonesty(h),
      bases, days, categories, gallery, effort, ageFit: statedAge(pub?.ageFit ?? null, schedule), driveAvgMin: pub?.driveAvgMin ?? null,
    };
    // no research marker reaches a public string (spec 5.1); the timeline's own strings were cleaned as they were made
    trips.push(scrubMarkers(built1));
    built.set(folder, slug);
  }
  trips.sort((a, b) => a.slug.localeCompare(b.slug));
  return { trips, built };
}
