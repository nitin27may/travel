import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '@/next.config';

// Review STEP2-ES ES-011 (edit-mode-spec EA13): /t/<id>/ answers with noindex and a same-origin referrer as headers, and its no-store
// Cache-Control comes from `force-dynamic`, so a move to static rendering fails here before it loses the header. The built answer is read
// by tests/e2e/t-read.spec.ts.
describe('/t/ privacy headers', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('flag on: X-Robots-Tag noindex, nofollow and Referrer-Policy same-origin on /t/:path*', async () => {
    vi.stubEnv('NEXT_PUBLIC_TRIP_EDIT', '1');
    const rules = await config.headers!();
    const t = rules.find((r) => r.source === '/t/:path*');
    expect(t?.headers).toEqual(
      expect.arrayContaining([
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Referrer-Policy', value: 'same-origin' },
      ]),
    );
    // nothing else of the site is touched
    expect(rules.map((r) => r.source)).toEqual(['/t/:path*']);
  });

  it('flag off: no header rule (the route is not in the build)', async () => {
    vi.stubEnv('NEXT_PUBLIC_TRIP_EDIT', '0');
    expect(await config.headers!()).toEqual([]);
  });

  it('the page stays force-dynamic (the source of Cache-Control: private, no-store) and says noindex in its meta', () => {
    const src = readFileSync(new URL('../../app/t/[id]/page.edit.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/export const dynamic = 'force-dynamic'/);
    expect(src).toContain('robots: { index: false, follow: false }');
  });
});
