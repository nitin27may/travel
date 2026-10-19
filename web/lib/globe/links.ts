/** Directions from our own coordinates (T5: honest maps). A link to the visitor's own maps app; no map of theirs is drawn on our page. */
export function directionsUrl(p: { lat: number; lon: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
}
