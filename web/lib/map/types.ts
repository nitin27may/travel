export type MapFamily = 'maplibre' | 'google-js' | 'google-embed';
export interface LngLat { lng: number; lat: number }
export type PinStyle = 'stop' | 'stop-numbered' | 'base' | 'place' | 'trailhead' | 'parking' | 'trip';
export interface Pin {
  id: string;
  at: LngLat;
  style: PinStyle;
  label?: string;
  number?: number;
  days?: number[];
  kind?: string;
}
export type LineStyle = 'route' | 'route-pick' | 'trail' | 'straight-estimate';
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
