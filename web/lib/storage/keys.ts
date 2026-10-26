// The two device keys of the trip page (trip-and-places-ux-fixes.md 10.2; Q294, Q295): the party and the page's UI state. Both go
// through safe.ts, so a browser that blocks site data gets the defaults every time, silently. Hand-written guards instead of Zod:
// the trip page reads these in its start chunk (about 460 B of headroom), and Zod must stay out of it.
//
// travel.party  { v: 1, adults: 1..12, children: (0..17 | null)[] max 8 }   household data: never in a URL, the export, the share
//               text, analytics or a feedback report (spec 15). A child whose age is not set yet is null and plans as 10 (FAMAGE10).
// travel.tripui { v: 1, partyOpen, trips: { [slug]: { tab, daysView, shapeOpen, rows, asWritten } } }   UI state only, never
//               sensitive; at most 30 trips, the least recently written dropped first.
import { cleanParty, type Party } from '@travel/core/trips/party.ts';
import { isTripTab, type DaysView, type TripTab } from '@travel/core/trips/tabs.ts';
import { readLocal, removeLocal, writeLocal } from './safe';

export const PARTY_KEY = 'travel.party';
export const TRIPUI_KEY = 'travel.tripui';
/** Dispatched on `window` after this tab writes the party (the `storage` event covers other tabs). */
export const PARTY_CHANGED_EVENT = 'travel:party-changed';
export const TRIPUI_MAX_TRIPS = 30;

const parse = (raw: string | null): unknown => {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

// ---- travel.party ---------------------------------------------------------------------------------------------------------

/** The stored party, cleaned to the limits; null when none is kept, the value is not version 1, or storage is blocked. */
export function readParty(): Party | null {
  const v = parse(readLocal(PARTY_KEY));
  if (!isObj(v) || v.v !== 1) return null;
  return cleanParty(v);
}

/** Keeps the party on this device. False when storage is blocked or full (the page keeps working from the URL). */
export function writeParty(p: Party): boolean {
  const clean = cleanParty(p);
  if (!clean) return false;
  const ok = writeLocal(PARTY_KEY, JSON.stringify({ v: 1, adults: clean.adults, children: clean.children }));
  if (ok) {
    try {
      window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
    } catch {
      /* no window (a test or the server): nothing to tell */
    }
  }
  return ok;
}

export const clearParty = (): boolean => removeLocal(PARTY_KEY);

// ---- travel.tripui --------------------------------------------------------------------------------------------------------

/** What the Table view shows: every row, or the stops only (`rows=stops`, the CSV's rows). */
export type TableRows = 'all' | 'stops';

export interface TripUiEntry {
  tab: TripTab;
  daysView: DaysView;
  /** The trip's shape expanded (4.3). */
  shapeOpen: boolean;
  rows: TableRows;
  /** "Plan as written" was chosen on this trip: the kept party is not applied again on landing (Q295). */
  asWritten: boolean;
}

export interface TripUi {
  v: 1;
  /** The party bar's editor open (5.2): collapsed by default. */
  partyOpen: boolean;
  /** In write order, oldest first. */
  trips: Record<string, TripUiEntry>;
}

export const DEFAULT_TRIP_UI_ENTRY: TripUiEntry = { tab: 'summary', daysView: 'list', shapeOpen: false, rows: 'all', asWritten: false };
const emptyUi = (): TripUi => ({ v: 1, partyOpen: false, trips: {} });
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

function cleanEntry(x: unknown): TripUiEntry | null {
  if (!isObj(x)) return null;
  return {
    tab: isTripTab(x.tab) ? x.tab : 'summary',
    daysView: x.daysView === 'table' ? 'table' : 'list',
    shapeOpen: x.shapeOpen === true,
    rows: x.rows === 'stops' ? 'stops' : 'all',
    asWritten: x.asWritten === true,
  };
}

/** The whole UI value, cleaned: unknown fields and bad slugs dropped, at most 30 trips (the most recent). Defaults when blocked. */
export function readTripUi(): TripUi {
  const v = parse(readLocal(TRIPUI_KEY));
  if (!isObj(v) || v.v !== 1) return emptyUi();
  const trips: Record<string, TripUiEntry> = {};
  const rows = isObj(v.trips) ? Object.entries(v.trips) : [];
  for (const [slug, e] of rows.slice(-TRIPUI_MAX_TRIPS)) {
    const clean = SLUG.test(slug) ? cleanEntry(e) : null;
    if (clean) trips[slug] = clean;
  }
  return { v: 1, partyOpen: v.partyOpen === true, trips };
}

/** One trip's remembered state, or the defaults. */
export const readTripEntry = (slug: string): TripUiEntry => readTripUi().trips[slug] ?? { ...DEFAULT_TRIP_UI_ENTRY };

/** The remembered tab for `resolveTripTab`: null when nothing is remembered for the trip (so the URL and the default decide). */
export function rememberedTab(slug: string): { tab: TripTab; daysView: DaysView } | null {
  const e = readTripUi().trips[slug];
  return e ? { tab: e.tab, daysView: e.daysView } : null;
}

/** The value after a patch, without writing: the trip moves to the end (most recent) and the oldest beyond 30 are dropped. Pure. */
export function patchTripUi(ui: TripUi, slug: string, patch: Partial<TripUiEntry>): TripUi {
  if (!SLUG.test(slug)) return ui;
  const before = ui.trips[slug] ?? DEFAULT_TRIP_UI_ENTRY;
  const rest = Object.entries(ui.trips).filter(([k]) => k !== slug);
  const next = cleanEntry({ ...before, ...patch }) ?? { ...DEFAULT_TRIP_UI_ENTRY };
  const trips = Object.fromEntries([...rest, [slug, next]].slice(-TRIPUI_MAX_TRIPS));
  return { ...ui, trips };
}

/** Remembers part of one trip's UI state. False when storage is blocked (the page then opens on the URL and the defaults). */
export function writeTripEntry(slug: string, patch: Partial<TripUiEntry>): boolean {
  return writeLocal(TRIPUI_KEY, JSON.stringify(patchTripUi(readTripUi(), slug, patch)));
}

/** Remembers whether the party editor is open (one value for every trip). */
export function writePartyOpen(open: boolean): boolean {
  return writeLocal(TRIPUI_KEY, JSON.stringify({ ...readTripUi(), partyOpen: open }));
}
