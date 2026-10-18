// The live map. Online: OpenFreeMap vector tiles (positron / dark) with Mapterhorn terrain shading, both free
// and keyless, worldwide. Offline or sandboxed (the published artifact): our own shaded relief plus Natural
// Earth lines. Pins are HTML markers (a few dozen per trip); routes and the drag preview are our own layers.
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerCode from "../vendor/maplibre-worker.js?raw";
import basemap from "../data/basemap.json";
import { useEffect, useRef } from "react";
import type { Place } from "../data/places";
import type { DayPlan } from "../state/store";
import { fmtMin } from "../lib/geo";

const workerUrl = URL.createObjectURL(new Blob([workerCode], { type: "text/javascript" }));
maplibregl.setWorkerUrl(workerUrl);

const RELIEF: [[number, number], [number, number], [number, number], [number, number]] = [
  [10.8984375, 47.1000446940252], [12.83203125, 47.1000446940252], [12.83203125, 46.134170046243256], [10.8984375, 46.134170046243256],
];
const short = (n: string) => n.replace(/^Example (hotel|guesthouse), /, "").replace(/ (loop|ridge|cable car and tunnels|viewpoint)$/i, "").replace(/, .*$/, "");
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export interface Pin { id: string; place: Place; label: string; kind: "stop" | "base" | "idea" | "suggest"; day?: number; itemId?: string; dim?: boolean; draggable?: boolean; lane?: string; color?: string; quiet?: boolean }
// eight colour-blind-safe day colours (Okabe-Ito based), repeating after day 8
const DAY_COLOURS = ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#B07A00", "#3E9BD6", "#8C564B", "#6A4C9C"];
export const dayColour = (n: number) => DAY_COLOURS[(n - 1) % DAY_COLOURS.length];
export interface MapProps {
  theme: "light" | "dark";
  plans: DayPlan[];
  focusDay?: number;
  pins: Pin[];
  selectedItem?: string;
  preview?: { from: Place; to: Place; back?: Place } | null;
  fit?: number;                                   // bump to re-fit the focus day
  onPick: (pin: Pin) => void;
  onPinDrag: (placeId: string, lng: number, lat: number, done: boolean) => void;
  onAddHere: (lng: number, lat: number, x: number, y: number) => void;
  onReady?: (map: maplibregl.Map) => void;
  compact?: boolean;
  peek?: Place;                                    // a search result being looked at
}

