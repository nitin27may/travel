// patchText (RIS-N): a rewrite that moves only the bytes of what changed.
import { describe, expect, it } from "vitest";
import { isCanonical, patchText } from "../../src/normalise/jsonPatch.ts";

const edit = (text: string, f: (d: any) => void): string => {
  const before = JSON.parse(text);
  const after = structuredClone(before);
  f(after);
  return patchText(text, before, after);
};

describe("patchText", () => {
  it("returns the text itself when nothing changes", () => {
    const t = '{ "a": 6.0,\n  "b": [1, 2]  }\n';
    expect(patchText(t, JSON.parse(t), JSON.parse(t))).toBe(t);
  });

  it("keeps Python floats (6.0), inline objects and arrays outside the change", () => {
    const t = '{\n  "price": { "amount": 6.0, "currency": "CAD" },\n  "pair": [12.5, 46.1],\n  "name": "x"\n}\n';
    const out = edit(t, (d) => (d.name = "y"));
    expect(out).toBe('{\n  "price": { "amount": 6.0, "currency": "CAD" },\n  "pair": [12.5, 46.1],\n  "name": "y"\n}\n');
  });

  it("adds a member to a multi-line object in its style, and removes one without touching its neighbours", () => {
    const t = '{\n  "ref": "a",\n  "origin": { "from": "b", "reason": "c" },\n  "links": [\n    1\n  ]\n}\n';
    const out = edit(t, (d) => {
      delete d.origin;
      d.meta = { schema_version: 1, origin: { from: "b", reason: "c" } };
    });
    expect(JSON.parse(out).meta.origin.from).toBe("b");
    expect(out).toContain('  "links": [\n    1\n  ],\n  "meta": {\n    "schema_version": 1,');
    expect(out).not.toContain('"origin": { "from"');
  });

  it("adds a member to an inline object inline", () => {
    const t = '{ "id": "a", "src": ["s1"] }';
    expect(edit(t, (d) => (d.method = "computed"))).toBe('{ "id": "a", "src": ["s1"], "method": "computed" }');
  });

  it("changes a nested scalar in place and appends to an array", () => {
    const t = '{\n  "a": { "b": [\n    1,\n    2\n  ] }\n}\n';
    const out = edit(t, (d) => {
      d.a.b.push(3);
      d.a.c = true;
    });
    expect(JSON.parse(out)).toEqual({ a: { b: [1, 2, 3], c: true } });
  });

  it("handles one-space indentation (suitability scope) and escapes", () => {
    const t = '{\n "k": "a\\"b",\n "x": {\n  "y": 1\n }\n}\n';
    const out = edit(t, (d) => (d.x.z = { n: 1 }));
    expect(out).toContain(' "x": {\n  "y": 1,\n  "z": {\n   "n": 1\n  }\n }');
    expect(JSON.parse(out).k).toBe('a"b');
  });

  it("refuses to write a file that disagrees with the intended document (a stale `before`)", () => {
    // the text says a=1 but `before` says a=9: the patch keeps the text's 1, so the result cannot equal `after`
    expect(() => patchText('{"a":1}', { a: 9 }, { a: 9, c: 3 })).toThrow(/differs from the intended document/);
  });

  it("isCanonical tells JSON.stringify output from hand layout", () => {
    expect(isCanonical('{\n  "a": 1\n}\n')).toBe(true);
    expect(isCanonical('{ "a": 1 }\n')).toBe(false);
    expect(isCanonical("not json")).toBe(false);
  });
});
