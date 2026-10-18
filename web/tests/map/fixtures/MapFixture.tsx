'use client';

/**
 * Screenshot and e2e harness for the map adapter. It is copied to app/map-fixture-lm/page.tsx by
 * tests/map/shoot.mjs and removed afterwards, because web/app belongs to other lanes.
 * Query: ?scene=dolomites|facade|embed|mix|trail &theme=light|dark &family=maplibre|google-js|google-embed
 */
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapFamilyProvider } from '@/components/map/MapFamilyProvider';
import { MapSurface } from '@/components/map/MapSurface';
import type { MapFamily, MapHandle, MapSpec } from '@/lib/map/types';

const TOKENS = `
html.fx-light { color-scheme: light; --ink:#172230; --ink-2:#3A4654; --surface:#FFFFFF; --well:#F1EFEA; --line:#D6D1C7; --muted:#626C78; --accent:#E09A1C; --accent-ink:#172230;
  --map-land:#EEECE6; --map-high:#FFFFFF; --map-shade:rgba(23,34,48,.35); --map-contour:#B9B1A4; --map-water:#6F9FB4; --map-halo:rgba(255,255,255,.9); --map-route:#172230; --map-route-pick:#E09A1C; }
html.fx-dark { color-scheme: dark; --ink:#E7ECF1; --ink-2:#C8D2DC; --surface:#141C28; --well:#121A25; --line:#303E4E; --muted:#96A2B0; --accent:#EBA830; --accent-ink:#172230;
  --map-land:#1A2330; --map-high:#2E3A48; --map-shade:rgba(0,0,0,.55); --map-contour:#3A4A5C; --map-water:#3F7C8F; --map-halo:rgba(11,17,25,.9); --map-route:#E7ECF1; --map-route-pick:#EBA830; }
body { margin:0; background:var(--surface); color:var(--ink); font-family: Georgia, serif; }
`;

const P = (id: string, lng: number, lat: number, extra: object = {}) => ({ id, at: { lng, lat }, ...extra });
const DOLOMITES: MapSpec = {
  pins: [
    P('cortina-a', 12.136, 46.537, { style: 'stop-numbered', number: 3, label: 'Cortina (day 3)' }),
    P('cortina-b', 12.136, 46.537, { style: 'stop-numbered', number: 5, label: 'Cortina (day 5)' }),
    P('braies', 12.085, 46.694, { style: 'stop-numbered', number: 2, label: 'Lago di Braies' }),
    P('misurina', 12.255, 46.583, { style: 'stop-numbered', number: 4, label: 'Misurina' }),
    P('tre-cime', 12.302, 46.618, { style: 'place', label: 'Tre Cime' }),
    P('san-candido', 12.283, 46.733, { style: 'base', label: 'SAN CANDIDO' }),
    P('ortisei', 11.672, 46.574, { style: 'base', label: 'ORTISEI' }),
    P('seceda', 11.722, 46.602, { style: 'stop' }),
    P('th', 12.294, 46.612, { style: 'trailhead', label: 'Rifugio Auronzo' }),
    P('park', 12.289, 46.609, { style: 'parking', label: 'Parking' }),
    P('sorapis', 12.225, 46.543, { style: 'stop' }),
    P('trip', 12.0, 46.45, { style: 'trip', label: 'Trip' }),
  ] as MapSpec['pins'],
  lines: [
    { id: 'r1', style: 'route', coords: [{ lng: 12.283, lat: 46.733 }, { lng: 12.085, lat: 46.694 }, { lng: 12.136, lat: 46.537 }, { lng: 11.672, lat: 46.574 }] },
    { id: 'r2', style: 'route-pick', coords: [{ lng: 12.136, lat: 46.537 }, { lng: 12.255, lat: 46.583 }, { lng: 12.294, lat: 46.612 }] },
    { id: 't1', style: 'trail', coords: [{ lng: 12.294, lat: 46.612 }, { lng: 12.302, lat: 46.62 }, { lng: 12.31, lat: 46.628 }, { lng: 12.318, lat: 46.62 }, { lng: 12.294, lat: 46.612 }] },
    { id: 'e1', style: 'straight-estimate', coords: [{ lng: 11.722, lat: 46.602 }, { lng: 11.672, lat: 46.574 }] },
  ],
  fit: 'all',
  selectedId: 'braies',
  legend: [
    { id: 'l1', label: 'Every day by road', style: 'route' },
    { id: 'l2', label: 'Picked day', style: 'route-pick' },
    { id: 'l3', label: 'Trail', style: 'trail' },
    { id: 'l4', label: 'Base', style: 'base' },
  ],
};

const TRAIL: MapSpec = {
  pins: DOLOMITES.pins.filter((p) => ['th', 'park'].includes(p.id)),
  lines: DOLOMITES.lines.filter((l) => l.id === 't1'),
  fit: 'all', style: 'auto',
};

function Scene() {
  const q = useSearchParams();
  const scene = q.get('scene') ?? 'dolomites';
  const theme = q.get('theme') === 'dark' ? 'dark' : 'light';
  const family = (q.get('family') ?? 'maplibre') as MapFamily;
  const handle = useRef<MapHandle>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [cursor, setCursor] = useState(false);
  useEffect(() => {
    document.documentElement.classList.remove('fx-light', 'fx-dark', 'dark', 'light');
    document.documentElement.classList.add(`fx-${theme}`, theme);
  }, [theme]);
  const spec: MapSpec = scene === 'trail'
    ? { ...TRAIL, cursor: cursor ? { lng: 12.31, lat: 46.628 } : null }
    : { ...DOLOMITES, style: 'auto', selectedId: picked ?? DOLOMITES.selectedId, camera: q.get('c') ? (() => { const [lng, lat, zoom] = q.get('c')!.split(',').map(Number); return { lng, lat, zoom }; })() : undefined };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--surface)', padding: 12, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
        <span data-testid="picked">{picked ?? 'none'}</span>
        <button onClick={() => handle.current?.flyTo({ lng: 12.085, lat: 46.694 }, { zoom: 13 })}>fly to Braies</button>
        <button onClick={() => setCursor((c) => !c)}>cursor</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {scene === 'mix' ? (
          <MapFamilyProvider family="google-js">
            <MapSurface spec={DOLOMITES} family="maplibre" label="Mixed" />
          </MapFamilyProvider>
        ) : scene === 'mix2' ? (
          <>
            <MapSurface spec={DOLOMITES} family="maplibre" label="One" />
            <MapSurface spec={DOLOMITES} family="google-embed" label="Two" />
          </>
        ) : (
          <MapFamilyProvider family={family}>
            <MapSurface ref={handle} spec={spec} label="Route map of the Dolomites" onSelect={setPicked} className="h-full" />
          </MapFamilyProvider>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <style>{TOKENS}</style>
      <Suspense fallback={null}><Scene /></Suspense>
    </>
  );
}
