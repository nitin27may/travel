// Prose links (spec 4.4): a `RECORDED <ref> <path> <date>` marker in a prose file must name a record that exists and a path that
// exists, and a `meta.research_ref` must name a file that exists. Prose is the archive and is never parsed for facts; this only
// checks that the two-way link holds.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { discover } from "./files.ts";
import { isObj } from "./common.ts";

export interface ProseIssue {
  kind: "recorded_ref" | "recorded_path" | "research_ref";
  file: string;
  line?: number;
  message: string;
}

const MARKER = /\bRECORDED\s+(\S+)\s+(\S+)\s+(\d{4}-\d{2}-\d{2})/;

function mdFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) mdFiles(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

export function checkProseLinks(root: string): ProseIssue[] {
  const issues: ProseIssue[] = [];
  const refs = new Set<string>();
  const researchRefs: { file: string; ref: string }[] = [];
  for (const f of discover(root, ["capture", "suitability", "relevance"])) {
    let d: unknown;
    try {
      d = JSON.parse(readFileSync(f.abs, "utf8"));
    } catch {
      continue;
    }
    if (!isObj(d) || !Array.isArray(d.records)) continue;
    for (const r of d.records) {
      if (!isObj(r)) continue;
      if (f.family === "capture" && typeof r.ref === "string") refs.add(r.ref);
      const m = r.meta;
      if (isObj(m) && Array.isArray(m.research_ref)) for (const x of m.research_ref) if (typeof x === "string") researchRefs.push({ file: f.file, ref: x });
    }
  }
  for (const dir of ["research/trips", "research/runs"]) {
    for (const abs of mdFiles(join(root, dir))) {
      const rel = abs.slice(root.length + 1).split(sep).join("/");
      readFileSync(abs, "utf8").split("\n").forEach((line, i) => {
        const m = MARKER.exec(line);
        if (!m) return;
        if (!refs.has(m[1]!)) issues.push({ kind: "recorded_ref", file: rel, line: i + 1, message: `RECORDED names a record that does not exist: ${m[1]}` });
        if (!existsSync(join(root, m[2]!))) issues.push({ kind: "recorded_path", file: rel, line: i + 1, message: `RECORDED names a file that does not exist: ${m[2]}` });
      });
    }
  }
  for (const { file, ref } of researchRefs) {
    const path = ref.split("#")[0]!;
    if (!existsSync(join(root, path))) issues.push({ kind: "research_ref", file, message: `meta.research_ref names a file that does not exist: ${path}` });
  }
  return issues;
}

