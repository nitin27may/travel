import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const THEMES = path.resolve(__dirname, '..', '..', 'app', 'themes.css');

/** hue in degrees, saturation 0..1 and lightness 0..1 of a #rrggbb colour */
export function hsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

const isGreen = (hex: string) => {
  const { h, s } = hsl(hex);
  return h >= 80 && h <= 170 && s > 0.15;
};

/** Every `--token: #hex` declaration in the generated theme file, with the block (light, dark, ...) it sits in. */
function declarations(css: string): { block: string; token: string; hex: string }[] {
  const out: { block: string; token: string; hex: string }[] = [];
  let block = '';
  for (const line of css.split('\n')) {
    const open = line.match(/^\s*([^{}]+)\{\s*$/);
    if (open) block = open[1].trim();
    const decl = line.match(/^\s*(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/);
    if (decl) out.push({ block, token: decl[1], hex: decl[2] });
  }
  return out;
}

describe('no theme token resolves to a green hue (owner rule, row 4.16)', () => {
  const all = declarations(readFileSync(THEMES, 'utf8'));

  it('reads the tokens it is meant to check', () => {
    expect(all.length).toBeGreaterThan(80);
    expect(all.filter((d) => d.token === '--ok').length).toBeGreaterThanOrEqual(2);
  });

  it('has no hex token with a hue of 80 to 170 degrees and saturation above 15%, in any theme block', () => {
    const green = all.filter((d) => isGreen(d.hex)).map((d) => `${d.block} ${d.token} ${d.hex}`);
    expect(green).toEqual([]);
  });

  it('keeps the status pair blue: --ok and --ok-soft are not green in light, dark or sunlight', () => {
    for (const d of all.filter((x) => x.token === '--ok' || x.token === '--ok-soft')) {
      const { h } = hsl(d.hex);
      expect(h, `${d.block} ${d.token}`).toBeGreaterThan(200);
      expect(h, `${d.block} ${d.token}`).toBeLessThan(240);
    }
  });

  it('keeps --ok at AA (4.5:1) on --ok-soft, --bg and --surface in light and dark', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const val = (block: string, token: string) => all.find((d) => d.block === block && d.token === token)!.hex;
    for (const block of ['[data-theme="light"]', '[data-theme="dark"]', '[data-theme="sunlight"]']) {
      for (const on of ['--ok-soft', '--bg', '--surface']) expect(ratio(val(block, '--ok'), val(block, on)), `${block} ${on}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
