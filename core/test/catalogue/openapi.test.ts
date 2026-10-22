import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OPENAPI_PATH, buildOpenApi, openApiText } from "../../src/catalogue/openapi.ts";
import { CATALOGUE_CONTRACT } from "../../src/catalogue/store.ts";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const doc = buildOpenApi() as { openapi: string; paths: Record<string, Record<string, { operationId?: string; parameters?: { name: string; in: string }[]; responses: Record<string, unknown> }>>; components: { schemas: Record<string, unknown> } };

describe("OpenAPI document", () => {
  it("is 3.1 and documents every contract method with its responses", () => {
    expect(doc.openapi).toBe("3.1.0");
    const ops = Object.values(doc.paths).flatMap((p) => Object.values(p).map((o) => o.operationId));
    for (const m of Object.keys(CATALOGUE_CONTRACT)) expect(ops, m).toContain(m);
    for (const p of Object.values(doc.paths)) for (const o of Object.values(p)) expect(Object.keys(o.responses).length).toBeGreaterThan(0);
  });
  it("documents the flat URL parameters of the list, not the store input", () => {
    const params = doc.paths["/api/v1/places"]!.get!.parameters!.map((p) => p.name);
    expect(params).toEqual(expect.arrayContaining(["q", "country", "region", "sort", "dir", "page", "pageSize"]));
    expect(params).not.toContain("facets");
  });
  it("has no reference the document cannot resolve", () => {
    const text = JSON.stringify(doc);
    expect(text).not.toContain("#/$defs");
    for (const m of text.matchAll(/"#\/components\/schemas\/([^"]+)"/g)) expect(doc.components.schemas, m[1]).toHaveProperty([m[1]!]);
  });
  it("the committed file is current", () => {
    expect(readFileSync(resolve(ROOT, OPENAPI_PATH), "utf8")).toBe(openApiText());
  });
});
