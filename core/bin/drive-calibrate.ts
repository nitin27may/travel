#!/usr/bin/env node
// The drive model's calibration (DT-1a; driving-time-model.md 4.5): offline, deterministic. See core/src/drive/cli.ts for the modes.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { driveCalibrateCommand } from "../src/drive/cli.ts";

const argv = process.argv.slice(2);
const at = argv.indexOf("--root");
const root = at >= 0 ? resolve(argv[at + 1] ?? ".") : resolve(fileURLToPath(new URL("../..", import.meta.url)));
const rest = argv.filter((a, i) => a !== "--root" && argv[i - 1] !== "--root");
// exitCode, not process.exit: a --json report piped to another process must be flushed first
process.exitCode = driveCalibrateCommand(rest, root, (s) => void process.stdout.write(`${s}\n`), (s) => void process.stderr.write(`${s}\n`));
