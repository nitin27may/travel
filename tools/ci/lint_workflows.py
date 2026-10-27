"""Lint the GitHub workflows against the privacy and safety rules of docs/v2/build/WORKFLOW-EFFICIENCY.md 4.5 and 4.6 (task WF-2).

    python3 tools/ci/lint_workflows.py [PATH ...]      # files or folders; default .github/workflows

Exit 0 when clean, 1 with one line per problem (`file:line: rule: message`). Python 3 standard library only, so it runs before any
install. It reads the YAML as text (no parser is available on a bare runner), which is enough because the rules are about the
presence of a few keys and words; a workflow written in an unusual layout may need the rule widened here, never skipped.

Rules
  pin          every `uses:` is a GitHub-authored action (`actions/` or `github/`) pinned to a 40-character commit SHA; no `docker://`
  trigger      no `pull_request_target`, `workflow_run` or `issue_comment` (D2)
  secrets      no `secrets.` reference and no `secrets: inherit` (D3)
  write        no `write` or `write-all` permission anywhere (D1)
  permissions  a top-level `permissions:` (D1)
  timeout      every job has `timeout-minutes`
  concurrency  a top-level `concurrency:` with `cancel-in-progress` that is not the literal false
  checkout     `actions/checkout` sets `persist-credentials: false`
  runner       no self-hosted runner label
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SHA_RE = re.compile(r"^[\w.-]+/[\w./-]+@[0-9a-f]{40}$")
AUTHORS = ("actions/", "github/")
PERM_WRITE = re.compile(r"\b(?:actions|attestations|checks|contents|deployments|discussions|id-token|issues|models|packages|pages|"
                        r"pull-requests|repository-projects|security-events|statuses)\s*:\s*['\"]?write\b")
BAD_TRIGGERS = ("pull_request_target", "workflow_run", "issue_comment")


def strip_comment(line: str) -> str:
    """Drop a trailing `# comment` (a `#` at the start or after whitespace, outside quotes)."""
    quote = ""
    for i, ch in enumerate(line):
        if quote:
            if ch == quote:
                quote = ""
        elif ch in "\"'":
            quote = ch
        elif ch == "#" and (i == 0 or line[i - 1] in " \t"):
            return line[:i].rstrip()
    return line.rstrip()


def indent(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def block_end(lines: list[str], start: int) -> int:
    """Index after the last line nested under lines[start] (blank lines belong to the block)."""
    base = indent(lines[start])
    i = start + 1
    while i < len(lines) and (not lines[i].strip() or indent(lines[i]) > base):
        i += 1
    return i


def step_bounds(lines: list[str], i: int) -> tuple[int, int]:
    """The `- ` list item that holds line i, as [start, end)."""
    s = i
    while s >= 0 and not (lines[s].lstrip().startswith("- ") and indent(lines[s]) <= indent(lines[i])):
        s -= 1
    s = max(s, 0)
    dash = indent(lines[s])
    e = s + 1
    while e < len(lines) and (not lines[e].strip() or indent(lines[e]) > dash):
        e += 1
    return s, e


def lint_text(name: str, text: str) -> list[str]:
    raw = text.splitlines()
    lines = [strip_comment(ln) for ln in raw]
    out: list[str] = []

    def bad(i: int, rule: str, msg: str) -> None:
        out.append(f"{name}:{i + 1}: {rule}: {msg}")

    # --- line rules
    for i, ln in enumerate(lines):
        if not ln.strip():
            continue
        m = re.search(r"\buses:\s*['\"]?([^\s'\"]+)", ln)
        if m:
            ref = m.group(1)
            if ref.startswith("./"):
                pass
            elif ref.startswith("docker://"):
                bad(i, "pin", f"{ref} is a container image, not a pinned GitHub-authored action")
            elif not SHA_RE.match(ref):
                bad(i, "pin", f"{ref} is not pinned to a 40-character commit SHA")
            elif not ref.startswith(AUTHORS):
                bad(i, "pin", f"{ref} is not a GitHub-authored action (actions/ or github/ only, D6)")
        for t in BAD_TRIGGERS:
            if re.search(rf"\b{t}\b", ln):
                bad(i, "trigger", f"{t} is not allowed (D2)")
        if re.search(r"\$\{\{[^}]*\bsecrets\b", ln) or re.search(r"^\s*secrets:\s*inherit\b", ln) or re.search(r"\bsecrets\.[A-Za-z_]", ln):
            bad(i, "secrets", "a workflow must not read a repository secret (D3); use github.token only through the default env")
        if re.search(PERM_WRITE, ln) or re.search(r"\bpermissions\s*:\s*write-all\b", ln):
            bad(i, "write", "a write permission is not allowed (D1)")
        if re.search(r"\bself-hosted\b", ln):
            bad(i, "runner", "a self-hosted runner label is not allowed")

    # --- checkout
    for i, ln in enumerate(lines):
        if re.search(r"\buses:\s*['\"]?actions/checkout@", ln):
            s, e = step_bounds(lines, i)
            if not any(re.search(r"persist-credentials\s*:\s*['\"]?false\b", x) for x in lines[s:e]):
                bad(i, "checkout", "actions/checkout needs `persist-credentials: false`")

    # --- top-level keys
    top = {m.group(1): i for i, ln in enumerate(lines) if (m := re.match(r"^([A-Za-z_-]+)\s*:", ln))}
    if "permissions" not in top:
        bad(0, "permissions", "no top-level `permissions:` (use `permissions: {}` and let each job ask for contents: read)")
    if "concurrency" not in top:
        bad(0, "concurrency", "no top-level `concurrency:` with cancel-in-progress")
    else:
        i = top["concurrency"]
        body = " ".join(lines[i:block_end(lines, i)])
        m = re.search(r"cancel-in-progress\s*:\s*([^,}\n]+)", body)
        if not m:
            bad(i, "concurrency", "`concurrency` has no `cancel-in-progress`")
        elif m.group(1).strip().strip("'\"").lower() == "false":
            bad(i, "concurrency", "`cancel-in-progress` is false; a superseded run must be cancelled")

    # --- jobs
    if "jobs" not in top:
        bad(0, "timeout", "no `jobs:`")
        return out
    j0 = top["jobs"]
    j1 = block_end(lines, j0)
    child = next((indent(lines[i]) for i in range(j0 + 1, j1) if lines[i].strip()), 2)
    starts = [i for i in range(j0 + 1, j1) if lines[i].strip() and indent(lines[i]) == child and re.match(r"^\s*[\w-]+\s*:", lines[i])]
    for n, s in enumerate(starts):
        e = starts[n + 1] if n + 1 < len(starts) else j1
        job = lines[s].strip().split(":")[0]
        if any(re.match(rf"^\s{{{child + 2}}}uses\s*:", x) for x in lines[s + 1:e]):
            continue  # a reusable-workflow call has no steps to time out here (its own file is linted)
        if not any(re.match(rf"^\s{{{child + 2}}}timeout-minutes\s*:\s*\S", x) for x in lines[s + 1:e]):
            bad(s, "timeout", f"job `{job}` has no `timeout-minutes`")
    return out


def lint_paths(paths: list[Path]) -> tuple[list[str], int]:
    files: list[Path] = []
    for p in paths:
        files += sorted([*p.glob("*.yml"), *p.glob("*.yaml")]) if p.is_dir() else [p]
    problems: list[str] = []
    for f in files:
        problems += lint_text(str(f), f.read_text(encoding="utf-8"))
    return problems, len(files)


def main(argv: list[str]) -> int:
    paths = [Path(a) for a in argv] or [Path(".github/workflows")]
    missing = [p for p in paths if not p.exists()]
    if missing:
        print(f"lint_workflows: not found: {missing[0]}")
        return 2
    problems, n = lint_paths(paths)
    if problems:
        print("\n".join(problems[:40]))
        print(f"lint_workflows: {len(problems)} problem(s) in {n} file(s)")
        return 1
    print(f"lint_workflows OK: {n} workflow file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
