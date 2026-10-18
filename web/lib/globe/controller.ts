import { factsLine, languagesLine } from './facts';
import { loadAdmin, resolveFeature, slugify } from './admin';
import type { CountryBook } from './countries';
import type { BasemapFeature, Focus, GlobeEngine, HitLayer, HoverInfo, Padding } from './engine';
import { inBox, inFeature, locate, tally, type Bbox, type Feat, type FeatColl, type Pt } from './geometry';
import { areaPathOfPin, boxOfArea, nodeAt, pinsFor, pinsUnder } from './model';
import { zoomForRank, type SearchHit } from './search';
import type { Camera, GlobeCard, GlobeData, PinModel, View } from './types';
import { cameraQuery, viewPath } from './url';
import { WORLD_LAT, WORLD_LNG, worldFrame, type Footprint } from './framing';

export interface Crumb { label: string; path: string[] }

/** Everything the React side draws, as one immutable snapshot. */
export interface GlobeSnapshot {
  ready: boolean;
  failed: string | null;
  loading: string;
  path: string[];
  crumbs: Crumb[];
  selected: string | null;
  feature: BasemapFeature | null;
  pins: PinModel[];
  notice: string | null;
}

export interface ControllerOptions {
  data: GlobeData;
  book: CountryBook;
  /** Writes the URL. `replace` for camera updates, `push` for a step the visitor can go Back from. */
  navigate(url: string, mode: 'push' | 'replace'): void;
  isPhone(): boolean;
  /** Canvas size and what the open panels cover right now. */
  layout(): { width: number; height: number; cover: Footprint };
  onChange(s: GlobeSnapshot): void;
}

export const WORLD_CAMERA = { desktop: { lng: -35, lat: 22, zoom: 1.95 }, phone: { lng: -35, lat: 22, zoom: 1.0 } };

const titleCase = (slug: string): string => slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/**
 * Orchestrates the globe: which area is open, which pin is selected, what the URL says. It owns no DOM; the engine
 * draws and React renders the panels from the snapshots it emits.
 */
export class GlobeController {
  private engine: GlobeEngine | null = null;
  private snap: GlobeSnapshot = { ready: false, failed: null, loading: '', path: [], crumbs: [], selected: null, feature: null, pins: [], notice: null };
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