export function MapView(p: MapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, { m: maplibregl.Marker; key: string }>());
  const legMarkers = useRef<maplibregl.Marker[]>([]);
  const props = useRef(p); props.current = p;
  const ready = useRef(false);
  const online = useRef(false);

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      center: [12.0, 46.6], zoom: 8.6, minZoom: 3, maxZoom: 17, attributionControl: false, dragRotate: false, pitchWithRotate: false,
      style: offlineStyle(p.theme),
    });
    online.current = false;
    void onlineStyle(p.theme).then(st => { if (st && map.current === m) { online.current = true; m.setStyle(st, { diff: false }); } });
    m.on("style.load", () => { if (ready.current) { sync(); paintTheme(); } });
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.current = m;
    m.on("load", () => { ready.current = true; sync(); fitFocus(true); props.current.onReady?.(m); });
    m.on("contextmenu", (e: maplibregl.MapMouseEvent) => { e.preventDefault(); props.current.onAddHere(e.lngLat.lng, e.lngLat.lat, e.point.x, e.point.y); });
    let lp: number | undefined; let start: maplibregl.Point | undefined;
    m.on("touchstart", (e: maplibregl.MapTouchEvent) => { if (e.originalEvent.touches.length !== 1) return; start = e.point; const ll = e.lngLat; lp = window.setTimeout(() => props.current.onAddHere(ll.lng, ll.lat, e.point.x, e.point.y), 550); });
    m.on("touchmove", (e: maplibregl.MapTouchEvent) => { if (start && e.point.dist(start) > 8) { clearTimeout(lp); lp = undefined; } });
    m.on("touchend", () => clearTimeout(lp));
    const ro = new ResizeObserver(() => m.resize()); ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; ready.current = false; };
  }, []);

  // theme: online swaps the basemap style (our layers come with it); offline swaps the relief image
  function paintTheme() {
    const m = map.current; if (!m) return;
    requestAnimationFrame(() => {
      if (!m.getLayer("route-focus")) return;
      for (const id of ["route-other", "route-focus"]) m.setPaintProperty(id, "line-color", css("--route"));
      m.setPaintProperty("route-halo", "line-color", css("--halo"));
      m.setPaintProperty("route-lane-b", "line-color", css("--act"));
      m.setPaintProperty("preview", "line-color", css("--glow"));
      if (m.getLayer("region")) m.setPaintProperty("region", "line-color", css("--faint"));
      if (m.getLayer("border")) m.setPaintProperty("border", "line-color", css("--muted"));
      if (m.getLayer("bg")) m.setPaintProperty("bg", "background-color", css("--bg"));
    });
  }
  useEffect(() => {
    const m = map.current; if (!m || !ready.current) return;
    if (online.current) { void onlineStyle(p.theme).then(st => { if (st && map.current === m) m.setStyle(st, { diff: false }); }); return; }
    (m.getSource("relief") as maplibregl.ImageSource).updateImage({ url: `./relief-${p.theme}.webp`, coordinates: RELIEF });
    paintTheme();
  }, [p.theme]);

  function sync() {
    const m = map.current; if (!m || !ready.current) return;
    const { plans, focusDay, pins, selectedItem, preview } = props.current;
    const feats: GeoJSON.Feature[] = [];
    for (const d of plans) {
      const lanes: Record<string, Place[]> = {};
      const a = [d.start, ...d.stops.filter(s => s.item.variant !== "B").map(s => s.place), d.end].filter(Boolean) as Place[];
      lanes.A = a;
      const b = d.stops.filter(s => s.item.variant === "B");
      if (b.length) lanes.B = [d.start, ...b.map(s => s.place), d.end].filter(Boolean) as Place[];
      for (const [lane, pts] of Object.entries(lanes)) if (pts.length > 1)
        if (focusDay === undefined || d.n === focusDay) feats.push({ type: "Feature", properties: { focus: d.n === focusDay, all: focusDay === undefined, color: dayColour(d.n), lane, day: d.n }, geometry: { type: "LineString", coordinates: pts.map(x => [x.lng, x.lat]) } });
    }
    (m.getSource("routes") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: feats });
    (m.getSource("preview") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: preview ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [preview.from, preview.to, ...(preview.back ? [preview.back] : [])].map(x => [x.lng, x.lat]) } }] : [] });

    // markers: diff by id
    const seen = new Set<string>();
    for (const pin of pins) {
      seen.add(pin.id);
      const sel = pin.itemId && pin.itemId === selectedItem;
      const key = `${pin.kind}|${pin.label}|${pin.dim}|${sel}|${pin.place.lng}|${pin.place.lat}|${pin.draggable}|${pin.color}|${pin.quiet}`;
      const have = markers.current.get(pin.id);
      if (have && have.key === key) continue;
      if (have) {
        have.m.setLngLat([pin.place.lng, pin.place.lat]);
        paint(have.m.getElement(), pin, !!sel);
        have.m.setDraggable(!!pin.draggable);
        have.key = key; continue;
      }
      // MapLibre positions the outer element with a transform; the styled pin is inside so its own
      // transforms (hover, drop, selected) never fight the marker's position.
      const wrap = document.createElement("div"); wrap.className = "pin-wrap";
      const node = document.createElement("button");
      node.className = "pin pin-drop";
      wrap.appendChild(node);
      paint(wrap, pin, !!sel);
      node.addEventListener("click", ev => { ev.stopPropagation(); props.current.onPick(pin); });
      const mk = new maplibregl.Marker({ element: wrap, draggable: !!pin.draggable, anchor: "center" }).setLngLat([pin.place.lng, pin.place.lat]).addTo(m);
      mk.on("drag", () => { const ll = mk.getLngLat(); props.current.onPinDrag(pin.place.id, ll.lng, ll.lat, false); });
      mk.on("dragend", () => { const ll = mk.getLngLat(); props.current.onPinDrag(pin.place.id, ll.lng, ll.lat, true); });
      markers.current.set(pin.id, { m: mk, key });
      setTimeout(() => node.classList.remove("pin-drop"), 400);
    }
    for (const [id, { m: mk }] of markers.current) if (!seen.has(id)) { mk.remove(); markers.current.delete(id); }

    // leg labels for the focus day
    legMarkers.current.forEach(x => x.remove()); legMarkers.current = [];
    const fd = plans.find(d => d.n === focusDay);
    if (fd && !props.current.compact) for (const l of fd.legs) {
      if (l.mode !== "drive" || l.min < 6) continue;
      const t = document.createElement("div"); t.className = "leg-label num"; t.textContent = `≈ ${fmtMin(l.min)}`;
      legMarkers.current.push(new maplibregl.Marker({ element: t }).setLngLat([(l.from.lng + l.to.lng) / 2, (l.from.lat + l.to.lat) / 2]).addTo(m));
    }
  }
  function paint(wrap: HTMLElement, pin: Pin, sel: boolean) {
    const node = wrap.firstElementChild as HTMLElement;
    wrap.style.zIndex = sel ? "6" : pin.dim ? "1" : "3";
    node.style.background = pin.color ?? ""; node.style.color = pin.color ? "#FFFFFF" : "";
    node.dataset.kind = pin.kind; node.dataset.dim = pin.dim ? "1" : "0"; node.dataset.sel = sel ? "1" : "0"; node.dataset.lane = pin.lane ?? "";
    node.setAttribute("aria-label", `${pin.label} ${pin.place.name}`); node.title = pin.place.name;
    node.innerHTML = pin.kind === "base"
      ? `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M3 11l9-7 9 7M5 9.5V20h14V9.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : `<span>${pin.label}</span>`;
    let tag = wrap.querySelector(".pin-name") as HTMLElement | null;
    const showName = !pin.dim && !pin.quiet && (pin.kind === "stop" || pin.kind === "base");
    if (showName) { if (!tag) { tag = document.createElement("span"); tag.className = "pin-name"; wrap.appendChild(tag); } tag.textContent = short(pin.place.name); }
    else tag?.remove();
  }
  function fitFocus(instant = false) {
    const m = map.current; if (!m) return;
    const { plans, focusDay } = props.current;
    const days = focusDay === undefined ? plans : plans.filter(x => x.n === focusDay); if (!days.length) return;
    const pts = days.flatMap(d => [d.start, ...d.stops.map(s => s.place), d.end]).filter(Boolean) as Place[];
    if (!pts.length) return;
    const b = new maplibregl.LngLatBounds();
    pts.forEach(x => b.extend([x.lng, x.lat]));
    const pad = props.current.compact ? { top: 50, left: 40, right: 40, bottom: Math.round(window.innerHeight * 0.48) + 40 } : { top: 70, bottom: 70, left: 70, right: 70 };
    m.fitBounds(b, { padding: pad, maxZoom: 12.2, duration: instant || reduceMotion() ? 0 : 850, essential: false });
  }

  useEffect(() => { sync(); });
  useEffect(() => { fitFocus(); }, [p.focusDay, p.fit]);
  useEffect(() => {
    const m = map.current; if (!m || !p.selectedItem) return;
    const pin = p.pins.find(x => x.itemId === p.selectedItem); if (!pin) return;
    if (!m.getBounds().contains([pin.place.lng, pin.place.lat])) m.easeTo({ center: [pin.place.lng, pin.place.lat], duration: reduceMotion() ? 0 : 500 });
  }, [p.selectedItem]);

  useEffect(() => {
    const m = map.current; if (!m || !p.peek) return;
    if (!m.getBounds().contains([p.peek.lng, p.peek.lat])) m.easeTo({ center: [p.peek.lng, p.peek.lat], duration: reduceMotion() ? 0 : 450 });
  }, [p.peek]);

  return <div ref={el} className="map" role="application" aria-label="Trip map. Right-click or long-press to add a place here." />;
}

// ---------- styles ----------
const ourSources = (): Record<string, maplibregl.SourceSpecification> => ({
  routes: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
  preview: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
});
const ourLayers = (): maplibregl.LayerSpecification[] => [
  { id: "route-other", type: "line", source: "routes", filter: ["all", ["!", ["get", "focus"]], ["!", ["get", "all"]]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": css("--route"), "line-width": 1.2, "line-opacity": .18 } },
  { id: "route-halo", type: "line", source: "routes", filter: ["get", "focus"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": css("--halo"), "line-width": 7, "line-opacity": .9 } },
  { id: "route-focus", type: "line", source: "routes", filter: ["all", ["get", "focus"], ["!=", ["get", "lane"], "B"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": css("--route"), "line-width": 3 } },
  { id: "route-all-halo", type: "line", source: "routes", filter: ["get", "all"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": css("--halo"), "line-width": 5.5, "line-opacity": .85 } },
  { id: "route-all", type: "line", source: "routes", filter: ["get", "all"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 2.6, "line-opacity": .9 } },
  { id: "route-lane-b", type: "line", source: "routes", filter: ["all", ["get", "focus"], ["==", ["get", "lane"], "B"]], layout: { "line-cap": "round" }, paint: { "line-color": css("--act"), "line-width": 2.6, "line-dasharray": [1, 1.6] } },
  { id: "preview", type: "line", source: "preview", layout: { "line-cap": "round" }, paint: { "line-color": css("--glow"), "line-width": 3, "line-dasharray": [1.2, 1.4] } },
];
function offlineStyle(theme: "light" | "dark"): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      relief: { type: "image", url: `./relief-${theme}.webp`, coordinates: RELIEF },
      base: { type: "geojson", data: basemap as GeoJSON.FeatureCollection, attribution: "Relief from AWS Terrain Tiles (Mapzen, open data) · © Natural Earth · offline basemap" },
      ...ourSources(),
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": css("--bg") } },
      { id: "relief", type: "raster", source: "relief", paint: { "raster-opacity": 1, "raster-fade-duration": 0, "raster-resampling": "linear" } },
      { id: "river", type: "line", source: "base", filter: ["==", ["get", "k"], "river"], paint: { "line-color": "#7FA6B5", "line-width": 1.2, "line-opacity": .55 } },
      { id: "region", type: "line", source: "base", filter: ["==", ["get", "k"], "region"], paint: { "line-color": css("--faint"), "line-width": 1, "line-dasharray": [3, 3], "line-opacity": .6 } },
      { id: "border", type: "line", source: "base", filter: ["==", ["get", "k"], "border"], paint: { "line-color": css("--muted"), "line-width": 1.4, "line-dasharray": [4, 2, 1, 2] } },
      ...ourLayers(),
    ],
  };
}
const styleCache = new Map<string, maplibregl.StyleSpecification>();
/** OpenFreeMap's style plus Mapterhorn hillshade under the labels, plus our route layers on top; null when offline */
async function onlineStyle(theme: "light" | "dark"): Promise<maplibregl.StyleSpecification | null> {
  const name = theme === "dark" ? "dark" : "positron";
  try {
    let base = styleCache.get(name);
    if (!base) {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch(`https://tiles.openfreemap.org/styles/${name}`, { signal: ctl.signal }); clearTimeout(t);
      if (!r.ok) return null;
      base = await r.json() as maplibregl.StyleSpecification; styleCache.set(name, base);
    }
    const layers = [...base.layers];
    const firstSymbol = layers.findIndex(l => l.type === "symbol");
    const hill: maplibregl.LayerSpecification = { id: "hillshade", type: "hillshade", source: "terrain",
      paint: theme === "dark"
        ? { "hillshade-exaggeration": .35, "hillshade-shadow-color": "#000000", "hillshade-highlight-color": "#3A4046", "hillshade-accent-color": "#000000" }
        : { "hillshade-exaggeration": .3, "hillshade-shadow-color": "#5C6268", "hillshade-highlight-color": "#FFFFFF", "hillshade-accent-color": "#8E959B" } };
    layers.splice(firstSymbol < 0 ? layers.length : firstSymbol, 0, hill);
    return {
      ...base,
      sources: { ...base.sources, terrain: { type: "raster-dem", url: "https://tiles.mapterhorn.com/tilejson.json", tileSize: 512, encoding: "terrarium" }, ...ourSources() },
      layers: [...layers, ...ourLayers()],
    };
  } catch { return null; }
}
