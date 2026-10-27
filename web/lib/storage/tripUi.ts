// The trip page's remembered UI state (`travel.tripui`): see keys.ts for the contract. Imports tabs.ts only, never party.ts (UXB-2 review S6).
import { isTripTab, type DaysView, type TripTab } from '@travel/core/trips/tabs.ts';
import { readLocal, writeLocal } from './safe';

import { TRIPUI_KEY } from './deviceKeys';

export { TRIPUI_KEY };
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
