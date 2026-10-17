// Shared by the catalog tests: a MemoryStore over the sidecar fixture root. Policy, freshness, the difficulty map and the
// tag vocabulary come from the repository (they are the real rules); locations and sidecars come from the fixture root.
// Nothing here touches data/catalog of the repository and nothing uses the network.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDeps } from "../../src/catalog/common.ts";
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

