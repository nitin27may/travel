import { globeCityAreas, globeLakes } from '@/lib/client/data';
import { lakesInWorker } from './geoClient';
import { distanceKm } from '@/lib/map/geo';
import { factsLine, languagesLine } from './facts';
import { loadAdmin, resolveFeature, slugify } from './admin';
import { loadCountries50, type CountryBook } from './countries';
import type { BasemapFeature, Focus, GlobeEngine, HitLayer, HoverInfo, Padding } from './engine';
import { flightPlan, featureZoom, isWide, type FlightPlan } from './flight';
import { featuresWithBoxes, inBox, inFeature, locate, spanLon, type Bbox, type Feat, type FeatColl, type Pt } from './geometry';
import { areaPathOfPin, boxOfArea, nodeAt, pinsFor, pinsUnder } from './model';
import { zoomForRank, type SearchHit } from './search';
import { ensureCard, ensureCountry } from './store';
import type { Camera, GlobeCard, GlobeData, PinModel, View } from './types';
import { cameraQuery, hitSuffix, viewPath } from './url';
import { WORLD_LAT, WORLD_LNG, worldFrame, type Footprint } from './framing';

export interface Crumb { label: string; path: string[] }

/** One line of "what is here" (spec 4.1 rule 6): what is under a point, nearest first, each one something to open. */
export interface HereRow {
  key: string;
  kind: 'country' | 'state' | 'district' | 'feature' | 'place' | 'elevation';
  label: string;
  sub?: string;
}
export interface HereModel { x: number; y: number; lngLat: Pt; rows: HereRow[] }

/** Everything the React side draws, as one immutable snapshot. */
export interface GlobeSnapshot {
  ready: boolean;
  failed: string | null;
  loading: string;
  path: string[];
  crumbs: Crumb[];
  selected: string | null;
  feature: BasemapFeature | null;
  /** For a selected city or town: whether we hold its outline (spec 4.2). Null for any other feature. */
  boundary: 'loaded' | 'none' | null;
  /** The "what is here" popover or sheet, or null. */
  here: HereModel | null;
  pins: PinModel[];
  notice: string | null;
}

export interface ControllerOptions {
  data: GlobeData;
  book: CountryBook;
  /** Writes the URL. `replace` for camera updates, `push` for a step the visitor can go Back from. */
  navigate(url: string, mode: 'push' | 'replace'): void;
  isPhone(): boolean;
  /** The 3D terrain preference: a tilted fly-in only makes sense with relief to look at. */
  terrain(): boolean;
  /** Canvas size and what the open panels cover right now. */
  layout(): { width: number; height: number; cover: Footprint; mode: 'desktop' | 'landscape' | 'phone' };
  onChange(s: GlobeSnapshot): void;
  /** Filled by the controller when the 50m outlines have loaded. */
  book50?: { book: CountryBook; render: string };
}

export const WORLD_CAMERA = { desktop: { lng: -35, lat: 22, zoom: 1.95 }, phone: { lng: -35, lat: 22, zoom: 1.0 } };

const titleCase = (slug: string): string => slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/**
 * Orchestrates the globe: which area is open, which pin is selected, what the URL says. It owns no DOM; the engine
 * draws and React renders the panels from the snapshots it emits.
 */
export class GlobeController {
  private engine: GlobeEngine | null = null;
  private snap: GlobeSnapshot = { ready: false, failed: null, loading: '', path: [], crumbs: [], selected: null, feature: null, boundary: null, here: null, pins: [], notice: null };
  private areaToken = 0;
  private adm1: FeatColl | null = null;
  private adm2: FeatColl | null = null;
  private focus: Focus = { country: null, s: null, d: null };
  private lastCamera: Camera | null = null;
  /** The pathname we last wrote or applied; a pathname change that differs from it came from outside (Back, a link). */
  currentUrl = '';

  constructor(private readonly o: ControllerOptions) {
    this.snap.pins = pinsFor(o.data, [], o.book.facts);
  }

  attach(engine: GlobeEngine): void { this.engine = engine; }
  get state(): GlobeSnapshot { return this.snap; }
  private emit(patch: Partial<GlobeSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    this.o.onChange(this.snap);
  }

