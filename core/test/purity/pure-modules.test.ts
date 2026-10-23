import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// API-2: the modules moved out of web/ are pure. They run in a route handler, at build and in a server, so none of them may import
// React, Next, the filesystem or anything from web/. I/O stays in the store. Each directory below is scanned file by file.
const SRC = fileURLToPath(new URL("../../src", import.meta.url));
export const PURE_DIRS = ["query", "search", "parse", "privacy", "export", "links", "format"];

const FORBIDDEN: { name: string; test: (spec: string) => boolean }[] = [
  { name: "react", test: (s) => s === "react" || s.startsWith("react/") || s.startsWith("react-dom") },
  { name: "next", test: (s) => s === "next" || s.startsWith("next/") },
  { name: "@tanstack", test: (s) => s.startsWith("@tanstack/") },
  { name: "node:fs", test: (s) => /^(node:)?fs(\/|$)/.test(s) },
  { name: "node:path|child_process|os", test: (s) => /^(node:)?(path|child_process|os)$/.test(s) },
  { name: "web alias @/", test: (s) => s.startsWith("@/") },
  { name: "the web tree", test: (s) => /(^|\/)web\//.test(s) },
];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

/** Every module specifier a file imports or re-exports (static, dynamic and `import("x")` types). */
export function specifiers(source: string): string[] {
  const out: string[] = [];
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g;
  for (const m of source.matchAll(re)) out.push(m[2]!);
  return out;
}

export function violations(source: string): string[] {
  const bad: string[] = [];
  for (const spec of specifiers(source)) for (const f of FORBIDDEN) if (f.test(spec)) bad.push(`${f.name}: ${spec}`);
  return bad;
}

describe("moved modules are pure (no React, Next, fs or web imports)", () => {
  it("scans something", () => {
    const n = PURE_DIRS.flatMap((d) => {
      try {
        return files(path.join(SRC, d));
      } catch {
        return [];
      }
    });
    expect(n.length).toBeGreaterThan(0);
  });

  for (const dir of PURE_DIRS) {
    let list: string[] = [];
    try {
      list = files(path.join(SRC, dir));
    } catch {
      continue;
    }
    for (const file of list) {
      it(`${path.relative(SRC, file)}`, () => {
        expect(violations(readFileSync(file, "utf8"))).toEqual([]);
      });
    }
  }

  // Each pure directory says so to the bundler: with `sideEffects: false` an unused import is dropped from a page's start bundle. Without it the
  // trip page start bundle grew by 0.8 KB gzip (the chunk packing changed) and tipped web/tests/budget.test.ts over 200 KB.
  for (const dir of PURE_DIRS) {
    it(`${dir}/package.json marks the directory side-effect free`, () => {
      const pkg = JSON.parse(readFileSync(path.join(SRC, dir, "package.json"), "utf8")) as { type?: string; sideEffects?: unknown };
      expect(pkg.sideEffects).toBe(false);
      expect(pkg.type).toBe("module");
    });
  }

  it("the detector catches a planted import", () => {
    expect(violations(`import fs from 'node:fs';`)).toHaveLength(1);
    expect(violations(`import { useState } from 'react';`)).toHaveLength(1);
    expect(violations(`import x from '@/lib/format/age';`)).toHaveLength(1);
    expect(violations(`import { a } from './a.ts'; export * from '../b.ts';`)).toEqual([]);
  });
});
