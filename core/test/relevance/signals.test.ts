// The signals tool against recorded responses. No test here touches the network: the client takes a fetch function.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { SignalsClient, USER_AGENT, osmTag } from "../../src/relevance/signals.ts";
import type { FetchLike } from "../../src/relevance/signals.ts";

const REC = join(fileURLToPath(new URL("../fixtures/relevance/recorded", import.meta.url)));
const rec = (n: string) => JSON.parse(readFileSync(join(REC, n), "utf8"));
const tmp: string[] = [];
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));

interface Call { url: string; headers: Record<string, string> }
function fake(opts: { status?: (url: string, n: number) => number; retryAfter?: string } = {}) {
  const calls: Call[] = [];
  let active = 0;
  let maxActive = 0;
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers });
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, 1));
    active--;
    const status = opts.status?.(url, calls.length) ?? 200;
    const ok = status >= 200 && status < 300;
    let body: unknown = {};
    if (ok) {
      if (url.includes("wikidata.org")) body = rec("wikidata.json");
      else if (url.includes("/en.wikipedia/")) body = rec("pageviews.json").en;
      else if (url.includes("/de.wikipedia/")) body = rec("pageviews.json").de;
      else if (url.includes("/it.wikipedia/")) body = rec("pageviews.json").it;
      else if (url.includes("overpass")) body = rec("overpass.json");
    }
    return { ok, status, headers: { get: (n: string) => (n.toLowerCase() === "retry-after" ? (opts.retryAfter ?? null) : null) }, json: async () => body };
  };
  return { fn, calls, maxActive: () => maxActive };
}

let root = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "rel-sig-"));
  tmp.push(root);
});
const client = (f: ReturnType<typeof fake>, o: Partial<ConstructorParameters<typeof SignalsClient>[0]> = {}) =>
  new SignalsClient({ root, fetchImpl: f.fn, delayMs: 0, sleep: async () => {}, today: "2026-10-18", ...o });

describe("identification", () => {
  it("names the project and the repo URL, and nothing personal", () => {
    expect(USER_AGENT).toMatch(/^[a-z-]+\/\d+\.\d+ \(https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9-]+\)$/);
    expect(USER_AGENT).not.toContain("@");
  });
  it("sends the User-Agent on every request and no other identifying header", async () => {
    const f = fake();
    await client(f).wikidata(["Q1257207"], { Q1257207: ["de", "it"] });
    expect(f.calls.length).toBeGreaterThan(0);
    for (const c of f.calls) {
      expect(c.headers["User-Agent"]).toBe(USER_AGENT);
      expect(Object.keys(c.headers).sort()).toEqual(["Accept", "User-Agent"]);
      expect(c.url).not.toContain("@");
      expect(c.url.toLowerCase()).not.toMatch(/mailto|email|nitin/);
    }
  });
});

describe("Wikidata, by confirmed QID only", () => {
  it("fetches by ids and never searches by name", async () => {
    const f = fake();
    await client(f).wikidata(["Q1257207", "Q55978735"]);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.url).toContain("action=wbgetentities");
    expect(f.calls[0]!.url).toContain("ids=Q1257207%7CQ55978735");
    expect(f.calls[0]!.url).not.toMatch(/wbsearchentities|srsearch|list=search|search=/);
  });
  it("ignores anything that is not a QID", async () => {
    const f = fake();
    const out = await client(f).wikidata(["Moraine Lake", "q123", "Q0", ""]);
    expect(f.calls).toHaveLength(0);
    expect(out).toEqual({});
  });
  it("counts Wikipedia editions only, and keeps titles for the wanted languages", async () => {
    const f = fake();
    const out = await client(f).wikidata(["Q1257207"], { Q1257207: ["de", "it"] });
    const item = out.Q1257207!;
    expect(item.sitelinks.count).toBe(7); // commons and species are not editions
    expect(item.sitelinks.langs).toEqual(["de", "en", "es", "fr", "it", "ja", "ru"]);
    expect(item.titles).toEqual({ en: "Tre Cime di Lavaredo", de: "Drei Zinnen", it: "Tre Cime di Lavaredo" });
    expect(item.p1435).toEqual(["Q9259"]);
    expect(item.p757).toEqual(["1237"]);
    expect(item.p814).toEqual(["Q14545608"]);
    expect(item.label).toBe("Tre Cime di Lavaredo");
    expect(item.read).toBe("2026-10-18");
  });
  it("skips an item Wikidata reports missing", async () => {
    const f = fake();
    const out = await client(f).wikidata(["Q1257207", "Q99999999999"]);
    expect(Object.keys(out)).toEqual(["Q1257207"]);
  });
  it("batches at most 20 ids a request", async () => {
    const f = fake();
    const ids = Array.from({ length: 45 }, (_, i) => `Q${i + 1}`);
    await client(f).wikidata(ids);
    expect(f.calls).toHaveLength(3);
  });
});

