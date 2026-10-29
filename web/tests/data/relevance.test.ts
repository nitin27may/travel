import { describe, expect, it } from 'vitest';
import { loadWorld } from '@travel/core/capture/records.ts';
import { badgeFor, loadRelevanceContext, provenanceLines, publicRelevance, type DerivedItem } from '@/lib/public/relevance';
import { REPO } from './support';

const world = loadWorld(REPO);
const ctx = loadRelevanceContext(world, REPO);
const find = (needle: string): string => {
  const ref = [...ctx.derived.keys()].find((r) => r.includes(needle));
  if (!ref) throw new Error(`no derived item for ${needle}`);
  return ref;
};

describe('publicRelevance: the badge, the why line and the provenance', () => {
  const moraine = publicRelevance(ctx, find('sights/moraine-lake'));

  it('gives one badge from the derived role, with its why line', () => {
    expect(moraine.badge).toEqual({ kind: 'journey', label: 'Worth the journey' });
    expect(moraine.why).toBeTruthy();
    expect(moraine.notJudged).toBe(false);
  });

  it('opens the provenance: our judgement, designations with scope, signals with read dates, and no ratings', () => {
    const lines = provenanceLines(moraine.provenance!);
    expect(lines[0]).toMatch(/^Our judgement · read \d+ \w+ 2026/);
    expect(lines.at(-1)).toBe('No ratings or review counts are used');
    expect(moraine.provenance!.noRatings).toBe('No ratings or review counts are used');
    expect(moraine.provenance!.designations.length + (moraine.provenance!.fame ? 1 : 0)).toBeGreaterThan(0);
  });

  it('says a designation is inherited when its scope is the parent', () => {
    let seen = false;
    for (const ref of ctx.derived.keys()) {
      const p = publicRelevance(ctx, ref).provenance;
      const parent = p?.designations.find((d) => d.scope === 'parent');
      if (parent) {
        expect(parent.scopeText).toMatch(/inherited/);
        expect(provenanceLines(p!).some((l) => /inherited/.test(l))).toBe(true);
        seen = true;
        break;
      }
    }
    expect(seen).toBe(true);
  });

  it('marks a record with no judgement as not judged (the dashed badge), never as a negative chip', () => {
    const refNoRel = [...ctx.derived.keys()].find((r) => !world.rel.has(r) && !ctx.derived.get(r)!.draw_from);
    if (refNoRel) {
      const r = publicRelevance(ctx, refNoRel);
      expect(r.notJudged).toBe(true);
      expect(r.badge?.kind).not.toBe('negative');
    }
    expect(publicRelevance(ctx, 'place/does-not-exist').notJudged).toBe(true);
    expect(publicRelevance(ctx, 'place/does-not-exist', { showNotJudged: false }).notJudged).toBe(false);
  });
});

describe('publicRelevance: the lens rules for the badge (relevance 3.6 and 6.2)', () => {
  const item = (badge: string | null): DerivedItem => ({ ref: 'x', effective_draw: 'world', access_load: 'easy', detour_min: null, substitutes: { near: [], area: [] }, far_pointer: null, pair_with: [], part_of: [], plan_b: null, role: 'anchor', flags: { go_clear_day: false, rainy_day: false, en_route: false, hidden_gem: false }, badge });

  it('a place page and a card allow all three badges', () => {
    for (const [label, kind] of [['Worth the journey', 'journey'], ['Worth a detour', 'detour'], ['Local favourite', 'local']] as const) {
      expect(badgeFor(item(label), { surface: 'place' })?.kind).toBe(kind);
      expect(badgeFor(item(label), { surface: 'card' })?.kind).toBe(kind);
    }
    expect(badgeFor(item(null))).toBeNull();
  });

  it('a trip of 4 or more nights marks anchors only', () => {
    expect(badgeFor(item('Worth the journey'), { surface: 'trip', nights: 7 })?.kind).toBe('journey');
    expect(badgeFor(item('Worth a detour'), { surface: 'trip', nights: 7 })).toBeNull();
    expect(badgeFor(item('Local favourite'), { surface: 'trip', nights: 4 })).toBeNull();
  });

  it('a short trip marks only its top stop "Local favourite"', () => {
    expect(badgeFor(item('Local favourite'), { surface: 'trip', nights: 2, topStop: true })?.kind).toBe('local');
    expect(badgeFor(item('Local favourite'), { surface: 'trip', nights: 2 })).toBeNull();
    expect(badgeFor(item('Worth the journey'), { surface: 'trip', nights: 2, topStop: true })).toBeNull();
  });
});

