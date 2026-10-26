// The sign-in merge (visitor spec 4.4, 12 "merge algorithm ... as property tests"): union, the account wins, cap 500 with the newest
// first, idempotent, crash safe, moved and withdrawn refs. Seeded generators (copies.test.ts), so a failing property names its seed.
// Review NAV-C classes, mirrored: C2 (entry points parse), M1 (instants, mixed precision), M2 (only confirmed rows leave the device),
// M6 (a crash in setItem and in removeItem).
import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import {
  accountCacheKey,
  accountHash,
  cacheFrom,
  dropSent,
  finishMerge,
  hashOfCacheKey,
  queuePending,
  staleCacheKeys,
  withPending,
} from "../../src/favourites/account.ts";
import { addFavourite, handleOf, readFavourites, writeFavourites } from "../../src/favourites/envelope.ts";
import {
  applyPlan,
  cacheItemsOf,
  insertedHandles,
  markFavouritesMerged,
  mergeAnswerOf,
  mergeDue,
  mergedBefore,
  mergeItemsOf,
  planFavouritesMerge,
  type FavMergePlan,
  type Resolve,
} from "../../src/favourites/merge.ts";
import { resolveOne } from "../../src/favourites/resolve.ts";
import { memoryStorage, type StorageLike } from "../../src/schema/copies.ts";
import type { Checked } from "../../src/schema/trip-custom.ts";
import { privacyHits } from "../../src/privacy/detect.ts";
import {
  emptyFavourites,
  FAV_LOCAL_KEY,
  FAVOURITES_CAP,
  MERGED_MAX,
  mergeAnswer,
  PENDING_MAX,
  type AccountFavourite,
  type FavouritesEnvelope,
  type MergeAnswer,
  type MergeItem,
  type ResolveRow,
} from "../../src/schema/favourites.ts";
import { INDEX, light } from "./fixture.ts";

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r: () => number, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
const NOW = new Date("2026-10-26T09:00:00Z");
const H = "3f9a1c0e7b2d4a55";

/** A UTC instant in one of three spellings (no fraction, ms, µs), so string order and time order disagree (review M1). */
function time(r: () => number): string {
  const ms = Date.UTC(2026, 0, 1) + int(r, 0, 25e6) * 1000 + (r() < 0.5 ? int(r, 0, 999) : 0);
  const iso = new Date(ms).toISOString(); // ...ss.mmmZ
  const k = r();
  if (k < 0.33 && iso.endsWith(".000Z")) return iso.replace(".000Z", "Z");
  if (k < 0.66) return iso.replace("Z", `${int(r, 0, 999).toString().padStart(3, "0")}Z`).replace(/(\.\d{3})(\d{3})Z$/, "$1$2Z");
  return iso;
}

const ok = <T,>(r: Checked<T>): T => {
  if (!r.success) throw new Error(r.issues.join("; "));
  return r.data;
};

/**
 * A synthetic catalogue for the properties: N live places, some renamed (old slug -> new), some merged into another (two slugs, one
 * survivor), some withdrawn, plus unknown slugs. A resolver over it with the same rules as resolve.ts.
 */
const N = 700;
const resolve: Resolve = (asked: string): ResolveRow => {
  const m = /^place:p-(\d+)(-old)?$/.exec(asked) ?? /^route\/p-(\d+)$/.exec(asked);
  const unknown: ResolveRow = { asked, state: "unknown", space: null, slug: null, ref: null, name: null, kind: null, cc: null };
  if (!m) return unknown;
  const n = Number(m[1]);
  if (n >= N) return { ...unknown, space: "place" };
  if (n % 11 === 0) return { ...unknown, state: "withdrawn", space: "place", slug: `p-${n}` };
  const survivor = n % 7 === 0 ? n + 1 : n; // p-7 merged into p-8, ...
  const state = survivor !== n ? "merged" : m[2] ? "moved" : "current";
  return { asked, state, space: "place", slug: `p-${survivor}`, ref: `route/p-${survivor}`, name: `Place ${survivor}`, kind: "lake", cc: "CA" };
};

function deviceList(r: () => number, n: number): MergeItem[] {
  const seen = new Set<string>();
  const out: MergeItem[] = [];
  while (out.length < n) {
    const k = int(r, 0, N + 40);
    const slug = `p-${k}${r() < 0.15 ? "-old" : ""}`;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({ space: "place", slug, ref: r() < 0.3 && k < N ? `route/p-${k}` : null, favouredAt: time(r) });
  }
  return out;
}

