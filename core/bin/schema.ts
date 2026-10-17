#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "../src/schema/generate.ts";

const USAGE = `Usage: node core/bin/schema.ts <command> [options]

Commands:
  generate           write data/schema/generated/schema.json and schema.sql from core/src/schema
  generate --check   regenerate in memory; exit 1 with a diff if the committed files differ

Options:
  --root <dir>       repository root (default: two levels above this file)
  --help             show this text
`;

function unifiedDiff(path: string, text: string): string {
  const dir = mkdtempSync(join(tmpdir(), "schema-check-"));
  try {
    const fresh = join(dir, "regenerated");
    writeFileSync(fresh, text);
    if (!existsSync(path)) return `${path} does not exist\n`;
    const r = spawnSync("diff", ["-u", "--label", `${path} (committed)`, "--label", `${path} (regenerated)`, path, fresh], { encoding: "utf8" });
    return r.stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main(argv: string[]): number {
  if (argv.includes("--help") || argv.length === 0) {
    process.stdout.write(USAGE);
    return 0;
  }
  const rootAt = argv.indexOf("--root");
  const root = rootAt >= 0 ? resolve(argv[rootAt + 1] ?? ".") : resolve(fileURLToPath(new URL("../..", import.meta.url)));
  if (argv[0] !== "generate") {
    process.stderr.write(`Unknown command ${argv[0]}. Try: node core/bin/schema.ts generate [--check]\n`);
    return 2;
  }
  const outDir = join(root, "data", "schema", "generated");
  const files = generate();
  if (argv.includes("--check")) {
    let bad = 0;
    for (const f of files) {
      const path = join(outDir, f.file);
      const current = existsSync(path) ? readFileSync(path, "utf8") : null;
      if (current !== f.text) {
        bad++;
        process.stderr.write(unifiedDiff(path, f.text));
      }
    }
    if (bad > 0) {
      process.stderr.write(`\n${bad} generated file(s) are out of date. Run: node core/bin/schema.ts generate\n`);
      return 1;
    }
    process.stdout.write("generated schema files are up to date\n");
    return 0;
  }
  mkdirSync(outDir, { recursive: true });
  for (const f of files) writeFileSync(join(outDir, f.file), f.text);
  process.stdout.write(`wrote ${files.map((f) => join(outDir, f.file)).join(" and ")}\n`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
