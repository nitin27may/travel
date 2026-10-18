#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SourceEntry, SourceRegistry } from "../src/schema/sources.ts";
import { buildRegistry, LINKS_PATH, pruneOrphanLinks, readLinks, REGISTRY_PATH, registryText } from "../src/sources/build.ts";
import type { LinksFile } from "../src/sources/build.ts";
import { addDays, daysBetween } from "../src/sources/cadence.ts";
import { LINK_USER_AGENT, LinkChecker } from "../src/sources/links.ts";
import { isWebUrl, normaliseUrl, sourceId } from "../src/sources/normalize.ts";
import { validateFile } from "../src/validate/index.ts";

const USAGE = `Usage: node core/bin/sources.ts <command> [options]

The registry data/sources/registry.json is derived from the sources arrays of data/suitability and data/relevance lane files.
Never edit it by hand.

Commands:
  build [--check]          derive the registry (offline, deterministic) and write it; --check only compares
  who <url|id>             the facts (file, ref, field) that rely on a source
  due [--today d]          sources whose re-check date has passed, by cadence (prices and hours 90 days, seasons and closures 180,
                           rules 365, grades and geography 730)
  by-publisher             sources and facts per publisher
  check                    validate the registry and fail when it drifts from the lane files
  links [--fetch] [--stale-days n]
                           without --fetch print the cached link results; with --fetch request each web source (HEAD, then GET),
                           500 ms apart per host, skipping links checked in the last n days (default 30; an error result is always retried), drop results whose source no lane file uses any more, and store data/sources/links.json
                           User-Agent: ${LINK_USER_AGENT}

Options:
  --root <dir>   repository root (default: two levels above this file)
  --today <iso>  date used for due and for link checks (default: today)
  --json         machine-readable output where a command prints a list
`;

const arg = (argv: string[], name: string): string | null => {
  const at = argv.indexOf(name);
  return at >= 0 ? (argv[at + 1] ?? null) : null;
};
const out = (s: string): void => void process.stdout.write(s + "\n");
const todayOf = (argv: string[]): string => arg(argv, "--today") ?? new Date().toISOString().slice(0, 10);

function loadRegistry(root: string): SourceRegistry | null {
  const p = join(root, REGISTRY_PATH);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as SourceRegistry) : null;
}

function need(root: string): SourceRegistry {
  const r = loadRegistry(root);
  if (!r) throw new Error(`${REGISTRY_PATH} does not exist; run: node core/bin/sources.ts build`);
  return r;
}

