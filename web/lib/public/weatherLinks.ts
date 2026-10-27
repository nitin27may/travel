// The weather links of a trip for "When to go" (spec trip-and-places-ux-fixes.md 6.3, 6.4; owner Q298: links only, no weather call from our
// pages). The one boundary (P9): the Summary never reads data/** itself. Reads data/reference/weather-links.json (weather-links/1, validated by
// core/src/validate/weatherLinks.ts) at build time, server only, and hands the page the light rows it draws: a label, a URL, the publisher's
// short name, and the language when the page is not English. Zod stays out of this file (the browser start chunk never sees it). Nothing is
// invented here: a row whose publisher is unknown, whose kind is unknown or whose URL is not https is dropped, never repaired.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { travelRoot } from '../data/root';

export type WeatherKind = 'forecast' | 'climate' | 'mountain' | 'aurora';
export const WEATHER_KINDS: readonly WeatherKind[] = ['forecast', 'climate', 'mountain', 'aurora'];

export interface WeatherLinkRow {
  kind: WeatherKind;
  /** The link text: the stored label without its "Forecast: " lead (the row says it). */
  text: string;
  href: string;
  /** "French", "Spanish": the page is not English (the label says it, or this does). Null for an English page. */
  language: string | null;
}

export interface WeatherSource {
  /** The publisher's short name, "Environment Canada". */
  name: string;
  links: WeatherLinkRow[];
}

export interface TripWeather {
  sources: WeatherSource[];
  /** True when some base has no forecast page of its own yet (the file lists a gap for the trip). */
  partial: boolean;
}

interface RawPublisher { short?: string; langs?: string[] }
interface RawLink { kind?: string; label?: string; publisher?: string; url?: string; english?: boolean }
interface RawTrip { trip?: string; links?: RawLink[]; gaps?: unknown[] }

const names = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' });
  } catch {
    return null;
  }
})();

const isHttps = (u: string): boolean => {
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};

/** "Forecast: Banff" -> "Banff"; a label with no lead stays whole ("Climate of Costa Rica"). */
export function linkText(label: string): string {
  const i = label.indexOf(': ');
  return i > 0 && i <= 40 ? label.slice(i + 2).trim() : label.trim();
}

/** Builds one trip's rows from the parsed file; null when the file has nothing usable for the slug. Exported for the tests. */
export function tripWeatherFrom(doc: { publishers?: Record<string, RawPublisher>; trips?: RawTrip[] }, slug: string): TripWeather | null {
  const trip = doc.trips?.find((t) => t.trip === slug);
  if (!trip?.links?.length) return null;
  const sources = new Map<string, WeatherSource>();
  for (const l of trip.links) {
    const pub = l.publisher ? doc.publishers?.[l.publisher] : undefined;
    if (!pub?.short || !l.label || !l.url || !isHttps(l.url) || !WEATHER_KINDS.includes(l.kind as WeatherKind)) continue;
    const text = linkText(l.label);
    const lang = l.english === false ? (pub.langs ?? []).find((c) => c !== 'en') : undefined;
    const language = lang ? (names?.of(lang) ?? null) : null;
    const src = sources.get(l.publisher!) ?? { name: pub.short, links: [] };
    // a label that already names its language ("PDF, Spanish") is not told twice
    src.links.push({ kind: l.kind as WeatherKind, text, href: l.url, language: language && !l.label.toLowerCase().includes(language.toLowerCase()) ? language : null });
    sources.set(l.publisher!, src);
  }
  if (!sources.size) return null;
  return { sources: [...sources.values()], partial: (trip.gaps ?? []).length > 0 };
}

let cache: { root: string; doc: Parameters<typeof tripWeatherFrom>[0] | null } | null = null;

/** The weather links of `slug`, or null when the trip has none (the section is then left out, never drawn empty). */
export function tripWeatherFor(slug: string, root: string = travelRoot()): TripWeather | null {
  if (!cache || cache.root !== root) {
    const file = path.join(root, 'data', 'reference', 'weather-links.json');
    cache = { root, doc: existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Parameters<typeof tripWeatherFrom>[0]) : null };
  }
  return cache.doc ? tripWeatherFrom(cache.doc, slug) : null;
}
