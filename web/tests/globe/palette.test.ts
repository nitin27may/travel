import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FALLBACK_TOKENS, buildPalette, contrast, mix, parseColour } from '@/lib/globe/palette';
import { WEB } from '../helpers';

const pal = (mode: 'light' | 'dark') => buildPalette((n) => FALLBACK_TOKENS[mode][n], mode);

describe('the globe palette (spec 6.1, 6.3, 6.6)', () => {
  it('reads hex, rgb and rgba', () => {
    expect(parseColour('rgb(169 196 211)')).toEqual([169, 196, 211, 1]);
    expect(parseColour('rgb(1 2 3)')).toEqual([1, 2, 3, 1]);
    expect(parseColour('rgba(11,17,25,0.6)')).toEqual([11, 17, 25, 0.6]);
  });

  it('mixes toward a colour', () => {
    expect(parseColour(mix('rgb(0 0 0)', 'rgb(255 255 255)', 0.5)).slice(0, 3)).toEqual([128, 128, 128]);
  });

  it('keeps land lighter than the sea in Dark, as the spec asks (M4)', () => {
    const d = pal('dark');
    expect(contrast(d.land, d.ocean)).toBeGreaterThan(1.15);
  });

  it('has no green in any base colour (hue 75 to 165 above 12% saturation)', () => {
    for (const mode of ['light', 'dark'] as const) {
      const p = pal(mode);
      for (const [k, v] of Object.entries({ ocean: p.ocean, land: p.land, wood: p.wood, river: p.river, sky: p.sky, horizon: p.horizon, fog: p.fog })) {
        const [r, g, b] = parseColour(v).slice(0, 3).map((x) => x / 255);
        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
        const l = (max + min) / 2;
        const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
        const hue = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
        expect(sat > 0.12 && hue >= 75 && hue <= 165, `${mode} ${k} ${v}`).toBe(false);
      }
    }
  });

  // The selection is a 2.5 px amber line between two 1 px casings (6.3). On the dark globe the amber carries the edge by itself (the casing
  // is about 1.2:1 on the dark ocean and claims nothing there); on light land and light water the ink casing carries it.
  it('amber reaches 3:1 on the dark ocean, the dark land and its own casing', () => {
    const d = pal('dark');
    expect(contrast(d.accentSel, d.ocean)).toBeGreaterThanOrEqual(3);
    expect(contrast(d.accentSel, d.land)).toBeGreaterThanOrEqual(3);
    expect(contrast(d.accentSel, d.casingSel)).toBeGreaterThanOrEqual(3);
  });

  it('the light ink casing reaches 3:1 on light land and light water', () => {
    const l = pal('light');
    expect(contrast(l.casingSel, l.land)).toBeGreaterThanOrEqual(3);
    expect(contrast(l.casingSel, l.river)).toBeGreaterThanOrEqual(3);
  });
});

describe('engine.ts', () => {
  it('holds no colour literal: every fill, line and sky colour is a token (A2, 3.3b)', () => {
    const text = readFileSync(path.join(WEB, 'lib/globe/engine.ts'), 'utf8');
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(text).not.toMatch(/\brgba?\(\s*\d/);
  });
});

describe('Q6: the dark land is a token', () => {
  it('reads the dark land and wood from --globe-land and --globe-wood, lighter than the sea, with no blend in the engine', () => {
    const d = buildPalette((n) => FALLBACK_TOKENS.dark[n], 'dark');
    expect(d.land).toBe(FALLBACK_TOKENS.dark['--globe-land']);
    expect(d.wood).toBe(FALLBACK_TOKENS.dark['--globe-wood']);
    expect(contrast(d.land, d.ocean)).toBeGreaterThan(1.15);
    const text = readFileSync(path.join(WEB, 'lib/globe/engine.ts'), 'utf8');
    expect(text).not.toMatch(/mix\(pal\.land, pal\.high/);
    expect(readFileSync(path.join(WEB, 'app/themes.css'), 'utf8').match(/--globe-land:/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

import { plainColour } from '@/lib/globe/palette';
describe('plainColour (the map border token reaches MapLibre as plain rgb, review S6)', () => {
  it('reads a color-mix against transparent', () => {
    expect(plainColour('color-mix(in srgb, rgb(77 91 107) 60%, transparent)')).toBe('rgb(77 91 107 / 0.6)');
  });
  it('reads the color(srgb) form a canvas gives back', () => {
    expect(plainColour('color(srgb 0.301961 0.356863 0.419608 / 0.6)')).toBe('rgb(77 91 107 / 0.6)');
  });
  it('leaves a plain colour alone', () => {
    expect(plainColour('rgb(1 2 3)')).toBe('rgb(1 2 3)');
  });
});
