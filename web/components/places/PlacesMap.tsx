'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapSurface } from '@/components/map/MapSurface';
import { Icon, kindIcon } from '@/components/ui/Icon';
import type { ListState } from '@/lib/entities/types';
import { boundsOf } from '@/lib/map/geo';
import type { CameraState, MapHandle, MapSpec } from '@/lib/map/types';
import { clusterPins, formatCamera, parseCamera } from './cluster';
import type { PlaceListRow } from './rows';

/**
 * The Map view of the Places list. This page is a MapLibre page (one family per page), so the family is stated here,
 * not read from the flag. Pins cluster by zoom; the camera is written to `?c=lon,lat,zoom` so a view can be shared.
 */
export function PlacesMap({ rows }: { rows: PlaceListRow[]; state: ListState }) {
  const handle = useRef<MapHandle>(null);
  const located = useMemo(() => rows.filter((r) => r.lat !== null && r.lon !== null), [rows]);
  const byId = useMemo(() => new Map(located.map((r) => [r.id, r])), [located]);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(2);
  const [initial] = useState(() => (typeof window === 'undefined' ? null : parseCamera(new URLSearchParams(window.location.search).get('c'))));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const points = useMemo(
    () => located.map((r) => ({ id: r.id, at: { lng: r.lon as number, lat: r.lat as number }, label: r.name, kind: r.kind })),
    [located],
  );
  const { pins, members } = useMemo(() => clusterPins(points, Math.round(zoom * 2) / 2, selected), [points, zoom, selected]);
  const spec: MapSpec = useMemo(
    () => ({ pins, lines: [], selectedId: selected ?? undefined, fit: 'all', hideBasemapLabels: ['countries'], camera: initial ?? undefined, style: 'auto' }),
    [pins, selected, initial],
  );

  // a changed filter refits the camera (not on first paint, where the initial camera or `?c=` rules)
  const firstFit = useRef(true);
  useEffect(() => {
    if (firstFit.current) {
      firstFit.current = false;
      return;
    }
    handle.current?.fit();
  }, [points]);

  const onCamera = useCallback((c: CameraState) => {
    setZoom(c.zoom);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('c', formatCamera(c));
      window.history.replaceState(window.history.state, '', url);
    }, 300);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onSelect = useCallback(
    (id: string | null) => {
      if (id && members.has(id)) {
        const b = boundsOf((members.get(id) ?? []).map((m) => byId.get(m)).filter((r): r is PlaceListRow => Boolean(r)).map((r) => ({ lng: r.lon as number, lat: r.lat as number })));
        if (b) handle.current?.flyTo({ bounds: b });
        return;
      }
      setSelected(id);
    },
    [members, byId],
  );

  const card = selected ? byId.get(selected) : null;
  const missing = rows.length - located.length;
  return (
    <div className="places-map" data-count={located.length}>
      <div className="places-map-canvas">
        <MapSurface ref={handle} spec={spec} family="maplibre" label={`Map of ${located.length} places`} onSelect={onSelect} onCamera={onCamera} className="places-map-surface" />
        {card ? (
          <aside className="places-map-card" aria-label="Selected place">
            <button type="button" className="places-map-x" aria-label="Close" onClick={() => setSelected(null)}>
              <Icon name="close" size={14} />
            </button>
            <p className="places-map-kicker">
              <Icon name={kindIcon(card.kind)} size={14} /> {card.kindLabel} · {[card.area_name, card.country_name].filter(Boolean).join(', ')}
            </p>
            <h3>{card.name}</h3>
            {card.note ? <p className="places-map-note">{card.note}</p> : null}
            <p className="places-map-links">
              <a className="btn btn-primary" href={`/places/${card.slug}/`}>
                Place page <Icon name="arrow" size={14} />
              </a>
              <a className="btn" href={`/globe/place/${card.slug}/`}>
                <Icon name="globe" size={14} /> Globe
              </a>
            </p>
          </aside>
        ) : null}
      </div>
      <p className="places-map-foot muted">
        {located.length} {located.length === 1 ? 'place' : 'places'} on the map
        {missing > 0 ? `; ${missing} without a position are not shown` : ''}. Zoom in to split the numbered groups.
      </p>
    </div>
  );
}
