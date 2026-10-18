'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GlobeEngine } from '@/lib/globe/engine';
import { parseCamera, parseHit } from '@/lib/globe/url';

/**
 * A marker where a search hit sent the visitor: `/globe/?c=lng,lat,zoom&m=<name>` (the header search links seas and ranges this
 * way). It stays for the visit; any other globe URL without `m` has none. Read once, when the engine is ready.
 */
export function HitMarker({ engine }: { engine: GlobeEngine }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [name, setName] = useState('');
  useEffect(() => {
    const hit = parseHit(window.location.search);
    const cam = parseCamera(window.location.search);
    if (!hit || !cam) return;
    const els = engine.syncMarkers('hit', [{ key: 'hit', lng: cam.lng, lat: cam.lat, className: 'globe-hit' }]);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the marker element exists only once the engine has made it
    setEl(els.get('hit') ?? null);
    setName(hit);
    return () => {
      engine.syncMarkers('hit', []);
    };
  }, [engine]);
  if (!el) return null;
  return createPortal(
    <span className="globe-hit-pin" role="img" aria-label={`Search result: ${name}`}>
      <span className="globe-hit-dot" />
      <span className="globe-hit-label">{name}</span>
    </span>,
    el,
  );
}
