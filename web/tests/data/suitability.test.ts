import { describe, expect, it } from 'vitest';
import { loadWorld } from '@travel/core/capture/records.ts';
import type { SuitabilityRecord } from '@travel/core/schema/suitability.ts';
import { defaultContract } from '@/lib/public/contract';
import { publicSuitability, suitMarksFor, type PublicSuitability } from '@/lib/public/suitability';
import { DropLog } from '@/lib/public/dateless';
import { TextScrub, type SourceRow } from '@/lib/public/vals';
import { REPO } from './support';

const contract = defaultContract(REPO);

const SRC: SourceRow = { id: 'src-0001', url: 'https://operator.example/rules', title: 'Rules', publisher: 'Operator', kind: 'operator', read: '2026-10-12' };
const lookup = (ids?: string[]): SourceRow[] => (ids ?? []).map(() => SRC);
const v = (value: unknown, basis: string | null = 'operator_rule', extra: Record<string, unknown> = {}) => ({ v: value, state: 'value', basis, src: ['src-0001'], read: '2026-10-12', ...extra });
const none = (state: string, extra: Record<string, unknown> = {}) => ({ v: null, state, basis: null, src: [], on: '2026-10-12', ...extra });

function run(type: string, record: Partial<SuitabilityRecord> & { kind: string; subkind: string; suitability: Record<string, unknown> }, extra: Record<string, unknown> = {}): PublicSuitability {
  const rec = { ref: 'offer/test#x', ...record } as unknown as SuitabilityRecord;
  const sm = suitMarksFor(contract, type)!;
  return publicSuitability({ rec, file: '' }, { lookup, suitMarks: sm, slot3: contract.slot3For(type), ...extra });
}

const RAFT = {
  kind: 'activity',
  subkind: 'rafting',
  suitability: {
    min_age: v(6),
    min_weight_kg: v(23),
    water_safety: { swim_ability: v('comfortable'), class: v({ system: 'whitewater', value: 'I-III' }, 'official_info') },
    participation: {
      pregnancy: v('not_allowed'),
      medical: v({ excluded: ['heart', 'back_neck'], ask_doctor: [] }),
      kit_provided: v(['wetsuit', 'helmet', 'pfd'], 'operator_info'),
      waiver: v({ required: true, guardian_signs_under: 18, guardian_present: null }),
    },
    age_band: v({ from: 8, to: null }, 'our_inference'),
    on_site_min: v([210, 210], 'operator_info'),
  },
  ext: { kind: 'paddle', on_water_min: v([120, 120], 'operator_info') },
};

