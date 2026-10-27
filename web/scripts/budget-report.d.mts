export const PLACE_MEDIAN_BUDGET: number;
export const PAGE_CAP: number;
export const EXCEPTION_CAP: number;
export const OVER_50: Set<string>;
export const START_JS_BUDGET_KB: number;
export const CHROME_TODAY_BYTES: { public: number; signIn: number };
export const BEACON_ALLOWANCE_BYTES: number;
export const CHROME_HEADROOM_BYTES: number;
export const CHROME_CAP_BYTES: { public: number; signIn: number };

export function startScripts(html: string): string[];
export function gzippedBytes(srcs: string[], resolve: (url: string) => string): number;

export interface Flight {
  text: string;
  pieces: { from: number; to: number; text: string }[];
}
export function flightOf(html: string): Flight;

export interface Chrome {
  markup: number;
  payload: number;
  total: number;
  parts: { header: number; footer: number; bar: number; beacon: number };
  shell: boolean;
  beacon: boolean;
  signIn: boolean;
}
export function chromeOf(html: string): Chrome;
export function chargedChrome(c: Chrome): number;

export interface Baseline {
  note?: string;
  pages: Record<string, number>;
  chrome: Record<string, number>;
}
export interface PlaceRow {
  slug: string;
  was: number;
  now: number;
  page: number;
  chromeNow: number;
  chromeThen: number;
}
export function placeRows(baseline: Baseline, htmlOf: (slug: string) => string | null): PlaceRow[];
export function s13(rows: PlaceRow[]): { median: number; mid: PlaceRow; largest: number; largestWas: number; largestNow: number; over: PlaceRow[] };
export function report(dist?: string): string[];
export function markdown(lines: string[], opts?: { dist?: string; photoCache?: boolean }): string;
export function hasRenditions(): boolean;