function accountList(r: () => number, n: number, device: MergeItem[]): AccountFavourite[] {
  const refs = new Set<string>();
  const out: AccountFavourite[] = [];
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    const fromDevice = device.length > 0 && r() < 0.25;
    const ref = fromDevice ? (resolve(handleOf(device[int(r, 0, device.length - 1)]!)).ref ?? `route/p-${int(r, 0, N - 1)}`) : `route/p-${int(r, 0, N - 1)}`;
    if (refs.has(ref)) continue;
    refs.add(ref);
    out.push({ ref, space: "place", favouredAt: time(r) });
  }
  return out;
}

function world(seed: number) {
  const r = rng(seed);
  const device = deviceList(r, int(r, 0, r() < 0.2 ? FAVOURITES_CAP : 60));
  const account = accountList(r, int(r, 0, r() < 0.25 ? FAVOURITES_CAP : 80), device);
  return { device, account };
}

const plan = (device: unknown, account: unknown): FavMergePlan => ok(planFavouritesMerge(device, account, resolve));
const handlesOf = (p: FavMergePlan) => [...insertedHandles(p), ...p.already, ...p.dropped.map((d) => d.handle), ...p.overCap];
const ms = (s: string) => Date.parse(s);

describe("planFavouritesMerge: properties", () => {
  it("every device item lands in one bucket; union; account wins; cap; one row per ref; newest first by instant; idempotent", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const at = `seed ${seed}`;
      const { device, account } = world(seed);
      const p = plan(device, account);
      expect(handlesOf(p).sort(), at).toEqual(device.map(handleOf).sort());
      const { account: after, returned } = applyPlan(account, p);
      expect(returned, at).toEqual(p.insert.map((r) => r.ref));
      expect(after.slice(0, account.length), at).toEqual(account);
      expect(new Set(after.map((a) => a.ref)).size, at).toBe(after.length);
      expect(after.length, at).toBeLessThanOrEqual(Math.max(FAVOURITES_CAP, account.length));
      if (account.length >= FAVOURITES_CAP) expect(p.insert, at).toEqual([]);
      const over = new Set(p.overCap);
      const refs = new Set(after.map((a) => a.ref));
      for (const d of device) {
        const r = resolve(handleOf(d));
        const live = r.state === "current" || r.state === "moved" || r.state === "merged";
        if (live && !over.has(handleOf(d))) expect(refs.has(r.ref!), `${at} ${handleOf(d)}`).toBe(true);
        if (!live) expect(p.dropped.some((x) => x.handle === handleOf(d)), at).toBe(true);
      }
      // newest first, as instants (the times mix three spellings, so string order would be wrong): no over-cap group is newer than
      // the oldest group that got in
      const groupNewest = (ref: string) => Math.max(...device.filter((d) => resolve(handleOf(d)).ref === ref).map((d) => ms(d.favouredAt)));
      const overNewest = Math.max(-Infinity, ...p.overCap.map((h) => ms(device.find((d) => handleOf(d) === h)!.favouredAt)));
      const inOldest = Math.min(Infinity, ...p.insert.map((row) => groupNewest(row.ref)));
      if (p.overCap.length && p.insert.length) expect(overNewest, at).toBeLessThanOrEqual(inOldest);
      // each insert carries its group's earliest instant
      for (const row of p.insert) {
        const times = device.filter((d) => resolve(handleOf(d)).ref === row.ref).map((d) => ms(d.favouredAt));
        expect(ms(row.favouredAt), at).toBe(Math.min(...times));
      }
      const again = plan(device, after);
      expect(again.insert, at).toEqual([]);
    }
  });

  it("mixed precision (review M1): '...:00Z' is earlier than '...:00.5Z' although it sorts after it as text", () => {
    const early = "2026-05-01T10:00:00Z";
    const late = "2026-05-01T10:00:00.5Z";
    expect(early > late).toBe(true); // the trap
    const full: AccountFavourite[] = Array.from({ length: FAVOURITES_CAP - 1 }, (_, i) => ({ ref: `route/q-${i}`, space: "place", favouredAt: NOW.toISOString() }));
    const p = plan(
      [
        { space: "place", slug: "p-1", ref: null, favouredAt: early },
        { space: "place", slug: "p-2", ref: null, favouredAt: late },
      ],
      full,
    );
    expect(p.insert.map((r) => r.ref)).toEqual(["route/p-2"]);
    expect(p.overCap).toEqual(["place:p-1"]);
    // two slugs of one survivor: the earlier instant is kept
    const g = plan(
      [
        { space: "place", slug: "p-7", ref: null, favouredAt: late },
        { space: "place", slug: "p-8", ref: null, favouredAt: early },
      ],
      [],
    );
    expect(g.insert).toEqual([{ ref: "route/p-8", space: "place", favouredAt: early }]);
  });

  it("two devices merging in either order end with the same set of refs when nothing is over the cap", () => {
    for (let seed = 1; seed <= 150; seed++) {
      const r = rng(seed * 7919);
      const a = deviceList(r, int(r, 0, 120));
      const b = deviceList(r, int(r, 0, 120));
      const acct = accountList(r, int(r, 0, 100), []);
      const ab0 = applyPlan(acct, plan(a, acct)).account;
      const ab = applyPlan(ab0, plan(b, ab0)).account;
      const ba0 = applyPlan(acct, plan(b, acct)).account;
      const ba = applyPlan(ba0, plan(a, ba0)).account;
      expect(new Set(ab.map((x) => x.ref)), `seed ${seed}`).toEqual(new Set(ba.map((x) => x.ref)));
    }
  });
});

