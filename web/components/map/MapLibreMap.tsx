'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import './map.css';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { createMapLibre, type MapLibreEngine } from '@/lib/map/maplibre/engine';
import { effectiveStyle } from '@/lib/map/maplibre/styles';
import { pageIsDark } from '@/lib/map/palette';
import type { CameraState, MapHandle, MapSpec } from '@/lib/map/types';
import { Controls, Legend, Notice } from './MapChrome';
import { OfflineMap } from './OfflineMap';

export interface MapFamilyProps {
  spec: MapSpec;
  label: string;
  onSelect?: (id: string | null) => void;
  onCamera?: (c: CameraState) => void;
  handleRef?: Ref<MapHandle>;
  className?: string;
}

// Turbopack hands back a root-relative path for asset URLs; a blob worker needs an absolute one.
const abs = (u: URL | string): string => new URL(String(typeof u === 'string' ? u : u.href), location.origin).href;
let workerReady = false;
/**
 * maplibre-gl 6 ships its worker as a separate module that imports a shared chunk. The bundler cannot trace
 * that URL, so both files are emitted as assets and the worker is started from a blob whose import points
 * at the emitted shared chunk.
 */
async function startBundledWorker(ml: typeof import('maplibre-gl')): Promise<void> {
  if (workerReady) return;
  const workerUrl = new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url);
  const sharedUrl = new URL('maplibre-gl/dist/maplibre-gl-shared.mjs', import.meta.url);
  const code = (await (await fetch(abs(workerUrl))).text()).replace(/(['"])\.\/maplibre-gl-shared\.mjs\1/g, JSON.stringify(abs(sharedUrl)));
  ml.setWorkerUrl(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
  workerReady = true;
}

/**
 * REQUEST from lane L2 (globe): the one place maplibre-gl is imported, exported so the globe can build its own
 * Map (globe projection, country shapes, DOM pins) without a second dynamic import of the package.
 */
export async function loadMapLibre(): Promise<typeof import('maplibre-gl')> {
  const ml = await import('maplibre-gl');
  await startBundledWorker(ml);
  return ml;
}

function usePageDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(pageIsDark());
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', read);
    return () => { mo.disconnect(); mq.removeEventListener('change', read); };
  }, []);
  return dark;
}

export default function MapLibreMap({ spec, label, onSelect, onCamera, handleRef, className = '' }: MapFamilyProps) {
  const box = useRef<HTMLDivElement>(null);
  const engine = useRef<MapLibreEngine | null>(null);
  const specRef = useRef(spec);
  const cbs = useRef({ onSelect, onCamera });
  const [failure, setFailure] = useState<string | null>(null);
  const dark = usePageDark();
  const style = effectiveStyle(spec.style, dark);
  const styleRef = useRef(style);
  // Latest props for the one-time create effect and the engine callbacks.
  useEffect(() => {
    styleRef.current = style;
    specRef.current = spec;
    cbs.current = { onSelect, onCamera };
  });

  useImperativeHandle(handleRef, (): MapHandle => ({
    flyTo: (t, o) => engine.current?.flyTo(t, o),
    fit: (ids) => engine.current?.fit(ids),
    select: (id) => engine.current?.select(id),
    setCursor: (p) => engine.current?.setCursor(p),
  }), []);

  // Create once. maplibre-gl loads here, in the client, and never in a page without a map.
  useEffect(() => {
    let dead = false;
    let created: MapLibreEngine | null = null;
    (async () => {
      const ml = await import('maplibre-gl');
      await startBundledWorker(ml);
      if (dead || !box.current) return;
      try {
        created = await createMapLibre(ml, {
          container: box.current,
          spec: specRef.current,
          style: styleRef.current,
          onSelect: (id) => cbs.current.onSelect?.(id),
          onCamera: (c) => cbs.current.onCamera?.(c),
          onFail: (r) => setFailure(r),
        });
        if (dead) { created.destroy(); return; }
        engine.current = created;
      } catch (e) {
        setFailure(e instanceof Error ? e.message : 'The map could not start.');
      }
    })();
    return () => { dead = true; engine.current = null; created?.destroy(); };
  }, []);

  useEffect(() => { engine.current?.update(spec); }, [spec]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    engine.current?.setStyle(style);
  }, [style]);

  return (
    <div
      className={`map-surface relative overflow-hidden rounded-xl border ${className}`}
      style={{ background: 'var(--well)', borderColor: 'var(--line)', minHeight: 320 }}
      role="application"
      aria-roledescription="map"
      aria-label={label}
      data-map-family="maplibre"
      data-map-style={style}
    >
      <div className="absolute inset-0" hidden={!!failure}><div ref={box} style={{ width: '100%', height: '100%' }} /></div>
      {failure && <OfflineMap spec={spec} />}
      {failure && <Notice>Map tiles are not available right now. Pins and routes are drawn without a basemap.</Notice>}
      {!failure && spec.interactive !== false && (
        <Controls onZoom={(d) => engine.current?.zoomBy(d)} onFit={() => engine.current?.fit()} />
      )}
      {!failure && spec.legend && <Legend items={spec.legend} />}
      {/* Tab cycles the pins; Enter selects. Pages also show the same stops as a visible list. */}
      <ul className="sr-only" aria-label={`${label}: points`}>
        {spec.pins.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onFocus={() => engine.current?.focusPin(p.id)}
              onBlur={() => engine.current?.focusPin(null)}
              onClick={() => onSelect?.(p.id)}
            >
              {p.number != null ? `${p.number}. ` : ''}{p.label ?? p.style}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
