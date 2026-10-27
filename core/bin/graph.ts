#!/usr/bin/env node
// The graph index CLI (entity-graph 8; EG-I): build writes data/catalogue/graph/*.json, build --check fails on drift (hand edit, stale
// index, orphan file). Server side only: nothing under web/ imports this, and nothing is copied to a served path (P8, P9).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorld } from "../src/capture/records.ts";
import { GRAPH_DIR, buildFiles } from "../src/graph/build.ts";

const USAGE = `Usage: node core/bin/graph.ts build [--check] [--json] [--root <dir>]
  build            write data/catalogue/graph/ (index.json and one file per country); removes files with no source
  build --check    exit 1 when a file is missing, differs or is an orphan (runs in tools/check-all.sh)
  build --json     print the counts (records per kind, containers, records with a container, cycles)
`;

function main(argv: string[]): number {
  if (argv[0] !== "build") { process.stdout.write(USAGE); return argv.includes("--help") ? 0 : 2; }
  const at = argv.indexOf("--root");
  const root = at >= 0 ? resolve(argv[at + 1] ?? ".") : resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const rep = buildFiles(loadWorld(root));
  const dir = join(root, GRAPH_DIR);
  const want = new Set(rep.files.map((f) => f.path));
  const orphans = existsSync(dir) ? readdirSync(dir).map((n) => `${GRAPH_DIR}/${n}`).filter((p) => !want.has(p)) : [];
  if (argv.includes("--json")) {
    process.stdout.write(JSON.stringify({ records: rep.records, edges: rep.edges, containers: rep.containers, withContainer: rep.withContainer, byKind: rep.byKind, cycles: rep.cycles }, null, 1) + "\n");
  }
  if (argv.includes("--check")) {
    const bad: string[] = [];
    for (const f of rep.files) {
      const p = join(root, f.path);
      if (!existsSync(p)) bad.push(`${f.path}: missing`);
      else if (readFileSync(p, "utf8") !== f.text) bad.push(`${f.path}: differs`);
    }
    for (const o of orphans) bad.push(`${o}: stale (no source)`);
    if (rep.cycles.length) bad.push(`containment cycles: ${rep.cycles.map((c) => c.join(" > ")).join("; ")}`);
    if (bad.length) { process.stderr.write(bad.join("\n") + "\nRun: node core/bin/graph.ts build\n"); return 1; }
    process.stdout.write(`graph index current (${rep.files.length} files, ${rep.records} records)\n`);
    return 0;
  }
  for (const f of rep.files) { mkdirSync(dirname(join(root, f.path)), { recursive: true }); writeFileSync(join(root, f.path), f.text); }
  for (const o of orphans) rmSync(join(root, o));
  process.stdout.write(`wrote ${rep.files.length} files (${rep.records} records, ${rep.withContainer} with a container, ${rep.cycles.length} cycles)\n`);
  return 0;
}
process.exit(main(process.argv.slice(2)));