  private plan(step: Parameters<typeof flightPlan>[0], o: { approx?: boolean; featureClass?: string } = {}): FlightPlan {
    const plan = flightPlan(step, { terrain: this.o.terrain(), ...o });
    // A landscape phone has 330 px of height: half the shift keeps the subject out from under the search and crumb rows.
    return this.o.layout().mode === 'landscape' ? { ...plan, shift: plan.shift / 2 } : plan;
  }

  /** A country's box for the flight: the mainland where there is one (the 48 states, metropolitan France), else its shape. */
  private countryBox(a2: string): { box: Bbox; wide: boolean } | null {
    const c = this.o.book.byA2[a2];
    const f = c ? this.o.book.fc.features.find((x) => x.id === c.id) : undefined;
    if (!c || !f?._bbox) return null;
    const m = (c.facts as { mainland_bbox?: [number, number, number, number] }).mainland_bbox;
    const wide = isWide(spanLon(f._bbox));
    return { box: m ? [[m[0], m[1]], [m[2], m[3]]] : f._bbox, wide };
  }

  // ---- layout-aware camera padding -----------------------------------------------------------------------
  /**
   * What a flight keeps clear (the free area, spec 3.1): the open side panel, the search and crumb rows, and on a landscape phone
   * the card dock that opens on the left. `card` is true when a selection card is about to open: on the phone it is a half sheet.
   */
  padding(card = false): Padding {
    const { height, cover, mode } = this.o.layout();
    if (mode === 'phone') return { top: 120, right: 24, bottom: card ? Math.round(height * 0.5) + 24 : cover.bottom + 20, left: 24 };
    if (mode === 'landscape') return { top: 64, right: (cover.right || 8) + 12, bottom: 24, left: card ? 308 : 24 };
    return { top: 90, right: cover.right ? cover.right + 26 : 90, bottom: 80, left: 90 };
  }
  /** The world camera from the free canvas (spec 3.1); the longitude follows wherever the globe is now. */
  frame() {
    const { width, height, cover } = this.o.layout();
    return worldFrame(width, height, cover);
  }
  private worldZoom = NaN;
  /** Frames the whole disc in the free area. Called on arrival at the world level, on resize and when a panel opens or closes. */
  frameWorld(animate: boolean): void {
    const engine = this.engine;
    if (!engine) return;
    const f = this.frame();
    const cur = engine.camera();
    this.worldZoom = engine.frameWorld({ lng: Number.isFinite(cur.lng) ? cur.lng : WORLD_LNG, lat: WORLD_LAT, zoom: f.zoom, diameter: f.diameter }, f.padding, animate);
    engine.setMinZoom(this.worldZoom - 0.2);
  }
  /** Resize or panel toggle: re-frame only when the visitor is still looking at the whole world. */
  /** The engine landed the exact frame after the style loaded. */
  worldFramed(zoom: number): void {
    this.worldZoom = zoom;
    this.engine?.setMinZoom(zoom - 0.2);
  }
  reframe(): void {
    if (this.snap.path.length || this.snap.selected || this.snap.feature || !this.engine) return;
    // Never framed by us (a restored ?c= camera), or the visitor has zoomed away: leave the camera alone.
    if (!Number.isFinite(this.worldZoom)) return;
    if (Math.abs(this.engine.camera().zoom - this.worldZoom) > 0.35) return;
    this.frameWorld(true);
  }

  // ---- 110m to 50m ---------------------------------------------------------------------------------------
  private full: Promise<void> | null = null;
  private swapped = false;
  /** Starts the 50m download (called once the first idle has passed); applies nothing yet. */
  prefetchCountries(): void { this.full ??= loadCountries50().then((b) => { this.o.book50 = b; }).catch(() => { this.full = null; }); }
  /** Swaps the 50m shapes in: past zoom 3 or on the first drill-down (spec 8.2). The ids match the 110m shapes', so state carries over. */
  async upgradeCountries(): Promise<void> {
    if (this.swapped || !this.engine) return;
    this.prefetchCountries();
    await this.full;
    const b = this.o.book50;
    if (!b || this.swapped || !this.engine) return;
    this.swapped = true;
    Object.assign(this.o.book, b.book);
    this.engine.setCountries(b.book.fc, b.render);
  }

