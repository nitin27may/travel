// PRIV-TD (BACKLOG 15.328, R-257, owner Q308): no public trip payload carries a status computed from the household's real trip
// dates. `isDone` left TripRow and TripDetail, the detector refuses the key anywhere in a public payload, and the stub fixture and the
// OpenAPI document no longer name it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { StubStore } from "../../src/catalogue/stub/index.ts";
import { privacyHits } from "../../src/privacy/detect.ts";
import * as S from "../../src/schema/api/index.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");

function keys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keys(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.add(k); keys(x, out); }
  return out;
}

describe("the public trip contract carries no household-derived status (PRIV-TD)", () => {
  it("TripRow and TripDetail have no isDone key, and a row or detail that adds one is refused", async () => {
    expect(S.TRIP_ROW_KEYS).not.toContain("isDone");
    expect(Object.keys(S.tripDetail.shape)).not.toContain("isDone");
    const store = new StubStore();
    const list = await store.listTrips({});
    expect(list.ok).toBe(true);
    const row = (list as { data: S.Paged<S.TripRow> }).data.items[0]!;
    expect(S.tripRow.safeParse(row).success).toBe(true);
    expect(S.tripRow.safeParse({ ...row, isDone: true }).success).toBe(false);
    const detail = await store.getTrip(row.slug);
    expect(detail.ok).toBe(true);
    const body = (detail as { data: S.TripDetail }).data;
    expect(S.tripDetail.safeParse(body).success).toBe(true);
    expect(S.tripDetail.safeParse({ ...body, isDone: false }).success).toBe(false);
  });

  it("no stub payload holds the key at any depth", async () => {
    const store = new StubStore();
    const list = (await store.listTrips({})) as { data: S.Paged<S.TripRow> };
    expect(keys(list.data).has("isDone")).toBe(false);
    for (const r of list.data.items) {
      const d = await store.getTrip(r.slug);
      expect(keys(d).has("isDone"), r.slug).toBe(false);
    }
  });

  it("the detector refuses a planted isDone in a public payload, whatever its value or depth", () => {
    for (const v of [true, false, "yes", 1]) {
      expect(privacyHits({ isDone: v }).map((h) => h.why)).toEqual(["a private key"]);
    }
    const hits = privacyHits({ items: [{ slug: "x", title: "A trip", trip: { isDone: false } }] });
    expect(hits.map((h) => h.where)).toEqual(["$.items[0].trip.isDone"]);
  });

  it("the committed OpenAPI document does not name it", () => {
    const text = readFileSync(join(ROOT, "data", "schema", "generated", "openapi.json"), "utf8");
    expect(text).not.toMatch(/"isDone"/);
  });
});
