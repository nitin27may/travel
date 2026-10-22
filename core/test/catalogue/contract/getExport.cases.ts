// getExport: K6 one item per export, the licence guard, the shape.
import { expect } from "vitest";
import { EXPORT_FORMATS, exportFile } from "../../../src/schema/api/index.ts";
import { expectError, expectOk, type ContractCase } from "./kit.ts";

export const getExportCases: ContractCase[] = [
  {
    id: "K6",
    title: "an export is one item: a list of slugs is invalid_input, an unknown item not_found, the file names its one slug",
    method: "getExport",
    async run(store, t) {
      const slug = t.facts.exportPlace;
      expectError(await store.getExport({ type: "place", slug: `${slug},${t.facts.placeSlug}`, format: "gpx" }), "invalid_input");
      expectError(await store.getExport({ type: "place", slug: "no-such-place-anywhere", format: "gpx" }), "not_found");
      expectError(await store.getExport({ type: "trip", slug, format: "gpx" }), "not_found");
      const gpx = expectOk(await store.getExport({ type: "place", slug, format: "gpx" }));
      expect(gpx.filename.startsWith(slug)).toBe(true);
      expect(gpx.body.match(/<wpt /g)?.length ?? 0).toBeLessThanOrEqual(1 + gpx.skipped);
    },
  },
  {
    id: "getExport.shape",
    title: "every format of a trip and a place parses as ExportFile",
    method: "getExport",
    async run(store, t) {
      for (const format of EXPORT_FORMATS) {
        for (const [type, slug] of [["place", t.facts.exportPlace], ["trip", t.facts.tripSlug]] as const) {
          const f = expectOk(await store.getExport({ type, slug, format }), `${type} ${format}`);
          expect(exportFile.safeParse(f).success, `${type} ${format}`).toBe(true);
        }
      }
    },
  },
];
