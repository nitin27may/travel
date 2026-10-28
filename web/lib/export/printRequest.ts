// Print from anywhere on the trip page (the trip `⋯` menu, the copy sheet): the export menu is the one place that builds the print view, and it
// answers this event (components/actions/ExportMenu.tsx). If nothing answers (the menu's chunk is still loading), the browser's own print
// stands in rather than doing nothing.
export function printTrip(slug: string): void {
  const detail: { slug: string; handled?: boolean } = { slug };
  window.dispatchEvent(new CustomEvent('travel:print', { detail }));
  if (!detail.handled) window.print();
}
