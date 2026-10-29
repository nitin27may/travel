// Layer L2, the model (driving-time-model.md 4.3; DT-1a). Pure, synchronous, deterministic and integer-rounded: no file, clock or
// network. The parameters come in as a DriveIndex built once from the data files (load.ts reads them; tests build them in memory).
//
//   detour(t, d) = D[t] x (1 + 0.35 x e^(-d / 10))
//   road_km      = d x detour(t, d) x K_detour(c, t, d)
//   speed        = V(c, d) x R(d) x K_speed(c, t, d)         R and K read along the band centres (DRIVE_MODEL.bandKnots)
//   V(c, d)      = (1 - W(d)) x V_rural[c] + W(d) x V_motorway[c] x Rm / R(d)   W: the motorway share of a leg
//                  (DRIVE_MODEL.motorwayShare, less with mountain ends), Rm the motorway's realisation; 0 when an end has no motorway limit
//   minutes      = road_km / speed x 60 (unpaved share capped, winter factor) + 2, then segments, crossings, border, city entry
//   range        = minutes x [Q10, Q90] of the calibration cell (the prior range when uncalibrated)
//
// A leg's terrain is the harder of its two ends (the larger D); its speed the mean of the two ends' rural limits. A point with no
// country profile takes V_rural 80 and terrain hilly, and the answer drops to `rough`. A point that arrives without a subdivision or an
// area takes them from the authored boxes first (`contextOf`, RB-008).
import { DRIVE_MODEL, DRIVE_TERRAINS } from "../config/drive.ts";
import { haversineKm } from "../geo/distance.ts";
import {
  borderMin, cityEntryMin, closedSeasonMin, crossingFor, ferryMin, segmentEffect, segmentsFor, unpavedMinutes, winterFactor,
} from "./modifiers.ts";
import type { AreaRow, CalibrationCell, CalibrationFile, CrossingRow, ProfileRow, SegmentRow } from "./schema.ts";
import type { DriveEstimate, DriveExplanation, DriveFlag, ModelPoint, DriveTerrain, ModelOptions } from "./types.ts";

/** The parsed data files the model reads. */
export interface DriveData {
  profiles: readonly ProfileRow[];
  areas: readonly AreaRow[];
  crossings: readonly CrossingRow[];
  segments: readonly SegmentRow[];
  calibration: Pick<CalibrationFile, "cells"> | null;
}

/** A subdivision or area box (schema.ts `box`), with its size for the smallest-first lookup. */
export interface ContextBox {
  cc: string;
  sub: string | null;
  area: string | null;
  box: readonly [number, number, number, number];
  size: number;
}

/** The data, indexed once. */
export interface DriveIndex {
  profiles: ReadonlyMap<string, ProfileRow>;
  areas: ReadonlyMap<string, AreaRow>;
  crossings: readonly CrossingRow[];
  segments: readonly SegmentRow[];
  cells: ReadonlyMap<string, CalibrationCell>;
  /** the subdivision boxes and the area boxes, smallest first (ties by id) */
  subBoxes: readonly ContextBox[];
  areaBoxes: readonly ContextBox[];
}

export const profileKey = (cc: string, sub: string | null | undefined): string => (sub ? `${cc}-${sub}` : cc);
export const cellKey = (cc: string, terrain: DriveTerrain, band: string): string => `${cc}|${terrain}|${band}`;

const sizeOf = (b: readonly [number, number, number, number]): number => (b[2] - b[0]) * (b[3] - b[1]);
const bySize = (x: ContextBox, y: ContextBox): number => x.size - y.size || ((x.area ?? x.sub ?? "") < (y.area ?? y.sub ?? "") ? -1 : 1);

export function indexDriveData(data: DriveData): DriveIndex {
  const subBoxes = data.profiles.flatMap((r): ContextBox[] => (r.sub && r.box ? [{ cc: r.cc, sub: r.sub, area: null, box: r.box, size: sizeOf(r.box) }] : [])).sort(bySize);
  const areaBoxes = data.areas.flatMap((r): ContextBox[] => (r.box ? [{ cc: r.area.slice(0, 2), sub: null, area: r.area, box: r.box, size: sizeOf(r.box) }] : [])).sort(bySize);
  return {
    profiles: new Map(data.profiles.map((r) => [profileKey(r.cc, r.sub), r])),
    areas: new Map(data.areas.map((r) => [r.area, r])),
    crossings: data.crossings,
    segments: data.segments,
    cells: new Map((data.calibration?.cells ?? []).map((c) => [c.cell, c])),
    subBoxes,
    areaBoxes,
  };
}

