// The contract kit's store runner (EXECUTION-PLAN 4.6; PHASE-B-START section 6): every case table against every target.
//   stub          StubStore with every layer: the reference, green now
//   stub-before-E StubStore with the phase E layers off: what JsonStore answers until E (K15's not_available branch)
//   json          JsonStore on the real data/: runs in web/tests/api/contract-store.test.ts, because the dataset is built by web code and core
//                 never imports web (API-1b). The same tables, the same runner (contract/run.ts).
// SRV-0 adds a `supabase` target. A pending or not-applicable case is an `it.todo` that names why, so the count is visible.
import { describe, expect, it } from "vitest";
import { StubStore, STUB_ALIASED, STUB_MERGED, STUB_RETIRED, STUB_SOURCES, STUB_TRIP_RETIRED, STUB_WITHDRAWN, stubData } from "../../src/catalogue/stub/index.ts";
import { CONTRACT_TABLES, type ContractFacts, type ContractTarget } from "./contract/index.ts";
import { runContractTargets } from "./contract/run.ts";

const PHASE_E_NEAR = "phase E, N2 (nearby-and-regions.md section 7): near and nearbyForPlace answer not_available until then";

const stubFacts: ContractFacts = {
  placeSlug: "glacier-lake",
  tripSlug: "stub-rockies-loop",
  retired: { from: STUB_RETIRED.from, to: STUB_RETIRED.to },
  merged: { from: STUB_MERGED.slug, to: STUB_MERGED.to },
  withdrawn: STUB_WITHDRAWN.slug,
  former: { ref: STUB_ALIASED.former, slug: STUB_ALIASED.slug },
  tripRetired: { from: STUB_TRIP_RETIRED.from, to: STUB_TRIP_RETIRED.to },
  ambiguousRegion: { alias: "Highlands", cc: "IT" },
  tag: { id: "family", slugs: ["glacier-lake"] },
  approxSlugs: ["black-sand-arch"],
  sortKeyTie: ["place/emerald-pool-ab", "place/emerald-pool-bc"],
  region: { cc: "CA", canonical: "alberta", aliases: ["CA-AB", "AB", "Alberta", "Alta"] },
  near: { token: "place:glacier-lake", unknown: "place:no-such-place-anywhere" },
  town: { id: "ca-ab-canmore", layer: true },
  exportPlace: "glacier-lake",
  registryIds: new Set(STUB_SOURCES.map((s) => s.id)),
  featureId: "ne-range-1",
  pinCountry: "ca",
};

const changed = () => {
  const d = stubData();
  d.places[0]!.row.name = `${d.places[0]!.row.name} (renamed)`;
  return new StubStore({ data: d });
};

const IN_MEMORY = "an in-memory store has no files whose mtime could move it";

export const TARGETS: ContractTarget[] = [
  {
    name: "stub",
    make: () => new StubStore(),
    makeChanged: changed,
    rowReads: (s) => (s as StubStore).rowReads,
    registry: () => stubData().registry,
    facts: stubFacts,
    notApplicable: { "K10.mtime": IN_MEMORY },
  },
  {
    name: "stub-before-E",
    make: () => new StubStore({ layers: { near: false, towns: false, nearby: false } }),
    makeChanged: changed,
    rowReads: (s) => (s as StubStore).rowReads,
    registry: () => stubData().registry,
    facts: { ...stubFacts, town: { id: "ca-ab-canmore", layer: false } },
    pending: Object.fromEntries([...CONTRACT_TABLES.near!, ...CONTRACT_TABLES.nearbyForPlace!].map((c) => [`${c.method}:${c.id}`, PHASE_E_NEAR])),
    notApplicable: { "K10.mtime": IN_MEMORY },
  },
];

runContractTargets(TARGETS);

describe("contract kit bookkeeping", () => {
  it("every start-sheet case K1 to K19 has at least one table entry", () => {
    const ids = new Set(Object.values(CONTRACT_TABLES).flat().map((c) => c.id.split(".")[0]));
    for (let k = 1; k <= 19; k++) expect(ids.has(`K${k}`), `K${k}`).toBe(true);
  });
  it("case ids are unique within a table", () => {
    for (const [table, cases] of Object.entries(CONTRACT_TABLES)) expect(new Set(cases.map((c) => c.id)).size, table).toBe(cases.length);
  });
});
