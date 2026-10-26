import { describe, expect, it } from "vitest";
import { ORIGIN_REFERENCE_VALUE, PRIVATE_KEYS, privacyHits } from "../../src/privacy/detect.ts";
import {
  ACCOUNT_DRAFT_CAP,
  addCopy,
  copiesEnvelope,
  COPIES_KEY,
  copyItem,
  parseCopy,
  parseEnvelope,
  copyToDraftRow,
  copyToTripCustom,
  DEVICE_COPY_CAP,
  emptyCopies,
  LEGACY_COPIES_KEY,
  markMerged,
  memoryStorage,
  moveLegacyCopies,
  planMerge,
  PLACEHOLDER_TITLE,
  probeStorage,
  PROBE_KEY,
  readCopies,
  removeCopy,
  restoreCopy,
  writeCopies,
  type AccountDraftKey,
  type CopiesEnvelope,
  type CopyInput,
  type CopyItem,
  type StorageLike,
} from "../../src/schema/copies.ts";
import { z } from "zod";
import { ORIGIN_REFERENCE, parseTripCustom, tripCustom } from "../../src/schema/trip-custom.ts";

const mustCopy = (x: unknown): CopyItem => {
  const r = parseCopy(x);
  if (!r.success) throw new Error(r.issues.join("; "));
  return r.data;
};

// copies/1 (navigation-and-mine.md 3, 4.2; Q204): the envelope, the old-key move, the storage probe, the merge rule as property tests,
// and the detector keys for a planted copy field.

/** A seeded generator (mulberry32), so a failing property names its seed and reruns the same. */
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
const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const int = (r: () => number, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));

/** UUID v4 from a generator (or a counter), lower case. */
function uuidFrom(r: () => number): string {
  const h = () => Math.floor(r() * 16).toString(16);
  const s = (n: number) => Array.from({ length: n }, h).join("");
  return `${s(8)}-${s(4)}-4${s(3)}-${pick(r, ["8", "9", "a", "b"])}${s(3)}-${s(12)}`;
}
const ids = (seed = 1) => {
  const r = rng(seed);
  return () => uuidFrom(r);
};

const SLUGS = Array.from({ length: 30 }, (_, i) => `trip-${i}`);
const STARTS = ["2027-07-03", "2027-07-10", "2028-01-15", "2029-09-08"];

const INPUT: CopyInput = {
  slug: "dolomites-july-2027",
  title: "Dolomites",
  days: 14,
  cc: "IT",
  photo: "/img/trips/dolomites/cover-400.webp",
  start: "2027-07-03",
  adults: 2,
  children: [6],
  profile: { party: "family", youngest: 6, pace: "standard", adults: 2, walk: null, split: false },
  overrides: { "5": "C" },
  added: [{ day: 5, placeSlug: "pyramid-lake" }],
};
const NOW = new Date("2026-10-25T14:02:11Z");

function item(r: () => number, i: number): CopyItem {
  return mustCopy({
    ...INPUT,
    id: uuidFrom(r),
    slug: SLUGS[i]!,
    start: pick(r, STARTS),
    copiedAt: new Date(Date.UTC(2026, 9, 1) + int(r, 0, 1e9)).toISOString(),
    ...(r() < 0.3 ? { from: pick(r, ["iata:BOM", "hub:ottawa", "town:in-mh-mumbai", "gn:1275339"]) } : {}),
    ...(r() < 0.2 ? { gw: { in: "YEG", out: "YYC" } } : {}),
  });
}

/** A storage that records calls and can be told to fail. */
function spyStorage(opts: { failSetOn?: string; throwOnGet?: boolean; quota?: boolean; dropWrites?: boolean } = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem(k) {
      if (opts.throwOnGet) throw new Error("SecurityError");
      return map.has(k) ? map.get(k)! : null;
    },
    setItem(k, v) {
      if (opts.failSetOn === "*" || opts.failSetOn === k) {
        if (opts.quota) throw Object.assign(new Error("full"), { name: "QuotaExceededError", code: 22 });
        throw new Error("SecurityError");
      }
      if (opts.dropWrites) return;
      map.set(k, v);
    },
    removeItem(k) {
      map.delete(k);
    },
  };
}

