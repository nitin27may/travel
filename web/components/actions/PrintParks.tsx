/** Carries a trip's park lines inside its page for the print view to read (lib/export/printParks.ts). A server component: no script cost. */
export function PrintParks({ slug, lines }: { slug: string; lines: readonly string[] }) {
  if (!lines.length) return null;
  return <script type="application/json" data-print-parks={slug} dangerouslySetInnerHTML={{ __html: JSON.stringify(lines).replace(/</g, '\\u003c') }} />;
}