describe("entry points parse what they receive (review C2)", () => {
  const good = { space: "place", slug: "p-1", ref: null, favouredAt: "2026-05-01T10:00:00Z" };
  it("the plan refuses a malformed device list or account rows, with paths and never a value", () => {
    const bad: unknown[] = [
      null,
      "x",
      [{ ...good, slug: "Bad Slug" }],
      [good, good], // one per page
      [{ ...good, favouredAt: "2026-05-01T12:00:00+02:00" }], // Z only
      [{ ...good, ref: "loc:secret" }],
      [{ ...good, extra: 1 }],
      Array.from({ length: FAVOURITES_CAP + 1 }, (_, i) => ({ ...good, slug: `p-${i}` })),
    ];
    for (const x of bad) {
      const r = planFavouritesMerge(x, [], resolve);
      expect(r.success, JSON.stringify(x)?.slice(0, 80)).toBe(false);
      if (!r.success) expect(r.issues.join(" ")).not.toMatch(/secret|Bad Slug/);
    }
    expect(planFavouritesMerge([good], [{ ref: "route/p-1", space: "place", favouredAt: "x" }], resolve).success).toBe(false);
    expect(planFavouritesMerge([good], [{ ref: "route/p-1", space: "place", favouredAt: NOW.toISOString() }, { ref: "route/p-1", space: "place", favouredAt: NOW.toISOString() }], resolve).success).toBe(false);
  });

  it("the row mapper, the answer and the mark parse too", () => {
    expect(cacheItemsOf([{ ref: "route/p-1", space: "place" }], resolve, NOW).success).toBe(false);
    expect(markFavouritesMerged(emptyFavourites(), { items: [], added: 0, dropped: 0, overCap: 0, taken: ["not a handle"] }, H, NOW).success).toBe(false);
    expect(markFavouritesMerged(emptyFavourites(), { items: [], added: 0, dropped: 0, overCap: 0 }, H, NOW).success).toBe(false);
  });
});

