import { describe, expect, it, vi } from 'vitest';
import { cardSummary, placeImage } from '@/lib/globe/data';
import { buildGlobeData } from '@/lib/globe/data';
import { describesParty } from '@/lib/public/party';
import { listTrips } from '@/lib/public';
import { factRows, featureClass } from '@/lib/globe/wikidata';
import { directionsUrl } from '@/lib/globe/links';

const q = (amount: number, unit: string) => [{ mainsnak: { datavalue: { value: { amount: `+${amount}`, unit: `http://www.wikidata.org/entity/${unit}` } } } }];
const credited = { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/A.jpg?width=640', width: 640, author: 'Ann', licence: 'CC BY 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg' };

describe('the card summary (spec 4.3)', () => {
  it('is one sentence of at most 120 characters, cut at a word with an ellipsis', () => {
    const long = 'A turquoise lake under the Croda del Becco and the boat house everyone photographs from the east shore at sunrise in summer.';
    const s = cardSummary(long);
    expect(s.length).toBeLessThanOrEqual(120);
    expect(s.endsWith('…')).toBe(true);
    expect(cardSummary('Short one. And a second sentence.')).toBe('Short one.');
    expect(cardSummary('')).toBe('');
  });
  it('is dropped whole when it describes who travelled (privacy)', () => {
    expect(describesParty('Our kids loved it.')).toBe(true);
    expect(cardSummary('Our kids loved it.')).toBe('');
  });
});

describe('the image fallback chain (spec 4.3, A4)', () => {
  const place = (o: object = {}) => ({ name: 'Lago di Braies', photo: null, trips: [{ slug: 't1' }], wikidata: 'Q1', ...o });
  const none = () => [];
  const p18 = { Q1: { file: 'Braies.jpg', author: 'Bo', licence: 'CC BY-SA 4.0' } };

  it('uses the place photo first', () => {
    expect(placeImage(place({ photo: credited }), none, p18)?.from).toBe('place');
  });
  it('then a gallery photo of a public trip that is filed under the place', () => {
    const gallery = () => [{ ...credited, group: 'Other lake' }, { ...credited, group: 'Lago di Braies', author: 'Cy' }];
    const img = placeImage(place(), gallery, p18);
    expect(img?.from).toBe('trip');
    expect(img?.author).toBe('Cy');
  });
  it('then the Wikidata image with its credit, as a Commons file path the build turns into our own rendition', () => {
    const img = placeImage(place(), none, p18);
    expect(img?.from).toBe('wikidata');
    expect(img?.url).toBe('https://commons.wikimedia.org/wiki/Special:FilePath/Braies.jpg?width=640');
    expect(img?.author).toBe('Bo');
  });
  it('then nothing: the card shows the compact header, never an empty well', () => {
    expect(placeImage(place({ wikidata: null }), none, p18)).toBeNull();
    expect(placeImage(place(), none, { Q1: { none: true } })).toBeNull();
  });
  it('never shows a photo without an author and a licence', () => {
    expect(placeImage(place({ photo: { ...credited, licence: '' } }), none, {})).toBeNull();
    expect(placeImage(place(), none, { Q1: { file: 'X.jpg', author: '', licence: 'CC0' } })).toBeNull();
    expect(placeImage(place(), () => [{ ...credited, group: 'Lago di Braies', author: '' }], {})).toBeNull();
  });
});

describe('the built cards', () => {
  const data = buildGlobeData();
  const cards = Object.values(data.cards);
  it('never say "Draft" and carry no household status', () => {
    for (const c of cards) {
      expect(c.badge ?? '', c.key).not.toMatch(/draft/i);
      expect(Object.keys(c), c.key).not.toContain('status');
      expect(`${c.badge} ${c.facts.map((f) => ('text' in f ? f.text : '')).join(' ')}`, c.key).not.toMatch(/planned|shortlisted|dropped|visited|idea/i);
    }
  });
  it('carry at most three facts, a summary of at most 120 characters, and credit on every image', () => {
    for (const c of cards) {
      expect(c.facts.length, c.key).toBeLessThanOrEqual(3);
      expect(c.summary.length, c.key).toBeLessThanOrEqual(120);
      if (c.image) { expect(c.image.author, c.key).toBeTruthy(); expect(c.image.licence, c.key).toBeTruthy(); }
    }
  });
  it('name only listed trips in "used in"', () => {
    const listed = new Set(listTrips().map((t) => t.slug));
    for (const c of cards) if (c.usedIn) expect(listed.has(c.usedIn.slug), c.key).toBe(true);
    expect(cards.some((c) => c.usedIn)).toBe(true);
  });
  it('keep a field out rather than say "unknown"', () => {
    for (const c of cards) expect(JSON.stringify(c.facts), c.key).not.toMatch(/unknown|Not checked/i);
  });
});

describe('Wikidata facts for a feature card (spec 4.3)', () => {
  it('reads a peak, a river and a lake', () => {
    expect(factRows({ claims: { P2044: q(2810, 'Q11573'), P2660: q(500, 'Q11573') } }, 'peak')).toEqual([{ label: 'Elevation', value: '2,810 m' }, { label: 'Prominence', value: '500 m' }]);
    expect(factRows({ claims: { P2043: q(96000, 'Q11573') } }, 'river')).toEqual([{ label: 'Length', value: '96 km' }]);
    expect(factRows({ claims: { P2046: q(3.2, 'Q712226'), P4511: q(20, 'Q11573') } }, 'lake').map((r) => r.value)).toEqual(['3.2 km²', '20 m']);
  });
  it('leaves a row out when the property is missing or in a unit we cannot read', () => {
    expect(factRows({ claims: {} }, 'peak')).toEqual([]);
    expect(factRows({ claims: { P2043: q(5, 'Q99999999') } }, 'river')).toEqual([]);
  });
  it('classes a feature from its tile layer', () => {
    expect(featureClass('waterway', 'river')).toBe('river');
    expect(featureClass('mountain_peak', 'peak')).toBe('peak');
    expect(featureClass('water_name', 'lake')).toBe('lake');
    expect(featureClass('water_name', 'sea')).toBe('sea');
  });
});

describe('loading the facts (cache, timeout, failure)', () => {
  it('reads Wikidata once, caches 30 days, and returns null when the call fails or is slow', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    vi.stubGlobal('window', globalThis);
    let calls = 0;
    vi.doMock('@/lib/client/data', () => ({
      globeWikidata: async (qid: string, signal?: AbortSignal) => {
        calls += 1;
        if (qid === 'Q2') throw new Error('500');
        if (qid === 'Q3') return new Promise((_, rej) => signal?.addEventListener('abort', () => rej(new Error('aborted'))));
        return { claims: { P2044: q(100, 'Q11573') }, labels: { en: { value: 'Peak' } }, sitelinks: { enwiki: { title: 'Peak (hill)' } } };
      },
    }));
    vi.resetModules();
    const m = await import('@/lib/globe/wikidata');
    const a = await m.loadFeatureFacts('Q1', 'peak', 1_000);
    expect(a?.rows).toEqual([{ label: 'Elevation', value: '100 m' }]);
    expect(a?.wikipedia).toBe('https://en.wikipedia.org/wiki/Peak_(hill)');
    await m.loadFeatureFacts('Q1', 'peak', 2_000);
    expect(calls).toBe(1);
    await m.loadFeatureFacts('Q1', 'peak', 1_000 + 31 * 86_400_000);
    expect(calls).toBe(2);
    expect(await m.loadFeatureFacts('Q2', 'peak')).toBeNull();
    expect(await m.loadFeatureFacts('Q3', 'peak')).toBeNull();
    expect(await m.loadFeatureFacts(null, 'peak')).toBeNull();
    vi.doUnmock('@/lib/client/data');
    vi.unstubAllGlobals();
  });
});

