import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PinList } from '@/components/map/PinList';
import { pinName } from '@/lib/map/pinName';
import type { Pin } from '@/lib/map/types';

const pins: Pin[] = [
  { id: 'a', at: { lng: 12.3, lat: 46.6 }, style: 'place', label: 'Rifugio Auronzo', quiet: true },
  { id: 'b', at: { lng: 12.31, lat: 46.61 }, style: 'stop-numbered', number: 2, label: '3 places', quiet: true },
  { id: 'c', at: { lng: 12.32, lat: 46.62 }, style: 'parking' },
  { id: 'd', at: { lng: 12.33, lat: 46.63 }, style: 'trailhead', label: '  ', quiet: true },
];

describe('the off-screen pin list (backlog 2.28)', () => {
  const html = renderToStaticMarkup(<PinList pins={pins} label="Tre Cime map" />);

  it('lists every pin, quiet ones included, with its name', () => {
    expect(html).toContain('aria-label="Tre Cime map: points"');
    expect(html).toContain('>Rifugio Auronzo<');
    expect(html).toContain('>2. 3 places<');
    expect((html.match(/<button/g) ?? []).length).toBe(pins.length);
  });

  it('names an unlabelled pin by its kind, not by the raw style id', () => {
    expect(pinName(pins[2])).toBe('Parking');
    expect(pinName(pins[3])).toBe('Trailhead');
    expect(html).not.toContain('>place<');
  });
});
