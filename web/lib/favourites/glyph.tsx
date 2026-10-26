/** The heart (mine-and-bar-spec 6): drawn here, in the lazy chunk and Mine's, never in `Icon.tsx`, which every page loads at start. */
export const HEART_PATH = 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z';

export function HeartGlyph({ size = 18, strokeWidth = 1.75 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={HEART_PATH} />
    </svg>
  );
}
