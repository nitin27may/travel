import { describe, expect, it } from 'vitest';
import { cameraQuery, parseCamera, parseView, viewPath } from '@/lib/globe/url';
import { DEFAULT_PREFS, sanitisePrefs } from '@/lib/globe/prefs';

describe('globe URLs (patterns 1.2)', () => {
  it('reads the world, a country, a state and a district', () => {
    expect(parseView('/globe/')).toEqual({ kind: 'area', path: [] });
    expect(parseView('/globe')).toEqual({ kind: 'area', path: [] });
    expect(parseView('/globe/IT/')).toEqual({ kind: 'area', path: ['it'] });
    expect(parseView('/globe/it/south-tyrol/pustertal')).toEqual({ kind: 'area', path: ['it', 'south-tyrol', 'pustertal'] });
  });
  it('reads place and trip URLs', () => {
    expect(parseView('/globe/place/lago-di-braies/')).toEqual({ kind: 'place', slug: 'lago-di-braies' });
    expect(parseView('/globe/trip/patagonia-2027')).toEqual({ kind: 'trip', slug: 'patagonia-2027' });
  });
  it('round-trips through viewPath with a trailing slash', () => {
    for (const p of ['/globe/', '/globe/it/', '/globe/it/south-tyrol/', '/globe/it/south-tyrol/braies/', '/globe/place/x/', '/globe/trip/y/']) {
      expect(viewPath(parseView(p))).toBe(p);
    }
  });
  it('camera: reads ?c= and ignores nonsense', () => {
    expect(parseCamera('?c=11.5,46.5,8.2')).toEqual({ lng: 11.5, lat: 46.5, zoom: 8.2 });
    expect(parseCamera('?c=11,99,3')).toBeNull();
    expect(parseCamera('?c=a,b,c')).toBeNull();
    expect(parseCamera('')).toBeNull();
    expect(cameraQuery({ lng: 11.5, lat: 46.5, zoom: 8.2 })).toBe('?c=11.500,46.500,8.20');
    expect(cameraQuery(null)).toBe('');
  });
  it('camera: carries pitch and bearing when the fly-in tilted the view (check 10)', () => {
    expect(parseCamera('?c=11.5,46.6,8,45,20')).toEqual({ lng: 11.5, lat: 46.6, zoom: 8, pitch: 45, bearing: 20 });
    expect(parseCamera('?c=11.5,46.6,8,99,-200')).toEqual({ lng: 11.5, lat: 46.6, zoom: 8, pitch: 70, bearing: 160 });
    expect(cameraQuery({ lng: 11.5, lat: 46.6, zoom: 8, pitch: 45.4, bearing: 20 })).toBe('?c=11.500,46.600,8.00,45,20');
    expect(cameraQuery({ lng: 11.5, lat: 46.6, zoom: 8, pitch: 0 })).toBe('?c=11.500,46.600,8.00');
  });
});

describe('prefs', () => {
  it('falls back to defaults for junk and clamps the relief range', () => {
    expect(sanitisePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(sanitisePrefs({ style: 'neon', terrain: 'yes', exaggeration: 9, spin: 1 })).toEqual(DEFAULT_PREFS);
    expect(sanitisePrefs({ style: 'dark', terrain: false, exaggeration: 1.5, spin: false })).toEqual({ style: 'dark', terrain: false, exaggeration: 1.5, spin: false });
  });
});