  // ---- layout-aware camera padding -----------------------------------------------------------------------
  padding(): Padding {
    return this.o.isPhone() ? { top: 120, right: 24, bottom: 190, left: 24 } : { top: 90, right: 410, bottom: 80, left: 90 };
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

  // ---- engine events -------------------------------------------------------------------------------------
  ready(): void { this.emit({ ready: true }); }
  fail(reason: string): void { this.emit({ failed: reason }); }

  onCamera(c: Camera): void {
    this.lastCamera = c;
    this.o.navigate(`${this.currentUrl || viewPath({ kind: 'area', path: this.snap.path })}${cameraQuery(c)}`, 'replace');
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
    this.emit({ feature: f });
  }

  onBackground(): void {
    if (this.snap.feature) { this.engine?.setFeature(null); this.emit({ feature: null }); }
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
    this.focus = { country: country.id, s: null, d: null };
    this.adm2 = null;
    engine.setAdmin('adm2', null);
    engine.setFocus(this.focus);
    const crumbs: Crumb[] = [{ label: this.nameFor([cc]), path: [cc] }];
    this.emit({ path: [cc], crumbs, pins: pinsFor(this.o.data, [cc], this.o.book.facts), loading: path.length > 0 ? 'Loading states and provinces' : '' });
    const countryFeat = this.o.book.fc.features.find((x) => x.id === country.id)!;
    let target: Bbox | null = countryFeat._bbox ?? null;
    let maxZoom = 7;
    // Start moving at once; a deeper path refines the target once its shapes have loaded.
    if (o.fly && !o.camera) engine.flyToBox((path.length > 1 ? boxOfArea(this.o.data, path) : null) ?? target!, { maxZoom: path.length > 1 ? 9 : 7 });

    const adm1 = await loadAdmin(a3, 'adm1');
    if (token !== this.areaToken) return;
    if (adm1) tally(adm1, pinsUnder(this.o.data, [cc], 'place').map((p) => ({ id: p.slug, lon: p.lon, lat: p.lat })));
    this.adm1 = adm1;
    engine.setAdmin('adm1', adm1);

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
      if (o.fly && !o.camera && target) engine.flyToBox(target, { maxZoom });

      if (sFeat) {
        const all = await loadAdmin(a3, 'adm2');
        if (token !== this.areaToken) return;
        if (all) {
          // geoBoundaries districts do not always nest in Natural Earth states, so keep those whose centre falls inside this state.
          const sub: FeatColl = { type: 'FeatureCollection', features: all.features.filter((d) => d._c && inFeature(sFeat!, d._c)).map((d, k) => ({ ...d, id: k, properties: { ...d.properties } })) };
          const pts = pinsUnder(this.o.data, [cc, path[1]], 'place').map((p) => ({ id: p.slug, lon: p.lon, lat: p.lat }));
          tally(sub, pts);
          this.adm2 = sub.features.length ? sub : null;
          engine.setAdmin('adm2', this.adm2);
        }
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
    else if (o.fly && target && path[1]) engine.flyToBox(target, { maxZoom });
  }

  /** A step the visitor takes: updates the area, the URL and clears the selection. */
  async goArea(path: string[], o: { push?: boolean; fly?: boolean } = {}): Promise<void> {
    this.engine?.setFeature(null);
    this.emit({ selected: null, feature: null, notice: null });
    const url = viewPath({ kind: 'area', path });
    if (o.push !== false) { this.currentUrl = url; this.o.navigate(url, 'push'); }
    await this.showArea(path, { fly: o.fly !== false });
  }

  /** The Reset view button and the Home key: close everything, return to the world level and frame the whole disc. */
  reset(): void { void this.goArea([]); }

  back(): void {
    if (this.snap.feature) { this.engine?.setFeature(null); this.emit({ feature: null }); return; }
    if (this.snap.selected) { this.closeCard(); return; }
    if (this.snap.path.length) void this.goArea(this.snap.path.slice(0, -1));
  }

  // ---- pins ----------------------------------------------------------------------------------------------
  card(key: string): GlobeCard | undefined { return this.o.data.cards[key]; }

  async selectCard(key: string, o: { push?: boolean; fly?: boolean; camera?: Camera | null } = {}): Promise<void> {
    const card = this.card(key);
    const engine = this.engine;
    if (!card || !engine) { this.emit({ notice: 'That place is not on the globe yet.' }); return; }
    engine.setFeature(null);
    const pin = this.o.data.index.pins.find((p) => `${p.kind}:${p.slug}` === key);
    const chain = areaPathOfPin(this.o.data, key);
    const url = viewPath({ kind: card.kind, slug: card.slug });
    if (o.push !== false) { this.currentUrl = url; this.o.navigate(url, 'push'); }
    this.emit({ selected: key, feature: null, notice: null });
    const samePath = chain.join('/') === this.snap.path.join('/') || (this.snap.path.length > chain.length && chain.every((s, i) => this.snap.path[i] === s));
    if (!samePath || !this.adm1) await this.showArea(chain.slice(0, card.kind === 'trip' ? 1 : 3), { fly: false });
    if (this.snap.selected !== key || !pin) return;
    if (o.camera) { engine.jumpTo(o.camera); return; }
    if (o.fly === false) return;
    engine.setPadding(this.o.isPhone() ? { top: 100, right: 24, bottom: 470, left: 24 } : this.padding());
    if (card.approx) {
      const country = this.o.book.byA2[pin.path[0]];
      const cf = country ? this.o.book.fc.features.find((x) => x.id === country.id) : undefined;
      if (cf?._bbox) engine.flyToBox(cf._bbox, { maxZoom: 6 });
    } else {
      engine.flyToPoint([pin.lon, pin.lat], card.kind === 'trip' ? 8 : 12, { tilt: true });
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
    if (v.kind === 'area') {
      this.engine?.setFeature(null);
      this.emit({ selected: null, feature: null, notice: null });
      await this.showArea(v.path, { fly: o.fly !== false, camera: o.camera });
      return;
    }
    const key = `${v.kind}:${v.slug}`;
    if (!this.card(key)) {
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
      else engine.flyToPoint([a.lng, a.lat], 5.5);
      return;
    }
    if (a.type === 'city') {
      const c = countryOf(a.a3);
      if (c) await this.drillToPoint(c.a2.toLowerCase(), [a.lng, a.lat]);
      engine.setPadding(this.padding());
      engine.flyToPoint([a.lng, a.lat], a.rank <= 2 ? 9.5 : 11);
      return;
    }
    // A sea, range or other landform: fly there at a scale that fits its rank and stay on the world level.
    if (this.snap.path.length || this.snap.selected) await this.goArea([], { fly: false });
    engine.setPadding(this.padding());
    engine.flyToPoint([a.lng, a.lat], zoomForRank(a.rank));
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
