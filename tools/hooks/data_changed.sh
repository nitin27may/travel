#!/usr/bin/env bash
# PostToolUse hook: after any Write/Edit/MultiEdit of a trip, catalog or vocabulary file, run the structural
# validator on it. Exit 2 feeds the problem back to Claude; exit 0 is silent. Location files belong to
# locations_changed.sh. Catalog rows are never deleted by an edit (that is catalog.retire).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
path="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null)"
case "$path" in
  */data/locations/* | */core/test/fixtures/*) exit 0 ;;
  */data/trips/*/trip.json | */data/trips/*/routes/*.json) ;;
  */data/catalog/*/[A-Z][A-Z].json | */data/catalog/legs/geo/*.json | */data/catalog/changes/*.jsonl) ;;
  */data/catalog/policy.json | */data/catalog/backlog.json | */data/vocab/*.json) ;;
  *) exit 0 ;;
esac
[[ -f "$path" ]] || exit 0
if [[ ! -d "$ROOT/core/node_modules" ]]; then
  echo "core dependencies missing: run pnpm --dir $ROOT install"
  exit 2
fi
out="$(node "$ROOT/core/bin/validate.ts" "$path" --root "$ROOT" 2>&1)"
rc=$?
if [[ $rc -ne 0 ]]; then
  echo "data file failed validation:"; echo "$out"
  exit 2
fi
# deleting catalog rows is a separate, confirmed operation
case "$path" in
  "$ROOT"/data/catalog/*/*.json)
    rel="${path#"$ROOT"/}"
    if git -C "$ROOT" ls-files --error-unmatch -- "$rel" >/dev/null 2>&1; then
      old="$(mktemp)"
      if git -C "$ROOT" show "HEAD:$rel" >"$old" 2>/dev/null; then
        gone="$(node "$ROOT/core/bin/rowdiff.ts" "$old" "$path" 2>&1)"
        if [[ $? -ne 0 ]]; then
          rm -f "$old"
          echo "deleting catalog rows is catalog.retire, confirmed by the owner. This write removed:"; echo "$gone"
          exit 2
        fi
      fi
      rm -f "$old"
    fi
    ;;
esac
exit 0
