#!/usr/bin/env bash
# Runs the parks prototype specs (data, pages, a11y sweep). Usage:
#   bash docs/v2/prototypes/parks-app/tests/run.sh [playwright args, e.g. -g chips]
# Playwright comes from web/node_modules (no new dependency); starts serve.py on a free port through the shared fixtures.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../../../.." && pwd)"
NM="${PW_NODE_MODULES:-$ROOT/web/node_modules}"
[ -f "$NM/@playwright/test/cli.js" ] || { echo "Playwright not found in $NM (run: cd web && pnpm install)"; exit 2; }
cd "$ROOT"
NODE_PATH="$NM" exec node "$NM/@playwright/test/cli.js" test -c "$HERE/playwright.config.js" "$@"