describe('publicSuitability: the three chips', () => {
  it('merges the rules into one lock chip: at most three values and "+n" for every remaining ban, pregnancy and medical included (D4)', () => {
    const r = run('water.river.rafting', RAFT as never, { });
    const c = r.chips[0]!;
    expect(c.kind).toBe('rule');
    expect(c.glyph).toBe('lock');
    expect(c.text).toBe('Age 6+ · 23 kg min · swim test');
    expect(c.extra).toBe(2); // pregnancy not allowed + medical exclusions
    expect(c.label).toMatch(/^Operator rule:/);
  });

  it('shows a searched-none R limit as "x not stated" and counts it as one of the three values (D3)', () => {
    const rec = {
      kind: 'activity', subkind: 'zipline',
      suitability: { min_age: v(8), min_weight_kg: v(30), max_weight_kg: v(125), min_height_cm: none('searched_none'), max_height_cm: none('searched_none'), participation: { pregnancy: v('not_allowed') } },
    };
    const r = run('air.zip.zipline', rec as never);
    expect(r.chips[0]!.text).toBe('Age 8+ · 30–125 kg · height not stated');
    expect(r.chips[0]!.extra).toBe(1);
    expect(r.chips[2]).toMatchObject({ kind: 'gap' }); // braking is R and missing
  });

  it('"No minimum age" is a rule and earns the lock (no_limit)', () => {
    const rec = {
      kind: 'activity', subkind: 'boat-tour',
      suitability: { min_age: { v: null, state: 'no_limit', basis: 'operator_rule', src: ['src-0001'], read: '2026-10-12' }, age_band: v({ from: 0, to: null }, 'our_inference'), stroller_on_board: v('leave_at_dock', 'operator_rule') },
    };
    const r = run('water.boat.boat_tour', rec as never);
    expect(r.chips[0]).toMatchObject({ kind: 'rule', text: 'No minimum age', glyph: 'lock' });
    expect(r.card.kids).toMatchObject({ kind: 'rule', text: 'No minimum age' });
    // the boat's deciding condition comes from the contract (slot 3); its stroller rule is a Who it suits row
    expect(contract.slot3For('water.boat.boat_tour')).toBe('water_safety.lifejacket');
    expect(r.groups.find((g) => g.id === 'who')!.rows.find((x) => x.key === 'stroller_on_board')!.text).toBe('Leave strollers at the dock');
  });

  it('with no rule, slot 1 is the age-band advice chip with the person glyph, and a card says "From about N"', () => {
    const rec = { kind: 'trail', subkind: 'hike', suitability: { age_band: v({ from: 6, to: null }, 'our_inference'), stroller: v('none', 'official_info') } };
    const r = run('nature.trail.hike', rec as never);
    expect(r.chips[0]).toMatchObject({ kind: 'advice', text: 'From about 6', glyph: 'person' });
    expect(r.chips[0]!.label).toMatch(/^Our judgement:/);
    expect(r.card.kids).toMatchObject({ kind: 'advice', text: 'From about 6' });
    expect(r.kidsFrom).toBe(6);
  });

  it('draws one gap chip "Family checks not done yet" when every R field is missing, and counts 0 of n', () => {
    const r = run('nature.trail.hike', { kind: 'trail', subkind: 'hike', suitability: {} } as never);
    expect(r.allMissing).toBe(true);
    expect(r.chips[0]).toMatchObject({ kind: 'gap', text: 'Family checks not done yet' });
    expect(r.chips[1]).toBeNull();
    expect(r.chips[2]).toBeNull();
    expect(r.research.done).toBe(0);
    expect(r.research.total).toBeGreaterThan(5);
    expect(r.research.text).toMatch(/^0 of \d+ family checks done/);
    // the groups still draw, with gap rows
    const who = r.groups.find((g) => g.id === 'who')!;
    expect(who.rows.some((x) => x.gap && x.text === 'Not checked yet')).toBe(true);
  });

  it('never publishes a link-only platform URL or figure from a sidecar note, and logs the drop', () => {
    const log = new DropLog();
    const rec = {
      kind: 'trail', subkind: 'hike',
      suitability: { effort: { drivers: { distance_km: v(7.7, 'our_inference', { note: 'Carried over unchanged. Row note: https://www.alltrails.com/x/y (search result: 7.7 km). Read the official page.' }) } } },
    };
    const r = run('nature.trail.hike', rec as never, { scrub: new TextScrub(log) });
    const row = r.groups.find((g) => g.id === 'effort')!.rows.find((x) => x.key === 'effort.drivers.distance_km')!;
    expect(row.val!.note).toBe('Carried over unchanged. Read the official page.');
    expect(JSON.stringify(r)).not.toMatch(/alltrails/i);
    expect(log.items.some((i) => /link-only/.test(i.why))).toBe(true);
  });

  it('names the effort, never its number, and keeps the original grade (D2)', () => {
    const rec = {
      kind: 'trail', subkind: 'hike',
      suitability: {
        age_band: v({ from: 4, to: null }, 'our_inference'),
        effort: { source_grade: v({ system: 'parks-canada', value: 'Easy' }, 'official_grade'), drivers: { distance_km: v(2.4, 'official_info'), gain_m: v(50, 'official_info') } },
        adult_time_min: v([60, 90], 'official_info'),
        stroller: v('none', 'official_info'),
      },
    };
    const r = run('nature.trail.hike', rec as never);
    expect(r.chips[1]!.text).toMatch(/^(Stroll|Easy|Moderate|Hard|Technical) · Parks Canada Easy · 1–1 h 30$/);
    expect(r.chips[1]!.textNoTime).toMatch(/^(Stroll|Easy|Moderate|Hard|Technical) · Parks Canada Easy$/);
    expect(r.card.effort!.text).toMatch(/^(Stroll|Easy|Moderate|Hard|Technical)$/);
    expect(r.chips[2]!.text).toBe('No stroller access');
    expect(JSON.stringify(r)).not.toMatch(/\bFE[1-5]\b/);
  });
});

