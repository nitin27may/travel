#!/usr/bin/env node
const USAGE = `Usage: node core/bin/schema.ts <command> [options]

Commands:
  generate           write data/schema/generated/schema.json and schema.sql from core/src/schema
  generate --check   regenerate in memory; exit 1 with a diff if the committed files differ

Options:
  --root <dir>       repository root (default: two levels above this file)
  --help             show this text
`;

if (process.argv.includes("--help") || process.argv.length <= 2) {
  process.stdout.write(USAGE);
  process.exit(0);
}
