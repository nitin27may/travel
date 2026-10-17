import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateStore } from '@/lib/data/validate';
import { FIXTURE_ROOT } from './helpers';

const store = () => JSON.parse(readFileSync(path.join(FIXTURE_ROOT, 'data', 'locations', 'locations.json'), 'utf8')) as Record<string, Record<string, unknown>[]>;

const vocab = () => JSON.parse(readFileSync(path.join(FIXTURE_ROOT, 'data', 'vocab', 'tags.json'), 'utf8')) as Record<string, unknown>;

describe('the build validates locations.json against the core schema', () => {
  it('accepts the real store shape', () => {
    expect(() => validateStore(store(), vocab())).not.toThrow();
  });

  it('names the table, row and column of a bad value', () => {
    const s = store();
    s.places[3].kind = 'not-a-kind';
    expect(() => validateStore(s, vocab())).toThrow(/places\[3\].*kind/);
  });

  it('rejects a v2 store (tags inside locations.json)', () => {
    const s = store();
    s.schema_version = 2 as never;
    expect(() => validateStore(s, vocab())).toThrow(/schema_version/);
  });

  it('names a bad tag in the vocabulary', () => {
    const v = vocab() as { tags: Record<string, unknown>[] };
    v.tags[2].kind = 'nope';
    expect(() => validateStore(store(), v)).toThrow(/tags\[2\].*kind/);
  });

  it('rejects an unknown column (the schema is strict)', () => {
    const s = store();
    s.places[0].height_cm = 137;
    expect(() => validateStore(s, vocab())).toThrow(/places\[0\]/);
  });
});
