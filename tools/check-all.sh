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
step "capture contract: generated files match data/vocab/types.json"
node "$ROOT/core/bin/capture.ts" build --check --root "$ROOT"
step "capture gap budget: no placement or tier gap count rose (data/capture/gap-budget.json)"
node "$ROOT/core/bin/capture.ts" gaps --budget --check --root "$ROOT"
step "validate every data file"
node "$ROOT/core/bin/validate.ts" --all --root "$ROOT"
step "search vocabulary: no dead words, no unruled double meaning, vocab.json current"
node "$ROOT/web/scripts/search-vocab.mjs" --check
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
step "prototype snapshot is current (CLN-3: web/data-snapshots and web/redirects.json match data/seed/prototype)"
pnpm --dir "$ROOT/web" snapshot:check
step "no new hard-coded values (CONS-1 ratchet: colours, slugs, hosts, user agents, thresholds, env names)"
python3 "$ROOT/tools/cons/hardcode_scan.py" --check

if [[ -f "$ROOT/web/package.json" ]]; then
  # Server mode (`next build` then `next start`, API-0): the build runs BEFORE the tests, which read its prerendered output through
  # web/tests/helpers/built.ts, so no test can pass against a stale or missing build (backlog 15.1). `pnpm build` is `next build`
  # then the rendition and share-image steps, which write web/public/img and og for `next start`.
  # APPEND POINT (phase B, C1): later lanes add their own `step` lines after the web block, never inside it.
  for script in typecheck lint build test; do
    step "web $script"
    if [[ "$script" == build ]]; then
      # A non-fatal "Error:" line (a CSS resolve failure, say) must not hide behind a green build (backlog 2.32).
      log="$(mktemp)"
      pnpm --dir "$ROOT/web" build 2>&1 | tee "$log"
      if grep -q '^Error:' "$log"; then echo "web build printed an Error: line" >&2; rm -f "$log"; exit 1; fi
      rm -f "$log"
      # The routing key is server-side only: neither its name nor a value from the environment may reach the client chunks.
      if grep -rqF "ORS_API_KEY" "$ROOT/web/.next/static"; then echo "ORS_API_KEY found in client output" >&2; exit 1; fi
      if [[ -n "${ORS_API_KEY:-}" ]] && grep -rqF "$ORS_API_KEY" "$ROOT/web/.next/static"; then echo "ORS key value found in client output" >&2; exit 1; fi
    elif [[ "$script" == test ]]; then
      SKIP_WEB_BUILD=1 pnpm --dir "$ROOT/web" test
    else
      pnpm --dir "$ROOT/web" "$script"
    fi
  done

  step "web server answers (next start on a free port: GET / 200, /api/v1/health 200 with a revision, /api/v1/openapi.json 200; killed by PID)"
  port="$(node -e "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})")"
  # from web/, where the server finds public/ and the repo root (the API store reads data/)
  (cd "$ROOT/web" && exec node "$ROOT/web/node_modules/next/dist/bin/next" start -p "$port" -H 127.0.0.1 >/dev/null 2>&1) &
  server_pid=$!
  code=000
  for _ in $(seq 1 150); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/" || true)"
    [[ "$code" == 200 ]] && break
    sleep 0.2
  done
  health="$(curl -s "http://127.0.0.1:$port/api/v1/health/" || true)"
  openapi="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/api/v1/openapi.json" || true)"
  kill "$server_pid" 2>/dev/null || true   # by PID, never by name
  wait "$server_pid" 2>/dev/null || true
  if [[ "$code" != 200 ]]; then echo "next start did not answer GET / with 200 (got $code)" >&2; exit 1; fi
  if ! printf '%s' "$health" | grep -Eq '"revision":"[0-9a-f]{64}"'; then echo "GET /api/v1/health did not return a revision: $health" >&2; exit 1; fi
  if [[ "$openapi" != 200 ]]; then echo "GET /api/v1/openapi.json did not answer 200 (got $openapi)" >&2; exit 1; fi
fi

step "OpenAPI is current (API-1b: data/schema/generated/openapi.json matches the contract schemas)"
node "$ROOT/core/bin/openapi.ts" --check --root "$ROOT"
step "catalogue slugs are pinned (API-1a, D-B1: data/catalogue/slugs.json matches what the dataset builder assigns)"
node "$ROOT/core/bin/slugs.ts" --check --root "$ROOT"

echo
echo "CHECK-ALL OK"
