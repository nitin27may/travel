// Export formats (D-E6, store.ts A26): K20 the `json` model, K21 the `print` file.
import { expect } from "vitest";
import { EXPORT_FILE, PRINT_GAP, exportModel, type ExportModel } from "../../../src/schema/api/index.ts";
import { expectOk, householdHits, type ContractCase } from "./kit.ts";
import { bookAheadText, tripBookings } from "../../../src/export/bookings.ts";
import { isDated } from "../../../src/privacy/dateless.ts";

const items = (t: Parameters<ContractCase["run"]>[1]) => [["place", t.facts.exportPlace], ["trip", t.facts.tripSlug]] as const;

/** The values a print file lays out that the model says are missing (A26): each must read PRINT_GAP. */
function gapsOf(m: ExportModel): number {
  if (m.type === "place") return m.waypoints.length ? 0 : 1;
  return m.stops.filter((s) => s.area === null).length + m.stops.filter((s) => s.point === null).length;
}

export const exportFormatsCases: ContractCase[] = [
  {
    id: "K20",
    title: "format=json is the export model: EXPORT_FILE's mime, <slug>.json, a body that parses as exportModel for the same item",
    method: "getExport",
    async run(store, t) {
      for (const [type, slug] of items(t)) {
        const f = expectOk(await store.getExport({ type, slug, format: "json" }), `${type} json`);
        expect(f.mime).toBe(EXPORT_FILE.json.mime);
        expect(f.filename).toBe(`${slug}.${EXPORT_FILE.json.ext}`);
        const parsed = exportModel.safeParse(JSON.parse(f.body));
        expect(parsed.success, parsed.success ? "" : parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")).toBe(true);
        if (!parsed.success) continue;
        expect(parsed.data.type).toBe(type);
        expect(parsed.data.slug).toBe(slug);
        // the licence guard holds inside the model (A26): what the file skipped, the model skipped
        expect(parsed.data.skipped, `${type} skipped`).toBe(f.skipped);
      }
      // still one item (K6): a list of slugs is refused for json too
      const r = await store.getExport({ type: "place", slug: `${t.facts.exportPlace},${t.facts.placeSlug}`, format: "json" });
      expect(r.ok).toBe(false);
    },
  },
  {
    id: "K21",
    title: "format=print is a plain-text file: text/plain; charset=utf-8, <slug>.txt, no JSON, no null or undefined, gaps read 'Not checked yet'",
    method: "getExport",
    async run(store, t) {
      for (const [type, slug] of items(t)) {
        const f = expectOk(await store.getExport({ type, slug, format: "print" }), `${type} print`);
        expect(f.mime, `${type} print mime`).toBe(EXPORT_FILE.print.mime);
        expect(f.filename).toBe(`${slug}.${EXPORT_FILE.print.ext}`);
        expect(f.body.trim().length).toBeGreaterThan(0);
        expect(/^\s*[[{]/.test(f.body), "a print body is not JSON").toBe(false);
        expect(() => JSON.parse(f.body), "a print body does not parse as JSON").toThrow();
        expect(f.body).not.toMatch(/\b(?:null|undefined|NaN)\b/);
        // every laid-out gap of the item reads the site's gap words (A26)
        const model = expectOk(await store.getExport({ type, slug, format: "json" }), `${type} json`);
        const gaps = gapsOf(exportModel.parse(JSON.parse(model.body)));
        if (gaps) expect(f.body.split(PRINT_GAP).length - 1, `${type} gaps`).toBeGreaterThanOrEqual(gaps);
      }
    },
  },
  {
    id: "K30",
    title: "a trip's json model lists its bookings (MUST-6): the trip detail's rows with a window or note, in day order, worded as the page words them, dateless; [] when none; the CSV carries each one",
    method: "getExport",
    async run(store, t) {
      const slug = t.facts.tripSlug;
      const got = expectOk(await store.getTrip(slug));
      if ("moved" in got) throw new Error(`${slug} answered moved`);
      // the page's own rows are the source: the same function over them is what the model must hold (a trip with none holds [])
      const want = tripBookings(Object.values(got.categories).flat());
      const f = expectOk(await store.getExport({ type: "trip", slug, format: "json" }), "trip json");
      const m = exportModel.parse(JSON.parse(f.body));
      if (m.type !== "trip") throw new Error("not a trip");
      expect(m.bookings).toEqual(want);
      const days = m.bookings.map((b) => b.day ?? Infinity);
      expect(days).toEqual([...days].sort((a, b) => a - b));
      const dayNs = new Set(m.days.map((d) => d.n));
      for (const b of m.bookings) if (b.day !== null) expect(dayNs.has(b.day), `${b.ref} day ${b.day}`).toBe(true);
      // dateless: a window is relative to a day, never a calendar date, in the model, on a stop, or in the CSV
      const texts = [...m.bookings.flatMap((b) => [b.name, b.rule, b.note]), ...m.stops.map((s) => s.bookRule)].filter((x): x is string => !!x);
      for (const text of texts) expect(isDated(text), text).toBe(false);
      expect(householdHits({ bookings: m.bookings, stops: m.stops.map((s) => s.bookRule ?? null) }, `${slug} bookings`)).toEqual([]);
      const csv = expectOk(await store.getExport({ type: "trip", slug, format: "csv" }), "trip csv").body;
      for (const b of m.bookings) {
        const cell = bookAheadText(b);
        expect(csv.includes(cell) || csv.includes(`"${cell.replace(/"/g, '""')}"`), `${b.ref} in the CSV`).toBe(true);
      }
    },
  },
];
