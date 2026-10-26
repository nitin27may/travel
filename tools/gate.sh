#!/usr/bin/env bash
# The gate: select the tests a change needs and run them (docs/v2/build/TEST-STRATEGY.md section 5). Logic: tools/gate/gate.py.
# Pins what must not vary: the venv first on PATH when there is one, the maplibre build env, and never touches web/.env.local.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -d "$ROOT/.venv/bin" ]] && PATH="$ROOT/.venv/bin:$PATH"
export NEXT_PUBLIC_PLACE_MAP_FAMILY=maplibre NEXT_PUBLIC_GOOGLE_MAPS_KEY= NEXT_PUBLIC_GOOGLE_MAP_ID=
# A worktree has no git-ignored .env.local; take the home point from the main checkout's (values never printed).
if [[ -z "${HOME_POINT_LAT:-}" || -z "${HOME_POINT_LON:-}" ]] && [[ ! -f "$ROOT/.env.local" ]]; then
  MAIN="$(cd "$(git -C "$ROOT" rev-parse --git-common-dir)/.." && pwd)"
  if [[ -f "$MAIN/.env.local" ]]; then
    HOME_POINT_LAT="$(sed -n 's/^HOME_POINT_LAT=//p' "$MAIN/.env.local" | head -1 | tr -d "\"' ")"
    HOME_POINT_LON="$(sed -n 's/^HOME_POINT_LON=//p' "$MAIN/.env.local" | head -1 | tr -d "\"' ")"
    export HOME_POINT_LAT HOME_POINT_LON
  fi
fi
exec python3 "$ROOT/tools/gate/gate.py" "$@"