  private lakesLoaded = false;
  /** The lake polygons, once, when the camera first comes in past zoom 3 (the tiles name no lake below zoom 8). */
  private async loadLakes(): Promise<void> {
    if (this.lakesLoaded || !this.engine) return;
    this.lakesLoaded = true;
    try { this.engine.setLakes(await lakesInWorker(await globeLakes())); } catch { this.lakesLoaded = false; }
  }

  // ---- engine events -------------------------------------------------------------------------------------
  ready(): void { this.emit({ ready: true }); }
  fail(reason: string): void { this.emit({ failed: reason }); }

  /** True from a deep link until the camera has actually arrived (or the visitor takes over): world frames are not written to ?c=. */
  private deepLinkPending = false;
  onCamera(c: Camera, user = false): void {
    this.lastCamera = c;
    if (user || c.zoom >= 2.5) this.deepLinkPending = false;
    if (c.zoom > 3) { void this.upgradeCountries(); void this.loadLakes(); }
    if (this.deepLinkPending) return;
    this.o.navigate(`${this.currentUrl || viewPath({ kind: 'area', path: this.snap.path })}${cameraQuery(c)}${typeof window === 'undefined' ? '' : hitSuffix(window.location.search)}`, 'replace');
  }

  describe(layer: HitLayer, id: number): HoverInfo | null {
    const { book, data } = this.o;
    if (layer === 'country') {
      const f = book.fc.features.find((x) => x.id === id);
      const c = f ? book.facts[String(f.properties.ccn3)] : undefined;
      if (!f) return null;
      const node = c ? nodeAt(data, [c.a2.toLowerCase()]) : null;
      const bits = [node?.places ? `${node.places} ${node.places === 1 ? 'place' : 'places'}` : '', node?.trips ? `${node.trips} ${node.trips === 1 ? 'trip' : 'trips'}` : ''].filter(Boolean);
      return {
        kicker: [c?.region, c?.subregion].filter(Boolean).join(' · ') || 'Country',
        title: `${c?.flag ? `${c.flag} ` : ''}${c?.name ?? String(f.properties.name ?? 'Country')}`,
        sub: bits.length ? bits.join(' · ') : 'Nothing saved here yet',
        sub2: factsLine(c) || undefined,
        sub3: languagesLine(c) || undefined,
      };
    }
    const fc = layer === 'adm1' ? this.adm1 : this.adm2;
    const f = fc?.features.find((x) => x.id === id);
    if (!f) return null;
    const n = Number(f.properties.n ?? 0);
    return {
      kicker: layer === 'adm1' ? String(f.properties.type || 'State or province') : 'District',
      title: String(f.properties.name),
      sub: `${n ? `${n} ${n === 1 ? 'place' : 'places'} · ` : ''}click to drill in`,
    };
  }

  onShape(layer: HitLayer, id: number): void {
    const { book } = this.o;
    if (layer === 'country') {
      const f = book.fc.features.find((x) => x.id === id);
      const a2 = f ? book.facts[String(f.properties.ccn3)]?.a2.toLowerCase() : undefined;
      if (a2) void this.goArea([a2]);
      return;
    }
    const cc = this.snap.path[0];
    if (!cc) return;
    if (layer === 'adm1') {
      const f = this.adm1?.features.find((x) => x.id === id);
      if (f) void this.goArea([cc, this.slugFor(f, [cc])]);
    } else if (this.snap.path[1]) {
      const f = this.adm2?.features.find((x) => x.id === id);
      if (f) void this.goArea([cc, this.snap.path[1], this.slugFor(f, [cc, this.snap.path[1]])]);
    }
  }

