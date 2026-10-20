import type { Glyph } from '@/lib/public/suitability';

// The glyphs of the suitability chips (display 3.1). Each chip also carries words, so a glyph never stands alone (P4).
const PATHS: Record<Exclude<Glyph, 'none'>, string> = {
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9h-13zM12 15v2',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  walker: 'M13 4.5a1.5 1.5 0 1 0 0-.01M11 8l-2 5 3 2v5M11 8l4 3 3 1M9 13l-3 3',
  gauge: 'M4 17a8 8 0 1 1 16 0M12 17l4-5M7 17h.01M17 17h.01',
  wheel: 'M11 4a1.5 1.5 0 1 0 0-.01M11 8v6h5l2.5 5M11 11h4M8.5 12.5A5 5 0 1 0 15 18.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  wave: 'M3 9c2.2 0 2.2 1.5 4.5 1.5S9.8 9 12 9s2.2 1.5 4.5 1.5S18.8 9 21 9M3 15c2.2 0 2.2 1.5 4.5 1.5S9.8 15 12 15s2.2 1.5 4.5 1.5S18.8 15 21 15',
  stroller: 'M5 5h3l1 9h9a3 3 0 0 0 3-3V8H8M9 14l-1 3M9.5 19.5a1 1 0 1 0 0-.01M17.5 19.5a1 1 0 1 0 0-.01',
  boat: 'M3 15h18l-2.5 5h-13zM12 4v11M12 5l5 8h-5',
  brake: 'M12 3 21 8v8l-9 5-9-5V8zM8.5 12h7',
  thermometer: 'M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0Z',
  kit: 'M6 8h12l1 12H5zM9 8V6a3 3 0 0 1 6 0v2',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  triangle: 'M12 3 22 21H2zM12 10v5M12 18h.01',
};

export function SuitGlyph({ name, size = 13 }: { name: Glyph; size?: number }) {
  if (name === 'none') return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
