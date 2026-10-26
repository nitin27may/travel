import { describe, expect, it } from "vitest";
import { z } from "zod";
import { memoryStorage, probeStorage, type StorageLike } from "../../src/schema/copies.ts";
import {
  addFavourite,
  applyResolution,
  handleOf,
  isFavourite,
  markNoteSeen,
  noticeDue,
  parseFavourites,
  parseHandle,
  readFavourites,
  removeFavourite,
  restoreFavourite,
  snoozeNotice,
  writeFavourites,
} from "../../src/favourites/envelope.ts";
import { resolveOne } from "../../src/favourites/resolve.ts";
import { PRIVATE_KEYS, privacyHits } from "../../src/privacy/detect.ts";
import {
  emptyFavourites,
  FAV_LOCAL_KEY,
  favItem,
  FAVOURITES_CAP,
  favouritesEnvelope,
  mergeAnswer,
  mergeInput,
  resolveAnswer,
  type FavItem,
  type FavouritesEnvelope,
} from "../../src/schema/favourites.ts";
import { INDEX, light } from "./fixture.ts";

const NOW = new Date("2026-10-25T14:02:11Z");
const later = (min: number) => new Date(NOW.getTime() + min * 60_000);

function must(r: ReturnType<typeof addFavourite>): FavouritesEnvelope {
  if (!r.ok) throw new Error(r.reason);
  return r.envelope;
}

/** An envelope with n place favourites, one a minute apart, newest first. */
function filled(n: number): FavouritesEnvelope {
  let env = emptyFavourites();
  for (let i = 0; i < n; i++) env = must(addFavourite(env, { space: "place", slug: `place-${i}` }, { now: later(i) }));
  return env;
}

function spyStorage(opts: { quota?: boolean; dropWrites?: boolean } = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem(k, v) {
      if (opts.quota) throw Object.assign(new Error("full"), { name: "QuotaExceededError", code: 22 });
      if (!opts.dropWrites) map.set(k, v);
    },
    removeItem: (k) => void map.delete(k),
  };
}