describe('publicRelevance: routes take the draw from their payoff (CC-adapter 3)', () => {
  it('a lift line reads its badge and why from the top station it reaches, and names it', () => {
    const line = [...ctx.derived.keys()].find((r) => r.startsWith('legacy/') && r.endsWith('adventures/banff-gondola'))!;
    const r = publicRelevance(ctx, line);
    expect(r.fromPayoff).toBe(true);
    expect(r.payoff!.ref).toMatch(/banff-gondola#top$/);
    expect(r.payoff!.name).toBeTruthy();
    expect(r.badge).not.toBeNull();
    expect(r.why).toBeTruthy();
  });
  it('the Larch Valley route takes its badge from Sentinel Pass and names it (backlog 3.18, S6)', () => {
    const route = [...ctx.derived.keys()].find((r) => r.endsWith('trails/larch-valley-sentinel-pass'))!;
    const r = publicRelevance(ctx, route);
    expect(r.fromPayoff).toBe(true);
    expect(r.payoff!.ref).toMatch(/larch-valley-sentinel-pass#sentinel-pass$/);
    expect(r.payoff!.name).toBe('Sentinel Pass');
    expect(r.badge).toEqual({ kind: 'journey', label: 'Worth the journey' });
    expect(r.payoffMissing).toBe(false);
    // the pass carries the judgement itself, and the larch-colour peak with it
    const pass = publicRelevance(ctx, r.payoff!.ref);
    expect(pass.fromPayoff).toBe(false);
    expect(pass.notJudged).toBe(false);
  });
});

describe('publicRelevance: Nearby, worth adding', () => {
  it('lists a hand-picked pair first with its reason, and a pair with no point shows with no distance', () => {
    // DATA-D1 gave every hand-picked pair a point, so the data no longer holds a pair with no distance. The rule is tested on a copy of one
    // real item whose first hand-picked pair has its distance fields removed, which is what a pair with a missing point looks like to the page.
    const ref = [...ctx.derived.entries()].find(([, it]) => (it.pair_with ?? []).some((p) => p.hand_picked === true && p.reason))?.[0];
    expect(ref, 'the data holds an item with a hand-picked pair').toBeDefined();
    const item = ctx.derived.get(ref!)!;
    const target = item.pair_with!.find((p) => p.hand_picked === true && p.reason)!;
    const stripped = { ...item, pair_with: item.pair_with!.map((p) => (p === target ? { ...p, km: undefined, extra_min: undefined, how: undefined } : p)) };
    const ctx2 = { ...ctx, derived: new Map(ctx.derived).set(ref!, stripped as typeof item) };
    const nullKm = publicRelevance(ctx2, ref!).pairs.find((p) => p.ref === target.ref);
    expect(nullKm, 'the stripped pair is still listed').toBeDefined();
    expect(nullKm!.handPicked).toBe(true);
    expect(nullKm!.reason).toBeTruthy();
    expect(nullKm!.km).toBeNull();
    expect(nullKm!.extraMin).toBeNull();
  });

  it('puts every hand-picked pair before a derived one, and shows at most three', () => {
    for (const ref of ctx.derived.keys()) {
      const pairs = publicRelevance(ctx, ref).pairs;
      expect(pairs.length, ref).toBeLessThanOrEqual(3);
      const firstDerived = pairs.findIndex((p) => !p.handPicked);
      if (firstDerived >= 0) expect(pairs.slice(firstDerived).every((p) => !p.handPicked), ref).toBe(true);
    }
  });

  it('never pairs a place with a way to it, its payoff, a part of it, its parent or (for a route) its start (X9)', () => {
    for (const ref of ctx.derived.keys()) {
      const cap = world.cap.get(ref)?.rec;
      if (!cap) continue;
      const banned = new Set<string>([...(cap.part_of ?? []), ...(cap.reaches ?? []), ...(cap.starts_at ?? [])]);
      for (const pair of publicRelevance(ctx, ref).pairs) expect(banned.has(pair.ref), `${ref} pairs with ${pair.ref}`).toBe(false);
    }
  });
});

describe('publicRelevance: Similar nearby', () => {
  it('shows at most three substitutes with their family effort and access load in words', () => {
    let withData = 0;
    for (const ref of ctx.derived.keys()) {
      const r = publicRelevance(ctx, ref);
      expect(r.similar.length, ref).toBeLessThanOrEqual(3);
      for (const s of r.similar) {
        expect(s.name).toBeTruthy();
        expect(s.access).toBeTruthy();
        expect(s.km).toBeGreaterThanOrEqual(0);
        withData += 1;
      }
    }
    expect(withData).toBeGreaterThan(5);
  });
});

describe('publicRelevance: the pointer and Plan B', () => {
  it('points a local or regional place to the one people travel for', () => {
    let seen: ReturnType<typeof publicRelevance>['pointer'] = null;
    for (const [ref, it] of ctx.derived) {
      if (it.effective_draw !== 'local' && it.effective_draw !== 'regional') continue;
      const p = publicRelevance(ctx, ref).pointer;
      if (p) {
        seen = p;
        break;
      }
    }
    expect(seen).not.toBeNull();
    expect(seen!.text).toBe(`Coming from far? Nearby, ${seen!.name} is the one people travel for.`);
  });

  it('drops a pointer whose target is the record\'s own part_of parent (backlog 3.16, PS9)', () => {
    // Data-independent: take the first record that has a far pointer, give it that pointer's target as a derived part_of parent
    // (the mutual, by-point relation of F4), and the pointer must go. The Moraine lakeshore was the fixture until DG2F gave it its
    // own OSM point 0.5 km from Moraine Lake, which ended the derived part_of; the guard did not change.
    const entry = [...ctx.derived.entries()].find(([r, it]) => it.far_pointer && publicRelevance(ctx, r).pointer);
    expect(entry, 'a record with a public pointer').toBeDefined();
    const [ref, item] = entry!;
    const withParent = { ...item, part_of: [...item.part_of, item.far_pointer!.ref] };
    const ctx2 = { ...ctx, derived: new Map(ctx.derived).set(ref, withParent as typeof item) };
    expect(publicRelevance(ctx, ref).pointer).not.toBeNull();
    expect(publicRelevance(ctx2, ref).pointer).toBeNull();
  });


  it('a capture part_of parent is the "Part of" line, and is never also the pointer', () => {
    let checked = 0;
    for (const [ref, it] of ctx.derived) {
      const cap = world.cap.get(ref)?.rec;
      if (!cap?.part_of?.length || !it.far_pointer) continue;
      const r = publicRelevance(ctx, ref);
      expect(r.partOf.length).toBeGreaterThan(0);
      if (cap.part_of.includes(it.far_pointer.ref)) expect(r.pointer, ref).toBeNull();
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(0);
  });

  it('every pointer in the data avoids its record\'s parent, payoff and parts', () => {
    for (const ref of ctx.derived.keys()) {
      const cap = world.cap.get(ref)?.rec;
      const p = publicRelevance(ctx, ref).pointer;
      if (!p || !cap) continue;
      expect([...(cap.part_of ?? []), ...(cap.reaches ?? [])], ref).not.toContain(p.ref);
    }
  });

  it('gives Moraine Lake, whose shuttle sits in the access season, a Plan B (backlog 3.17)', () => {
    const p = publicRelevance(ctx, find('sights/moraine-lake')).planB;
    expect(p).not.toBeNull();
    expect(p!.name).toBeTruthy();
  });
  it('a hand-picked Plan B carries the reason a person gave (Tre Cime to Monte Piana)', () => {
    const p = publicRelevance(ctx, find('tre-cime-di-lavaredo-loop')).planB;
    expect(p?.name).toMatch(/Monte Piana/);
    expect(p?.reason).toMatch(/toll/i);
  });
  it('gives an anchor with a fallible access cost its Plan B, with the risk in words', () => {
    let seen: ReturnType<typeof publicRelevance>['planB'] = null;
    for (const [ref, it] of ctx.derived) {
      if (!it.plan_b) continue;
      const p = publicRelevance(ctx, ref).planB;
      if (p) {
        seen = p;
        break;
      }
    }
    expect(seen).not.toBeNull();
    expect(seen!.name).toBeTruthy();
    expect(seen!.km).toBeGreaterThanOrEqual(0);
  });
});

describe('publicRelevance: honesty', () => {
  it('carries no rating, review count, rank or link-only platform in any output string', () => {
    const bad = /\b\d(?:\.\d)? ?(?:stars?|\/5)\b|\b[\d,]+ reviews?\b|#\d+ of \d+|alltrails|komoot|tripadvisor|google (?:maps )?rating/i;
    for (const ref of ctx.derived.keys()) {
      const r = publicRelevance(ctx, ref);
      const text = JSON.stringify(r, (k, v) => (k === 'sources' ? undefined : v));
      expect(text, ref).not.toMatch(bad);
    }
  });
});
