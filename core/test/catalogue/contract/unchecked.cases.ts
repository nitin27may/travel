// "Not checked yet" rows (D-E7, store.ts A27): K23. listUnchecked lists exactly the rows a gap keeps out of the list, paged and capped.
import { expect } from "vitest";
import { API_LIMITS, PLACE_ROW_KEYS, uncheckedPage, uncheckedRow, type PlaceQuery, type PlaceRow, type UncheckedRow } from "../../../src/schema/api/index.ts";
import { SKELETON, allRows, expectError, expectOk, type ContractCase, type ContractTarget } from "./kit.ts";
import type { CatalogueStore } from "../../../src/catalogue/store.ts";

/** A selection that leaves rows "not checked yet": the target's fact, or the first key with gaps and its first option. */
async function gapQuery(store: CatalogueStore, t: ContractTarget): Promise<PlaceQuery | null> {
  if (t.facts.gap) return { facets: { [t.facts.gap.key]: [t.facts.gap.value] } };
  const all = expectOk(await store.countPlaces({}));
  for (const [key, n] of Object.entries(all.gaps)) {
    const option = all.facets[key]?.find((o) => o.count > 0);
    if (n > 0 && option) return { facets: { [key]: [option.value] } };
  }
  return null;
}

export const uncheckedCases: ContractCase[] = [
  {
    id: "K23",
    title: "listUnchecked holds only rows whose value for the selected key is a gap, none of them in the list; total = countPlaces' unchecked = the groups' sum",
    method: "listUnchecked",
    awaits: { step: "API-3b step 11 (K23: listUnchecked)", failsWith: SKELETON },
    async run(store, t) {
      const q = await gapQuery(store, t);
      expect(q, "the target has a key with gaps (set facts.gap)").not.toBeNull();
      const key = Object.keys(q!.facets!)[0]!;
      const first = expectOk(await store.listUnchecked(q!));
      expect(uncheckedPage.safeParse(first).success).toBe(true);
      expect(first.total).toBeGreaterThan(0);
      expect(first.total).toBe(expectOk(await store.countPlaces(q!)).unchecked);
      expect(first.groups.reduce((n, g) => n + g.count, 0)).toBe(first.total);
      expect(first.groups.map((g) => g.key)).toEqual([key]);
      const rows = await allRows<UncheckedRow>((n) => store.listUnchecked(q!, { page: n, pageSize: API_LIMITS.pageSize.max }));
      expect(rows.length).toBe(first.total);
      const listed = new Set((await allRows<PlaceRow>((n) => store.listPlaces(q!, { page: n, pageSize: API_LIMITS.pageSize.max }))).map((r) => r.ref));
      for (const r of rows) {
        expect(Object.keys(r).sort(), r.slug).toEqual([...PLACE_ROW_KEYS, "gap"].sort());
        expect(uncheckedRow.safeParse(r).success, r.slug).toBe(true);
        expect(r.gap).toBe(key);
        expect(listed.has(r.ref), `${r.slug} is both listed and unchecked`).toBe(false);
      }
      expect(new Set(rows.map((r) => r.ref)).size, "a row appears once").toBe(rows.length);
      // `only` with a key the query does not select lists nothing
      expect(expectOk(await store.listUnchecked({ ...q!, only: ["country"] })).total).toBe(0);
    },
  },
  {
    id: "K23.caps",
    title: "listUnchecked pages like any list: pageSize above the cap is too_large, a bad key is invalid_input, no selection is an empty page",
    method: "listUnchecked",
    awaits: { step: "API-3b step 11 (K23: listUnchecked)", failsWith: SKELETON },
    async run(store) {
      expectError(await store.listUnchecked({}, { pageSize: API_LIMITS.pageSize.max + 1 }), "too_large");
      expectError(await store.listUnchecked({ only: ["not a key"] }), "invalid_input");
      const none = expectOk(await store.listUnchecked({}));
      expect(none.total).toBe(0);
      expect(none.items).toEqual([]);
      expect(none.groups).toEqual([]);
    },
  },
];
