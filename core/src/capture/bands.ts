// Facet bands for the list rows (capture contract 7.3). `bandsOf(world, ref)` turns one record, its suitability record and the
// offers that sell it into six labels. A gap gives null: nothing here is ever guessed. Pure; no I/O (the world is loaded elsewhere).
import type { CaptureRecord } from "../schema/capture/records.ts";
import type { SuitabilityBlock, SuitabilityRecord } from "../schema/suitability.ts";
import { valOf, familyEffortOf, kidsFromBasisOf, strollerOkOf } from "../suitability/derive.ts";
import { incomingOf, primaryRef } from "./records.ts";
import type { World } from "./records.ts";
import { EFFORT_NAMES, MAX_FLAGS } from "./bandKeys.ts";
import type { BookingBand, ListBands, PriceBand, TimeBand } from "./bandKeys.ts";

export * from "./bandKeys.ts";

/** Upper bounds of "$" and "$$" in the price's own currency; above the second is "$$$". Per person, an adult. Unknown currency: no band. */
export const PRICE_LIMITS: Record<string, readonly [number, number]> = {
  CAD: [25, 75],
  USD: [20, 60],
  EUR: [20, 60],
  CHF: [25, 70],
  GBP: [18, 50],
  ISK: [3000, 9000],
  ARS: [20000, 60000],
  CLP: [20000, 60000],
  CRC: [10000, 30000],
  NOK: [200, 600],
};

export function timeBandOf(minutes: number): TimeBand {
  if (minutes < 60) return "<1h";
  if (minutes < 120) return "1-2h";
  if (minutes <= 240) return "2-4h";
  if (minutes <= 420) return "half-day";
  if (minutes <= 720) return "full-day";
  return "multi-day";
}

export function priceBandOf(amount: number, currency: string): PriceBand | null {
  if (amount === 0) return "free";
  const lim = PRICE_LIMITS[currency];
  if (!lim) return null;
  return amount <= lim[0] ? "$" : amount <= lim[1] ? "$$" : "$$$";
}

const BOOKING_RANK: Record<BookingBand, number> = { none: 0, recommended: 1, required: 2 };

type WindowVal = NonNullable<CaptureRecord["window"]>["v"];
export function bookingOf(w: WindowVal): BookingBand | null {
  if (!w) return null;
  switch (w.rule) {
    case "anytime":
    case "on_arrival":
    case "same_day":
      return "none";
    case "rolling":
      return w.sellout && w.sellout.kind !== "never" && w.sellout.kind !== "unknown" ? "required" : "recommended";
    default:
      return "required";
  }
}

const mid = (r: [number, number] | readonly [number, number]): number => (r[0] + r[1]) / 2;
const isTrailType = (t: string): boolean => t.startsWith("nature.trail") || t.startsWith("nature.trek");
const isSightType = (t: string): boolean => t.startsWith("culture") || t.startsWith("animals.see");

interface Linked {
  cap: CaptureRecord;
  suit: SuitabilityRecord | null;
}

/** The record's own capture and suitability, then the offers that sell it (`at` or `on` it: a lift's ticket, a raft trip at a lake). */
function linkedOffers(world: World, ref: string): Linked[] {
  const inc = incomingOf(world, ref);
  const out: Linked[] = [];
  for (const o of new Set([...inc.at, ...inc.on])) {
    const cap = world.cap.get(o)?.rec;
    if (cap && cap.layer === "offer") out.push({ cap, suit: world.suit.get(o)?.rec ?? null });
  }
  return out;
}