function build(argv: string[], root: string): number {
  const { registry, problems, lanes, rows } = buildRegistry(root);
  for (const p of problems) process.stderr.write(`WARN ${p.file}: ${p.message}\n`);
  const text = registryText(registry);
  const path = join(root, REGISTRY_PATH);
  if (argv.includes("--check")) {
    const same = existsSync(path) && readFileSync(path, "utf8") === text;
    out(same ? `OK: registry matches ${lanes} lane file(s)` : `DRIFT: ${REGISTRY_PATH} differs from the lane files; run: node core/bin/sources.ts build`);
    return same ? 0 : 1;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  out(`wrote ${REGISTRY_PATH}: ${registry.entries.length} unique source(s) from ${rows} source row(s) in ${lanes} lane file(s)`);
  return 0;
}

function findEntry(reg: SourceRegistry, key: string): SourceEntry | null {
  const id = /^s-[0-9a-f]{10}$/.test(key) ? key : sourceId(normaliseUrl(key));
  return reg.entries.find((e) => e.id === id) ?? null;
}

function who(argv: string[], root: string): number {
  const key = argv[1];
  if (!key || key.startsWith("--")) {
    process.stderr.write("who needs a url or an id\n");
    return 2;
  }
  const e = findEntry(need(root), key);
  if (!e) {
    process.stderr.write(`no source ${key} in the registry\n`);
    return 1;
  }
  if (argv.includes("--json")) out(JSON.stringify(e.used_by, null, 2));
  else {
    out(`${e.id}  ${e.url}\n${e.title} (${e.publisher}, ${e.kind}); read ${e.first_read}..${e.last_read}; link ${e.link.status}`);
    for (const u of e.used_by) out(`${u.ref}\t${u.field}\t${u.file}`);
    out(`${e.used_by.length} fact(s) rely on it`);
  }
  return 0;
}

interface Due { id: string; url: string; publisher: string; fact_type: string; cadence_days: number; last_read: string; due: string; overdue_days: number }
export function dueList(reg: SourceRegistry, today: string): Due[] {
  const rows: Due[] = [];
  for (const e of reg.entries) {
    if (e.link.status === "local") continue;
    const due = addDays(e.last_read, e.recheck.cadence_days);
    if (due <= today) rows.push({ id: e.id, url: e.url, publisher: e.publisher, fact_type: e.recheck.fact_type, cadence_days: e.recheck.cadence_days, last_read: e.last_read, due, overdue_days: daysBetween(due, today) });
  }
  return rows.sort((a, b) => b.overdue_days - a.overdue_days || (a.id < b.id ? -1 : 1));
}

function due(argv: string[], root: string): number {
  const today = todayOf(argv);
  const rows = dueList(need(root), today);
  if (argv.includes("--json")) out(JSON.stringify(rows, null, 2));
  else {
    for (const r of rows) out(`${r.id}\tdue ${r.due}\t${r.overdue_days}d over\t${r.fact_type} (${r.cadence_days}d)\t${r.publisher}\t${r.url}`);
    out(`${rows.length} source(s) due for a re-check on ${today}`);
  }
  return 0;
}

function byPublisher(argv: string[], root: string): number {
  const groups = new Map<string, { sources: number; facts: number }>();
  for (const e of need(root).entries) {
    const g = groups.get(e.publisher) ?? { sources: 0, facts: 0 };
    g.sources++;
    g.facts += e.used_by.length;
    groups.set(e.publisher, g);
  }
  const rows = [...groups.entries()].sort((a, b) => b[1].sources - a[1].sources || b[1].facts - a[1].facts || (a[0] < b[0] ? -1 : 1));
  if (argv.includes("--json")) out(JSON.stringify(rows.map(([publisher, g]) => ({ publisher, ...g })), null, 2));
  else {
    for (const [p, g] of rows) out(`${g.sources}\t${g.facts}\t${p}`);
    out(`${rows.length} publisher(s); columns: sources, facts relying on them, publisher`);
  }
  return 0;
}

function check(root: string): number {
  let errors = 0;
  const fail = (m: string): void => {
    errors++;
    out(`ERROR ${m}`);
  };
  const path = join(root, REGISTRY_PATH);
  if (!existsSync(path)) fail(`${REGISTRY_PATH} does not exist; run: node core/bin/sources.ts build`);
  else {
    for (const e of validateFile(path, root).errors) fail(`${REGISTRY_PATH}#${e.path}: ${e.message}`);
    const links = readLinks(root);
    const { registry, problems } = buildRegistry(root, links);
    for (const p of problems) fail(`${p.file}: ${p.message}`);
    if (readFileSync(path, "utf8") !== registryText(registry)) fail(`${REGISTRY_PATH} drifts from the lane files or links.json; run: node core/bin/sources.ts build`);
    const ids = new Set(registry.entries.map((e) => e.id));
    for (const id of Object.keys(links.links)) if (!ids.has(id)) fail(`${LINKS_PATH} has ${id}, which no lane file uses any more; run: node core/bin/sources.ts links --fetch, or drop the entry`);
    out(`${errors === 0 ? "OK" : "FAILED"}: ${registry.entries.length} source(s), ${errors} error(s)`);
    return errors > 0 ? 1 : 0;
  }
  out(`FAILED: ${errors} error(s)`);
  return 1;
}

function printLinks(reg: SourceRegistry, today: string): void {
  const counts = new Map<string, number>();
  for (const e of reg.entries) counts.set(e.link.status, (counts.get(e.link.status) ?? 0) + 1);
  out([...counts.entries()].sort().map(([k, v]) => `${k} ${v}`).join(", "));
  const links = reg.entries;
  for (const status of ["broken", "error", "blocked"]) {
    const list = links.filter((e) => e.link.status === status);
    if (list.length) out(`\n${status.toUpperCase()} (${list.length})`);
    for (const e of list) {
      out(`${e.url}\t${e.publisher}\tchecked ${e.link.checked ?? today}`);
      for (const u of e.used_by) out(`    ${u.ref} ${u.field}`);
    }
  }
}

async function links(argv: string[], root: string): Promise<number> {
  const today = todayOf(argv);
  if (!argv.includes("--fetch")) {
    printLinks(need(root), today);
    return 0;
  }
  const reg = need(root);
  const cache = readLinks(root);
  const staleDays = Number(arg(argv, "--stale-days") ?? 30);
  const checker = new LinkChecker({ today });
  const todo = reg.entries.filter((e) => {
    if (!isWebUrl(e.url)) return false;
    const c = cache.links[e.id];
    return !c || c.status === "error" || daysBetween(c.checked, today) >= staleDays; // a transient error is always retried
  });
  out(`${todo.length} link(s) to check of ${reg.entries.length} source(s); User-Agent: ${LINK_USER_AGENT}`);
  const file: LinksFile = { schema: "source-links/1", links: { ...cache.links } };
  // prune orphans: a link result whose source no lane file uses any more (2.33); `check` fails on them
  const orphans = pruneOrphanLinks(file, reg.entries.map((e) => e.id));
  if (orphans.length) out(`pruned ${orphans.length} orphan link result(s)`);
  const save = (): void => {
    const sorted = Object.fromEntries(Object.entries(file.links).sort(([a], [b]) => (a < b ? -1 : 1)));
    writeFileSync(join(root, LINKS_PATH), JSON.stringify({ ...file, links: sorted }, null, 2) + "\n");
  };
  mkdirSync(join(root, "data", "sources"), { recursive: true });
  let n = 0;
  for (const e of todo) {
    file.links[e.id] = await checker.check(e.url);
    if (++n % 25 === 0) {
      save(); // keep partial progress if the run is interrupted
      process.stderr.write(`  ${n}/${todo.length}\n`);
    }
  }
  save();
  out(`${checker.requests.length} request(s) made; results in ${LINKS_PATH}`);
  // fold the new results into the registry, then print the report
  const { registry } = buildRegistry(root);
  writeFileSync(join(root, REGISTRY_PATH), registryText(registry));
  printLinks(registry, today);
  return 0;
}

async function main(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv.includes("--help")) {
    out(USAGE.trimEnd());
    return 0;
  }
  const root = resolve(arg(argv, "--root") ?? fileURLToPath(new URL("../..", import.meta.url)));
  switch (argv[0]) {
    case "build": return build(argv, root);
    case "who": return who(argv, root);
    case "due": return due(argv, root);
    case "by-publisher": return byPublisher(argv, root);
    case "check": return check(root);
    case "links": return links(argv, root);
    default:
      process.stderr.write(`Unknown command ${argv[0]}.\n${USAGE}`);
      return 2;
  }
}

main(process.argv.slice(2)).then((c) => process.exit(c), (e) => {
  process.stderr.write(String(e instanceof Error ? e.message : e) + "\n");
  process.exit(1);
});
