import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { placeHref } from '@/lib/data/paths';
import { loadPlaces } from '@/lib/data/places';
import { createPublicData } from '@/lib/public';

const WEB = path.resolve(__dirname, '..', '..');
const redirects: { from: string; to: string; status: number }[] = JSON.parse(readFileSync(path.join(WEB, 'redirects.json'), 'utf8'));
const slugs = new Set(createPublicData().placeSlugs());

describe('old place URLs', () => {
  it('the nested /places/<cc>/<region>/<area>/<place>/ route is gone', () => {
    expect(existsSync(path.join(WEB, 'app', 'places', '[slug]', '[region]'))).toBe(false);
  });
  it('every old URL of the 64 saved places redirects 301 to a place page that exists', () => {
    for (const row of loadPlaces()) {
      const hit = redirects.find((r) => r.from === placeHref(row.id));
      expect(hit, `no redirect for ${placeHref(row.id)}`).toBeTruthy();
      expect(hit?.status).toBe(301);
      expect(slugs.has((hit?.to ?? '').replace(/^\/places\//, '').replace(/\/$/, ''))).toBe(true);
    }
  });
  it('keeps /locations/* forwarding to /places/', () => {
    expect(redirects.find((r) => r.from === '/locations/*')?.to).toBe('/places/:splat');
  });
});
