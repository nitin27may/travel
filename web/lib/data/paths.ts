/** Path segments for /places/<CC>/<region>/<area>/<place>/ from a place id (CC/REGION/area/place). */
export function placeSegments(id: string): string[] {
  return id.split('/');
}

export function placeHref(id: string): string {
  return `/places/${placeSegments(id).map(encodeURIComponent).join('/')}/`;
}

export function globeHref(row: { country_a3: string; id: string; lat: number | null }): string | null {
  return row.lat === null ? null : `/globe/#c=${encodeURIComponent(row.country_a3)}&p=${encodeURIComponent(row.id)}`;
}

export function mapsHref(row: { lat: number | null; lon: number | null; name: string; country_name: string }): string {
  return row.lat !== null && row.lon !== null
    ? `https://maps.google.com/?q=${row.lat},${row.lon}`
    : `https://maps.google.com/?q=${encodeURIComponent(`${row.name} ${row.country_name}`)}`;
}
