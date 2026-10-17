#!/usr/bin/env bash
# PostToolUse hook: after any Write/Edit/MultiEdit under core/src/schema/, regenerate
# data/schema/generated/ and check it is byte-stable. Exit 2 feeds the problem back to Claude.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
path="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null)"
case "$path" in
  */core/src/schema/*) ;;
  *) exit 0 ;;
esac
if [[ ! -d "$ROOT/core/node_modules" ]]; then
  echo "core dependencies missing: run pnpm --dir $ROOT install"
  exit 2
fi
out="$(node "$ROOT/core/bin/schema.ts" generate --root "$ROOT" 2>&1)"
rc=$?
if [[ $rc -ne 0 ]]; then
  echo "schema generate failed:"; echo "$out"
  exit 2
fi
out="$(node "$ROOT/core/bin/schema.ts" generate --check --root "$ROOT" 2>&1)"
rc=$?
if [[ $rc -ne 0 ]]; then
  echo "generated schema is not stable after generate:"; echo "$out"
  exit 2
fi
exit 0
