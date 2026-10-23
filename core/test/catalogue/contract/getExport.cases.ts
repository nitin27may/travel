// getExport: K6 one item per export, the licence guard, the shape.
import { expect } from "vitest";
import { API_LIMITS, EXPORT_FORMATS, exportFile, type PlaceRow } from "../../../src/schema/api/index.ts";
import { allRows, expectError, expectOk, okOrSkeleton, type ContractCase } from "./kit.ts";

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
      // one item (R-21): the file is named for the slug, and no other listed place's name is in it
      const gpx = expectOk(await store.getExport({ type: "place", slug, format: "gpx" }));
      expect(gpx.filename.startsWith(slug)).toBe(true);
      const own = expectOk(await store.getPlace(slug));
      const ownName = "name" in own ? own.name : "";
      const rows = await allRows<PlaceRow>((n) => store.listPlaces({}, { page: n, pageSize: API_LIMITS.pageSize.max }));
      for (const r of rows) if (r.slug !== slug && !ownName.includes(r.name) && !r.name.includes(ownName)) expect(gpx.body, r.name).not.toContain(`>${r.name}<`);
    },
  },
  {
    id: "getExport.shape",
    title: "every format of a trip and a place parses as ExportFile",
    method: "getExport",
    async run(store, t) {
      for (const format of EXPORT_FORMATS) {
        for (const [type, slug] of [["place", t.facts.exportPlace], ["trip", t.facts.tripSlug]] as const) {
          // `json` is the API-3b skeleton until K20 lands; every other format must answer
          const f = okOrSkeleton(await store.getExport({ type, slug, format }), `${type} ${format}`);
          if (f === null && format !== "json") throw new Error(`${type} ${format} answered the skeleton`);
          if (f) expect(exportFile.safeParse(f).success, `${type} ${format}`).toBe(true);
        }
      }
    },
  },
];
