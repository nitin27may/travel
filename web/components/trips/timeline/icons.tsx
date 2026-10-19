import type { SVGProps } from 'react';

// Glyphs the timeline needs that components/ui/Icon.tsx (L0) does not have. 24 x 24, stroke, currentColor, decorative.
const PATHS = {
  cup: 'M5 8h11v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5zM16 10h2a2.5 2.5 0 0 1 0 5h-2M8 3v2M12 3v2',
  key: 'M8 15a4 4 0 1 1 3.7-5.5H21v3h-2v2h-3v-2h-4.3A4 4 0 0 1 8 15Z',
  sunset: 'M4 18h16M7 18a5 5 0 0 1 10 0M12 6v3M5.6 10.6l1.8 1.8M18.4 10.6l-1.8 1.8M2 14h2M20 14h2',
  walker: 'M13 4.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0ZM10 21l2-6-3-2 1-5 4 2 2 3h3M12 15l3 6',
  bus: 'M5 4h14a1 1 0 0 1 1 1v12H4V5a1 1 0 0 1 1-1ZM4 12h16M7 20v-3M17 20v-3M8 15.5h.01M16 15.5h.01',
  boat: 'M3 16h18l-2.5 4h-13zM12 3v10M12 4l6 8H12M12 5 7 12h5',
  train: 'M7 3h10a2 2 0 0 1 2 2v11H5V5a2 2 0 0 1 2-2ZM5 11h14M8 20l1.5-4M16 20l-1.5-4M9 14.5h.01M15 14.5h.01',
  bed: 'M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-8v6M6.5 12.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  rest: 'M4 19h16M6 19v-8h12v8M6 11V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3',
} as const;

export type TlIconName = keyof typeof PATHS;

export function TlIcon({ name, size = 16, ...rest }: { name: TlIconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}
