// The guard's and the engine's reads of the local machine, kept apart from the pure modules: the git state, the rehearsal evidence
// file, the HOSTS of the root env file, and the expansion of a seed table's input globs. Nothing here connects to a database.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { REHEARSAL_EVIDENCE_DIR } from "../config/database.ts";
import type { SeedInput } from "./contract.ts";
import { globMatch } from "./glob.ts";
import { hostsFromEnvText, type RepoState } from "./guard.ts";
import { deniedInput } from "./privacy.ts";
import type { RehearsalInput } from "./rehearsal.ts";

/** HEAD and whether the working tree is clean (no change to a tracked file, no untracked file that is not ignored). */
export function readRepoState(root: string): RepoState {
  const git = (...args: string[]): string => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  let head: string | null = null;
  let clean: boolean | null = null;
  try {
    head = git("rev-parse", "HEAD").trim();
  } catch {
    head = null;
  }
  try {
    clean = git("status", "--porcelain=v1", "--untracked-files=normal").trim() === "";
  } catch {
    clean = null;
  }
  return { head, clean };
}

/** Where the rehearsal evidence of a commit lives. */
export const rehearsalPath = (root: string, commit: string): string => path.join(root, REHEARSAL_EVIDENCE_DIR, `${commit}.json`);

/** The rehearsal evidence of a commit: not found, or found with its parsed JSON (undefined when it does not parse). */
export function readRehearsal(root: string, commit: string): RehearsalInput {
  const p = rehearsalPath(root, commit);
  if (!/^[0-9a-f]{40}$/.test(commit) || !existsSync(p)) return { found: false };
  try {
    return { found: true, value: JSON.parse(readFileSync(p, "utf8")) as unknown };
  } catch {
    return { found: true, value: undefined };
  }
}

/**
 * The production hosts named by the root env file (`.env.local` at the repository root). The file holds production secrets; its
 * text stays inside this call and only host names come out (hostsFromEnvText). No file, no hosts.
 */
export function readProductionHosts(root: string): string[] {
  const p = path.join(root, ".env.local");
  if (!existsSync(p)) return [];
  return hostsFromEnvText(readFileSync(p, "utf8"));
}

function walk(root: string, rel: string, depth: number): string[] {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const e of readdirSync(abs).sort()) {
    const r = rel ? `${rel}/${e}` : e;
    if (statSync(path.join(root, r)).isDirectory()) {
      if (depth > 0) out.push(...walk(root, r, depth - 1));
    } else out.push(r);
  }
  return out;
}

/**
 * The repository paths a list of seed inputs reads, sorted and de-duplicated. A path on the deny list is never returned; it is
 * reported in `denied` so the engine can refuse the run (E_SEED_DENIED_INPUT).
 */
export function expandInputs(root: string, inputs: readonly SeedInput[]): { files: string[]; denied: string[] } {
  const files = new Set<string>();
  const denied = new Set<string>();
  for (const input of inputs) {
    const segs = input.glob.split("/");
    const fixed = segs.findIndex((s) => s.includes("*"));
    const base = fixed < 0 ? segs.slice(0, -1).join("/") : segs.slice(0, fixed).join("/");
    const depth = fixed < 0 ? 0 : segs.length - 1 - fixed;
    for (const f of walk(root, base, depth)) {
      if (!globMatch(input.glob, f)) continue;
      if ((input.exclude ?? []).some((x) => globMatch(x, f))) continue;
      if (deniedInput(f)) denied.add(f);
      else files.add(f);
    }
  }
  return { files: [...files].sort(), denied: [...denied].sort() };
}
