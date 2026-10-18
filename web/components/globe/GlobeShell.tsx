'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { GlobeController, type GlobeSnapshot } from '@/lib/globe/controller';
import { WORLD_LAT, WORLD_LNG, worldFrame } from '@/lib/globe/framing';
import { loadCountries, type CountryBook } from '@/lib/globe/countries';
import type { GlobeEngine } from '@/lib/globe/engine';
import { DEFAULT_PREFS, loadPrefs, savePrefs, type GlobePrefs } from '@/lib/globe/prefs';
import type { SearchHit } from '@/lib/globe/search';
import type { Camera, GlobeData, PinModel } from '@/lib/globe/types';
import { parseCamera, parseView } from '@/lib/globe/url';
import { effectiveStyle } from '@/lib/map/maplibre/styles';
import { pageIsDark } from '@/lib/map/palette';
import { prefersReducedMotion } from '@/lib/map/reduced-motion';
import { GlobeCanvas } from './GlobeCanvas';
import { GlobeControls } from './GlobeControls';
import { GlobeCrumbs } from './GlobeCrumbs';
import { GlobePanelBody } from './GlobePanel';
import { GlobeSearch } from './GlobeSearch';
import { PinLayer } from './PinLayer';
import { FeatureCard, SelectionCard, type NearbyPlace } from './SelectionCard';
import { distanceKm } from '@/lib/map/geo';

const EMPTY: GlobeSnapshot = { ready: false, failed: null, loading: '', path: [], crumbs: [], selected: null, feature: null, pins: [], notice: null };
/** Height of the phone sheet at rest (components 5.5). */
const PEEK = 176;
/** The control card (316 wide at left 12) keeps the disc clear when it is open. */
const CARD_FOOT = 340;
const strip = (p: string) => p.replace(/\/+$/, '');