describe("favourites/1 envelope", () => {
  it("exports to JSON Schema (cross-field rules live in favouritesRules)", () => {
    for (const s of [favItem, favouritesEnvelope, resolveAnswer, mergeInput, mergeAnswer])
      expect(() => z.toJSONSchema(s, { target: "draft-2020-12", io: "input", unrepresentable: "throw" })).not.toThrow();
  });

  it("parses the spec's example (visitor spec 4.2), with the tombstone and snooze count fields", () => {
    const ex = {
      schema: "favourites/1",
      items: [{ space: "place", slug: "moraine-lake", ref: "route/moraine-lake", name: "Moraine Lake", kind: "lake", cc: "CA", favouredAt: "2026-10-25T14:02:11Z", unlistedAt: null }],
      noteSeen: "2026-10-25T14:02:11Z",
      snoozedUntil: null,
      snoozedAtCount: null,
      merged: { "3f9a1c0e7b2d4a55": "2026-10-26T09:00:00Z" },
      pending: [],
    };
    expect(parseFavourites(ex).success).toBe(true);
  });

  it("round-trips: add, write, read gives the same envelope", () => {
    const s = memoryStorage();
    const env = must(addFavourite(emptyFavourites(), { space: "place", slug: "moraine-lake", name: "Moraine Lake", kind: "lake", cc: "CA" }, { now: NOW }));
    expect(writeFavourites(s, FAV_LOCAL_KEY, env)).toEqual({ ok: true });
    const back = readFavourites(s.getItem(FAV_LOCAL_KEY));
    expect(back).toEqual({ ok: true, envelope: env, fresh: false });
  });

  it("reads: absent is fresh, junk is corrupt, favourites/2 is newer, a bad shape is invalid; issues never carry a value", () => {
    expect(readFavourites(null)).toMatchObject({ ok: true, fresh: true });
    expect(readFavourites("{not json")).toMatchObject({ ok: false, reason: "corrupt" });
    expect(readFavourites(JSON.stringify({ schema: "favourites/2", items: "whatever" }))).toMatchObject({ ok: false, reason: "newer" });
    const bad = readFavourites(JSON.stringify({ ...emptyFavourites(), items: [{ space: "place", slug: "Secret Name", favouredAt: "x" }] }));
    expect(bad).toMatchObject({ ok: false, reason: "invalid" });
    expect(JSON.stringify(bad)).not.toMatch(/Secret Name/);
  });

  it("refuses a duplicate page, a duplicate ref, a trip with a kind, a private origin key as ref, and over 500 items", () => {
    const a: FavItem = { space: "place", slug: "a", ref: "route/a", name: null, kind: null, cc: null, favouredAt: NOW.toISOString(), unlistedAt: null };
    const dupHandle = { ...emptyFavourites(), items: [a, { ...a, ref: null }] };
    const dupRef = { ...emptyFavourites(), items: [a, { ...a, slug: "b" }] };
    const tripKind = { ...emptyFavourites(), items: [{ ...a, space: "trip", kind: "lake" }] };
    const origin = { ...emptyFavourites(), items: [{ ...a, ref: "place/x loc:abc" }] };
    const many = { ...emptyFavourites(), items: Array.from({ length: FAVOURITES_CAP + 1 }, (_, i) => ({ ...a, slug: `s-${i}`, ref: null })) };
    for (const x of [dupHandle, dupRef, tripKind, origin, many]) expect(parseFavourites(x).success).toBe(false);
    // refs with spaces, colons and hashes are public refs
    expect(parseFavourites({ ...emptyFavourites(), items: [{ ...a, ref: "trip/algonquin/sight:ragged falls" }] }).success).toBe(true);
    expect(parseFavourites({ ...emptyFavourites(), items: [{ ...a, ref: "offer/x#ticket" }] }).success).toBe(true);
  });

  it("a write that fails (quota), is dropped, or is invalid never reports ok", () => {
    const env = filled(1);
    expect(writeFavourites(spyStorage({ quota: true }), FAV_LOCAL_KEY, env)).toEqual({ ok: false, reason: "quota" });
    expect(writeFavourites(spyStorage({ dropWrites: true }), FAV_LOCAL_KEY, env)).toEqual({ ok: false, reason: "unverified" });
    const s = spyStorage();
    expect(writeFavourites(s, FAV_LOCAL_KEY, { ...env, items: [...env.items, env.items[0]!] })).toEqual({ ok: false, reason: "invalid" });
    expect(s.map.size).toBe(0);
  });

  it("shares NAV-C's probe: blocked storage falls back to memory for this tab", () => {
    const p = probeStorage(() => {
      throw new Error("SecurityError");
    });
    expect(p).toMatchObject({ kind: "memory", reason: "blocked" });
    expect(writeFavourites(p.storage, FAV_LOCAL_KEY, filled(2))).toEqual({ ok: true });
  });
});

