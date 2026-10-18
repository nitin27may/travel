// Synthetic lane files for the source registry tests. Values here check the code; they are not data.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll } from "vitest";

const dirs: string[] = [];
export function tmpRoot(): string {
  const d = mkdtempSync(join(tmpdir(), "src-reg-"));
  dirs.push(d);
  return d;
}
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

export function put(root: string, rel: string, body: unknown): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

export interface Row { id: string; url: string; title: string; publisher: string; kind: string; read: string }
export const row = (id: string, url: string, o: Partial<Row> = {}): Row => ({ id, url, title: "T " + id, publisher: "Pub", kind: "official", read: "2026-10-01", ...o });
const val = (src: string[]) => ({ v: 1, state: "value", basis: "official_info", src });

export function lane(rows: Row[], records: { ref: string; body: Record<string, unknown> }[], schema = "suitability/1") {
  return { schema, trip: "t", lane: "R1", researched: "2026-10-01", sources: rows, records: records.map((r) => ({ ref: r.ref, kind: "trail", ...r.body })) };
}
export { val };

/** A root with two lane files that share one page under different spellings. */
export function twoLaneRoot(): string {
  const root = tmpRoot();
  put(root, "data/suitability/t/R1.json", lane(
    [row("src-0001", "https://Example.com/Trail/?utm_source=x&b=2&a=1#top"), row("src-0002", "https://park.gov/rules/")],
    [{ ref: "trail/a", body: { suitability: { min_age: { ...val(["src-0001"]) }, access_season: { ...val(["src-0002"]), conflicts: [{ v: 2, basis: "official_info", src: ["src-0001"] }] } } } }],
  ));
  put(root, "data/relevance/t/R6.json", lane(
    [row("src-0001", "https://example.com/Trail?a=1&b=2", { read: "2026-10-18", title: "Trail page", kind: "blog" })],
    [{ ref: "trail/a", body: { draw: val(["src-0001"]) } }, { ref: "trail/b", body: { draw: val(["src-0001"]) } }],
    "relevance/1",
  ));
  return root;
}
