// Shared by the catalog tests: a MemoryStore over the sidecar fixture root. Policy, freshness, the difficulty map and the
// tag vocabulary come from the repository (they are the real rules); locations and sidecars come from the fixture root.
// Nothing here touches data/catalog of the repository and nothing uses the network.
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDeps } from "../../src/catalog/common.ts";
import { runCatalogOp } from "../../src/catalog/ops.ts";
import type { RunResult } from "../../src/ops/run.ts";
import type { Deps } from "../../src/catalog/common.ts";
import { MemoryStore } from "../../src/store/memory.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, "..", "..", "..");
export const FIXROOT = join(HERE, "..", "fixtures", "sidecars", "root");
export const TODAY = "2026-10-17";
export const NOW = "2026-10-17T15:00:00Z";
export const OWNER = { id: "u_owner", via: "ui" } as const;
export const AGENT = { id: "agent:trails", via: "cli" } as const;

const read = (root: string, rel: string): string => readFileSync(join(root, rel), "utf8");

export const SIDECARS = {
  trails: "research/trips/patagonia-fixture/trails.json",
  adventure: "research/trips/rockies-fixture/adventure.json",
  stays: "research/trips/stays-fixture/stays.json",
  corroborate: "research/trips/patagonia-fixture/trails-corroborate.json",
  update: "research/trips/patagonia-fixture/trails-update.json",
  weak: "research/trips/patagonia-fixture/trails-weak.json",
  incomplete: "research/trips/patagonia-fixture/trails-incomplete.json",
  badArea: "research/trips/patagonia-fixture/trails-badarea.json",
  duplicate: "research/trips/stays-fixture/stays-duplicate.json",
  priceJump: "research/trips/rockies-fixture/adventure-price-jump.json",
};

export function newStore(extra: Record<string, string> = {}): MemoryStore {
  return new MemoryStore(FIXROOT, {
    "data/catalog/policy.json": read(REPO, "data/catalog/policy.json"),
    "data/schema/freshness.json": read(REPO, "data/schema/freshness.json"),
    "data/schema/difficulty-map.json": read(REPO, "data/schema/difficulty-map.json"),
    "data/vocab/tags.json": read(FIXROOT, "data/vocab/tags.json"),
    "data/locations/locations.json": read(FIXROOT, "data/locations/locations.json"),
    ...extra,
  });
}

export const deps = (): Promise<Deps> => loadDeps(newStore());
export const sidecar = (path: string): any => JSON.parse(read(FIXROOT, path));

export const op = (store: MemoryStore, name: string, input: Record<string, unknown>, actor: { id: string; via: string } = OWNER, today = TODAY): Promise<RunResult> =>
  runCatalogOp(store, name, { actor, ...input }, { now: `${today}T15:00:00Z`, today });

export function must<T extends RunResult>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error(`${(r as any).code}: ${(r as any).message}`);
  return r as any;
}

/** propose a sidecar, return the proposal */
export async function propose(store: MemoryStore, path: string, actor = AGENT, today = TODAY): Promise<any> {
  const r: any = must(await op(store, "catalog.propose", { sidecar: path }, actor, today));
  return r.result;
}

export const rows = (store: MemoryStore, path: string, table: string): any[] => JSON.parse(store.text(path)!)[table];

/** a real directory with the fixture root plus the repository's rules, for the CLI and the HTTP server */
export function tmpRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "p4b-root-"));
  cpSync(FIXROOT, root, { recursive: true });
  for (const rel of ["data/catalog/policy.json", "data/schema/freshness.json", "data/schema/difficulty-map.json"]) {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    copyFileSync(join(REPO, rel), join(root, rel));
  }
  return root;
}
