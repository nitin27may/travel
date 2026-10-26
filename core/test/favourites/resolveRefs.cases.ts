// resolveRefs contract cases (visitor spec 12, "Contract kit" row): current, retired, merged, withdrawn, unknown, an alias, 49 refs is
// too_large. Written over the facts the catalogue contract kit already names (kit.ts ContractFacts: placeSlug, tripSlug, retired, merged,
// withdrawn, former), so FAV-1 runs the same table against JsonStore by adding `resolveRefs` to its targets; here it runs against the
// fixture's fake store.
import { expect } from "vitest";
import type { Result } from "../../src/catalogue/result.ts";
import type { ResolveRefsMethod } from "../../src/favourites/resolve.ts";
import { privacyHits } from "../../src/privacy/detect.ts";
import { RESOLVE_MAX, resolveAnswer, type ResolveAnswer } from "../../src/schema/favourites.ts";

export interface ResolveFacts {
  placeSlug: string;
  tripSlug: string;
  retired?: { from: string; to: string };
  merged?: { from: string; to: string };
  withdrawn?: string;
  former?: { ref: string; slug: string };
  tripRetired?: { from: string; to: string };
}

export interface ResolveCase {
  id: string;
  title: string;
  run(store: ResolveRefsMethod, facts: ResolveFacts): Promise<void>;
}

function okData(r: Result<ResolveAnswer>): ResolveAnswer {
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}: ${r.error.message}`);
  expect(resolveAnswer.safeParse(r.data).success).toBe(true);
  expect(privacyHits(r.data)).toEqual([]);
  return r.data;
}

export const resolveRefsCases: ResolveCase[] = [
  {
    id: "resolveRefs.current",
    title: "a live place and a live trip answer current with their ref and a light snapshot; by ref too",
    async run(store, f) {
      const a = okData(await store.resolveRefs({ refs: [`place:${f.placeSlug}`, `trip:${f.tripSlug}`] }));
      expect(a.items.map((i) => [i.state, i.space, i.slug])).toEqual([
        ["current", "place", f.placeSlug],
        ["current", "trip", f.tripSlug],
      ]);
      for (const i of a.items) {
        expect(i.ref).not.toBeNull();
        expect(i.name).toBeTruthy();
      }
      expect(a.items[1]!.kind).toBeNull();
      const byRef = okData(await store.resolveRefs({ refs: [a.items[0]!.ref!] }));
      expect(byRef.items[0]).toMatchObject({ state: "current", slug: f.placeSlug, ref: a.items[0]!.ref });
    },
  },
  {
    id: "resolveRefs.retired",
    title: "a retired slug answers moved with the current slug (the 308 target)",
    async run(store, f) {
      if (!f.retired) return;
      const a = okData(await store.resolveRefs({ refs: [`place:${f.retired.from}`] }));
      expect(a.items[0]).toMatchObject({ state: "moved", slug: f.retired.to });
      if (f.tripRetired) {
        const t = okData(await store.resolveRefs({ refs: [`trip:${f.tripRetired.from}`] }));
        expect(t.items[0]).toMatchObject({ state: "moved", space: "trip", slug: f.tripRetired.to });
      }
    },
  },
  {
    id: "resolveRefs.merged",
    title: "a merged record's slug answers merged with the survivor's slug and ref",
    async run(store, f) {
      if (!f.merged) return;
      const a = okData(await store.resolveRefs({ refs: [`place:${f.merged.from}`, `place:${f.merged.to}`] }));
      expect(a.items[0]).toMatchObject({ state: "merged", slug: f.merged.to });
      expect(a.items[0]!.ref).toBe(a.items[1]!.ref);
    },
  },
  {
    id: "resolveRefs.withdrawn",
    title: "a withdrawn slug answers withdrawn with no ref and no snapshot",
    async run(store, f) {
      if (!f.withdrawn) return;
      const a = okData(await store.resolveRefs({ refs: [`place:${f.withdrawn}`] }));
      expect(a.items[0]).toMatchObject({ state: "withdrawn", slug: f.withdrawn, ref: null, name: null, kind: null, cc: null });
    },
  },
  {
    id: "resolveRefs.former",
    title: "a ref replaced by alias answers moved with the new ref and the same slug",
    async run(store, f) {
      if (!f.former) return;
      const a = okData(await store.resolveRefs({ refs: [f.former.ref] }));
      expect(a.items[0]).toMatchObject({ state: "moved", slug: f.former.slug });
      expect(a.items[0]!.ref).not.toBe(f.former.ref);
    },
  },
  {
    id: "resolveRefs.unknown",
    title: "an unknown slug or ref answers unknown and names nothing",
    async run(store) {
      const a = okData(await store.resolveRefs({ refs: ["place:no-such-place-zz", "trip:no-such-trip-zz", "route/no-such-route-zz"] }));
      for (const i of a.items) expect(i).toMatchObject({ state: "unknown", slug: null, ref: null, name: null });
      expect(a.items[2]!.space).toBeNull();
    },
  },
  {
    id: "resolveRefs.order",
    title: "one row per asked value, in the order asked, a repeat answering twice",
    async run(store, f) {
      const refs = [`trip:${f.tripSlug}`, `place:${f.placeSlug}`, `trip:${f.tripSlug}`];
      const a = okData(await store.resolveRefs({ refs }));
      expect(a.items.map((i) => i.asked)).toEqual(refs);
    },
  },
  {
    id: "resolveRefs.too_large",
    title: `${RESOLVE_MAX + 1} refs is too_large with details.max; ${RESOLVE_MAX} is fine`,
    async run(store, f) {
      const r = await store.resolveRefs({ refs: Array.from({ length: RESOLVE_MAX + 1 }, () => `place:${f.placeSlug}`) });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe("too_large");
        expect(r.error.details).toEqual({ max: RESOLVE_MAX });
      }
      okData(await store.resolveRefs({ refs: Array.from({ length: RESOLVE_MAX }, () => `place:${f.placeSlug}`) }));
    },
  },
  {
    id: "resolveRefs.invalid",
    title: "an empty list, a private origin key or junk is invalid_input naming the index, never the value",
    async run(store, f) {
      for (const refs of [[], ["loc:abc123"], [`place:${f.placeSlug}`, "proto:x"], ["Moraine Lake"], ["place:Bad_Slug"]] as string[][]) {
        const r = await store.resolveRefs({ refs });
        expect(r.ok, JSON.stringify(refs)).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("invalid_input");
          expect(JSON.stringify(r.error)).not.toMatch(/loc:|proto:|abc123|Moraine|Bad_Slug/);
        }
      }
      const bad = await store.resolveRefs({ refs: [`place:${f.placeSlug}`, "loc:abc123"] });
      if (!bad.ok) expect(bad.error.details).toEqual({ paths: ["refs.1"] });
    },
  },
];
