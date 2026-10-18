import { describe, expect, it } from "vitest";
import { normaliseUrl, sourceId } from "../../src/sources/normalize.ts";

describe("normaliseUrl", () => {
  it("lowercases scheme and host but keeps the path case", () => {
    expect(normaliseUrl("HTTPS://Www.Example.COM/Some/Path")).toBe("https://www.example.com/Some/Path");
  });
  it("strips tracking parameters and the fragment, sorts the rest", () => {
    expect(normaliseUrl("https://a.com/p?utm_source=x&b=2&fbclid=z&a=1&utm_campaign=y#frag")).toBe("https://a.com/p?a=1&b=2");
    expect(normaliseUrl("https://a.com/p?gclid=1&msclkid=2&igshid=3&_ga=4&mc_cid=5")).toBe("https://a.com/p");
  });
  it("drops a trailing slash, also on the bare host, and default ports", () => {
    expect(normaliseUrl("https://a.com/")).toBe("https://a.com");
    expect(normaliseUrl("https://a.com/x/y/")).toBe("https://a.com/x/y");
    expect(normaliseUrl("https://a.com:443/x")).toBe("https://a.com/x");
    expect(normaliseUrl("http://a.com:8080/x/")).toBe("http://a.com:8080/x");
  });
  it("keeps parameters that change the page", () => {
    expect(normaliseUrl("https://a.com/watch?v=123")).toBe("https://a.com/watch?v=123");
  });
  it("leaves repo paths alone apart from a leading ./", () => {
    expect(normaliseUrl("./legacy/x/PLAN.md")).toBe("legacy/x/PLAN.md");
    expect(normaliseUrl("research/trips/a.md")).toBe("research/trips/a.md");
  });
  it("is idempotent", () => {
    const u = normaliseUrl("https://A.com/x/?b=1&utm_term=3&a=2");
    expect(normaliseUrl(u)).toBe(u);
  });
});

describe("sourceId", () => {
  it("is stable and shaped s-<10 hex>", () => {
    expect(sourceId("https://a.com/x")).toBe(sourceId("https://a.com/x"));
    expect(sourceId("https://a.com/x")).toMatch(/^s-[0-9a-f]{10}$/);
    expect(sourceId("https://a.com/x")).not.toBe(sourceId("https://a.com/y"));
  });
  it("gives spellings of one page the same id", () => {
    expect(sourceId(normaliseUrl("https://A.com/x/?utm_source=1"))).toBe(sourceId(normaliseUrl("https://a.com/x")));
  });
});