describe("planFavouritesMerge: cases", () => {
  const item = (slug: string, min: number, ref: string | null = null): MergeItem => ({ space: "place", slug, ref, favouredAt: new Date(NOW.getTime() - min * 60_000).toISOString() });

  it("moved and merged slugs go in under the survivor; two slugs of one survivor make one row with the earlier time", () => {
    const p = plan([item("p-7", 5), item("p-8", 1), item("p-9-old", 2)], []);
    expect(p.insert.map((r) => r.ref)).toEqual(["route/p-8", "route/p-9"]);
    expect(p.insert[0]!.favouredAt).toBe(item("x", 5).favouredAt);
    expect(insertedHandles(p).sort()).toEqual(["place:p-7", "place:p-8", "place:p-9-old"]);
  });

  it("withdrawn and unknown are dropped and counted; a stale ref falls back to the handle", () => {
    const p = plan([item("p-11", 1), item("p-9999", 2), item("p-3", 3, "route/p-9999")], []);
    expect(p.dropped).toEqual([
      { handle: "place:p-11", state: "withdrawn" },
      { handle: "place:p-9999", state: "unknown" },
    ]);
    expect(p.insert.map((r) => r.ref)).toEqual(["route/p-3"]);
  });

  it("the account's own time wins for a ref it holds", () => {
    const account: AccountFavourite[] = [{ ref: "route/p-3", space: "place", favouredAt: "2020-01-01T00:00:00.000Z" }];
    const p = plan([item("p-3", 1)], account);
    expect(p).toMatchObject({ insert: [], already: ["place:p-3"] });
    expect(applyPlan(account, p).account).toEqual(account);
  });

  it("at the cap, the newest go in and the rest stay on the device (toast: 490 added)", () => {
    const account: AccountFavourite[] = Array.from({ length: FAVOURITES_CAP - 2 }, (_, i) => ({ ref: `route/p-${i + 100}`, space: "place", favouredAt: NOW.toISOString() }));
    const p = plan([item("p-1", 30), item("p-2", 10), item("p-3", 20), item("p-4", 40)], account);
    expect(p.insert.map((r) => r.ref)).toEqual(["route/p-2", "route/p-3"]);
    expect(p.overCap.sort()).toEqual(["place:p-1", "place:p-4"]);
    const { account: after, returned } = applyPlan(account, p);
    const answer = ok(mergeAnswerOf(p, returned, after, resolve, NOW));
    expect(answer).toMatchObject({ added: 2, dropped: 0, overCap: 2 });
    expect(answer.taken.sort()).toEqual(["place:p-2", "place:p-3"]);
    expect(mergeAnswer.safeParse(answer).success).toBe(true);
  });

  it("only rows the server confirmed leave the device (review M2): a row the cap trigger refused stays", () => {
    const p = plan([item("p-1", 1), item("p-2", 2), item("p-12", 3)], [{ ref: "route/p-12", space: "place", favouredAt: NOW.toISOString() }]);
    const { account: after, returned } = applyPlan([{ ref: "route/p-12", space: "place", favouredAt: NOW.toISOString() }], p, new Set(["route/p-2"]));
    expect(returned).toEqual(["route/p-1"]);
    const answer = ok(mergeAnswerOf(p, returned, after, resolve, NOW));
    expect(answer.added).toBe(1);
    expect(answer.taken.sort()).toEqual(["place:p-1", "place:p-12"]);
    let env = emptyFavourites();
    for (const s of ["p-1", "p-2", "p-12"]) env = (addFavourite(env, { space: "place", slug: s }, { now: NOW }) as { envelope: FavouritesEnvelope }).envelope;
    const marked = ok(markFavouritesMerged(env, answer, H, NOW));
    expect(marked.items.map(handleOf)).toEqual(["place:p-2"]);
  });
});

