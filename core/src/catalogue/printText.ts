// The `print` export: a plain-text file laid out for paper (store.ts A26, D-E6). One definition, so JsonStore (web/lib/server/exports.ts)
// and StubStore write the same layout from the same model, and SupabaseStore can too. It reads the export MODEL (the `json` format),
// never the page, so the licence guard that shaped the model holds here: a stop with no point reads "Not checked yet", never a
// coordinate the guard refused.
//
// Every laid-out value the item lacks reads PRINT_GAP, never a blank, `null`, `undefined` or `-` (case K21).
//
// Layout note: the fields of a stop are joined by " | " and a location is in parentheses. The privacy detector's street-address rule reads
// "<digits> <Capital word> ... Drive" as an address, so a bare "09:00  Zion Scenic Drive" (a time, then a name) or a coordinate at the end of a
// line followed by the next line would be flagged; the separators keep every number from sitting next to a word.
import { PRINT_GAP, type ExportModel } from "../schema/api/export.ts";
import { approxNote } from "../export/licence.ts";
import { bookAheadText } from "../export/bookings.ts";

type Located = { lat: number; lon: number; pointSource: string; sourceLicence: string };

/** "(lat, lon)" to five places (about a metre), with "approximate" inside when the point is only roughly placed; the gap words when there is none. */
function location(p: Located | null | undefined): string {
  if (!p) return PRINT_GAP;
  return `(${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}${approxNote(p) ? ", approximate" : ""})`;
}

const word = (s: string | null | undefined): string => (s && s.trim() ? s.trim() : PRINT_GAP);

/**
 * The file's text. `area` is the place's area line ("Bow Valley, Canada"): the model of a place does not carry it, so the caller that
 * knows the page passes it, and a caller that does not leaves it out as a gap.
 */
export function printText(model: ExportModel, extra: { area?: string | null } = {}): string {
  const lines: string[] = [model.title, model.url, ""];
  if (model.type === "place") {
    lines.push(`Kind: ${word(model.kind)}`, `Area: ${word(extra.area)}`);
    const here = model.waypoints.find((w) => w.role === "place") ?? model.waypoints[0];
    lines.push(`Location: ${location(here?.point)}`);
    for (const w of model.waypoints) if (w !== here) lines.push(`${w.role === "trailhead" ? "Trailhead" : w.role === "parking" ? "Parking" : "Also"}: ${word(w.name)}, ${location(w.point)}`);
    return `${lines.join("\n")}\n`;
  }
  lines.push(`${model.nights} night${model.nights === 1 ? "" : "s"}`);
  // "Book ahead" (MUST-6, T1, P6; TRP-GL-C review F5): the trip's bookings, in the model's day order, before the days, so paper says what to
  // book before the trip starts. Dateless, worded as the page words them (core/src/export/bookings.ts). No block when the plan has none.
  if (model.bookings.length) {
    lines.push("", "Book ahead");
    for (const b of model.bookings) lines.push(`  ${b.day === null ? "Any day" : `Day ${b.day}`} | ${word(b.name)} | ${word(bookAheadText(b))}`);
  }
  for (const day of model.days) {
    lines.push("", `Day ${day.n}: ${word(day.title)}${day.base ? ` (base ${day.base})` : ""}`);
    const stops = model.stops.filter((s) => s.day === day.n).sort((a, b) => a.order - b.order);
    if (!stops.length) lines.push(`  ${PRINT_GAP}`);
    for (const s of stops) lines.push(`  ${word(s.time)} | ${word(s.name)} | ${word(s.area)} | ${location(s.point)}${s.lane ? ` | ${s.lane}` : ""}${s.bookAhead ? ` | Book ahead: ${s.bookAhead}` : ""}`);
  }
  return `${lines.join("\n")}\n`;
}
