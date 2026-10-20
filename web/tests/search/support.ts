import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSearchParts } from '@/lib/search/build';
import type { ParsedQuery, VocabFile } from '@/lib/search/parse/types';
import type { SearchRecord } from '@/lib/search/types';
import { travelRoot } from '@/lib/data/root';
import { WEB } from '../helpers';

export interface Fixture {
  id: number;
  query: string;
  target: 'places' | 'trips' | 'search';
  url: string;
  dym?: string[];
  chip?: string[];
  notYet?: string[];
  unused?: string[];
  ask?: boolean;
  gap?: string[];
}

export const fixtures: Fixture[] = JSON.parse(readFileSync(path.join(WEB, 'tests/search/queries.json'), 'utf8'));
export const vocabPath = path.join(WEB, 'public/search/vocab.json');
export const loadVocab = (): VocabFile => JSON.parse(readFileSync(vocabPath, 'utf8')) as VocabFile;
export const root = travelRoot();
export const readRoot = (rel: string) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

let records: SearchRecord[] | null = null;
/** The records the browser loads: every part of the search index, from the real data. */
export function searchRecords(): SearchRecord[] {
  records ??= Object.values(buildSearchParts().parts).flat();
  return records;
}

/** A URL's keys as sorted `key=value` pairs, so two orders of the same filters compare equal. */
// a comma list in a URL value is a set (area=a,b,c): compare it sorted, so a data change that moves a member never breaks a fixture
export const pairs = (href: string): string[] => [...new URLSearchParams(href.includes('?') ? href.split('?')[1] : href).entries()].map(([k, v]) => `${k}=${v.includes(',') ? v.split(',').sort().join(',') : v}`).sort();

export const labels = (p: ParsedQuery): string[] => p.chips.map((c) => c.label);
