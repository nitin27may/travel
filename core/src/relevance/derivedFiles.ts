// Cross-file checks over data/relevance/<trip>/*.json.
import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { relevanceFiles } from "./refs.ts";

/** [trip, ref, files] for each ref that appears in more than one lane file of a trip. */
export function duplicateRefs(root: string): [string, string, string[]][] {
  const seen = new Map<string, string[]>();
  for (const f of relevanceFiles(root)) {
    const trip = basename(dirname(f));
    let refs: string[] = [];
    try {
      refs = [...new Set(((JSON.parse(readFileSync(f, "utf8")) as { records?: { ref: string }[] }).records ?? []).map((r) => r.ref))];
    } catch {
      continue; // the validator reports unreadable files
    }
    for (const r of refs) seen.set(`${trip}\u0000${r}`, [...(seen.get(`${trip}\u0000${r}`) ?? []), f]);
  }
  return [...seen].filter(([, v]) => v.length > 1).map(([k, v]) => [k.split("\u0000")[0]!, k.split("\u0000")[1]!, v]);
}
