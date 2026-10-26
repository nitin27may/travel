#!/usr/bin/env node
// The pinned slug registry (D-B1): data/catalogue/slugs.json. See core/src/catalogue/slugs.ts for the rules.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ORIGIN_KEYS_PATH, SLUG_REGISTRY_PATH, aliasKey, emptyOriginKeys, emptyRegistry, mergeKey, migrateOrigins, originDrift, originKeysText, parseOriginKeys,
  parseRegistry, registryDrift, registryText, renameSlug, reoriginKey, unmintKey, updateOriginKeys, updateRegistry, withdrawKey,
  type OriginKeys, type SlugRegistry, type SlugSnapshot,
} from "../src/catalogue/slugs.ts";

const USAGE = `Usage: node core/bin/slugs.ts <command> [options]

data/catalogue/slugs.json pins every place and trip slug, their history and every canonical region value (D-B1, D-B3). A pinned
slug never changes silently; these commands are the only ways to change the file.

Commands:
  build                     pin every new key and region the dataset builder assigns today; never changes a pinned slug
  --check | check           fail when the builder and the registry disagree: a pinned slug would change, a pinned key or region
                            has no record (run alias), or a key or region is not pinned yet (run build)
  rename <key> <slug>       give a place or trip key a new slug; the old slug is retired and answers 308 to the new one
  alias <old-key> <new-key> carry a slug over to a new identity key (a locations place gaining a capture record, a trip import);
                            the old key stays in formerKeys so an old ref still resolves
  merge <key> <survivor>    a place merged into another page (same_place_as): its slug answers 308 to the survivor's
  withdraw <key>            a place or trip gone with no successor: its slug stays reserved and answers not_found; build restores it
                            when the record comes back
  unmint <key> --released <git ref>
                            drop the pin of a key that was never public (absent, with its slug, from the registry at the
                            released ref, e.g. release/v0.1), so build mints it again from today's rule; nothing is retired and
                            nothing answers 308. Refuses a key or slug the release holds: those change only through rename
  reorigin <old> <new>      a wishlist or prototype id changed (loc:<id>, proto:<id>): the page keeps its place/<slug> ref; edits only
                            the PRIVATE ${ORIGIN_KEYS_PATH} (A24)
  migrate-origins           once (REF1): rekey every loc:/proto: key of the registry to place/<slug> and move the origin to the
                            private file; refuses to run on a registry that has none

A page with no capture record has the ref place/<slug>; its origin is kept only in the private ${ORIGIN_KEYS_PATH}, which
build and --check maintain next to the registry (store.ts A24).

Options:
  --root <dir>        repository root (default: two levels above this file)
  --snapshot <file>   read the builder's assignment from this file instead of running the web dump (tests)
  --released <ref>    unmint: the git ref of the deployed release whose registry is permanent
  --released-file <f> unmint: read the released registry from this file instead of git (tests)
`;

const arg = (argv: string[], name: string): string | null => {
  const at = argv.indexOf(name);
  return at >= 0 ? (argv[at + 1] ?? null) : null;
};
const out = (s: string): void => void process.stdout.write(`${s}\n`);
const err = (s: string): void => void process.stderr.write(`${s}\n`);

function readRegistry(root: string): SlugRegistry | null {
  const p = join(root, SLUG_REGISTRY_PATH);
  return existsSync(p) ? parseRegistry(readFileSync(p, "utf8")) : null;
}

function readOrigins(root: string): OriginKeys {
  const p = join(root, ORIGIN_KEYS_PATH);
  return existsSync(p) ? parseOriginKeys(readFileSync(p, "utf8")) : emptyOriginKeys();
}

function writeOrigins(root: string, o: OriginKeys): void {
  const p = join(root, ORIGIN_KEYS_PATH);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, originKeysText(o));
}

function writeRegistry(root: string, reg: SlugRegistry): void {
  const p = join(root, SLUG_REGISTRY_PATH);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, registryText(reg));
}

/** What the builder assigns today: runs core/test/catalogue/dump inside web/ (core cannot import web/), then reads its output. */
function snapshot(root: string, argv: string[]): SlugSnapshot {
  const given = arg(argv, "--snapshot");
  if (given) return JSON.parse(readFileSync(resolve(given), "utf8")) as SlugSnapshot;
  const web = join(root, "web");
  const run = spawnSync("pnpm", ["--dir", web, "exec", "vitest", "run", "-c", "../core/test/catalogue/dump/vitest.config.mts"], { encoding: "utf8" });
  if (run.status !== 0) {
    err(run.stdout ?? "");
    err(run.stderr ?? "");
    throw new Error("the slug snapshot dump failed (see above)");
  }
  return JSON.parse(readFileSync(join(web, ".generated", "slug-snapshot.json"), "utf8")) as SlugSnapshot;
}

function build(root: string, argv: string[]): number {
  const prev = readRegistry(root) ?? emptyRegistry();
  const snap = snapshot(root, argv);
  const { registry, added, problems, warnings } = updateRegistry(prev, snap);
  const origins = updateOriginKeys(readOrigins(root), snap);
  for (const w of warnings) err(`WARN ${w}`);
  if (problems.length || origins.problems.length) {
    for (const p of [...problems, ...origins.problems]) err(`ERROR ${p}`);
    err(`${SLUG_REGISTRY_PATH} not written: settle the problems above first`);
    return 1;
  }
  writeRegistry(root, registry);
  if (snap.origins || existsSync(join(root, ORIGIN_KEYS_PATH))) writeOrigins(root, origins.originKeys);
  out(`wrote ${SLUG_REGISTRY_PATH}: ${summary(registry)}; ${added.length} entries added; ${origins.added} origin(s) pinned privately`);
  return 0;
}

