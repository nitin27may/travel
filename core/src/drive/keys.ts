// The leg cache key grammar (driving-time-model.md 5.6; DT-C defines it, DT-L applies it inside TB-L). Server only: the home refusal
// asks core/src/privacy/home.ts, which reads the environment.
//
//   r:<public ref>   a catalogue point; never a dated trip folder (public-ref-aliases 6.1)
//   t:<geonameid>    a town of the towns layer
//   g:<geohash 6>    any other public point (about 1.2 x 0.6 km)
//
// The visitor's start is never keyed: `VisitorDrivePoint` cannot be passed to `cellKey` or `legCacheKey` (a compile error), and
// `writableLegKey` refuses any pair with an end within HOME_RADIUS_KM of home. Nothing here logs or returns a coordinate of home.
import { DATED_FOLDER_RE } from "../catalogue/alias.ts";
import { DRIVE_CACHE } from "../config/drive.ts";
import { nearHome } from "../privacy/home.ts";
import type { CacheKey, CacheKeyKind, PublicDrivePoint } from "./types.ts";

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const REF_RE = /^[a-z0-9][a-z0-9/#._-]{1,199}$/;
const TOWN_RE = /^[1-9][0-9]{0,9}$/;
const GEOHASH_RE = new RegExp(`^[${BASE32}]{${DRIVE_CACHE.geohashChars}}$`);

/** A yes-or-no home test; the default is the household exclusion (throws when the home point is unset: fail closed). */
export type HomeGuard = (lat: number, lon: number) => boolean;

/** Geohash of a point (standard base32, longitude positive east). */
export function geohash(lat: number, lon: number, chars: number = DRIVE_CACHE.geohashChars): string {
  let latLo = -90, latHi = 90, lonLo = -180, lonHi = 180;
  let out = "";
  let bit = 0, ch = 0, even = true;
  while (out.length < chars) {
    if (even) {
      const mid = (lonLo + lonHi) / 2;
      if (lon >= mid) { ch = (ch << 1) | 1; lonLo = mid; } else { ch <<= 1; lonHi = mid; }
    } else {
      const mid = (latLo + latHi) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; latLo = mid; } else { ch <<= 1; latHi = mid; }
    }
    even = !even;
    if (++bit === 5) { out += BASE32[ch]; bit = 0; ch = 0; }
  }
  return out;
}

/** The box of a geohash cell. */
export function geohashBox(hash: string): { south: number; north: number; west: number; east: number } {
  let latLo = -90, latHi = 90, lonLo = -180, lonHi = 180;
  let even = true;
  for (const c of hash) {
    const v = BASE32.indexOf(c);
    if (v < 0) throw new Error(`not a geohash character: ${c}`);
    for (let i = 4; i >= 0; i--) {
      const on = (v >> i) & 1;
      if (even) { const mid = (lonLo + lonHi) / 2; if (on) lonLo = mid; else lonHi = mid; }
      else { const mid = (latLo + latHi) / 2; if (on) latLo = mid; else latHi = mid; }
      even = !even;
    }
  }
  return { south: latLo, north: latHi, west: lonLo, east: lonHi };
}

/** True when any sample of the cell's grid (corners included) is within the home radius. */
export function cellNearHome(hash: string, guard: HomeGuard = nearHome): boolean {
  const box = geohashBox(hash);
  const n = DRIVE_CACHE.homeGridSide;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const lat = box.south + ((box.north - box.south) * i) / (n - 1);
      const lon = box.west + ((box.east - box.west) * j) / (n - 1);
      if (guard(lat, lon)) return true;
    }
  }
  return false;
}

const brand = (s: string): CacheKey => s as CacheKey;

/** `r:<ref>` for a catalogue point. Throws on a dated folder or a ref outside the grammar. */
export function aliasKey(ref: string): CacheKey {
  if (!REF_RE.test(ref)) throw new Error("E_DRIVE_KEY: not a public ref");
  if (DATED_FOLDER_RE.test(ref)) throw new Error("E_DRIVE_KEY: a dated trip folder is never a key (use the public alias)");
  return brand(`r:${ref}`);
}

/** `t:<geonameid>` for a town of the towns layer. */
export function townKey(geonameId: number): CacheKey {
  if (!Number.isInteger(geonameId) || !TOWN_RE.test(String(geonameId))) throw new Error("E_DRIVE_KEY: not a GeoNames id");
  return brand(`t:${geonameId}`);
}

/**
 * `g:<geohash 6>` for another public point, or null when the cell touches the home radius. The parameter type refuses a
 * VisitorDrivePoint (`visitor: true`): a visitor start is never a cell.
 */
export function cellKey(p: { lat: number; lon: number; visitor?: never }, guard: HomeGuard = nearHome): CacheKey | null {
  const hash = geohash(p.lat, p.lon);
  return cellNearHome(hash, guard) ? null : brand(`g:${hash}`);
}

/** Parse a stored key: the CacheKey when it fits the grammar (a `g:` cell must also clear home), else null. */
export function parseCacheKey(s: string, guard: HomeGuard = nearHome): CacheKey | null {
  const kind = s.slice(0, 2);
  const body = s.slice(2);
  if (kind === "r:") return REF_RE.test(body) && !DATED_FOLDER_RE.test(body) ? brand(s) : null;
  if (kind === "t:") return TOWN_RE.test(body) ? brand(s) : null;
  if (kind === "g:") return GEOHASH_RE.test(body) && !cellNearHome(body, guard) ? brand(s) : null;
  return null;
}

export const keyKind = (k: CacheKey): CacheKeyKind => k.slice(0, 1) as CacheKeyKind;

/**
 * The (from, to) key pair a routed leg may be written under, or null when either end lies within the home radius. Only
 * PublicDrivePoints are accepted (compile time); the point's own coordinates are tested too, whatever its key kind.
 */
export function writableLegKey(a: PublicDrivePoint, b: PublicDrivePoint, guard: HomeGuard = nearHome): { from_cell: CacheKey; to_cell: CacheKey } | null {
  for (const p of [a, b]) {
    if ((p as { visitor?: unknown }).visitor !== undefined) return null; // a cast that slipped past the types
    if (guard(p.lat, p.lon)) return null;
    if (keyKind(p.key) === "g" && cellNearHome(p.key.slice(2), guard)) return null;
  }
  return { from_cell: a.key, to_cell: b.key };
}
