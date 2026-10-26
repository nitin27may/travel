// resolveRefs on every store (FAV-1W; visitor spec 4.5, 8.2, 12 "Contract kit"). FAV-C's case table
// (core/test/favourites/resolveRefs.cases.ts: current, retired, merged, withdrawn, former, unknown, order, 49 is too_large, invalid) runs
// unchanged on each target's facts, and these cases add what only a real store can show: a page the registry pins but that is not
// public answers exactly like one that never existed, by handle and by ref; the snapshot is the public row's; the answer carries the
// store revision. The `handler` cases run through respond() in web/tests/api/contract.test.ts: the URL codec, the cap before decoding,
// caching by revision, and that `asked` (the request's own string) can never make the detector an oracle.
import { expect } from "vitest";
import { RESOLVE_MAX, resolveAnswer, type ResolveRow } from "../../../src/schema/api/index.ts";
import { resolveRefsCases } from "../../favourites/resolveRefs.cases.ts";
import { homeWord } from "./townGuard.cases.ts";
import { expectError, expectOk, householdHits, type ContractCase, type Planted } from "./kit.ts";

/** Pinned in a planted copy of the registry, with no public row behind them. */
export const HIDDEN: NonNullable<Planted["hidden"]> = {
  place: { key: "place/planted-hidden-place", slug: "planted-hidden-place" },
  trip: { key: "trip/planted-private-trip", slug: "planted-private-trip" },
};

const blank = (r: ResolveRow): ResolveRow => ({ ...r, asked: "" });

type Requester = { request(path: string, init?: { headers?: Record<string, string> }): Promise<{ status: number; headers: Headers; text: string }> };
const requester = (store: unknown): Requester => {
  const r = store as Partial<Requester>;
  if (typeof r.request !== "function") throw new Error("the handler layer needs a store that can make a raw request");
  return r as Requester;
};
const url = (refs: string[], extra = ""): string => `/api/v1/resolve/?${refs.map((r) => `ref=${encodeURIComponent(r)}`).join("&")}${extra}`;

