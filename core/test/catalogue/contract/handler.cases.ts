// K18 and K19: what respond() owns. The status table is checked here; the request-level cases run through the route handlers in
// web/tests/api/contract.test.ts (API-1b), which reads this table, so the store runner lists them as todo.
import { expect } from "vitest";
import { API_ERROR_CODES, API_ERROR_STATUS, apiError } from "../../../src/schema/api/index.ts";
import { httpStatus } from "../../../src/catalogue/result.ts";
import { expectError, type ContractCase } from "./kit.ts";

/** What the web runner's store offers the handler-layer cases: a raw request through respond(). */
type Requester = { request(path: string, init?: { headers?: Record<string, string> }): Promise<{ status: number; headers: Headers; text: string }> };
const requester = (store: unknown): Requester => {
  const r = store as Partial<Requester>;
  if (typeof r.request !== "function") throw new Error("the handler layer needs a store that can make a raw request");
  return r as Requester;
};

export const handlerCases: ContractCase[] = [
  {
    id: "K18.status",
    title: "each ApiError code maps to its HTTP status: 400, 400, 404, 413, 501, 500",
    method: "all",
    async run() {
      expect(API_ERROR_CODES.map(httpStatus)).toEqual([400, 400, 404, 413, 501, 500]);
      expect(Object.keys(API_ERROR_STATUS).sort()).toEqual([...API_ERROR_CODES].sort());
    },
  },
  {
    id: "K18.store",
    title: "every method answers invalid_input for a malformed input, before reading data",
    method: "all",
    async run(store) {
      const bad = "Bad Slug!";
      expectError(await store.listPlaces({ facets: { "no such key": ["x"] } }), "invalid_input", "listPlaces");
      expectError(await store.countPlaces({ q: "x".repeat(10_000) }), "invalid_input", "countPlaces");
      expectError(await store.getPlace(bad), "invalid_input", "getPlace");
      expectError(await store.listTrips({ sort: ["DROP TABLE"] }), "invalid_input", "listTrips");
      expectError(await store.getTrip(bad), "invalid_input", "getTrip");
      expectError(await store.search({ q: "x", limit: 0 }), "invalid_input", "search");
      expectError(await store.getExport({ type: "place", slug: bad, format: "gpx" }), "invalid_input", "getExport");
      expectError(await store.globePins("Canada"), "invalid_input", "globePins");
      expectError(await store.globeCard("place:Bad Slug!"), "invalid_input", "globeCard");
      expectError(await store.globeFeature("../etc/passwd"), "invalid_input", "globeFeature");
      expectError(await store.report({ page: "not a path" }), "invalid_input", "report");
    },
  },
  {
    id: "K18",
    title: "an invalid request answers 400 invalid_input with the ApiError shape; an oversized page answers 413 (through respond())",
    method: "handler",
    layer: "handler",
    async run(store) {
      const { request } = requester(store);
      const bad = await request("/api/v1/places/?bogus=1");
      expect(bad.status).toBe(400);
      expect(apiError.safeParse(JSON.parse(bad.text).error).success).toBe(true);
      expect(JSON.parse(bad.text).error.code).toBe("invalid_input");
      expect((await request("/api/v1/places/?pageSize=101")).status).toBe(413);
      expect((await request("/api/v1/places/no-such-place-anywhere/")).status).toBe(404);
      expect((await request("/api/v1/near/?near=place:x")).status).toBe(501);
      expect(bad.headers.get("cache-control")).toBe("no-store");
    },
  },
  {
    id: "K19",
    title: "If-None-Match with the current revision answers 304 with no body; another revision answers 200 (through respond())",
    method: "handler",
    layer: "handler",
    async run(store) {
      const { request } = requester(store);
      for (const path of ["/api/v1/places/", "/api/v1/trips/", "/api/v1/globe/tree/"]) {
        const first = await request(path);
        expect(first.status, path).toBe(200);
        const etag = first.headers.get("etag")!;
        expect(etag, path).toMatch(/^"[0-9a-f]{64}"$/);
        const again = await request(path, { headers: { "if-none-match": etag } });
        expect(again.status, path).toBe(304);
        expect(again.text, path).toBe("");
        expect((await request(path, { headers: { "if-none-match": `"${"0".repeat(64)}"` } })).status, path).toBe(200);
        expect((await request(path, { headers: { "if-none-match": `W/${etag}, "other"` } })).status, path).toBe(304);
      }
    },
  },
];
