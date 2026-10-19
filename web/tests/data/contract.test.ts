import { describe, expect, it } from 'vitest';
import { generate } from '@travel/core/capture/generate.ts';
import { loadTypes } from '@travel/core/capture/tree.ts';
import type { TypesFile } from '@travel/core/schema/capture/typesFile.ts';
import { CHIP_ROW_PROPERTIES, SECTION_IDS, SHORT_VALUE_TYPES, createContract, defaultContract, type ContractFile, type DomainFile } from '@/lib/public/contract';
import { REPO } from './support';

const contract = defaultContract(REPO);

describe('contract.ts reads the generated capture contract', () => {
  it('has the 14 sections in order and every property in a known section', () => {
    expect(contract.sections.map((s) => s.id)).toEqual([...SECTION_IDS]);
    expect(contract.sections.map((s) => s.n)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(Object.keys(contract.properties).length).toBeGreaterThan(200);
    for (const p of Object.values(contract.properties)) expect(SECTION_IDS, p.key).toContain(p.section);
  });

  it('follows `inherits`: a subtype that is identical to its parent has the parent marks', () => {
    const hike = contract.marks('nature.trail.hike', 'route');
    const trail = contract.marks('nature.trail', 'route');
    expect([...hike]).toEqual([...trail]);
    expect(contract.slot3For('nature.trail.hike')).toBe('stroller');
  });

  it('marks R, R?, A and resolves the suitability row for a route', () => {
    const m = contract.marks('nature.trail.hike', 'route');
    expect(m.get('name')).toBe('R');
    expect(m.get('hazards')).toBe('R');
    expect(m.get('min_age')).toBe('A');
    expect(m.get('price')).toBe('R?');
    expect(m.has('check_in_out')).toBe(false);
  });

  it('turns an operator-only mark into R, N or R? by the operated flag', () => {
    const raft = 'water.paddle.rafting';
    const has = (op?: boolean) => contract.marks(contract.has(raft) ? raft : 'water.paddle.canoe.rental', 'offer', { operated: op });
    const unknown = has();
    const yes = has(true);
    const no = has(false);
    const opKeys = [...unknown].filter(([, m]) => m === 'R?').map(([k]) => k).filter((k) => k.startsWith('participation.') || k === 'adult_required');
    for (const k of opKeys) {
      expect(yes.get(k), k).toBe('R');
      expect(no.has(k), k).toBe(false);
    }
  });

  it('draws a section unless every property is N for the type (display D9)', () => {
    const lake = contract.sectionsFor('water.body.lake', 'place');
    expect(lake).toHaveLength(14);
    const byId = Object.fromEntries(lake.map((s) => [s.id, s]));
    expect(byId.cover!.drawn).toBe(true);
    expect(byId.suits!.drawn).toBe(true);
    // a lake has no route stats: nothing in section 5 is R or A, so it is not drawn and carries no marker
    expect(byId.activity!.drawn).toBe(false);
    expect(byId.activity!.props).toEqual([]);
    const hike = contract.sectionsFor('nature.trail.hike', 'route');
    expect(hike.find((s) => s.id === 'activity')!.drawn).toBe(true);
  });

  it('gives each property one home: the registry section, or section 4 for a suitability property of section 5 (PS1)', () => {
    const all = contract.sectionsFor('nature.trail.hike', 'route');
    const seen = new Map<string, string>();
    for (const s of all) {
      for (const p of s.props) {
        expect(seen.has(p.key), `${p.key} is homed twice`).toBe(false);
        seen.set(p.key, s.id);
        expect(p.home).toBe(s.id);
        if (p.def.home.in !== 'suitability') expect(p.def.section).toBe(s.id);
      }
    }
    // effort drivers are registry section 5 and homed in section 4
    expect(seen.get('effort.drivers.distance_km')).toBe('suits');
    // the hazards that decide the day are the warning line of section 4 when it is drawn (X2)
    expect(seen.get('hazards')).toBe('suits');
    // a record with no suitability row keeps them in section 3
    const noSuit = contract.sectionsFor('stay.mountain.hut', 'place');
    if (!noSuit.find((s) => s.id === 'suits')!.drawn) expect(noSuit.find((s) => s.id === 'warnings')!.props.map((p) => p.key)).not.toContain('hazards');
  });

  it('gives six glance slots of short-rendered R properties that the chip row does not repeat', () => {
    for (const [type, layer] of [['nature.trail.hike', 'route'], ['water.body.lake', 'place'], ['ride.lift.gondola', 'offer']] as const) {
      const glance = contract.glanceFor(type, layer);
      expect(glance.length, type).toBeLessThanOrEqual(6);
      expect(glance.length, type).toBeGreaterThan(0);
      const m = contract.marks(type, layer);
      for (const k of glance) {
        expect(m.get(k), `${type} ${k}`).toBe('R');
        expect(SHORT_VALUE_TYPES.has(contract.properties[k]!.value), k).toBe(true);
        expect(CHIP_ROW_PROPERTIES, k).not.toContain(k);
      }
      expect(glance).not.toContain(contract.slot3For(type));
    }
  });

  it('never fills a glance slot by a label: every slot is a property key', () => {
    for (const k of contract.glanceFor('water.body.lake', 'place')) expect(contract.properties[k]).toBeDefined();
  });
});

// ---- acceptance check S2: a type added to a copy of types.json renders with no code change ------------------------------

function buildFrom(file: TypesFile) {
  const out = generate(file);
  const byPath = new Map(out.map((o) => [o.path, o.text]));
  const contractFile = JSON.parse(byPath.get('data/schema/capture/contract.json')!) as ContractFile;
  const domains: Record<string, DomainFile> = {};
  for (const [p, text] of byPath) {
    const m = /^data\/schema\/capture\/([a-z_]+)\.json$/.exec(p);
    if (m && m[1] !== 'contract') {
      const d = JSON.parse(text) as DomainFile;
      domains[d.domain] = d;
    }
  }
  return createContract(contractFile, domains);
}

const EXAMPLES = ['water.motor.jet_ski', 'nature.trek.trek_stage.hut_stage', 'air.zip.zipline.kids_course'];

describe('a new type is data (contract 8.2; acceptance check S2)', () => {
  const full = loadTypes();
  const without: TypesFile = { ...full, nodes: full.nodes.filter((n) => !EXAMPLES.includes(n.id)) };
  const withNodes = (extra: TypesFile['nodes']): TypesFile => ({ ...without, nodes: [...without.nodes, ...extra] });
  const pick = (id: string) => full.nodes.find((n) => n.id === id)!;

  it('the copy without the three examples does not know them', () => {
    const c = buildFrom(without);
    for (const id of EXAMPLES) expect(c.has(id), id).toBe(false);
  });

  it('jet ski: the driver rule is an R property and the third chip, with no code', () => {
    const c = buildFrom(withNodes([pick('water.motor.jet_ski')]));
    expect(c.has('water.motor.jet_ski')).toBe(true);
    expect(c.slot3For('water.motor.jet_ski')).toBe('participation.driver');
    const m = c.marks('water.motor.jet_ski', 'offer', { operated: true });
    expect(m.get('participation.driver')).toBe('R');
    expect(m.get('water_safety.water_temp_c')).toBe('A');
    const suits = c.sectionsFor('water.motor.jet_ski', 'offer', { operated: true }).find((s) => s.id === 'suits')!;
    expect(suits.props.map((p) => p.key)).toContain('participation.driver');
  });

  it('hut stage: it asks for part_of and ends_at, and for a booking window when one applies', () => {
    const c = buildFrom(withNodes([pick('nature.trek.trek_stage.hut_stage')]));
    const m = c.marks('nature.trek.trek_stage.hut_stage', 'route');
    expect(m.get('part_of')).toBe('R');
    expect(m.get('ends_at')).toBe('R');
    expect(m.get('window')).toBe('R?');
    expect(c.linksFor('nature.trek.trek_stage.hut_stage').R).toContain('booking');
    // it inherits the hike contract otherwise
    expect(m.get('hazards')).toBe('R');
  });

  it("kids' zip course: slot 3 changes to the adult rule and the age band becomes R", () => {
    const c = buildFrom(withNodes([pick('air.zip.zipline.kids_course')]));
    expect(c.slot3For('air.zip.zipline.kids_course')).toBe('adult_required');
    const m = c.marks('air.zip.zipline.kids_course', 'offer', { operated: true });
    expect(m.get('adult_required')).toBe('R');
    expect(m.get('age_band')).toBe('R');
    expect(m.get('max_age')).toBe('R');
    expect(m.get('max_height_cm')).toBe('A');
    // the parent zipline keeps its own slot 3
    expect(c.slot3For('air.zip.zipline')).not.toBe('adult_required');
  });
});

describe('gap wording reads as a gap (verifier 1)', () => {
  it('no property gap string is a statement: no "No ...", "needed", "is a value", "free", "none"', () => {
    const bad = Object.entries(defaultContract(REPO).properties).filter(([, d]) => /^no\b|^none\b|\bneeded\b|is a value|\bfree\b/i.test(d.gap)).map(([k, d]) => `${k}: ${d.gap}`);
    expect(bad).toEqual([]);
  });
});
