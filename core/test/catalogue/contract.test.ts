// The contract kit's store runner (EXECUTION-PLAN 4.6; PHASE-B-START section 6): every case table against every target.
//   stub          StubStore with every layer: the reference, green now
//   stub-before-E StubStore with the phase E layers off: what JsonStore answers until E (K15's not_available branch)
//   json          JsonStore on the real data/: lands in API-1b; every case is todo until then (the tables are its target)
// SRV-0 adds a `supabase` target. A pending or not-applicable case is an `it.todo` that names why, so the count is visible.
import { describe, expect, it } from "vitest";
import { StubStore, STUB_RETIRED, STUB_SOURCES, stubData } from "../../src/catalogue/stub/index.ts";
import { CONTRACT_TABLES, type ContractFacts, type ContractTarget } from "./contract/index.ts";

const PHASE_E_NEAR = "phase E, N2 (nearby-and-regions.md section 7): near and nearbyForPlace answer not_available until then";

const stubFacts: ContractFacts = {
  placeSlug: "glacier-lake",
  tripSlug: "stub-rockies-loop",
  retired: { from: STUB_RETIRED.from, to: STUB_RETIRED.to },
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
    facts: stubFacts,
    notApplicable: { "K10.mtime": IN_MEMORY },
  },
  {
    name: "stub-before-E",
    make: () => new StubStore({ layers: { near: false, towns: false, nearby: false } }),
    makeChanged: changed,
    rowReads: (s) => (s as StubStore).rowReads,
    facts: { ...stubFacts, town: { id: "ca-ab-canmore", layer: false } },
    pending: Object.fromEntries([...CONTRACT_TABLES.near!, ...CONTRACT_TABLES.nearbyForPlace!].map((c) => [`${c.method}:${c.id}`, PHASE_E_NEAR])),
    notApplicable: { "K10.mtime": IN_MEMORY },
  },
  {
    name: "json",
    make: () => {
      throw new Error("JsonStore lands in API-1b");
    },
    facts: stubFacts,
    pending: { "*": "API-1b: JsonStore (core/src/catalogue/json) over the real data/; these tables are its target" },
  },
];

const HANDLER_ONLY = "runs through respond() in web/tests/api/contract.test.ts (API-1b)";

/** Why a case does not run on a target, or null when it runs. */
function notRun(t: ContractTarget, method: string, id: string, layer: string | undefined): string | null {
  if (layer === "handler") return HANDLER_ONLY;
  return t.pending?.["*"] ?? t.pending?.[`${method}:${id}`] ?? t.pending?.[id] ?? t.notApplicable?.[id] ?? null;
}

for (const t of TARGETS) {
  describe(`contract on ${t.name}`, () => {
    for (const [table, cases] of Object.entries(CONTRACT_TABLES)) {
      describe(table, () => {
        for (const c of cases) {
          const why = notRun(t, c.method, c.id, c.layer);
          if (why) it.todo(`${c.id} ${c.title} [not run: ${why}]`);
          else it(`${c.id} ${c.title}`, async () => c.run(await t.make(), t), 60_000);
        }
      });
    }
  });
}

describe("contract kit bookkeeping", () => {
  it("every start-sheet case K1 to K19 has at least one table entry", () => {
    const ids = new Set(Object.values(CONTRACT_TABLES).flat().map((c) => c.id.split(".")[0]));
    for (let k = 1; k <= 19; k++) expect(ids.has(`K${k}`), `K${k}`).toBe(true);
  });
  it("case ids are unique within a table", () => {
    for (const [table, cases] of Object.entries(CONTRACT_TABLES)) expect(new Set(cases.map((c) => c.id)).size, table).toBe(cases.length);
  });
});
