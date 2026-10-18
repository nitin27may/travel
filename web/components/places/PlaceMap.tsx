'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapFamilyProvider } from '@/components/map/MapFamilyProvider';
import { MapSurface } from '@/components/map/MapSurface';
import { placePageFamily } from '@/lib/map/family';
import type { LegendItem, LngLat, MapHandle, MapSpec, Pin } from '@/lib/map/types';
import { usePlaceShell } from './PlaceShell';

export interface PlaceMapPoint {
  id: string;
  at: LngLat;
  style: 'trailhead' | 'parking' | 'place';
  label: string;
}

/**
 * The one map on a place page: it is both the route map and the sidebar map, so the page has exactly one family
 * (Google Maps Platform terms 3.2.3(e)). The family comes from NEXT_PUBLIC_PLACE_MAP_FAMILY; with no key it is MapLibre.
 * Under `google-js` the same pins and the guide line sit behind the click-to-load facade; under `google-embed` the
 * points are listed under the embed. Directions links are built from OUR stored points only.
 */
export function PlaceMap({ name, points, guide, selectedId }: { name: string; points: PlaceMapPoint[]; guide: { from: LngLat; to: LngLat } | null; selectedId?: string }) {
  const family = placePageFamily();
  const handle = useRef<MapHandle>(null);
  const { setHandle } = usePlaceShell();
  useEffect(() => {
    setHandle(handle.current);
    return () => setHandle(null);
  }, [setHandle]);

  const spec: MapSpec = useMemo(() => {
    // only the selected pin and the trailhead are named on the map; the other lots keep their name for assistive tech
    const pins: Pin[] = points.map((p) => ({ id: p.id, at: p.at, style: p.style, label: p.label, quiet: p.id !== selectedId && p.style !== 'trailhead' }));
    const legend: LegendItem[] = [
      ...(points.some((p) => p.style === 'trailhead') ? [{ id: 'l-th', label: 'Trailhead', style: 'trailhead' as const }] : []),
      ...(points.some((p) => p.style === 'parking') ? [{ id: 'l-pk', label: 'Parking', style: 'parking' as const }] : []),
      ...(guide ? [{ id: 'l-guide', label: 'Straight line, not the path', style: 'straight-estimate' as const }] : []),
    ];
    return {
      pins,
      lines: guide ? [{ id: 'guide', coords: [guide.from, guide.to], style: 'straight-estimate' as const }] : [],
      fit: 'all',
      selectedId,
      style: 'auto',
      legend,
    };
  }, [points, guide, selectedId]);

  return (
    <MapFamilyProvider family={family}>
      <MapSurface ref={handle} spec={spec} family={family} label={`Map of ${name}`} className="pl-map-surface" />
    </MapFamilyProvider>
  );
}
