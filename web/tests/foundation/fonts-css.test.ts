import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = path.resolve(__dirname, '..', '..');
const css = readFileSync(path.join(WEB, 'app', 'globals.css'), 'utf8');
const layout = readFileSync(path.join(WEB, 'app', 'layout.tsx'), 'utf8');

describe('fonts (tokens 6)', () => {
  it('declares the three families with font-display: swap', () => {
    for (const family of ['Big Shoulders Display', 'Source Serif 4', 'IBM Plex Mono']) expect(css).toContain(`font-family: '${family}'`);
    const faces = css.match(/@font-face \{[^}]*\}/g) ?? [];
    expect(faces.length).toBeGreaterThanOrEqual(6);
    for (const f of faces) expect(f).toContain('font-display: swap');
  });
  it('preloads Big Shoulders and Source Serif roman, and links no Google Fonts', () => {
    expect(layout).toContain('big-shoulders-display-latin-wght-normal.woff2');
    expect(layout).toContain('source-serif-4-latin-wght-normal.woff2');
    expect(css + layout).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });
});
