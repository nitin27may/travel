#!/usr/bin/env bash
# Runs the prototypes' shared tests (sun, contract, ics, map, engine, page sweep). Usage:
#   bash docs/v2/prototypes/tests/run.sh [playwright args, e.g. -g sun]
#   PROTO_STRICT=1 bash docs/v2/prototypes/tests/run.sh     # make the page sweep fail on contrast, traps, unnamed controls
# Playwright comes from web/node_modules (no new dependency); browsers from the Playwright cache.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../../.." && pwd)"
NM="${PW_NODE_MODULES:-$ROOT/web/node_modules}"
[ -f "$NM/@playwright/test/cli.js" ] || { echo "Playwright not found in $NM (run: cd web && pnpm install)"; exit 2; }
cd "$ROOT"
NODE_PATH="$NM" exec node "$NM/@playwright/test/cli.js" test -c "$HERE/../shared/tests/playwright.config.js" "$@"
