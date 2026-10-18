import { primaryPin } from '../primary';
import type { MapSpec } from '../types';

/**
 * Maps Embed API iframe URL. One pin per map: a `place` view of the primary point, or a `view` with the
 * camera when the page set one. It cannot draw our lines.
 */
export function embedUrl(key: string, spec: Pick<MapSpec, 'pins' | 'selectedId' | 'camera'>): string | null {
  const q = new URLSearchParams({ key });
  if (spec.camera) {
    q.set('center', `${spec.camera.lat.toFixed(5)},${spec.camera.lng.toFixed(5)}`);
    q.set('zoom', String(Math.round(spec.camera.zoom)));
    return `https://www.google.com/maps/embed/v1/view?${q.toString().replace(/%2C/g, ',')}`;
  }
  const p = primaryPin(spec);
  if (!p) return null;
  q.set('q', `${p.at.lat.toFixed(5)},${p.at.lng.toFixed(5)}`);
  q.set('zoom', '14');
  return `https://www.google.com/maps/embed/v1/place?${q.toString().replace(/%2C/g, ',')}`;
}
