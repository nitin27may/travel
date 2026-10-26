// The sign-in merge (visitor spec 4.4, 12 "merge algorithm ... as property tests"): union, the account wins, cap 500 with the newest
// first, idempotent, crash safe, moved and withdrawn refs. Seeded generators (copies.test.ts), so a failing property names its seed.
import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import {
  accountCacheKey,
  accountHash,
  cacheFrom,
  dropSent,
  hashOfCacheKey,
  queuePending,
  staleCacheKeys,
  withPending,
} from "../../src/favourites/account.ts";
import { addFavourite, handleOf, readFavourites } from "../../src/favourites/envelope.ts";
import {
  applyPlan,
  cacheItemsOf,
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
import { privacyHits } from "../../src/privacy/detect.ts";
import {
  emptyFavourites,
  FAVOURITES_CAP,
  mergeAnswer,
  mergeInput,
  PENDING_MAX,
  type AccountFavourite,
  type FavouritesEnvelope,
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
const time = (r: () => number) => new Date(Date.UTC(2026, 0, 1) + int(r, 0, 25e9)).toISOString();

/**
 * A synthetic catalogue for the properties: N live places, some renamed (old slug -> new), some merged into another (two slugs, one
 * survivor), some withdrawn, plus unknown slugs. A resolver over it with the same rules as resolve.ts.
 */
const N = 700;
function catalogue(): Resolve {
  return (asked: string): ResolveRow => {
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
}
const resolve = catalogue();

function deviceList(r: () => number, n: number): MergeItem[] {
  const seen = new Set<string>();
  const out: MergeItem[] = [];
  while (out.length < n) {
    const k = int(r, 0, N + 40);
    const old = r() < 0.15;
    const slug = `p-${k}${old ? "-old" : ""}`;
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
    // some rows the device also holds (merged before, or hearted on another device)
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

const handlesOf = (p: FavMergePlan) => [...p.inserted, ...p.already, ...p.dropped.map((d) => d.handle), ...p.overCap];

describe("planFavouritesMerge: properties", () => {
  it("every device item lands in one bucket; union; account wins; cap; one row per ref; newest first; idempotent", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const at = `seed ${seed}`;
      const { device, account } = world(seed);
      const plan = planFavouritesMerge(device, account, resolve);
      expect(handlesOf(plan).sort(), at).toEqual(device.map(handleOf).sort());
      const after = applyPlan(account, plan);
      // the account wins: every row it held is there unchanged, first
      expect(after.slice(0, account.length), at).toEqual(account);
      // one row per ref, and the cap holds (an account already over it gains nothing)
      expect(new Set(after.map((a) => a.ref)).size, at).toBe(after.length);
      expect(after.length, at).toBeLessThanOrEqual(Math.max(FAVOURITES_CAP, account.length));
      if (account.length >= FAVOURITES_CAP) expect(plan.insert, at).toEqual([]);
      // union: every live device item is in the account unless it was over the cap
      const over = new Set(plan.overCap);
      const refs = new Set(after.map((a) => a.ref));
      for (const d of device) {
        const r = resolve(handleOf(d));
        const live = r.state === "current" || r.state === "moved" || r.state === "merged";
        if (live && !over.has(handleOf(d))) expect(refs.has(r.ref!), `${at} ${handleOf(d)}`).toBe(true);
        if (!live) expect(plan.dropped.some((x) => x.handle === handleOf(d)), at).toBe(true);
      }
      // newest first: no over-cap item is newer than the oldest item that got in
      const when = new Map(device.map((d) => [handleOf(d), d.favouredAt]));
      const newestOver = plan.overCap.map((h) => when.get(h)!).sort().at(-1);
      const groupTimes = plan.insert.map((row) => Math.max(...device.filter((d) => resolve(handleOf(d)).ref === row.ref).map((d) => Date.parse(d.favouredAt))));
      if (newestOver && groupTimes.length) expect(Date.parse(newestOver), at).toBeLessThanOrEqual(Math.min(...groupTimes));
      // idempotent: re-planning against the result inserts nothing and changes nothing
      const again = planFavouritesMerge(device, after, resolve);
      expect(again.insert, at).toEqual([]);
      expect(applyPlan(after, again), at).toEqual(after);
      // the inserted rows carry the earliest time of their group
      for (const row of plan.insert) {
        const times = device.filter((d) => resolve(handleOf(d)).ref === row.ref).map((d) => d.favouredAt);
        expect(row.favouredAt, at).toBe(times.sort()[0]);
      }
    }
  });

  it("a crash between the server write and emptying the device is safe: the retry inserts nothing and keeps the same items", () => {
    for (let seed = 1; seed <= 150; seed++) {
      const { device, account } = world(seed);
      const first = planFavouritesMerge(device, account, resolve);
      const server = applyPlan(account, first); // written, then the tab died before markFavouritesMerged
      const retry = planFavouritesMerge(device, server, resolve);
      expect(retry.insert, `seed ${seed}`).toEqual([]);
      expect([...retry.already].sort(), `seed ${seed}`).toEqual([...first.inserted, ...first.already].sort());
      expect(retry.overCap, `seed ${seed}`).toEqual(first.overCap.filter((h) => !retry.already.includes(h)));
      expect(mergeAnswerOf(retry, server, resolve, NOW).items, `seed ${seed}`).toEqual(mergeAnswerOf(first, server, resolve, NOW).items);
    }
  });

  it("two devices merging in either order end with the same set of refs when nothing is over the cap", () => {
    for (let seed = 1; seed <= 150; seed++) {
      const r = rng(seed * 7919);
      const a = deviceList(r, int(r, 0, 120));
      const b = deviceList(r, int(r, 0, 120));
      const acct = accountList(r, int(r, 0, 100), []);
      const ab = applyPlan(applyPlan(acct, planFavouritesMerge(a, acct, resolve)), planFavouritesMerge(b, applyPlan(acct, planFavouritesMerge(a, acct, resolve)), resolve));
      const ba0 = applyPlan(acct, planFavouritesMerge(b, acct, resolve));
      const ba = applyPlan(ba0, planFavouritesMerge(a, ba0, resolve));
      expect(new Set(ab.map((x) => x.ref)), `seed ${seed}`).toEqual(new Set(ba.map((x) => x.ref)));
    }
  });
});

describe("planFavouritesMerge: cases", () => {
  const item = (slug: string, min: number, ref: string | null = null): MergeItem => ({ space: "place", slug, ref, favouredAt: new Date(NOW.getTime() - min * 60_000).toISOString() });

  it("moved and merged slugs go in under the survivor; two slugs of one survivor make one row with the earlier time", () => {
    const plan = planFavouritesMerge([item("p-7", 5), item("p-8", 1), item("p-9-old", 2)], [], resolve);
    expect(plan.insert.map((r) => r.ref)).toEqual(["route/p-8", "route/p-9"]);
    expect(plan.insert[0]!.favouredAt).toBe(item("x", 5).favouredAt);
    expect(plan.inserted.sort()).toEqual(["place:p-7", "place:p-8", "place:p-9-old"]);
  });

  it("withdrawn and unknown are dropped and counted; a stale ref falls back to the handle", () => {
    const plan = planFavouritesMerge([item("p-11", 1), item("p-9999", 2), item("p-3", 3, "route/p-9999")], [], resolve);
    expect(plan.dropped).toEqual([
      { handle: "place:p-11", state: "withdrawn" },
      { handle: "place:p-9999", state: "unknown" },
    ]);
    expect(plan.insert.map((r) => r.ref)).toEqual(["route/p-3"]);
  });

  it("the account's own time wins for a ref it holds", () => {
    const account: AccountFavourite[] = [{ ref: "route/p-3", space: "place", favouredAt: "2020-01-01T00:00:00.000Z" }];
    const plan = planFavouritesMerge([item("p-3", 1)], account, resolve);
    expect(plan).toMatchObject({ insert: [], already: ["place:p-3"] });
    expect(applyPlan(account, plan)).toEqual(account);
  });

  it("at the cap, the newest go in and the rest stay on the device (toast: 490 added)", () => {
    const account: AccountFavourite[] = Array.from({ length: FAVOURITES_CAP - 2 }, (_, i) => ({ ref: `route/q-${i}`, space: "place", favouredAt: NOW.toISOString() }));
    const plan = planFavouritesMerge([item("p-1", 30), item("p-2", 10), item("p-3", 20), item("p-4", 40)], account, resolve);
    expect(plan.insert.map((r) => r.ref)).toEqual(["route/p-2", "route/p-3"]);
    expect(plan.overCap.sort()).toEqual(["place:p-1", "place:p-4"]);
    const answer = mergeAnswerOf(plan, applyPlan(account, plan), (a) => (a.startsWith("route/q-") ? { ...resolve("route/p-1"), asked: a, ref: a, slug: a.slice(6) } : resolve(a)), NOW);
    expect(answer).toMatchObject({ added: 2, dropped: 0, overCap: 2, keep: plan.overCap });
    expect(mergeAnswer.safeParse(answer).success).toBe(true);
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
    expect(mergeInput.safeParse(JSON.parse(body)).success).toBe(true);
    expect(body.length).toBeLessThan(64 * 1024);
  });

  it("keeps only what did not fit and records the account; a re-run on the kept list is a no-op for the account", () => {
    const env = deviceEnv(["p-1", "p-2", "p-3"]);
    const after = markFavouritesMerged(env, ["place:p-2"], "3f9a1c0e7b2d4a55", NOW);
    expect(after.items.map((i) => i.slug)).toEqual(["p-2"]);
    expect(after.merged).toEqual({ "3f9a1c0e7b2d4a55": NOW.toISOString() });
    expect(mergedBefore(after, "3f9a1c0e7b2d4a55")).toBe(true);
    expect(mergeDue(after)).toBe(true); // what was kept, or saved signed out later, merges again on the next visit
    expect(mergeDue(markFavouritesMerged(env, [], "3f9a1c0e7b2d4a55", NOW))).toBe(false);
  });

  it("the cache list folds merged rows, tombstones withdrawn ones, and reports rows with no page at all", () => {
    const rows: AccountFavourite[] = [
      { ref: "route/p-7", space: "place", favouredAt: "2026-01-01T00:00:00.000Z" },
      { ref: "route/p-8", space: "place", favouredAt: "2026-02-01T00:00:00.000Z" },
      { ref: "route/p-11", space: "place", favouredAt: "2026-03-01T00:00:00.000Z" },
      { ref: "route/p-9999", space: "place", favouredAt: "2026-04-01T00:00:00.000Z" },
    ];
    const { items, unresolvable } = cacheItemsOf(rows, resolve, NOW);
    expect(items.map((i) => [i.slug, i.favouredAt, i.unlistedAt])).toEqual([
      ["p-11", "2026-03-01T00:00:00.000Z", NOW.toISOString()],
      ["p-8", "2026-01-01T00:00:00.000Z", null],
    ]);
    expect(unresolvable).toEqual(["route/p-9999"]);
  });

  it("the merge answer over the real fixture resolver is a valid cache and passes the privacy detector only as a private body", () => {
    const res: Resolve = (a) => resolveOne(INDEX, light, a);
    const device: MergeItem[] = [
      { space: "place", slug: "lake-agnes", ref: null, favouredAt: "2026-10-01T00:00:00.000Z" },
      { space: "place", slug: "lake-louise-sightseeing", ref: null, favouredAt: "2026-10-02T00:00:00.000Z" },
      { space: "trip", slug: "gone-trip", ref: null, favouredAt: "2026-10-03T00:00:00.000Z" },
      { space: "trip", slug: "dolomites-2027", ref: null, favouredAt: "2026-10-04T00:00:00.000Z" },
    ];
    const plan = planFavouritesMerge(device, [{ ref: "sight/lake-louise-gondola", space: "place", favouredAt: "2025-01-01T00:00:00.000Z" }], res);
    expect(plan.insert.map((r) => r.ref)).toEqual(["trip/dolomites-2027", "place/lake-agnes"]);
    expect(plan.already).toEqual(["place:lake-louise-sightseeing"]);
    expect(plan.dropped).toEqual([{ handle: "trip:gone-trip", state: "withdrawn" }]);
    const answer = mergeAnswerOf(plan, applyPlan([{ ref: "sight/lake-louise-gondola", space: "place", favouredAt: "2025-01-01T00:00:00.000Z" }], plan), res, NOW);
    expect(mergeAnswer.safeParse(answer).success).toBe(true);
    expect(answer.items.map(handleOf)).toEqual(["trip:dolomites-2027", "place:lake-agnes-teahouse", "place:lake-louise-gondola"]);
    // a favourites body is private: if it ever reached a public body, the detector fails it
    expect(privacyHits({ favourites: answer }).length).toBeGreaterThan(0);
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

  it("pending writes: last write per favourite wins, the queue stays bounded, and the shown list applies them on the server's", () => {
    let env = emptyFavourites();
    const op = (o: "add" | "remove", slug: string, s: number) => ({ op: o, space: "place" as const, slug, ref: null, at: new Date(NOW.getTime() + s * 1000).toISOString() });
    env = queuePending(env, op("add", "p-1", 1));
    env = queuePending(env, op("add", "p-2", 2));
    env = queuePending(env, op("remove", "p-1", 3));
    expect(env.pending.map((p) => `${p.op}:${p.slug}`)).toEqual(["add:p-2", "remove:p-1"]);
    for (let i = 0; i < PENDING_MAX + 50; i++) env = queuePending(env, op("add", `x-${i}`, 10 + i));
    expect(env.pending.length).toBe(PENDING_MAX);
    const server = cacheItemsOf([{ ref: "route/p-1", space: "place", favouredAt: "2026-01-01T00:00:00.000Z" }], resolve, NOW).items;
    const shown = withPending(server, [op("remove", "p-1", 1), op("add", "p-2", 2)]);
    expect(shown.map(handleOf)).toEqual(["place:p-2"]);
    const cache = cacheFrom(server, queuePending(emptyFavourites(), op("add", "p-5", 5)));
    expect(cache.items.map(handleOf)).toEqual(["place:p-5", "place:p-1"]);
    expect(readFavourites(JSON.stringify(cache)).ok).toBe(true);
    expect(dropSent(cache, 1).pending).toEqual([]);
  });
});