  onBasemap(f: BasemapFeature | null): void {
    if (f && this.snap.selected) this.closeCard();
    this.engine?.setFeature(f);
    this.engine?.setCityArea(null);
    this.emit({ feature: f, boundary: null });
    if (f && f.sourceLayer === 'place' && /^(city|town|village)$/.test(f.kind)) void this.showCityArea(f);
  }

  /** A selected city or town: its OSM outline when a public place or trip base is in it, else the honest ring and "Boundary not loaded". */
  private async showCityArea(f: BasemapFeature): Promise<void> {
    let found: Feat | null = null;
    try {
      const fc = await globeCityAreas();
      const areas: FeatColl = featuresWithBoxes(fc.features);
      found = locate(areas, f.lngLat) ?? null;
    } catch { /* no file: the ring and the note */ }
    if (this.snap.feature !== f) return;
    this.engine?.setCityArea(found);
    this.emit({ boundary: found ? 'loaded' : 'none' });
  }

  /** Fly here on a feature card: the class decides the zoom and whether the camera tilts (spec 5.3 last column). */
  flyToFeature(f: BasemapFeature): void {
    const cls = f.sourceLayer === 'waterway' ? 'river' : f.sourceLayer === 'mountain_peak' ? 'peak' : f.sourceLayer === 'park' ? 'park' : f.sourceLayer === 'place' ? 'city' : /lake/.test(f.kind) ? 'lake' : 'sea';
    this.engine?.setPadding(this.padding());
    this.engine?.flyToPoint(f.lngLat, featureZoom(cls, 3), { plan: this.plan('feature', { featureClass: cls }) });
  }

  private hereFeatures: BasemapFeature[] = [];
  /**
   * A 500 ms press or a right-click: the country, state and district under the point, the named things within the hit box, the
   * elevation (terrain on) and our saved places within 25 km. The URL does not change.
   */
  whatIsHere(p: { x: number; y: number; lngLat: Pt }): void {
    const engine = this.engine;
    if (!engine) return;
    const rows: HereRow[] = [];
    const { book } = this.o;
    const c = book.fc.features.find((f) => f._bbox && inBox(f._bbox, p.lngLat) && f.geometry && inFeature(f, p.lngLat)) ?? book.fc.features.find((f) => f._bbox && inBox(f._bbox, p.lngLat) && !f.geometry);
    const facts = c ? book.facts[String(c.properties.ccn3)] : undefined;
    if (facts) rows.push({ key: `country:${facts.a2.toLowerCase()}`, kind: 'country', label: facts.name, sub: 'Country' });
    const s = this.adm1 ? locate(this.adm1, p.lngLat) : undefined;
    if (s) rows.push({ key: `adm1:${s.id}`, kind: 'state', label: String(s.properties.name), sub: String(s.properties.type || 'State or province') });
    const d = this.adm2 ? locate(this.adm2, p.lngLat) : undefined;
    if (d) rows.push({ key: `adm2:${d.id}`, kind: 'district', label: String(d.properties.name), sub: 'District' });
    this.hereFeatures = engine.featuresAt({ x: p.x, y: p.y }, true).map((f) => ({ ...f, lngLat: p.lngLat }));
    this.hereFeatures.forEach((f, i) => rows.push({ key: `feature:${i}`, kind: 'feature', label: f.name, sub: f.kind }));
    const ele = engine.elevationAt(p.lngLat);
    if (ele !== null) rows.push({ key: 'elevation', kind: 'elevation', label: `${ele.toLocaleString('en-US')} m`, sub: 'Elevation here' });
    const near = this.o.data.index.pins
      .filter((x) => x.kind === 'place' && !x.approx)
      .map((x) => ({ x, km: distanceKm({ lng: p.lngLat[0], lat: p.lngLat[1] }, { lng: x.lon, lat: x.lat }) }))
      .filter((x) => x.km <= 25).sort((a, b) => a.km - b.km).slice(0, 5);
    for (const n of near) rows.push({ key: `place:${n.x.slug}`, kind: 'place', label: n.x.name, sub: `Saved place, ${n.km < 1 ? '<1' : Math.round(n.km)} km` });
    this.emit({ here: { x: p.x, y: p.y, lngLat: p.lngLat, rows } });
  }

