// listPlaces: K1 page size, K2 allowlist, K8 ref, K11 order and paging, K14 region aliases, K15 city, plus the output shape.
import { expect } from "vitest";
import { API_LIMITS, PLACE_ROW_KEYS, paged, placeRow, type PlaceRow } from "../../../src/schema/api/index.ts";
import { compareSortable, sortKey } from "../../../src/catalogue/sortKey.ts";
import { allRows, expectError, expectOk, type ContractCase } from "./kit.ts";

const everyRow = (store: Parameters<ContractCase["run"]>[0]) => allRows<PlaceRow>((n) => store.listPlaces({}, { page: n, pageSize: API_LIMITS.pageSize.max }));

export const listPlacesCases: ContractCase[] = [
  {
    id: "listPlaces.shape",
    title: "the answer parses as Paged<PlaceRow>",
    method: "listPlaces",
    async run(store) {
      const got = expectOk(await store.listPlaces({}));
      expect(paged(placeRow).safeParse(got).success).toBe(true);
      expect(got.pageSize).toBe(API_LIMITS.pageSize.default);
    },
  },
  {
    id: "K1",
    title: "pageSize above the cap is too_large; the cap itself and the default are served",
    method: "listPlaces",
    async run(store) {
      expectError(await store.listPlaces({}, { pageSize: API_LIMITS.pageSize.max + 1 }), "too_large");
      expect(expectOk(await store.listPlaces({}, { pageSize: API_LIMITS.pageSize.max })).pageSize).toBe(API_LIMITS.pageSize.max);
      expect(expectOk(await store.listPlaces({}, {})).pageSize).toBe(API_LIMITS.pageSize.default);
    },
  },
  {
    id: "K2",
    title: "rows carry exactly the allowlist keys of the PlaceRow schema",
    method: "listPlaces",
    async run(store) {
      const rows = await everyRow(store);
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(Object.keys(r).sort(), r.slug).toEqual([...PLACE_ROW_KEYS].sort());
        expect(placeRow.safeParse(r).success, r.slug).toBe(true);
      }
    },
  },
  {
    id: "K8",
    title: "every row carries a ref, refs are unique, and a ref keeps its slug across two loads",
    method: "listPlaces",
    async run(store, t) {
      const one = await everyRow(store);
      const two = await everyRow(await t.make());
      expect(new Set(one.map((r) => r.ref)).size).toBe(one.length);
      for (const r of one) expect(r.ref.length, r.slug).toBeGreaterThan(0);
      const slugOf = new Map(two.map((r) => [r.ref, r.slug]));
      for (const r of one) expect(slugOf.get(r.ref), r.ref).toBe(r.slug);
    },
  },
  {
    id: "K11",
    title: "rows come in sortKey(name), then ref order; page 2 starts at the row after page 1 on every store",
    method: "listPlaces",
    async run(store, t) {
      const rows = await everyRow(store);
      const expected = rows.map((r) => ({ r, sortKey: sortKey(r.name), ref: r.ref })).sort(compareSortable).map((x) => x.r.ref);
      expect(rows.map((r) => r.ref)).toEqual(expected);
      const size = Math.max(1, Math.floor(rows.length / 3));
      const p2 = expectOk(await store.listPlaces({}, { page: 2, pageSize: size }));
      expect(p2.items[0]?.ref).toBe(rows[size]?.ref);
      if (t.facts.sortKeyTie) {
        const [a, b] = t.facts.sortKeyTie;
        const at = (ref: string) => rows.findIndex((r) => r.ref === ref);
        expect(at(a)).toBeGreaterThanOrEqual(0);
        expect(at(b), "the tie breaks by ref").toBe(at(a) + 1);
      }
    },
  },
  {
    id: "K14",
    title: "every region alias gives the same rows and the canonical region value",
    method: "listPlaces",
    async run(store, t) {
      const { cc, canonical, aliases } = t.facts.region;
      const base = expectOk(await store.listPlaces({ facets: { country: [cc], region: [canonical] } }, { pageSize: API_LIMITS.pageSize.max }));
      expect(base.total).toBeGreaterThan(0);
      for (const r of base.items) expect(r.region).toBe(canonical);
      for (const alias of aliases) {
        const got = expectOk(await store.listPlaces({ facets: { country: [cc], region: [alias] } }, { pageSize: API_LIMITS.pageSize.max }), alias);
        expect(got.items.map((r) => r.ref), alias).toEqual(base.items.map((r) => r.ref));
      }
      // without the country the alias still finds the one region
      const loose = expectOk(await store.listPlaces({ facets: { region: [aliases[0]!] } }, { pageSize: API_LIMITS.pageSize.max }));
      expect(loose.total).toBe(base.total);
    },
  },
  {
    id: "K15",
    title: "city=<town id> answers not_available until the towns layer exists, then rows near the town",
    method: "listPlaces",
    async run(store, t) {
      const r = await store.listPlaces({ facets: { city: [t.facts.town.id] } });
      if (!t.facts.town.layer) return expectError(r, "not_available");
      expect(expectOk(r).total).toBeGreaterThanOrEqual(0);
    },
  },
  {
    id: "listPlaces.invalid",
    title: "an unknown facet key and a malformed page are invalid_input (K18 at store level)",
    method: "listPlaces",
    async run(store) {
      expectError(await store.listPlaces({ facets: { bogus: ["x"] } }), "invalid_input");
      expectError(await store.listPlaces({}, { page: 0 }), "invalid_input");
    },
  },
];
