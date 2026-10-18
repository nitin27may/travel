'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { MapFamilyProvider } from '@/components/map/MapFamilyProvider';
import { MapSurface } from '@/components/map/MapSurface';
import { registerPageFamily } from '@/lib/map/registry';
import type { MapSpec } from '@/lib/map/types';
import type { CoverPin } from './pick';

// One map family on the home page.
registerPageFamily('/', 'maplibre');

/** Runs `fn` once the browser is idle, or after `ms` at the latest, so the first strip paints first. */
function whenIdle(fn: () => void, ms = 1200): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: ms });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 300);
  return () => window.clearTimeout(id);
}

/**
 * The cover map. Country pins are ink discs with counts; a click goes to /globe/<cc>/. The map loads after
 * the first strip: until then a `--well` block with a static caption holds the space (no layout shift).
 * When L2's `<GlobeCanvas mode="cover">` exists, swap the `MapSurface` below for it; nothing else changes.
 */
export function CoverGlobe({ pins }: { pins: CoverPin[] }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => whenIdle(() => setReady(true)), []);
  const spec = useMemo<MapSpec>(
    () => ({
      pins: pins.map((p) => ({ id: p.cc, at: { lng: p.lon, lat: p.lat }, style: 'stop-numbered' as const, number: p.count, label: p.name })),
      lines: [],
      fit: 'all',
      style: 'auto',
    }),
    [pins],
  );
  return (
    <div className="home-globe" data-ready={ready || undefined}>
      {ready ? (
        <MapFamilyProvider family="maplibre">
          <MapSurface spec={spec} label="Map of the countries with trips and places" className="home-map" onSelect={(id) => id && router.push(`/globe/${id}/`)} />
        </MapFamilyProvider>
      ) : (
        <p className="home-globe-caption">{pins.length} countries with trips or places</p>
      )}
    </div>
  );
}
