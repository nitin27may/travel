import type { DrawTier, GlobeNode, GlobePin } from '@/lib/public/types';

/** A country, state or district of the tree. A country also carries the point its disc sits on when the world is drawn. */
export interface GlobeTreeNode extends Omit<GlobeNode, 'children'> {
  children: GlobeTreeNode[];
  /** Countries only: [lon, lat], the mean of the country's real (not approximate) pins; null when it has none. */
  at?: [number, number] | null;
}

/** The areas with their counts and nothing else: what the world view and the side panel need (backlog 2.39). */
export interface GlobeTree {
  continents: { slug: string; name: string; places: number; trips: number; countries: GlobeTreeNode[] }[];
}

/**
 * One pin in the light shape (principle P8): name, kind, slug, position and the area path that clusters it. No facts, no
 * photo, no credit; those come with the card, one item at a time.
 */
export interface LightPin extends GlobePin {
  /** "Trail", "Lake", or "Trip": the display label of the kind. */
  kindLabel: string;
}

/** The file for one pin: its card, and the pin itself (so a deep link needs no country file first). */
export interface GlobeCardFile {
  card: GlobeCard;
  pin: LightPin;
}

/** What a pin's selection card shows. Built on the server from the data adapter, so the client holds no page data. */
export interface GlobeCard {
  key: string; // 'place:<slug>' or 'trip:<slug>'
  kind: 'place' | 'trip';
  slug: string;
  title: string;
  /** "Trail", "Lake", or the trip depth label. */
  kindLabel: string;
  /** Kind key for the glyph (place kind); trips use 'trip'. */
  glyph: string;
  /** "Sesto Dolomites, Italy". */
  areaLabel: string;
  photo: { url: string; width: number; author: string; licence: string; sourceUrl: string } | null;
  /** "Usable · 7 of 11" for places; "Condensed from the full plan" and the like for trips. */
  badge: string | null;
  /** True when the pin is a country centre, not the real spot. */
  approx: boolean;
  href: string;
}

/**
 * What the globe holds in the browser. The tree arrives first; `index.pins` fills one country at a time as areas open,
 * and `cards` one card at a time as pins are selected (see `lib/globe/store.ts`). Both are filled in place.
 */
export interface GlobeData {
  index: { continents: GlobeTree['continents']; pins: LightPin[] };
  cards: Record<string, GlobeCard>;
}

export type PinKind = 'country' | 'state' | 'district' | 'place' | 'trip';

/** One thing drawn on the globe. */
export interface PinModel {
  id: string;
  kind: PinKind;
  lng: number;
  lat: number;
  /** Count shown in the disc for country/state/district pins. */
  count: number;
  label: string;
  /** Area path that clicking it drills into (country/state/district pins). */
  path?: string[];
  /** Card key for place and trip pins. */
  cardKey?: string;
  glyph?: string;
  /** How far people travel for it: the label of a merged disc is its highest-tier member's (relevance 6.4). */
  tier: DrawTier;
  /** A local place drawn as a quiet dot (state level): merges on a 48 px grid. */
  quiet?: boolean;
  /** Outside the open area: drawn at 35% and still clickable (spec 6.4). */
  dim?: boolean;
}

/** The map view the URL describes. */
export type View =
  | { kind: 'area'; path: string[] }
  | { kind: 'place'; slug: string }
  | { kind: 'trip'; slug: string };

export interface Camera { lng: number; lat: number; zoom: number; pitch?: number; bearing?: number }

export interface CountryFacts {
  a2: string; a3: string; name: string; official?: string; capital?: string; region?: string; subregion?: string;
  population?: number; area?: number; flag?: string; latlng?: [number, number]; languages?: string[];
}
