import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ORIGIN_REFERENCE_VALUE, PRIVATE_KEYS, privacyHits } from "../../src/privacy/detect.ts";
import {
  ACCOUNT_DRAFT_CAP,
  addCopy,
  copiesEnvelope,
  COPIES_KEY,
  COPIES_SCHEMA,
  COPY_RING_KEYS,
  copyContentKey,
  copyIdentity,
  pickIdentity,
  slugIdentity,
  copyItem,
  copyToDraftRow,
  copyToTripCustom,
  DEVICE_COPY_CAP,
  emptyCopies,
  ENVELOPE_MAX_BYTES,
  envelopeRules,
  LEGACY_COPIES_KEY,
  LEGACY_MOVED_KEY,
  markMerged,
  memoryStorage,
  MERGED_MAX,
  moveLegacyCopies,
  needsMerge,
  parseCopy,
  parseCopyList,
  parseEnvelope,
  PLACEHOLDER_TITLE,
  planMerge,
  probeStorage,
  PROBE_KEY,
  readCopies,
  removeCopy,
  restoreCopy,
  SITE_PATH,
  updateCopies,
  writeCopies,
  type AccountDraftKey,
  type CopiesEnvelope,
  type CopyInput,
  type CopyItem,
  type MergePlan,
  type StorageLike,
} from "../../src/schema/copies.ts";
import { ORIGIN_REFERENCE, parseTripCustom, tripCustom } from "../../src/schema/trip-custom.ts";
import { PLAN_IDENTITY_KEYS } from "../../src/schema/identity.ts";

// copies/1 (navigation-and-mine.md 3, 4.2; Q204): the envelope, compare-and-set writes, the old-key move, the storage probe, the merge
// rule as property tests, and the detector keys for a planted copy field. Review NAV-C (26 Oct 2026) findings are named where tested.

const mustCopy = (x: unknown): CopyItem => {
  const r = parseCopy(x);
  if (!r.success) throw new Error(r.issues.join("; "));
  return r.data;
};
const mustPlan = (input: unknown, account: readonly AccountDraftKey[], cap?: number): MergePlan => {
  const r = planMerge(input, account, cap);
  if (!r.success) throw new Error(r.issues.join("; "));
  return r.data;
};

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

/** UUID v4 from a generator, lower case. */
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

/**
 * An instant written in a random precision (review M1): whole seconds, milliseconds, or a longer fraction. Seconds and
 * milliseconds sort wrongly as strings (`10:00:00Z` after `10:00:00.500Z`); only Date.parse orders them.
 */
function spell(ms: number, r: () => number): string {
  const iso = new Date(ms).toISOString(); // 2026-10-01T00:00:00.123Z
  const kind = int(r, 0, 2);
  if (kind === 0 && ms % 1000 === 0) return iso.replace(".000Z", "Z");
  if (kind === 2) return iso.replace("Z", "000Z");
  return iso;
}