const n = (r: object): number => Object.keys(r).length;
const summary = (r: SlugRegistry): string =>
  `${n(r.places.slugs)} place slugs (${n(r.places.merged)} merged, ${n(r.places.retired)} retired, ${n(r.places.withdrawn)} withdrawn), ${n(r.trips.slugs)} trip slugs, ${n(r.formerKeys)} former keys, ${n(r.regions)} regions`;

function check(root: string, argv: string[]): number {
  const reg = readRegistry(root);
  if (!reg) {
    err(`${SLUG_REGISTRY_PATH} does not exist; run: node core/bin/slugs.ts build`);
    return 1;
  }
  const snap = snapshot(root, argv);
  const { drift: regDrift, warnings } = registryDrift(reg, snap);
  const drift = [...regDrift, ...originDrift(readOrigins(root), snap, reg)];
  for (const w of warnings) err(`WARN ${w}`);
  if (drift.length) {
    for (const d of drift) err(`DRIFT ${d}`);
    return 1;
  }
  out(`OK: ${summary(reg)}`);
  return 0;
}

function edit(root: string, change: (reg: SlugRegistry) => SlugRegistry, what: string): number {
  const reg = readRegistry(root);
  if (!reg) {
    err(`${SLUG_REGISTRY_PATH} does not exist; run: node core/bin/slugs.ts build`);
    return 1;
  }
  writeRegistry(root, change(reg));
  out(`${what}; run \`node core/bin/slugs.ts --check\` after the data change it belongs to`);
  return 0;
}

/** The registry of the deployed release: from `--released-file`, or `git show <--released>:data/catalogue/slugs.json`. */
function releasedRegistry(root: string, argv: string[]): SlugRegistry {
  const file = arg(argv, "--released-file");
  if (file) return parseRegistry(readFileSync(resolve(file), "utf8"));
  const ref = arg(argv, "--released");
  if (!ref) throw new Error("unmint needs --released <git ref> (the deployed release, e.g. release/v0.1) or --released-file <file>");
  const run = spawnSync("git", ["-C", root, "show", `${ref}:${SLUG_REGISTRY_PATH}`], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`cannot read ${SLUG_REGISTRY_PATH} at ${ref}: ${(run.stderr ?? "").trim()}`);
  return parseRegistry(run.stdout);
}

function unmint(root: string, k: string, argv: string[]): number {
  const reg = readRegistry(root);
  if (!reg) {
    err(`${SLUG_REGISTRY_PATH} does not exist`);
    return 1;
  }
  const m = unmintKey(reg, readOrigins(root), k, releasedRegistry(root, argv));
  writeRegistry(root, m.registry);
  if (m.origins) writeOrigins(root, m.originKeys);
  out(`${k} (slug ${m.slug}) is no longer pinned${m.origins ? ` and its origin is unpinned in ${ORIGIN_KEYS_PATH}` : ""}; run \`node core/bin/slugs.ts build\` to mint it again`);
  return 0;
}

export function main(argv: string[]): number {
  const root = resolve(arg(argv, "--root") ?? join(dirname(fileURLToPath(import.meta.url)), "..", ".."));
  const VALUE_FLAGS = ["--root", "--snapshot", "--released", "--released-file"];
  const cmd = argv.find((a, i) => !a.startsWith("--") && !VALUE_FLAGS.includes(argv[i - 1] ?? ""));
  try {
    if (argv.includes("--check") || cmd === "check") return check(root, argv);
    if (cmd === "build") return build(root, argv);
    const rest = argv.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.includes(argv[i - 1] ?? ""));
    if (cmd === "rename" && rest.length === 3) return edit(root, (r) => renameSlug(r, rest[1]!, rest[2]!), `${rest[1]} is now ${rest[2]}; its old slug answers 308`);
    if (cmd === "alias" && rest.length === 3) return edit(root, (r) => aliasKey(r, rest[1]!, rest[2]!), `${rest[2]} carries the slug of ${rest[1]}`);
    if (cmd === "merge" && rest.length === 3) return edit(root, (r) => mergeKey(r, rest[1]!, rest[2]!), `${rest[1]} is merged into ${rest[2]}; its slug answers 308`);
    if (cmd === "withdraw" && rest.length === 2) return edit(root, (r) => withdrawKey(r, rest[1]!), `${rest[1]} is withdrawn; its slug stays reserved`);
    if (cmd === "unmint" && rest.length === 2) return unmint(root, rest[1]!, argv);
    if (cmd === "reorigin" && rest.length === 3) {
      writeOrigins(root, reoriginKey(readOrigins(root), rest[1]!, rest[2]!));
      out(`the page keeps its ref under the new origin (${ORIGIN_KEYS_PATH}); run \`node core/bin/slugs.ts --check\``);
      return 0;
    }
    if (cmd === "migrate-origins" && rest.length === 1) {
      const reg = readRegistry(root);
      if (!reg) {
        err(`${SLUG_REGISTRY_PATH} does not exist`);
        return 1;
      }
      const m = migrateOrigins(reg, readOrigins(root));
      if (m.moved === 0) {
        err("the registry holds no origin key: nothing to migrate");
        return 1;
      }
      writeRegistry(root, m.registry);
      writeOrigins(root, m.originKeys);
      out(`rekeyed ${m.moved} origin keys to place/<slug>; their origins are in ${ORIGIN_KEYS_PATH} (A24)`);
      return 0;
    }
  } catch (e) {
    err(e instanceof Error ? e.message : String(e));
    return 1;
  }
  err(USAGE);
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
