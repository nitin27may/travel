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
  updateFavourites,
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
  ENVELOPE_MAX_BYTES,
  MERGED_MAX,
  PENDING_MAX,
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
function readOk(raw: string | null): FavouritesEnvelope {
  const r = readFavourites(raw);
  if (!r.ok) throw new Error(r.reason);
  return r.envelope;
}
function applied(r: ReturnType<typeof applyResolution>) {
  if (!r.success) throw new Error(r.issues.join("; "));
  return r.data;
}
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
    expect(writeFavourites(s, FAV_LOCAL_KEY, env, null)).toEqual({ ok: true, raw: JSON.stringify(env) });
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

  it("each negative fails on the rule it names, and only that rule (review M6)", () => {
    const a: FavItem = { space: "place", slug: "a", ref: "route/a", name: null, kind: null, cc: null, favouredAt: NOW.toISOString(), unlistedAt: null };
    const issuesOf = (x: unknown): string[] => {
      const r = parseFavourites(x);
      return r.success ? [] : r.issues;
    };
    const only = (x: unknown, rule: RegExp) => {
      const got = issuesOf(x);
      expect(got.length, `expected ${rule}`).toBeGreaterThan(0);
      for (const i of got) expect(i).toMatch(rule);
    };
    only({ ...emptyFavourites(), items: [a, { ...a, ref: null }] }, /^\$\.items: one favourite per page$/);
    only({ ...emptyFavourites(), items: [a, { ...a, slug: "b" }] }, /^\$\.items: one favourite per ref$/);
    only({ ...emptyFavourites(), items: [{ ...a, space: "trip", kind: "lake" }] }, /^\$\.items\.0\.kind: a trip has no kind$/);
    only({ ...emptyFavourites(), items: [{ ...a, ref: "place/x loc:abc" }] }, /^\$\.items\.0\.ref: a public ref$/);
    // the 500 cap: 501 distinct, valid rows fail on $.items' size and nothing else; 500 pass
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ ...a, slug: `s-${i}`, ref: null }));
    expect(issuesOf({ ...emptyFavourites(), items: rows(FAVOURITES_CAP) })).toEqual([]);
    only({ ...emptyFavourites(), items: rows(FAVOURITES_CAP + 1) }, /^\$\.items: Too big: expected array to have <=500 items$/);
    // the 1000 pending cap
    const op = (i: number) => ({ op: "add", space: "place", slug: `p-${i}`, ref: null, at: NOW.toISOString() });
    expect(issuesOf({ ...emptyFavourites(), pending: Array.from({ length: PENDING_MAX }, (_, i) => op(i)) })).toEqual([]);
    only({ ...emptyFavourites(), pending: Array.from({ length: PENDING_MAX + 1 }, (_, i) => op(i)) }, /^\$\.pending: Too big: expected array to have <=1000 items$/);
    // the byte bound: every count inside its cap, the whole too large
    const fat = {
      ...emptyFavourites(),
      items: rows(FAVOURITES_CAP).map((r, i) => ({ ...r, slug: `${"s".repeat(90)}-${i}`, ref: `route/${"\u00e9".repeat(150)}${i}`, name: "\u{1F3D4}".repeat(120) })),
      pending: Array.from({ length: PENDING_MAX }, (_, i) => ({ ...op(i), slug: `${"p".repeat(90)}-${i}`, ref: `route/${"\u00e9".repeat(150)}${i}` })),
    };
    only(fat, new RegExp(`^\\$: an envelope is at most ${ENVELOPE_MAX_BYTES} bytes$`));
    // merged: at most MERGED_MAX accounts
    const merged = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i.toString(16).padStart(16, "0"), NOW.toISOString()]));
    expect(issuesOf({ ...emptyFavourites(), merged: merged(MERGED_MAX) })).toEqual([]);
    only({ ...emptyFavourites(), merged: merged(MERGED_MAX + 1) }, new RegExp(`^\\$\\.merged: at most ${MERGED_MAX} accounts$`));
  });

  it("times are UTC with Z only (review M1): an offset is refused, any fraction is fine", () => {
    const a = { space: "place", slug: "a", ref: null, name: null, kind: null, cc: null, unlistedAt: null };
    for (const t of ["2026-10-25T14:02:11Z", "2026-10-25T14:02:11.5Z", "2026-10-25T14:02:11.123456Z"])
      expect(parseFavourites({ ...emptyFavourites(), items: [{ ...a, favouredAt: t }] }).success, t).toBe(true);
    for (const t of ["2026-10-25T16:02:11+02:00", "2026-10-25T14:02:11", "2026-10-25"])
      expect(parseFavourites({ ...emptyFavourites(), items: [{ ...a, favouredAt: t }] }).success, t).toBe(false);
  });

  it("refs never take a URL form (review L1): protocol-relative, a scheme, a backslash host", () => {
    const a = { space: "place", slug: "a", name: null, kind: null, cc: null, favouredAt: NOW.toISOString(), unlistedAt: null };
    for (const ref of ["//evil.example/x", "http://evil.example/", "https://x/y", "javascript:alert(1)", "\\\\evil\\x", "/places/x", "Route/x"])
      expect(parseFavourites({ ...emptyFavourites(), items: [{ ...a, ref }] }).success, ref).toBe(false);
    // refs with spaces, colons and hashes are public refs
    expect(parseFavourites({ ...emptyFavourites(), items: [{ ...a, ref: "trip/algonquin/sight:ragged falls" }] }).success).toBe(true);
    expect(parseFavourites({ ...emptyFavourites(), items: [{ ...a, ref: "offer/x#ticket" }] }).success).toBe(true);
  });

  it("a write that fails (quota), is dropped, or is invalid never reports ok", () => {
    const env = filled(1);
    expect(writeFavourites(spyStorage({ quota: true }), FAV_LOCAL_KEY, env, null)).toEqual({ ok: false, reason: "quota" });
    expect(writeFavourites(spyStorage({ dropWrites: true }), FAV_LOCAL_KEY, env, null)).toEqual({ ok: false, reason: "unverified" });
    const s = spyStorage();
    expect(writeFavourites(s, FAV_LOCAL_KEY, { ...env, items: [...env.items, env.items[0]!] }, null)).toEqual({ ok: false, reason: "invalid" });
    expect(s.map.size).toBe(0);
  });

  it("shares NAV-C's probe: blocked storage falls back to memory for this tab", () => {
    const p = probeStorage(() => {
      throw new Error("SecurityError");
    });
    expect(p).toMatchObject({ kind: "memory", reason: "blocked" });
    expect(writeFavourites(p.storage, FAV_LOCAL_KEY, filled(2), null).ok).toBe(true);
  });
});

