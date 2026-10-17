import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateStore } from '@/lib/data/validate';
import { FIXTURE_ROOT } from './helpers';

const store = () => JSON.parse(readFileSync(path.join(FIXTURE_ROOT, 'data', 'locations', 'locations.json'), 'utf8')) as Record<string, Record<string, unknown>[]>;

describe('the build validates locations.json against the core schema', () => {
  it('accepts the real store shape', () => {
    expect(() => validateStore(store())).not.toThrow();
  });

  it('names the table, row and column of a bad value', () => {
    const s = store();
    s.places[3].kind = 'not-a-kind';
    expect(() => validateStore(s)).toThrow(/places\[3\].*kind/);
  });

  it('rejects an unknown column (the schema is strict)', () => {
    const s = store();
    s.places[0].height_cm = 137;
    expect(() => validateStore(s)).toThrow(/places\[0\]/);
  });
});
