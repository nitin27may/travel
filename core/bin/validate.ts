#!/usr/bin/env node
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ERROR_CODE_LIST, allFiles, validateFile } from "../src/validate/index.ts";

const USAGE = `Usage: node core/bin/validate.ts <file...> [--root <dir>] [--json]
       node core/bin/validate.ts --all [--root <dir>] [--json]

Validates trip, catalog, locations, sidecar and policy files against the schema in core/src/schema.
One line per problem:  ERROR E_FK data/trips/x/trip.json#/items/3/trail_id: message
Exit code 1 when any error is found, 0 otherwise.

Options:
  --all         validate data/trips, data/catalog, data/locations and the policy documents
  --root <dir>  repository root (default: two levels above this file); references resolve under it
  --json        print {"file", "errors", "warnings"} objects as JSON instead of lines
  --codes       list the error codes
`;

function main(argv: string[]): number {
  if (argv.includes("--help") || argv.length === 0) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (argv.includes("--codes")) {
    process.stdout.write(ERROR_CODE_LIST.join("\n") + "\n");
    return 0;
  }
  const rootAt = argv.indexOf("--root");
  const root = rootAt >= 0 ? resolve(argv[rootAt + 1] ?? ".") : resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const json = argv.includes("--json");
  const files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--root") i++;
    else if (!a.startsWith("--")) files.push(resolve(a));
  }
  const targets = argv.includes("--all") ? [...allFiles(root), ...files] : files;
  if (targets.length === 0) {
    process.stderr.write("No files given. Pass one or more files, or --all.\n");
    return 2;
  }
  let errors = 0;
  const report: unknown[] = [];
  for (const f of targets) {
    const res = validateFile(f, root);
    const shown = relative(process.cwd(), f).startsWith("..") ? f : relative(process.cwd(), f);
    errors += res.errors.length;
    if (json) report.push({ file: shown, errors: res.errors, warnings: res.warnings });
    else {
      for (const e of res.errors) process.stdout.write(`ERROR ${e.code} ${shown}#${e.path}: ${e.message}\n`);
      for (const w of res.warnings) process.stdout.write(`WARN ${w.code} ${shown}#${w.path}: ${w.message}\n`);
    }
  }
  if (json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else if (errors === 0) process.stdout.write(`OK: ${targets.length} file(s) validated\n`);
  return errors > 0 ? 1 : 0;
}

process.exit(main(process.argv.slice(2)));
