// The seed commands over a connection (LOCAL-2): `seed`, `sync`, `sync --dry-run`, `verify`. Orchestration only; the CLI
// (core/bin/db-seed.ts) parses arguments, resolves the target through the guard and opens the connection, then calls this.
import { buildRegistry, registryText, REGISTRY_PATH } from "../../../sources/build.ts";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  driftExitCode, formatDrift, formatPlan, planExitCode, PLAN_EXIT,
  type DriftResult, type SeedPlan, type TargetFacts,
} from "../../../seed/index.ts";
import { applySeed, nonEmptyTables, planSeed, readOnly, verifySeed, SeedEngineError, type ApplyResult, type Db } from "./engine.ts";
import type { FileSource } from "./files.ts";
import { buildReferenceSeed, SeedInputError, type BuiltSeed, type TableData } from "./reference.ts";

export type SeedCommand = "seed" | "sync" | "sync_dry_run" | "verify";

/**
 * Build the seed rows from a file source. Refuses (before anything is written or read from a database) a row that carries the
 * owner's list origin or a private key. For the working tree, the generated source registry must match the lane files first
 * (`sources.ts check`), because the registry is read as the `source` rows.
 */
export function buildSeed(src: FileSource, commit: string, opts: { checkRegistryAt?: string } = {}): TableData[] {
  if (opts.checkRegistryAt) assertRegistryCurrent(opts.checkRegistryAt);
  const built: BuiltSeed = buildReferenceSeed(src, commit);
  if (built.refusals.length) {
    const r = built.refusals[0]!;
    throw new SeedInputError(r.code, `a seed row carries private data (${r.code} at ${r.where}); ${built.refusals.length} refusal(s)`);
  }
  return built.tables;
}

/** `sources.ts check` for the registry: the file must be what the lane files derive (generated, never hand-edited). */
export function assertRegistryCurrent(root: string): void {
  const file = path.join(root, REGISTRY_PATH);
  if (!existsSync(file)) throw new SeedInputError("E_SEED_REGISTRY", `${REGISTRY_PATH} does not exist; run: node core/bin/sources.ts build`);
  const { registry } = buildRegistry(root);
  if (readFileSync(file, "utf8") !== registryText(registry)) {
    throw new SeedInputError("E_SEED_REGISTRY", `${REGISTRY_PATH} drifts from the lane files; run: node core/bin/sources.ts build`);
  }
}

export interface CommandResult {
  exit: number;
  text: string;
  plan?: SeedPlan;
  drift?: DriftResult;
  applied?: ApplyResult;
}

export const totalWritten = (r: ApplyResult): number => Object.values(r.written).reduce((a, b) => a + b, 0);

export async function executeSeedCommand(db: Db, command: SeedCommand, built: readonly TableData[], facts: { commit: string; target: TargetFacts }): Promise<CommandResult> {
  switch (command) {
    case "sync_dry_run": {
      const { plan } = await readOnly(db, () => planSeed(db, built, facts));
      return { exit: planExitCode(plan), text: formatPlan(plan), plan };
    }
    case "verify": {
      const drift = await readOnly(db, () => verifySeed(db, built, facts));
      return { exit: driftExitCode(drift), text: formatDrift(drift), drift };
    }
    case "seed": {
      const filled = await readOnly(db, () => nonEmptyTables(db, built));
      if (filled.length) {
        throw new SeedEngineError("E_SEED_NOT_EMPTY", `db:seed expects an empty catalogue; these tables hold rows: ${filled.join(", ")}. Use db:sync.`);
      }
      return applied(await applySeed(db, built, facts));
    }
    case "sync":
      return applied(await applySeed(db, built, facts));
  }
}

function applied(r: ApplyResult): CommandResult {
  const rows = totalWritten(r);
  return { exit: PLAN_EXIT.same, text: `${formatPlan(r.plan)}\nwrote ${rows} row(s) in ${r.elapsedMs} ms`, plan: r.plan, applied: r };
}