describe("compare-and-set writes (review NAV-C C1, mirrored)", () => {
  it("never overwrites a stored favourites/2: the write answers newer and the stored text is untouched", () => {
    const s = memoryStorage();
    const v2 = JSON.stringify({ schema: "favourites/2", items: [{ anything: true }] });
    s.setItem(FAV_LOCAL_KEY, v2);
    expect(writeFavourites(s, FAV_LOCAL_KEY, filled(1), null)).toEqual({ ok: false, reason: "newer" });
    expect(writeFavourites(s, FAV_LOCAL_KEY, filled(1), v2)).toEqual({ ok: false, reason: "newer" });
    expect(updateFavourites(s, FAV_LOCAL_KEY, (e) => ({ envelope: e, value: 1 }))).toMatchObject({ ok: false, reason: "newer" });
    expect(s.getItem(FAV_LOCAL_KEY)).toBe(v2);
  });

  it("two tabs: a stale base answers changed instead of losing the other tab's heart", () => {
    const s = memoryStorage();
    const first = writeFavourites(s, FAV_LOCAL_KEY, filled(1), null);
    if (!first.ok) throw new Error("seed");
    // both tabs read the same text
    const baseA = s.getItem(FAV_LOCAL_KEY);
    const baseB = s.getItem(FAV_LOCAL_KEY);
    const envA = must(addFavourite(readOk(baseA), { space: "place", slug: "from-tab-a" }, { now: later(5) }));
    const envB = must(addFavourite(readOk(baseB), { space: "trip", slug: "from-tab-b" }, { now: later(6) }));
    expect(writeFavourites(s, FAV_LOCAL_KEY, envB, baseB).ok).toBe(true);
    expect(writeFavourites(s, FAV_LOCAL_KEY, envA, baseA)).toEqual({ ok: false, reason: "changed" });
    expect(readOk(s.getItem(FAV_LOCAL_KEY)).items.map(handleOf)).toContain("trip:from-tab-b");
  });

  it("updateFavourites re-reads and re-applies on changed, so both tabs' hearts survive", () => {
    const inner = memoryStorage();
    let raced = false;
    // tab B writes between tab A's read and tab A's write, once
    const s: StorageLike = {
      getItem: (k) => inner.getItem(k),
      removeItem: (k) => inner.removeItem(k),
      setItem: (k, v) => inner.setItem(k, v),
    };
    const r = updateFavourites(s, FAV_LOCAL_KEY, (env) => {
      if (!raced) {
        raced = true;
        const b = must(addFavourite(env, { space: "trip", slug: "from-tab-b" }, { now: later(1) }));
        inner.setItem(FAV_LOCAL_KEY, JSON.stringify(b));
      }
      const a = addFavourite(env, { space: "place", slug: "from-tab-a" }, { now: later(2) });
      return { envelope: a.ok ? a.envelope : null, value: a.ok };
    });
    expect(r.ok).toBe(true);
    expect(readOk(inner.getItem(FAV_LOCAL_KEY)).items.map(handleOf).sort()).toEqual(["place:from-tab-a", "trip:from-tab-b"]);
  });

  it("a refused change (the cap) writes nothing; an unchanged envelope is not rewritten", () => {
    const s = spyStorage();
    s.map.set(FAV_LOCAL_KEY, JSON.stringify(filled(FAVOURITES_CAP)));
    const before = s.map.get(FAV_LOCAL_KEY);
    const r = updateFavourites(s, FAV_LOCAL_KEY, (env) => {
      const a = addFavourite(env, { space: "place", slug: "one-more" }, { now: later(999) });
      return { envelope: a.ok ? a.envelope : null, value: a };
    });
    expect(r).toMatchObject({ ok: false, reason: "refused", value: { ok: false, reason: "cap" } });
    expect(s.map.get(FAV_LOCAL_KEY)).toBe(before);
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
    const r = applied(applyResolution(env, resolveAll(env), later(100)));
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
    const again = applied(applyResolution(r.envelope, resolveAll(r.envelope), later(200)));
    expect(again.changed).toBe(false);
    expect(again.envelope).toBe(r.envelope);
  });

  it("a merged page becomes its survivor, folded into the survivor's row when the list holds it (earlier time kept)", () => {
    const both = list(["place", "lake-louise-gondola"], ["place", "lake-louise-sightseeing"]);
    const r = applied(applyResolution(both, resolveAll(both), later(100)));
    expect(r).toMatchObject({ folded: 1, moved: 0 });
    expect(r.envelope.items).toHaveLength(1);
    expect(r.envelope.items[0]).toMatchObject({ slug: "lake-louise-gondola", ref: "sight/lake-louise-gondola", favouredAt: later(0).toISOString() });
    const alone = list(["place", "louise-sightseeing-old"]);
    const s = applied(applyResolution(alone, resolveAll(alone), later(100)));
    expect(s).toMatchObject({ moved: 1, folded: 0 });
    expect(s.envelope.items[0]).toMatchObject({ slug: "lake-louise-gondola", name: "Lake Louise Gondola" });
  });

  it("a tombstone is lifted when the page is listed again", () => {
    const env = list(["place", "moraine-lake"]);
    const dead = { ...env, items: env.items.map((i) => ({ ...i, unlistedAt: NOW.toISOString() })) };
    const r = applied(applyResolution(dead, resolveAll(dead), later(5)));
    expect(r).toMatchObject({ relisted: 1, changed: true });
    expect(r.envelope.items[0]!.unlistedAt).toBeNull();
  });

  it("rows not in the answer are left alone; an answer for another space is ignored", () => {
    const env = list(["place", "moraine-lake"], ["trip", "dolomites-2027"]);
    const r = applied(applyResolution(env, [{ ...resolveOne(INDEX, light, "trip:moraine-lake"), asked: "place:moraine-lake" }], later(5)));
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
