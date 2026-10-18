'use client';

import { useCallback, useMemo, useState } from 'react';
import { MapFamilyProvider } from '@/components/map/MapFamilyProvider';
import { MapSurface } from '@/components/map/MapSurface';
import { Chip } from '@/components/ui/Chip';
import { EntityImage } from '@/components/ui/EntityImage';
import { Icon } from '@/components/ui/Icon';
import { formatCameraParam, parseCameraParam } from '@/lib/map/geo';
import { registerPageFamily } from '@/lib/map/registry';
import type { CameraState, MapSpec } from '@/lib/map/types';
import { DEPTH_NOTICE, lengthLabel, tripHref } from './format';
import type { TripListRow } from './types';

registerPageFamily('/trips', 'maplibre');

const LEGEND: MapSpec['legend'] = [{ id: 'trip', label: 'Trip, at its first base', style: 'trip' }];

/** Reads `?c=lon,lat,zoom` once, on the client, so a shared Map view opens where it was left. */
function initialCamera(): CameraState | undefined {
  if (typeof window === 'undefined') return undefined;
  return parseCameraParam(new URLSearchParams(window.location.search).get('c'));
}

/** Map view of the trips list: one pin per trip at its first base; a click opens the selection card with the cover photo. */
export function TripsMap({ rows }: { rows: TripListRow[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [camera] = useState(initialCamera);

  const pinned = useMemo(() => rows.filter((r) => r.lat !== null && r.lon !== null), [rows]);
  const unpinned = rows.length - pinned.length;
  const spec = useMemo<MapSpec>(
    () => ({
      pins: pinned.map((r) => ({ id: r.slug, at: { lng: r.lon as number, lat: r.lat as number }, style: 'trip', label: r.title })),
      lines: [],
      fit: 'all',
      camera,
      selectedId: selected ?? undefined,
      legend: LEGEND,
    }),
    [pinned, selected, camera],
  );

  // The camera goes into the address bar as `c=` without adding history entries; list state is untouched.
  const onCamera = useCallback((c: CameraState) => {
    const p = new URLSearchParams(window.location.search);
    p.set('c', formatCameraParam(c));
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString().replace(/%2C/g, ',')}`);
  }, []);

  const trip = selected ? pinned.find((r) => r.slug === selected) : undefined;

  return (
    <MapFamilyProvider family="maplibre">
      <div className="trips-map">
        <MapSurface spec={spec} label="Map of trips, one pin at each trip's first base" onSelect={setSelected} onCamera={onCamera} className="trips-map-surface" />
        {trip ? (
          <aside className="trips-map-card" aria-label={`Selected trip: ${trip.title}`}>
            <div className="trips-map-photo">
              <EntityImage src={trip.cover} width={320} fallbackIcon="calendar" fallbackLabel={trip.region} />
            </div>
            <div className="trips-map-text">
              <h3>
                <a href={tripHref(trip.slug)}>{trip.title}</a>
              </h3>
              <p className="trips-map-meta">{[lengthLabel(trip.nights, trip.days), trip.region].filter(Boolean).join(' · ')}</p>
              <p className="trips-map-chips">
                <Chip kind={trip.seasonLabel ? 'neutral' : 'honest'} icon="calendar">
                  {trip.seasonLabel ?? 'Season not set yet'}
                </Chip>
                {trip.depth !== 'full' ? <Chip kind="honest">{DEPTH_NOTICE[trip.depth]}</Chip> : null}
                {trip.approx ? <Chip kind="honest" title="No base coordinates yet; the pin is the middle of the country">Position approximate</Chip> : null}
              </p>
              <a className="btn btn-primary btn-sm" href={tripHref(trip.slug)}>
                Open the plan <Icon name="arrow" size={14} />
              </a>
            </div>
            <button type="button" className="trips-map-close btn btn-icon btn-sm btn-ghost" aria-label="Close the selection card" onClick={() => setSelected(null)}>
              <Icon name="close" size={14} />
            </button>
          </aside>
        ) : null}
        {unpinned > 0 ? <p className="trips-map-note">{unpinned} {unpinned === 1 ? 'trip has' : 'trips have'} no map position yet and {unpinned === 1 ? 'is' : 'are'} left off the map.</p> : null}
      </div>
    </MapFamilyProvider>
  );
}
