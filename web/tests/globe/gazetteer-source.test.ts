import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** CLN-4: the server reads the same gazetteer the client fetches (web/public/globe), and no other copy. */
describe('the globe has one data copy', () => {
  const src = readFileSync(path.join(process.cwd(), 'lib', 'public', 'globe.ts'), 'utf8');

  it('the server reader names no legacy path', () => {
    expect(src).not.toMatch(/'legacy',\s*'globe'|legacy\/globe/);
  });

  it('the gazetteer it reads is the one under public/globe, with the GLB2 columns and a city per pin row', () => {
    const rows = JSON.parse(readFileSync(path.join(process.cwd(), 'public', 'globe', 'data', 'gazetteer.json'), 'utf8')) as unknown[][];
    expect(rows.length).toBeGreaterThan(14000);
    expect(rows.some((r) => r[0] === 'physical' && r.length >= 9)).toBe(true);
    expect(rows.find((r) => r[0] === 'city' && r[1] === 'Colonia del Sacramento')?.[7]).toBe(21714);
  });
});
