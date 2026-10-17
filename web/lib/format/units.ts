export type DistanceUnit = 'km' | 'mi';
export type ElevationUnit = 'm' | 'ft';
export type TemperatureUnit = 'C' | 'F';
export type Density = 'comfortable' | 'compact';

export interface Prefs {
  distance: DistanceUnit;
  elevation: ElevationUnit;
  temperature: TemperatureUnit;
  /** Display currency; conversion arrives with fx in P5a. */
  currency: string;
  density: Density;
}

export const PREFS_KEY = 'travel:v1:prefs';

export const METRIC: Prefs = { distance: 'km', elevation: 'm', temperature: 'C', currency: 'CAD', density: 'comfortable' };
export const IMPERIAL: Prefs = { distance: 'mi', elevation: 'ft', temperature: 'F', currency: 'USD', density: 'comfortable' };

const KM_PER_MI = 1.609344;
const FT_PER_M = 3.280839895;

/** Defaults from the browser locale: en-US gets imperial, everyone else metric. */
export function defaultPrefs(language?: string): Prefs {
  return (language ?? '').toLowerCase() === 'en-us' ? { ...IMPERIAL } : { ...METRIC };
}

/** Stored prefs over locale defaults; unknown or invalid values fall back per field. */
export function parsePrefs(raw: string | null, language?: string): Prefs {
  const base = defaultPrefs(language);
  if (!raw) return base;
  try {
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      distance: p.distance === 'km' || p.distance === 'mi' ? p.distance : base.distance,
      elevation: p.elevation === 'm' || p.elevation === 'ft' ? p.elevation : base.elevation,
      temperature: p.temperature === 'C' || p.temperature === 'F' ? p.temperature : base.temperature,
      currency: typeof p.currency === 'string' && /^[A-Z]{3}$/.test(p.currency) ? p.currency : base.currency,
      density: p.density === 'compact' ? 'compact' : 'comfortable',
    };
  } catch {
    return base;
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Distances to one decimal, in km or miles. Input is kilometres. */
export function formatDistance(km: number, unit: DistanceUnit): string {
  const v = unit === 'mi' ? km / KM_PER_MI : km;
  return `${round1(v).toFixed(1)} ${unit}`;
}

/** Elevations to the nearest 10, in metres or feet. Input is metres. */
export function formatElevation(m: number, unit: ElevationUnit): string {
  const v = unit === 'ft' ? m * FT_PER_M : m;
  const nearest = Math.round(v / 10) * 10;
  return `${nearest.toLocaleString('en-US')} ${unit}`;
}

/** Temperatures to the nearest degree. Input is Celsius. */
export function formatTemperature(c: number, unit: TemperatureUnit): string {
  const v = unit === 'F' ? (c * 9) / 5 + 32 : c;
  return `${Math.round(v)}°${unit}`;
}

/** Money for display in the chosen currency code; no conversion here (fx arrives in P5a). */
export function formatMoney(amount: number, currency: string, locale = 'en-CA'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
