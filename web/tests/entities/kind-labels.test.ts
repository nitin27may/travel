import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OUT, TYPES, kindLabelsFrom } from '../../scripts/kind-labels.mjs';
import { KIND_LABELS } from '@/components/ui/KindGlyph';
import { kindLabel } from '@/lib/entities/labels';

// Golden: the two literal maps CONS-2 removed (KindGlyph.KIND_LABELS and the timeline's KIND_LABEL) gave exactly these words.
const WAS_GLYPH: Record<string, string> = {
  trail: 'Trail', trailhead: 'Trailhead', parking: 'Parking', viewpoint: 'Viewpoint', lake: 'Lake', waterfall: 'Waterfall', sight: 'Sight', town: 'Town',
  adventure: 'Adventure', lift: 'Lift', hut: 'Hut', stay: 'Stay', eatery: 'Eatery', swim_spot: 'Swim spot', event: 'Event', area: 'Area', scenic_drive: 'Scenic drive',
};
const WAS_TIMELINE: Record<string, string> = { trail: 'Trail', lake: 'Lake', viewpoint: 'Viewpoint', waterfall: 'Waterfall', sight: 'Sight', town: 'Town', activity: 'Activity', lift: 'Lift', area: 'Area', eatery: 'Eatery' };

describe('kind labels come from types.json through one helper', () => {
  it('kind-labels.json is what types.json derives (run node web/scripts/kind-labels.mjs)', () => {
    const nodes = (JSON.parse(readFileSync(TYPES, 'utf8')) as { nodes: { id: string; level: string; label: string }[] }).nodes;
    expect(JSON.parse(readFileSync(OUT, 'utf8'))).toEqual(kindLabelsFrom(nodes));
  });
  it('KIND_LABELS equals the old glyph map', () => expect(KIND_LABELS).toEqual(WAS_GLYPH));
  it('every timeline kind keeps its word', () => {
    for (const [k, v] of Object.entries(WAS_TIMELINE)) expect(kindLabel(k), k).toBe(v);
  });
  it('an unknown kind is its own name, capitalised', () => expect(kindLabel('ice_cave')).toBe('Ice cave'));
});