describe('publicSuitability: rows, groups and the closing line', () => {
  const r = run('water.river.rafting', RAFT as never);

  it('orders the groups as applicability 5.2 and opens only Limits and Who it suits', () => {
    const ids = r.groups.map((g) => g.id);
    const order = ['limits', 'who', 'effort', 'kind', 'facilities', 'when'];
    expect(ids).toEqual(order.filter((x) => ids.includes(x as never)));
    expect(r.groups.find((g) => g.id === 'limits')!.open).toBe(true);
    expect(r.groups.find((g) => g.id === 'who')!.open).toBe(true);
    for (const g of r.groups.filter((x) => !['limits', 'who'].includes(x.id))) expect(g.open, g.id).toBe(false);
  });

  it('puts every rule in the limits group with its basis, read date and source', () => {
    const limits = r.groups.find((g) => g.id === 'limits')!;
    const age = limits.rows.find((x) => x.key === 'min_age')!;
    expect(age.look).toBe('rule');
    expect(age.val!.basisLabel).toBe('operator rule');
    expect(age.val!.read).toBe('2026-10-12');
    expect(age.val!.sources[0]!.publisher).toBe('Operator');
    expect(limits.rows.find((x) => x.key === 'participation.pregnancy')!.text).toBe('Not allowed');
    expect(limits.rows.find((x) => x.key === 'participation.medical')!.text).toContain('heart, back and neck excluded');
  });

  it('writes a searched-none limit as a sentence with the search date and no gap look (check 5)', () => {
    const z = run('air.zip.zipline', { kind: 'activity', subkind: 'zipline', suitability: { min_age: v(8), min_height_cm: none('searched_none') } } as never);
    const row = z.groups.find((g) => g.id === 'limits')!.rows.find((x) => x.key === 'min_height_cm')!;
    expect(row.text).toBe('Not stated by the operator · searched 12 Oct 2026 · ask before booking');
    expect(row.look).toBe('sentence');
    expect(row.gap).toBe(false);
  });

  it('treats pregnancy "not recommended" and "ask a doctor" as advice values, not gaps and not bans (CC-adapter 10)', () => {
    const z = run('air.zip.zipline', { kind: 'activity', subkind: 'zipline', suitability: { min_age: v(8), participation: { pregnancy: v('not_recommended') } } } as never);
    const row = z.groups.find((g) => g.id === 'limits')!.rows.find((x) => x.key === 'participation.pregnancy')!;
    expect(row).toMatchObject({ text: 'Not recommended', look: 'advice', gap: false });
    expect(z.chips[0]!.extra).toBe(0);
  });

  it('keeps a missing R field as a gap row and folds missing A fields into one closing line', () => {
    const limits = run('air.zip.zipline', { kind: 'activity', subkind: 'zipline', suitability: { min_age: v(8) } } as never).groups.find((g) => g.id === 'limits')!;
    const weight = limits.rows.find((x) => x.key === 'min_weight_kg')!;
    expect(weight.gap).toBe(true);
    // a missing limit on an operated kind says who to ask (display 2)
    expect(weight.text).toBe('Limits not checked yet · ask the operator');
    const rows = limits.rows.map((x) => x.key);
    expect(rows).not.toContain('participation.medical'); // A, absent: only in the closing line
    expect(limits.closing).toMatch(/^Not checked yet: .*medical/);
    expect(limits.closing!.split(': ')).toHaveLength(2);
  });

  it('draws nothing for an N field and no group that is N for the whole profile (D9)', () => {
    const bungee = run('air.jump.bungee', { kind: 'activity', subkind: 'bungee', suitability: { min_age: v(14), min_weight_kg: v(45), max_weight_kg: v(120) } } as never);
    const ids = bungee.groups.map((g) => g.id);
    expect(ids).not.toContain('facilities');
    const all = bungee.groups.flatMap((g) => g.rows.map((x) => x.key));
    expect(all).not.toContain('stroller');
    expect(all).not.toContain('effort.source_grade');
    expect(bungee.groups.map((g) => g.closing ?? '').join(' ')).not.toMatch(/stroller|toilets/);
    expect(bungee.chips[1]!.text).not.toMatch(/Stroll|Easy|Moderate|Hard|Technical/);
  });

  it('marks "Sources disagree" on a row with conflicts and keeps the other figure', () => {
    const rec = { kind: 'activity', subkind: 'zipline', suitability: { min_age: v(8), max_weight_kg: v(125, 'operator_rule', { conflicts: [{ v: 140, basis: 'community', src: ['src-0001'], note: 'a reseller page' }] }) } };
    const row = run('air.zip.zipline', rec as never).groups.find((g) => g.id === 'limits')!.rows.find((x) => x.key === 'max_weight_kg')!;
    expect(row.honesty).toBe('Sources disagree');
    expect(row.val!.conflicts[0]).toMatchObject({ value: 140, basisLabel: 'community reports', note: 'a reseller page' });
  });

  it('writes the warning line from the hazards, else the cancellation cause', () => {
    const a = run('nature.trail.hike', { kind: 'trail', subkind: 'hike', suitability: { hazards: v([{ category: 'wildlife', note: 'Bears: carry spray' }, { category: 'cold', note: 'Ice cleats needed Nov to Apr' }], 'official_info') } } as never);
    expect(a.warning).toBe('Bears: carry spray; Ice cleats needed Nov to Apr');
    const b = run('water.river.rafting', RAFT as never, {});
    expect(b.warning).toBeNull();
    const c = run('water.boat.boat_tour', { kind: 'activity', subkind: 'boat-tour', suitability: { participation: { weather_cancel: v({ causes: ['wind'], policy: 'refund' }, 'operator_info') } } } as never);
    expect(c.warning).toBe('Cancelled for wind');
  });
});

