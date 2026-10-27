"""Lint the GitHub workflows against the privacy and safety rules of docs/v2/build/WORKFLOW-EFFICIENCY.md 4.5 and 4.6 (task WF-2).

    python3 tools/ci/lint_workflows.py [PATH ...]      # files or folders; default .github/workflows

Exit 0 when clean, 1 with one line per problem (`file:line: rule: message`), 2 when a path is missing.

THIS IS A DRIFT GUARD FOR HONEST AGENTS, NOT A SECURITY BOUNDARY. It reads the YAML as text (no parser exists on a bare runner), so
a determined author can still hide something (anchors, merge keys, a second document, odd layouts). The boundary is the repository
settings (selected actions only, SHA pinning required, read-only default token, fork approval, protected `main`) and the owner
reading every change under `.github/` (D12, R5). A fork pull request runs its own copy of the workflow and can skip this lint.
Where a rule cannot decide, it refuses (an escape in a quoted scalar, a local action) rather than guesses.

Rules
  pin          every `uses:` is a GitHub-authored action (`actions/` or `github/`) pinned to a 40-character commit SHA; no `docker://`;
               no local `./` action or workflow (its own file would not be linted: lint it or add support here first)
  trigger      no `pull_request_target`, `workflow_run` or `issue_comment` (D2)
  secrets      no `secrets` context in any form (`secrets.X`, `secrets['X']`, `toJSON(secrets)`, `secrets: inherit`), even split over lines (D3)
  write        no `write` or `write-all` as a value anywhere (so no permission scope can be missed) (D1)
  permissions  a top-level `permissions:` (D1)
  timeout      every job has `timeout-minutes`
  concurrency  a top-level `concurrency:` whose `cancel-in-progress` is `true` or an expression that reads the `github` context
  checkout     `actions/checkout` sets `persist-credentials: false`
  runner       `runs-on` is one plain `ubuntu-*`, `macos-*` or `windows-*` label: no self-hosted, group, labels or list
  injection    no `${{ }}` in a `run:` or `script:` block except needs.*.outputs, matrix.*, steps.*.outputs, env.* (pass anything else
               through `env:`); this is the script-injection rule (github.head_ref, github.event.*.title ...)
  image        every container image (`image:` of a service, `container:` in both forms, any `*_IMAGE` value, any value that names an image)
               is pinned by `@sha256:<64 hex>`; only a bare `${{ env.X }}` is exempt (X is linted where it is set) (WF-3, WF-3b)
  ports        a service's `ports:` entries are all `127.0.0.1:<host>:<container>` (a short or bare port binds every interface);
               `options:` must not carry -p, -P or --publish (WF-3, WF-3b)
  cache        only `actions/cache/restore` and `actions/cache/save`; a save step's `if:` has the exact comparison
               `github.ref == 'refs/heads/main'` and no `||` or negation; no `cache:` input on setup-node or setup-python, which saves
               in its post step on any branch; every setup-node sets `package-manager-cache: false` (D9, WF-3, WF-3b)
  escape       no backslash escape in a double-quoted scalar (a hex escape inside a key hides a word from every other rule)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SHA_RE = re.compile(r"[\w.-]+/[\w./-]+@[0-9a-f]{40}")
AUTHORS = ("actions/", "github/")
BAD_TRIGGERS = ("pull_request_target", "workflow_run", "issue_comment")
RUNNER_RE = re.compile(r"(?:ubuntu|macos|windows)-[\w.-]+")
SAFE_EXPR = re.compile(r"(?:needs\.[\w-]+\.outputs\.[\w-]+|matrix\.[\w.-]+|steps\.[\w-]+\.outputs\.[\w-]+|env\.\w+)")
DIGEST_RE = re.compile(r"@sha256:[0-9a-f]{64}\s*$")
# a value that names a container image even under an odd key: a registry host path, or one of the common Docker Hub images with a tag
IMAGE_LIKE = re.compile(
    r"(?:(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?/[\w./-]+(?::[\w.-]+)?(?:@sha256:\w+)?"
    r"|(?:library/|postgis/)?(?:postgres|postgis|node|redis|mysql|mariadb|mongo|ubuntu|debian|alpine|python|nginx|memcached|rabbitmq|busybox|golang|ruby|httpd|elasticsearch|minio|mailhog)(?::[\w.-]+)?(?:@sha256:\w+)?)")
BLOCK_RE = re.compile(r":\s*[|>][+-]?\d*\s*$")


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


def prepare(raw: list[str]) -> tuple[list[str], list[str], list[bool]]:
    """(plain, normal, in_block) per line. `plain` has comments stripped outside block scalars; `normal` also has every quote character
    removed outside block scalars, so a quoted key or value is matched like an unquoted one. in_block marks block-scalar content."""
    plain, normal, inblock = [], [], []
    block_base: int | None = None
    for ln in raw:
        if block_base is not None and (not ln.strip() or indent(ln) > block_base):
            plain.append(ln.rstrip())
            normal.append(ln.rstrip())
            inblock.append(True)
            continue
        block_base = None
        s = strip_comment(ln)
        plain.append(s)
        normal.append(s.replace('"', "").replace("'", ""))
        inblock.append(False)
        if BLOCK_RE.search(s):
            block_base = len(ln) - len(ln.lstrip(" -"))  # a `- run: |` item nests under the key, not under the dash
    return plain, normal, inblock


def lint_text(name: str, text: str) -> list[str]:
    raw = text.splitlines()
    plain, lines, inblock = prepare(raw)
    out: list[str] = []

    def bad(i: int, rule: str, msg: str) -> None:
        out.append(f"{name}:{i + 1}: {rule}: {msg}")

    for i, ln in enumerate(lines):
        if not ln.strip():
            continue
        if not inblock[i] and re.search(r'"(?:[^"\\]|\\.)*\\', plain[i]):
            bad(i, "escape", "a backslash escape inside a double-quoted scalar can hide a word from the lint; write it plainly")
        m = re.search(r"(?:^|[\s{,])uses\s*:\s*([^\s,}]+)", ln) if not inblock[i] else None
        if m:
            ref = m.group(1)
            if ref.startswith("./"):
                bad(i, "pin", f"{ref} is a local action or workflow; its file is not linted here")
            elif ref.startswith("docker://"):
                bad(i, "pin", f"{ref} is a container image, not a pinned GitHub-authored action")
            elif not SHA_RE.fullmatch(ref):
                bad(i, "pin", f"{ref} is not pinned to a 40-character commit SHA")
            elif not ref.startswith(AUTHORS):
                bad(i, "pin", f"{ref} is not a GitHub-authored action (actions/ or github/ only, D6)")
        for t in BAD_TRIGGERS:
            if re.search(rf"\b{t}\b", ln):
                bad(i, "trigger", f"{t} is not allowed (D2)")
        if re.search(r"\bsecrets\s*(?:[.\[)\],}]|$)", ln) or re.search(r"(?:^|[\s{,-])secrets\s*:", ln):
            bad(i, "secrets", "a workflow must not use the secrets context (D3); the default token is github.token")
        if re.search(r"(?:^|[\s:,\[{])write(?:-all)?\s*(?:$|[,}\]])", ln) or re.search(r"\bwrite-all\b", ln):
            bad(i, "write", "a write permission is not allowed (D1)")
        if not inblock[i] and re.search(r"\bself-hosted\b", ln):
            bad(i, "runner", "a self-hosted runner label is not allowed")
        m = re.match(r"^\s*(?:- )?runs-on\s*:\s*(.*)$", ln) if not inblock[i] else None
        if m and not RUNNER_RE.fullmatch(m.group(1).strip()):
            bad(i, "runner", "runs-on must be one plain ubuntu-*, macos-* or windows-* label (no group, labels, list or expression)")

    # --- script injection: ${{ }} inside run: / script:
    for i, ln in enumerate(lines):
        m = re.match(r"^(\s*)(?:- )?(run|script)\s*:(.*)$", ln) if not inblock[i] else None
        if not m:
            continue
        key_indent = len(ln) - len(ln.lstrip(" -"))
        end = i + 1
        while end < len(lines) and (not lines[end].strip() or indent(lines[end]) > key_indent):
            end += 1
        region = "\n".join([m.group(3), *lines[i + 1:end]])
        for e in re.finditer(r"\$\{\{(.*?)\}\}", region, re.S):
            if not SAFE_EXPR.fullmatch(e.group(1).strip()):
                bad(i, "injection", f"`${{{{ {e.group(1).strip()[:40]} }}}}` inside {m.group(2)}: pass it through `env:` and use the shell variable")

    # --- checkout
    for i, ln in enumerate(lines):
        if not inblock[i] and re.search(r"\buses\s*:\s*actions/checkout@", ln):
            s, e = step_bounds(lines, i)
            if not any(re.search(r"persist-credentials\s*:\s*false\b", x) for x in lines[s:e]):
                bad(i, "checkout", "actions/checkout needs `persist-credentials: false`")

    # --- images, ports (WF-3, WF-3b)
    for i, ln in enumerate(lines):
        if inblock[i]:
            continue
        m = re.match(r"^\s*(?:- )?([\w-]+)\s*:\s*(.+)$", ln)
        if m and m.group(1) not in ("uses", "run", "script", "if", "name", "with"):
            key, val = m.group(1), m.group(2).strip()
            if re.fullmatch(r"\$\{\{\s*env\.\w+\s*\}\}", val):
                pass  # the variable it names is itself linted where it is set
            elif key == "image" or key.endswith("_IMAGE") or key == "container" or IMAGE_LIKE.fullmatch(val):
                if key == "container" and val.startswith("${{"):
                    bad(i, "image", "`container:` must be a mapping with a digest-pinned image, or a digest-pinned image name")
                elif not DIGEST_RE.search(val):
                    bad(i, "image", "a container image (an `image:`, `container:` or any value that names one) must be pinned by digest (name@sha256:<64 hex>)")
        m = re.match(r"^\s*options\s*:\s*(.*)$", ln)
        if m and re.search(r"(?:^|\s)(?:-p\b|-p\d|-P\b|--publish(?:-all)?\b)", m.group(1)):
            bad(i, "ports", "`options:` must not publish a port (-p, -P, --publish); use `ports:` with 127.0.0.1")
        if re.match(r"^\s*ports\s*:", ln):
            e = block_end(lines, i)
            first = ln.split(":", 1)[1].strip()
            if first.startswith("["):
                entries = [x for x in re.split(r"[,\]\[]", " ".join([first, *lines[i + 1:e]]))]
            else:
                entries = [re.sub(r"^\s*-\s*", "", x) for x in lines[i + 1:e] if re.match(r"^\s*-", x)]
            for port in (x.strip() for x in entries):
                if port and not re.fullmatch(r"127\.0\.0\.1:\d+:\d+(?:/\w+)?", port):
                    bad(i, "ports", f"published port `{port[:30]}` must be 127.0.0.1:<host>:<container> (a bare or short port binds every interface)")

    # --- caches (D9, WF-3)
    for i, ln in enumerate(lines):
        if inblock[i]:
            continue
        m = re.search(r"\buses\s*:\s*actions/cache(/[\w-]+)?@", ln)
        if m:
            s0, e0 = step_bounds(lines, i)
            if m.group(1) is None:
                bad(i, "cache", "use actions/cache/restore and, on main only, actions/cache/save; a plain actions/cache saves from every branch")
            elif m.group(1) == "/save":
                conds = [x for x in lines[s0:e0] if re.match(r"^\s*(?:- )?if\s*:", x)]
                if not conds or not all(re.search(r"\bgithub\.ref\s*==\s*refs/heads/main\b", c) and "||" not in c and not re.search(r"!\s*\(|\bnot\b", c) for c in conds):
                    bad(i, "cache", "an actions/cache/save step must have `if: github.ref == 'refs/heads/main' && ...` (exactly that comparison, no `||`, `!=` or startsWith): caches are saved from main only")
        m = re.search(r"\buses\s*:\s*actions/setup-(node|python)@", ln)
        if m:
            s0, e0 = step_bounds(lines, i)
            if any(re.search(r"(?:^|[\s{,])cache\s*:\s*\S", x) for x in lines[s0 + 1:e0]):
                bad(i, "cache", "setup-node/setup-python `cache:` saves in its post step on every branch; use actions/cache/restore and save")
            if m.group(1) == "node" and not any(re.search(r"package-manager-cache\s*:\s*false\b", x) for x in lines[s0 + 1:e0]):
                bad(i, "cache", "setup-node needs `package-manager-cache: false` (its automatic cache would save from every branch if a release extends it to pnpm)")

    # --- top-level keys
    top = {m.group(1): i for i, ln in enumerate(lines) if (m := re.match(r"^([A-Za-z_-]+)\s*:", ln))}
    if "permissions" not in top:
        bad(0, "permissions", "no top-level `permissions:` (use `permissions: {}` and let each job ask for contents: read)")
    if "concurrency" not in top:
        bad(0, "concurrency", "no top-level `concurrency:` with cancel-in-progress")
    else:
        i = top["concurrency"]
        body = " ".join(x.strip() for x in lines[i:block_end(lines, i)])
        m = re.search(r"cancel-in-progress\s*:\s*(.+?)(?:\s*,\s*\w[\w-]*\s*:|\s+\w[\w-]*\s*:|$)", body)
        val = m.group(1).strip() if m else ""
        if val.count("}") > val.count("{"):  # the closing brace of a flow mapping: `{ group: x, cancel-in-progress: true }`
            val = val[:-1].strip()
        if not m:
            bad(i, "concurrency", "`concurrency` has no `cancel-in-progress`")
        elif val != "true" and not re.fullmatch(r"\$\{\{.*\bgithub\.[\w.]+.*\}\}", val):
            bad(i, "concurrency", "`cancel-in-progress` must be true or an expression of the github context (a constant false never cancels)")

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
