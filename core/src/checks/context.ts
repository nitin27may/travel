// What the day checks need from outside the trip file. P2b ships stubs for the sun and the book-by
// rules; P4a (core/src/sun/, core/src/bookings/bookBy.ts) plugs in the real ones through the same interface.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { addDays } from "./time.ts";

export type Row = Record<string, any>;

export interface Sun {
  sunrise: string;
  sunset: string;
}

export interface CatalogLookup {
  place(id: string): Row | null;
  trail(id: string): Row | null;
  activity(id: string): Row | null;
  eatery(id: string): Row | null;
  stay(id: string): Row | null;
  offer(id: string): Row | null;
  leg(id: string): Row | null;
}

export interface DayCheckCtx {
  /** ISO date of day `n` of the chosen edition, or null when the trip has no chosen edition */
  resolveDate(dayN: number): string | null;
  /** local sunrise and sunset ("HH:MM") for a day at a place, or null when unknown */
  sun(dayN: number, lat: number, lon: number, tz: string): Sun | null;
  /** book-by offset (days from Day 1) of a trip_bookings row, or null */
  bookBy(booking: Row): number | null;
  catalog: CatalogLookup;
  /** ISO date used by W_DEADLINE */
  today: string;
}

/** Stub until P4a: the sun is fixed at 07:00 and 19:00 everywhere. */
export const stubSun = (): Sun => ({ sunrise: "07:00", sunset: "19:00" });
/** Stub until P4a: the stored offset is the answer. */
export const stubBookBy = (booking: Row): number | null => (typeof booking.book_by_offset === "number" ? booking.book_by_offset : null);

/** Date resolver for the chosen (or booked) edition of a trip document: Day 1 is the edition's `start`. */
export function editionResolver(trip: Row): (dayN: number) => string | null {
  const ed = (trip.editions ?? []).find((e: Row) => e.status === "chosen" || e.status === "booked");
  return (n) => (ed && typeof ed.start === "string" ? addDays(ed.start, n - 1) : null);
}

export const emptyCatalog: CatalogLookup = {
  place: () => null, trail: () => null, activity: () => null, eatery: () => null, stay: () => null, offer: () => null, leg: () => null,
};

function readJson(path: string): Row | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Row;
  } catch {
    return null;
  }
}

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir).filter((n) => n.endsWith(".json")).sort().map((n) => join(dir, n));
}

/** Catalog and place lookups read from the files under `root`, indexed on first use. */
export function fsCatalog(root: string): CatalogLookup {
  const cache = new Map<string, Map<string, Row>>();
  const index = (kind: string, dirs: string[], table: string): Map<string, Row> => {
    let m = cache.get(kind);
    if (!m) {
      m = new Map();
      for (const dir of dirs) {
        for (const f of jsonFiles(dir)) {
          const doc = readJson(f);
          const rows = doc?.[table];
          if (Array.isArray(rows)) for (const r of rows) if (r && typeof r.id === "string") m.set(r.id, r);
        }
      }
      cache.set(kind, m);
    }
    return m;
  };
  const cat = (entity: string, table = entity) => (id: string): Row | null => index(entity, [join(root, "data", "catalog", entity)], table).get(id) ?? null;
  return {
    place: (id) => index("places", [join(root, "data", "locations")], "places").get(id) ?? null,
    trail: cat("trails"), activity: cat("activities"), eatery: cat("eateries"), stay: cat("stays"), offer: cat("offers"), leg: cat("legs"),
  };
}

export interface MakeCtxOptions {
  root: string;
  trip: Row;
  today?: string;
  sun?: DayCheckCtx["sun"];
  bookBy?: DayCheckCtx["bookBy"];
  catalog?: CatalogLookup;
}

/** The context the validator CLI, the hooks and the tests use. `TRAVEL_TODAY` pins "today" for reproducible output. */
export function makeContext(o: MakeCtxOptions): DayCheckCtx {
  return {
    resolveDate: editionResolver(o.trip),
    sun: o.sun ?? stubSun,
    bookBy: o.bookBy ?? stubBookBy,
    catalog: o.catalog ?? fsCatalog(o.root),
    today: o.today ?? process.env.TRAVEL_TODAY ?? new Date().toISOString().slice(0, 10),
  };
}