function useMedia(query: string, initial = false): boolean {
  const [on, setOn] = useState(initial);
  useEffect(() => {
    const mq = matchMedia(query);
    const read = () => setOn(mq.matches);
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, [query]);
  return on;
}

/**
 * The /globe page (patterns 3.2, components 7.2): a full-bleed globe under the header with a control card, search,
 * breadcrumb chip, hint bar, side panel and selection card floating over it. It lives in the globe layout, so
 * moving between /globe URLs never rebuilds the map; the URL is read once and then followed.
 */
export function GlobeShell({ data }: { data: GlobeData }) {
  const pathname = usePathname();
  const phone = useMedia('(max-width: 639px)');
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const [book, setBook] = useState<CountryBook | null>(null);
  const [prefs, setPrefs] = useState<GlobePrefs>(DEFAULT_PREFS);
  const [prefsReady, setPrefsReady] = useState(false);
  const [snap, setSnap] = useState<GlobeSnapshot>(EMPTY);
  const [engine, setEngine] = useState<GlobeEngine | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(true);
  const [hint, setHint] = useState(true);
  const [dark, setDark] = useState(false);
  const [cardEl, setCardEl] = useState<HTMLElement | null>(null);
  const ctrl = useRef<GlobeController | null>(null);
  const layoutRef = useRef<() => { width: number; height: number; cover: { top: number; right: number; bottom: number; left: number } }>(() => ({ width: 1, height: 1, cover: { top: 0, right: 0, bottom: 0, left: 0 } }));
  const short = useMedia('(max-height: 500px) and (orientation: landscape)');
  const root = useRef<HTMLDivElement>(null);
  // The first frame is computed from the window, before the canvas exists; the controller re-frames from the real canvas once it does.
  const [initialCamera] = useState<Camera | null>(() => {
    if (typeof window === 'undefined') return null;
    const restored = parseCamera(window.location.search);
    if (restored) return restored;
    const isPhone = window.matchMedia('(max-width: 639px)').matches;
    const isShort = window.matchMedia('(max-height: 500px) and (orientation: landscape)').matches;
    const w = window.innerWidth;
    const h = window.innerHeight - (isPhone ? 56 + 56 : 56);
    const f = worldFrame(w, h, isPhone ? { top: 0, right: 0, bottom: PEEK, left: 0 } : { top: isShort ? 52 : 0, right: (isShort ? 300 : 360) + 24, bottom: 0, left: 0 });
    return { lng: WORLD_LNG, lat: WORLD_LAT, zoom: f.zoom };
  });

  // Full-bleed: the footer goes, the page does not scroll (patterns 3.2).
  useLayoutEffect(() => {
    document.documentElement.dataset.globe = 'true';
    return () => { delete document.documentElement.dataset.globe; };
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of browser-only state (localStorage, theme) after mount */
    setPrefs(loadPrefs());
    setPrefsReady(true);
    if (window.innerWidth < 1280) setCardOpen(false);
    setDark(pageIsDark());
    const mo = new MutationObserver(() => setDark(pageIsDark()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    loadCountries().then(setBook).catch(() => setSnap((s) => ({ ...s, failed: 'The country shapes could not be loaded.' })));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => mo.disconnect();
  }, []);

  const navigate = useCallback((url: string, mode: 'push' | 'replace') => {
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  }, []);

  const layout = useCallback(() => layoutRef.current(), []);
  const controller = useMemo(() => {
    if (!book) return null;
    // The controller calls `layout` from event handlers only, never during render, so the ref is read after render.
    // eslint-disable-next-line react-hooks/refs
    return new GlobeController({ data, book, navigate, isPhone: () => window.matchMedia('(max-width: 639px)').matches, layout, onChange: setSnap });
  }, [book, data, navigate, layout]);
  useEffect(() => { ctrl.current = controller; }, [controller]);

  const handlers = useMemo(() => {
    if (!controller) return undefined;
    return {
      onReady: () => controller.ready(),
      onFail: (r: string) => controller.fail(r),
      onShape: controller.onShape.bind(controller),
      onBasemap: controller.onBasemap.bind(controller),
      onBackground: controller.onBackground.bind(controller),
      describe: controller.describe.bind(controller),
      onCamera: (cam: Camera) => controller.onCamera(cam),
      onInteract: () => setHint(false),
      onWorldFramed: (z: number) => controller.worldFramed(z),
    };
  }, [controller]);

  // First view: read the URL as soon as the engine exists (the style may still be loading, or offline), restoring `?c=` when present.
  const onEngine = useCallback((e: GlobeEngine | null) => {
    setEngine(e);
    const c = ctrl.current;
    if (!e || !c) return;
    c.attach(e);
    void c.applyView(parseView(window.location.pathname), { camera: parseCamera(window.location.search), fly: true });
  }, []);

  // Follow the URL when something else moves it: Back and Forward, or a link to another /globe URL.
  useEffect(() => {
    const c = ctrl.current;
    if (!c || !c.currentUrl || !pathname) return;
    if (strip(pathname) === strip(c.currentUrl)) return;
    void c.applyView(parseView(pathname), { camera: parseCamera(window.location.search), fly: true });
  }, [pathname]);
  useEffect(() => {
    const onPop = () => {
      const c = ctrl.current;
      if (!c || !c.currentUrl) return;
      if (strip(window.location.pathname) === strip(c.currentUrl)) return;
      void c.applyView(parseView(window.location.pathname), { camera: parseCamera(window.location.search), fly: true });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Esc steps back one level (components 7.2); Home resets the view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'Escape' && e.key !== 'Home') || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('[role="dialog"]') || t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') return;
      // Esc closes the card first, then steps up a level; Home returns to the whole world.
      if (e.key === 'Home') { e.preventDefault(); ctrl.current?.reset(); } else ctrl.current?.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const styleKey = effectiveStyle(prefs.style, dark);
  const changePrefs = (next: Partial<GlobePrefs>) => {
    setPrefs((p) => {
      const merged = { ...p, ...next };
      savePrefs(merged);
      return merged;
    });
  };

  // Spin is for the world view only, and never under reduced motion.
  useEffect(() => { engine?.setSpin(prefs.spin && !reduced, snap.path.length === 0 && !snap.selected && !snap.feature); }, [engine, prefs.spin, reduced, snap.path.length, snap.selected, snap.feature]);

  // The selection card rides on its pin (desktop); on the phone it is a sheet.
  const card = snap.selected ? data.cards[snap.selected] : null;
  const pin = card ? data.index.pins.find((p) => `${p.kind}:${p.slug}` === snap.selected) : null;
  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- the marker element only exists after the engine syncs it */
    if (!engine || !pin || phone) { if (engine) engine.syncMarkers('card', []); setCardEl(null); return; }
    const m = engine.syncMarkers('card', [{ key: 'card', lng: pin.lon, lat: pin.lat, anchor: 'left', offset: [26, 0], className: 'globe-card-anchor' }]);
    setCardEl(m.get('card') ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [engine, pin, phone]);

  const openPin = useCallback((p: PinModel) => ctrl.current?.openPin(p), []);
  const onPick = useCallback((h: SearchHit) => { void ctrl.current?.goTo(h); }, []);
  const cardList = useMemo(() => Object.values(data.cards), [data]);

  const nearby = useMemo<NearbyPlace[]>(() => {
    const f = snap.feature;
    if (!f) return [];
    return data.index.pins
      .filter((p) => p.kind === 'place' && !p.approx)
      .map((p) => ({ key: `place:${p.slug}`, title: p.name, km: distanceKm({ lng: f.lngLat[0], lat: f.lngLat[1] }, { lng: p.lon, lat: p.lat }) }))
      .filter((n) => n.km <= 60)
      .sort((a, b) => a.km - b.km)
      .slice(0, 4);
  }, [snap.feature, data]);

  // Free canvas for the world frame: the canvas minus whatever the open panel or the resting sheet covers (spec 3.1).
  const panelFoot = (short ? 300 : 360) + 24;
  useEffect(() => {
    layoutRef.current = () => {
      const r = root.current?.getBoundingClientRect();
      return { width: r?.width ?? window.innerWidth, height: r?.height ?? window.innerHeight, cover: { top: short ? 52 : 0, left: !phone && !short && cardOpen ? CARD_FOOT : 0, right: !phone && panelOpen ? panelFoot : 0, bottom: phone && sheetOpen ? PEEK : 0 } };
    };
  }, [phone, short, panelOpen, sheetOpen, panelFoot, cardOpen]);
  useEffect(() => {
    if (!controller || !engine) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const run = () => { clearTimeout(t); t = setTimeout(() => controller.reframe(), 150); };
    run();
    const ro = new ResizeObserver(run);
    if (root.current) ro.observe(root.current);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [controller, engine, phone, short, panelOpen, sheetOpen, panelFoot, cardOpen]);

  const canBack = snap.path.length > 0 || !!snap.selected || !!snap.feature;
  const level = snap.path.length;
  const panelTitle = level === 0 ? 'Places and trips' : snap.crumbs[snap.crumbs.length - 1]?.label ?? '';

  const body = book ? (
    <GlobePanelBody data={data} book={book} path={snap.path} selected={snap.selected} onArea={(p) => { void controller?.goArea(p); }} onCard={(k) => { void controller?.selectCard(k); }} />
  ) : null;

  const controls = <GlobeControls prefs={prefs} style={styleKey} reducedMotion={reduced} onChange={changePrefs} />;

  return (
    <div ref={root} className="globe-root" data-level={level} data-panel={panelOpen && !phone ? 'open' : 'closed'} data-phone={phone ? 'true' : undefined}>
      {book && prefsReady && handlers && initialCamera ? (
        <GlobeCanvas
          mode="full"
          data={data}
          book={book}
          style={prefs.style}
          terrain={prefs.terrain}
          exaggeration={prefs.exaggeration}
          camera={initialCamera}
          handlers={handlers}
          onEngine={onEngine}
          label="Globe of saved places and published trips"
        />
      ) : (
        <div className="globe-canvas"><div className="globe-loading" aria-live="polite">Loading globe</div></div>
      )}

      {engine ? <PinLayer engine={engine} pins={snap.pins} selectedKey={snap.selected} onOpen={openPin} /> : null}
      {cardEl && card ? createPortal(<SelectionCard card={card} onClose={() => controller?.closeCard()} />, cardEl) : null}

      <div className="globe-top">
        <GlobeCrumbs crumbs={snap.crumbs} canBack={canBack} onBack={() => controller?.back()} onCrumb={(p) => controller?.crumbTo(p)} />
        {book ? <GlobeSearch cards={cardList} book={book} onPick={onPick} placeholder={short ? 'Search the globe' : undefined} /> : null}
      </div>

      {snap.loading ? <p className="globe-status" role="status">{snap.loading}</p> : null}
      {snap.notice ? <p className="globe-status globe-notice" role="status">{snap.notice}</p> : null}
      {snap.feature ? (
        <FeatureCard
          feature={snap.feature}
          nearby={nearby}
          onPick={(k) => { void controller?.selectCard(k); }}
          onClose={() => controller?.back()}
          onFly={() => { const f = snap.feature!; engine?.flyToPoint(f.lngLat, f.sourceLayer === 'waterway' ? 8 : 11); }}
        />
      ) : null}

      {!phone && !short ? (
        cardOpen ? (
          <div className="globe-card-controls surface-card" role="group" aria-label="Map options">
            <button type="button" className="globe-card-fold" aria-expanded="true" aria-label="Collapse the map options" onClick={() => setCardOpen(false)}><Icon name="chevronDown" size={16} /></button>
            {controls}
          </div>
        ) : (
          <Button className="globe-card-pill" variant="secondary" aria-expanded="false" onClick={() => setCardOpen(true)}>
            <Icon name="layers" size={16} /> Map options
          </Button>
        )
      ) : (
        <Button className="globe-options-btn" variant="secondary" onClick={() => setOptionsOpen(true)}>
          <Icon name="layers" size={16} /> Map options
        </Button>
      )}

      <div className="globe-zoom">
        <Button size="sm" variant="secondary" icon aria-label="Reset view" title="Reset view (Home)" onClick={() => controller?.reset()}><Icon name="globe" size={16} /></Button>
        <Button size="sm" variant="secondary" icon aria-label="Zoom in" onClick={() => engine?.zoomBy(1)}><Icon name="plus" size={16} /></Button>
        <Button size="sm" variant="secondary" icon aria-label="Zoom out" onClick={() => engine?.zoomBy(-1)}><Icon name="minus" size={16} /></Button>
      </div>

      {hint && snap.ready && !phone ? <p className="globe-hint">drag to spin · scroll to zoom · click a pin to open</p> : null}

      {!phone ? (
        panelOpen ? (
          <aside className="globe-panel" aria-label="Places and trips">
            <header className="globe-panel-head">
              <h2>{panelTitle}</h2>
              <Button size="sm" variant="ghost" icon aria-label="Collapse the panel" onClick={() => setPanelOpen(false)}><Icon name="chevronRight" size={16} /></Button>
            </header>
            <div className="globe-panel-body">{body}</div>
          </aside>
        ) : (
          <button type="button" className="globe-panel-tab" aria-label="Open the places and trips panel" onClick={() => setPanelOpen(true)}>
            <Icon name="chevronLeft" size={16} />
            <span>List</span>
          </button>
        )
      ) : (
        <>
          <BottomSheet
            open={sheetOpen && !card}
            onOpenChange={setSheetOpen}
            title={level === 0 ? 'Countries' : panelTitle}
            snaps={['peek', 'half', 'full']}
            initial="peek"
            peekPx={PEEK}
            modal={false}
            className="globe-sheet"
          >
            {body}
          </BottomSheet>
          {!sheetOpen && !card ? <Button className="globe-list-btn" variant="secondary" onClick={() => setSheetOpen(true)}><Icon name="list" size={16} /> List</Button> : null}
          <BottomSheet open={!!card} onOpenChange={(o) => { if (!o) controller?.closeCard(); }} title={card?.title ?? ''} snaps={['peek', 'half']} initial="half" modal={false} className="globe-sheet">
            {card ? <SelectionCard card={card} onClose={() => controller?.closeCard()} /> : null}
          </BottomSheet>
        </>
      )}

      {phone || short ? (
        <BottomSheet open={optionsOpen} onOpenChange={setOptionsOpen} title="Map options" snaps={['half']} initial="half">
          {controls}
        </BottomSheet>
      ) : null}

      {snap.failed ? <p className="globe-status globe-fail-note" role="alert">{snap.failed}</p> : null}
      <ul className="sr-only" aria-label="Places and trips on the globe">
        {cardList.map((c) => (<li key={c.key}><a href={c.href}>{c.title}</a></li>))}
      </ul>
      <p className="sr-only" aria-live="polite">{reduced || prefersReducedMotion() ? 'Motion is reduced: the globe jumps instead of flying.' : ''}</p>
    </div>
  );
}
