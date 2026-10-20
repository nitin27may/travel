import { describe, expect, it } from 'vitest';
import { createPublicData } from '@/lib/public';

const data = createPublicData();
const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const rockies = data.getTrip('canadian-rockies-2029')!;
const dolo = data.getTrip('dolomites-2027')!;
const stopsOf = (t: typeof rockies) => t.days.flatMap((d) => (d.tracks ? d.tracks.flatMap((x) => x.items) : d.items)).filter((i) => i.category !== null);

describe('stop-to-page lookup (3.54, 3.57)', () => {
  it('Kinney Lake and Peyto Lake Lookout each link the page of the right kind: a trail stop the trail page, any other stop the place page', () => {
    for (const re of [/^Kinney Lake$/, /^Peyto Lake Lookout$/]) {
      const stops = stopsOf(rockies).filter((i) => re.test(i.name));
      expect(stops.length, String(re)).toBeGreaterThan(1);
      for (const s of stops) {
        expect(s.placeSlug, `${s.name} (${s.kind})`).toBeTruthy();
        expect(data.getPlace(s.placeSlug!)?.kind === 'trail', `${s.name} (${s.kind}) -> ${s.placeSlug}`).toBe(s.kind === 'trail');
      }
    }
  });
  it('the Dolomites trip links its five capture pages', () => {
    const linked = new Set(stopsOf(dolo).flatMap((i) => (i.placeSlug ? [i.placeSlug] : [])));
    const captured = [...linked].filter((s) => data.getPlace(s) !== null);
    expect(captured.length).toBeGreaterThanOrEqual(5);
  });
  it('every linked stop of every trip has a page', () => {
    for (const slug of data.tripSlugs()) {
      const t = data.getTrip(slug)!;
      for (const i of stopsOf(t)) if (i.placeSlug) expect(data.getPlace(i.placeSlug), `${slug}: ${i.name}`).not.toBeNull();
    }
  });
  it('a page merge never drops a stop: every stop of a day has its own row in the category view', () => {
    for (const slug of data.tripSlugs()) {
      const t = data.getTrip(slug)!;
      const rows = new Set(Object.values(t.categories).flatMap((c) => c.map((r) => norm(r.name))));
      for (const i of stopsOf(t)) expect(rows.has(norm(i.name)), `${slug}: ${i.name}`).toBe(true);
    }
  });
});

describe('day thumbnails (2.41)', () => {
  it('no two consecutive days and no more than two days of a trip share a photo, and a day without one has its kind glyph, never a bare box', async () => {
    const { buildTripPageModel } = await import('@/components/trips/model');
    for (const slug of ['dolomites-2027', 'canadian-rockies-2029', 'iceland-ring-road-2027', 'patagonia-2027']) {
      const t = data.getTrip(slug)!;
      const m = buildTripPageModel(t, (s) => { const p = data.getPlace(s); return p ? { point: null, photo: p.photo } : null; }, []);
      const urls = m.days.map((d) => d.thumb?.url ?? null);
      urls.forEach((u, i) => { if (u && i > 0) expect(u, `${slug} day ${i + 1}`).not.toBe(urls[i - 1]); });
      const uses = new Map<string, number>();
      for (const u of urls) if (u) uses.set(u, (uses.get(u) ?? 0) + 1);
      for (const [u, n] of uses) expect(n, `${slug} ${u}`).toBeLessThanOrEqual(2);
      for (const d of m.days) if (!d.thumb) expect(d.glyph, `${slug} day ${d.n}`).toBeTruthy();
    }
  });
});
