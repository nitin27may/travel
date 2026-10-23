export type MapFamily = 'maplibre' | 'google-js' | 'google-embed';
export interface LngLat { lng: number; lat: number }
export type PinStyle = 'stop' | 'stop-numbered' | 'base' | 'place' | 'trailhead' | 'parking' | 'trip';
export interface Pin {
  id: string;
  at: LngLat;
  style: PinStyle;
  label?: string;
  /** Keeps the label for assistive tech and the fan-out, but draws no text beside the pin (crowded pins, numbered clusters). */
  quiet?: boolean;
  number?: number;
  /** A combined pill ("2·3"): the numbers of the stops that overlap here at the current zoom. Drawn instead of `number` when set. */
  numbers?: number[];
  /** Another day's stop while one day is picked: drawn at half strength and never numbered. */
  dim?: boolean;
  days?: number[];
  kind?: string;
}
/** `trail-unconfirmed` is a stored line a person has not confirmed: dashed in the muted ink, never the estimate style (that one is for straight legs). */
export type LineStyle = 'route' | 'route-pick' | 'trail' | 'trail-unconfirmed' | 'straight-estimate';
export interface Line { id: string; coords: LngLat[]; style: LineStyle }
export interface LegendItem { id: string; label: string; style: PinStyle | LineStyle }
export interface MapSpec {
  pins: Pin[];
  lines: Line[];
  /** Initial camera. `?c=` (camera) overrides it. */
  fit?: 'all' | { ids: string[] };
  camera?: { lng: number; lat: number; zoom: number };
  selectedId?: string;
  /** Elevation scrub position; drawn as the amber cursor. */
  cursor?: LngLat | null;
  terrain?: boolean;
  style?: 'relief' | 'light' | 'dark' | 'auto';
  interactive?: boolean;
  legend?: LegendItem[];
  /** Hide the basemap's own town and city names, or country names, where the page's pins and labels sit on them and would collide. */
  /** Report every camera move (a fly-to, wheel zoom, keys), not only drags: a page that clusters by zoom must re-cluster after all of them. */
  reportAllMoves?: boolean;
  hideBasemapLabels?: ('towns' | 'regions' | 'countries')[];
  /** `click` (the default, every place page) puts a button in front of the Google map; `visible` loads it when it scrolls into view (the trip map). */
  load?: 'click' | 'visible';
  /** The pin to ring and the leg to colour, applied without redrawing the pins and lines (a hover from the day list). */
  hover?: { pin?: string | null; leg?: string | null } | null;
  /** Pixels a fit keeps clear of the map's own controls and attribution. */
  fitPadding?: { top: number; right: number; bottom: number; left: number };
  /** The closest a fit may zoom (a single stop is centred at this zoom). */
  maxZoom?: number;
}
export type FlyTarget = LngLat | { bounds: [LngLat, LngLat] };
export interface MapHandle {
  flyTo(target: FlyTarget, opts?: { zoom?: number }): void;
  fit(ids?: string[]): void;
  select(id: string | null): void;
  setCursor(p: LngLat | null): void;
}
export interface CameraState { lng: number; lat: number; zoom: number }
export interface MapSurfaceCallbacks {
  onSelect?: (id: string | null) => void;
  onCamera?: (c: CameraState) => void;
}
