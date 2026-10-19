'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildCountryBook, loadCountries, type CountryBook } from '@/lib/globe/countries';
import { createGlobe, type GlobeEngine, type GlobeHandlers } from '@/lib/globe/engine';
import type { Camera, GlobeData } from '@/lib/globe/types';
import { pinsFor } from '@/lib/globe/model';
import { effectiveStyle, type StyleKey } from '@/lib/map/maplibre/styles';
import { pageIsDark } from '@/lib/map/palette';
import { PinLayer } from './PinLayer';

export interface GlobeCanvasProps {
  /** `full` is the interactive /globe canvas; `cover` is the quiet spinning picture for the home page. */
  mode: 'full' | 'cover';
  data: GlobeData;
  /** The full page passes the country book it already loaded; the cover loads its own. */
  book?: CountryBook;
  style?: StyleKey | 'auto';
  terrain?: boolean;
  exaggeration?: number;
  camera?: Camera;
  handlers?: GlobeHandlers;
  onEngine?: (e: GlobeEngine | null) => void;
  /** The world has painted (the first idle after the warm-up) or the globe failed: the canvas is fading in and pins may mount. */
  onPainted?: () => void;
  className?: string;
  label?: string;
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

// The cover shows country discs placed from our own pins, so it never downloads the 756 KB country outlines or the facts
// file; the engine gets an empty set of shapes (they only matter for hover and focus, which the cover does not have).
const COVER_BOOK = { fc: { type: 'FeatureCollection', features: [] }, facts: {}, byA3: {}, byA2: {} } as unknown as CountryBook;
const COVER_CAMERA: Camera = { lng: -30, lat: 24, zoom: 1.35 };
const COVER_CAMERA_PHONE: Camera = { lng: -30, lat: 24, zoom: 0.8 };
const regionName = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch { return null; } })();

/**
 * The MapLibre globe. Owns the engine's life: loads the library and the country shapes in the browser, creates
 * the map, tears it down. Everything the visitor can do on it is passed in as handlers by the page that mounts it.
 */
export function GlobeCanvas({ mode, data, book, style = 'auto', terrain = false, exaggeration = 1, camera, handlers, onEngine, onPainted, className = '', label = 'Globe' }: GlobeCanvasProps) {
  const box = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<GlobeEngine | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [painted, setPainted] = useState(false);
  const dark = usePageDark();
  const styleKey = effectiveStyle(style, dark);
  const live = useRef({ styleKey, terrain, exaggeration, handlers, camera, onEngine, book, onPainted });
  useEffect(() => { live.current = { styleKey, terrain, exaggeration, handlers, camera, onEngine, book, onPainted }; });
  const markPainted = useRef(() => {});
  useEffect(() => { markPainted.current = () => { setPainted(true); live.current.onPainted?.(); }; }, []);

  useEffect(() => {
    let dead = false;
    let made: GlobeEngine | null = null;
    (async () => {
      try {
        const [ml, countries] = await Promise.all([import('@/components/map/MapLibreMap').then((m) => m.loadMapLibre()), live.current.book ? Promise.resolve(live.current.book) : mode === 'cover' ? Promise.resolve(COVER_BOOK) : loadCountries()]);
        if (dead || !box.current) return;
        const cur = live.current;
        made = createGlobe(ml, {
          container: box.current,
          style: cur.styleKey,
          terrain: cur.terrain,
          exaggeration: cur.exaggeration,
          camera: cur.camera ?? (typeof matchMedia === 'function' && matchMedia('(max-width: 639px)').matches ? COVER_CAMERA_PHONE : COVER_CAMERA),
          countries: countries.fc,
          interactive: mode === 'full',
          handlers: {
            onReady: () => { cur.handlers?.onReady?.(); },
            onFirstIdle: () => markPainted.current(),
            onFail: (r) => { setFailure(r); markPainted.current(); live.current.handlers?.onFail?.(r); },
            onShape: (...a) => live.current.handlers?.onShape?.(...a),
            onBasemap: (f) => live.current.handlers?.onBasemap?.(f),
            onBackground: () => live.current.handlers?.onBackground?.(),
            describe: (...a) => live.current.handlers?.describe?.(...a) ?? null,
            onCamera: (c, u) => live.current.handlers?.onCamera?.(c, u),
            onInteract: () => live.current.handlers?.onInteract?.(),
            onWorldFramed: (z) => live.current.handlers?.onWorldFramed?.(z),
          },
        });
        if (mode === 'cover') made.setSpin(true, true);
        setEngine(made);
        live.current.onEngine?.(made);
        // A style or tile host that never settles must not leave the page on the placeholder disc for good.
        window.setTimeout(() => markPainted.current(), 4500);
      } catch (e) {
        if (!dead) setFailure(e instanceof Error ? e.message : 'The globe could not start.');
      }
    })();
    return () => { dead = true; setEngine(null); live.current.onEngine?.(null); made?.destroy(); };
  }, [mode]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    engine?.setStyle(styleKey);
  }, [styleKey, engine]);
  useEffect(() => { engine?.setTerrain(terrain, exaggeration); }, [terrain, exaggeration, engine]);

  // The cover has no controller: it shows the world's country discs and nothing else.
  const coverPins = useMemo(() => (mode === 'cover' ? pinsFor(data, [], COVER_BOOK.facts).map((p) => (p.label.length <= 3 ? { ...p, label: regionName?.of(p.label.toUpperCase()) ?? p.label } : p)) : null), [mode, data]);

  return (
    <div className={`globe-canvas ${className}`} data-globe-mode={mode} data-globe-style={styleKey} data-ready={engine ? 'true' : 'false'} data-painted={painted ? 'true' : 'false'} role="application" aria-roledescription="map" aria-label={label}>
      <div ref={box} className="globe-map" />
      {coverPins && engine && painted ? <PinLayer engine={engine} pins={coverPins} interactive={false} hrefFor={(p) => (p.path?.[0] ? `/globe/${p.path[0]}/` : null)} selectedKey={null} onOpen={() => undefined} /> : null}
      {!engine && !failure ? <div className="globe-loading" aria-live="polite">Loading globe</div> : null}
      {failure ? <div className="globe-fail" role="alert">The globe tiles are not available right now. The list of places still works.</div> : null}
    </div>
  );
}

export { buildCountryBook };