function flagsOf(blocks: { block: SuitabilityBlock; rec: SuitabilityRecord }[]): string[] {
  const yes: string[] = [];
  const no: string[] = [];
  const put = (id: string, v: boolean | null) => {
    if (v === null || yes.includes(id) || no.includes(`!${id}`)) return;
    (v ? yes : no).push(v ? id : `!${id}`);
  };
  for (const { block: b, rec } of blocks) {
    const swim = rec.ext?.kind === "water" ? valOf(rec.ext.swimming) : null;
    if (swim) put("swim", swim === "allowed" || swim === "seasonal");
    const lg = valOf(b.water_safety?.lifeguard);
    if (lg !== null) put("lifeguard", lg);
    const st = strollerOkOf(rec);
    if (st === "yes") put("stroller", true);
    else if (st === "partly") put("stroller_part", true);
    else if (st === "no") put("stroller", false);
    const wc = valOf(b.wheelchair);
    if (wc) put("step_free", wc === "step_free");
    const dogs = rec.ext?.kind === "trail" ? valOf(rec.ext.dogs) : null;
    if (dogs) put("dogs", dogs !== "banned");
    const guide = valOf(b.participation?.guide);
    if (guide) put("guided", guide !== "none");
    const toil = valOf(b.toilets);
    if (toil) put("toilets", toil.some((t) => t !== "none"));
    const cr = valOf(b.change_rooms);
    if (cr !== null) put("change_rooms", cr);
    const fenced = b.exposure ? valOf(b.exposure)?.fenced ?? null : null;
    if (fenced) put("fenced", fenced === "fenced");
  }
  return [...yes, ...no].slice(0, MAX_FLAGS);
}

export function bandsOf(world: World, rawRef: string): ListBands {
  const ref = primaryRef(world, rawRef);
  const cap = world.cap.get(ref)?.rec ?? null;
  const own = world.suit.get(ref)?.rec ?? null;
  const offers = linkedOffers(world, ref);
  const suits = [own, ...offers.map((o) => o.suit)].filter((s): s is SuitabilityRecord => s !== null);

  // effort and kids: the record's own, else the offers that sell it
  const effortRec = own ?? offers.find((o) => o.suit)?.suit ?? null;
  const fe = effortRec ? familyEffortOf(effortRec) : null;
  let kids: ReturnType<typeof kidsFromBasisOf> = null;
  for (const s of suits) {
    const k = kidsFromBasisOf(s);
    if (k && (kids === null || k.value < kids.value)) kids = k;
  }

  // time: the type's own time property
  const type = cap?.type ?? "";
  let minutes: number | null = null;
  if (own && isTrailType(type)) {
    const t = valOf(own.suitability.adult_time_min);
    if (t) minutes = mid(t);
  } else if (own && isSightType(type)) {
    const t = valOf(own.suitability.on_site_min);
    if (t) minutes = mid(t);
  }
  if (minutes === null) {
    for (const c of [cap, ...offers.map((o) => o.cap)]) {
      const d = c ? valOf(c.duration_min) ?? valOf(c.activity_min) : null;
      if (d) {
        minutes = mid(d);
        break;
      }
    }
  }
  const time = minutes !== null ? timeBandOf(minutes) : type.startsWith("nature.trek") ? "multi-day" : null;
  return finish(fe, kids, time, cap, offers, own, suits);
}

function finish(fe: number | null, kids: ReturnType<typeof kidsFromBasisOf>, time: TimeBand | null, cap: CaptureRecord | null, offers: Linked[], own: SuitabilityRecord | null, suits: SuitabilityRecord[]): ListBands {
  // price: the lowest adult per-person price among the record and its offers
  let best: { amount: number; currency: string } | null = null;
  for (const c of [cap, ...offers.map((o) => o.cap)]) {
    for (const p of valOf(c?.price) ?? []) {
      if (p.per !== "person" && p.per !== "adult") continue;
      if (p.age_from !== undefined && p.age_from > 17) continue;
      if (best === null || p.amount < best.amount) best = { amount: p.amount, currency: p.currency };
    }
  }
  // booking: the strictest window among the record and its offers
  let booking: BookingBand | null = null;
  for (const c of [cap, ...offers.map((o) => o.cap)]) {
    const b = bookingOf(valOf(c?.window));
    if (b && (booking === null || BOOKING_RANK[b] > BOOKING_RANK[booking])) booking = b;
  }
  const blocks = (own ? [own] : suits).map((rec) => ({ block: rec.suitability, rec }));
  return {
    effort: fe === null ? null : EFFORT_NAMES[fe - 1]!,
    kids_from: kids?.value ?? null,
    kids_basis: kids?.basis ?? null,
    time_band: time,
    price_band: best ? priceBandOf(best.amount, best.currency) : null,
    booking,
    flags: flagsOf(blocks),
  };
}
