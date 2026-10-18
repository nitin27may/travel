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
step "mcp server answers initialize"
init='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"check-all","version":"0"}}}'
printf '%s\n' "$init" | timeout 30 node "$ROOT/core/bin/mcp.ts" --root "$ROOT" | head -1 | grep -q '"serverInfo"'
step "ops CLI lists the catalogue"
node "$ROOT/core/bin/ops.ts" --list | grep -q '^trip.create '
step "generated schema is up to date"
node "$ROOT/core/bin/schema.ts" generate --check --root "$ROOT"
step "validate every data file"
node "$ROOT/core/bin/validate.ts" --all --root "$ROOT"
step "suitability scope manifest matches the public adapter"
pnpm --dir "$ROOT/web" exec vitest run -c ../tools/suitability-scope/vitest.config.mts >/dev/null
git -C "$ROOT" diff --exit-code -- data/suitability/scope.json
step "suitability sidecars (suitability/1)"
node "$ROOT/core/bin/suitability.ts" check --root "$ROOT"
step "relevance sidecars (relevance/1; no AllTrails, Google, Tripadvisor or Komoot ratings, counts or ranks)"
node "$ROOT/core/bin/relevance.ts" check --root "$ROOT"
step "relevance derived files are current"
node "$ROOT/core/bin/relevance.ts" derive --check --root "$ROOT"
step "source registry is current and valid (sources/1; derived from the lane files)"
node "$ROOT/core/bin/sources.ts" check --root "$ROOT"

if [[ -f "$ROOT/web/package.json" ]]; then
  for script in typecheck lint test build; do
    step "web $script"
    if [[ "$script" == build ]]; then
      # A non-fatal "Error:" line (a CSS resolve failure, say) must not hide behind a green build (backlog 2.32).
      log="$(mktemp)"
      pnpm --dir "$ROOT/web" build 2>&1 | tee "$log"
      if grep -q '^Error:' "$log"; then echo "web build printed an Error: line" >&2; rm -f "$log"; exit 1; fi
      rm -f "$log"
    else
      pnpm --dir "$ROOT/web" "$script"
    fi
  done
fi

echo
echo "CHECK-ALL OK"
