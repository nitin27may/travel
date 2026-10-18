import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classify, HOST_GAP_MS, LINK_USER_AGENT, LinkChecker } from "../../src/sources/links.ts";
import type { FetchLike } from "../../src/sources/links.ts";

interface Call { method: "HEAD" | "GET"; status?: number; url?: string; error?: string }
interface Recording { name: string; url: string; calls: Call[]; expect: { status: string; http: number | null; final: string | null } }
const recordings = JSON.parse(readFileSync(join(import.meta.dirname, "..", "fixtures", "sources", "recordings.json"), "utf8")) as Recording[];

/** Replays recorded answers: each URL has the calls the real server gave, in order. A call out of order fails the test. */
function replay(rec: Recording[], seen: { method: string; url: string; headers: Record<string, string> }[]): FetchLike {
  const left = new Map(rec.map((r) => [r.url, [...r.calls]]));
  return async (url, init) => {
    seen.push({ method: init.method, url, headers: init.headers });
    const next = left.get(url)?.shift();
    if (!next || next.method !== init.method) throw new Error(`unexpected ${init.method} ${url}`);
    if (next.error) throw Object.assign(new TypeError("fetch failed"), { cause: { code: next.error } });
    return { status: next.status!, url: next.url ?? url, body: { cancel: async () => undefined } };
  };
}

describe("link checker against recordings (offline)", () => {
  for (const r of recordings) {
    it(`records ${r.name}`, async () => {
      const seen: { method: string; url: string; headers: Record<string, string> }[] = [];
      const c = new LinkChecker({ fetch: replay([r], seen), sleep: async () => undefined, today: "2026-10-18" });
      const res = await c.check(r.url);
      expect(res).toMatchObject({ url: r.url, checked: "2026-10-18", ...r.expect });
      expect(seen.map((s) => s.method)).toEqual(r.calls.map((x) => x.method));
    });
  }
  it("has a recording for each outcome we report", () => {
    const statuses = new Set(recordings.map((r) => r.expect.status));
    for (const s of ["ok", "redirect", "broken"]) expect(statuses.has(s)).toBe(true);
  });
});

describe("link checker behaviour", () => {
  const ok: FetchLike = async (url) => ({ status: 200, url, body: null });

  it("sends the identified User-Agent and never an email address", async () => {
    const seen: Record<string, string>[] = [];
    const c = new LinkChecker({ fetch: async (u, i) => (seen.push(i.headers), ok(u, i)), sleep: async () => undefined, today: "2026-10-18" });
    await c.check("https://a.example/x");
    expect(seen[0]!["User-Agent"]).toBe(LINK_USER_AGENT);
    expect(LINK_USER_AGENT).toBe("travel-source-check/1.0 (+https://nks-travel.pages.dev/about/)");
    expect(JSON.stringify(seen)).not.toMatch(/@/);
  });
  it("tries HEAD first and does not GET when HEAD succeeds", async () => {
    const c = new LinkChecker({ fetch: ok, sleep: async () => undefined, today: "2026-10-18" });
    await c.check("https://a.example/x");
    expect(c.requests.map((r) => r.method)).toEqual(["HEAD"]);
  });
  it("falls back to GET when HEAD is refused or fails", async () => {
    const calls: string[] = [];
    const f: FetchLike = async (url, init) => {
      calls.push(init.method);
      if (init.method === "HEAD") return { status: 405, url, body: null };
      return { status: 200, url, body: null };
    };
    const res = await new LinkChecker({ fetch: f, sleep: async () => undefined, today: "2026-10-18" }).check("https://a.example/x");
    expect(calls).toEqual(["HEAD", "GET"]);
    expect(res.status).toBe("ok");
    const g: FetchLike = async (url, init) => {
      if (init.method === "HEAD") throw new Error("socket hang up");
      return { status: 200, url, body: null };
    };
    expect((await new LinkChecker({ fetch: g, sleep: async () => undefined, today: "2026-10-18" }).check("https://a.example/x")).status).toBe("ok");
  });
  it("waits 500 ms between requests to one host and not between hosts", async () => {
    let t = 1000;
    const sleeps: number[] = [];
    const c = new LinkChecker({ fetch: ok, now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; }, today: "2026-10-18" });
    await c.check("https://a.example/1");
    await c.check("https://a.example/2");
    await c.check("https://b.example/1");
    expect(sleeps).toEqual([HOST_GAP_MS]);
    t += 100;
    await c.check("https://b.example/2");
    expect(sleeps).toEqual([HOST_GAP_MS, HOST_GAP_MS - 100]);
  });
  it("requests are sequential: a second request never starts before the first ends", async () => {
    let inFlight = 0;
    let max = 0;
    const f: FetchLike = async (url) => {
      inFlight++;
      max = Math.max(max, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { status: 200, url, body: null };
    };
    const c = new LinkChecker({ fetch: f, sleep: async () => undefined, today: "2026-10-18" });
    for (const u of ["https://a.example/1", "https://b.example/1", "https://c.example/1"]) await c.check(u);
    expect(max).toBe(1);
  });
  it("classifies DNS failures as broken and other network errors as error", async () => {
    const dns: FetchLike = async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } }); };
    const slow: FetchLike = async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); };
    expect((await new LinkChecker({ fetch: dns, sleep: async () => undefined, today: "2026-10-18" }).check("https://gone.example/")).status).toBe("broken");
    expect((await new LinkChecker({ fetch: slow, sleep: async () => undefined, today: "2026-10-18" }).check("https://slow.example/")).status).toBe("error");
  });
});

describe("classify", () => {
  it("maps statuses", () => {
    expect(classify(200, "https://a/x", "https://a/x")).toBe("ok");
    expect(classify(200, "https://a/x", "https://a/x/")).toBe("ok");
    expect(classify(200, "https://a/x", "https://a/y")).toBe("redirect");
    expect(classify(404, "https://a/x", null)).toBe("broken");
    expect(classify(410, "https://a/x", null)).toBe("broken");
    expect(classify(403, "https://a/x", null)).toBe("blocked");
    expect(classify(429, "https://a/x", null)).toBe("blocked");
    expect(classify(503, "https://a/x", null)).toBe("error");
  });
});
