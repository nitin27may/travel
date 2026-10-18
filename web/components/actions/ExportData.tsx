import type { PlaceExport, TripExport } from '@/lib/export/types';

/**
 * Carries one item's export data inside its own page, for the export menu and the copy sheet to read (principle P8:
 * exports come from the page, never from a file at a predictable address). A server component: it costs no script.
 * `<` is escaped so the data can never close the tag.
 */
export function ExportData({ data }: { data: TripExport | PlaceExport | null }) {
  if (!data) return null;
  return <script type="application/json" data-export-data={`${data.type}:${data.slug}`} dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
