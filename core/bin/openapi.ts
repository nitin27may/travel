#!/usr/bin/env node
// Writes data/schema/generated/openapi.json (OpenAPI 3.1) from the API contract; `--check` fails when the committed file is stale.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OPENAPI_PATH, openApiText } from "../src/catalogue/openapi.ts";

const args = process.argv.slice(2);
const rootAt = args.indexOf("--root");
const root = rootAt >= 0 ? resolve(args[rootAt + 1]!) : resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const file = join(root, OPENAPI_PATH);
const text = openApiText();

if (args.includes("--check")) {
  if (!existsSync(file) || readFileSync(file, "utf8") !== text) {
    process.stderr.write(`${OPENAPI_PATH} is out of date. Run: node core/bin/openapi.ts\n`);
    process.exit(1);
  }
  process.stdout.write("OK: openapi.json is current\n");
} else {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  process.stdout.write(`wrote ${file}\n`);
}