export const resolveRefsContractCases: ContractCase[] = [
  // FAV-C's table, on this target's facts (ContractFacts carries every ResolveFacts key)
  ...resolveRefsCases.map((c): ContractCase => ({ id: c.id, title: c.title, method: "resolveRefs", run: (store, t) => c.run(store, t.facts) })),
  {
    id: "resolveRefs.private",
    title: "a page the registry pins but that is not public answers exactly like one that never existed, by handle and by ref (no oracle)",
    method: "resolveRefs",
    async run(_store, t) {
      if (!t.plant) throw new Error(`${t.name} must plant a hidden page for the privacy case`);
      const store = await t.plant({ hidden: HIDDEN });
      const asked = [
        `place:${HIDDEN.place!.slug}`, "place:never-was-a-place-zz",
        `trip:${HIDDEN.trip!.slug}`, "trip:never-was-a-trip-zz",
        HIDDEN.place!.key, "place/never-was-a-place-zz",
        HIDDEN.trip!.key, "trip/never-was-a-trip-zz",
      ];
      const a = expectOk(await store.resolveRefs({ refs: asked }));
      expect(resolveAnswer.safeParse(a).success).toBe(true);
      for (let i = 0; i < asked.length; i += 2) {
        expect(a.items[i]!.state, asked[i]).toBe("unknown");
        expect(blank(a.items[i]!), asked[i]).toEqual(blank(a.items[i + 1]!));
      }
      // by ref, an unknown names no space (the answer schema: "null for an unknown ref")
      for (const i of [4, 5, 6, 7]) expect(a.items[i]!.space, asked[i]).toBeNull();
      expect(householdHits(a, "resolveRefs.private")).toEqual([]);
    },
  },
  {
    id: "resolveRefs.snapshot",
    title: "a current row's snapshot is its public list row's name, kind and country, and nothing more (P8)",
    method: "resolveRefs",
    async run(store, t) {
      const a = expectOk(await store.resolveRefs({ refs: [`place:${t.facts.placeSlug}`, `trip:${t.facts.tripSlug}`] }));
      const place = expectOk(await store.listPlaces({ ids: [t.facts.placeSlug] })).items[0]!;
      expect(a.items[0]).toMatchObject({ ref: place.ref, name: place.name, kind: place.kind, cc: place.country });
      const trips = expectOk(await store.listTrips({}, { pageSize: 100 })).items;
      const trip = trips.find((r) => r.slug === t.facts.tripSlug)!;
      expect(a.items[1]).toMatchObject({ name: trip.title, kind: null, cc: trip.country || null });
      for (const i of a.items) expect(Object.keys(i).sort()).toEqual(["asked", "cc", "kind", "name", "ref", "slug", "space", "state"]);
    },
  },
  {
    id: "resolveRefs.revision",
    title: "the answer carries the store's revision, and the same refs answer the same rows",
    method: "resolveRefs",
    async run(store, t) {
      const refs = [`place:${t.facts.placeSlug}`, "place:never-was-a-place-zz"];
      const a = await store.resolveRefs({ refs });
      const b = await store.resolveRefs({ refs });
      expect(a.ok && a.revision).toBe(await store.revision());
      expect(a).toEqual(b);
    },
  },
  {
    id: "resolveRefs.http",
    title: "GET /api/v1/resolve: 200 with a public cache and the revision as ETag, 304 on a match, 413 past 48 before decoding, 400 for an unknown key",
    method: "resolveRefs",
    layer: "handler",
    async run(store, t) {
      const r = requester(store);
      const ok = await r.request(url([`place:${t.facts.placeSlug}`, `trip:${t.facts.tripSlug}`]));
      expect(ok.status).toBe(200);
      expect(ok.headers.get("cache-control")).toMatch(/^public, max-age=\d+/);
      const etag = ok.headers.get("etag")!;
      expect(etag).toBe(`"${await store.revision()}"`);
      expect(resolveAnswer.safeParse(JSON.parse(ok.text)).success).toBe(true);
      expect((await r.request(url([`place:${t.facts.placeSlug}`, `trip:${t.facts.tripSlug}`]), { headers: { "if-none-match": etag } })).status).toBe(304);
      const many = await r.request(url(Array.from({ length: RESOLVE_MAX + 1 }, (_, i) => `place:x-${i}`)));
      expect(many.status).toBe(413);
      expect(JSON.parse(many.text).error).toMatchObject({ code: "too_large", details: { max: RESOLVE_MAX } });
      const stray = await r.request(url([`place:${t.facts.placeSlug}`], "&refs=place:x"));
      expect(stray.status).toBe(400);
      expect(JSON.parse(stray.text).error.details).toEqual({ unknown: ["refs"] });
      const none = await r.request("/api/v1/resolve/");
      expect(none.status).toBe(400);
      expect(none.headers.get("cache-control")).toBe("no-store");
    },
  },
  {
    id: "resolveRefs.http.private",
    title: "through respond(), a refused value is never echoed and an asked home-town word answers 200 like any unknown slug (A40: no oracle)",
    method: "resolveRefs",
    layer: "handler",
    async run(store) {
      const r = requester(store);
      const bad = await r.request(url(["place:fine-slug", "loc:abc123"]));
      expect(bad.status).toBe(400);
      expect(bad.text).not.toMatch(/loc:|abc123/);
      expect(JSON.parse(bad.text).error.details).toEqual({ paths: ["refs.1"] });
      // the household's town as a slug the visitor typed: the answer echoes it under `asked` and nowhere else
      const home = await r.request(url([`place:${homeWord}`, `trip:${homeWord}`]));
      const never = await r.request(url(["place:never-was-a-place-zz", "trip:never-was-a-trip-zz"]));
      expect(home.status).toBe(200);
      expect(home.headers.get("cache-control")).toBe(never.headers.get("cache-control"));
      const rows = (x: { text: string }) => (JSON.parse(x.text) as { items: ResolveRow[] }).items.map(blank);
      expect(rows(home)).toEqual(rows(never));
    },
  },
  {
    id: "resolveRefs.invalid.store",
    title: "a store refuses a malformed body as invalid_input, never a throw",
    method: "resolveRefs",
    async run(store) {
      for (const body of [{ refs: [] }, { refs: ["x".repeat(500)] }]) expectError(await store.resolveRefs(body as never), "invalid_input");
    },
  },
];
