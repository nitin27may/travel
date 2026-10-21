import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanNote } from '@/lib/public/trail-places';
import { createPublicData } from '@/lib/public';
import { readText, walkFiles } from '../helpers';
import { builtOutDir } from '../helpers/built';

const MARKER = /\b(INFERENCE|CALC|GAP)\b|low confidence|in the dataset/;

describe('research markers never reach a trail page', () => {
  it('drops marker sentences and keeps the rest; a marker-only value becomes empty', () => {
    expect(cleanNote('Snow in the Notch can last. Open but challenging. Gain GAP.')).toBe('Snow in the Notch can last. Open but challenging.');
    expect(cleanNote('Grizzly country. Group rule: GAP (page 404), INFERENCE only.')).toBe('Grizzly country.');
    expect(cleanNote('GAP')).toBe('');
    expect(cleanNote('GAP: distances not found; no search result.')).toBe('');
    expect(cleanNote(undefined)).toBe('');
  });
  it('every place in the adapter is free of them', () => {
    for (const p of createPublicData().internals.places) {
      const text = [p.summary, p.seasonNote, p.notes, ...p.hazards, ...p.facts.flatMap((f) => [f.value, f.provenance]), p.stats.hours].join(' | ');
      expect(text, p.slug).not.toMatch(MARKER);
    }
  });
  it('every built place page is free of them in its visible text', () => {
    const pages = walkFiles(path.join(builtOutDir(), 'places')).filter((f) => f.endsWith('index.html'));
    expect(pages.length).toBeGreaterThan(100);
    for (const f of pages) {
      const text = readText(f).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
      expect(text, f).not.toMatch(MARKER);
    }
  });
});
