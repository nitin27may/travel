#!/usr/bin/env bash
# PostToolUse hook: after any Write/Edit/MultiEdit of a research sidecar (research/**/*.json carrying
# "research-sidecar/1"), validate it against the sidecar schema and refresh research/INDEX.json.
# Exit 2 feeds the problem back to Claude; exit 0 is silent. Other JSON under research/ (the inbox, photo
# lists, INDEX.json itself) belongs to other tools and is skipped.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
path="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null)"
case "$path" in
  */research/inbox/* | */research/INDEX.json | */core/test/fixtures/*) exit 0 ;;
  */research/*.json) ;;
  *) exit 0 ;;
esac
[[ -f "$path" ]] || exit 0
grep -q '"research-sidecar/1"' "$path" 2>/dev/null || exit 0
if [[ ! -d "$ROOT/core/node_modules" ]]; then
  echo "core dependencies missing: run pnpm --dir $ROOT install"
  exit 2
fi
out="$(node "$ROOT/core/bin/validate.ts" "$path" --root "$ROOT" 2>&1)"
if [[ $? -ne 0 ]]; then
  echo "research sidecar failed validation:"; echo "$out"
  exit 2
fi
out="$(node "$ROOT/core/bin/catalog.ts" index --root "$ROOT" 2>&1)"
if [[ $? -ne 0 ]]; then
  echo "research index failed:"; echo "$out"
  exit 2
fi
exit 0
