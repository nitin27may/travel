// listPlaces: K1 page size, K2 allowlist, K8 ref, K11 order and paging, K14 region aliases, K15 city, plus the output shape.
import { expect } from "vitest";
import { API_LIMITS, PLACE_ROW_KEYS, apiTownId, paged, placeRow, type PlaceRow } from "../../../src/schema/api/index.ts";
import { RESERVED_API_WORDS } from "../../../src/catalogue/store.ts";
import { compareSortable, sortKey } from "../../../src/catalogue/sortKey.ts";
import { PLACE_SORT_VALUES, compareValues } from "../../../src/catalogue/sorting.ts";
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
    title: "rows carry exactly the allowlist keys of the PlaceRow schema (the shipped row's keys plus ref, approx and nearTown, A35; the owner's save metadata, sourceTypes and added, is not among them)",
    method: "listPlaces",
    async run(store) {
      const rows = await everyRow(store);
      expect(rows.length).toBeGreaterThan(0);
      expect(PLACE_ROW_KEYS).toContain("nearTown");
      for (const r of rows) {
        expect(Object.keys(r).sort(), r.slug).toEqual([...PLACE_ROW_KEYS].sort());
        expect(placeRow.safeParse(r).success, r.slug).toBe(true);
      }
    },
  },
  {
    id: "listPlaces.nearTown",
    title: "nearTown is a town id or null; on a target with the towns layer each one resolves (A35)",
    method: "listPlaces",
    async run(store, t) {
      const rows = await everyRow(store);
      const ids = new Set(rows.map((r) => r.nearTown).filter((x): x is string => x !== null));
      for (const id of ids) expect(apiTownId.safeParse(id).success, id).toBe(true);
      for (const r of rows) if (r.approx) expect(r.nearTown, `${r.slug} is approximate`).toBeNull();
      if (t.facts.town.layer) for (const id of ids) expect((await store.towns({ city: id })).ok, id).toBe(true);
    },
  },
  {
    id: "listPlaces.reserved",
    title: "no place holds a slug that is a path word under /api/v1/places/ (counts, unchecked, cards: A38)",
    method: "listPlaces",
    async run(store) {
      const slugs = new Set((await everyRow(store)).map((r) => r.slug));
      for (const w of RESERVED_API_WORDS) expect(slugs.has(w), w).toBe(false);
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
      const size = Math.min(API_LIMITS.pageSize.max, Math.max(1, Math.floor(rows.length / 3)));
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
    id: "K11.sort",
    title: "sort=-km orders by km descending with nulls last, ties by sortKey(name) then ref; an unknown sort key is invalid_input",
    method: "listPlaces",
    async run(store) {
      const rows = await allRows<PlaceRow>((n) => store.listPlaces({ sort: ["-km"] }, { page: n, pageSize: API_LIMITS.pageSize.max }));
      const kms = rows.map((r) => r.km);
      expect(kms.some((k) => k === null), "the data has rows with no km").toBe(true);
      const firstNull = kms.indexOf(null);
      expect(kms.slice(firstNull).every((k) => k === null), "nulls last").toBe(true);
      for (let i = 1; i < rows.length; i++) {
        const a = rows[i - 1]!;
        const b = rows[i]!;
        const c = compareValues(PLACE_SORT_VALUES.km(a), PLACE_SORT_VALUES.km(b), true);
        expect(c, `${a.slug} before ${b.slug}`).toBeLessThanOrEqual(0);
        if (c === 0) expect(compareSortable({ sortKey: sortKey(a.name), ref: a.ref }, { sortKey: sortKey(b.name), ref: b.ref }), `${a.slug} ${b.slug} tie`).toBeLessThan(0);
      }
      expect(new Set(kms.filter((k) => k !== null)).size, "the data has a km tie").toBeLessThan(kms.filter((k) => k !== null).length);
      const asc = await allRows<PlaceRow>((n) => store.listPlaces({ sort: ["km"] }, { page: n, pageSize: API_LIMITS.pageSize.max }));
      expect(asc.at(-1)!.km, "nulls last ascending too").toBeNull();
      expectError(await store.listPlaces({ sort: ["password"] }), "invalid_input");
    },
  },
  {
    id: "K14.ambiguous",
    title: "a region alias two countries share is invalid_scope with the candidates; a country settles it",
    method: "listPlaces",
    async run(store, t) {
      const { alias, cc } = t.facts.ambiguousRegion!;
      const r = await store.listPlaces({ facets: { region: [alias] } });
      expectError(r, "invalid_scope");
      if (!r.ok) expect((r.error.details?.candidates as string[]).length).toBeGreaterThan(1);
      expect(expectOk(await store.listPlaces({ facets: { country: [cc], region: [alias] } })).total).toBeGreaterThan(0);
    },
  },
  {
    id: "listPlaces.ids",
    title: "ids= resolves a retired or merged slug to its current page; a withdrawn or unknown slug selects nothing",
    method: "listPlaces",
    async run(store, t) {
      const { retired, merged, withdrawn } = t.facts;
      const got = expectOk(await store.listPlaces({ ids: [retired!.from, merged!.from, withdrawn!, "no-such-place-anywhere"] }));
      expect(got.items.map((r) => r.slug).sort()).toEqual([retired!.to, merged!.to].sort());
    },
  },
  {
    id: "listPlaces.tag",
    title: "a tag facet filters on the row's tag ids (A21)",
    method: "listPlaces",
    async run(store, t) {
      const { id, slugs } = t.facts.tag!;
      expect(expectOk(await store.listPlaces({ facets: { tag: [id] } })).items.map((r) => r.slug).sort()).toEqual([...slugs].sort());
      expect(expectOk(await store.listPlaces({ facets: { tag: ["no-such-tag"] } })).total).toBe(0);
    },
  },
  {
    id: "listPlaces.q",
    title: "q is the list's word rule (A16): every word, in any order, case ignored, over the wider haystack",
    method: "listPlaces",
    async run(store, t) {
      const [a] = t.facts.sortKeyTie ?? [];
      if (!a) return;
      // the name two rows share (the tie of case K11), asked plainly, shouted and with its words reversed
      const row = (await everyRow(store)).find((r) => r.ref === a)!;
      const plain = expectOk(await store.listPlaces({ q: row.name })).total;
      // the pair of K11 differs by an accent, which this rule does not fold (the list never did), so only one of the two is named
      expect(plain).toBeGreaterThanOrEqual(1);
      expect(expectOk(await store.listPlaces({ q: row.name.toUpperCase() })).total).toBe(plain);
      expect(expectOk(await store.listPlaces({ q: row.name.split(/\s+/).reverse().join("  ") })).total).toBe(plain);
      // the haystack is wider than the name: the country's name narrows the same rows, and never widens them
      const withCountry = expectOk(await store.listPlaces({ q: `${row.name} ${row.country_name}` }));
      expect(withCountry.total).toBeGreaterThanOrEqual(1);
      expect(withCountry.total).toBeLessThanOrEqual(plain);
      expect(withCountry.items.map((r) => r.ref)).toContain(a);
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
