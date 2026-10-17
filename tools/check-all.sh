#!/usr/bin/env bash
# The local gate (no CI in Phase 1, decision D27): every test suite and check in one command.
# Run it before publishing; tools/hooks/prepublish.sh runs it for you. Stops at the first failure.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

step() { printf '\n== %s\n' "$*"; }

step "python tests"
python3 -m pytest "$ROOT/tools/tests" -q
step "locations validate"
python3 "$ROOT/tools/locations.py" validate
step "locations build --check"
python3 "$ROOT/tools/locations.py" build --check
step "core tests"
pnpm --dir "$ROOT/core" test
step "core typecheck"
pnpm --dir "$ROOT/core" typecheck
step "generated schema is up to date"
node "$ROOT/core/bin/schema.ts" generate --check --root "$ROOT"
step "validate every data file"
node "$ROOT/core/bin/validate.ts" --all --root "$ROOT"

if [[ -f "$ROOT/web/package.json" ]]; then
  for script in typecheck lint test build; do
    step "web $script"
    pnpm --dir "$ROOT/web" "$script"
  done
fi

echo
echo "CHECK-ALL OK"