const boxHit = (boxes: readonly ContextBox[], p: ModelPoint): ContextBox | null =>
  boxes.find((b) => b.cc === p.cc && p.lon >= b.box[0] && p.lat >= b.box[1] && p.lon <= b.box[2] && p.lat <= b.box[3]) ?? null;

/**
 * A point's subdivision and area when it arrives without them (`undefined`: not known; `null`: known to be none, never boxed). The area
 * is the smallest area box that holds the point; the subdivision is the one its area id names (`CA/AB/...`), else the smallest
 * subdivision box that holds it. A catalogue row, a hub and an airport carry only a country, and a Canadian point with no province
 * has no rural limit at all: the model then guessed 80 km/h on hilly terrain and ran 25 to 40 % long (review TB-R1 RB-008).
 */
export function contextOf(idx: DriveIndex, p: ModelPoint): ModelPoint {
  if ((p.sub !== undefined && p.area !== undefined) || !p.cc) return p;
  const area = p.area !== undefined ? p.area : boxHit(idx.areaBoxes, p)?.area ?? null;
  let sub = p.sub;
  if (sub === undefined) {
    const named = area ? /^[A-Z]{2}\/([A-Z0-9]{1,3})\//.exec(area)?.[1] : undefined;
    sub = named ?? boxHit(idx.subBoxes, p)?.sub ?? null;
  }
  return { ...p, sub, area };
}

/** The straight-line band index of spec 4.3 (0: under 10 km ... 4: over 150 km). */
export function bandIndex(km: number): number {
  const edges = DRIVE_MODEL.bandEdges;
  let i = 0;
  while (i < edges.length && km >= edges[i]!) i++;
  return i;
}
export const bandId = (km: number): string => DRIVE_MODEL.bandIds[bandIndex(km)]!;

/** A per-band value read at `km`: linear between the band knots (DRIVE_MODEL.bandKnots), flat outside them. */
export function alongBands(km: number, values: readonly number[]): number {
  const k = DRIVE_MODEL.bandKnots;
  if (km <= k[0]!) return values[0]!;
  for (let i = 1; i < k.length; i++) {
    if (km <= k[i]!) {
      const t = (km - k[i - 1]!) / (k[i]! - k[i - 1]!);
      return values[i - 1]! + t * (values[i]! - values[i - 1]!);
    }
  }
  return values[values.length - 1]!;
}

/** detour(t, d): road km per straight km (spec 4.3). */
export function detourOf(terrain: DriveTerrain, km: number): number {
  return DRIVE_MODEL.detourByTerrain[terrain] * (1 + DRIVE_MODEL.shortHopExtra * Math.exp(-km / DRIVE_MODEL.shortHopScale));
}

const subRow = (idx: DriveIndex, p: ModelPoint): ProfileRow | null => (p.cc && p.sub ? idx.profiles.get(profileKey(p.cc, p.sub)) ?? null : null);
const ccRow = (idx: DriveIndex, p: ModelPoint): ProfileRow | null => (p.cc ? idx.profiles.get(p.cc) ?? null : null);

/** The rural limit of a point: its subdivision's, else its country's; null when neither row gives one. */
export function ruralOf(idx: DriveIndex, p: ModelPoint): { kmh: number; rows: string[] } | null {
  const s = subRow(idx, p);
  if (s?.legal.rural != null) return { kmh: s.legal.rural, rows: [profileKey(s.cc, s.sub)] };
  const c = ccRow(idx, p);
  if (c?.legal.rural != null) return { kmh: c.legal.rural, rows: [c.cc] };
  return null;
}

/** The motorway limit of a point: its subdivision's, else its country's; null when neither row gives one. */
export function motorwayOf(idx: DriveIndex, p: ModelPoint): number | null {
  return subRow(idx, p)?.legal.motorway ?? ccRow(idx, p)?.legal.motorway ?? null;
}

/** The terrain of a point: its area's, else its subdivision's, else its country's; null when none is known. */
export function terrainOf(idx: DriveIndex, p: ModelPoint): DriveTerrain | null {
  return (p.area ? idx.areas.get(p.area)?.terrain : undefined) ?? subRow(idx, p)?.terrain ?? ccRow(idx, p)?.terrain ?? null;
}

