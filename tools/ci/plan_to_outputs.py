"""Turn the gate's plan (`gate.py --json --dry-run`, run with GATE_RUNNER=ci) into GitHub job outputs (task WF-2).

    python3 tools/ci/plan_to_outputs.py plan.json >> "$GITHUB_OUTPUT"

Prints `key=value` lines, one per output, every value a single line of [A-Za-z0-9,._/-] (nothing the plan holds is ever echoed
raw, so a path with odd characters cannot inject another output):

  groups     comma list of the groups that have a suite to run, in the map's order (links, core-data, web, db, e2e, visual)
  specs      comma list of the e2e specs of `e2e.mapped` (file names), empty when none
  mac_only   comma list of suites that CI never runs (they are pending on the Mac), from the plan
  full       true when the plan is a full run
  docs_only  true when the only group is links
  suites     comma list of every suite id in the plan

Python 3 standard library only. Exit 2 on a plan it cannot read.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

GROUPS = ("links", "core-data", "web", "db", "e2e", "visual")
SAFE = re.compile(r"^[A-Za-z0-9._/-]+$")
# suites a hosted runner cannot answer for; WF-3 moves this list into the map as `mac_only`
MAC_ONLY = ("web.timing",)


def safe_list(values: list) -> str:
    return ",".join(v for v in values if isinstance(v, str) and SAFE.match(v))


def outputs(plan: dict) -> dict[str, str]:
    rows = plan.get("suites")
    if not isinstance(rows, list):
        raise ValueError("no `suites` list in the plan")
    groups: set[str] = set()
    specs: list[str] = []
    ids: list[str] = []
    for r in rows:
        sid = r.get("suite", "")
        if not isinstance(sid, str):
            continue
        ids.append(sid)
        g = r.get("group")
        if g not in GROUPS:
            raise ValueError(f"suite {sid} has group {g!r}: run the gate with GATE_RUNNER=ci so the plan carries groups")
        if sid not in MAC_ONLY:
            groups.add(g)
        if sid == "e2e.mapped":
            specs = [Path(f).name for f in r.get("files", [])]
    ordered = [g for g in GROUPS if g in groups]
    return {
        "groups": safe_list(ordered),
        "specs": safe_list(specs),
        "mac_only": safe_list([i for i in ids if i in MAC_ONLY]),
        "full": "true" if plan.get("full") else "false",
        "docs_only": "true" if ordered and set(ordered) <= {"links"} else "false",
        "suites": safe_list(ids),
    }


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("usage: plan_to_outputs.py plan.json", file=sys.stderr)
        return 2
    try:
        plan = json.loads(Path(argv[0]).read_text(encoding="utf-8"))
        out = outputs(plan)
    except (OSError, ValueError) as e:
        print(f"plan_to_outputs: {e}", file=sys.stderr)
        return 2
    for k, v in out.items():
        print(f"{k}={v}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
