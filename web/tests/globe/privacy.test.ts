import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bbox, inBox, inFeature, type Feat, type Geom } from '@/lib/globe/geometry';
import { nearHome } from '@/lib/public/origin';
import { describesParty } from '@/lib/public/party';
import { WEB } from '../helpers';

// A10: nothing under web/public/globe or data/reference/globe singles out the household's town, its home point, or who travelled.
const GLOBE = path.join(WEB, 'public', 'globe');
const REF = path.join(WEB, '..', 'data', 'reference', 'globe');
const HOME: [number, number] = [-78.94, 43.88];

describe('the globe files carry no household data (A10)', () => {
  it('has no city area that holds the home point, and no city is named after the home town', () => {
    const file = path.join(GLOBE, 'data', 'cities-adm8.json');
    if (!existsSync(file)) return; // the city file is optional: it is built by scripts/globe-cities.mjs
    const fc = JSON.parse(readFileSync(file, 'utf8')) as { credit: string; features: { properties: { name: string }; geometry: Geom }[] };
    expect(fc.credit).toMatch(/OpenStreetMap/);
    for (const f of fc.features) {
      const feat = { type: 'Feature', properties: f.properties, geometry: f.geometry } as Feat;
      feat._bbox = bbox(feat);
      expect(f.properties.name, 'a city named after the home town').not.toMatch(/whitby/i);
      expect(inBox(feat._bbox, HOME) && inFeature(feat, HOME), `${f.properties.name} holds the home point`).toBe(false);
      const [lng, lat] = [(feat._bbox[0][0] + feat._bbox[1][0]) / 2, (feat._bbox[0][1] + feat._bbox[1][1]) / 2];
      expect(nearHome(lat, lng), `${f.properties.name} is centred at home`).toBe(false);
    }
  });

  it('names the home town nowhere in the data we ship for the globe', () => {
    const files = [...readdirSync(path.join(GLOBE, 'data')).map((n) => path.join(GLOBE, 'data', n)).filter((f) => /cities|countries\.json/.test(f)), ...(existsSync(REF) ? readdirSync(REF).map((n) => path.join(REF, n)) : [])];
    for (const f of files) expect(readFileSync(f, 'utf8'), path.basename(f)).not.toMatch(/whitby/i);
  });

  it('keeps the P18 credits to files and credits: no sentence about a party', () => {
    const f = path.join(REF, 'p18.json');
    if (!existsSync(f)) return;
    const rows = JSON.parse(readFileSync(f, 'utf8')) as Record<string, { author?: string }>;
    for (const [qid, r] of Object.entries(rows)) expect(describesParty(r.author ?? ''), qid).toBe(false);
  });
});