/** The harder of two terrains: the larger D, ties broken by the order of DRIVE_TERRAINS. */
export function harderTerrain(a: DriveTerrain, b: DriveTerrain): DriveTerrain {
  const D = DRIVE_MODEL.detourByTerrain;
  if (D[a] !== D[b]) return D[a] > D[b] ? a : b;
  return DRIVE_TERRAINS.indexOf(a) >= DRIVE_TERRAINS.indexOf(b) ? a : b;
}

const uniqFlags = (f: DriveFlag[]): DriveFlag[] => [...new Set(f)].sort();

/** The model's answer and every factor behind it. */
export function explainDrive(a0: ModelPoint, b0: ModelPoint, opts: ModelOptions, idx: DriveIndex): { estimate: DriveEstimate; explanation: DriveExplanation } {
  const a = contextOf(idx, a0);
  const b = contextOf(idx, b0);
  const vehicle = opts.vehicle ?? "car";
  const month = opts.month;
  const d = haversineKm(a, b);
  const bi = bandIndex(d);
  const band = DRIVE_MODEL.bandIds[bi]!;
  const ra = ruralOf(idx, a);
  const rb = ruralOf(idx, b);
  const profiled = ra !== null && rb !== null;
  const ta = terrainOf(idx, a);
  const tb = terrainOf(idx, b);
  const ruralKmh = profiled ? (ra.kmh + rb.kmh) / 2 : (ra ?? rb)?.kmh ?? DRIVE_MODEL.fallbackRuralKmh;
  // a longer leg runs more of its way on a motorway (RB-008: Toronto to Muskoka on the 400, Calgary to Banff on the Trans-Canada)
  const ma = profiled ? motorwayOf(idx, a) : null;
  const mb = profiled ? motorwayOf(idx, b) : null;
  const motorwayKmh = ma !== null && mb !== null ? (ma + mb) / 2 : null;
  // mountain roads are not motorways: a leg between two mountain ends takes none of the share, a leg out of the mountains half of it
  const hard = (t: DriveTerrain | null): boolean => t !== null && (DRIVE_MODEL.motorwayFreeTerrains as readonly string[]).includes(t);
  const hardEnds = Number(hard(ta ?? DRIVE_MODEL.fallbackTerrain)) + Number(hard(tb ?? DRIVE_MODEL.fallbackTerrain));
  const share = motorwayKmh !== null && motorwayKmh > ruralKmh ? alongBands(d, DRIVE_MODEL.motorwayShare) * DRIVE_MODEL.motorwayEndsFactor[hardEnds]! : 0;
  // the motorway part runs nearer its limit than a rural road does (the routers drive motorways at about the posted limit)
  const limitKmh = (1 - share) * ruralKmh + share * (motorwayKmh ?? ruralKmh) * (DRIVE_MODEL.motorwayRealisation / alongBands(d, DRIVE_MODEL.realisation));
  const terrain: DriveTerrain = ta && tb ? harderTerrain(ta, tb) : ta ?? tb ?? DRIVE_MODEL.fallbackTerrain;
  const detour = detourOf(terrain, d);
  const realisation = alongBands(d, DRIVE_MODEL.realisation);
  const sameCc = !!a.cc && a.cc === b.cc;
  const cellId = profiled && sameCc ? cellKey(a.cc as string, terrain, band) : null;
  const cell = cellId ? idx.cells.get(cellId) ?? null : null;
  // the factors of the (country, terrain) cells of every band, read along the band knots like R; an uncalibrated band counts 1
  const cells = profiled && sameCc ? DRIVE_MODEL.bandIds.map((b) => idx.cells.get(cellKey(a.cc as string, terrain, b)) ?? null) : null;
  const kDetour = cells ? alongBands(d, cells.map((c) => c?.detour.factor ?? 1)) : 1;
  const kSpeed = cells ? alongBands(d, cells.map((c) => c?.speed.factor ?? 1)) : 1;
  const roadKm = d * detour * kDetour;
  const speed = limitKmh * realisation * kSpeed;
  const areaA = a.area ? idx.areas.get(a.area) ?? null : null;
  const areaB = b.area ? idx.areas.get(b.area) ?? null : null;
  const unpaved = ((areaA?.unpavedShare ?? 0) + (areaB?.unpavedShare ?? 0)) / 2;
  const flags: DriveFlag[] = unpaved > 0 ? ["unpaved"] : [];
  const modifiers: DriveExplanation["modifiers"] = [];

  let driving = unpavedMinutes(roadKm, speed, unpaved);
  const baseMinutes = driving + DRIVE_MODEL.parkMin;
  const profA = subRow(idx, a) ?? ccRow(idx, a);
  const winter = winterFactor(month, [profA, subRow(idx, b) ?? ccRow(idx, b)], [areaA, areaB]);
  if (winter.factor !== 1) {
    const extra = driving / winter.factor - driving;
    modifiers.push({ name: "winter", minutes: extra, note: `winter factor ${winter.factor}` });
    driving += extra;
    flags.push(...winter.flags);
  }

  const explanation = (): DriveExplanation => ({
    straightKm: d, band, terrain, profiles: profiled ? [...new Set([...ra.rows, ...rb.rows])] : null, ruralKmh, motorwayShare: share, limitKmh, detour, realisation,
    kDetour, kSpeed, calibrationCell: cell ? cell.cell : null, roadKm, baseMinutes, modifiers,
  });

  // authored segments first: a closed or 4x4-only stretch ends the estimate; a fixed one replaces it
  let fixed: number | null = null;
  for (const row of segmentsFor(idx.segments, a, b)) {
    const eff = segmentEffect(row, month, vehicle);
    if (!eff) continue;
    flags.push(...eff.flags);
    if (eff.kind === "stop") {
      modifiers.push({ name: `segment ${row.id}`, minutes: 0, note: eff.note });
      return { estimate: { minutes: null, km: null, range: null, confidence: "none", source: "segment", flags: uniqFlags(flags), attribution: null }, explanation: explanation() };
    }
    if (eff.kind === "factor") {
      const extra = driving * (eff.factor - 1);
      modifiers.push({ name: `segment ${row.id}`, minutes: extra, note: eff.note });
      driving += extra;
    }
    if (eff.kind === "fixed") fixed = eff.minutes;
  }
  if (fixed !== null) {
    modifiers.push({ name: "segment fixed", minutes: fixed, note: "authored minutes" });
    return { estimate: { minutes: fixed, km: Math.round(roadKm), range: null, confidence: "authored", source: "segment", flags: uniqFlags(flags), attribution: null }, explanation: explanation() };
  }

  let minutes = driving + DRIVE_MODEL.parkMin;
  const add = (name: string, r: { minutes: number; flags: DriveFlag[]; note: string }): void => {
    if (r.minutes === 0 && r.flags.length === 0) return;
    modifiers.push({ name, minutes: r.minutes, note: r.note });
    minutes += r.minutes;
    flags.push(...r.flags);
  };
  const crossing = crossingFor(idx.crossings, a.area, b.area);
  if (crossing?.kind === "ferry") add("ferry", ferryMin(crossing, month, profA?.ferryCheckinMin ?? null));
  if (crossing?.kind === "closed-season") add("closed-season", closedSeasonMin(crossing, month));
  add("border", borderMin(a.cc, b.cc, a.cc ? idx.profiles.get(a.cc) ?? null : null, b.cc ? idx.profiles.get(b.cc) ?? null : null));
  add("city entry", cityEntryMin([a.population, b.population]));

  const out = Math.max(1, Math.round(minutes));
  const [q10, q90] = cell?.range ?? DRIVE_MODEL.priorRange;
  return {
    estimate: {
      minutes: out,
      km: Math.round(roadKm),
      range: [Math.round(out * q10), Math.max(out, Math.round(out * q90))],
      confidence: profiled ? "modelled" : "rough",
      source: "model",
      flags: uniqFlags(flags),
      attribution: null,
    },
    explanation: explanation(),
  };
}

/** L2 only: synchronous, no I/O (build-time pages, tests, the client re-flow). */
export function modelDrive(a: ModelPoint, b: ModelPoint, opts: ModelOptions, idx: DriveIndex): DriveEstimate {
  return explainDrive(a, b, opts, idx).estimate;
}

/** The model bound to one index: `(a, b, opts) => DriveEstimate`, the signature of spec 6.1. */
export function createModel(idx: DriveIndex): (a: ModelPoint, b: ModelPoint, opts?: ModelOptions) => DriveEstimate {
  return (a, b, opts = {}) => modelDrive(a, b, opts, idx);
}
