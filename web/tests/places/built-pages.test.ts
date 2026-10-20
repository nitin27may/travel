import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadWorld } from '@travel/core/capture/records.ts';
import { loadSupersedes } from '@travel/core/capture/supersede.ts';
import { accessWords, loadRelevanceContext } from '@/lib/public/relevance';
import { REPO, WEB_DIR } from '../data/support';

// Tests on the BUILT pages (web/out), where the adapter, the section renderers and the data meet. Skipped when there is no build
// (the check-all order builds after the tests, so a clean checkout runs them on the second pass).
const OUT = path.join(WEB_DIR, 'out', 'places');
const built = existsSync(OUT);
const page = (slug: string): string => readFileSync(path.join(OUT, slug, 'index.html'), 'utf8');
const text = (h: string): string => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
const planBLines = (h: string): string[] => [...h.matchAll(/<li class="ps-line rv-planb">([\s\S]*?)<\/li>/g)].map((m) => text(m[1]!).trim());

describe.skipIf(!built)('Plan B on the built pages', () => {
  const world = loadWorld(REPO);
  const ctx = loadRelevanceContext(world, REPO);
  const slugs = readdirSync(OUT).filter((s) => existsSync(path.join(OUT, s, 'index.html')));
  const withPlanB = slugs.filter((s) => planBLines(page(s)).length > 0);

  it('some pages draw a Plan B line', () => {
    expect(withPlanB.length).toBeGreaterThan(0);
  });

  it('Tre Cime shows the hand-picked reason and its source, and no access label that contradicts it', () => {
    const [line] = planBLines(page('tre-cime-di-lavaredo-loop'));
    expect(line, 'Tre Cime has a Plan B line').toBeTruthy();
    const item = [...ctx.derived.values()].find((d) => d.ref.endsWith('tre-cime-di-lavaredo-loop'))!;
    const pb = item.plan_b as unknown as { ref: string; hand_picked?: boolean; reason?: string };
    expect(pb.hand_picked).toBe(true);
    expect(line).toContain('Monte Piana');
    expect(line).toContain(pb.reason!.replace(/[.]$/, ''));
    expect(line).toMatch(/Source: /);
    // the reason says the walk starts at the car park before the toll; the label must not say the way in is a shuttle
    expect(line).not.toMatch(/shuttle or bus only/);
  });

  it('every other Plan B line either gives a hand-picked reason or the access words of its own target, never both stories', () => {
    for (const slug of withPlanB) {
      const h = page(slug);
      for (const line of planBLines(h)) {
        const target = [...ctx.derived.values()].find((d) => d.plan_b && line.includes(world.cap.get(d.plan_b.ref)?.rec.name ?? '\u0000'));
        if (!target?.plan_b) continue;
        const pb = target.plan_b as unknown as { ref: string; access_cost: string[]; hand_picked?: boolean; reason?: string };
        if (pb.hand_picked) expect(line, slug).toContain(pb.reason!.replace(/[.]$/, ''));
        else expect(line, slug).toContain(accessWords(pb.access_cost, ctx.derived.get(pb.ref)?.access_load));
      }
    }
  });
});

