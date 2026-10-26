'use client';

import { readSession, writeSession } from '@/lib/storage/safe';
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
import type { Camera, GlobeCard, GlobeData, PinModel } from '@/lib/globe/types';
import { parseCamera, parseNatural, parseView, withNatural } from '@/lib/globe/url';
import { effectiveStyle } from '@/lib/map/maplibre/styles';
import { pageIsDark } from '@/lib/map/palette';
import { prefersReducedMotion } from '@/lib/map/reduced-motion';
import { GlobeCanvas } from './GlobeCanvas';
import { GlobeControls } from './GlobeControls';
import { GlobeCrumbs } from './GlobeCrumbs';
import { GlobePanelBody } from './GlobePanel';
import { GlobeSearch } from './GlobeSearch';
import { HitMarker } from './HitMarker';
import { PinLayer } from './PinLayer';
import { FeatureCard, SelectionCard, type NearbyPlace } from './SelectionCard';
import { featureClass, loadFeatureFacts, type FeatureFacts } from '@/lib/globe/wikidata';
import { distanceKm } from '@/lib/map/geo';
import { nodeAt } from '@/lib/globe/model';
import { farCorner, placeCard, type Rect } from '@/lib/globe/anchor';
import { landTest } from '@/lib/globe/placement';

const EMPTY: GlobeSnapshot = { ready: false, failed: null, loading: '', path: [], crumbs: [], selected: null, feature: null, boundary: null, here: null, districtTrips: [], pins: [], notice: null };
/** The floating elements a card must not sit on, as rectangles in the globe root's own coordinates (spec 3.2). */
function occupiedRects(root: HTMLElement | null): Rect[] {
  if (!root) return [];
  const r0 = root.getBoundingClientRect();
  return ['.globe-search', '.globe-crumbs', '.globe-zoom', '.globe-card-pill', '.globe-card-controls', '.globe-status', '.globe-panel-tab', '.maplibregl-ctrl-attrib', '.maplibregl-ctrl-scale'].flatMap((sel) => {
    const el = root.querySelector(sel);
    if (!el) return [];
    const b = el.getBoundingClientRect();
    return b.width ? [{ left: b.left - r0.left - 12, top: b.top - r0.top - 12, right: b.right - r0.left + 12, bottom: b.bottom - r0.top + 12 }] : [];
  });
}

/** The lowest edge of the search row and the breadcrumb, in root coordinates plus 8 px: no card starts above it (review round 3). */
function chromeBottom(root: HTMLElement | null): number {
  if (!root) return 0;
  const r0 = root.getBoundingClientRect();
  return Math.max(0, ...['.globe-search', '.globe-crumbs'].map((s) => { const b = root.querySelector(s)?.getBoundingClientRect(); return b && b.width ? b.bottom - r0.top + 8 : 0; }));
}

/** The height a place or trip card will take, from what it holds, so the flip keeps the whole card (and its Open place button) inside the free area (review S3). */
function cardHeight(card: GlobeCard | null | undefined): number {
  if (!card) return 330;
  return 56 + (card.image ? 150 : 0) + 76 + (card.summary ? 70 : 0) + (card.facts.length ? 56 : 0) + (card.usedIn ? 30 : 0) + 58 + (card.approx || card.badge ? 40 : 0);
}