  closeHere(): boolean {
    if (!this.snap.here) return false;
    this.emit({ here: null });
    return true;
  }

  /** A row of "what is here" does what clicking that thing would. */
  pickHere(row: HereRow): void {
    this.emit({ here: null });
    if (row.kind === 'country') void this.goArea([row.key.slice(8)]);
    else if (row.kind === 'state' && this.adm1) { const f = this.adm1.features.find((x) => x.id === Number(row.key.slice(5))); const cc = this.snap.path[0]; if (f && cc) void this.goArea([cc, this.slugFor(f, [cc])]); }
    else if (row.kind === 'district' && this.adm2) { const f = this.adm2.features.find((x) => x.id === Number(row.key.slice(5))); const [cc, st] = this.snap.path; if (f && cc && st) void this.goArea([cc, st, this.slugFor(f, [cc, st])]); }
    else if (row.kind === 'feature') { const f = this.hereFeatures[Number(row.key.slice(8))]; if (f) this.onBasemap(f); }
    else if (row.kind === 'place') void this.selectCard(row.key);
  }

  onBackground(): void {
    if (this.snap.here) { this.emit({ here: null }); return; }
    if (this.snap.feature) { this.engine?.setFeature(null); this.engine?.setCityArea(null); this.emit({ feature: null, boundary: null }); }
    else if (this.snap.selected) this.closeCard();
  }

  // ---- area ----------------------------------------------------------------------------------------------
  /** The LD slug of the child node that holds most of this shape's places, else the shape's own slug. */
  private slugFor(f: Feat, parent: string[]): string {
    const node = nodeAt(this.o.data, parent);
    let best: { slug: string; n: number } | null = null;
    for (const child of node?.children ?? []) {
      const pts = pinsUnder(this.o.data, [...parent, child.slug], 'place');
      const n = pts.filter((p) => f._bbox && inBox(f._bbox, [p.lon, p.lat]) && inFeature(f, [p.lon, p.lat])).length;
      if (n > 0 && (!best || n > best.n)) best = { slug: child.slug, n };
    }
    return best?.slug ?? slugify(String(f.properties.name));
  }

  private placePoints(path: string[]): { id: string; lon: number; lat: number }[] {
    return pinsUnder(this.o.data, path, 'place').map((p) => ({ id: p.slug, lon: p.lon, lat: p.lat }));
  }

  private points(path: string[]): Pt[] {
    return pinsUnder(this.o.data, path, 'place').map((p): Pt => [p.lon, p.lat]);
  }

  private nameFor(path: string[], f?: Feat | null): string {
    const node = nodeAt(this.o.data, path);
    if (path.length === 1) return this.o.book.byA2[path[0]]?.facts.name ?? node?.name ?? path[0].toUpperCase();
    return node?.name ?? (f ? String(f.properties.name) : titleCase(path[path.length - 1]));
  }