function item(r: () => number, i: number): CopyItem {
  // whole seconds half the time, so equal-second spellings meet
  const ms = Date.UTC(2026, 9, 1) + int(r, 0, 1e6) * (r() < 0.5 ? 1000 : 1);
  return mustCopy({
    ...INPUT,
    id: uuidFrom(r),
    slug: SLUGS[i]!,
    start: pick(r, STARTS),
    copiedAt: spell(ms, r),
    ...(r() < 0.3 ? { fromRef: pick(r, ["iata:BOM", "hub:ottawa", "town:in-mh-mumbai", "gn:1275339"]) } : {}),
    ...(r() < 0.2 ? { gw: { in: "YEG", out: "YYC" } } : {}),
    ...(r() < 0.3 ? { rev: "2026-10-20.a1b2" } : {}),
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

/** Writes an envelope into an empty store (the compare-and-set base is "nothing stored"). */
function seed(s: StorageLike, env: CopiesEnvelope): string {
  const w = writeCopies(s, env, s.getItem(COPIES_KEY));
  if (!w.ok) throw new Error(w.reason);
  return w.raw;
}

describe("copies/1 envelope", () => {
  it("exports to JSON Schema (the schema subset rule: cross-field rules live in copyRules and envelopeRules)", () => {
    for (const s of [copyItem, copiesEnvelope, tripCustom]) expect(() => z.toJSONSchema(s, { target: "draft-2020-12", io: "input", unrepresentable: "throw" })).not.toThrow();
  });

  it("round-trips: add, write, read gives the same envelope", () => {
    const s = memoryStorage();
    const r = addCopy(emptyCopies(), { ...INPUT, fromRef: "iata:BOM", gw: { in: "YYC", out: "YYC" }, rev: "r1" }, { now: NOW, newId: ids() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const w = writeCopies(s, r.envelope, null);
    expect(w.ok).toBe(true);
    expect(readCopies(s.getItem(COPIES_KEY))).toEqual({ ok: true, envelope: r.envelope, fresh: false });
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
    const newer = JSON.stringify({ schema: "copies/3", items: [{ anything: true }] });
    expect(readCopies(newer)).toMatchObject({ ok: false, reason: "newer" });
    expect(readCopies("{not json")).toMatchObject({ ok: false, reason: "corrupt" });
    expect(readCopies(JSON.stringify({ ...emptyCopies(), extra: 1 }))).toMatchObject({ ok: false, reason: "invalid" });
    // the legacy move must not overwrite a newer envelope either
    const s = spyStorage();
    s.map.set(COPIES_KEY, newer);
    s.map.set(LEGACY_COPIES_KEY, JSON.stringify([{ slug: "a", start: "2027-07-03", adults: 2, children: [], savedAt: NOW.toISOString() }]));
    expect(moveLegacyCopies(s, { newId: ids() })).toEqual({ status: "failed", reason: "newer" });
    expect(s.map.get(COPIES_KEY)).toBe(newer);
    expect(s.map.has(LEGACY_COPIES_KEY)).toBe(true);
  });

  it("issues name a path, never the party, an override key, an account hash or an unknown key (review L4)", () => {
    const bad = { ...emptyCopies(), items: [{ id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", ...INPUT, children: [41], copiedAt: NOW.toISOString() }] };
    const r = readCopies(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("41");
    const keys = readCopies(JSON.stringify({ ...emptyCopies(), merged: { "secret hash!": NOW.toISOString() }, secretField: 1 }));
    expect(keys.ok).toBe(false);
    expect(JSON.stringify(keys)).not.toMatch(/secret/);
    const day = parseCopy({ ...INPUT, id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", copiedAt: NOW.toISOString(), overrides: { "77": "Q" } });
    expect(day.success).toBe(false);
    expect(JSON.stringify(day)).not.toContain("77");
  });

  it("copiedAt and the envelope times are UTC with Z only (review M1)", () => {
    const base = { ...INPUT, id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b" };
    for (const t of ["2026-10-25T14:02:11Z", "2026-10-25T14:02:11.5Z", "2026-10-25T14:02:11.123456Z"]) expect(parseCopy({ ...base, copiedAt: t }).success, t).toBe(true);
    for (const t of ["2026-10-25T14:02:11+05:00", "2026-10-25T14:02:11", "2026-10-25"]) expect(parseCopy({ ...base, copiedAt: t }).success, t).toBe(false);
    expect(parseEnvelope({ ...emptyCopies(), noteSeen: "2026-10-25T14:02:11+00:00" }).success).toBe(false);
  });

  it("enforces one copy per trip, unique ids, 20 a device, 4 KB a copy, 30 additions, 60 overrides", () => {
    const r = rng(7);
    const twenty = Array.from({ length: DEVICE_COPY_CAP }, (_, i) => item(r, i));
    expect(parseEnvelope({ ...emptyCopies(), items: twenty }).success).toBe(true);
    expect(parseEnvelope({ ...emptyCopies(), items: [...twenty, item(r, 20)] }).success).toBe(false);
    expect(parseEnvelope({ ...emptyCopies(), items: [twenty[0], { ...twenty[1]!, slug: twenty[0]!.slug }] })).toMatchObject({ success: false, issues: ["$.items: one copy per trip (Q204)"] });
    expect(parseEnvelope({ ...emptyCopies(), items: [twenty[0], { ...twenty[1]!, id: twenty[0]!.id }] })).toMatchObject({ success: false, issues: ["$.items: each copy has its own id"] });
    const base = mustCopy({ ...INPUT, id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", copiedAt: NOW.toISOString() });
    expect(parseCopy({ ...base, added: Array.from({ length: 31 }, () => ({ day: 1, placeSlug: "x" })) }).success).toBe(false);
    expect(parseCopy({ ...base, overrides: Object.fromEntries(Array.from({ length: 61 }, (_, i) => [String(i + 1), "A"])) })).toMatchObject({ success: false, issues: ["$.overrides: at most 60 overrides"] });
    const thirty = Array.from({ length: 30 }, (_, i) => ({ day: (i % 99) + 1, placeSlug: `${"p".repeat(90)}-${i}` }));
    const sixty = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [String(i + 1), "A"]));
    expect(parseCopy({ ...base, added: thirty }).success).toBe(true);
    expect(JSON.stringify({ ...base, added: thirty, overrides: sixty }).length).toBeGreaterThan(4096);
    expect(parseCopy({ ...base, added: thirty, overrides: sixty })).toMatchObject({ success: false, issues: ["$: a copy is at most 4096 bytes"] });
    // a full-sized realistic copy stays inside 4 KB, and 20 of them inside the envelope bound
    const full = { ...base, added: Array.from({ length: 30 }, (_, i) => ({ day: (i % 14) + 1, placeSlug: `place-name-${i}` })), overrides: Object.fromEntries(Array.from({ length: 14 }, (_, i) => [String(i + 1), "B"])) };
    expect(parseCopy(full).success).toBe(true);
    expect(JSON.stringify({ ...emptyCopies(), items: Array.from({ length: 20 }, () => full) }).length).toBeLessThan(80 * 1024);
  });

  it("bounds merged to 10 accounts and the whole envelope by size (review L2)", () => {
    const merged = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`account_${String(i).padStart(4, "0")}`, NOW.toISOString()]));
    expect(parseEnvelope({ ...emptyCopies(), merged: merged(MERGED_MAX) }).success).toBe(true);
    expect(parseEnvelope({ ...emptyCopies(), merged: merged(MERGED_MAX + 1) })).toMatchObject({ success: false, issues: [`$.merged: at most ${MERGED_MAX} accounts`] });
    // the byte rule is reachable only through the rule function (20 copies of 4 KB and 10 hashes stay under it): pin it there
    const big = { ...emptyCopies(), noteSeen: null, items: [] as CopyItem[], merged: { ["a".repeat(ENVELOPE_MAX_BYTES)]: NOW.toISOString() } };
    expect(envelopeRules(big)).toContain(`$: an envelope is at most ${ENVELOPE_MAX_BYTES} bytes`);
    const biggestAllowed = {
      ...emptyCopies(),
      items: Array.from({ length: 20 }, (_, i) => mustCopy({ ...INPUT, slug: SLUGS[i]!, id: uuidFrom(rng(i + 100)), copiedAt: NOW.toISOString(), title: "T".repeat(120), added: Array.from({ length: 30 }, (_, j) => ({ day: 99, placeSlug: `${"p".repeat(90)}-${j}` })) })),
      merged: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`${"h".repeat(124)}${String(i).padStart(4, "0")}`, NOW.toISOString()])),
    };
    expect(envelopeRules(biggestAllowed)).toEqual([]);
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
      { fromRef: "Mumbai" },
      { from: "iata:BOM" },
      { gw: { in: "YEG", out: "YYC", via: "YVR" } },
      { rev: "has space" },
      { copiedAt: "yesterday" },
    ]) {
      expect(parseCopy({ ...base, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it.each([
    ["/img/trips/dolomites/cover-400.webp", true],
    ["/a", true],
    ["//evil.example/x.gif", false],
    ["/\\evil.example/x", false],
    ["/img\\x.webp", false],
    ["/img/x y.webp", false],
    ['/img/x".webp', false],
    ["/img/<x>.webp", false],
    ["img/x.webp", false],
    ["https://example.com/x.webp", false],
    [`/${"x".repeat(299)}`, true],
    [`/${"x".repeat(300)}`, false],
  ])("photo %s valid: %s (review L1)", (photo, ok) => {
    expect(SITE_PATH.test(photo)).toBe(ok);
    expect(parseCopy({ ...INPUT, id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", copiedAt: NOW.toISOString(), photo }).success).toBe(ok);
  });
});

describe("compare-and-set writes (review C1)", () => {
  it("refuses to overwrite a newer envelope", () => {
    const s = spyStorage();
    const newer = JSON.stringify({ schema: "copies/3", items: [] });
    s.map.set(COPIES_KEY, newer);
    // a stale tab that read copies/1 before the upgrade, and one that read nothing
    expect(writeCopies(s, emptyCopies(), JSON.stringify(emptyCopies()))).toEqual({ ok: false, reason: "newer" });
    expect(writeCopies(s, emptyCopies(), null)).toEqual({ ok: false, reason: "newer" });
    expect(writeCopies(s, emptyCopies(), newer)).toEqual({ ok: false, reason: "newer" });
    expect(s.map.get(COPIES_KEY)).toBe(newer);
    expect(updateCopies(s, (env) => ({ envelope: env, value: null }))).toEqual({ ok: false, reason: "newer" });
    expect(s.map.get(COPIES_KEY)).toBe(newer);
  });

  it("refuses a write whose base is not what is stored now", () => {
    const s = spyStorage();
    const first = seed(s, emptyCopies());
    const a = addCopy(emptyCopies(), INPUT, { now: NOW, newId: ids() });
    if (!a.ok) throw new Error("add");
    const second = seed(s, a.envelope);
    expect(writeCopies(s, emptyCopies(), first)).toEqual({ ok: false, reason: "changed" });
    expect(writeCopies(s, emptyCopies(), null)).toEqual({ ok: false, reason: "changed" });
    expect(s.map.get(COPIES_KEY)).toBe(second);
    expect(writeCopies(s, emptyCopies(), second).ok).toBe(true);
  });

  it("two tabs: a stale remove does not lose the other tab's add (the lost update)", () => {
    const s = spyStorage();
    const newId = ids(21);
    const one = addCopy(emptyCopies(), { ...INPUT, slug: "trip-a" }, { now: NOW, newId });
    if (!one.ok) throw new Error("add");
    seed(s, one.envelope);
    // tab A reads the envelope and holds it
    const baseA = s.getItem(COPIES_KEY);
    const envA = readCopies(baseA);
    if (!envA.ok) throw new Error("read");
    // tab B adds a copy
    const b = updateCopies(s, (env) => {
      const r = addCopy(env, { ...INPUT, slug: "trip-b" }, { now: NOW, newId });
      return r.ok ? { envelope: r.envelope, value: r.item } : { envelope: null, value: null };
    });
    expect(b.ok).toBe(true);
    // tab A's blind write from its stale envelope is refused
    const stale = removeCopy(envA.envelope, one.item.id);
    expect(writeCopies(s, stale.envelope, baseA)).toEqual({ ok: false, reason: "changed" });
    // tab A through updateCopies re-reads and re-applies the remove: both changes survive
    const a = updateCopies(s, (env) => {
      const r = removeCopy(env, one.item.id);
      return { envelope: r.envelope, value: r.removed };
    });
    expect(a.ok).toBe(true);
    const after = readCopies(s.getItem(COPIES_KEY));
    expect(after.ok && after.envelope.items.map((x) => x.slug)).toEqual(["trip-b"]);
  });

  it("updateCopies re-applies once when another tab writes between its read and its write", () => {
    const s = spyStorage();
    seed(s, emptyCopies());
    const newId = ids(22);
    let interfere = true;
    let calls = 0;
    const r = updateCopies(s, (env) => {
      calls++;
      if (interfere) {
        interfere = false;
        // the other tab lands its add after this tab's read
        const other = addCopy(env, { ...INPUT, slug: "other" }, { now: NOW, newId });
        if (!other.ok) throw new Error("other");
        s.map.set(COPIES_KEY, JSON.stringify(other.envelope));
      }
      const mine = addCopy(env, { ...INPUT, slug: "mine" }, { now: NOW, newId });
      return mine.ok ? { envelope: mine.envelope, value: mine.item.slug } : { envelope: null, value: "refused" };
    });
    expect(calls).toBe(2);
    expect(r).toMatchObject({ ok: true, value: "mine" });
    const after = readCopies(s.getItem(COPIES_KEY));
    expect(after.ok && after.envelope.items.map((x) => x.slug).sort()).toEqual(["mine", "other"]);
  });

  it("updateCopies writes nothing when the change refuses (the replace prompt, the cap)", () => {
    const s = spyStorage();
    const raw = seed(s, emptyCopies());
    expect(updateCopies(s, () => ({ envelope: null, value: "exists" }))).toEqual({ ok: false, reason: "refused", value: "exists" });
    expect(s.map.get(COPIES_KEY)).toBe(raw);
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
    expect(writeCopies(p.storage, a.envelope, null).ok).toBe(true);
    expect(readCopies(p.storage.getItem(COPIES_KEY))).toMatchObject({ ok: true, envelope: a.envelope });
  });
  it("writeCopies reports quota, blocked, unverified and invalid, and never writes an invalid envelope", () => {
    const env = emptyCopies();
    expect(writeCopies(spyStorage({ failSetOn: COPIES_KEY, quota: true }), env, null)).toEqual({ ok: false, reason: "quota" });
    expect(writeCopies(spyStorage({ failSetOn: COPIES_KEY }), env, null)).toEqual({ ok: false, reason: "blocked" });
    expect(writeCopies(spyStorage({ throwOnGet: true }), env, null)).toEqual({ ok: false, reason: "blocked" });
    expect(writeCopies(spyStorage({ dropWrites: true }), env, null)).toEqual({ ok: false, reason: "unverified" });
    const s = spyStorage();
    expect(writeCopies(s, { ...env, schema: "copies/3" } as unknown as CopiesEnvelope, null)).toEqual({ ok: false, reason: "invalid" });
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
    expect(r).toEqual({ status: "moved", moved: 2, superseded: 0, kept: 0, dropped: 0 });
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
    expect(s.map.has(LEGACY_MOVED_KEY)).toBe(false); // the marker only follows a good write
  });

  it("keeps the old key when the write is not read back", () => {
    const s = spyStorage({ dropWrites: true });
    const text = JSON.stringify([legacy("a", "2026-10-20T10:00:00.000Z")]);
    s.map.set(LEGACY_COPIES_KEY, text);
    expect(moveLegacyCopies(s, { newId: ids() })).toEqual({ status: "failed", reason: "write-failed" });
    expect(s.map.get(LEGACY_COPIES_KEY)).toBe(text);
  });

  it("reports a read that throws as read-failed (review L5), and leaves an unreadable old key alone", () => {
    expect(moveLegacyCopies(spyStorage({ throwOnGet: true }), { newId: ids() })).toEqual({ status: "failed", reason: "read-failed" });
    const s = spyStorage();
    s.map.set(LEGACY_COPIES_KEY, "nope");
    expect(moveLegacyCopies(s, { newId: ids() })).toEqual({ status: "failed", reason: "legacy-unreadable" });
    expect(s.map.get(LEGACY_COPIES_KEY)).toBe("nope");
  });

  it("refuses with changed when another tab wrote the envelope during the move (compare-and-set against what it read)", () => {
    const s = spyStorage();
    const text = JSON.stringify([legacy("a", "2026-10-20T10:00:00.000Z")]);
    s.map.set(LEGACY_COPIES_KEY, text);
    const other = addCopy(emptyCopies(), { ...INPUT, slug: "other" }, { now: NOW, newId: ids(30) });
    if (!other.ok) throw new Error("add");
    let sneaked = false;
    // the other tab writes right after the move reads the envelope
    const racing: StorageLike = {
      getItem: (k) => {
        const v = s.getItem(k);
        if (k === COPIES_KEY && !sneaked) {
          sneaked = true;
          s.map.set(COPIES_KEY, JSON.stringify(other.envelope));
        }
        return v;
      },
      setItem: (k, v) => s.setItem(k, v),
      removeItem: (k) => s.removeItem(k),
    };
    expect(moveLegacyCopies(racing, { newId: ids(31) })).toEqual({ status: "failed", reason: "changed" });
    expect(s.map.get(LEGACY_COPIES_KEY)).toBe(text);
    expect(s.map.has(LEGACY_MOVED_KEY)).toBe(false);
    expect(s.map.get(COPIES_KEY)).toBe(JSON.stringify(other.envelope));
    // the next run sees the other tab's envelope and moves on top of it
    expect(moveLegacyCopies(s, { newId: ids(32) })).toMatchObject({ status: "moved", moved: 1 });
    const after = readCopies(s.map.get(COPIES_KEY)!);
    expect(after.ok && after.envelope.items.map((x) => x.slug).sort()).toEqual(["a", "other"]);
  });

  it("over the device cap (kept) or unusable (dropped) drafts stay under the old key; an older draft of a copied trip is superseded", () => {
    const s = spyStorage();
    const newId = ids(11);
    let env = emptyCopies();
    for (let i = 0; i < 19; i++) {
      const a = addCopy(env, { ...INPUT, slug: SLUGS[i]! }, { now: NOW, newId });
      if (!a.ok) throw new Error("add");
      env = a.envelope;
    }
    seed(s, env);
    const broken = { slug: "z", start: "soon" };
    s.map.set(
      LEGACY_COPIES_KEY,
      JSON.stringify([legacy("new-1", "2026-10-24T00:00:00.000Z"), legacy("new-2", "2026-10-23T00:00:00.000Z"), legacy(SLUGS[0]!, "2026-10-01T00:00:00.000Z"), broken]),
    );
    const r = moveLegacyCopies(s, { newId });
    expect(r).toEqual({ status: "moved", moved: 1, superseded: 1, kept: 1, dropped: 1 });
    const after = readCopies(s.map.get(COPIES_KEY)!);
    if (!after.ok) throw new Error("read");
    expect(after.envelope.items).toHaveLength(DEVICE_COPY_CAP);
    expect(after.envelope.items.some((x) => x.slug === "new-1")).toBe(true); // the newest moves first
    expect(JSON.parse(s.map.get(LEGACY_COPIES_KEY)!)).toEqual([legacy("new-2", "2026-10-23T00:00:00.000Z"), broken]);
  });

  it("a draft newer than the envelope's copy of the same trip replaces it, compared as instants (review M1)", () => {
    const s = spyStorage();
    // the envelope's copy is at 10:00:00.500; the draft at 10:00:01 written without a fraction sorts BEFORE it as a string
    const a = addCopy(emptyCopies(), INPUT, { now: new Date("2026-10-20T10:00:00.500Z"), newId: ids(12) });
    if (!a.ok) throw new Error("add");
    seed(s, a.envelope);
    s.map.set(LEGACY_COPIES_KEY, JSON.stringify([legacy(INPUT.slug, "2026-10-20T10:00:01Z", { start: "2027-07-10" })]));
    expect("2026-10-20T10:00:01Z" < "2026-10-20T10:00:00.500Z").toBe(false);
    expect("2026-10-20T10:00:00Z" > "2026-10-20T10:00:00.500Z").toBe(true); // the trap a string compare falls into
    expect(moveLegacyCopies(s, { newId: ids(13) })).toMatchObject({ status: "moved", moved: 1 });
    const after = readCopies(s.map.get(COPIES_KEY)!);
    expect(after.ok && after.envelope.items.map((x) => x.start)).toEqual(["2027-07-10"]);
    // and a whole-second draft OLDER than a fractional copy stays superseded
    const s2 = spyStorage();
    seed(s2, a.envelope);
    s2.map.set(LEGACY_COPIES_KEY, JSON.stringify([legacy(INPUT.slug, "2026-10-20T10:00:00Z", { start: "2027-07-10" })]));
    expect(moveLegacyCopies(s2, { newId: ids(14) })).toMatchObject({ status: "moved", moved: 0, superseded: 1 });
  });

  it("property: a crash on the first old-key write (delete or rewrite) never duplicates or loses a copy, and the marker ends the move (review M6)", () => {
    let crashedSet = 0;
    let crashedRemove = 0;
    for (let seedN = 1; seedN <= 60; seedN++) {
      const r = rng(seedN);
      const n = int(r, 1, 25);
      const drafts = Array.from({ length: n }, (_, i) => legacy(SLUGS[i]!, new Date(Date.UTC(2026, 8, 1) + int(r, 0, 1e9)).toISOString()));
      const s = spyStorage();
      s.map.set(LEGACY_COPIES_KEY, JSON.stringify(drafts));
      let crashed = false;
      const crash: StorageLike = {
        getItem: (k) => s.getItem(k),
        setItem: (k, v) => {
          if (k === LEGACY_COPIES_KEY && !crashed) {
            crashed = true;
            crashedSet++;
            throw new Error("crash");
          }
          s.setItem(k, v);
        },
        removeItem: (k) => {
          if (k === LEGACY_COPIES_KEY && !crashed) {
            crashed = true;
            crashedRemove++;
            throw new Error("crash");
          }
          s.removeItem(k);
        },
      };
      const at = `seed ${seedN}`;
      const first = moveLegacyCopies(crash, { newId: ids(seedN) });
      expect(first.status, at).toBe("moved");
      expect(crashed, at).toBe(true);
      expect(s.map.get(LEGACY_COPIES_KEY), at).toBe(JSON.stringify(drafts)); // the crash left the old key as it was
      const second = moveLegacyCopies(s, { newId: ids(seedN + 1000) });
      const env = readCopies(s.map.get(COPIES_KEY)!);
      if (!env.ok) throw new Error(at);
      const slugs = env.envelope.items.map((x) => x.slug);
      expect(new Set(slugs).size, at).toBe(slugs.length);
      expect(slugs.length, at).toBe(Math.min(n, DEVICE_COPY_CAP));
      expect(first, at).toMatchObject({ moved: Math.min(n, DEVICE_COPY_CAP), kept: Math.max(0, n - DEVICE_COPY_CAP), dropped: 0 });
      expect(second, at).toEqual({ status: "none" }); // the marker was set after the good envelope write
      // nothing is lost: every draft is in the envelope or still under the old key
      const left = s.map.has(LEGACY_COPIES_KEY) ? (JSON.parse(s.map.get(LEGACY_COPIES_KEY)!) as { slug: string }[]).map((d) => d.slug) : [];
      expect(new Set([...slugs, ...left]).size, at).toBe(n);
    }
    // both crash points were exercised
    expect(crashedSet).toBeGreaterThan(0);
    expect(crashedRemove).toBeGreaterThan(0);
  });
});

describe("NAV-2C: legacy drafts map leniently and move once (NAV-C-HANDOFF M3, L3, L5)", () => {
  const MOVE_AT = new Date("2026-11-02T08:00:00.000Z");
  const legacy = (slug: string, savedAt: string | undefined, extra: Record<string, unknown> = {}) => ({ slug, start: "2027-07-03", adults: 2, children: [6], ...(savedAt === undefined ? {} : { savedAt }), ...extra });
  const envOf = (s: StorageLike): CopiesEnvelope => {
    const r = readCopies(s.getItem(COPIES_KEY));
    if (!r.ok) throw new Error(r.reason);
    return r.envelope;
  };
  const moveOne = (draft: unknown, opts: Partial<Parameters<typeof moveLegacyCopies>[1]> = {}) => {
    const s = spyStorage();
    s.map.set(LEGACY_COPIES_KEY, JSON.stringify([draft]));
    const r = moveLegacyCopies(s, { newId: ids(50), now: MOVE_AT, ...opts });
    return { r, s, items: s.map.has(COPIES_KEY) ? envOf(s).items : [] };
  };

  it("a draft with one bad override, addition or profile moves without it", () => {
    const { r, items } = moveOne(legacy("dolomites-july-2027", "2026-10-20T10:00:00.000Z", {
      overrides: { 3: "B", 5: "Z", 0: "A", 100: "C", x: "A", 7: "c", 8: 1 },
      added: [{ day: 5, placeSlug: "pyramid-lake" }, { day: 5, placeSlug: "Not A Slug" }, { day: 0, placeSlug: "x" }, "junk", { day: 2, placeSlug: "lake-louise", extra: 1 }],
      profile: { ...INPUT.profile, pace: "sprint" },
    }));
    expect(r).toEqual({ status: "moved", moved: 1, superseded: 0, kept: 0, dropped: 0 });
    expect(items[0]).toMatchObject({ overrides: { "3": "B", "7": "C" }, added: [{ day: 5, placeSlug: "pyramid-lake" }], profile: null, copiedAt: "2026-10-20T10:00:00.000Z" });
  });

  it("clamps the party to the schema: a child of 19 is 17, adults 1 to 12, at most 12 children, non-numbers dropped", () => {
    expect(moveOne(legacy("a", undefined, { children: [19, -2, 4.6, "7", null, "x"] })).items[0]).toMatchObject({ adults: 2, children: [17, 0, 5, 7] });
    expect(moveOne(legacy("a", undefined, { adults: 0 })).items[0]!.adults).toBe(1);
    expect(moveOne(legacy("a", undefined, { adults: 40 })).items[0]!.adults).toBe(12);
    expect(moveOne(legacy("a", undefined, { adults: "lots", profile: { ...INPUT.profile, adults: 1 } })).items[0]!.adults).toBe(1);
    expect(moveOne(legacy("a", undefined, { adults: undefined })).items[0]!.adults).toBe(2);
    expect(moveOne(legacy("a", undefined, { children: Array.from({ length: 20 }, () => 3) })).items[0]!.children).toHaveLength(12);
    expect(moveOne(legacy("a", undefined, { children: "two" })).items[0]!.children).toEqual([]);
  });

  it("copiedAt is savedAt as UTC Z, else the move time", () => {
    expect(moveOne(legacy("a", "2026-10-20T15:30:00+05:30")).items[0]!.copiedAt).toBe("2026-10-20T10:00:00.000Z");
    for (const bad of [undefined, "yesterday", "", "+275760-09-13T00:00:00.001Z", 8.64e15 + 1, {}]) {
      expect(moveOne(legacy("a", undefined, bad === undefined ? {} : { savedAt: bad })).items[0]!.copiedAt, String(bad)).toBe(MOVE_AT.toISOString());
    }
  });

  it("a bad or throwing snapshot falls back to the placeholder; a good one is used", () => {
    expect(moveOne(legacy("a", undefined), { snapshot: () => ({ title: " ", days: 0, cc: "it", photo: "//x" }) }).items[0]).toMatchObject({ title: PLACEHOLDER_TITLE, days: null, cc: null, photo: null });
    expect(moveOne(legacy("a", undefined), { snapshot: () => { throw new Error("no row"); } }).items[0]!.title).toBe(PLACEHOLDER_TITLE);
    expect(moveOne(legacy("a", undefined), { snapshot: () => ({ title: "Alps", days: 9, cc: "CH", photo: "/img/a.webp" }) }).items[0]).toMatchObject({ title: "Alps", days: 9, cc: "CH", photo: "/img/a.webp" });
  });

  it("a draft over 4 KB sheds additions until it fits instead of being refused", () => {
    const long = Array.from({ length: 30 }, (_, i) => ({ day: (i % 99) + 1, placeSlug: `${"p".repeat(90)}-${i}` }));
    const sixty = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [String(i + 1), "A"]));
    const { r, items } = moveOne(legacy("a", undefined, { added: long, overrides: sixty }));
    expect(r).toMatchObject({ moved: 1, dropped: 0 });
    expect(items[0]!.added.length).toBeLessThan(30);
    expect(items[0]!.added).toEqual(long.slice(0, items[0]!.added.length)); // the first ones kept, in order
    expect(Object.keys(items[0]!.overrides)).toHaveLength(60);
  });

  it("drops (and counts) only entries with no valid slug or start, and keeps them under the old key", () => {
    const bad = [null, 3, "x", [], {}, { slug: "Bad Slug", start: "2027-07-03" }, { slug: "../x", start: "2027-07-03" }, { slug: "a", start: "2027-02-30" }, { slug: "a", start: "soon" }, { slug: "a" }];
    const s = spyStorage();
    s.map.set(LEGACY_COPIES_KEY, JSON.stringify([...bad, legacy("ok", undefined)]));
    expect(moveLegacyCopies(s, { newId: ids(51), now: MOVE_AT })).toEqual({ status: "moved", moved: 1, superseded: 0, kept: 0, dropped: bad.length });
    expect(JSON.parse(s.map.get(LEGACY_COPIES_KEY)!)).toEqual(bad);
    expect(envOf(s).items.map((x) => x.slug)).toEqual(["ok"]);
  });

  it("property: any legacy shape yields a valid copy or a counted drop, and every entry is accounted for", () => {
    const junk = (r: () => number): unknown => pick(r, [null, undefined, -1, 0, 19, 4.5, 1e9, NaN, "", "x", "2027-07-03", "A", [], [1, "b"], {}, { a: 1 }, true]);
    const field = <T,>(r: () => number, good: () => T): unknown => (r() < 0.55 ? good() : junk(r));
    for (let seedN = 1; seedN <= 300; seedN++) {
      const r = rng(seedN);
      const n = int(r, 0, 30);
      const list = Array.from({ length: n }, (_, i) => {
        if (r() < 0.08) return junk(r);
        const d: Record<string, unknown> = {
          slug: field(r, () => (r() < 0.8 ? SLUGS[int(r, 0, 25)]! : `x-${i}`)),
          start: field(r, () => pick(r, STARTS)),
          adults: field(r, () => int(r, -3, 30)),
          children: field(r, () => Array.from({ length: int(r, 0, 15) }, () => (r() < 0.8 ? int(r, -5, 40) : junk(r)))),
          savedAt: field(r, () => new Date(Date.UTC(2026, 8, 1) + int(r, 0, 1e9)).toISOString()),
          profile: field(r, () => ({ ...INPUT.profile, youngest: r() < 0.8 ? int(r, 0, 17) : 30 })),
          overrides: field(r, () => Object.fromEntries(Array.from({ length: int(r, 0, 70) }, () => [String(int(r, 0, 120)), pick(r, ["A", "B", "C", "b", "Q", 1])]))),
          added: field(r, () => Array.from({ length: int(r, 0, 40) }, () => (r() < 0.8 ? { day: int(r, 0, 100), placeSlug: r() < 0.9 ? `${"p".repeat(int(r, 1, 90))}-${int(r, 0, 9)}` : "No" } : junk(r)))),
        };
        for (const k of Object.keys(d)) if (d[k] === undefined || r() < 0.05) delete d[k];
        if (r() < 0.1) d.extra = junk(r);
        return d;
      });
      const s = spyStorage();
      s.map.set(LEGACY_COPIES_KEY, JSON.stringify(list));
      const parsedList = JSON.parse(s.map.get(LEGACY_COPIES_KEY)!) as unknown[];
      const at = `seed ${seedN}`;
      const res = moveLegacyCopies(s, { newId: ids(seedN), now: MOVE_AT });
      if (res.status !== "moved") throw new Error(`${at}: ${JSON.stringify(res)}`);
      expect(res.moved + res.superseded + res.kept + res.dropped, at).toBe(parsedList.length);
      const env = readCopies(s.map.get(COPIES_KEY)!);
      expect(env.ok, at).toBe(true);
      if (!env.ok) continue;
      expect(env.envelope.items.length, at).toBe(res.moved); // into an empty envelope, a moved draft is a new copy (or replaced a same-trip one)
      // a draft is dropped exactly when it has no valid slug or start
      const usable = (d: unknown) => !!d && typeof d === "object" && !Array.isArray(d) && typeof (d as { slug?: unknown }).slug === "string" && /^[a-z0-9][a-z0-9-]{0,99}$/.test((d as { slug: string }).slug) && typeof (d as { start?: unknown }).start === "string" && parseCopy({ ...INPUT, id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", copiedAt: NOW.toISOString(), start: (d as { start?: unknown }).start }).success;
      expect(res.dropped, at).toBe(parsedList.filter((d) => !usable(d)).length);
      expect(s.map.get(LEGACY_MOVED_KEY), at).toBe(MOVE_AT.toISOString());
      // what is left under the old key is exactly the kept and the dropped entries
      const left = s.map.has(LEGACY_COPIES_KEY) ? (JSON.parse(s.map.get(LEGACY_COPIES_KEY)!) as unknown[]) : [];
      expect(left.length, at).toBe(res.kept + res.dropped);
    }
  });

  it("move once: a second run moves nothing, even with new drafts under the old key", () => {
    const s = spyStorage();
    s.map.set(LEGACY_COPIES_KEY, JSON.stringify([legacy("a", "2026-10-20T10:00:00.000Z")]));
    expect(moveLegacyCopies(s, { newId: ids(60), now: MOVE_AT })).toMatchObject({ status: "moved", moved: 1 });
    expect(s.map.get(LEGACY_MOVED_KEY)).toBe(MOVE_AT.toISOString());
    const after = s.map.get(COPIES_KEY);
    s.map.set(LEGACY_COPIES_KEY, JSON.stringify([legacy("b", "2026-10-21T10:00:00.000Z")])); // an old page still open in a tab
    expect(moveLegacyCopies(s, { newId: ids(61) })).toEqual({ status: "none" });
    expect(s.map.get(COPIES_KEY)).toBe(after);
  });

  it("the marker is set even when nothing moved (all superseded or dropped), and never after a refused or failed write", () => {
    const s = spyStorage();
    s.map.set(LEGACY_COPIES_KEY, JSON.stringify([{ slug: "a" }]));
    expect(moveLegacyCopies(s, { newId: ids(62), now: MOVE_AT })).toEqual({ status: "moved", moved: 0, superseded: 0, kept: 0, dropped: 1 });
    expect(s.map.has(LEGACY_MOVED_KEY)).toBe(true);
    for (const failing of [spyStorage({ dropWrites: true }), spyStorage({ failSetOn: COPIES_KEY })]) {
      failing.map.set(LEGACY_COPIES_KEY, JSON.stringify([legacy("a", undefined)]));
      expect(moveLegacyCopies(failing, { newId: ids(63) })).toEqual({ status: "failed", reason: "write-failed" });
      expect(failing.map.has(LEGACY_MOVED_KEY)).toBe(false);
    }
    const newer = spyStorage();
    newer.map.set(COPIES_KEY, JSON.stringify({ schema: "copies/3", items: [] }));
    newer.map.set(LEGACY_COPIES_KEY, JSON.stringify([legacy("a", undefined)]));
    expect(moveLegacyCopies(newer, { newId: ids(64) })).toEqual({ status: "failed", reason: "newer" });
    expect(newer.map.has(LEGACY_MOVED_KEY)).toBe(false);
  });

  it("Undo at the cap: Remove, then the next read, does not refill the slot from kept drafts, so the toast's Undo succeeds", () => {
    const s = spyStorage();
    const drafts = Array.from({ length: DEVICE_COPY_CAP + 3 }, (_, i) => legacy(SLUGS[i]!, new Date(Date.UTC(2026, 9, 1, i)).toISOString()));
    s.map.set(LEGACY_COPIES_KEY, JSON.stringify(drafts));
    expect(moveLegacyCopies(s, { newId: ids(70), now: MOVE_AT })).toEqual({ status: "moved", moved: DEVICE_COPY_CAP, superseded: 0, kept: 3, dropped: 0 });
    const victim = envOf(s).items[0]!;
    const removed = updateCopies(s, (env) => {
      const r = removeCopy(env, victim.id);
      return { envelope: r.envelope, value: r.removed };
    });
    expect(removed.ok).toBe(true);
    // Mine reads again (another page, a refresh): the move runs first and must not pull a kept draft into the free slot
    expect(moveLegacyCopies(s, { newId: ids(71) })).toEqual({ status: "none" });
    expect(envOf(s).items).toHaveLength(DEVICE_COPY_CAP - 1);
    const undo = updateCopies(s, (env) => {
      const r = restoreCopy(env, victim);
      return r.ok ? { envelope: r.envelope, value: true } : { envelope: null, value: false };
    });
    expect(undo).toMatchObject({ ok: true, value: true });
    expect(envOf(s).items).toHaveLength(DEVICE_COPY_CAP);
    // the three oldest stay under the old key for "3 older copies did not fit"
    expect((JSON.parse(s.map.get(LEGACY_COPIES_KEY)!) as { slug: string }[]).map((d) => d.slug).sort()).toEqual([SLUGS[0], SLUGS[1], SLUGS[2]].sort());
  });

  it("a removed copy does not come back on the next read (review L3)", () => {
    const s = spyStorage();
    s.map.set(LEGACY_COPIES_KEY, JSON.stringify([legacy("a", "2026-10-20T10:00:00.000Z"), legacy("b", undefined)]));
    moveLegacyCopies(s, { newId: ids(72), now: MOVE_AT });
    for (const x of envOf(s).items) updateCopies(s, (env) => ({ envelope: removeCopy(env, x.id).envelope, value: null }));
    expect(moveLegacyCopies(s, { newId: ids(73) })).toEqual({ status: "none" });
    expect(envOf(s).items).toEqual([]);
  });

  it("dated drafts move before undated ones at the cap; an undated draft never replaces a copy of its trip", () => {
    const s = spyStorage();
    const dated = Array.from({ length: DEVICE_COPY_CAP }, (_, i) => legacy(SLUGS[i]!, new Date(Date.UTC(2020, 0, 1, i)).toISOString()));
    s.map.set(LEGACY_COPIES_KEY, JSON.stringify([legacy("undated", undefined), ...dated]));
    expect(moveLegacyCopies(s, { newId: ids(74), now: MOVE_AT })).toMatchObject({ moved: DEVICE_COPY_CAP, kept: 1 });
    expect(envOf(s).items.some((x) => x.slug === "undated")).toBe(false);
    // the envelope holds an old copy of a trip; an undated draft of that trip is superseded, not moved over it
    const t = spyStorage();
    const a = addCopy(emptyCopies(), INPUT, { now: new Date("2020-01-01T00:00:00Z"), newId: ids(75) });
    if (!a.ok) throw new Error("add");
    seed(t, a.envelope);
    t.map.set(LEGACY_COPIES_KEY, JSON.stringify([legacy(INPUT.slug, undefined, { start: "2029-01-01" })]));
    expect(moveLegacyCopies(t, { newId: ids(76), now: MOVE_AT })).toMatchObject({ moved: 0, superseded: 1 });
    expect(envOf(t).items[0]!.start).toBe(INPUT.start);
  });

  it("property: if the marker cannot be written, the next run duplicates nothing, loses nothing and replaces no copy", () => {
    for (let seedN = 1; seedN <= 60; seedN++) {
      const r = rng(seedN + 500);
      const n = int(r, 1, 25);
      const drafts = Array.from({ length: n }, (_, i) => legacy(SLUGS[i]!, r() < 0.3 ? undefined : new Date(Date.UTC(2026, 8, 1) + int(r, 0, 1e9)).toISOString()));
      const s = spyStorage({ failSetOn: LEGACY_MOVED_KEY });
      s.map.set(LEGACY_COPIES_KEY, JSON.stringify(drafts));
      const at = `seed ${seedN}`;
      const first = moveLegacyCopies(s, { newId: ids(seedN), now: MOVE_AT });
      expect(first, at).toMatchObject({ status: "moved", moved: Math.min(n, DEVICE_COPY_CAP) });
      expect(s.map.has(LEGACY_MOVED_KEY), at).toBe(false);
      const before = envOf(s).items;
      const second = moveLegacyCopies(s, { newId: ids(seedN + 1000), now: new Date(MOVE_AT.getTime() + 60_000) });
      // all moved: the old key is gone and the run is a no-op; some kept: they are still over the cap and stay kept
      expect(second, at).toEqual(n <= DEVICE_COPY_CAP ? { status: "none" } : { status: "moved", moved: 0, superseded: 0, kept: n - DEVICE_COPY_CAP, dropped: 0 });
      expect(envOf(s).items, at).toEqual(before);
      const left = s.map.has(LEGACY_COPIES_KEY) ? (JSON.parse(s.map.get(LEGACY_COPIES_KEY)!) as { slug: string }[]).map((d) => d.slug) : [];
      expect(new Set([...before.map((x) => x.slug), ...left]).size, at).toBe(n);
    }
  });

  it("results carry counts only, never a draft's value", () => {
    const { r } = moveOne(legacy("secret-trip", undefined, { children: [41] }));
    expect(JSON.stringify(r)).not.toMatch(/secret|41/);
  });
});

describe("the sign-in merge (nav 4.2), property tests", () => {
  /** What the account holds after applying a plan: insert on conflict (id) do nothing returning id. */
  function apply(account: AccountDraftKey[], plan: MergePlan): { account: AccountDraftKey[]; returned: string[] } {
    const have = new Set(account.map((a) => a.id));
    const rows = plan.insert.filter((r) => !have.has(r.id));
    return { account: [...account, ...rows.map((r) => ({ id: r.id, source_trip: r.source_trip, start: r.doc.start ?? null }))], returned: rows.map((r) => r.id) };
  }
  function world(seedN: number): { copies: CopyItem[]; account: AccountDraftKey[] } {
    const r = rng(seedN);
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
    const seen = new Set<string>();
    return { copies, account: account.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))) };
  }

  it("is idempotent, honours the cap, never duplicates a trip and start, and accounts for every copy", () => {
    for (let seedN = 1; seedN <= 400; seedN++) {
      const { copies, account } = world(seedN);
      // the route receives JSON: the plan is made from the parsed wire form
      const plan = mustPlan(JSON.parse(JSON.stringify(copies)), account);
      const { account: after } = apply(account, plan);
      const at = `seed ${seedN}`;
      const buckets = [...plan.insert.map((x) => x.id), ...plan.already, ...plan.sameTrip, ...plan.overCap];
      expect(buckets.sort(), at).toEqual(copies.map((c) => c.id).sort());
      expect(after.length, at).toBeLessThanOrEqual(Math.max(ACCOUNT_DRAFT_CAP, account.length));
      if (account.length >= ACCOUNT_DRAFT_CAP) expect(plan.insert, at).toEqual([]);
      const key = (a: AccountDraftKey) => `${a.source_trip}|${a.start}`;
      const existing = new Set(account.filter((a) => a.source_trip && a.start).map(key));
      const inserted = plan.insert.map((r) => key({ id: r.id, source_trip: r.source_trip, start: r.doc.start ?? null }));
      expect(inserted.some((k) => existing.has(k)), at).toBe(false);
      expect(new Set(inserted).size, at).toBe(inserted.length);
      const again = mustPlan(copies, after);
      expect(again.insert, at).toEqual([]);
      expect(apply(after, again).account, at).toEqual(after);
      // the newest copies go first, compared as instants whatever the spelling (review M1)
      const time = new Map(copies.map((c) => [c.id, Date.parse(c.copiedAt)]));
      const oldestIn = Math.min(...plan.insert.map((r) => time.get(r.id)!));
      if (plan.insert.length) for (const id of plan.overCap) expect(time.get(id)! <= oldestIn, at).toBe(true);
      for (const row of plan.insert) {
        expect(parseTripCustom(row.doc).success, at).toBe(true);
        expect(row.source_revision, at).toBe(copies.find((c) => c.id === row.id)!.rev ?? null);
      }
    }
  });

  it("orders mixed precision by instant: whole seconds against fractions (review M1)", () => {
    const r = rng(77);
    const mk = (i: number, copiedAt: string) => mustCopy({ ...INPUT, id: uuidFrom(r), slug: SLUGS[i]!, copiedAt });
    const older = mk(0, "2026-10-20T10:00:00.500Z");
    const newer = mk(1, "2026-10-20T10:00:01Z");
    const newest = mk(2, "2026-10-20T10:00:01.000001Z");
    const plan = mustPlan([older, newer, newest], [], 2);
    expect(plan.insert.map((x) => x.id)).toEqual([newest.id, newer.id]);
    expect(plan.overCap).toEqual([older.id]);
  });

  it("a crash between the server write and emptying the envelope is safe", () => {
    for (let seedN = 1; seedN <= 100; seedN++) {
      const { copies, account } = world(seedN);
      const first = mustPlan(copies, account);
      const { account: server } = apply(account, first);
      const retry = mustPlan(copies, server);
      expect(retry.insert, `seed ${seedN}`).toEqual([]);
      expect([...retry.already, ...retry.sameTrip].sort(), `seed ${seedN}`).toEqual([...first.insert.map((r) => r.id), ...first.already, ...first.sameTrip].sort());
    }
  });

  it("refuses input it cannot trust (review C2): not a list, over 20, a bad id, a duplicate trip, an unknown key", () => {
    const r = rng(5);
    const good = Array.from({ length: 3 }, (_, i) => item(r, i));
    expect(planMerge(good, []).success).toBe(true);
    expect(planMerge({ items: good }, []).success).toBe(false);
    expect(planMerge(Array.from({ length: 21 }, (_, i) => item(r, i)), []).success).toBe(false);
    expect(planMerge([{ ...good[0], id: "x'); drop table plan_draft;--" }], []).success).toBe(false);
    expect(planMerge([good[0], { ...good[1], slug: good[0]!.slug }], [])).toMatchObject({ success: false, issues: ["$: one copy per trip (Q204)"] });
    expect(planMerge([good[0], { ...good[1], id: good[0]!.id }], [])).toMatchObject({ success: false, issues: ["$: each copy has its own id"] });
    expect(planMerge([{ ...good[0], is_admin: true }], []).success).toBe(false);
    expect(planMerge([{ ...good[0], title: "" }], []).success).toBe(false);
    expect(parseCopyList(good).success).toBe(true);
    expect(copyToDraftRow({ ...good[0], source_trip: "private-trip" }).success).toBe(false);
    expect(copyToTripCustom("nope").success).toBe(false);
  });

  it("markMerged removes only what the server confirmed (review M2) and keeps merged to the 10 most recent", () => {
    const r = rng(42);
    const copies = Array.from({ length: 5 }, (_, i) => item(r, i));
    const env: CopiesEnvelope = { ...emptyCopies(), items: copies };
    const full: AccountDraftKey[] = Array.from({ length: ACCOUNT_DRAFT_CAP - 3 }, () => ({ id: uuidFrom(r), source_trip: null, start: null }));
    const plan = mustPlan(copies, full);
    expect(plan.insert).toHaveLength(3);
    expect(plan.overCap).toHaveLength(2);
    // the server returned only two of the three ids (the cap trigger refused one, or another account holds that id)
    const returned = plan.insert.slice(0, 2).map((x) => x.id);
    const after = markMerged(env, { inserted: returned, already: plan.already, sameTrip: plan.sameTrip }, "acct_hash_1234", NOW);
    expect(after.items.map((x) => x.id).sort()).toEqual([plan.insert[2]!.id, ...plan.overCap].sort());
    expect(after.merged).toEqual({ acct_hash_1234: NOW.toISOString() });
    expect(parseEnvelope(after).success).toBe(true);
    // an ids nobody sent is ignored; merged never grows past MERGED_MAX
    let e = after;
    for (let i = 0; i < 15; i++) e = markMerged(e, { inserted: ["not-a-copy"], already: [], sameTrip: [] }, `acct_${String(i).padStart(8, "0")}`, new Date(NOW.getTime() + (i + 1) * 1000));
    expect(e.items).toHaveLength(after.items.length);
    expect(Object.keys(e.merged)).toHaveLength(MERGED_MAX);
    expect(Object.keys(e.merged)).toContain("acct_00000014");
    expect(Object.keys(e.merged)).not.toContain("acct_hash_1234");
    expect(parseEnvelope(e).success).toBe(true);
  });

  it("the merge runs whenever the device holds copies, whatever merged says (owner, 26 Oct 2026)", () => {
    const a = addCopy({ ...emptyCopies(), merged: { acct_hash_1234: NOW.toISOString() } }, INPUT, { now: NOW, newId: ids() });
    if (!a.ok) throw new Error("add");
    expect(needsMerge(a.envelope)).toBe(true);
    expect(needsMerge({ ...emptyCopies(), merged: {} })).toBe(false);
  });

  it("maps a copy onto plan_draft and trip-custom/1 (nav 4.2 rule 2), keeping fromRef, gw and rev", () => {
    const c = { ...INPUT, id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", copiedAt: NOW.toISOString(), fromRef: "town:in-mh-mumbai", gw: { in: "YEG", out: "YYC" }, rev: "2026-10-20.a1b2" };
    expect(copyToDraftRow(c)).toEqual({
      success: true,
      data: {
        id: c.id,
        title: "Dolomites",
        source_trip: "dolomites-july-2027",
        source_revision: "2026-10-20.a1b2",
        doc: {
          schema: "trip-custom/1",
          profile: INPUT.profile,
          overrides: { "5": "C" },
          added: [{ op: "o-1", day: 5, ref: "place/pyramid-lake" }],
          start: "2027-07-03",
          travellers: { adults: 2, children: [6] },
          fromRef: "town:in-mh-mumbai",
          gw: { in: "YEG", out: "YYC" },
          rev: "2026-10-20.a1b2",
        },
      },
    });
    const bare = copyToTripCustom({ ...INPUT, id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", copiedAt: NOW.toISOString() });
    if (!bare.success) throw new Error("bare");
    for (const k of ["fromRef", "gw", "rev"]) expect(Object.keys(bare.data)).not.toContain(k);
    const row = copyToDraftRow({ ...INPUT, id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", copiedAt: NOW.toISOString() });
    expect(row.success && row.data.source_revision).toBeNull();
  });
});

describe("privacy detector: planted copy fields (NAV-C, origin spec 8.1)", () => {
  const whys = (x: unknown) => privacyHits(x).map((h) => h.why);

  it("lists copiedAt, travellers, fromRef and gw as private keys", () => {
    for (const k of ["copiedAt", "travellers", "fromRef", "gw", "added"]) expect(PRIVATE_KEYS).toContain(k);
  });

  it("fails a public payload with a planted travellers, copiedAt, fromRef, gw or origin under from", () => {
    expect(whys({ trip: { slug: "x", travellers: { adults: 2, children: [6] } } })).toEqual(["a private key"]);
    expect(whys({ items: [{ slug: "x", copiedAt: "2026-10-25T14:02:11Z" }] })).toEqual(["a private key"]);
    expect(whys({ trip: { gw: { in: "YEG", out: "YYC" } } })).toEqual(["a private key"]);
    // fromRef is private whatever its value, including the forms the from rule misses
    for (const v of ["town:in-mh-mumbai", "bom", "Mumbai", { ref: "x" }, null]) expect(whys({ trip: { fromRef: v } }), JSON.stringify(v)).toEqual(["a private key"]);
    for (const from of ["iata:BOM", "hub:ottawa", "town:in-mh-mumbai", "gn:1275339", "TOWN:x"]) expect(whys({ trip: { from } }), from).toEqual(["a visitor's origin"]);
    expect(whys({ trip: { from: { ref: "town:in-mh-mumbai", label: "Mumbai" } } })).toEqual(["a visitor's origin"]);
    // a whole envelope, or one serialised into a string, fails
    const a = addCopy(emptyCopies(), { ...INPUT, fromRef: "iata:BOM", gw: { in: "YYC", out: "YYC" } }, { now: NOW, newId: ids() });
    if (!a.ok) throw new Error("add");
    const hits = privacyHits({ body: JSON.stringify(a.envelope) }).map((h) => h.where);
    expect(hits).toEqual(expect.arrayContaining(["$.body<json>.items[0].added", "$.body<json>.items[0].copiedAt", "$.body<json>.items[0].fromRef", "$.body<json>.items[0].gw"]));
  });

  it("hits never carry the value", () => {
    expect(JSON.stringify(privacyHits({ from: "town:in-mh-mumbai", fromRef: "town:in-mh-mumbai", travellers: { adults: 2, children: [6] } }))).not.toMatch(/mumbai|"6"|children/);
  });

  it("leaves the public uses of from alone: windows, age bands, legs and capture origins", () => {
    expect(whys({ window: { from: "07-13", to: "07-26" } })).toEqual([]);
    expect(whys({ age_band: { from: 6, to: null } })).toEqual([]);
    expect(whys({ legs: [{ from: "base/banff", to: "place/moraine-lake", min: 25 }] })).toEqual([]);
    expect(whys({ point: { from: "capture" } })).toEqual([]);
    expect(whys({ months: { from: "2027-07-03", to: "2027-07-10" } })).toEqual([]);
  });

  it("pins the known misses of the value-based from rule (review M5): a change here must be deliberate", () => {
    // the URL form, a resolved label, a JSON string under from, nesting deeper than three levels, and a reference under another key
    expect(whys({ trip: { from: "bom" } })).toEqual([]);
    expect(whys({ trip: { from: "Mumbai" } })).toEqual([]);
    expect(whys({ trip: { from: JSON.stringify({ ref: "town:in-mh-mumbai" }) } })).toEqual([]);
    expect(whys({ trip: { from: { a: { b: { c: { d: "town:in-mh-mumbai" } } } } } })).toEqual([]);
    expect(whys({ start: { ref: "town:in-mh-mumbai" } })).toEqual([]);
    expect(whys({ origin: "town:in-mh-mumbai" })).toEqual([]);
    expect(whys({ ref: "town:in-mh-mumbai" })).toEqual([]);
    // a copy's party outside travellers is caught only through its sibling keys
    expect(whys({ adults: 2, children: [6] })).toEqual([]);
  });

  it("the detector's origin prefix covers every form the schema accepts", () => {
    for (const ref of ["iata:BOM", "hub:toronto", "town:in-mh-mumbai", "gn:1275339"]) {
      expect(ORIGIN_REFERENCE.test(ref)).toBe(true);
      expect(ORIGIN_REFERENCE_VALUE.test(ref)).toBe(true);
    }
  });
});

// copies/2 (SW-008, SW-026; 28 Oct 2026): an undated copy and the ring colour, read-compatible with copies/1 and one-way safe.
describe("copies/2: undated copies and the ring colour", () => {
  const V1 = (items: unknown[]) => JSON.stringify({ schema: "copies/1", items, noteSeen: null, snoozedUntil: null, merged: {} });
  const OLD = { ...INPUT, id: "6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b", copiedAt: NOW.toISOString() };

  it("is the current version; a copies/1 envelope still reads, upgraded in memory, and the next write is copies/2", () => {
    expect(COPIES_SCHEMA).toBe("copies/2");
    const raw = V1([OLD]);
    const r = readCopies(raw);
    expect(r).toMatchObject({ ok: true, fresh: false, envelope: { schema: "copies/2", items: [OLD] } });
    const s = spyStorage();
    s.map.set(COPIES_KEY, raw);
    const u = updateCopies(s, (env) => ({ envelope: env, value: null }));
    expect(u.ok).toBe(true);
    expect(JSON.parse(s.map.get(COPIES_KEY)!).schema).toBe("copies/2");
    // an old copy keeps every field; it gains nothing on disk until something changes it
    expect(JSON.parse(s.map.get(COPIES_KEY)!).items[0]).toEqual(OLD);
  });

  it("a copies/1 envelope may not hold what only copies/2 can (an undated copy, a colour): that is invalid, not upgraded", () => {
    expect(readCopies(V1([{ ...OLD, start: null }]))).toMatchObject({ ok: false, reason: "invalid", issues: ["$.items.0.start: a date in copies/1"] });
    expect(readCopies(V1([{ ...OLD, identity: "blue" }]))).toMatchObject({ ok: false, reason: "invalid", issues: ["$.items.0.identity: not in copies/1"] });
  });

  it("copies/3 is newer: read-only, never overwritten (the same rule an older tab applies to copies/2)", () => {
    const s = spyStorage();
    const newer = JSON.stringify({ schema: "copies/3", items: [{ start: null }] });
    s.map.set(COPIES_KEY, newer);
    expect(readCopies(newer)).toMatchObject({ ok: false, reason: "newer" });
    expect(updateCopies(s, (env) => ({ envelope: env, value: null }))).toEqual({ ok: false, reason: "newer" });
    expect(s.map.get(COPIES_KEY)).toBe(newer);
  });

  it("an undated copy is added, written, read back, changed to a date and back (SW-008)", () => {
    const s = memoryStorage();
    const a = addCopy(emptyCopies(), { ...INPUT, start: null }, { now: NOW, newId: ids(5) });
    if (!a.ok) throw new Error(a.reason);
    expect(a.item.start).toBeNull();
    expect(writeCopies(s, a.envelope, null).ok).toBe(true);
    const back = readCopies(s.getItem(COPIES_KEY));
    expect(back).toMatchObject({ ok: true, envelope: { items: [{ start: null }] } });
    expect(parseCopy({ ...a.item, start: "2027-07-03" }).success).toBe(true);
    expect(parseCopy({ ...a.item, start: "" }).success).toBe(false);
    expect(parseCopy({ ...a.item, start: undefined }).success).toBe(false); // null, never absent
  });

  it("the merge inserts an undated copy as its own row: it never matches a dated or an undated account row by trip (M3 needs a start)", () => {
    const c = mustCopy({ ...OLD, start: null });
    const acct: AccountDraftKey[] = [
      { id: "11111111-1111-4111-8111-111111111111", source_trip: c.slug, start: null, content: null },
      { id: "22222222-2222-4222-8222-222222222222", source_trip: c.slug, start: "2027-07-03", content: null },
    ];
    const p = mustPlan([c], acct);
    expect(p.insert.map((r) => r.id)).toEqual([c.id]);
    expect(p.sameTrip).toEqual([]);
    expect(p.insert[0]!.doc.start).toBeUndefined();
  });

  it("every new copy gets a ring colour from the six (no rose, no none); a re-copy keeps the trip's; the device's copies differ while colours last (SW-026)", () => {
    expect(COPY_RING_KEYS.every((k) => (PLAN_IDENTITY_KEYS as readonly string[]).includes(k))).toBe(true);
    expect(COPY_RING_KEYS).not.toContain("rose");
    expect(COPY_RING_KEYS).not.toContain("none");
    let env = emptyCopies();
    const newId = ids(9);
    for (const slug of SLUGS.slice(0, 6)) {
      const a = addCopy(env, { ...INPUT, slug }, { now: NOW, newId });
      if (!a.ok) throw new Error(a.reason);
      env = a.envelope;
    }
    const colours = env.items.map((c) => c.identity);
    expect(new Set(colours).size).toBe(6);
    expect(colours.every((k) => (COPY_RING_KEYS as readonly string[]).includes(k!))).toBe(true);
    // a seventh shares a colour (six exist) and is still one of the six
    const seventh = addCopy(env, { ...INPUT, slug: SLUGS[6]! }, { now: NOW, newId });
    expect(seventh.ok && COPY_RING_KEYS.includes(seventh.item.identity as (typeof COPY_RING_KEYS)[number])).toBe(true);
    // a replace keeps the replaced copy's colour; a supplied colour wins
    const first = env.items[0]!;
    const again = addCopy(env, { ...INPUT, slug: first.slug }, { now: NOW, newId, replace: true });
    expect(again.ok && again.item.identity).toBe(first.identity);
    const given = addCopy(emptyCopies(), { ...INPUT, identity: "sky" }, { now: NOW, newId });
    expect(given.ok && given.item.identity).toBe("sky");
  });

  it("a copy made before copies/2 reads its colour from its slug: stable, one of the six, the same for the same slug", () => {
    for (const slug of SLUGS) {
      const k = slugIdentity(slug);
      expect(COPY_RING_KEYS).toContain(k);
      expect(slugIdentity(slug)).toBe(k);
      expect(copyIdentity({ slug })).toBe(k);
      expect(copyIdentity({ slug, identity: "rose" })).toBe("rose"); // a stored colour is read as it is
    }
    // the hash spreads: thirty slugs use every colour
    expect(new Set(SLUGS.map(slugIdentity)).size).toBe(COPY_RING_KEYS.length);
    expect(pickIdentity([], "trip-1")).toBe(slugIdentity("trip-1"));
  });

  it("the colour is not household data and not content: two copies differing only in colour have the same M3 key", () => {
    const a = mustCopy({ ...OLD, identity: "blue" });
    const b = mustCopy({ ...OLD, identity: "orange" });
    expect(copyContentKey(a)).toBe(copyContentKey(b));
    expect(privacyHits({ identity: "blue" })).toEqual([]);
  });

  it("the retired trip-custom mapping still holds an undated copy (no start key)", () => {
    const r = copyToTripCustom({ ...OLD, start: null });
    expect(r.success && "start" in r.data).toBe(false);
  });
});
