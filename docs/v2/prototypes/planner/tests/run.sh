#!/usr/bin/env bash
# Runs the planner prototype's specs (phase 1L). Usage:
#   bash docs/v2/prototypes/planner/tests/run.sh [playwright args, e.g. -g travellers]
# Playwright comes from web/node_modules (no new dependency); browsers from the Playwright cache.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../../../.." && pwd)"
NM="${PW_NODE_MODULES:-$ROOT/web/node_modules}"
[ -f "$NM/@playwright/test/cli.js" ] || { echo "Playwright not found in $NM (run: cd web && pnpm install)"; exit 2; }
cd "$ROOT"
NODE_PATH="$NM" exec node "$NM/@playwright/test/cli.js" test -c "$HERE/playwright.config.js" "$@"