describe("Wikipedia page views", () => {
  it("reads 12 full months for English and each wanted edition, and keeps the maximum (the language bias)", async () => {
    const f = fake();
    const c = client(f);
    const wd = await c.wikidata(["Q1257207"], { Q1257207: ["de", "it"] });
    const pv = await c.pageviews(wd);
    const item = pv.Q1257207!;
    expect(item.views["en.wikipedia"]!.total).toBe(11000);
    expect(item.views["de.wikipedia"]!.total).toBe(107648);
    expect(item.views["it.wikipedia"]!.total).toBe(75012);
    expect(item.max).toBe(107648);
    expect(item.window).toEqual({ from: "202510", to: "202609" });
    const urls = f.calls.filter((x) => x.url.includes("pageviews")).map((x) => x.url);
    expect(urls).toHaveLength(3);
    expect(urls.every((u) => u.includes("/all-access/user/"))).toBe(true);
    expect(urls[0]).toContain("/monthly/2025100100/2026090100");
  });
  it("treats a 404 as no article", async () => {
    const f = fake({ status: (u) => (u.includes("pageviews") ? 404 : 200) });
    const c = client(f);
    const pv = await c.pageviews(await c.wikidata(["Q1257207"]));
    expect(pv.Q1257207!.views["en.wikipedia"]!.total).toBeNull();
    expect(pv.Q1257207!.max).toBe(0);
  });
});

describe("cache", () => {
  it("writes sorted JSON with a read date, and a second run makes no request", async () => {
    const f1 = fake();
    const c1 = client(f1);
    await c1.pageviews(await c1.wikidata(["Q55978735", "Q1257207"], { Q1257207: ["de", "it"] }));
    const path = join(root, "data/relevance/signals/wikidata.json");
    const file = JSON.parse(readFileSync(path, "utf8"));
    expect(file.schema).toBe("relevance-signals-wikidata/1");
    expect(file.source).toMatch(/CC0/);
    expect(Object.keys(file.items)).toEqual(["Q1257207", "Q55978735"]);
    const f2 = fake();
    const c2 = client(f2, { today: "2026-10-25" });
    await c2.pageviews(await c2.wikidata(["Q55978735", "Q1257207"], { Q1257207: ["de", "it"] }));
    expect(f2.calls).toHaveLength(0);
  });
  it("refetches after the maximum age, and with --refresh", async () => {
    const f1 = fake();
    await client(f1).wikidata(["Q55978735"]);
    const old = fake();
    await client(old, { today: "2027-12-01" }).wikidata(["Q55978735"]);
    expect(old.calls).toHaveLength(1);
    const forced = fake();
    await client(forced, { refresh: true }).wikidata(["Q55978735"]);
    expect(forced.calls).toHaveLength(1);
  });
  it("refetches views when the 12-month window has moved on", async () => {
    const f1 = fake();
    const c1 = client(f1, { today: "2026-10-18" });
    await c1.pageviews(await c1.wikidata(["Q55978735"]));
    const f2 = fake();
    const c2 = client(f2, { today: "2026-11-02", maxAgeDays: 365 });
    await c2.pageviews(await c2.wikidata(["Q55978735"]));
    expect(f2.calls.filter((x) => x.url.includes("pageviews"))).toHaveLength(1);
  });
  it("a corrupt cache file is rebuilt, not trusted", async () => {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(join(root, "data/relevance/signals"), { recursive: true });
    writeFileSync(join(root, "data/relevance/signals/wikidata.json"), "{not json");
    const f = fake();
    await client(f).wikidata(["Q55978735"]);
    expect(f.calls).toHaveLength(1);
  });
});

