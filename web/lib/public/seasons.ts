import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DropLog, undated, undatedSentences } from './dateless';
import type { Season } from './types';

/**
 * data/seasons/<trip>.json (schema trip-season-basic/1, written by the D6a data lane): the season of a trip that has no seed season. Read at build
 * time through the adapter, so no page loads it (P8, P9). Each field is `{ value, basis, ... }`; `basis: "plan"` means the value is only the plan's
 * own window, not a researched season, and the reason line must say so.
 */
export const SEASON_SCHEMA = 'trip-season-basic/1';

interface Field<T> { value: T; basis: string }

export interface SeasonFile {
  schema: typeof SEASON_SCHEMA;
  trip: string;
  season: {
    months: Field<number[]>;
    label: Field<string>;
    why: Field<string>;
    weather: { tempC: Field<string>; rain: Field<string>; daylight: Field<string>; notes: Field<string>[] };
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function field<T>(v: unknown, what: string, file: string, ok: (x: unknown) => x is T): Field<T> {
  if (!isObj(v) || !ok(v.value) || typeof v.basis !== 'string' || !v.basis) throw new Error(`${file}: season.${what} must be { value, basis }`);
  return { value: v.value, basis: v.basis };
}
const isStr = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const isMonths = (x: unknown): x is number[] => Array.isArray(x) && x.length > 0 && x.every((m) => Number.isInteger(m) && m >= 1 && m <= 12);

/** Checks the shape of one file; throws with the file name so a bad file fails the build. */
export function parseSeasonFile(raw: unknown, file: string): SeasonFile {
  if (!isObj(raw) || raw.schema !== SEASON_SCHEMA) throw new Error(`${file}: schema must be ${SEASON_SCHEMA}`);
  if (typeof raw.trip !== 'string') throw new Error(`${file}: trip must be a string`);
  const s = raw.season;
  if (!isObj(s) || !isObj(s.weather)) throw new Error(`${file}: season and season.weather are required`);
  const w = s.weather;
  const notes = w.notes;
  if (!Array.isArray(notes)) throw new Error(`${file}: season.weather.notes must be a list`);
  return {
    schema: SEASON_SCHEMA,
    trip: raw.trip,
    season: {
      months: field(s.months, 'months', file, isMonths),
      label: field(s.label, 'label', file, isStr),
      why: field(s.why, 'why', file, isStr),
      weather: {
        tempC: field(w.tempC, 'weather.tempC', file, isStr),
        rain: field(w.rain, 'weather.rain', file, isStr),
        daylight: field(w.daylight, 'weather.daylight', file, isStr),
        notes: notes.map((n, i) => field(n && isObj(n) ? { value: n.text, basis: n.basis } : n, `weather.notes[${i}]`, file, isStr)),
      },
    },
  };
}

/**
 * The season of `slug` from data/seasons/<slug>.json, in the adapter's Season shape, or null when there is no file. Texts go through the dateless
 * rule like every other public text. A season that is only the plan's own window (`basis: "plan"`) always says so in the reason line.
 */
export function readSeason(root: string, slug: string, log: DropLog, monthsLabel: (months: number[]) => string): Season | null {
  const file = path.join(root, 'data', 'seasons', `${slug}.json`);
  if (!existsSync(file)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${file}: not valid JSON (${(e as Error).message})`);
  }
  const { season: s } = parseSeasonFile(raw, file);
  const where = `trip ${slug}`;
  let why = undatedSentences(s.why.value, `${where} season reason`, log);
  if (s.months.basis === 'plan' && !/\bplan\b|\bplan's\b/i.test(why)) why = `This is the plan's own window. ${why}`.trim();
  return {
    months: s.months.value,
    label: undated(s.label.value, `${where} season label`, log) ?? monthsLabel(s.months.value),
    why,
    weather: {
      tempC: s.weather.tempC.value,
      rain: undatedSentences(s.weather.rain.value, `${where} weather`, log),
      daylight: undatedSentences(s.weather.daylight.value, `${where} weather`, log),
      notes: s.weather.notes.map((n) => undatedSentences(n.value, `${where} weather note`, log)).filter(Boolean),
    },
  };
}
