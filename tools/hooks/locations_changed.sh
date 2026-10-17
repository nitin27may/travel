#!/usr/bin/env bash
# PostToolUse hook: after any Write/Edit, if the location store or the list-page template changed,
# validate the store and rebuild the generated views (WISHLIST.md, locations/index.html,
# globe/assets/data/places.json). Exit 2 feeds the problem back to Claude; exit 0 is silent.
# The build is deterministic, so a run with nothing to change leaves no diff.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
path="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null)"
case "$path" in
  */locations/locations.json | */locations/[A-Z][A-Z].json | */_system/site/locations.html | */_system/site/site.css) ;;
  *) exit 0 ;;
esac
out="$(python3 "$ROOT/tools/locations.py" validate 2>&1)"
rc=$?
if [[ $rc -ne 0 ]]; then
  echo "location store failed validation:"; echo "$out"
  exit 2
fi
out="$(python3 "$ROOT/tools/locations.py" build 2>&1)"
rc=$?
if [[ $rc -ne 0 ]]; then
  echo "locations.py build failed:"; echo "$out"
  exit 2
fi
exit 0
