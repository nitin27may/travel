#!/usr/bin/env node
// The ops CLI (plan 5.1, 5.2): run one operation against the files under --root. What skills call.
//   node core/bin/ops.ts trip.update --input change.json
//   echo '{"actor": {...}, ...}' | node core/bin/ops.ts item.add --input - --json
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOGUE } from "../src/ops/catalogue.ts";
import { PythonPlaceBackend } from "../src/ops/placeBackend.ts";
import { runOp } from "../src/ops/run.ts";
import { FileStore } from "../src/store/index.ts";

const USAGE = `Usage: node core/bin/ops.ts <operation> --input <file or -> [--root <dir>] [--json]
       node core/bin/ops.ts --list

Runs one operation (see --list) against data/** under --root (default: the repository that holds this file) and prints the
result. The input is the operation's JSON input; every write needs an "actor". --json prints the result as JSON.
Exit code 1 when the result is not ok.

TRAVEL_NOW and TRAVEL_TODAY pin the clock for reproducible runs.
`;

async function main(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.length === 0) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (argv.includes("--list")) {
    for (const o of CATALOGUE) process.stdout.write(`${o.name.padEnd(26)} ${o.kind.padEnd(5)} phase ${o.phase}  ${o.summary}\n`);
    return 0;
  }
  const flagValue = (name: string): string | undefined => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const rootArg = flagValue("--root");
  const root = rootArg ? resolve(rootArg) : resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const json = argv.includes("--json");
  const inputArg = flagValue("--input");
  const name = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--input" && argv[i - 1] !== "--root");
  if (!name) {
    process.stderr.write("Give an operation name. Run with --list for the names.\n");
    return 2;
  }
  let raw = "{}";
  if (inputArg !== undefined) {
    try {
      raw = readFileSync(inputArg === "-" ? 0 : inputArg, "utf8");
    } catch (e) {
      process.stderr.write(`Cannot read the input ${inputArg}: ${(e as Error).message}\n`);
      return 2;
    }
  }
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`The input is not valid JSON: ${(e as Error).message}\n`);
    return 2;
  }
  const result = await runOp(new FileStore(root), name, input, { backend: new PythonPlaceBackend(root) });
  if (json) process.stdout.write(JSON.stringify(result) + "\n");
  else if (!result.ok) process.stdout.write(`FAILED ${result.code}: ${result.message}\n`);
  else if ("result" in result) process.stdout.write(JSON.stringify(result.result, null, 2) + "\n");
  else {
    process.stdout.write(`OK ${name}: changed ${result.changed.join(", ") || "nothing"}${result.replayed ? " (replayed, nothing written)" : ""}; changelog seq ${result.changelog_seq}\n`);
    for (const w of result.warnings) process.stdout.write(`  WARN ${w.code} ${w.where}: ${w.message}\n`);
  }
  return result.ok ? 0 : 1;
}

process.exit(await main(process.argv.slice(2)));
