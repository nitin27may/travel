import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GLOBE_HTML_BUDGET_KB, HEAD_ROWS, LIST_JS_BUDGET_KB, PAGE_SIZE, PLACE_JS_BUDGET_KB } from '@/lib/config/product';

const WEB = path.resolve(__dirname, '..', '..');
const src = (rel: string): string => readFileSync(path.join(WEB, rel), 'utf8');

// Until the owners of these files import from lib/config/product.ts, a copy that drifts is a failure here.
describe('product thresholds have one value', () => {
  it('Pager PAGE_SIZE equals product PAGE_SIZE', () => {
    const m = /export const PAGE_SIZE = \{([^}]*)\}/.exec(src('components/ui/Pager.tsx'));
    const copy = Object.fromEntries([...(m?.[1] ?? '').matchAll(/(\w+):\s*(\d+)/g)].map((x) => [x[1], Number(x[2])]));
    expect(copy).toEqual(PAGE_SIZE);
  });
  it('shards HEAD_ROWS equals product HEAD_ROWS', () => {
    expect(Number(/export const HEAD_ROWS = (\d+)/.exec(src('lib/entities/shards.ts'))?.[1])).toBe(HEAD_ROWS);
  });
  it('budget.test.ts ceilings equal the product ceilings', () => {
    const b = src('tests/budget.test.ts');
    expect(Number(/const LIST_BUDGET_KB = (\d+)/.exec(b)?.[1])).toBe(LIST_JS_BUDGET_KB);
    expect(Number(/const PLACE_BUDGET_KB = (\d+)/.exec(b)?.[1])).toBe(PLACE_JS_BUDGET_KB);
    expect(Number(/const GLOBE_HTML_BUDGET_KB = (\d+)/.exec(b)?.[1])).toBe(GLOBE_HTML_BUDGET_KB);
  });
});
