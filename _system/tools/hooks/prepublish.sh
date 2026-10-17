#!/usr/bin/env bash
# PreToolUse hook on Bash: when the command is about to publish (publish.sh or wrangler pages deploy),
# run the offline test suite first. Exit 2 blocks the command and feeds the failures back to Claude.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cmd="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("command",""))' 2>/dev/null)"
case "$cmd" in
  *publish.sh*|*"wrangler pages deploy"*) ;;
  *) exit 0 ;;
esac
out="$(cd "$ROOT" && python3 -m pytest _system/tests -q 2>&1)"
rc=$?
if [[ $rc -ne 0 ]]; then
  echo "pre-publish gate failed; fix the tests before publishing:"; echo "$out" | tail -25
  exit 2
fi
exit 0
