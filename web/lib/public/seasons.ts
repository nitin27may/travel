import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { tripSeasonFile, type TripSeasonFile } from '@travel/core/schema/seasons.ts';
import { DropLog, undated, undatedSentences } from './dateless';
import type { Season } from './types';

/**
 * data/seasons/<trip>.json (schema trip-season-basic/1, owned by core/src/schema/seasons.ts): the season of a trip that has no seed season. Read at
 * build time through the adapter, so no page loads it (P8, P9). `months.basis === "plan"` means the window is only the one the plan was written
 * for, not a researched season; the Season then carries `basis: 'plan'` and every surface says so.
 */

/** Parses one file with the core schema; throws with the file name so a bad file fails the build. */
export function parseSeasonFile(raw: unknown, file: string, slug: string): TripSeasonFile {
  const res = tripSeasonFile.safeParse(raw);
  if (!res.success) {
    const i = res.error.issues[0]!;
    throw new Error(`${file}: season file is not trip-season-basic/1 at /${i.path.join('/')}: ${i.message}`);
  }
  if (res.data.trip !== slug) throw new Error(`${file}: "trip" is "${res.data.trip}" but the file is for "${slug}"`);
  return res.data;
}

/**
 * The season of `slug` from data/seasons/<slug>.json, in the adapter's Season shape, or null when there is no file. Texts go through the dateless
 * rule like every other public text.
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
  const { season: s } = parseSeasonFile(raw, file, slug);
  const where = `trip ${slug}`;
  return {
    basis: s.months.basis === 'plan' ? 'plan' : 'researched',
    months: s.months.value,
    label: undated(s.label.value, `${where} season label`, log) ?? monthsLabel(s.months.value),
    why: undatedSentences(s.why.value, `${where} season reason`, log),
    weather: {
      tempC: s.weather.tempC.value,
      rain: undatedSentences(s.weather.rain.value, `${where} weather`, log),
      daylight: undatedSentences(s.weather.daylight.value, `${where} weather`, log),
      notes: s.weather.notes.map((n) => undatedSentences(n.text, `${where} weather note`, log)).filter(Boolean),
    },
  };
}