describe("the device side of the merge", () => {
  function deviceEnv(slugs: string[]): FavouritesEnvelope {
    let env = emptyFavourites();
    slugs.forEach((s, i) => {
      const r = addFavourite(env, { space: "place", slug: s, name: "Shown on this device" }, { now: new Date(NOW.getTime() + i * 1000) });
      if (r.ok) env = r.envelope;
    });
    return env;
  }

  it("sends identity only (P8), within the route's 64 KB body cap at 500 items", () => {
    const env = deviceEnv(Array.from({ length: FAVOURITES_CAP }, (_, i) => `a-place-with-a-long-enough-slug-${i}`));
    const items = mergeItemsOf(env);
    expect(Object.keys(items[0]!).sort()).toEqual(["favouredAt", "ref", "slug", "space"]);
    const body = JSON.stringify({ userId: "user_2abcDEFghi", items });
    expect(planFavouritesMerge(JSON.parse(body).items, [], resolve).success).toBe(true);
    expect(body.length).toBeLessThan(64 * 1024);
  });

  it("marks the account (a hint, the most recent MERGED_MAX kept); merges again whenever the list has items", () => {
    const env = deviceEnv(["p-1", "p-2", "p-3"]);
    const answer: MergeAnswer = { items: [], added: 2, dropped: 0, overCap: 1, taken: ["place:p-1", "place:p-3"] };
    const after = ok(markFavouritesMerged(env, answer, H, NOW));
    expect(after.items.map((i) => i.slug)).toEqual(["p-2"]);
    expect(after.merged).toEqual({ [H]: NOW.toISOString() });
    expect(mergedBefore(after, H)).toBe(true);
    expect(mergeDue(after)).toBe(true);
    let many = env;
    for (let i = 0; i < MERGED_MAX + 3; i++) many = ok(markFavouritesMerged(many, { ...answer, taken: [] }, i.toString(16).padStart(16, "a"), new Date(NOW.getTime() + i * 1000)));
    expect(Object.keys(many.merged)).toHaveLength(MERGED_MAX);
    expect(many.merged[(MERGED_MAX + 2).toString(16).padStart(16, "a")]).toBeDefined();
    expect(readFavourites(JSON.stringify(many)).ok).toBe(true);
  });

  it("the cache list folds merged rows, tombstones withdrawn ones, and reports rows with no page at all", () => {
    const rows: AccountFavourite[] = [
      { ref: "route/p-7", space: "place", favouredAt: "2026-01-01T00:00:00.000Z" },
      { ref: "route/p-8", space: "place", favouredAt: "2026-02-01T00:00:00.000Z" },
      { ref: "route/p-11", space: "place", favouredAt: "2026-03-01T00:00:00.000Z" },
      { ref: "route/p-9999", space: "place", favouredAt: "2026-04-01T00:00:00.000Z" },
    ];
    const { items, unresolvable } = ok(cacheItemsOf(rows, resolve, NOW));
    expect(items.map((i) => [i.slug, i.favouredAt, i.unlistedAt])).toEqual([
      ["p-11", "2026-03-01T00:00:00.000Z", NOW.toISOString()],
      ["p-8", "2026-01-01T00:00:00.000Z", null],
    ]);
    expect(unresolvable).toEqual(["route/p-9999"]);
  });

  it("the merge answer over the real fixture resolver is a valid cache, and a favourites body is private", () => {
    const res: Resolve = (a) => resolveOne(INDEX, light, a);
    const device: MergeItem[] = [
      { space: "place", slug: "lake-agnes", ref: null, favouredAt: "2026-10-01T00:00:00.000Z" },
      { space: "place", slug: "lake-louise-sightseeing", ref: null, favouredAt: "2026-10-02T00:00:00.000Z" },
      { space: "trip", slug: "gone-trip", ref: null, favouredAt: "2026-10-03T00:00:00.000Z" },
      { space: "trip", slug: "dolomites-2027", ref: null, favouredAt: "2026-10-04T00:00:00.000Z" },
    ];
    const acct: AccountFavourite[] = [{ ref: "sight/lake-louise-gondola", space: "place", favouredAt: "2025-01-01T00:00:00.000Z" }];
    const p = ok(planFavouritesMerge(device, acct, res));
    expect(p.insert.map((r) => r.ref)).toEqual(["trip/dolomites-2027", "place/lake-agnes"]);
    expect(p.already).toEqual(["place:lake-louise-sightseeing"]);
    expect(p.dropped).toEqual([{ handle: "trip:gone-trip", state: "withdrawn" }]);
    const { account: after, returned } = applyPlan(acct, p);
    const answer = ok(mergeAnswerOf(p, returned, after, res, NOW));
    expect(mergeAnswer.safeParse(answer).success).toBe(true);
    expect(answer.items.map(handleOf)).toEqual(["trip:dolomites-2027", "place:lake-agnes-teahouse", "place:lake-louise-gondola"]);
    expect(privacyHits({ favourites: answer }).length).toBeGreaterThan(0);
  });
});