describe("device mutations", () => {
  it("add: newest first, the first heart asks for the toast once, a second heart on the page is unchanged", () => {
    const a = addFavourite(emptyFavourites(), { space: "place", slug: "moraine-lake" }, { now: NOW });
    expect(a).toMatchObject({ ok: true, unchanged: false, first: true });
    if (!a.ok) return;
    const seen = markNoteSeen(a.envelope, NOW);
    const b = addFavourite(seen, { space: "trip", slug: "dolomites-2027", kind: "lake" }, { now: later(1) });
    expect(b).toMatchObject({ ok: true, unchanged: false, first: false });
    if (!b.ok) return;
    expect(b.item.kind).toBeNull(); // a trip never carries a kind
    expect(b.envelope.items.map(handleOf)).toEqual(["trip:dolomites-2027", "place:moraine-lake"]);
    const again = addFavourite(b.envelope, { space: "place", slug: "moraine-lake" }, { now: later(2) });
    expect(again).toMatchObject({ ok: true, unchanged: true });
    if (again.ok) expect(again.envelope).toBe(b.envelope);
    expect(isFavourite(b.envelope, "place", "moraine-lake")).toBe(true);
    expect(isFavourite(b.envelope, "trip", "moraine-lake")).toBe(false);
  });

  it("add dedupes by ref too: the same page under an old slug is not a second row", () => {
    const env = must(addFavourite(emptyFavourites(), { space: "place", slug: "lake-agnes-teahouse", ref: "place/lake-agnes" }, { now: NOW }));
    expect(addFavourite(env, { space: "place", slug: "lake-agnes", ref: "place/lake-agnes" }, { now: later(1) })).toMatchObject({ ok: true, unchanged: true });
  });

  it("the 501st is cap; a bad slug is invalid", () => {
    const full = filled(FAVOURITES_CAP);
    expect(addFavourite(full, { space: "place", slug: "one-more" }, { now: later(999) })).toEqual({ ok: false, reason: "cap" });
    expect(addFavourite(emptyFavourites(), { space: "place", slug: "Not A Slug" }, { now: NOW })).toMatchObject({ ok: false, reason: "invalid" });
    // 500 favourites with snapshots stay far under every browser quota (spec 4.2: about 75 KB)
    const big = { ...full, items: full.items.map((i) => ({ ...i, ref: `route/${i.slug}`, name: "A place with a fairly long name", kind: "waterfall", cc: "CA" })) };
    expect(JSON.stringify(big).length).toBeLessThan(110_000);
  });

  it("remove returns the row for Undo; restore puts it back in time order, unless hearted again or at the cap", () => {
    const env = filled(3);
    const { envelope, removed } = removeFavourite(env, "place", "place-1");
    expect(removed?.slug).toBe("place-1");
    expect(envelope.items.map((i) => i.slug)).toEqual(["place-2", "place-0"]);
    expect(restoreFavourite(envelope, removed!)).toEqual({ ok: true, envelope: env });
    expect(restoreFavourite(env, removed!).ok).toBe(false);
    expect(removeFavourite(env, "place", "nope")).toEqual({ envelope: env, removed: null });
  });
});

describe("the notice (visitor spec 14: Got it snoozes until 10 more favourites or 30 days)", () => {
  it("shows for a non-empty list, hides when snoozed, returns after 30 days or 10 more", () => {
    expect(noticeDue(emptyFavourites(), NOW)).toBe(false);
    const env = filled(3);
    expect(noticeDue(env, NOW)).toBe(true);
    const snoozed = snoozeNotice(env, NOW);
    expect(noticeDue(snoozed, later(60))).toBe(false);
    expect(noticeDue(snoozed, new Date(NOW.getTime() + 30 * 86_400_000))).toBe(true);
    let more = snoozed;
    for (let i = 0; i < 9; i++) more = must(addFavourite(more, { space: "trip", slug: `t-${i}` }, { now: later(10 + i) }));
    expect(noticeDue(more, later(60))).toBe(false);
    more = must(addFavourite(more, { space: "trip", slug: "t-9" }, { now: later(30) }));
    expect(noticeDue(more, later(60))).toBe(true);
  });
});

