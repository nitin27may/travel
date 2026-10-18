import type { GlobeIndex } from '@/lib/public/types';

export type { GlobeIndex };

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

export interface GlobeData {
  index: GlobeIndex;
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
}

/** The map view the URL describes. */
export type View =
  | { kind: 'area'; path: string[] }
  | { kind: 'place'; slug: string }
  | { kind: 'trip'; slug: string };

export interface Camera { lng: number; lat: number; zoom: number }

export interface CountryFacts {
  a2: string; a3: string; name: string; official?: string; capital?: string; region?: string; subregion?: string;
  population?: number; area?: number; flag?: string; latlng?: [number, number];
}
