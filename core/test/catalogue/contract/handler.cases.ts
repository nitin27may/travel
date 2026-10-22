// K18 and K19: what respond() owns. The status table is checked here; the request-level cases run through the route handlers in
// web/tests/api/contract.test.ts (API-1b), which reads this table, so the store runner lists them as todo.
import { expect } from "vitest";
import { API_ERROR_CODES, API_ERROR_STATUS } from "../../../src/schema/api/index.ts";
import { httpStatus } from "../../../src/catalogue/result.ts";
import { expectError, type ContractCase } from "./kit.ts";

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
    title: "an invalid request answers 400 invalid_input with the ApiError shape (through respond())",
    method: "handler",
    layer: "handler",
    async run() {},
  },
  {
    id: "K19",
    title: "If-None-Match with the current revision answers 304 (through respond())",
    method: "handler",
    layer: "handler",
    async run() {},
  },
];