  /**
   * Opens an area: shapes, focus, camera. Awaits the admin files, and gives up quietly when a newer call started.
   * `camera` restores a `?c=` camera instead of flying.
   */
  async showArea(path: string[], o: { fly: boolean; camera?: Camera | null } = { fly: true }): Promise<void> {
    const token = ++this.areaToken;
    const engine = this.engine;
    if (!engine) return;
    engine.setPadding(this.padding());
    const reset = () => {
      this.adm1 = this.adm2 = null;
      this.focus = { country: null, s: null, d: null };
      engine.setAdmin('adm1', null); engine.setAdmin('adm2', null); engine.setFocus(this.focus);
    };
    const country = path[0] ? this.o.book.byA2[path[0]] : undefined;
    if (!country) {
      reset();
      this.emit({ path: [], crumbs: [], pins: pinsFor(this.o.data, [], this.o.book.facts), loading: '' });
      if (o.camera) engine.jumpTo(o.camera);
      else if (o.fly) this.frameWorld(true);
      return;
    }
    const cc = path[0];
    const a3 = country.facts.a3;
    await this.upgradeCountries();
    if (token !== this.areaToken) return;
    // The country's pins load once, here; every level below needs them (backlog 2.39).
    try {
      await ensureCountry(this.o.data, cc);
    } catch {
      this.emit({ notice: 'The places in this area could not be loaded. Try again in a moment.' });
    }
    if (token !== this.areaToken) return;
    this.focus = { country: country.id, s: null, d: null };
    this.adm2 = null;
    engine.setAdmin('adm2', null);
    engine.setFocus(this.focus);
    const crumbs: Crumb[] = [{ label: this.nameFor([cc]), path: [cc] }];
    this.emit({ path: [cc], crumbs, pins: pinsFor(this.o.data, [cc], this.o.book.facts), loading: path.length > 0 ? 'Loading states and provinces' : '' });
    const countryFeat = this.o.book.fc.features.find((x) => x.id === country.id)!;
    let target: Bbox | null = countryFeat._bbox ?? null;
    let maxZoom = 7;
    // One flight per step (spec 5.3): a country starts moving at once; a state or district waits for the shape it flies to, so
    // the camera never heads for one box and then turns to another.
    const cb = this.countryBox(cc);
    if (o.fly && !o.camera && path.length === 1 && cb) engine.flyToBox(cb.box, { plan: this.plan('country'), maxZoom, wide: cb.wide });

    const l1 = await loadAdmin(a3, 'adm1', { pins: this.placePoints([cc]) });
    if (token !== this.areaToken) return;
    const adm1 = l1?.fc ?? null;
    this.adm1 = adm1;
    engine.setAdmin('adm1', adm1, l1?.render);

    let sFeat: Feat | null = null;
    let dFeat: Feat | null = null;
    let resolved = [cc];
    if (path[1]) {
      resolved = [cc, path[1]];
      const idx = adm1 ? resolveFeature(adm1, path[1], this.points([cc, path[1]])) : null;
      sFeat = idx !== null && adm1 ? adm1.features[idx] : null;
      this.focus = { country: country.id, s: sFeat ? (sFeat.id as number) : null, d: null };
      engine.setFocus(this.focus);
      target = sFeat?._bbox ?? boxOfArea(this.o.data, [cc, path[1]]) ?? target;
      maxZoom = 9;
      crumbs.push({ label: this.nameFor([cc, path[1]], sFeat), path: [cc, path[1]] });
      this.emit({ path: resolved, crumbs: [...crumbs], pins: pinsFor(this.o.data, resolved, this.o.book.facts), loading: sFeat ? 'Loading districts' : '' });
      if (o.fly && !o.camera && target && path.length === 2) engine.flyToBox(target, { plan: this.plan('state'), maxZoom });

      if (sFeat) {
        // geoBoundaries districts do not always nest in Natural Earth states, so the worker keeps those whose centre falls inside this state
        const part = typeof sFeat.properties.iso === 'string' ? sFeat.properties.iso : undefined;
        const l2 = await loadAdmin(a3, 'adm2', { part, within: sFeat, pins: this.placePoints([cc, path[1]]) });
        if (token !== this.areaToken) return;
        this.adm2 = l2 && l2.fc.features.length ? l2.fc : null;
        engine.setAdmin('adm2', this.adm2, this.adm2 ? l2?.render : undefined);
      }
      if (path[2]) {
        resolved = [cc, path[1], path[2]];
        const idx = this.adm2 ? resolveFeature(this.adm2, path[2], this.points(resolved)) : null;
        dFeat = idx !== null && this.adm2 ? this.adm2.features[idx] : null;
        this.focus = { country: country.id, s: sFeat ? (sFeat.id as number) : null, d: dFeat ? (dFeat.id as number) : null };
        engine.setFocus(this.focus);
        target = dFeat?._bbox ?? boxOfArea(this.o.data, resolved) ?? target;
        maxZoom = 11;
        crumbs.push({ label: this.nameFor(resolved, dFeat), path: resolved });
      }
    }
    this.emit({ path: resolved, crumbs, pins: pinsFor(this.o.data, resolved, this.o.book.facts), loading: '' });
    if (o.camera) engine.jumpTo(o.camera);
    else if (o.fly && target && path.length === 3) engine.flyToBox(target, { plan: this.plan('district'), maxZoom });
  }

