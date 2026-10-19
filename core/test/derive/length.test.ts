import { describe, expect, it } from "vitest";
import { LENGTH_FILTERS, isShort, lengthClass, lengthFilter } from "../../src/derive/length.ts";

describe("lengthClass (short-trips 2.1)", () => {
  it("names the five classes", () => {
    expect(lengthClass(0)).toBe("day");
    expect(lengthClass(1)).toBe("overnight");
    expect(lengthClass(2)).toBe("weekend");
    expect(lengthClass(3)).toBe("long-weekend");
    expect(lengthClass(4)).toBe("multi-day");
    expect(lengthClass(14)).toBe("multi-day");
  });
  it("the 3 / 4 night boundary decides what is short", () => {
    expect(isShort(3)).toBe(true);
    expect(isShort(4)).toBe(false);
    expect(isShort(0)).toBe(true);
  });
  it("lengthFilter keeps the short classes and bands the rest as 4-8, 9-14 and 15+", () => {
    expect([0, 1, 2, 3, 4, 8, 9, 14, 15, 30].map(lengthFilter)).toEqual(["day", "overnight", "weekend", "long-weekend", "4-8", "4-8", "9-14", "9-14", "15+", "15+"]);
    expect(LENGTH_FILTERS).toHaveLength(7);
  });
});
