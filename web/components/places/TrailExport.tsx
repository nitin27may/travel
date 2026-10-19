import type { ExportFormat } from '@/components/actions/ExportMenu';
import type { PlaceLine } from '@/lib/public/types';
import { ExportMenuLazy as ExportMenu } from './ExportMenuLazy';
import { trackOfLines } from './model';

/**
 * Export for a trail: waypoints always, the route line only when it is confirmed and our licence guard passes (GPX and KML both
 * carry the ODbL notice). A held-back line says so under the menu, in words.
 */
export function TrailExport({ slug, lines }: { slug: string; lines: PlaceLine[] }) {
  const stored = trackOfLines(lines);
  const formats: ExportFormat[] = lines.length ? (lines.every((l) => l.exportable) ? ['gpx', 'kml'] : ['gpx']) : ['gpx'];
  return (
    <>
      <ExportMenu target={{ type: 'place', slug }} formats={formats} />
      {stored && !stored.exportable ? <span className="muted small pl-export-note">Route line left out of the file: not confirmed yet. Trailhead and parking points are in it.</span> : null}
      {stored?.exportable ? <span className="muted small pl-export-note">The file holds the OpenStreetMap track, with its licence notice.</span> : null}
    </>
  );
}
