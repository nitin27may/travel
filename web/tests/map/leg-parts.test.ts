import { describe, expect, it } from 'vitest';
import { legParts } from '@/components/map/GoogleTripMap';
import { fallbackPalette } from '@/lib/map/palette';
import type { Line } from '@/lib/map/types';

const pal = fallbackPalette('light');
const line = (style: Line['style']): Line => ({ id: 'leg:1:2', style, coords: [{ lng: 0, lat: 0 }, { lng: 1, lat: 1 }] });
type Dash = { strokeOpacity: number; icons: { icon: { scale: number; strokeWeight: number; strokeColor: string } }[] };
type Solid = { strokeWeight: number; strokeColor: string; strokeOpacity: number };

describe('how a leg is drawn on Google (map note 5.1)', () => {
  it('an estimate is two dashed layers, ink over a halo, invisible as a line, 2.5 px on the picked day and never amber or solid', () => {
    const [halo, ink] = legParts(line('straight-estimate'), pal, 'rgb(1, 2, 3)', true, false) as Dash[];
    expect(halo!.strokeOpacity).toBe(0);
    expect(ink!.strokeOpacity).toBe(0);
    // the thickness is the weight (not an 8 px bead); the halo is 1 px wider each side; the dash itself is about 8 px long
    expect(ink!.icons[0]!.icon.strokeWeight).toBe(2.5);
    expect(halo!.icons[0]!.icon.strokeWeight).toBe(4.5);
    expect(ink!.icons[0]!.icon.scale).toBe(2.75);
    expect(halo!.icons[0]!.icon.scale).toBe(3.25);
    expect(ink!.icons[0]!.icon.strokeColor).toBe(pal.route);
    expect(ink!.icons[0]!.icon.strokeColor).not.toBe(pal.routePick);
  });
  it('is 2 px in All days', () => {
    expect((legParts(line('straight-estimate'), pal, 'x', false, false) as Dash[])[1]!.icons[0]!.icon.strokeWeight).toBe(2);
  });
  it('hovered, the same dashes turn accent over the casing and stay dashed', () => {
    const [halo, ink] = legParts(line('straight-estimate'), pal, 'rgb(1, 2, 3)', true, true) as Dash[];
    expect(ink!.icons[0]!.icon.strokeColor).toBe(pal.accent);
    expect(halo!.icons[0]!.icon.strokeColor).toBe('rgb(1, 2, 3)');
  });
  it('a routed picked day is a solid amber line over a wider casing', () => {
    const [casing, amber] = legParts(line('route-pick'), pal, 'rgb(1, 2, 3)', true, false) as Solid[];
    expect(amber).toMatchObject({ strokeColor: pal.routePick, strokeWeight: 3.5, strokeOpacity: 1 });
    expect(casing).toMatchObject({ strokeColor: 'rgb(1, 2, 3)', strokeWeight: 5.5 });
  });
  it('hovered, a routed picked leg is thicker (7 px casing, 5 px amber), since amber is already its colour', () => {
    const [casing, amber] = legParts(line('route-pick'), pal, 'rgb(1, 2, 3)', true, true) as Solid[];
    expect(amber).toMatchObject({ strokeColor: pal.accent, strokeWeight: 5 });
    expect(casing).toMatchObject({ strokeColor: 'rgb(1, 2, 3)', strokeWeight: 7 });
  });
  it('a routed leg in All days is 2 px ink with a halo', () => {
    const [halo, ink] = legParts(line('route'), pal, 'x', false, false) as Solid[];
    expect(ink).toMatchObject({ strokeColor: pal.route, strokeWeight: 2 });
    expect(halo!.strokeWeight).toBe(4);
  });
});
