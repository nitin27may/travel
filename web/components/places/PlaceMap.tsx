'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapFamilyProvider } from '@/components/map/MapFamilyProvider';
import { MapSurface } from '@/components/map/MapSurface';
import { placePageFamily } from '@/lib/map/family';
import type { LegendItem, LngLat, MapHandle, MapSpec, Pin } from '@/lib/map/types';
import { labelledIds, stackParking } from './mapPoints';
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
export interface PlaceMapTrack {
  /** The stored line, or the pieces of a relation that did not stitch. */
  lines: LngLat[][];
  /** Drawn dashed and labelled: held back until a person confirms it. */
  dashed: boolean;
  /** "© OpenStreetMap contributors (ODbL) · elevation ..." */
  credit: string;
}

export function PlaceMap({ name, points, guide, selectedId, track = null }: { name: string; points: PlaceMapPoint[]; guide: { from: LngLat; to: LngLat } | null; selectedId?: string; track?: PlaceMapTrack | null }) {
  const family = placePageFamily();
  const handle = useRef<MapHandle>(null);
  const { setHandle } = usePlaceShell();
  useEffect(() => {
    setHandle(handle.current);
    return () => setHandle(null);
  }, [setHandle]);

  const spec: MapSpec = useMemo(() => {
    // only the selected pin and the trailhead are named on the map (never both when they would overprint); the other lots keep their name for assistive tech
    const named = labelledIds(points, selectedId);
    const shown = family === 'maplibre' ? stackParking(points) : points;
    const pins: Pin[] = shown.map((p) => ({ id: p.id, at: p.at, style: p.style, label: p.label, quiet: !named.has(p.id) }));
    const legend: LegendItem[] = [
      ...(points.some((p) => p.style === 'trailhead') ? [{ id: 'l-th', label: 'Trailhead', style: 'trailhead' as const }] : []),
      ...(points.some((p) => p.style === 'parking') ? [{ id: 'l-pk', label: 'Parking', style: 'parking' as const }] : []),
      ...(track
        ? [track.dashed ? { id: 'l-track', label: 'Route not confirmed yet', style: 'straight-estimate' as const } : { id: 'l-track', label: 'Route from OpenStreetMap', style: 'trail' as const }]
        : guide
          ? [{ id: 'l-guide', label: 'Straight line, not the path', style: 'straight-estimate' as const }]
          : []),
    ];
    // a stored line replaces the straight guide: we draw the path we hold, or an honest straight line, never both
    const lines = track
      ? track.lines.map((coords, i) => ({ id: `track-${i}`, coords, style: track.dashed ? ('straight-estimate' as const) : ('trail' as const) }))
      : guide
        ? [{ id: 'guide', coords: [guide.from, guide.to], style: 'straight-estimate' as const }]
        : [];
    return {
      pins,
      lines,
      fit: 'all',
      selectedId,
      style: 'auto',
      legend,
    };
  }, [points, guide, selectedId, family, track]);

  return (
    <MapFamilyProvider family={family}>
      <MapSurface ref={handle} spec={spec} family={family} label={`Map of ${name}`} className="pl-map-surface" />
      {track ? <p className="muted small pl-map-credit">{track.credit}</p> : null}
    </MapFamilyProvider>
  );
}