describe("applying resolveRefs (visitor spec 4.5)", () => {
  const resolveAll = (env: FavouritesEnvelope) => env.items.map((i) => resolveOne(INDEX, light, handleOf(i)));

  function list(...xs: [string, string][]): FavouritesEnvelope {
    let env = emptyFavourites();
    xs.forEach(([space, slug], i) => (env = must(addFavourite(env, { space: space as "place" | "trip", slug }, { now: later(i) }))));
    return env;
  }

  it("fills snapshots and refs, moves a retired slug, tombstones a withdrawn or unknown page, and is idempotent", () => {
    const env = list(["place", "moraine-lake"], ["place", "lake-agnes"], ["place", "athabasca-icewalk"], ["trip", "private-trip"], ["trip", "dolomites-2027"]);
    const r = applyResolution(env, resolveAll(env), later(100));
    expect(r).toMatchObject({ moved: 1, folded: 0, unlisted: 2, relisted: 0, changed: true });
    const by = Object.fromEntries(r.envelope.items.map((i) => [handleOf(i), i]));
    expect(by["place:moraine-lake"]).toMatchObject({ ref: "route/moraine-lake", name: "Moraine Lake", kind: "lake", cc: "CA", unlistedAt: null });
    expect(by["place:lake-agnes-teahouse"]).toMatchObject({ ref: "place/lake-agnes", name: "Lake Agnes Teahouse" });
    expect(by["place:lake-agnes"]).toBeUndefined();
    // tombstones stay, never removed silently
    expect(by["place:athabasca-icewalk"]?.unlistedAt).toBe(later(100).toISOString());
    expect(by["trip:private-trip"]?.unlistedAt).toBe(later(100).toISOString());
    expect(by["trip:dolomites-2027"]).toMatchObject({ kind: null, cc: "IT" });
    expect(r.envelope.items).toHaveLength(5);
    expect(parseFavourites(r.envelope).success).toBe(true);
    // again, with a fresh resolve of the new list: nothing changes, and the tombstone keeps its first time
    const again = applyResolution(r.envelope, resolveAll(r.envelope), later(200));
    expect(again.changed).toBe(false);
    expect(again.envelope).toBe(r.envelope);
  });

  it("a merged page becomes its survivor, folded into the survivor's row when the list holds it (earlier time kept)", () => {
    const both = list(["place", "lake-louise-gondola"], ["place", "lake-louise-sightseeing"]);
    const r = applyResolution(both, resolveAll(both), later(100));
    expect(r).toMatchObject({ folded: 1, moved: 0 });
    expect(r.envelope.items).toHaveLength(1);
    expect(r.envelope.items[0]).toMatchObject({ slug: "lake-louise-gondola", ref: "sight/lake-louise-gondola", favouredAt: later(0).toISOString() });
    const alone = list(["place", "louise-sightseeing-old"]);
    const s = applyResolution(alone, resolveAll(alone), later(100));
    expect(s).toMatchObject({ moved: 1, folded: 0 });
    expect(s.envelope.items[0]).toMatchObject({ slug: "lake-louise-gondola", name: "Lake Louise Gondola" });
  });

  it("a tombstone is lifted when the page is listed again", () => {
    const env = list(["place", "moraine-lake"]);
    const dead = { ...env, items: env.items.map((i) => ({ ...i, unlistedAt: NOW.toISOString() })) };
    const r = applyResolution(dead, resolveAll(dead), later(5));
    expect(r).toMatchObject({ relisted: 1, changed: true });
    expect(r.envelope.items[0]!.unlistedAt).toBeNull();
  });

  it("rows not in the answer are left alone; an answer for another space is ignored", () => {
    const env = list(["place", "moraine-lake"], ["trip", "dolomites-2027"]);
    const r = applyResolution(env, [{ ...resolveOne(INDEX, light, "trip:moraine-lake"), asked: "place:moraine-lake" }], later(5));
    expect(r.changed).toBe(false);
  });
});

describe("handles", () => {
  it("parse and print; a ref is never a handle", () => {
    expect(parseHandle("place:moraine-lake")).toEqual({ space: "place", slug: "moraine-lake" });
    expect(parseHandle("trip:dolomites-2027")).toEqual({ space: "trip", slug: "dolomites-2027" });
    for (const x of ["place/moraine-lake", "trip/algonquin/sight:ragged falls", "loc:abc", "offer:x", "place:", "place:Bad"]) expect(parseHandle(x), x).toBeNull();
  });
});

describe("privacy detector: planted favourites (visitor spec 8.3)", () => {
  const whys = (x: unknown) => privacyHits(x).map((h) => h.why);

  it("lists favouredAt and favourites as private keys", () => {
    for (const k of ["favouredAt", "favourites"]) expect(PRIVATE_KEYS).toContain(k);
  });

  it("fails a public body with a planted favouredAt, a favourites list, or a whole envelope in a string", () => {
    expect(whys({ items: [{ slug: "moraine-lake", favouredAt: "2026-10-25T14:02:11Z" }] })).toEqual(["a private key"]);
    expect(whys({ place: { slug: "x", favourites: 12 } })).toEqual(["a private key"]);
    const hits = privacyHits({ body: JSON.stringify(filled(1)) }).map((h) => h.where);
    expect(hits).toEqual(expect.arrayContaining(["$.body<json>.items[0].favouredAt"]));
  });

  it("a resolve answer and a light row stay clean", () => {
    expect(whys({ items: [resolveOne(INDEX, light, "place:moraine-lake")] })).toEqual([]);
  });
});
