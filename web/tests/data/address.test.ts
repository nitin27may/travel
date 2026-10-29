import { describe, expect, it } from 'vitest';
import { loadWorld } from '@travel/core/capture/records.ts';
import { resetHomePointCache } from '@travel/core/privacy/home.ts';
import { PROPERTY_BY_KEY } from '@travel/core/schema/capture/properties.ts';
import { defaultContract } from '@/lib/public/contract';
import { addressCopy, addressLine, readAddress } from '@/lib/public/address';
import { buildSections } from '@/lib/public/sections';
import { REPO } from './support';

// LT-M: the address of the Directions target on the page model. The fixtures here are written into the loaded world in memory and never saved.
// Real data now holds addresses (CS7, PA-R-CA, BA-us, LT-1), so a test about the fixtures first takes every address out of the in-memory world
// (`withoutAddresses`) and puts them back; the last block reads the real addresses as they are.
const world = loadWorld(REPO);
const contract = defaultContract(REPO);
const val = (v: unknown, state = 'value') => ({ state, v, basis: 'official_page' });
const POSTAL = { kind: 'postal', lines: ['224 Banff Avenue'], locality: 'Banff', postcode: 'T1L 1A3' };
const NEAR = { kind: 'nearest_road', lines: ['Icefields Parkway'], locality: 'Lake Louise', postcode: null };
const rec = (ref: string) => world.cap.get(ref)!.rec as unknown as Record<string, unknown>;
const withAddress = <T>(ref: string, v: unknown, run: () => T): T => {
  const r = rec(ref);
  const had = r.address;
  r.address = v;
  try {
    return run();
  } finally {
    if (had === undefined) delete r.address;
    else r.address = had;
  }
};
const withoutAddresses = <T>(run: () => T): T => {
  const held = new Map<string, unknown>();
  for (const [ref, c] of world.cap) {
    const r = c.rec as unknown as Record<string, unknown>;
    if (r.address !== undefined) {
      held.set(ref, r.address);
      delete r.address;
    }
  }
  try {
    return run();
  } finally {
    for (const [ref, a] of held) (rec(ref) as Record<string, unknown>).address = a;
  }
};
const driveRef = [...world.cap.keys()].find((ref) => {
  const m = buildSections(world, ref, contract);
  return m?.directions?.mode === 'drive' && ref.startsWith('place/');
})!;

describe('the address wording', () => {
  it('a postal address as written, a nearest-road one as "Near <road>, <locality>"; the bare words (the home-town check) drop "Near"', () => {
    expect(addressLine({ ...POSTAL, kind: 'postal' } as never)).toBe('224 Banff Avenue, Banff, T1L 1A3');
    expect(addressLine({ ...NEAR, kind: 'nearest_road' } as never)).toBe('Near Icefields Parkway, Lake Louise');
    expect(addressCopy(NEAR)).toBe('Icefields Parkway, Lake Louise');
    expect(addressLine({ kind: 'postal', lines: ['Via Roma 1', 'Scala B'], locality: 'Bolzano', postcode: null })).toBe('Via Roma 1, Scala B, Bolzano');
  });
});

describe('readAddress', () => {
  const read = (v: unknown, point: { lat: number; lon: number } | null = null) => readAddress('place/x', 'X', { address: v }, point);
  it('reads a value, and nothing for an absent, searched_none or malformed one', () => {
    expect(read(val(POSTAL))).toMatchObject({ ref: 'place/x', name: 'X', kind: 'postal', locality: 'Banff', postcode: 'T1L 1A3' });
    expect(read(undefined)).toBeNull();
    expect(read(val(null, 'searched_none'))).toBeNull();
    expect(read(val({ ...POSTAL, lines: [] }))).toBeNull();
    expect(read(val({ ...POSTAL, kind: 'hq' }))).toBeNull();
    expect(read(val({ ...POSTAL, locality: ' ' }))).toBeNull();
  });
  it('is a place\'s address, never the household\'s: the home town in its words, or a point near home, drops it whole', () => {
    expect(read(val({ ...POSTAL, locality: 'Whitby' }))).toBeNull();
    expect(read(val({ ...POSTAL, lines: ['12 Whitby Road'] }))).toBeNull();
  });
  it('drops an address whose point lies inside the household exclusion radius', () => {
    const was = [process.env.HOME_POINT_LAT, process.env.HOME_POINT_LON];
    process.env.HOME_POINT_LAT = '10.5';
    process.env.HOME_POINT_LON = '-140.5';
    resetHomePointCache();
    try {
      expect(read(val(POSTAL), { lat: 10.5, lon: -140.5 })).toBeNull();
      expect(read(val(POSTAL), { lat: 51.4254, lon: -116.1773 })).not.toBeNull();
    } finally {
      if (was[0] === undefined) delete process.env.HOME_POINT_LAT;
      else process.env.HOME_POINT_LAT = was[0];
      if (was[1] === undefined) delete process.env.HOME_POINT_LON;
      else process.env.HOME_POINT_LON = was[1];
      resetHomePointCache();
    }  });
});

