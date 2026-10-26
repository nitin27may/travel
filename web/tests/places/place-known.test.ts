import { describe, expect, it } from 'vitest';
import { getPlace } from '@/lib/public';
import { closingNames, isSafetyProperty, placeKnown } from '@/lib/public/placeKnown';
import { closingWord, type PageModel } from '@/lib/public/sections';

// UXB-C for UXB-7 (trip-and-places-ux-fixes.md 8.3, 8.4; Q300): a place's fields grouped into the sections to draw and one gap
// list, safety gaps kept as rows. Sample of the spec's 8.2 table, one or more per type.
const SAMPLE = [
  'tre-cime-di-lavaredo-loop', 'adolf-munkel-weg', 'parker-ridge', // trail
  'maligne-lake-and-spirit-island', 'lago-di-braies', // lake
  'seceda-ridge', // viewpoint
  'skogafoss', // waterfall
  'cortina-dampezzo', // town
  'arches-national-park', 'castle-provincial-park', // park, area
  'banff-gondola', 'jasper-wildlife-tours', 'bow-river-float-raft', // offer
  'capri', // island
];

const modelOf = (slug: string): { model: PageModel; level: string } => {
  const p = getPlace(slug);
  expect(p, slug).toBeTruthy();
  expect(p!.sections, slug).toBeTruthy();
  return { model: p!.sections!, level: p!.completeness.label };
};

describe('the safety mark comes from the registry (rest!)', () => {
  it('keeps limits, closures, permits, hazards and exposure; not facilities or altitude', () => {
    for (const k of ['min_age', 'min_height_cm', 'max_weight_kg', 'closures', 'access_cost', 'window', 'hazards', 'exposure', 'ext.wildlife.min_distance_m']) expect(isSafetyProperty(k), k).toBe(true);
    for (const k of ['toilets', 'altitude_m', 'bail_out', 'price', 'name', 'not-a-key']) expect(isSafetyProperty(k), k).toBe(false);
  });
  it('reads the closing line back into names, a label with a comma included', () => {
    expect(closingNames('Not checked yet: toilets, nearby, worth adding, minimum age')).toEqual([
      { word: 'toilets', key: 'toilets' }, { word: closingWord('Nearby, worth adding'), key: 'pairs_with' }, { word: 'minimum age', key: 'min_age' },
    ]);
    expect(closingNames(null)).toEqual([]);
    expect(closingNames('Not checked yet: something new')).toEqual([{ word: 'something new', key: null }]);
  });
});

describe('known vs blank on a sample of place types (8.4)', () => {
  for (const slug of SAMPLE) {
    it(slug, () => {
      const { model, level } = modelOf(slug);
      const k = placeKnown(model, level);
      // no section is drawn without a value or a safety gap
      for (const s of k.known) {
        if (s.id === 'links' || s.id === 'around') continue;
        expect(s.rows.length + s.safetyGaps.length, `${slug} ${s.id}`).toBeGreaterThan(0);
        for (const r of s.rows) expect(r.gap, `${slug} ${s.id} ${r.key}`).toBe(false);
      }
      // a safety gap is a row, never a word in the block
      const safetyWords = new Set(k.known.flatMap((s) => s.safetyGaps.map((g) => closingWord(g.label))));
      for (const g of k.gaps) for (const w of g.items) expect(safetyWords.has(w), `${slug}: ${w}`).toBe(false);
      for (const g of k.gaps) for (const w of g.items) {
        const key = closingNames(`Not checked yet: ${w}`)[0]!.key;
        if (key) expect(isSafetyProperty(key), `${slug}: ${w}`).toBe(false);
      }
      // one line per section in the block, no line empty, no name twice in a line
      expect(new Set(k.gaps.map((g) => g.id)).size, slug).toBe(k.gaps.length);
      for (const g of k.gaps) {
        expect(g.items.length, `${slug} ${g.id}`).toBeGreaterThan(0);
        expect(new Set(g.items).size, `${slug} ${g.id}`).toBe(g.items.length);
      }
      // "At this place / On this route / With this you can also" only with an offer
      expect(k.known.some((s) => s.id === 'around'), slug).toBe(model.around.length > 0);
      expect(k.template, slug).toBe(level.startsWith('Basics only') ? 'basics' : 'full');
      expect(k.counts.sectionsDrawn, slug).toBe(k.known.length);
    });
  }

  it('hides sections on the full pages of the sample and gathers their gaps', () => {
    const totals = SAMPLE.map((slug) => {
      const { model, level } = modelOf(slug);
      return placeKnown(model, level).counts;
    });
    expect(totals.reduce((n, c) => n + c.sectionsHidden, 0)).toBeGreaterThan(0);
    expect(totals.reduce((n, c) => n + c.gapItems, 0)).toBeGreaterThan(0);
  });

  it('an offer keeps its limits at rest as safety rows (W10 Jasper wildlife tours)', () => {
    const { model, level } = modelOf('jasper-wildlife-tours');
    const k = placeKnown(model, level);
    const safety = k.known.flatMap((s) => s.safetyGaps.map((g) => g.key));
    const values = k.known.flatMap((s) => s.rows.map((r) => r.key));
    // every limit the page asks for is either a value or a visible gap row; none is only a word in the block
    const asked = model.sections.flatMap((s) => s.rows.map((r) => r.key)).filter(isSafetyProperty);
    for (const key of asked) expect(safety.includes(key) || values.includes(key), key).toBe(true);
    // a safety field the suitability block words differently ("stay in vehicle") is still read back as safety
    expect(safety).toContain('ext.wildlife.stay_in_vehicle');
    expect(k.template).toBe('basics');
    const park = placeKnown(modelOf('castle-provincial-park').model, modelOf('castle-provincial-park').level);
    expect(park.known.flatMap((s) => s.safetyGaps.map((g) => g.key))).toContain('ext.area.pass');
    expect(k.notResearched.slice(0, k.counts.safetyGaps)).toEqual(k.known.flatMap((s) => s.safetyGaps.map((g) => closingWord(g.label))).filter((w, i, a) => a.indexOf(w) === i).slice(0, k.counts.safetyGaps));
  });
});
