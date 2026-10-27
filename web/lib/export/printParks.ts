// The park lines of a trip for the print view (PA-W; protected-area-entry 6.4 "Print and CSV: park line above the rows"). Like the export model,
// they travel inside their own page (`components/actions/PrintParks`), never as a file at a predictable address (P8). The lines are core's
// `tripParks` sentences: names, day numbers and kinds of document, no record ref and no household data.

/** The park lines the page carries for `slug`; [] outside a page or when the page has none. */
export function readParkLines(slug: string): string[] {
  if (typeof document === 'undefined') return [];
  const tag = [...document.querySelectorAll('script[data-print-parks]')].find((s) => s.getAttribute('data-print-parks') === slug);
  if (!tag?.textContent) return [];
  try {
    const lines: unknown = JSON.parse(tag.textContent);
    return Array.isArray(lines) ? lines.filter((l): l is string => typeof l === 'string') : [];
  } catch {
    return [];
  }
}