describe("finishMerge: crash anywhere (review M6: setItem and removeItem paths)", () => {
  /** A storage that throws on the n-th write or the n-th remove (counted together), once. */
  function crashing(inner: StorageLike, n: number, on: "set" | "remove" | "any"): StorageLike & { crashed: boolean } {
    let count = 0;
    const s = {
      crashed: false,
      getItem: (k: string) => inner.getItem(k),
      setItem(k: string, v: string) {
        if ((on === "set" || on === "any") && ++count === n && !s.crashed) {
          s.crashed = true;
          throw new Error("tab closed");
        }
        inner.setItem(k, v);
      },
      removeItem(k: string) {
        if ((on === "remove" || on === "any") && ++count === n && !s.crashed) {
          s.crashed = true;
          throw new Error("tab closed");
        }
        inner.removeItem(k);
      },
    };
    return s;
  }
  const OTHER = "travel.fav.acct.bbbbbbbbbbbbbbbb";

  /** One visit to /account/: plan on the server, apply, answer, then the device steps through `storage`. */
  function visit(storage: StorageLike, inner: StorageLike, server: { account: AccountFavourite[] }, keys: () => string[]) {
    const local = readFavourites(inner.getItem(FAV_LOCAL_KEY));
    if (!local.ok || !mergeDue(local.envelope)) return null;
    const p = ok(planFavouritesMerge(mergeItemsOf(local.envelope), server.account, resolve));
    const { account, returned } = applyPlan(server.account, p);
    server.account = account;
    const answer = ok(mergeAnswerOf(p, returned, account, resolve, NOW));
    return finishMerge(storage, { hash: H, answer, at: NOW, keys: keys() });
  }

  it("for every crash point in setItem or removeItem, a second visit converges and no favourite is lost", () => {
    const crashes = { set: 0, remove: 0 };
    for (let seed = 1; seed <= 40; seed++) {
      const r = rng(seed * 31);
      const device = deviceList(r, int(r, 1, 40));
      const startAccount = accountList(r, int(r, 0, r() < 0.3 ? FAVOURITES_CAP - 5 : 30), device);
      for (const on of ["set", "remove"] as const) {
        for (let n = 1; n <= 4; n++) {
          const at = `seed ${seed} ${on} #${n}`;
          const inner = memoryStorage();
          const keys = new Set<string>([FAV_LOCAL_KEY, OTHER]);
          inner.setItem(OTHER, JSON.stringify(emptyFavourites()));
          let env = emptyFavourites();
          for (const d of device) {
            const a = addFavourite(env, { space: d.space, slug: d.slug, ref: d.ref }, { now: new Date(ms(d.favouredAt)) });
            if (a.ok) env = a.envelope;
          }
          expect(writeFavourites(inner, FAV_LOCAL_KEY, env, null).ok, at).toBe(true);
          const tracked: StorageLike = {
            getItem: (k) => inner.getItem(k),
            setItem: (k, v) => (keys.add(k), inner.setItem(k, v)),
            removeItem: (k) => (keys.delete(k), inner.removeItem(k)),
          };
          const server = { account: [...startAccount] };
          const before = new Set(env.items.map(handleOf));
          const crash = crashing(tracked, n, on);
          const first = visit(crash, inner, server, () => [...keys]);
          if (crash.crashed) {
            crashes[on]++;
            expect(first?.ok, at).toBe(false);
          }
          // the next visit, healthy
          visit(tracked, inner, server, () => [...keys]);
          const local = readFavourites(inner.getItem(FAV_LOCAL_KEY));
          expect(local.ok, at).toBe(true);
          if (!local.ok) continue;
          const onDevice = new Set(local.envelope.items.map(handleOf));
          const inAccount = new Set(server.account.map((a) => a.ref));
          // nothing lost: each live favourite is in the account or still on the device; gone ones may leave
          for (const h of before) {
            const rr = resolve(h);
            const live = rr.state === "current" || rr.state === "moved" || rr.state === "merged";
            if (live) expect(inAccount.has(rr.ref!) || onDevice.has(h), `${at} ${h}`).toBe(true);
          }
          // converged: what is still on the device is exactly what did not fit, and nothing the account holds
          for (const h of onDevice) expect(inAccount.has(resolve(h).ref ?? "-"), `${at} ${h}`).toBe(false);
          // V12: the other account's cache is gone, this account's cache is written and valid
          expect(inner.getItem(OTHER), at).toBeNull();
          const cache = readFavourites(inner.getItem(accountCacheKey(H)));
          expect(cache.ok && !cache.fresh, at).toBe(true);
          // the account never holds a ref twice and never passes the cap
          expect(new Set(server.account.map((a) => a.ref)).size, at).toBe(server.account.length);
          expect(server.account.length, at).toBeLessThanOrEqual(Math.max(FAVOURITES_CAP, startAccount.length));
        }
      }
    }
    // both paths really crashed: the cache write, the local write (set #1, #2) and the unload (remove #1)
    expect(crashes.set).toBeGreaterThanOrEqual(80);
    expect(crashes.remove).toBeGreaterThanOrEqual(40);
  });

  it("a crash before the cache is written leaves the local list untouched", () => {
    const inner = memoryStorage();
    let env = emptyFavourites();
    for (const s of ["p-1", "p-2"]) env = (addFavourite(env, { space: "place", slug: s }, { now: NOW }) as { envelope: FavouritesEnvelope }).envelope;
    writeFavourites(inner, FAV_LOCAL_KEY, env, null);
    const raw = inner.getItem(FAV_LOCAL_KEY);
    const answer: MergeAnswer = { items: [], added: 2, dropped: 0, overCap: 0, taken: ["place:p-1", "place:p-2"] };
    const blocked: StorageLike = { getItem: (k) => inner.getItem(k), removeItem: (k) => inner.removeItem(k), setItem: () => { throw new Error("full"); } };
    expect(finishMerge(blocked, { hash: H, answer, at: NOW, keys: [] })).toMatchObject({ ok: false, step: "cache" });
    expect(inner.getItem(FAV_LOCAL_KEY)).toBe(raw);
    const noRemove: StorageLike = { getItem: (k) => inner.getItem(k), setItem: (k, v) => inner.setItem(k, v), removeItem: () => { throw new Error("x"); } };
    expect(finishMerge(noRemove, { hash: H, answer, at: NOW, keys: [OTHER] })).toMatchObject({ ok: false, step: "unload" });
    expect(inner.getItem(FAV_LOCAL_KEY)).toBe(raw);
  });
});

