#!/usr/bin/env bash
# PostToolUse hook: after any Write/Edit, if the location store changed, validate it and
# regenerate WISHLIST.md. Exit 2 feeds the problem back to Claude; exit 0 is silent.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
path="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null)"
case "$path" in
  */locations/locations.json) ;;
  *) exit 0 ;;
esac
out="$(python3 "$ROOT/_system/tools/locations.py" validate 2>&1)"
rc=$?
if [[ $rc -ne 0 ]]; then
  echo "locations.json failed validation:"; echo "$out"
  exit 2
fi
python3 "$ROOT/_system/tools/locations.py" render >/dev/null 2>&1
exit 0