describe('publicSuitability: the research line', () => {
  it('counts R checks done out of all, with the newest read date', () => {
    const r = run('water.river.rafting', RAFT as never);
    expect(r.research.text).toMatch(/^\d+ of \d+ family checks done · read 12 Oct 2026$/);
    expect(r.research.done).toBeLessThan(r.research.total);
  });

  it('reads "Usable, partly unverified" for usable_partial and keeps the count (display 9)', () => {
    const w = loadWorld(REPO);
    let found = false;
    for (const [ref, l] of w.suit) {
      const cap = w.cap.get(ref);
      if (!cap) continue;
      const sm = suitMarksFor(contract, cap.rec.type);
      if (!sm) continue;
      const r = publicSuitability(l, { suitMarks: sm, slot3: contract.slot3For(cap.rec.type) });
      if (r.research.level === 'usable_partial') {
        found = true;
        expect(r.research.levelLabel).toBe('Usable, partly unverified');
        expect(r.research.text).toMatch(/^\d+ of \d+ family checks done · usable, partly unverified/);
        break;
      }
    }
    expect(found).toBe(true);
  });
});

describe('publicSuitability: a party profile (D6)', () => {
  const rec = { kind: 'activity', subkind: 'zipline', suitability: { min_age: v(8), age_band: v({ from: 8, to: null }, 'our_inference') } };

  it('an operator rule that excludes the youngest is the rule-fail chip with its basis', () => {
    const r = run('air.zip.zipline', rec as never, { party: { youngestAge: 5 } });
    expect(r.chips[0]).toMatchObject({ kind: 'rule_fail', text: 'Not for under 8 · operator rule' });
    expect(r.chips[0]!.label).toMatch(/^Operator rule:/);
  });

  it('a pass is the fits chip', () => {
    const r = run('air.zip.zipline', { ...rec, suitability: { min_age: v(8) } } as never, { party: { youngestAge: 10 } });
    expect(r.chips[0]).toMatchObject({ kind: 'fits', text: 'Fits a 10-year-old' });
  });

  it('our advice that says no, with no rule, is the advice-fail chip', () => {
    const hard = {
      kind: 'trail', subkind: 'hike',
      suitability: { effort: { source_grade: v({ system: 'sac', value: 'T4' }, 'official_grade'), drivers: { distance_km: v(14, 'official_info'), gain_m: v(1100, 'official_info') } } },
    };
    const r = run('nature.trail.hike', hard as never, { party: { youngestAge: 3 } });
    expect(r.chips[0]).toMatchObject({ kind: 'advice_fail', text: 'Not suited to a 3-year-old' });
  });
});