describe.skipIf(!built)('a superseded value on the built pages', () => {
  const file = loadSupersedes(REPO)!;
  const world = loadWorld(REPO, undefined, [], { supersede: false });
  const slugOf = (ref: string): string | null => {
    const name = world.cap.get(ref)?.rec.name;
    return name ? readdirSync(OUT).find((s) => existsSync(path.join(OUT, s, 'index.html')) && text(page(s)).includes(name) && new RegExp(`<h1[^>]*>\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(page(s))) ?? null : null;
  };
  // outside the "Sources disagree" panels, the replaced figure must not appear next to the new one
  const visible = (h: string): string => text(h.replace(/<details class="sr su-prov"[\s\S]*?<\/details>/g, ' '));

  it('never shows the original figure beside the superseding one', () => {
    let checked = 0;
    for (const e of file.entries) {
      const unit = /distance_km$/.test(e.path) ? 'km' : /gain_m$/.test(e.path) ? 'm' : null;
      if (!unit || typeof e.was !== 'number') continue;
      const slug = slugOf(e.ref);
      if (!slug) continue;
      const t = visible(page(slug));
      // every pre-supersede figure of the same driver: the lane value and the older migrated one
      const olds = new Set<number>([e.was]);
      const migrated = world.suit.get(e.ref);
      void migrated;
      for (const f of readdirSync(path.join(REPO, 'data', 'suitability')).flatMap((d) => (existsSync(path.join(REPO, 'data/suitability', d, 'migrated.json')) ? [path.join(REPO, 'data/suitability', d, 'migrated.json')] : []))) {
        const rec = (JSON.parse(readFileSync(f, 'utf8')) as { records: { ref: string; suitability?: { effort?: { drivers?: Record<string, { v: unknown }> } } }[] }).records.find((r) => r.ref === e.ref);
        const v = rec?.suitability?.effort?.drivers?.[unit === 'km' ? 'distance_km' : 'gain_m']?.v;
        if (typeof v === 'number') olds.add(v);
      }
      expect(t, `${slug} shows the new ${e.value.v} ${unit}`).toMatch(new RegExp(`\\b${e.value.v}\\s?${unit}\\b`));
      for (const o of olds) if (o !== e.value.v) expect(t, `${slug} still shows ${o} ${unit} outside the disagreement panel`).not.toMatch(new RegExp(`(^|[^\\d.])${String(o).replace('.', '\\.')}\\s?${unit}\\b`));
      checked += 1;
    }
    expect(checked, 'at least one superseded figure is on a built page').toBeGreaterThan(0);
  });
});

// ---- FIXB (REVIEW4 4.27, 4.28, and the place-page fix-soon items) ----------------------------------------------------------------

describe.skipIf(!built)('the Dolomites range page (4.27)', () => {
  const t = (): string => text(page('dolomites'));
  it('is a mountain range, not a viewpoint', () => {
    expect(t()).not.toMatch(/Viewpoint/);
    expect(t()).toMatch(/Mountain range · Belluno · Veneto/);
  });
  it('puts Belluno in Veneto, never in Trentino-Alto Adige', () => {
    expect(t()).toMatch(/Italy\s+Veneto\s+Dolomites/);
    expect(t()).not.toMatch(/Trentino-Alto Adige/);
  });
  it('has no lift season and no season grid for lifts', () => {
    expect(t()).not.toMatch(/Lift \d/);
    expect(t()).not.toMatch(/lift open/);
    const glance = /<section class="ps-glance"[\s\S]*?<\/section>/.exec(page('dolomites'))![0];
    expect(text(glance)).not.toMatch(/Access\s+Not checked yet|Trailhead and parking\s+Not checked yet/);
  });
  it('no place of the Belluno area claims Trentino-Alto Adige for it', () => {
    const rows = JSON.parse(readFileSync(path.join(REPO, 'data', 'locations', 'locations.json'), 'utf8')) as { regions: { id: string }[]; areas: { id: string; region_id: string; name: string }[] };
    const belluno = rows.areas.filter((a) => a.name === 'Belluno');
    expect(belluno.map((a) => a.region_id)).toEqual(['IT/veneto']);
  });
});

describe.skipIf(!built)('empty values on the built pages (4.28)', () => {
  const slugs = readdirSync(OUT).filter((s) => existsSync(path.join(OUT, s, 'index.html')));
  it('the Banff Gondola says its cancellation rule in the gap wording', () => {
    const t = text(page('banff-gondola'));
    expect(t).not.toMatch(/cancelled for not stated/i);
    expect(t).toMatch(/Not checked yet: weather cancellation/);
  });
  it('the Lake Louise gondola reads its weather statement as a sentence, not a raw object', () => {
    const t = text(page('lake-louise-summer-gondola'));
    expect(t).not.toMatch(/causes\s+policy/i);
    expect(t).toMatch(/Closures can occur in adverse weather/);
  });
  it('no built place page has a broken template join', () => {
    const bad: string[] = [];
    const checks: [string, RegExp][] = [
      ['"for not"', /\bfor not\b/],
      ['"of not stated"', /\bof not stated\b/],
      ['null', /\bnull\b/],
      ['undefined', /\bundefined\b/],
      ['NaN', /\bNaN\b/],
      ['[object', /\[object /],
      ['space before punctuation', /\w {2,}[.,;:]/],
      ['empty dot join', /· +·/],
      ['a sentence ending in a bare colon', /\w: *(?:[.;]|$)/],
    ];
    for (const slug of slugs) {
      // text() turns every tag into a space, so a space before a full stop is only a tag boundary: judge the raw text nodes
      const raw = page(slug).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, '\u0001').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ');
      for (const [name, re] of checks) {
        const src = name === 'space before punctuation' ? raw.replace(/\u0001/g, '') : text(page(slug));
        const m = re.exec(src);
        if (m) bad.push(`${slug}: ${name}: …${src.slice(Math.max(0, m.index - 30), m.index + 40)}…`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe.skipIf(!built)('place page labels that contradicted themselves (REVIEW4 fix soon)', () => {
  it('Sorapis: the "Starts at" tile reads the trailhead the Directions card names', () => {
    const h = page('lago-di-sorapis');
    const glance = /<section class="ps-glance"[\s\S]*?<\/section>/.exec(h)![0];
    expect(text(glance)).not.toMatch(/Starts at\s+Not checked yet/);
    expect(text(glance)).toMatch(/Starts at\s+Passo Tre Croci/);
  });
  it('Akureyri: no "Operating season: Not checked yet" beside a stored opening season', () => {
    const t = text(page('akureyri-botanical-garden'));
    expect(t).toMatch(/Open 1 Jun – 30 Sep/);
    expect(t).not.toMatch(/Operating season\s+Not checked yet/);
  });
  it('Otzi: the opening hours name the day and dates of each period, never the same hours twice', () => {
    const t = text(page('otzi-south-tyrol-museum-of-archaeology'));
    expect(t).not.toMatch(/10:00–18:00, 10:00–18:00/);
    expect(t).toMatch(/Tue–Sun 10:00–18:00/);
  });
  it('the cover payoff note has no leading dot to orphan', () => {
    const h = page('banff-gondola');
    expect(h).toMatch(/<span class="pb"[^>]*>Photo and judgement come from the place it reaches/);
    expect(text(h)).not.toMatch(/· photo and judgement/);
  });
});
