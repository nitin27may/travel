// Where the seed reads its input files from (LOCAL-2; spec 6.1 and 9: "non-local targets read committed files only").
//   fsSource(root)         the working tree: the `local` and `ci` targets, so a developer seeds what they are editing
//   gitSource(root, sha)   `git cat-file --batch` over one commit: every other target, so the rows are a function of a commit
// Both apply the same deny list (NEVER_READ_INPUTS) and the same globs, so the two give the same file set for the same data. This
// module reads the machine (files, git); the row builders and the planner do not.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expandInputs, globMatch, type SeedInput } from "../../../seed/index.ts";
import { deniedInput } from "../../../seed/privacy.ts";

export interface FileSource {
  /** `working-tree`, or the commit sha */
  readonly label: string;
  /** the repository paths the inputs expand to (sorted); denied files are reported, never returned */
  expand(inputs: readonly SeedInput[]): { files: string[]; denied: string[] };
  /** the text of a repository file; throws when it does not exist */
  read(file: string): string;
}

export function fsSource(root: string): FileSource {
  return {
    label: "working-tree",
    expand: (inputs) => expandInputs(root, inputs),
    read: (file) => readFileSync(path.join(root, file), "utf8"),
  };
}


/** Files of a commit: one `git ls-tree`, one `git cat-file --batch` for everything the inputs name. */
export function gitSource(root: string, sha: string): FileSource {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("gitSource: the commit must be a full 40-hex sha");
  let tree: string[] | undefined;
  const listing = (): string[] => (tree ??= execFileSync("git", ["-C", root, "ls-tree", "-r", "--name-only", sha], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).split("\n").filter(Boolean));
  const cache = new Map<string, string>();
  const load = (files: readonly string[]): void => {
    const todo = files.filter((f) => !cache.has(f));
    if (todo.length === 0) return;
    const r = spawnSync("git", ["-C", root, "cat-file", "--batch"], { input: todo.map((f) => `${sha}:${f}\n`).join(""), maxBuffer: 1024 * 1024 * 1024 });
    if (r.status !== 0) throw new Error("git cat-file failed");
    const buf = r.stdout;
    let at = 0;
    for (const f of todo) {
      const nl = buf.indexOf(10, at);
      const header = buf.subarray(at, nl).toString("utf8");
      const m = /^[0-9a-f]{40} blob (\d+)$/.exec(header);
      if (!m) throw new Error(`${f} is not a file in commit ${sha.slice(0, 12)}`);
      const size = Number(m[1]);
      cache.set(f, buf.subarray(nl + 1, nl + 1 + size).toString("utf8"));
      at = nl + 1 + size + 1;
    }
  };
  return {
    label: sha,
    expand(inputs) {
      const files = new Set<string>();
      const denied = new Set<string>();
      for (const f of listing()) {
        for (const input of inputs) {
          if (!globMatch(input.glob, f) || (input.exclude ?? []).some((x) => globMatch(x, f))) continue;
          if (deniedInput(f)) denied.add(f);
          else files.add(f);
        }
      }
      const sorted = [...files].sort();
      load(sorted);
      return { files: sorted, denied: [...denied].sort() };
    },
    read(file) {
      load([file]);
      return cache.get(file)!;
    },
  };
}

/** Which source a target reads: the working tree for loopback targets, the committed files of `commit` for every other. */
export function sourceFor(root: string, loopback: boolean, commit: string): FileSource {
  return loopback ? fsSource(root) : gitSource(root, commit);
}

