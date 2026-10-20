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
