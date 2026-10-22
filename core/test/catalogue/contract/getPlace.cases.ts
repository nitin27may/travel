// getPlace: K8 ref, K9 retired slug, K12 registry ids, K13 Val enums, K16 points, plus shape and not_found.
import { expect } from "vitest";
import { API_LIMITS, PLACE_ROW_KEYS, collectVals, placeDetail, placeLookup, provenanceProblems, type PlaceDetail, type PlaceRow } from "../../../src/schema/api/index.ts";
import type { CatalogueStore } from "../../../src/catalogue/store.ts";
import { resolveRef } from "../../../src/catalogue/slugs.ts";
import { allRows, expectError, expectOk, type ContractCase } from "./kit.ts";

/** Every place detail the store serves, through its own list. */
export async function everyDetail(store: CatalogueStore): Promise<PlaceDetail[]> {
  const rows = await allRows<PlaceRow>((n) => store.listPlaces({}, { page: n, pageSize: API_LIMITS.pageSize.max }));
  const out: PlaceDetail[] = [];
  for (const r of rows) {
    const got = expectOk(await store.getPlace(r.slug), r.slug);
    if ("moved" in got) throw new Error(`${r.slug}: a listed slug answered moved`);
    out.push(got);
  }
  return out;
}

export const getPlaceCases: ContractCase[] = [
  {
    id: "getPlace.shape",
    title: "every listed place parses as PlaceDetail",
    method: "getPlace",
    async run(store) {
      for (const d of await everyDetail(store)) {
        const r = placeDetail.safeParse(d);
        expect(r.success, `${d.slug}: ${r.success ? "" : r.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`).toBe(true);
      }
    },
  },
  {
    id: "getPlace.unknown",
    title: "an unknown slug is not_found; a malformed one is invalid_input",
    method: "getPlace",
    async run(store) {
      expectError(await store.getPlace("no-such-place-anywhere"), "not_found");
      expectError(await store.getPlace("Not A Slug"), "invalid_input");
      expectError(await store.getPlace("a,b"), "invalid_input");
    },
  },
  {
    id: "K8",
    title: "a detail carries the same ref as its row, and the same slug on two loads",
    method: "getPlace",
    async run(store, t) {
      const rows = await allRows<PlaceRow>((n) => store.listPlaces({}, { page: n, pageSize: API_LIMITS.pageSize.max }));
      const other = await t.make();
      for (const r of rows) {
        const d = expectOk(await store.getPlace(r.slug));
        expect("ref" in d && d.ref, r.slug).toBe(r.ref);
        const again = expectOk(await other.getPlace(r.slug));
        expect("ref" in again && again.ref, r.slug).toBe(r.ref);
      }
      expect(PLACE_ROW_KEYS).toContain("ref");
    },
  },
  {
    id: "K9",
    title: "a retired slug answers moved with the current slug (the handler answers 308)",
    method: "getPlace",
    async run(store, t) {
      const retired = t.facts.retired!;
      const got = expectOk(await store.getPlace(retired.from));
      expect(placeLookup.safeParse(got).success).toBe(true);
      expect(got).toMatchObject({ moved: retired.to });
      const now = expectOk(await store.getPlace(retired.to));
      expect("slug" in now && now.slug).toBe(retired.to);
      expect("ref" in got && got.ref).toBe("ref" in now ? now.ref : null);
    },
  },
  {
    id: "K9.merged",
    title: "the slug of a merged record answers moved with the survivor's slug (R-1)",
    method: "getPlace",
    async run(store, t) {
      const m = t.facts.merged!;
      expect(expectOk(await store.getPlace(m.from))).toMatchObject({ moved: m.to });
    },
  },
  {
    id: "K9.withdrawn",
    title: "a withdrawn slug answers not_found (R-3)",
    method: "getPlace",
    async run(store, t) {
      expectError(await store.getPlace(t.facts.withdrawn!), "not_found");
    },
  },
  {
    id: "K8.former",
    title: "a ref replaced by alias still resolves to the same page (R-2)",
    method: "getPlace",
    async run(store, t) {
      const { ref, slug } = t.facts.former!;
      expect(t.registry, "the target must expose its registry").toBeDefined();
      const now = resolveRef(t.registry!(), ref);
      expect(now?.slug).toBe(slug);
      const d = expectOk(await store.getPlace(slug));
      expect("ref" in d && d.ref).toBe(now?.key);
    },
  },
  {
    id: "K12",
    title: "every src in a detail is a source registry id, and the check catches one that is not",
    method: "getPlace",
    async run(store, t) {
      const details = await everyDetail(store);
      const problems = details.flatMap((d) => provenanceProblems(d, t.facts.registryIds).map((p) => `${d.slug} ${p}`));
      expect(problems).toEqual([]);
      for (const d of details) {
        for (const id of Object.keys(d.citations)) expect(d.citations[id]!.id).toBe(id);
        // every src a detail cites resolves inside that detail (R-10)
        const cited = collectVals(d).flatMap(({ val }) => [...((val.src as string[]) ?? []), ...(((val.conflicts as { src: string[] }[] | undefined) ?? []).flatMap((c) => c.src))]);
        const relSrc = d.relevance?.provenance?.src ?? [];
        for (const id of [...cited, ...relSrc]) expect(d.citations, `${d.slug} cites ${id}`).toHaveProperty([id]);
      }
      // the check is live: a detail citing an id the registry does not hold fails it
      const withVal = details.find((d) => collectVals(d).length > 0) ?? details[0]!;
      const doctored = { ...withVal, citations: { ...withVal.citations, "s-ffffffffff": { id: "s-ffffffffff", url: "x", title: "", publisher: "", kind: "x", read: null } } };
      expect(provenanceProblems(doctored, t.facts.registryIds).length).toBeGreaterThan(0);
    },
  },
  {
    id: "K13",
    title: "every value in a detail parses as apiVal: its state and basis are in the enums",
    method: "getPlace",
    async run(store) {
      const vals = (await everyDetail(store)).flatMap((d) => collectVals(d).map((v) => ({ ...v, slug: d.slug })));
      expect(vals.length, "the data holds sourced values").toBeGreaterThan(0);
      // provenanceProblems with every id allowed reports shape and enum problems only
      const ids = new Set(vals.flatMap((v) => [...((v.val.src as string[] | undefined) ?? []), ...(((v.val.conflicts as { src: string[] }[] | undefined) ?? []).flatMap((c) => c.src))]));
      for (const v of vals) expect(provenanceProblems(v.val, ids), `${v.slug} ${v.path}`).toEqual([]);
    },
  },
  {
    id: "K16",
    title: "every detail point carries pointRole (a role or null) and approx (true only where marked)",
    method: "getPlace",
    async run(store, t) {
      const approx = new Set(t.facts.approxSlugs);
      for (const d of await everyDetail(store)) {
        const points = [d.point, d.access?.trailhead ?? null, ...(d.access?.parking ?? [])].filter((p) => p !== null);
        for (const p of points) {
          expect(p, d.slug).toHaveProperty("pointRole");
          expect(typeof p.approx, d.slug).toBe("boolean");
        }
        if (d.point) expect(d.point.approx, d.slug).toBe(approx.has(d.slug));
      }
    },
  },
];