describe('directions', () => {
  it('start from our own coordinates', () => {
    expect(directionsUrl({ lat: 46.69, lon: 12.08 })).toBe('https://www.google.com/maps/dir/?api=1&destination=46.69000,12.08000');
  });
});

import { cardImageSources } from '@/lib/globe/cardImage';

// These tests pin the StaticAdapter (the files the build wrote); the API default has its own tests in tests/api.
vi.stubEnv('NEXT_PUBLIC_DATA_ADAPTER', 'static');

describe('card payload and photo weight (review S10, principle P8)', () => {
  const cards = Object.values(buildGlobeData().cards);
  const CARD_KEYS = ['key', 'kind', 'slug', 'title', 'kindLabel', 'glyph', 'areaLabel', 'summary', 'facts', 'usedIn', 'image', 'badge', 'approx', 'href'];
  const IMAGE_KEYS = ['url', 'width', 'author', 'licence', 'sourceUrl', 'from'];
  it('stays inside the card allowlist, field for field', () => {
    for (const c of cards) {
      expect(Object.keys(c).filter((k) => !CARD_KEYS.includes(k)), c.key).toEqual([]);
      if (c.image) expect(Object.keys(c.image).filter((k) => !IMAGE_KEYS.includes(k)), c.key).toEqual([]);
    }
  });
  it('asks for the 320 and 640 renditions only, never the 960', () => {
    for (const u of ['https://commons.wikimedia.org/wiki/Special:FilePath/A.jpg?width=960', '/img/abc123-960.webp', 'https://commons.wikimedia.org/wiki/Special:FilePath/A.jpg']) {
      const s = cardImageSources(u);
      expect(s.src, u).toMatch(/640/);
      expect(s.srcSet ?? '', u).not.toMatch(/960/);
      expect(s.srcSet ?? '', u).toMatch(/320w, .*640w/);
    }
    expect(cardImageSources('https://example.org/x.jpg').srcSet).toBeUndefined();
  });
  it('fills a place card with up to three facts where the data holds them', () => {
    const withFacts = cards.filter((c) => c.kind === 'place' && c.facts.length >= 2);
    // 52 of 210 places hold two or more facts today (132 hold none: the data has no season, kid fit, length, climb, time or minimum age for them)
    expect(withFacts.length).toBeGreaterThanOrEqual(50);
    for (const c of cards) for (const f of c.facts) expect(f.label, c.key).toBeTruthy();
  });
});