describe("copies/1 envelope", () => {
  it("exports to JSON Schema (the schema subset rule: cross-field rules live in copyRules and envelopeRules)", () => {
    for (const s of [copyItem, copiesEnvelope, tripCustom]) expect(() => z.toJSONSchema(s, { target: "draft-2020-12", io: "input", unrepresentable: "throw" })).not.toThrow();
  });

  it("round-trips: add, write, read gives the same envelope", () => {
    const s = memoryStorage();
    const r = addCopy(emptyCopies(), { ...INPUT, from: "iata:BOM", gw: { in: "YYC", out: "YYC" } }, { now: NOW, newId: ids() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(writeCopies(s, r.envelope)).toEqual({ ok: true });
    const back = readCopies(s.getItem(COPIES_KEY));
    expect(back).toEqual({ ok: true, envelope: r.envelope, fresh: false });
    expect(r.item.copiedAt).toBe("2026-10-25T14:02:11.000Z");
  });

  it("matches the spec example (nav 3.1)", () => {
    const example = {
      schema: "copies/1",
      items: [{ id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", ...INPUT, copiedAt: "2026-10-25T14:02:11Z" }],
      noteSeen: null,
      snoozedUntil: null,
      merged: {},
    };
    expect(parseEnvelope(example).success).toBe(true);
  });

  it("reads absent as fresh, and leaves a newer, corrupt or invalid value untouched", () => {
    expect(readCopies(null)).toMatchObject({ ok: true, fresh: true, envelope: emptyCopies() });
    const newer = JSON.stringify({ schema: "copies/2", items: [{ anything: true }] });
    expect(readCopies(newer)).toMatchObject({ ok: false, reason: "newer" });
    expect(readCopies("{not json")).toMatchObject({ ok: false, reason: "corrupt" });
    expect(readCopies(JSON.stringify({ ...emptyCopies(), extra: 1 }))).toMatchObject({ ok: false, reason: "invalid" });
    // the legacy move must not overwrite a newer envelope either
    const s = spyStorage();
    s.map.set(COPIES_KEY, newer);
    s.map.set(LEGACY_COPIES_KEY, JSON.stringify([{ slug: "a", start: "2027-07-03", adults: 2, children: [], savedAt: NOW.toISOString() }]));
    expect(moveLegacyCopies(s, { newId: ids() })).toEqual({ status: "failed", reason: "envelope-unreadable" });
    expect(s.map.get(COPIES_KEY)).toBe(newer);
    expect(s.map.has(LEGACY_COPIES_KEY)).toBe(true);
  });

  it("issues name a path, never the party", () => {
    const bad = { ...emptyCopies(), items: [{ id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", ...INPUT, children: [41], copiedAt: NOW.toISOString() }] };
    const r = readCopies(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("41");
  });

  it("enforces one copy per trip, unique ids, 20 a device, 4 KB a copy, 30 additions, 60 overrides", () => {
    const r = rng(7);
    const twenty = Array.from({ length: DEVICE_COPY_CAP }, (_, i) => item(r, i));
    expect(parseEnvelope({ ...emptyCopies(), items: twenty }).success).toBe(true);
    expect(parseEnvelope({ ...emptyCopies(), items: [...twenty, item(r, 20)] }).success).toBe(false);
    expect(parseEnvelope({ ...emptyCopies(), items: [twenty[0], { ...twenty[1]!, slug: twenty[0]!.slug }] }).success).toBe(false);
    expect(parseEnvelope({ ...emptyCopies(), items: [twenty[0], { ...twenty[1]!, id: twenty[0]!.id }] }).success).toBe(false);
    const base = twenty[0]!;
    expect(parseCopy({ ...base, added: Array.from({ length: 31 }, () => ({ day: 1, placeSlug: "x" })) }).success).toBe(false);
    expect(parseCopy({ ...base, overrides: Object.fromEntries(Array.from({ length: 61 }, (_, i) => [String(i + 1), "A"])) }).success).toBe(false);
    const thirty = Array.from({ length: 30 }, (_, i) => ({ day: (i % 99) + 1, placeSlug: `${"p".repeat(96)}-${i}` }));
    const sixty = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [String(i + 1), "A"]));
    expect(parseCopy({ ...base, added: thirty }).success).toBe(true);
    expect(JSON.stringify({ ...base, added: thirty, overrides: sixty }).length).toBeGreaterThan(4096);
    expect(parseCopy({ ...base, added: thirty, overrides: sixty }).success).toBe(false);
    // a full-sized realistic copy stays inside 4 KB, so 20 stay under 80 KB
    const full = { ...base, added: Array.from({ length: 30 }, (_, i) => ({ day: (i % 14) + 1, placeSlug: `place-name-${i}` })), overrides: Object.fromEntries(Array.from({ length: 14 }, (_, i) => [String(i + 1), "B"])) };
    expect(parseCopy(full).success).toBe(true);
    expect(JSON.stringify({ ...emptyCopies(), items: Array.from({ length: 20 }, () => full) }).length).toBeLessThan(80 * 1024);
  });

  it("refuses a bad id, slug, date, photo URL or origin", () => {
    const base = { ...INPUT, id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", copiedAt: NOW.toISOString() };
    expect(parseCopy(base).success).toBe(true);
    for (const bad of [
      { id: "6F1C0A52-8D0E-4B7E-9A51-2C3D4E5F6A7B" },
      { id: "6f1c0a52-8d0e-1b7e-9a51-2c3d4e5f6a7b" },
      { slug: "../x" },
      { start: "3 Jul 2027" },
      { photo: "https://example.com/x.jpg" },
      { cc: "it" },
      { from: "Mumbai" },
      { gw: { in: "YEG", out: "YYC", via: "YVR" } },
      { copiedAt: "yesterday" },
    ]) {
      expect(parseCopy({ ...base, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("device mutations", () => {
  it("a second copy of a trip asks, and replace takes its place under a new id", () => {
    const newId = ids(3);
    const a = addCopy(emptyCopies(), INPUT, { now: NOW, newId });
    if (!a.ok) throw new Error("add");
    const again = addCopy(a.envelope, { ...INPUT, start: "2027-07-10" }, { now: NOW, newId });
    expect(again).toMatchObject({ ok: false, reason: "exists", existing: { id: a.item.id } });
    const rep = addCopy(a.envelope, { ...INPUT, start: "2027-07-10" }, { now: NOW, newId, replace: true });
    if (!rep.ok) throw new Error("replace");
    expect(rep.envelope.items).toHaveLength(1);
    expect(rep.envelope.items[0]!.start).toBe("2027-07-10");
    expect(rep.item.id).not.toBe(a.item.id);
    expect(rep.replaced?.id).toBe(a.item.id);
  });

  it("the 21st copy is refused; replacing at the cap is allowed", () => {
    const newId = ids(4);
    let env = emptyCopies();
    for (let i = 0; i < DEVICE_COPY_CAP; i++) {
      const r = addCopy(env, { ...INPUT, slug: SLUGS[i]! }, { now: NOW, newId });
      if (!r.ok) throw new Error(`add ${i}`);
      env = r.envelope;
    }
    expect(addCopy(env, { ...INPUT, slug: SLUGS[20]! }, { now: NOW, newId })).toEqual({ ok: false, reason: "cap" });
    expect(addCopy(env, { ...INPUT, slug: SLUGS[0]! }, { now: NOW, newId, replace: true }).ok).toBe(true);
  });

  it("remove then restore is the identity; restore refuses a trip copied again meanwhile", () => {
    const a = addCopy(emptyCopies(), INPUT, { now: NOW, newId: ids(5) });
    if (!a.ok) throw new Error("add");
    const { envelope, removed } = removeCopy(a.envelope, a.item.id);
    expect(envelope.items).toHaveLength(0);
    expect(restoreCopy(envelope, removed!)).toEqual({ ok: true, envelope: a.envelope });
    const again = addCopy(envelope, INPUT, { now: NOW, newId: ids(6) });
    if (!again.ok) throw new Error("again");
    expect(restoreCopy(again.envelope, removed!).ok).toBe(false);
    expect(removeCopy(a.envelope, "missing").envelope).toBe(a.envelope);
  });

  it("an invalid input is refused with paths only", () => {
    const r = addCopy(emptyCopies(), { ...INPUT, children: [30] }, { now: NOW, newId: ids() });
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
    expect(JSON.stringify(r)).not.toContain("30");
  });
});

describe("storage probe (nav 3.3)", () => {
  it("uses localStorage when it reads back, and cleans up its key", () => {
    const s = spyStorage();
    const p = probeStorage(() => s);
    expect(p.kind).toBe("local");
    expect(p.storage).toBe(s);
    expect(s.map.has(PROBE_KEY)).toBe(false);
  });
  it("falls back to memory when reaching storage throws, it is absent, a write throws, the quota is full, or writes are dropped", () => {
    expect(probeStorage(() => { throw new Error("SecurityError"); })).toMatchObject({ kind: "memory", reason: "blocked" });
    expect(probeStorage(() => null)).toMatchObject({ kind: "memory", reason: "blocked" });
    expect(probeStorage(() => spyStorage({ failSetOn: "*" }))).toMatchObject({ kind: "memory", reason: "blocked" });
    expect(probeStorage(() => spyStorage({ failSetOn: "*", quota: true }))).toMatchObject({ kind: "memory", reason: "quota" });
    expect(probeStorage(() => spyStorage({ dropWrites: true }))).toMatchObject({ kind: "memory", reason: "blocked" });
  });
  it("the memory fallback holds a copy for the tab", () => {
    const p = probeStorage(() => null);
    const a = addCopy(emptyCopies(), INPUT, { now: NOW, newId: ids() });
    if (!a.ok) throw new Error("add");
    expect(writeCopies(p.storage, a.envelope)).toEqual({ ok: true });
    expect(readCopies(p.storage.getItem(COPIES_KEY))).toMatchObject({ ok: true, envelope: a.envelope });
  });
  it("writeCopies reports quota, blocked, unverified and invalid, and never writes an invalid envelope", () => {
    const env = emptyCopies();
    expect(writeCopies(spyStorage({ failSetOn: COPIES_KEY, quota: true }), env)).toEqual({ ok: false, reason: "quota" });
    expect(writeCopies(spyStorage({ failSetOn: COPIES_KEY }), env)).toEqual({ ok: false, reason: "blocked" });
    expect(writeCopies(spyStorage({ dropWrites: true }), env)).toEqual({ ok: false, reason: "unverified" });
    const s = spyStorage();
    expect(writeCopies(s, { ...env, schema: "copies/2" } as unknown as CopiesEnvelope)).toEqual({ ok: false, reason: "invalid" });
    expect(s.map.size).toBe(0);
  });
});

describe("moving travel:v1:copy-drafts (nav 3.2)", () => {
  const legacy = (slug: string, savedAt: string, extra: Record<string, unknown> = {}) => ({ slug, start: "2027-07-03", adults: 2, children: [6], savedAt, ...extra });

  it("moves every draft with an id and a placeholder snapshot, then deletes the old key", () => {
    const s = spyStorage();
    s.map.set(
      LEGACY_COPIES_KEY,
      JSON.stringify([
        legacy("dolomites-july-2027", "2026-10-20T10:00:00.000Z", { profile: INPUT.profile, overrides: { 5: "C" }, added: [{ day: 5, placeSlug: "pyramid-lake" }] }),
        legacy("canadian-rockies-2029", "2026-10-21T10:00:00.000Z"),
      ]),
    );
    const r = moveLegacyCopies(s, { newId: ids(9), snapshot: (slug) => (slug === "canadian-rockies-2029" ? { title: "Canadian Rockies", days: 15, cc: "CA", photo: null } : null) });
    expect(r).toEqual({ status: "moved", moved: 2, superseded: 0, kept: 0 });
    expect(s.map.has(LEGACY_COPIES_KEY)).toBe(false);
    const env = readCopies(s.map.get(COPIES_KEY)!);
    if (!env.ok) throw new Error("read");
    const bySlug = Object.fromEntries(env.envelope.items.map((x) => [x.slug, x]));
    expect(bySlug["dolomites-july-2027"]).toMatchObject({ title: PLACEHOLDER_TITLE, days: null, overrides: { "5": "C" }, copiedAt: "2026-10-20T10:00:00.000Z" });
    expect(bySlug["canadian-rockies-2029"]).toMatchObject({ title: "Canadian Rockies", days: 15, profile: null, overrides: {}, added: [] });
    // a second run is a no-op
    expect(moveLegacyCopies(s, { newId: ids(10) })).toEqual({ status: "none" });
  });

  it("keeps the old key untouched when the envelope write fails", () => {
    const s = spyStorage({ failSetOn: COPIES_KEY, quota: true });
    const text = JSON.stringify([legacy("a", "2026-10-20T10:00:00.000Z")]);
    s.map.set(LEGACY_COPIES_KEY, text);
    expect(moveLegacyCopies(s, { newId: ids() })).toEqual({ status: "failed", reason: "write-failed" });
    expect(s.map.get(LEGACY_COPIES_KEY)).toBe(text);
    expect(s.map.has(COPIES_KEY)).toBe(false);
  });

  it("keeps the old key when the write is not read back", () => {
    const s = spyStorage({ dropWrites: true });
    // dropWrites drops every set, so seed the map directly
    const text = JSON.stringify([legacy("a", "2026-10-20T10:00:00.000Z")]);
    s.map.set(LEGACY_COPIES_KEY, text);
    expect(moveLegacyCopies(s, { newId: ids() })).toEqual({ status: "failed", reason: "write-failed" });
    expect(s.map.get(LEGACY_COPIES_KEY)).toBe(text);
  });

  it("leaves an unreadable old key alone", () => {
    const s = spyStorage();
    s.map.set(LEGACY_COPIES_KEY, "nope");
    expect(moveLegacyCopies(s, { newId: ids() })).toEqual({ status: "failed", reason: "legacy-unreadable" });
    expect(s.map.get(LEGACY_COPIES_KEY)).toBe("nope");
  });

  it("over the device cap or unparsable drafts stay under the old key; an older draft of a copied trip is superseded", () => {
    const s = spyStorage();
    const newId = ids(11);
    let env = emptyCopies();
    for (let i = 0; i < 19; i++) {
      const a = addCopy(env, { ...INPUT, slug: SLUGS[i]! }, { now: NOW, newId });
      if (!a.ok) throw new Error("add");
      env = a.envelope;
    }
    writeCopies(s, env);
    const broken = { slug: "z", start: "soon" };
    s.map.set(
      LEGACY_COPIES_KEY,
      JSON.stringify([legacy("new-1", "2026-10-24T00:00:00.000Z"), legacy("new-2", "2026-10-23T00:00:00.000Z"), legacy(SLUGS[0]!, "2026-10-01T00:00:00.000Z"), broken]),
    );
    const r = moveLegacyCopies(s, { newId });
    expect(r).toEqual({ status: "moved", moved: 1, superseded: 1, kept: 2 });
    const after = readCopies(s.map.get(COPIES_KEY)!);
    if (!after.ok) throw new Error("read");
    expect(after.envelope.items).toHaveLength(DEVICE_COPY_CAP);
    expect(after.envelope.items.some((x) => x.slug === "new-1")).toBe(true); // the newest moves first
    expect(JSON.parse(s.map.get(LEGACY_COPIES_KEY)!)).toEqual([legacy("new-2", "2026-10-23T00:00:00.000Z"), broken]);
  });

  it("a draft newer than the envelope's copy of the same trip replaces it", () => {
    const s = spyStorage();
    const a = addCopy(emptyCopies(), INPUT, { now: new Date("2026-10-01T00:00:00Z"), newId: ids(12) });
    if (!a.ok) throw new Error("add");
    writeCopies(s, a.envelope);
    s.map.set(LEGACY_COPIES_KEY, JSON.stringify([legacy(INPUT.slug, "2026-10-20T00:00:00.000Z", { start: "2027-07-10" })]));
    expect(moveLegacyCopies(s, { newId: ids(13) })).toMatchObject({ status: "moved", moved: 1 });
    const after = readCopies(s.map.get(COPIES_KEY)!);
    expect(after.ok && after.envelope.items.map((x) => x.start)).toEqual(["2027-07-10"]);
  });

  it("property: a crash after the envelope write (old key not deleted) never duplicates a copy on the next run", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = rng(seed);
      const n = int(r, 1, 25);
      const drafts = Array.from({ length: n }, (_, i) => legacy(SLUGS[i]!, new Date(Date.UTC(2026, 8, 1) + int(r, 0, 1e9)).toISOString()));
      const s = spyStorage();
      s.map.set(LEGACY_COPIES_KEY, JSON.stringify(drafts));
      const crash: StorageLike = { getItem: (k) => s.getItem(k), setItem: (k, v) => s.setItem(k, v), removeItem: () => { throw new Error("crash"); } };
      const first = moveLegacyCopies(crash, { newId: ids(seed) });
      expect(first.status, `seed ${seed}`).toBe("moved");
      const second = moveLegacyCopies(s, { newId: ids(seed + 1000) });
      const env = readCopies(s.map.get(COPIES_KEY)!);
      if (!env.ok) throw new Error(`seed ${seed}`);
      const slugs = env.envelope.items.map((x) => x.slug);
      expect(new Set(slugs).size, `seed ${seed}`).toBe(slugs.length);
      expect(slugs.length, `seed ${seed}`).toBe(Math.min(n, DEVICE_COPY_CAP));
      expect(second, `seed ${seed}`).toMatchObject({ status: "moved", moved: 0, kept: Math.max(0, n - DEVICE_COPY_CAP) });
      // nothing is lost: every draft is in the envelope or still under the old key
      const left = s.map.has(LEGACY_COPIES_KEY) ? (JSON.parse(s.map.get(LEGACY_COPIES_KEY)!) as { slug: string }[]).map((d) => d.slug) : [];
      expect(new Set([...slugs, ...left]).size, `seed ${seed}`).toBe(n);
    }
  });
});

describe("the sign-in merge (nav 4.2), property tests", () => {
  /** What the account holds after applying a plan: insert on conflict (id) do nothing. */
  function apply(account: AccountDraftKey[], plan: ReturnType<typeof planMerge>): AccountDraftKey[] {
    const have = new Set(account.map((a) => a.id));
    return [...account, ...plan.insert.filter((r) => !have.has(r.id)).map((r) => ({ id: r.id, source_trip: r.source_trip, start: r.doc.start ?? null }))];
  }
  function world(seed: number): { copies: CopyItem[]; account: AccountDraftKey[] } {
    const r = rng(seed);
    const copies = Array.from({ length: int(r, 0, DEVICE_COPY_CAP) }, (_, i) => item(r, i));
    const account: AccountDraftKey[] = Array.from({ length: int(r, 0, ACCOUNT_DRAFT_CAP) }, () => {
      const kind = r();
      if (kind < 0.15 && copies.length) {
        const c = pick(r, copies);
        return { id: c.id, source_trip: c.slug, start: c.start }; // merged before
      }
      if (kind < 0.35 && copies.length) {
        const c = pick(r, copies);
        return { id: uuidFrom(r), source_trip: c.slug, start: c.start }; // the same trip and start, another draft
      }
      return { id: uuidFrom(r), source_trip: r() < 0.3 ? null : pick(r, SLUGS), start: r() < 0.3 ? null : pick(r, STARTS) };
    });
    // the account never holds the same id twice
    const seen = new Set<string>();
    return { copies, account: account.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))) };
  }

  it("is idempotent, honours the cap, never duplicates a trip and start, and accounts for every copy", () => {
    for (let seed = 1; seed <= 400; seed++) {
      const { copies, account } = world(seed);
      const plan = planMerge(copies, account);
      const after = apply(account, plan);
      const at = `seed ${seed}`;
      // every copy lands in exactly one bucket
      const buckets = [...plan.insert.map((x) => x.id), ...plan.already, ...plan.sameTrip, ...plan.overCap];
      expect(buckets.sort(), at).toEqual(copies.map((c) => c.id).sort());
      // the cap holds (an account already over it gains nothing)
      expect(after.length, at).toBeLessThanOrEqual(Math.max(ACCOUNT_DRAFT_CAP, account.length));
      if (account.length >= ACCOUNT_DRAFT_CAP) expect(plan.insert, at).toEqual([]);
      // no inserted copy repeats an account draft's trip and start, nor another inserted copy's
      const key = (a: AccountDraftKey) => `${a.source_trip}|${a.start}`;
      const existing = new Set(account.filter((a) => a.source_trip && a.start).map(key));
      const inserted = plan.insert.map((r) => key({ id: r.id, source_trip: r.source_trip, start: r.doc.start ?? null }));
      expect(inserted.some((k) => existing.has(k)), at).toBe(false);
      expect(new Set(inserted).size, at).toBe(inserted.length);
      // re-running against the result inserts nothing
      const again = planMerge(copies, after);
      expect(again.insert, at).toEqual([]);
      expect(apply(after, again), at).toEqual(after);
      // the newest copies go first: no over-cap copy is newer than an inserted one
      const time = new Map(copies.map((c) => [c.id, c.copiedAt]));
      const oldestIn = plan.insert.map((r) => time.get(r.id)!).sort()[0];
      if (oldestIn) for (const id of plan.overCap) expect(time.get(id)! <= oldestIn, at).toBe(true);
      // every row's doc is a valid trip-custom/1
      for (const row of plan.insert) expect(parseTripCustom(row.doc).success, at).toBe(true);
    }
  });

  it("a crash between the server write and emptying the envelope is safe", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { copies, account } = world(seed);
      const first = planMerge(copies, account);
      const server = apply(account, first); // written, then the tab died before markMerged
      const retry = planMerge(copies, server);
      expect(retry.insert, `seed ${seed}`).toEqual([]);
      expect([...retry.already, ...retry.sameTrip].sort(), `seed ${seed}`).toEqual([...first.insert.map((r) => r.id), ...first.already, ...first.sameTrip].sort());
    }
  });

  it("markMerged empties what the account took, keeps the over-cap copies, and records the account", () => {
    const r = rng(42);
    const copies = Array.from({ length: 5 }, (_, i) => item(r, i));
    const env: CopiesEnvelope = { ...emptyCopies(), items: copies };
    const full: AccountDraftKey[] = Array.from({ length: ACCOUNT_DRAFT_CAP - 2 }, () => ({ id: uuidFrom(r), source_trip: null, start: null }));
    const plan = planMerge(copies, full);
    expect(plan.insert).toHaveLength(2);
    expect(plan.overCap).toHaveLength(3);
    const after = markMerged(env, plan, "acct_hash_1234", NOW);
    expect(after.items.map((x) => x.id).sort()).toEqual([...plan.overCap].sort());
    expect(after.merged).toEqual({ acct_hash_1234: NOW.toISOString() });
    expect(parseEnvelope(after).success).toBe(true);
  });

  it("maps a copy onto planner_draft and trip-custom/1 (nav 4.2 rule 2), keeping from and gw", () => {
    const c = mustCopy({ ...INPUT, id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", copiedAt: NOW.toISOString(), from: "town:in-mh-mumbai", gw: { in: "YEG", out: "YYC" } });
    expect(copyToDraftRow(c)).toEqual({
      id: c.id,
      title: "Dolomites",
      source_trip: "dolomites-july-2027",
      doc: {
        schema: "trip-custom/1",
        profile: INPUT.profile,
        overrides: { "5": "C" },
        added: [{ op: "o-1", day: 5, ref: "place/pyramid-lake" }],
        start: "2027-07-03",
        travellers: { adults: 2, children: [6] },
        from: "town:in-mh-mumbai",
        gw: { in: "YEG", out: "YYC" },
      },
    });
    const bare = mustCopy({ ...INPUT, id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", copiedAt: NOW.toISOString() });
    expect(Object.keys(copyToTripCustom(bare))).not.toContain("from");
    expect(Object.keys(copyToTripCustom(bare))).not.toContain("gw");
  });
});

describe("privacy detector: planted copy fields (NAV-C, origin spec 8.1)", () => {
  const whys = (x: unknown) => privacyHits(x).map((h) => h.why);

  it("lists copiedAt, travellers and gw as private keys", () => {
    for (const k of ["copiedAt", "travellers", "gw", "added"]) expect(PRIVATE_KEYS).toContain(k);
  });

  it("fails a public payload with a planted travellers, copiedAt, gw or origin under from", () => {
    expect(whys({ trip: { slug: "x", travellers: { adults: 2, children: [6] } } })).toEqual(["a private key"]);
    expect(whys({ items: [{ slug: "x", copiedAt: "2026-10-25T14:02:11Z" }] })).toEqual(["a private key"]);
    expect(whys({ trip: { gw: { in: "YEG", out: "YYC" } } })).toEqual(["a private key"]);
    for (const from of ["iata:BOM", "hub:ottawa", "town:in-mh-mumbai", "gn:1275339", "TOWN:x"]) expect(whys({ trip: { from } }), from).toEqual(["a visitor's origin"]);
    expect(whys({ trip: { from: { ref: "town:in-mh-mumbai", label: "Mumbai" } } })).toEqual(["a visitor's origin"]);
    // a whole envelope, or one serialised into a string, fails
    const a = addCopy(emptyCopies(), { ...INPUT, from: "iata:BOM", gw: { in: "YYC", out: "YYC" } }, { now: NOW, newId: ids() });
    if (!a.ok) throw new Error("add");
    const hits = privacyHits({ body: JSON.stringify(a.envelope) }).map((h) => h.where);
    expect(hits).toEqual(expect.arrayContaining(["$.body<json>.items[0].added", "$.body<json>.items[0].copiedAt", "$.body<json>.items[0].from", "$.body<json>.items[0].gw"]));
  });

  it("hits never carry the value", () => {
    expect(JSON.stringify(privacyHits({ from: "town:in-mh-mumbai", travellers: { adults: 2, children: [6] } }))).not.toMatch(/mumbai|"6"|children/);
  });

  it("leaves the public uses of from alone: windows, age bands, legs and capture origins", () => {
    expect(whys({ window: { from: "07-13", to: "07-26" } })).toEqual([]);
    expect(whys({ age_band: { from: 6, to: null } })).toEqual([]);
    expect(whys({ legs: [{ from: "base/banff", to: "place/moraine-lake", min: 25 }] })).toEqual([]);
    expect(whys({ point: { from: "capture" } })).toEqual([]);
    expect(whys({ months: { from: "2027-07-03", to: "2027-07-10" } })).toEqual([]);
  });

  it("the detector's origin prefix covers every form the schema accepts", () => {
    for (const ref of ["iata:BOM", "hub:toronto", "town:in-mh-mumbai", "gn:1275339"]) {
      expect(ORIGIN_REFERENCE.test(ref)).toBe(true);
      expect(ORIGIN_REFERENCE_VALUE.test(ref)).toBe(true);
    }
  });
});
