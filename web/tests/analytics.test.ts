import { describe, expect, it } from 'vitest';
import { readText, walkFiles } from './helpers';
import { builtOutDir } from './helpers/built';

const pages = (dist: string) => walkFiles(builtOutDir(dist)).filter((f) => f.endsWith('.html'));

describe('Cloudflare Web Analytics beacon', () => {
  it('is on every exported page when NEXT_PUBLIC_CF_BEACON_TOKEN is set at build', () => {
    const files = pages('.fixture-beacon');
    expect(files.length).toBeGreaterThan(70);
    for (const f of files) {
      const html = readText(f);
      expect(html, f).toContain('static.cloudflareinsights.com/beacon.min.js');
      expect(html, f).toContain('beacon-test-token');
    }
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
