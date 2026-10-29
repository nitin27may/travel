import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_TITLE } from '@travel/core/schema/copies.ts';

// /mine start JS budget (200 KB gz): the shell's static graph must not load the copies schema (Zod). These pin the plain copies.
const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('Mine start chunk keeps Zod out', () => {
  it('rows.ts holds a plain copy of the placeholder title, equal to core', () => {
    expect(src('lib/mine/rows.ts')).toContain(`const PLACEHOLDER_TITLE = '${PLACEHOLDER_TITLE}';`);
  });
  it('the shell and row models import no value from core schema modules', () => {
    for (const f of ['app/mine/MineShell.tsx', 'lib/mine/rows.ts', 'lib/mine/deviceList.ts', 'lib/mine/party.ts', 'lib/mine/dot.ts', 'lib/mine/useSync.ts']) {
      const bad = src(f).split('\n').filter((l) => /^import (?!type)/.test(l) && /@travel\/core\/schema\//.test(l));
      expect(bad, f).toEqual([]);
      expect(src(f), f).not.toMatch(/from '\.\/copies'/);
    }
  });
});
