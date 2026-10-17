import type { SVGProps } from 'react';

/** 24x24 stroke icons, currentColor, decorative by default (pair with text or an aria-label). */
const PATHS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-3.6-3.6',
  close: 'M6 6l12 12M18 6 6 18',
  filter: 'M4 6h16M7 12h10M10 18h4',
  cards: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14',
  chevronDown: 'm6 9 6 6 6-6',
  chevronRight: 'm9 6 6 6-6 6',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  pin: 'M12 21s-6-5.6-6-10.5a6 6 0 1 1 12 0C18 15.4 12 21 12 21Zm0-8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  mountain: 'm3 19 6.5-11 3.5 6 2-3 6 8H3Z',
  water: 'M3 9c2.2 0 2.2 1.5 4.5 1.5S9.8 9 12 9s2.2 1.5 4.5 1.5S18.8 9 21 9M3 14c2.2 0 2.2 1.5 4.5 1.5S9.8 14 12 14s2.2 1.5 4.5 1.5S18.8 14 21 14M3 19c2.2 0 2.2 1.5 4.5 1.5S9.8 19 12 19s2.2 1.5 4.5 1.5S18.8 19 21 19',
  building: 'M5 20V6l7-3v17M12 9h7v11M8 9h1M8 13h1M8 17h1M15 13h1M15 17h1M3 20h18',
  tree: 'M12 3 6 12h3l-3 5h12l-3-5h3L12 3ZM12 17v4',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6',
  eye: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  road: 'M8 3 5 21M16 3l3 18M12 4v3M12 10v4M12 17v3',
  bolt: 'M13 3 5 13h6l-1 8 8-10h-6l1-8Z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  columns: 'M4 5h16v14H4zM9.3 5v14M14.7 5v14',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5',
  sort: 'M8 5v14M4 15l4 4 4-4M16 19V5M12 9l4-4 4 4',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.7 3.7 5.7 3.7 9S14.5 18.3 12 21c-2.5-2.7-3.7-5.7-3.7-9S9.5 5.7 12 3Z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 7.5h.01',
  // status glyphs
  stIdea: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  stShortlisted: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 3v18',
  stPlanned: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  stVisited: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12.5l3 3 5-6',
  stDropped: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM6 6l12 12',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, className, ...rest }: IconProps) {
  const dashed = name === 'stIdea';
  const filled = name === 'stPlanned';
  const half = name === 'stShortlisted';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dashed ? '3 3.2' : undefined}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {half ? <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" /> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}

const KIND_ICONS: Record<string, IconName> = {
  mountain: 'mountain',
  valley: 'mountain',
  canyon: 'mountain',
  lake: 'water',
  waterfall: 'water',
  island: 'water',
  city: 'building',
  town: 'building',
  park: 'tree',
  trail: 'route',
  viewpoint: 'eye',
  lighthouse: 'eye',
  drive: 'road',
  activity: 'bolt',
  region: 'map',
};

export function kindIcon(kind: string): IconName {
  return KIND_ICONS[kind] ?? 'pin';
}

const STATUS_ICONS: Record<string, IconName> = {
  idea: 'stIdea',
  shortlisted: 'stShortlisted',
  planned: 'stPlanned',
  visited: 'stVisited',
  dropped: 'stDropped',
};

export function statusIcon(status: string): IconName {
  return STATUS_ICONS[status] ?? 'stIdea';
}