  /** A step the visitor takes: updates the area, the URL and clears the selection. */
  async goArea(path: string[], o: { push?: boolean; fly?: boolean } = {}): Promise<void> {
    this.engine?.setFeature(null);
    this.engine?.setCityArea(null);
    this.emit({ selected: null, feature: null, boundary: null, notice: null });
    const url = viewPath({ kind: 'area', path });
    if (o.push !== false) { this.currentUrl = url; this.o.navigate(url, 'push'); }
    await this.showArea(path, { fly: o.fly !== false });
  }

  /** The Reset view button and the Home key: close everything, return to the world level and frame the whole disc. */
  reset(): void { void this.goArea([]); }

  back(): void {
    if (this.closeHere()) return;
    if (this.snap.feature) { this.engine?.setFeature(null); this.engine?.setCityArea(null); this.emit({ feature: null, boundary: null }); return; }
    if (this.snap.selected) { this.closeCard(); return; }
    if (this.snap.path.length) void this.goArea(this.snap.path.slice(0, -1));
  }

  // ---- pins ----------------------------------------------------------------------------------------------
  /** The card for a key, loading it (and its country's pins) the first time. Null when the key is not on the globe. */
  private async card(key: string): Promise<GlobeCard | null> {
    try {
      return await ensureCard(this.o.data, key);
    } catch {
      return null;
    }
  }

  async selectCard(key: string, o: { push?: boolean; fly?: boolean; camera?: Camera | null } = {}): Promise<void> {
    const card = await this.card(key);
    const engine = this.engine;
    if (!card || !engine) { this.emit({ notice: 'That place is not on the globe yet.' }); return; }
    engine.setFeature(null);
    const pin = this.o.data.index.pins.find((p) => `${p.kind}:${p.slug}` === key);
    const chain = areaPathOfPin(this.o.data, key);
    const url = viewPath({ kind: card.kind, slug: card.slug });
    if (o.push !== false) { this.currentUrl = url; this.o.navigate(url, 'push'); }
    const prev = this.snap.path;
    const samePath = chain.join('/') === prev.join('/') || (prev.length > chain.length && chain.every((s, i) => prev[i] === s));
    // the area the card sits in is known now, so closing it before the shapes arrive still lands in the right place
    this.emit({ selected: key, feature: null, notice: null, ...(samePath ? {} : { path: chain.slice(0, card.kind === 'trip' ? 1 : 3) }) });
    if (!samePath || !this.adm1) await this.showArea(chain.slice(0, card.kind === 'trip' ? 1 : 3), { fly: false });
    if (this.snap.selected !== key || !pin) return;
    if (o.camera) { engine.jumpTo(o.camera); return; }
    if (o.fly === false) return;
    engine.setPadding(this.padding(true));
    if (card.approx) {
      const cb = this.countryBox(pin.path[0]);
      if (cb) engine.flyToBox(cb.box, { plan: this.plan('place', { approx: true }), maxZoom: 6, wide: cb.wide });
    } else {
      engine.flyToPoint([pin.lon, pin.lat], card.kind === 'trip' ? 8 : 12, { plan: this.plan(card.kind === 'trip' ? 'trip' : 'place') });
    }
  }

  closeCard(): void {
    if (!this.snap.selected) return;
    const url = viewPath({ kind: 'area', path: this.snap.path });
    this.emit({ selected: null });
    this.currentUrl = url;
    this.o.navigate(url, 'push');
  }

  /** Drills a pin at world or country level (a country, state or district disc). */
  openPin(p: PinModel): void {
    if (p.cardKey) void this.selectCard(p.cardKey);
    else if (p.path) void this.goArea(p.path);
  }

