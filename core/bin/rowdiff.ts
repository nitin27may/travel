#!/usr/bin/env node
// Usage: node core/bin/rowdiff.ts <before.json> <after.json>
// Prints "table:id" for each catalog row that disappeared; exit 1 when there is any, 0 otherwise.
import { readFileSync } from "node:fs";
import { removedRows } from "../src/validate/removed.ts";

const [before, after] = process.argv.slice(2);
if (!before || !after) {
  process.stderr.write("Usage: node core/bin/rowdiff.ts <before.json> <after.json>\n");
  process.exit(2);
}
const read = (p: string): unknown => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};
const gone = removedRows(read(before), read(after));
if (gone.length > 0) {
  process.stdout.write(gone.join("\n") + "\n");
  process.exit(1);
}
