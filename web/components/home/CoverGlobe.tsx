'use client';

import { useEffect, useRef, useState } from 'react';
import { GlobeCover } from '@/components/globe/GlobeCover';
import type { GlobeData } from '@/lib/globe/types';

/**
 * The home cover. It is the real globe in its quiet mode: it loads once the page is idle and in view, pauses while
 * off screen, holds still under reduced motion, takes neither the scroll wheel nor the keyboard, and each country pin
 * links to /globe/<cc>/. The page passes the pins without the cards: a cover pin needs only the tree.
 */
export function CoverGlobe({ data }: { data: GlobeData }) {
  const host = useRef<HTMLDivElement>(null);
  const [pins, setPins] = useState(false);
  // The cue names a pin, so it waits until one is drawn (review 4: it sat over an empty globe for 3 s on the phone).
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const seen = () => el.querySelector('.globe-pin') !== null;
    if (seen()) { setPins(true); return; }
    const mo = new MutationObserver(() => { if (seen()) { setPins(true); mo.disconnect(); } });
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return (
    <div className="home-globe" ref={host}>
      <GlobeCover data={data} className="home-map" label="Globe of the countries with trips and places" />
      {pins ? <p className="home-globe-cue" aria-hidden="true">Tap a pin to open its country</p> : null}
    </div>
  );
}