describe("the account cache", () => {
  it("hashes a user id to 16 hex, the same in Node and the browser's Web Crypto", async () => {
    const h = await accountHash("user_2abcDEFghi");
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    const ref = Buffer.from(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode("user_2abcDEFghi"))).toString("hex").slice(0, 16);
    expect(h).toBe(ref);
    expect(accountCacheKey(h)).toBe(`travel.fav.acct.${h}`);
    expect(hashOfCacheKey(accountCacheKey(h))).toBe(h);
    expect(() => accountCacheKey("not-a-hash")).toThrow();
  });

  it("sign-out deletes every account cache; another account's sign-in deletes all but its own; nothing else is touched", () => {
    const keys = ["travel.fav.local", "travel.fav.acct.aaaaaaaaaaaaaaaa", "travel.fav.acct.bbbbbbbbbbbbbbbb", "travel.copies.local", "travel.fav.acct.bogus"];
    expect(staleCacheKeys(keys, null)).toEqual(["travel.fav.acct.aaaaaaaaaaaaaaaa", "travel.fav.acct.bbbbbbbbbbbbbbbb"]);
    expect(staleCacheKeys(keys, "bbbbbbbbbbbbbbbb")).toEqual(["travel.fav.acct.aaaaaaaaaaaaaaaa"]);
  });

  it("pending writes: last write per favourite wins, the queue stays within PENDING_MAX, and the shown list applies them", () => {
    let env = emptyFavourites();
    const op = (o: "add" | "remove", slug: string, s: number) => ({ op: o, space: "place" as const, slug, ref: null, at: new Date(NOW.getTime() + s * 1000).toISOString() });
    env = queuePending(env, op("add", "p-1", 1));
    env = queuePending(env, op("add", "p-2", 2));
    env = queuePending(env, op("remove", "p-1", 3));
    expect(env.pending.map((p) => `${p.op}:${p.slug}`)).toEqual(["add:p-2", "remove:p-1"]);
    for (let i = 0; i < PENDING_MAX + 50; i++) env = queuePending(env, op("add", `x-${i}`, 10 + i));
    expect(env.pending.length).toBe(PENDING_MAX);
    expect(env.pending.at(-1)!.slug).toBe(`x-${PENDING_MAX + 49}`);
    const server = ok(cacheItemsOf([{ ref: "route/p-1", space: "place", favouredAt: "2026-01-01T00:00:00.000Z" }], resolve, NOW)).items;
    const shown = withPending(server, [op("remove", "p-1", 1), op("add", "p-2", 2)]);
    expect(shown.map(handleOf)).toEqual(["place:p-2"]);
    const cache = cacheFrom(server, queuePending(emptyFavourites(), op("add", "p-5", 5)));
    expect(cache.items.map(handleOf)).toEqual(["place:p-5", "place:p-1"]);
    expect(readFavourites(JSON.stringify(cache)).ok).toBe(true);
    expect(dropSent(cache, 1).pending).toEqual([]);
  });
});