describe('publicSuitability: the real data', () => {
  const w = loadWorld(REPO);
  const get = (needle: string) => {
    const ref = [...w.suit.keys()].find((k) => k.includes(needle))!;
    const cap = w.cap.get(ref)!;
    return publicSuitability(w.suit.get(ref)!, { suitMarks: suitMarksFor(contract, cap.rec.type) ?? undefined, slot3: contract.slot3For(cap.rec.type) });
  };

  it('Lake Louise has its seven family checks done (place-page-sections section 4)', () => {
    const r = get('place/lake-louise');
    expect(r.research.text).toMatch(/^7 of 7 family checks done/);
    expect(r.chips[0]!.kind).toBe('advice');
  });

  it('the Banff Gondola chips come from its ticket offer: no strollers on board, a ride time', () => {
    const r = get('banff-gondola#ticket');
    expect(r.chips[2]!.text).toBe('No strollers on board');
    expect(r.chips[1]!.text).toMatch(/ride/);
  });

  it('every record builds without throwing, and no output string carries a family-effort code, a rating or a review count', () => {
    const bad = /\bFE[1-5]\b|\b\d(?:\.\d)? ?(?:stars?|\/5)\b|\b[\d,]+ reviews\b|alltrails|tripadvisor/i;
    for (const [ref, l] of w.suit) {
      const cap = w.cap.get(ref);
      const r = publicSuitability(l, { suitMarks: cap ? (suitMarksFor(contract, cap.rec.type) ?? undefined) : undefined, slot3: cap ? contract.slot3For(cap.rec.type) : null });
      const text = JSON.stringify(r, (k, val) => (k === 'sources' ? undefined : val));
      expect(text, ref).not.toMatch(bad);
    }
  });
});

describe('process notes never reach a visitor (3.27)', () => {
  it('TextScrub drops agent and review-queue notes, whole sentences, and logs them', () => {
    const log = new DropLog();
    const scrub = new TextScrub(log);
    const note = "agent-confirmed 2026-10-18 by travel-researcher: Wikidata description 'lake in Alberta, Canada' and P625 coordinates at the place; needs a person's check";
    expect(scrub.text(note, 'point')).toBe('');
    expect(scrub.text(`Open all year. ${note}.`, 'point')).toBe('Open all year.');
    expect(scrub.text('Held for a person to review.', 'x')).toBe('');
    expect(scrub.text('The route needs a person\'s fix.', 'x')).toBe('');
    expect(scrub.maybe(note, 'x')).toBeNull();
    expect(log.items.length).toBeGreaterThanOrEqual(4);
    expect(log.items.every((i) => /process note/.test(i.why))).toBe(true);
    // ordinary text stays
    expect(scrub.text('Parks Canada confirmed the closure by phone.', 'x')).toBe('Parks Canada confirmed the closure by phone.');
  });
});

describe('publicSuitability: swimming discouraged', () => {
  it('says "Swimming discouraged" for the discouraged value and keeps the other words', () => {
    const word = (swimming: string): string | null => {
      const r = run('water.body.lake', { kind: 'lake', subkind: 'lake', suitability: {}, ext: { kind: 'water', swimming: v(swimming, 'official_info') } } as never);
      return r.groups.flatMap((g) => g.rows).find((x) => x.key === 'ext.water.swimming')?.text ?? null;
    };
    expect(word('discouraged')).toBe('Swimming discouraged');
    expect(word('allowed')).not.toBe('Swimming discouraged');
  });
});

describe('time ranges carry their units (S1c 4)', () => {
  it('shows the unit on both ends when they differ and once when they match', async () => {
    const { publicSuitability } = await import('@/lib/public/suitability');
    void publicSuitability;
    const range = (a: number, b: number) => run('nature.trail.hike', { kind: 'trail', subkind: 'hike', suitability: { adult_time_min: v([a, b], 'our_inference') } } as never).groups.flatMap((g) => g.rows).find((r) => r.key === 'adult_time_min')?.text;
    expect(range(45, 90)).toBe('45 min–1 h 30');
    expect(range(30, 60)).toBe('30 min–1 h');
    expect(range(30, 45)).toBe('30–45 min');
    expect(range(60, 90)).toBe('1–1 h 30');
    expect(range(120, 180)).toBe('2–3 h');
  });
});
