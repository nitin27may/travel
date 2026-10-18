import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve(__dirname, '../../styles/print.css'), 'utf8');

describe('print stylesheet', () => {
  it('sets up A4 and Letter margins and always prints the map attribution', () => {
    expect(css).toMatch(/@page\s*{[^}]*margin:/);
    expect(css).toContain('OpenStreetMap contributors');
  });
  it('hides chrome and maps, keeps credits, prints link addresses, avoids breaking a day row', () => {
    expect(css).toMatch(/\.site-header[\s\S]*display: none !important/);
    expect(css).toMatch(/\.maplibregl-map/);
    expect(css).toMatch(/\.credits\s*{[^}]*display: block !important/);
    expect(css).toContain("content: ' (' attr(href) ')'");
    expect(css).toMatch(/\[id\^='day-'\][\s\S]*break-inside: avoid/);
  });
});
