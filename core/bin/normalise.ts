#!/usr/bin/env node
// The normaliser (RIS-N): brings the research JSON into the storage contract. See core/src/normalise/cli.ts for the modes.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normaliseCommand } from "../src/normalise/cli.ts";

const argv = process.argv.slice(2);
const at = argv.indexOf("--root");
const root = at >= 0 ? resolve(argv[at + 1] ?? ".") : resolve(fileURLToPath(new URL("../..", import.meta.url)));
const rest = argv.filter((a, i) => a !== "--root" && argv[i - 1] !== "--root");
// exitCode, not process.exit: a large report piped to another process must be flushed first
process.exitCode = normaliseCommand(rest, root, (s) => void process.stdout.write(`${s}\n`), (s) => void process.stderr.write(`${s}\n`));
