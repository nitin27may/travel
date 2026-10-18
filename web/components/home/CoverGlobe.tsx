'use client';

import { GlobeCover } from '@/components/globe/GlobeCover';
import type { GlobeData } from '@/lib/globe/types';

/**
 * The home cover. It is the real globe in its quiet mode: it loads once the page is idle and in view, pauses while
 * off screen, holds still under reduced motion, takes neither the scroll wheel nor the keyboard, and each country pin
 * links to /globe/<cc>/. The page passes the pins without the cards: a cover pin needs only the tree.
 */
export function CoverGlobe({ data }: { data: GlobeData }) {
  return (
    <div className="home-globe">
      <GlobeCover data={data} className="home-map" label="Globe of the countries with trips and places" />
      <p className="home-globe-cue" aria-hidden="true">Tap a pin to open its country</p>
    </div>
  );
}
