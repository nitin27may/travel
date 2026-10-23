// Trip legs for JsonStore (D-E5, store.ts A34): the routed legs of one trip from its data file (`trip-legs/1` or `/2`, written by the
// legs fetcher), keyed by the PUBLIC stop keys of the trip detail. The file's own `from` and `to` are the fetcher's pair keys (a
// prototype place id, a base town), which are never served: this module walks the detail's days, names each consecutive pair of stops
// by its pair keys through the source's `pairKeyOf`, finds the file's leg for that pair (either direction) and answers it under the
// stop keys. A pair the file has no leg for is simply absent (the map draws it as a dashed estimate, T5).
//
// Every geometry passes `safeOutline` here, at load, so a polyline that touches the household radius is served as no geometry (the
// leg then draws dashed with its km and minutes kept: A33 rule 3). The mapping runs in the loader's code, never at SQL time (A34 parity).
import { decodePolyline5, encodePolyline5, type TripDetail, type TripLeg, type TripLegs, type TripLegsFile } from "../../schema/api/index.ts";
import { safeOutline } from "../../privacy/towns.ts";

/** What a source hands over for a trip that has a legs file. */
export interface LegsSource {
  file: TripLegsFile;
  /** The pair key the file uses for a stop of the detail: a day item's `id` or `base:<base id>`. Null when the stop has none. */
  pairKeyOf(stopKey: string): string | null;
}

type FileLeg = TripLegsFile["legs"][number] & { geometry?: string };

/** The geometry of a file leg in the direction it is asked, run through the town guard; null when it has none or the guard refuses it. */
function geometryOf(leg: FileLeg, reversed: boolean): string | null {
  if (!leg.geometry) return null;
  const guarded = safeOutline(leg.geometry);
  if (guarded === null) return null;
  if (!reversed) return guarded;
  const pts = decodePolyline5(guarded);
  return pts ? encodePolyline5([...pts].reverse()) : null;
}

/** Day by day, the stops in the order the page shows them: each variant and track lane is its own run, bracketed by the day's bases. */
function runsOf(detail: TripDetail): { day: number; stops: string[] }[] {
  const runs: { day: number; stops: string[] }[] = [];
  detail.days.forEach((day, i) => {
    const end = day.baseId ? `base:${day.baseId}` : null;
    // a day that changes base starts where the previous night was spent
    const prev = detail.days[i - 1]?.baseId;
    const start = i === 0 ? null : prev ? `base:${prev}` : end;
    const bracket = (ids: string[]): string[] => [...(start ? [start] : []), ...ids, ...(end ? [end] : [])];
    const variants = [...new Set(day.items.map((it) => it.variant).filter((v): v is string => !!v))];
    if (variants.length) for (const v of variants) runs.push({ day: day.n, stops: bracket(day.items.filter((it) => !it.variant || it.variant === v).map((it) => it.id)) });
    else runs.push({ day: day.n, stops: bracket(day.items.map((it) => it.id)) });
    for (const track of day.tracks ?? []) runs.push({ day: day.n, stops: bracket(track.items.map((it) => it.id)) });
  });
  return runs;
}

/**
 * The legs answer for a trip. More than API_LIMITS.tripLegs.max legs is returned whole so the store can answer `too_large`
 * (the cap is the store's, and is tested there), not cut here.
 */
export function tripLegsOf(detail: TripDetail, src: LegsSource): TripLegs {
  const byPair = new Map<string, { leg: FileLeg; reversed: boolean }>();
  for (const leg of src.file.legs as FileLeg[]) {
    byPair.set(`${leg.from}|${leg.to}`, { leg, reversed: false });
    if (!byPair.has(`${leg.to}|${leg.from}`)) byPair.set(`${leg.to}|${leg.from}`, { leg, reversed: true });
  }
  const out: TripLeg[] = [];
  const seen = new Set<string>();
  for (const run of runsOf(detail)) {
    for (let i = 0; i + 1 < run.stops.length; i++) {
      const [from, to] = [run.stops[i]!, run.stops[i + 1]!];
      const [a, b] = [src.pairKeyOf(from), src.pairKeyOf(to)];
      if (!a || !b || a === b) continue;
      const hit = byPair.get(`${a}|${b}`);
      const key = `${run.day}|${from}|${to}`;
      if (!hit || seen.has(key)) continue;
      seen.add(key);
      out.push({ day: run.day, from, to, mode: hit.leg.mode, km: hit.leg.km, minutes: hit.leg.minutes, geometry: geometryOf(hit.leg, hit.reversed) });
    }
  }
  return { ref: detail.ref, slug: detail.slug, legs: out, attribution: src.file.attribution, fetched: src.file.fetched };
}

/** A trip with no legs file answers no legs. */
export const noLegs = (detail: Pick<TripDetail, "ref" | "slug">): TripLegs => ({ ref: detail.ref, slug: detail.slug, legs: [], attribution: "", fetched: null });
