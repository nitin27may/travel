import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { beaconAllowed } from '@/lib/beacon';
import { readText, walkFiles } from './helpers';
import { builtOutDir } from './helpers/built';

const pages = (dist: string) => walkFiles(builtOutDir(dist)).filter((f) => f.endsWith('.html'));

describe('Cloudflare Web Analytics beacon', () => {
  it('is on every exported page when NEXT_PUBLIC_CF_BEACON_TOKEN is set at build, except the account and sign-in pages (GSI-S S7)', () => {
    const out = builtOutDir('.fixture-beacon');
    const files = pages('.fixture-beacon');
    expect(files.length).toBeGreaterThan(70);
    let kept = 0;
    for (const f of files) {
      const html = readText(f);
      const route = `/${path.relative(out, path.dirname(f)).split(path.sep).join('/')}`;
      if (!beaconAllowed(route)) {
        kept += 1;
        expect(html, f).not.toContain('cloudflareinsights');
        expect(html, f).not.toContain('beacon-test-token');
        continue;
      }
      // A redirect page (/favourites/ and the like) is Next's error shell: it renders no body, and the beacon loads on the page it sends to.
      if (html.includes('id="__next_error__"')) continue;
      expect(html, f).toContain('static.cloudflareinsights.com/beacon.min.js');
      expect(html, f).toContain('beacon-test-token');
    }
    // the sign-in and sign-up pages are exported, so the exclusion is really exercised
    expect(kept).toBeGreaterThanOrEqual(2);
  });

  it('is on no page when the variable is not set', () => {
    for (const dir of ['.fixture-out', '.next']) {
      for (const f of pages(dir)) {
        const html = readText(f);
        expect(html, f).not.toContain('cloudflareinsights');
        expect(html, f).not.toContain('data-cf-beacon');
      }
    }
  });
});