/** Height of the phone sheet at rest (components 5.5). */
const PEEK = 176;
/** The phone bottom bar the list sheet stands on: --phone-bottombar-h in themes.css (styles/globe.css `.globe-sheet` sets bottom to it). */
const PHONE_BAR_PX = 84;
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
  // "Natural features" (9.8): on unless the link says `nf=0`. Never stored; the link is the only memory.
  const [natural, setNatural] = useState(true);
  const naturalRef = useRef(true);
  const [snap, setSnap] = useState<GlobeSnapshot>(EMPTY);
  const [engine, setEngine] = useState<GlobeEngine | null>(null);
  const [panelWanted, setPanelOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [cardOpen, setCardOpenState] = useState(false);
  const [hint, setHint] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [tilted, setTilted] = useState(false);
  const [painted, setPainted] = useState(false);
  const [dark, setDark] = useState(false);
  const [cardEl, setCardEl] = useState<HTMLElement | null>(null);
  const [featEl, setFeatEl] = useState<HTMLElement | null>(null);
  const [featFacts, setFeatFacts] = useState<{ key: string; facts: FeatureFacts | null } | null>(null);
  const ctrl = useRef<GlobeController | null>(null);
  // the 110m shapes captured while they still hold geometry; the swap to 50m drops it
  const isLand = useMemo(() => (book ? landTest(book.fc) : undefined), [book]);
  const terrainRef = useRef(true);
  const engineRef = useRef<GlobeEngine | null>(null);
  const layoutRef = useRef<() => { width: number; height: number; cover: { top: number; right: number; bottom: number; left: number }; mode: 'desktop' | 'landscape' | 'phone' }>(() => ({ width: 1, height: 1, cover: { top: 0, right: 0, bottom: 0, left: 0 }, mode: 'desktop' }));
  const short = useMedia('(max-height: 500px) and (orientation: landscape)');
  // A 1024 x 768 screen has no room to hang a 540 px card from its pin without covering the crumb: there the card is the left dock too
  // (spec 3.2, review L2b ruling 1). `short` stays for what only a landscape phone changes.
  const compact = useMedia('(max-width: 1100px) and (max-height: 800px) and (min-height: 501px)');
  const dock = short || compact;
  // On a landscape phone the panel drops to its tab while a card is open, so the card and the pin have the screen (review M4).
  const panelOpen = panelWanted && !(short && !!snap.selected);
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
    naturalRef.current = parseNatural(window.location.search);
    setNatural(naturalRef.current);
    // The control card is the Map options pill until opened; the open state lasts the session (spec 3.2).
    setCardOpenState(readSession('travel:v1:globe-card') === 'open');
    // The hint shows once per session, for 4 s, and never after the first gesture.
    if (!readSession('travel:v1:globe-hint')) { writeSession('travel:v1:globe-hint', '1'); setHint(true); }
    setDark(pageIsDark());
    const mo = new MutationObserver(() => setDark(pageIsDark()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    loadCountries().then(setBook).catch(() => setSnap((s) => ({ ...s, failed: 'The country shapes could not be loaded.' })));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => mo.disconnect();
  }, []);

  const navigate = useCallback((raw: string, mode: 'push' | 'replace') => {
    const url = naturalRef.current ? raw : withNatural(raw, false);
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  }, []);

  const changeNatural = useCallback((on: boolean) => {
    naturalRef.current = on;
    setNatural(on);
    ctrl.current?.setNaturalFeatures(on);
    window.history.replaceState(window.history.state, '', withNatural(window.location.pathname + window.location.search + window.location.hash, on));
  }, []);

  const layout = useCallback(() => layoutRef.current(), []);
  const setCardOpen = useCallback((open: boolean) => {
    setCardOpenState(open);
    writeSession('travel:v1:globe-card', open ? 'open' : 'closed');
  }, []);
  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(false), 4000);
    return () => window.clearTimeout(t);
  }, [hint]);
  const controller = useMemo(() => {
    if (!book) return null;
    // The controller calls `layout` from event handlers only, never during render, so the ref is read after render.
    // eslint-disable-next-line react-hooks/refs
    return new GlobeController({ data, book, navigate, isPhone: () => window.matchMedia('(max-width: 639px)').matches, terrain: () => terrainRef.current, layout, onChange: setSnap });
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
      onCamera: (cam: Camera, user: boolean) => controller.onCamera(cam, user),
      onInteract: () => setHint(false),
      onWhatIsHere: (p: { x: number; y: number; lngLat: [number, number] }) => controller.whatIsHere(p),
      onWorldFramed: (z: number) => controller.worldFramed(z),
    };
  }, [controller]);

  // First view: read the URL as soon as the engine exists (the style may still be loading, or offline), restoring `?c=` when present.
  const onEngine = useCallback((e: GlobeEngine | null) => {
    setEngine(e);
    const c = ctrl.current;
    if (!e || !c) return;
    c.attach(e);
    c.setNaturalFeatures(naturalRef.current);
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
      if ((e.key !== 'Escape' && e.key !== 'Home' && e.key !== 'n' && e.key !== 'N') || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('[role="dialog"]') || t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') return;
      // Esc closes the card first, then steps up a level; Home returns to the whole world.
      if (e.key === 'Home') { e.preventDefault(); ctrl.current?.reset(); } else if (e.key === 'n' || e.key === 'N') engineRef.current?.map.easeTo({ bearing: 0, pitch: 0, duration: 400 }); else ctrl.current?.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { terrainRef.current = prefs.terrain; }, [prefs.terrain]);
  useEffect(() => { engineRef.current = engine; }, [engine]);
  const styleKey = effectiveStyle(prefs.style, dark);
  const changePrefs = (next: Partial<GlobePrefs>) => {
    setPrefs((p) => {
      const merged = { ...p, ...next };
      savePrefs(merged);
      return merged;
    });
  };

  // Reset north appears only when the view is rotated or tilted (spec 3.2).
  useEffect(() => {
    if (!engine) return;
    const m = engine.map;
    const read = () => setTilted(Math.abs(m.getBearing()) > 0.5 || m.getPitch() > 0.5);
    m.on('moveend', read);
    return () => { m.off('moveend', read); };
  }, [engine]);

  // Immersive: every floating element fades out but the attribution; Esc, a card or a search shortcut brings them back (spec 3.4).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.closest('[role="dialog"]')) return;
      if (e.key === '.' && !e.metaKey && !e.ctrlKey && !e.altKey) setImmersive((v) => !v);
      else if (e.key === 'Escape' || e.key === '/') setImmersive(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Immersive is full screen (review S8): the header and bottom bar collapse through the html attribute, and the Fullscreen API takes the
  // browser chrome where the browser has it. The key or the button that turned it on is the user gesture the request needs.
  useEffect(() => {
    const html = document.documentElement;
    if (immersive) {
      html.dataset.globeImmersive = 'true';
      if (document.fullscreenEnabled && !document.fullscreenElement) void html.requestFullscreen().catch(() => undefined);
    } else {
      delete html.dataset.globeImmersive;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    }
  }, [immersive]);
  useEffect(() => {
    const html = document.documentElement;
    // the visitor leaves full screen with the browser's own key: the controls come back
    const onChange = () => { if (!document.fullscreenElement) setImmersive(false); };
    document.addEventListener('fullscreenchange', onChange);
    return () => { document.removeEventListener('fullscreenchange', onChange); delete html.dataset.globeImmersive; if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
  }, []);
  // opening a card or a feature ends it (adjusted during render, not in an effect)
  const [cardWasOpen, setCardWasOpen] = useState(false);
  const cardNowOpen = !!(snap.selected || snap.feature);
  if (cardNowOpen !== cardWasOpen) { setCardWasOpen(cardNowOpen); if (cardNowOpen) setImmersive(false); }

  // The pointer tooltip would sit on top of an open card (spec 4.1 rule 8).
  useEffect(() => { engine?.setTooltipEnabled(!snap.selected && !snap.feature); }, [engine, snap.selected, snap.feature]);

  // Spin is for the world view only, and never under reduced motion.
  useEffect(() => { engine?.setSpin(prefs.spin && !reduced, snap.path.length === 0 && !snap.selected && !snap.feature); }, [engine, prefs.spin, reduced, snap.path.length, snap.selected, snap.feature]);

  // The selection card rides on its pin (desktop); on the phone it is a sheet.
  const card = snap.selected ? data.cards[snap.selected] : null;
  const pin = card ? data.index.pins.find((p) => `${p.kind}:${p.slug}` === snap.selected) : null;
  // The card flips left or above when it would leave the free area or cover the panel (spec 3.2); the camera landing re-checks it.
  const [camTick, setCamTick] = useState(0);
  useEffect(() => {
    if (!engine || !pin) return;
    const bump = () => setCamTick((n) => n + 1);
    engine.map.on('moveend', bump);
    return () => { engine.map.off('moveend', bump); };
  }, [engine, pin]);
  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- the marker element only exists after the engine syncs it */
    if (!engine || !pin || phone || dock) { if (engine) engine.syncMarkers('card', []); setCardEl(null); return; }
    const at = engine.project(pin.lon, pin.lat);
    const w = root.current?.clientWidth ?? window.innerWidth, h = root.current?.clientHeight ?? window.innerHeight;
    const free: Rect = { left: 0, top: chromeBottom(root.current), right: w - (panelOpen ? 384 : 0), bottom: h - 36 };
    const pl = at ? placeCard(at, { w: 320, h: cardHeight(card) }, free, occupiedRects(root.current)) : null;
    const m = engine.syncMarkers('card', [{ key: 'card', lng: pin.lon, lat: pin.lat, anchor: pl?.anchor ?? 'top-left', offset: [pl?.offset[0] ?? 26, pl?.offset[1] ?? 8], className: 'globe-card-anchor' }]);
    setCardEl(m.get('card') ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `card` only sizes the estimate
  }, [engine, pin, phone, dock, panelOpen, camTick, snap.crumbs.length]);

  // The feature card sits at the click point on a desktop and flips to the side with room, so the highlighted river, sea or peak stays in view
  // (spec 3.2). On a phone or a landscape phone it is a fixed card above the sheet's peek.
  const feature = snap.feature;
  // A search pick opens its card at the start of the flight; once the camera rests the card is placed again from where the feature is now,
  // so it clears the Map options card and the panel instead of sitting where the point was before the flight (9.7).
  const [featTick, setFeatTick] = useState(0);
  useEffect(() => {
    if (!engine || !feature) return;
    const bump = () => setFeatTick((n) => n + 1);
    engine.map.on('moveend', bump);
    return () => { engine.map.off('moveend', bump); };
  }, [engine, feature]);
  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- the marker element only exists after the engine syncs it */
    if (!engine || !feature || phone || short || (feature.lngLat[0] === 0 && feature.lngLat[1] === 0)) { if (engine) engine.syncMarkers('feature', []); setFeatEl(null); return; }
    const at = engine.project(feature.lngLat[0], feature.lngLat[1]);
    const w = root.current?.clientWidth ?? window.innerWidth, h = root.current?.clientHeight ?? window.innerHeight;
    const free: Rect = { left: 0, top: chromeBottom(root.current), right: w - (panelOpen ? 384 : 0), bottom: h - 36 };
    // A fitted feature (river, plain, range) gets its card in the free corner farthest from the feature once the camera rests, never on the
    // feature itself (review M1); a point feature (peak, town) keeps the card beside its point.
    const bb = feature.fit?.bbox;
    if (bb && featTick > 0 && !engine.map.isMoving()) {
      const sw = engine.map.project([bb[0], bb[1]]), ne = engine.map.project([bb[2], bb[3]]);
      const box: Rect = { left: Math.min(sw.x, ne.x), right: Math.max(sw.x, ne.x), top: Math.min(sw.y, ne.y), bottom: Math.max(sw.y, ne.y) };
      // the line's own vertices on screen: the card avoids the line itself, not only its box
      const r0 = root.current?.getBoundingClientRect();
      const pts: { x: number; y: number }[] = [];
      for (const f of engine.map.querySourceFeatures('feature-shape')) {
        const flat = (f.geometry as unknown as { coordinates: unknown }).coordinates as unknown;
        const nums = (flat as number[]).flat(4) as number[];
        for (let i = 0; i + 1 < nums.length; i += 2) { const q = engine.map.project([nums[i], nums[i + 1]]); pts.push({ x: q.x + (r0 ? engine.map.getContainer().getBoundingClientRect().left - r0.left : 0), y: q.y + (r0 ? engine.map.getContainer().getBoundingClientRect().top - r0.top : 0) }); }
      }
      const c = farCorner({ w: 300, h: 150 }, free, box, occupiedRects(root.current), 12, pts);
      const ll = engine.map.unproject([c.x, c.y]);
      const back = engine.map.project(ll);
      if (Math.hypot(back.x - c.x, back.y - c.y) < 3) {
        const mm = engine.syncMarkers('feature', [{ key: 'feature', lng: ll.lng, lat: ll.lat, anchor: 'top-left', offset: [0, 0], className: 'globe-feature-anchor' }]);
        setFeatEl(mm.get('feature') ?? null);
        return;
      }
    }
    const pl = at ? placeCard(at, { w: 300, h: 250 }, free, occupiedRects(root.current)) : null;
    const m = engine.syncMarkers('feature', [{ key: 'feature', lng: feature.lngLat[0], lat: feature.lngLat[1], anchor: pl?.anchor ?? 'top-left', offset: [pl?.offset[0] ?? 18, pl?.offset[1] ?? 8], className: 'globe-feature-anchor' }]);
    setFeatEl(m.get('feature') ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [engine, feature, phone, short, panelOpen, cardOpen, featTick, snap.crumbs.length]);

  // Wikidata facts load after the card opens; a failed or slow call leaves no rows (spec 4.3).
  const featureKey = feature ? `${feature.sourceLayer}:${feature.name}:${feature.wikidata ?? ''}` : null;
  useEffect(() => {
    if (!feature || !featureKey) return;
    let live = true;
    void loadFeatureFacts(feature.wikidata, featureClass(feature.sourceLayer, feature.kind)).then((facts) => { if (live) setFeatFacts({ key: featureKey, facts }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the feature's identity, not the object
  }, [featureKey]);
  const featureFacts = featFacts && featFacts.key === featureKey ? featFacts.facts : null;
  const featureLoading = !!feature?.wikidata && !(featFacts && featFacts.key === featureKey);

  const openPin = useCallback((p: PinModel) => ctrl.current?.openPin(p), []);
  const onPick = useCallback((h: SearchHit) => { void ctrl.current?.goTo(h); }, []);

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

  // On the phone the attribution rides on top of the card sheet, whatever height the card makes it (review S9).
  useLayoutEffect(() => {
    const el = root.current, sheet = el?.querySelector<HTMLElement>('.globe-card-sheet');
    if (!el || !sheet) { el?.style.removeProperty('--globe-card-sheet-h'); return; }
    const set = () => el.style.setProperty('--globe-card-sheet-h', `${Math.round(sheet.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(sheet);
    return () => ro.disconnect();
  }, [snap.selected, phone]);

  // The landscape card dock starts under the breadcrumb, wherever that wraps to (review M3).
  useLayoutEffect(() => {
    const el = root.current, c = el?.querySelector('.globe-crumbs');
    if (!el || !c) return;
    el.style.setProperty('--globe-dock-top', `${Math.round(c.getBoundingClientRect().bottom - el.getBoundingClientRect().top + 8)}px`);
  }, [dock, snap.crumbs.length, snap.selected]);

  // Free canvas for the world frame: the canvas minus whatever the open panel or the resting sheet covers (spec 3.1).
  const panelFoot = (short ? 300 : 360) + 24;
  useEffect(() => {
    layoutRef.current = () => {
      const r = root.current?.getBoundingClientRect();
      return { width: r?.width ?? window.innerWidth, height: r?.height ?? window.innerHeight, cover: { top: short ? 52 : 0, left: !phone && !short && cardOpen ? CARD_FOOT : 0, right: !phone && panelOpen ? panelFoot : 0, bottom: phone && sheetOpen ? PEEK : 0 }, mode: phone ? 'phone' : dock ? 'landscape' : 'desktop' };
    };
  }, [phone, short, dock, panelOpen, sheetOpen, panelFoot, cardOpen]);
  // The CSS halo (and the placeholder disc before the map exists) follows the world frame: centre of the free area, the computed diameter.
  const syncHalo = useCallback(() => {
    const el = root.current;
    if (!el) return;
    const { width, height, cover } = layoutRef.current();
    const f = worldFrame(width, height, cover);
    el.style.setProperty('--halo-d', `${f.diameter}px`);
    el.style.setProperty('--halo-x', `${cover.left + f.freeW / 2}px`);
    el.style.setProperty('--halo-y', `${cover.top + f.freeH / 2}px`);
  }, []);
  useEffect(() => { syncHalo(); }, [syncHalo, phone, short, panelOpen, sheetOpen, panelFoot, cardOpen]);
  useEffect(() => {
    if (!controller || !engine) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const run = () => { clearTimeout(t); syncHalo(); t = setTimeout(() => controller.reframe(), 150); };
    run();
    const ro = new ResizeObserver(run);
    if (root.current) ro.observe(root.current);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [controller, engine, syncHalo, phone, short, panelOpen, sheetOpen, panelFoot, cardOpen]);

  const canBack = snap.path.length > 0 || !!snap.selected || !!snap.feature;
  const level = snap.path.length;
  const countNode = level === 0 ? null : nodeAt(data, snap.path);
  const worldCount = data.index.continents.reduce((n, c) => n + c.places + c.trips, 0);
  const panelCount = level === 0 ? worldCount : countNode ? countNode.places + (level === 3 ? Math.max(countNode.trips, snap.districtTrips.length) : countNode.trips) : 0;
  const panelTitle = level === 0 ? 'Places and trips' : snap.crumbs[snap.crumbs.length - 1]?.label ?? '';

  const censusCredit = snap.path[0] === 'ca' && snap.path.length >= 2;
  const bodyList = book ? (
    <GlobePanelBody data={data} book={book} path={snap.path} selected={snap.selected} districtTrips={snap.districtTrips} onArea={(p) => { void controller?.goArea(p); }} onCard={(k) => { void controller?.selectCard(k); }} />
  ) : null;
  // Where Canada's census divisions are drawn they carry their source and licence (F4).
  const body = bodyList ? (<>{bodyList}{censusCredit ? <p className="globe-credit">Districts: Statistics Canada, 2021 census divisions, <a href="https://www.statcan.gc.ca/en/reference/licence" target="_blank" rel="noopener noreferrer">Open Government Licence – Canada</a>.</p> : null}</>) : null;

  const controls = <GlobeControls prefs={prefs} natural={natural} onNatural={changeNatural} style={styleKey} reducedMotion={reduced} onChange={changePrefs} onHide={() => { setOptionsOpen(false); setImmersive(true); }} />;

  return (
    <div ref={root} className="globe-root" data-immersive={immersive ? 'true' : undefined} data-level={level} data-panel={panelOpen && !phone ? 'open' : 'closed'} data-phone={phone ? 'true' : undefined}>
      <div className="globe-halo" aria-hidden="true" />
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
          onPainted={() => { setPainted(true); const run = () => ctrl.current?.prefetchCountries(); if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 3000 }); else setTimeout(run, 1500); }}
          label="Globe of saved places and published trips"
        />
      ) : (
        <div className="globe-canvas"><div className="globe-loading" aria-live="polite">Loading globe</div></div>
      )}

      {engine && painted ? <PinLayer engine={engine} pins={snap.pins} selectedKey={snap.selected} isLand={isLand} onOpen={openPin} /> : null}
      {engine ? <HitMarker engine={engine} /> : null}
      {cardEl && card ? createPortal(<SelectionCard card={card} point={pin} onClose={() => controller?.closeCard()} />, cardEl) : null}
      {dock && card ? <div className="globe-card-dock"><SelectionCard card={card} point={pin} onClose={() => controller?.closeCard()} /></div> : null}

      <div className="globe-top">
        <GlobeCrumbs crumbs={snap.crumbs} canBack={canBack} onBack={() => controller?.back()} onCrumb={(p) => controller?.crumbTo(p)} />
        {book ? <GlobeSearch book={book} features={natural} onTurnOnFeatures={() => changeNatural(true)} onPick={onPick} /> : null}
      </div>

      {snap.here ? (
        <aside className="globe-here" aria-label="What is here" style={{ '--hx': snap.here.x, '--hy': snap.here.y } as React.CSSProperties}>
          <header><h2>What is here</h2><Button size="sm" variant="ghost" icon aria-label="Close what is here" onClick={() => controller?.closeHere()}><Icon name="close" size={16} /></Button></header>
          <ul>
            {snap.here.rows.map((r) => (
              <li key={r.key}>
                {r.kind === 'elevation'
                  ? <p className="globe-here-row"><span>{r.label}</span><small>{r.sub}</small></p>
                  : <button type="button" className="globe-here-row" onClick={() => controller?.pickHere(r)}><span>{r.label}</span><small>{r.sub}</small></button>}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      {snap.loading ? <p className="globe-status" role="status">{snap.loading}</p> : null}
      {snap.notice ? <p className="globe-status globe-notice" role="status">{snap.notice}</p> : null}
      {snap.feature ? (() => {
        const fc = (
          <FeatureCard
            feature={snap.feature}
            facts={featureFacts}
            loading={featureLoading}
            nearby={nearby}
            boundary={snap.boundary}
            onPick={(k) => { void controller?.selectCard(k); }}
            onClose={() => controller?.back()}
            onFly={() => { void controller?.flyToFeature(snap.feature!); }}
          />
        );
        return featEl ? createPortal(fc, featEl) : fc;
      })() : null}

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
        <Button className="globe-options-btn" variant="secondary" icon aria-label="Map options" title="Map options" onClick={() => setOptionsOpen(true)}>
          <Icon name="layers" size={18} />
        </Button>
      )}

      <div className="globe-zoom">
        {tilted ? <Button size="sm" variant="secondary" icon aria-label="Reset north" title="Reset north (N)" onClick={() => engine?.map.easeTo({ bearing: 0, pitch: 0, duration: reduced ? 0 : 400 })}><Icon name="navigate" size={16} /></Button> : null}
        <Button size="sm" variant="secondary" icon aria-label="Reset view" title="Reset view: back to the world (Home)" onClick={() => controller?.reset()}><Icon name="globe" size={16} /></Button>
        <Button size="sm" variant="secondary" icon aria-label="Zoom in" onClick={() => engine?.zoomBy(1)}><Icon name="plus" size={16} /></Button>
        <Button size="sm" variant="secondary" icon aria-label="Zoom out" onClick={() => engine?.zoomBy(-1)}><Icon name="minus" size={16} /></Button>
        <Button size="sm" variant="secondary" icon aria-label="Full screen" title="Full screen: hide every control (press . to toggle, Esc to leave)" className="globe-fs-btn" onClick={() => { setOptionsOpen(false); setImmersive(true); }}><Icon name="expand" size={16} /></Button>
      </div>
      {immersive ? <button type="button" className="globe-show-controls" onClick={() => setImmersive(false)}>Exit full screen <kbd>Esc</kbd></button> : null}

      {hint && snap.ready && !phone && !short ? <p className="globe-hint" role="status">Drag to spin, scroll to zoom, click a pin to open it</p> : null}

      {!phone ? (
        panelOpen ? (
          <aside className="globe-panel" aria-label="Places and trips">
            <header className="globe-panel-head">
              <h2>{panelTitle}{panelCount ? <span className="globe-panel-count">{panelCount}</span> : null}</h2>
              <Button size="sm" variant="ghost" icon aria-label="Collapse the panel" onClick={() => setPanelOpen(false)}><Icon name="chevronRight" size={16} /></Button>
            </header>
            <div className="globe-panel-body">{body}</div>
          </aside>
        ) : (
          <button type="button" className="globe-panel-tab" aria-label="Open the places and trips panel" onClick={() => setPanelOpen(true)}>
            <Icon name="chevronLeft" size={16} />
            <span>{panelCount || 'List'}</span>
          </button>
        )
      ) : (
        <>
          <BottomSheet
            open={sheetOpen && !card && !snap.feature}
            onOpenChange={setSheetOpen}
            title={level === 0 ? 'Countries' : panelTitle}
            snaps={['peek', 'half', 'full']}
            initial="peek"
            peekPx={PEEK}
            modal={false}
            className="globe-sheet"
            bottomGap={PHONE_BAR_PX}
          >
            {body}
          </BottomSheet>
          {!sheetOpen && !card ? <Button className="globe-list-btn" variant="secondary" icon aria-label="Show the list" title="Show the list" onClick={() => setSheetOpen(true)}><Icon name="list" size={18} /></Button> : null}
          {card ? <aside className="globe-card-sheet" aria-label={card.title}><SelectionCard card={card} point={pin} onClose={() => controller?.closeCard()} /></aside> : null}
        </>
      )}

      {phone || short ? (
        <BottomSheet open={optionsOpen} onOpenChange={setOptionsOpen} title="Map options" snaps={['half']} initial="half">
          {controls}
        </BottomSheet>
      ) : null}

      {snap.failed ? <p className="globe-status globe-fail-note" role="alert">{snap.failed}</p> : null}
      <ul className="sr-only" aria-label="Places and trips on the globe">
        {snap.pins.filter((p) => p.cardKey).map((p) => (<li key={p.id}><a href={p.cardKey!.startsWith('trip:') ? `/trips/${p.cardKey!.slice(5)}/` : `/places/${p.cardKey!.slice(6)}/`}>{p.label}</a></li>))}
      </ul>
      <p className="sr-only" aria-live="polite">{reduced || prefersReducedMotion() ? 'Motion is reduced: the globe jumps instead of flying.' : ''}</p>
    </div>
  );
}