describe("rate limits and politeness", () => {
  it("is strictly sequential", async () => {
    const f = fake();
    const c = client(f);
    await c.pageviews(await c.wikidata(["Q1257207", "Q55978735"], { Q1257207: ["de", "it"] }));
    expect(f.calls.length).toBeGreaterThan(3);
    expect(f.maxActive()).toBe(1);
  });
  it("spaces requests to one host", async () => {
    const slept: number[] = [];
    const f = fake();
    const c = new SignalsClient({ root, fetchImpl: f.fn, delayMs: 100000, sleep: async (ms) => void slept.push(ms), today: "2026-10-18" });
    await c.get("https://wikimedia.org/a");
    await c.get("https://wikimedia.org/b");
    expect(slept.length).toBeGreaterThanOrEqual(1);
    expect(slept[0]!).toBeGreaterThan(0);
  });
  it("retries a 429 and honours Retry-After, then succeeds", async () => {
    const slept: number[] = [];
    const f = fake({ status: (_u, n) => (n === 1 ? 429 : 200), retryAfter: "7" });
    const c = new SignalsClient({ root, fetchImpl: f.fn, delayMs: 0, sleep: async (ms) => void slept.push(ms), today: "2026-10-18" });
    const out = await c.wikidata(["Q55978735"]);
    expect(f.calls).toHaveLength(2);
    expect(slept).toContain(7000);
    expect(Object.keys(out)).toEqual(["Q55978735"]);
  });
  it("retries a 503, and gives up after three tries with a clear error", async () => {
    const f = fake({ status: () => 503 });
    await expect(client(f).wikidata(["Q55978735"])).rejects.toThrow(/HTTP 503/);
    expect(f.calls).toHaveLength(3);
  });
  it("does not retry a 400", async () => {
    const f = fake({ status: () => 400 });
    await expect(client(f).wikidata(["Q55978735"])).rejects.toThrow(/HTTP 400/);
    expect(f.calls).toHaveLength(1);
  });
});

describe("Overpass class counts", () => {
  it("maps only the classes with a clean tag", () => {
    expect(osmTag("waterfall/roadside")).toBe('["waterway"="waterfall"]');
    expect(osmTag("viewpoint/escarpment")).toBe('["tourism"="viewpoint"]');
    expect(osmTag("peak/summit")).toBe('["natural"="peak"]');
    expect(osmTag("lake/small-mirror")).toBe('["natural"="water"]["water"="lake"]');
    expect(osmTag("cave/show")).toBe('["natural"="cave_entrance"]');
    expect(osmTag("trail/forest-loop")).toBeNull();
    expect(osmTag("canyon/slot-wade")).toBeNull();
  });
  it("counts within 25 km, caches by ref and class, and credits ODbL", async () => {
    const f = fake();
    const c = client(f);
    const out = await c.osm([
      { ref: "place/a", class_key: "waterfall/roadside", lat: 51.2, lon: -115.5 },
      { ref: "place/b", class_key: "trail/forest-loop", lat: 51.2, lon: -115.5 },
    ]);
    expect(f.calls).toHaveLength(1); // the trail class has no mapping
    expect(decodeURIComponent(f.calls[0]!.url)).toContain("around:25000,51.2,-115.5");
    expect(out["place/a"]).toMatchObject({ count: 4, radius_km: 25, tag: '["waterway"="waterfall"]', read: "2026-10-18" });
    const file = JSON.parse(readFileSync(join(root, "data/relevance/signals/osm-similar.json"), "utf8"));
    expect(file.credit).toMatch(/OpenStreetMap contributors, ODbL/);
    const f2 = fake();
    await client(f2).osm([{ ref: "place/a", class_key: "waterfall/roadside", lat: 51.2, lon: -115.5 }]);
    expect(f2.calls).toHaveLength(0);
    const f3 = fake();
    await client(f3).osm([{ ref: "place/a", class_key: "viewpoint/roadside", lat: 51.2, lon: -115.5 }]);
    expect(f3.calls).toHaveLength(1); // the class changed
    expect(existsSync(join(root, "data/relevance/signals/wikidata.json"))).toBe(false);
  });
});
