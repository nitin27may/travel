import { describe, expect, it } from "vitest";
import { ADDRESS_MAX, addressKey, canonicalAddress, sameAddress } from "../../src/mail/address.ts";

describe("canonicalAddress (what the proxy forwards)", () => {
  it.each([
    ["  Nitin@Example.COM ", "nitin@example.com"],
    ["a+tag@gmail.com", "a+tag@gmail.com"],
    ["first.last@googlemail.com", "first.last@googlemail.com"],
    ["\tx@y.io\n", "x@y.io"],
  ])("%j -> %s (trim and lower-case only)", (raw, want) => {
    expect(canonicalAddress(raw)).toBe(want);
  });

  it.each([
    "",
    "   ",
    "no-at-sign",
    "@example.com",
    "a@",
    "a@b",
    "a@@b.com",
    "a@b@c.com",
    "a b@c.com",
    "a@b..com",
    "a@.b.com",
    "a@b.com.",
    "a@b.com,c@d.com",
    "a@b.com;c@d.com",
    "Name <a@b.com>",
    "a@b.com\r\nBcc: x@y.com",
    "a\u0000@b.com",
  ])("refuses %j", (raw) => {
    expect(canonicalAddress(raw)).toBeNull();
  });

  it("refuses non-strings", () => {
    for (const v of [undefined, null, 42, {}, ["a@b.com"]]) expect(canonicalAddress(v)).toBeNull();
  });

  it("accepts a 254-character address and refuses 255", () => {
    const domain = "@example.com";
    const ok = "a".repeat(ADDRESS_MAX - domain.length) + domain;
    expect(ok.length).toBe(254);
    expect(canonicalAddress(ok)).toBe(ok);
    expect(canonicalAddress(`a${ok}`)).toBeNull();
  });
});

describe("addressKey (hash input only)", () => {
  it("maps +tag and Gmail dots to one key", () => {
    const variants = ["first.last@gmail.com", "FirstLast+news@gmail.com", " f.i.r.s.t.l.a.s.t@googlemail.com ", "firstlast+a+b@GMAIL.com"];
    const keys = new Set(variants.map(addressKey));
    expect([...keys]).toEqual(["firstlast@gmail.com"]);
  });

  it("strips +tag for every domain but keeps dots outside Gmail", () => {
    expect(addressKey("first.last+x@example.com")).toBe("first.last@example.com");
    expect(addressKey("first.last@example.com")).not.toBe(addressKey("firstlast@example.com"));
  });

  it("refuses an address whose local part is only a tag", () => {
    expect(addressKey("+tag@example.com")).toBeNull();
  });

  it("refuses what canonicalAddress refuses", () => {
    expect(addressKey("not an address")).toBeNull();
  });
});

describe("sameAddress", () => {
  it("compares canonical forms, not keys (the sandbox delivers to the exact account address)", () => {
    expect(sameAddress(" Owner@Example.com", "owner@example.com")).toBe(true);
    expect(sameAddress("owner+x@example.com", "owner@example.com")).toBe(false);
    expect(sameAddress(undefined, undefined)).toBe(false);
    expect(sameAddress("bad", "bad")).toBe(false);
  });
});