describe('PageModel.address', () => {
  it('is absent on every page while no record holds an address, and no section names it (never at rest)', () => {
    let pages = 0;
    withoutAddresses(() => {
      for (const ref of world.cap.keys()) {
        const m = buildSections(world, ref, contract);
        if (!m) continue;
        pages += 1;
        expect(m.address, ref).toBeUndefined();
        expect(m.sections.flatMap((s) => s.rows).some((r) => r.key === 'address'), ref).toBe(false);
        for (const s of m.sections) expect(s.closing ?? '', `${ref} ${s.id}`).not.toMatch(/address/i);
      }
    });
    expect(pages).toBeGreaterThan(200);
  });
  it('real data: a page whose Directions access point holds an address carries it, and no row or closing line names address', () => {
    // place/lake-louise: its Directions card goes to part/place/lake-louise#parking, which holds a real nearest-road address (CS7)
    const m = buildSections(world, 'place/lake-louise', contract)!;
    expect(m.directions).toMatchObject({ mode: 'drive' });
    const dir = m.directions as { mode: 'drive'; ref: string };
    const real = rec(dir.ref).address as { state: string; v: { kind: string; lines: string[]; locality: string } };
    expect(real.state).toBe('value');
    expect(m.address).toMatchObject({ ref: dir.ref, kind: real.v.kind, lines: real.v.lines, locality: real.v.locality });
    // every page that carries an address names no row and no closing line "address", and its address is a drive target's or the record's own
    let withAddress = 0;
    for (const ref of world.cap.keys()) {
      const p = buildSections(world, ref, contract);
      if (!p) continue;
      expect(p.sections.flatMap((s) => s.rows).some((r) => r.key === 'address'), ref).toBe(false);
      for (const s of p.sections) expect(s.closing ?? '', `${ref} ${s.id}`).not.toMatch(/address/i);
      if (p.address) {
        withAddress += 1;
        const d = p.directions as { mode: string; ref?: string } | undefined;
        expect([ref, d?.mode === 'drive' ? d.ref : undefined], ref).toContain(p.address.ref);
      }
    }
    expect(withAddress).toBeGreaterThan(0);
  });
  it('is in the contract now (the pageTask is gone), as an A mark on a door place type', () => {
    expect(contract.marks('culture.museum', 'place').get('address')).toBe('A');
    expect(contract.properties.address).toBeTruthy();
  });
  it('takes the address of the access point the Directions card goes to, else the record\'s own', () => {
    const m0 = withoutAddresses(() => buildSections(world, driveRef, contract)!);
    const dir = m0.directions as { mode: 'drive'; ref: string };
    const own = withoutAddresses(() => withAddress(driveRef, val(POSTAL), () => buildSections(world, driveRef, contract)!));
    expect(own.address).toMatchObject({ ref: driveRef, kind: 'postal' });
    const via = withoutAddresses(() => withAddress(dir.ref, val(NEAR), () => withAddress(driveRef, val(POSTAL), () => buildSections(world, driveRef, contract)!)));
    expect(via.address).toMatchObject({ ref: dir.ref, kind: 'nearest_road', lines: ['Icefields Parkway'] });
    // the address is still no row and no closing word of the page
    expect(via.sections.flatMap((s) => s.rows).some((r) => r.key === 'address')).toBe(false);
    expect(via.sections.some((s) => /address/i.test(s.closing ?? ''))).toBe(false);
  });
  it('a searched_none address gives nothing', () => {
    const m = withoutAddresses(() => withAddress(driveRef, val(null, 'searched_none'), () => buildSections(world, driveRef, contract)!));
    expect(m.address).toBeUndefined();
  });
  it('carries osm_ref (either form) and a filled map_sheet link, and nothing when there is none', () => {
    const ref = [...world.cap.keys()].find((r) => !r.startsWith('part/') && !r.startsWith('offer/') && !rec(r).osm_ref && buildSections(world, r, contract))!;
    const r = rec(ref);
    expect(buildSections(world, ref, contract)!.osmRef).toBeUndefined();
    r.osm_ref = 'way/123';
    r.links = [...((r.links as unknown[]) ?? []), { kind: 'map_sheet', state: 'filled', url: 'https://example.test/sheet.pdf' }];
    try {
      const m = buildSections(world, ref, contract)!;
      expect(m.osmRef).toBe('way/123');
      expect(m.mapSheet).toBe('https://example.test/sheet.pdf');
      r.osm_ref = { state: 'value', v: 'node/9', basis: 'osm' };
      expect(buildSections(world, ref, contract)!.osmRef).toBe('node/9');
      r.osm_ref = { state: 'searched_none', v: null, on: '2026-10-28', tried: ['osm'] };
      expect(buildSections(world, ref, contract)!.osmRef).toBeUndefined();
    } finally {
      delete r.osm_ref;
      r.links = (r.links as unknown[]).slice(0, -1);
    }
  });
  it('the registry row no longer waits for a page task', () => {
    expect(PROPERTY_BY_KEY.get('address')?.pageTask).toBeUndefined();
  });
});