  // ---- URL -----------------------------------------------------------------------------------------------
  /** Applies a view read from the URL (first load, Back, a link). `camera` is a restored `?c=`. */
  async applyView(v: View, o: { camera?: Camera | null; fly?: boolean } = {}): Promise<void> {
    this.currentUrl = viewPath(v);
    this.deepLinkPending = !o.camera && (v.kind !== 'area' || v.path.length > 0);
    if (v.kind === 'area') {
      this.engine?.setFeature(null);
      this.emit({ selected: null, feature: null, notice: null });
      await this.showArea(v.path, { fly: o.fly !== false, camera: o.camera });
      return;
    }
    const key = `${v.kind}:${v.slug}`;
    if (!(await this.card(key))) {
      this.emit({ selected: null, notice: v.kind === 'trip' ? 'That trip is not on the globe.' : 'That place is not on the globe.' });
      await this.showArea([], { fly: !o.camera, camera: o.camera });
      return;
    }
    await this.selectCard(key, { push: false, fly: o.fly !== false, camera: o.camera });
  }

  // ---- search --------------------------------------------------------------------------------------------
  async goTo(hit: SearchHit): Promise<void> {
    const { book } = this.o;
    const a = hit.action;
    const engine = this.engine;
    if (!engine) return;
    if (a.type === 'place' || a.type === 'trip') { await this.selectCard(`${a.type}:${a.slug}`); return; }
    const countryOf = (a3: string | null) => (a3 ? book.byA3[a3] : undefined);
    if (a.type === 'country') { const c = countryOf(a.a3); if (c) await this.goArea([c.a2.toLowerCase()]); return; }
    if (a.type === 'admin1') {
      const c = countryOf(a.a3);
      if (!c) return;
      const cc = c.a2.toLowerCase();
      await this.goArea([cc]);
      const idx = this.adm1 ? resolveFeature(this.adm1, a.name) : null;
      const f = idx !== null && this.adm1 ? this.adm1.features[idx] : null;
      if (f && slugify(String(f.properties.name)) === slugify(a.name)) await this.goArea([cc, this.slugFor(f, [cc])], { fly: true });
      else engine.flyToPoint([a.lng, a.lat], 5.5, { plan: this.plan('state') });
      return;
    }
    if (a.type === 'city') {
      const c = countryOf(a.a3);
      if (c) await this.drillToPoint(c.a2.toLowerCase(), [a.lng, a.lat]);
      engine.setPadding(this.padding());
      engine.flyToPoint([a.lng, a.lat], a.rank <= 2 ? 9.5 : featureZoom('city'), { plan: this.plan('feature', { featureClass: 'city' }) });
      // the city's card opens when the camera lands: its outline where we hold one, else the honest ring and "Boundary not loaded"
      const city: BasemapFeature = { sourceLayer: 'place', kind: 'city', name: a.name, extra: '', lngLat: [a.lng, a.lat], wikidata: null };
      engine.afterMove(() => this.onBasemap(city));
      return;
    }
    // A sea, range or other landform: fly there at a scale that fits its rank and stay on the world level.
    if (this.snap.path.length || this.snap.selected) await this.goArea([], { fly: false });
    engine.setPadding(this.padding());
    engine.flyToPoint([a.lng, a.lat], Math.max(3, zoomForRank(a.rank)), { plan: this.plan('feature', { featureClass: 'sea' }) }); // zoom 3 or more so a sea or ocean is clickable on arrival
    // The landform or sea becomes a selection card too: name, kind and the saved places near it.
    this.emit({ feature: { sourceLayer: '', kind: hit.where || hit.kindLabel.toLowerCase(), name: a.name, extra: '', lngLat: [a.lng, a.lat], wikidata: null } });
  }

  private async drillToPoint(cc: string, pt: Pt): Promise<void> {
    await this.goArea([cc], { fly: false });
    if (!this.adm1) return;
    const sf = locate(this.adm1, pt);
    if (!sf) return;
    const sPath = [cc, this.slugFor(sf, [cc])];
    await this.goArea(sPath, { fly: false });
    if (!this.adm2) return;
    const df = locate(this.adm2, pt);
    if (df) await this.goArea([...sPath, this.slugFor(df, sPath)], { fly: false });
  }

  /** Esc, the Back chip and the crumb all step through here. */
  crumbTo(path: string[]): void { void this.goArea(path); }

  get lastKnownCamera(): Camera | null { return this.lastCamera; }
}
