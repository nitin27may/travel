import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/og-manifest.json/route';

// The share-image manifest lists every slug, title and photo URL: it is a build input and not a page of the running site (audit GB-B-2).
describe('/og-manifest.json', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('answers during the build, which is when scripts/og.mjs reads it', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    const res = GET();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { items: unknown[] }).items.length).toBeGreaterThan(100);
  });
  it('answers 404 on a running server and lists nothing', async () => {
    vi.stubEnv('NEXT_PHASE', '');
    const res = GET();
    expect(res.status).toBe(404);
    expect(await res.text()).not.toMatch(/slug|commons/i);
  });
});
