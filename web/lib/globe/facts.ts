import type { CountryFacts } from './types';

/** 59,000,000 -> "59M people"; small counts keep their digits. */
export function populationLine(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B people`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M people`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k people`;
  return `${n} people`;
}

/** The live facts every country keeps whether or not anything is saved there: capital, people, area. */
export function factsLine(c: CountryFacts | undefined): string {
  if (!c) return '';
  return [c.capital ? `Capital ${c.capital}` : '', c.population ? populationLine(c.population) : '', c.area ? `${Math.round(c.area).toLocaleString('en-CA')}\u00a0km²` : ''].filter(Boolean).join(' \u00b7 ');
}

export function languagesLine(c: CountryFacts | undefined): string {
  return c?.languages?.length ? c.languages.slice(0, 3).join(', ') : '';
}
