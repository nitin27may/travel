// Export formats (D-E6, store.ts A26): K20 the `json` model, K21 the `print` file. Both are API-3a contract and API-3b code: until 3b they
// run and must fail for the reason in `awaits`.
import { expect } from "vitest";
import { EXPORT_FILE, PRINT_GAP, exportModel, type ExportModel } from "../../../src/schema/api/index.ts";
import { SKELETON, expectOk, okOrSkeleton, type ContractCase } from "./kit.ts";

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
    awaits: { step: "API-3b step 11 (K20: the json export)", failsWith: SKELETON },
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
    awaits: { step: "API-3b step 11 (K21: the print file)", failsWith: /text\/plain; charset=utf-8/ },
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
        const model = okOrSkeleton(await store.getExport({ type, slug, format: "json" }), `${type} json`);
        if (model) {
          const gaps = gapsOf(exportModel.parse(JSON.parse(model.body)));
          if (gaps) expect(f.body.split(PRINT_GAP).length - 1, `${type} gaps`).toBeGreaterThanOrEqual(gaps);
        }
      }
    },
  },
];
