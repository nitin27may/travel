/** Shared wording for trips. Public trips are dateless: days, nights and a season, never calendar dates. */

export function lengthLabel(nights: number | null, days: number | null): string {
  if (days === null) return '';
  if (!nights) return days === 1 ? 'Day trip' : `${days} days`;
  return `${nights} ${nights === 1 ? 'night' : 'nights'} · ${days} days`;
}

/** 70 -> "1 h 10", 45 -> "45 min" */
export function hoursMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** "≈1 h 10" for an estimate, "1 h 10" for a stored road time. */
export function driveLabel(min: number | null, estimate: boolean): string | null {
  if (min === null) return null;
  return `${estimate ? '≈' : ''}${hoursMinutes(min)}`;
}

export const DEPTH_LABEL = { full: 'Full plan', summary: 'Condensed', overview: 'Overview only' } as const;
export const DEPTH_NOTICE = { summary: 'Condensed from the full plan', overview: 'Overview only' } as const;

export const tripHref = (slug: string): string => `/trips/${slug}/`;

const stops = (n: number): string => `${n} ${n === 1 ? 'stop' : 'stops'}`;
/** A day's map count: "3 stops", "2 stops, 1 not on the map", or "1 stop not on the map" when none is placed (never "0 stops"). */
export function dayStopsLabel(placed: number, unplaced: number): string {
  if (placed === 0 && unplaced > 0) return `${stops(unplaced)} not on the map`;
  return unplaced > 0 ? `${stops(placed)}, ${unplaced} not on the map` : stops(placed);
}

/** The map caption of a picked day. A day with no placed stop frames its base when the base has a point, and says so; with no base point it says the day has no mapped stops. */
export function dayMapCaption(day: { n: number; base: string | null; points: number; unplaced: number }, baseOnMap: boolean): string {
  const head = `Map: Day ${day.n}${day.base ? `, ${day.base}` : ''}`;
  if (day.points === 0 && day.unplaced > 0) {
    return baseOnMap
      ? `${head}. ${day.unplaced} ${day.unplaced === 1 ? 'stop is' : 'stops are'} not on the map, so the base is shown`
      : `Day ${day.n} has no stops on the map`;
  }
  return `${head}, ${dayStopsLabel(day.points, day.unplaced)}`;
}
