"""The gate (docs/v2/build/TEST-STRATEGY.md section 5, task TS-2): select suites from a change set, run them cheapest first, print
at most 40 lines. `tools/gate.sh` is the wrapper; this is the logic. Python 3 standard library only.

    tools/gate.sh --tier 0|1|2|3 [--base main] [--changed PATH...] [--dry-run] [--json] [--only SUITE,...]
                  [--keep-going|--fail-fast] [--full] [--allow-dirty] [--reuse-build] [--visual]

Selection is `gatemap.select()` over `git diff <base>...HEAD`, the working tree and untracked files (or `--changed`). The map
(tools/gate/map.json) is the single source of suites, costs, slots and `run` commands; this file only knows how to execute the
few suites whose `run` entry is prose (build, serve, MCP line, e2e, db, visual).

GATE_RUNNER=ci (WF-2, .github/workflows/check.yml): a hosted runner. No machine slots, no result cache, and a suite the map marks `mac_only` is
MAC_ONLY (neither a pass nor a failure: the summary lists it as pending on the Mac). The map says which: a suite's `mac_only` (a reason),
and a vitest suite's `ci_exclude` ({test file: reason}; web/vitest.config.ts leaves those files out when GATE_RUNNER=ci, and the files are listed as pending on the Mac). `--group G` keeps one group of the map's
suites ("group" per suite: links, core-data, web, db, e2e, visual); `--out FILE` also writes the --json document to FILE. In CI
mode the JSON carries each suite's group and the specs of e2e.mapped (tools/ci/plan_to_outputs.py reads them).

Exit codes: 0 pass; 1 a suite failed (or was skipped because a failure stopped the run); 2 refused, or something was DEFERRED
(a deferred suite is never a pass); 3 the gate itself broke.
Caching (TS-3, tools/gate/cache.py): a suite that passed on identical inputs prints CACHED and is not run again; --no-cache,
--verifier (or GATE_VERIFIER=1), T3 and the map's `uncacheable` suites never use the cache; --cache-stats prints the store.
Not here yet: retries, the flake ledger, quarantine and the full slot rules (TS-4); stacks (TS-7).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cache as gcache  # noqa: E402
import extract  # noqa: E402
import gatemap  # noqa: E402
from locks import Slot, SlotTimeout  # noqa: E402

ROOT = gatemap.ROOT
MAX_LINES = 40
LOAD_LIMIT = 1.5  # 1-minute load average per core above which timing suites are deferred (TEST-STRATEGY 7.1)
COST_RANK = {"s": 0, "m": 1, "l": 2, "xl": 3}
TIMEOUT = {"s": 900, "m": 1800, "l": 2400, "xl": 5400}  # seconds per suite
BUILD_ENV = {"NEXT_PUBLIC_PLACE_MAP_FAMILY": "maplibre", "NEXT_PUBLIC_GOOGLE_MAPS_KEY": "", "NEXT_PUBLIC_GOOGLE_MAP_ID": ""}
CODE_EXT = (".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx")
SMOKE_SPEC = "cross-browser.spec.ts"
# suites the map does not list: T3 runs today's check-all whole, then the rest
PSEUDO = {"check-all": {"cost": "xl", "slot": "build", "run": ["bash tools/check-all.sh"]}}
T3_EXTRA = ["check-all", "e2e.full", "db.local"]


class Refused(Exception):
    pass


def is_ci() -> bool:
    v = os.environ.get("GATE_RUNNER", "")
    if v not in ("", "ci"):
        raise Refused(f"GATE_RUNNER={v} is not known (only 'ci')")
    return v == "ci"


# ----- git -------------------------------------------------------------------------------------------------------------------------------
def git(*args: str, root: Path | None = None, check: bool = True) -> str:
    p = subprocess.run(["git", "-C", str(root or ROOT), *args], capture_output=True, text=True)
    if check and p.returncode != 0:
        raise Refused(f"git {' '.join(args[:3])} failed: {p.stderr.strip()[:120]}")
    return p.stdout


def changed_files(base: str, root: Path | None = None) -> tuple[list[str], int]:
    """(paths, untracked count): committed since the merge base, staged, unstaged and untracked. Renames count as delete + add."""
    if subprocess.run(["git", "-C", str(root or ROOT), "rev-parse", "--verify", "-q", base + "^{commit}"], capture_output=True).returncode:
        raise Refused(f"base {base} is not a commit here")
    committed = git("diff", "--name-only", "--no-renames", "-z", f"{base}...HEAD", root=root).split("\0")
    work = git("diff", "--name-only", "--no-renames", "-z", "HEAD", root=root).split("\0")
    untracked = [f for f in git("ls-files", "-z", "--others", "--exclude-standard", root=root).split("\0") if f]
    return sorted({f for f in committed + work + untracked if f}), len(untracked)


def is_dirty(root: Path | None = None) -> bool:
    return bool(git("status", "--porcelain", "--untracked-files=normal", root=root).strip())


def gate_full_trailer(root: Path | None = None) -> bool:
    rev = "HEAD"
    # CI on a pull request checks out GitHub's merge commit; the author's trailer is on its second parent
    if os.environ.get("GITHUB_EVENT_NAME") == "pull_request" and is_ci() and git("rev-parse", "-q", "--verify", "HEAD^2", root=root, check=False).strip():
        rev = "HEAD^2"
    return re.search(r"^Gate:\s*full\s*$", git("log", "-1", "--format=%B", rev, root=root, check=False), re.M | re.I) is not None


# ----- plan ------------------------------------------------------------------------------------------------------------------------------
@dataclass
class Job:
    suite: str
    why: list[str]
    files: list[str] = field(default_factory=list)  # narrowed run (related files, lint files) or the specs of e2e.mapped
    narrowed: bool = False


@dataclass
class Plan:
    tier: int
    changed: list[str]
    jobs: list[Job] = field(default_factory=list)
    full: bool = False
    full_reasons: list[str] = field(default_factory=list)
    rules: list[str] = field(default_factory=list)
    needs_override: dict[str, list[str]] = field(default_factory=dict)


def meta(m: dict, suite: str) -> dict:
    return PSEUDO.get(suite) or m["suites"][suite]


def is_code(p: str) -> bool:
    return p.endswith(CODE_EXT) and (p.startswith("web/") or p.startswith("core/")) and "/fixtures/" not in p and not p.startswith("web/public/")


def selecting_paths(m: dict, suite: str, changed: list[str]) -> list[str]:
    out = []
    for p in changed:
        if any(suite in r.get("suites", []) and gatemap.match_any(r["paths"], p) for r in m["rules"]):
            out.append(p)
        elif gatemap.is_test_file(m, p) and suite in gatemap.owners(m, p):
            out.append(p)
    return out


def related_files(suite: str, changed: list[str], tests: set[str], root: Path) -> list[str]:
    pkg = "core/" if suite.startswith("core.") else "web/"
    src = [p for p in changed if is_code(p) and (p.startswith(pkg) or (pkg == "web/" and p.startswith("core/src/")))]
    files = sorted({p for p in src + sorted(tests) if p.startswith(pkg) or (pkg == "web/" and p.startswith("core/src/"))})
    return [p for p in files if (root / p).is_file()]


def order(m: dict, names: list[str], deps: dict[str, list[str]]) -> list[str]:
    """Cost class first, then the map order; a dependant never before its dependency."""
    idx = {s: i for i, s in enumerate(list(m["suites"]) + list(PSEUDO))}
    rank: dict[str, int] = {}

    def eff(s: str, seen: tuple = ()) -> int:
        if s not in rank:
            r = COST_RANK[meta(m, s).get("cost", "s")]
            rank[s] = max([r] + [eff(d, seen + (s,)) for d in deps.get(s, []) if d in names and d not in seen])
        return rank[s]

    out: list[str] = []

    def place(s: str, seen: tuple = ()) -> None:
        if s in out or s in seen:
            return
        for d in deps.get(s, []):
            if d in names:
                place(d, seen + (s,))
        out.append(s)

    for s in sorted(names, key=lambda s: (eff(s), idx[s])):
        place(s)
    return out


def make_plan(m: dict, tier: int, changed: list[str], *, specs: list[str] | None = None, old_ca: str | None = None, new_ca: str | None = None,
              force_full: bool = False, only: list[str] | None = None, reuse_build: bool = False, visual: bool = False, root: Path = ROOT) -> Plan:
    plan = Plan(tier=tier, changed=changed)
    sel = gatemap.select(m, changed, check_all_old=old_ca, check_all_new=new_ca, specs=specs, root=root)
    plan.rules = sel.rules
    if force_full and not sel.full:
        sel.full = True
        sel.full_reasons.append("--full or trailer Gate: full")
        for sid in gatemap.full_suites(m):
            sel.add(sid, "full")
    plan.full, plan.full_reasons = sel.full, sel.full_reasons
    why: dict[str, list[str]] = {}
    files: dict[str, list[str]] = {}
    narrowed: set[str] = set()

    if only:
        for sid in only:
            if sid not in m["suites"] and sid not in PSEUDO:
                raise Refused(f"unknown suite {sid} (see tools/gate/map.json)")
            why[sid] = ["--only"]
    elif tier == 0:
        webish = any(p.startswith("web/") or p.startswith("core/src/") for p in changed)
        coreish = any(p.startswith("core/") for p in changed)
        if webish:
            why["web.types"] = ["T0 web or core/src changed"]
        if coreish:
            why["core.types"] = ["T0 core changed"]
        for sid in ("web.unit", "core.unit"):
            f = related_files(sid, changed, sel.tests, root)
            if f:
                why[sid], files[sid] = ["T0 related"], f
                narrowed.add(sid)
        lint = [p for p in changed if p.startswith("web/") and p.endswith(CODE_EXT) and (root / p).is_file()]
        if lint:
            why["web.lint"], files["web.lint"] = ["T0 changed files"], lint
            narrowed.add("web.lint")
    elif tier == 3:
        for sid in T3_EXTRA:
            why[sid] = ["T3"]
        if visual or os.environ.get("GATE_VISUAL_CMD"):
            why["visual"] = ["T3 hook"]
    else:
        names = list(sel.suites) if tier == 1 else sorted({*gatemap.full_suites(m), *sel.suites})
        for sid in names:
            if sid in m["suites"] and m["suites"][sid].get("always_at", 2) == 3 and tier < 3 and sid not in sel.suites:
                continue
            why[sid] = list(sel.suites.get(sid, ["T2"]))
        if tier == 2:
            for sid in why:
                if "T2" not in why[sid] and sid in gatemap.full_suites(m):
                    why[sid].append("T2")
        if tier == 1 and not sel.full:  # narrowing: a code-only change runs `related`, not the suite
            for sid in ("core.unit", "web.unit"):
                if sid in why and m["suites"][sid].get("related"):
                    sp = selecting_paths(m, sid, changed)
                    if sp and all(is_code(p) for p in sp):
                        f = related_files(sid, changed, sel.tests, root)
                        if f:
                            files[sid] = f
                            narrowed.add(sid)
            if "web.lint" in why:
                sp = [p for p in changed if p.startswith("web/") and (root / p).is_file()]
                lint = [p for p in sp if p.endswith(CODE_EXT)]
                if lint and len(lint) == len(sp):
                    files["web.lint"] = lint
                    narrowed.add("web.lint")
    if "e2e.mapped" in why or (only and "e2e.mapped" in only):
        got = sorted(s for s in sel.specs if (root / gatemap.E2E_DIR / s).is_file())
        if tier == 3 or not got:
            files.pop("e2e.mapped", None)
        else:
            files["e2e.mapped"] = got
    if tier == 3:
        plan.needs_override = {"e2e.full": ["check-all"]}
    # needs: pull dependencies in (never at T3, where check-all builds); --reuse-build drops the build
    if tier != 3:
        grew = True
        while grew:
            grew = False
            for sid in list(why):
                for dep in meta(m, sid).get("needs", []):
                    if dep not in why and not (reuse_build and dep == "web.build"):
                        why[dep] = [f"needed by {sid}"]
                        grew = True
    if reuse_build:
        why.pop("web.build", None)
    deps = {s: ([] if tier == 3 else list(meta(m, s).get("needs", []))) for s in why}
    deps.update(plan.needs_override)
    if tier == 3:
        for k in ("e2e.full",):
            deps[k] = ["check-all"]
    for sid in order(m, list(why), deps):
        plan.jobs.append(Job(sid, why[sid], files.get(sid, []), sid in narrowed))
    plan.needs_override = deps
    return plan


# ----- commands --------------------------------------------------------------------------------------------------------------------------
@dataclass
class Action:
    argv: list[str] | None = None
    env: dict[str, str] = field(default_factory=dict)
    fn: Callable[[str], tuple[bool, str]] | None = None  # python check; gets the output so far
    label: str = ""


def parse_cmd(s: str) -> tuple[dict[str, str], list[str]] | None:
    import shlex
    try:
        toks = shlex.split(s)
    except ValueError:
        return None
    env: dict[str, str] = {}
    while toks and re.match(r"^[A-Z_]+=", toks[0]):
        k, v = toks.pop(0).split("=", 1)
        env[k] = v
    if toks and toks[0] in ("python3", "node", "pnpm", "git", "bash") and "(" not in s and "<" not in s:
        return env, toks
    return None


def mcp_check(root: Path) -> Callable[[str], tuple[bool, str]]:
    def run(_out: str) -> tuple[bool, str]:
        init = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"gate","version":"0"}}}\n'
        p = subprocess.run(["node", str(root / "core/bin/mcp.ts"), "--root", str(root)], input=init, capture_output=True, text=True, timeout=30)
        first = p.stdout.splitlines()[0] if p.stdout.splitlines() else ""
        return ('"serverInfo"' in first), "mcp initialize: " + (first[:120] or p.stderr[:200])
    return run


def build_post_check(root: Path) -> Callable[[str], tuple[bool, str]]:
    def run(out: str) -> tuple[bool, str]:
        if re.search(r"^Error:", out, re.M):
            return False, "web build printed an Error: line"
        key = os.environ.get("ORS_API_KEY", "")
        static = root / "web/.next/static"
        if static.is_dir():
            for f in static.rglob("*"):
                if f.is_file() and f.suffix in (".js", ".css", ".html", ".json", ".txt"):
                    t = f.read_text(encoding="utf-8", errors="replace")
                    if "ORS_API_KEY" in t:
                        return False, f"ORS_API_KEY found in client output ({f.name})"
                    if key and key in t:
                        return False, f"ORS key value found in client output ({f.name})"
        return True, "build output clean"
    return run


def serve_check(root: Path) -> Callable[[str], tuple[bool, str]]:
    def run(_out: str) -> tuple[bool, str]:
        import urllib.request
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        nextbin = root / "web/node_modules/next/dist/bin/next"
        proc = subprocess.Popen(["node", str(nextbin), "start", "-p", str(port), "-H", "127.0.0.1"], cwd=root / "web", stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL, start_new_session=True)

        def get(path: str) -> tuple[int, str]:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=5) as r:
                    return r.status, r.read(4096).decode("utf-8", "replace")
            except Exception:
                return 0, ""
        try:
            code = 0
            for _ in range(150):
                code, _b = get("/")
                if code == 200:
                    break
                time.sleep(0.2)
            hcode, body = get("/api/v1/health/")
            ocode, _ = get("/api/v1/openapi.json")
        finally:
            try:
                os.killpg(proc.pid, signal.SIGTERM)  # by PID, never by name
            except OSError:
                pass
            proc.wait(timeout=10)
        if code != 200:
            return False, f"next start did not answer GET / with 200 (got {code})"
        if not re.search(r'"revision":"[0-9a-f]{64}"', body):
            return False, f"GET /api/v1/health did not return a revision: {body[:80]}"
        if ocode != 200:
            return False, f"GET /api/v1/openapi.json did not answer 200 (got {ocode})"
        return True, "next start: / 200, health revision, openapi 200"
    return run


def docker_up() -> bool:
    if not shutil.which("docker"):
        return False
    try:
        return subprocess.run(["docker", "info"], capture_output=True, timeout=8).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def actions_for(m: dict, job: Job, root: Path = ROOT) -> list[Action]:
    """The commands of one job. Raises Refused for a suite that cannot run (the caller marks it deferred)."""
    s, sid = meta(m, job.suite), job.suite
    skip = {"SKIP_WEB_BUILD": "1"}
    abs_ = lambda fs: [str(root / f) for f in fs]  # noqa: E731
    if sid == "check-all":
        return [Action(["bash", str(root / "tools/check-all.sh")], label="check-all")]
    if sid == "web.build":
        return [Action(["pnpm", "--dir", str(root / "web"), "build"], dict(BUILD_ENV)), Action(fn=build_post_check(root), label="build output checks")]
    if sid == "web.serve":
        return [Action(fn=serve_check(root), label="next start smoke")]
    if sid == "e2e.mapped":
        if not job.files:
            return []
        return [Action(["pnpm", "--dir", str(root / "web"), "exec", "playwright", "test", *[gatemap.E2E_DIR[4:] + f for f in job.files], "--project=chromium"], {**skip, **BUILD_ENV})]
    if sid == "e2e.smoke":
        return [Action(["pnpm", "--dir", str(root / "web"), "exec", "playwright", "test", gatemap.E2E_DIR[4:] + SMOKE_SPEC, "--project=chromium"], {**skip, **BUILD_ENV})]
    if sid == "e2e.full":
        return [Action(["pnpm", "--dir", str(root / "web"), "e2e"], {**skip, **BUILD_ENV})]
    if sid == "db.local":
        if not docker_up():
            raise Refused("Docker is not running; db.local waits for T3 with Docker")
        return [Action(["pnpm", "db:test"])]
    if sid == "visual":
        cmd = os.environ.get("GATE_VISUAL_CMD")
        if not cmd:
            raise Refused("no visual-sweep hook (set GATE_VISUAL_CMD); the verifier runs the sweep")
        return [Action(["bash", "-c", cmd])]
    if job.narrowed and sid in ("web.unit", "core.unit"):
        pkg = "web" if sid == "web.unit" else "core"
        extra = ["--project", "unit"] if pkg == "web" else []
        return [Action(["pnpm", "--dir", str(root / pkg), "exec", "vitest", "related", "--run", *extra, *abs_(job.files)])]
    if job.narrowed and sid == "web.lint":
        return [Action(["pnpm", "--dir", str(root / "web"), "exec", "eslint", *abs_(job.files)])]
    if sid == "web.types" and job.why and job.why[0].startswith("T0"):
        info = os.environ.get("GATE_TSBUILDINFO", str(Path(git("rev-parse", "--absolute-git-dir", root=root).strip()) / "gate-tsbuildinfo-web"))
        return [Action(["pnpm", "--dir", str(root / "web"), "exec", "tsc", "--noEmit", "--incremental", "--tsBuildInfoFile", info])]
    out: list[Action] = []
    for r in s.get("run", []):
        if sid == "core.generated" and r.startswith("the MCP"):
            out.append(Action(fn=mcp_check(root), label="mcp initialize"))
            continue
        parsed = parse_cmd(r)
        if not parsed:
            raise Refused(f"gate cannot run {sid}: no command for '{r[:50]}'")
        env, argv = parsed
        if argv[0] == "pnpm" and "--dir" in argv:
            i = argv.index("--dir") + 1
            argv[i] = str(root / argv[i])
        if sid.startswith("web.") and sid not in ("web.build",):
            env = {**skip, **BUILD_ENV, **env}
        out.append(Action(argv, env, label=r[:60]))
    return out


# ----- running ---------------------------------------------------------------------------------------------------------------------------
@dataclass
class Result:
    suite: str
    status: str  # PASS FAIL DEFERRED SKIPPED NONE WOULD
    seconds: float = 0.0
    why: str = ""
    note: str = ""
    cached_key: str = ""
    excerpt: list[str] = field(default_factory=list)


def load_per_core() -> float:
    if os.environ.get("GATE_LOAD_PER_CORE"):
        return float(os.environ["GATE_LOAD_PER_CORE"])
    return os.getloadavg()[0] / (os.cpu_count() or 1)


def run_action(a: Action, out_so_far: str, cwd: Path, timeout: float) -> tuple[bool, str]:
    if a.fn:
        return a.fn(out_so_far)
    env = {**os.environ, "FORCE_COLOR": "0", "NO_COLOR": "1", **a.env}
    p = subprocess.Popen(a.argv, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True, text=True, errors="replace")
    try:
        out, _ = p.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except OSError:
            pass
        out, _ = p.communicate()
        return False, (out or "") + f"\nTIMEOUT after {int(timeout)} s"
    except BaseException:
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except OSError:
            pass
        raise
    return p.returncode == 0, out or ""


def cache_key(m: dict, job: Job, cache: gcache.Cache | None) -> str | None:
    """The cache key of a job, or None when the suite must not touch the cache (uncacheable, a pseudo suite, no cache)."""
    if cache is None or not cache.enabled or job.suite in PSEUDO or job.suite in m.get("uncacheable", []):
        return None
    s = m["suites"][job.suite]
    return cache.key(job.suite, [*s.get("run", []), f"narrowed={job.narrowed}", *job.files], s.get("inputs"))


def run_job(m: dict, job: Job, *, root: Path, lock_root: Path, label: str, log: Callable[[str], None], note: Callable[[str], None],
            cache: gcache.Cache | None = None, head: str = "") -> Result:
    sid, s = job.suite, meta(m, job.suite)
    res = Result(sid, "PASS", why=",".join(job.why))
    ckey = cache_key(m, job, cache)
    if ckey and cache:
        hit = cache.lookup(ckey)
        if hit:
            cache.record_hit(hit)
            res.status, res.seconds, res.note = "CACHED", 0.0, f"was {float(hit.get('seconds', 0)):.1f}s on {hit.get('head', '?')}"
            log(f"CACHED {sid} key {ckey[:12]} {res.note}")
            return res
    if is_ci() and mac_only(s, sid):
        res.status, res.note = "MAC_ONLY", str(s.get("mac_only"))
        return res
    if s.get("slot") == "timing" or sid == "web.timing":
        load = load_per_core()
        if load > float(os.environ.get("GATE_LOAD_LIMIT", LOAD_LIMIT)):
            res.status, res.note = "DEFERRED", f"load {load:.1f} per core (limit {LOAD_LIMIT}); T2 must run it"
            note(f"DEFERRED {sid}: {res.note}")
            return res
    try:
        acts = actions_for(m, job, root)
    except Refused as e:
        res.status, res.note = "DEFERRED", str(e)
        return res
    if not acts:
        res.status, res.note = "NONE", "nothing mapped to run"
        return res
    slot = s.get("slot")
    start = time.monotonic()
    holder: Slot | None = None
    try:
        if slot and not is_ci():  # a hosted runner is one job on one machine: nothing to share
            holder = Slot(lock_root, slot, label, note=note)
            holder.acquire()
        timeout = float(os.environ.get("GATE_SUITE_TIMEOUT", TIMEOUT[s.get("cost", "s")]))
        out = ""
        ok = True
        for a in acts:
            log(f"$ {' '.join(a.argv) if a.argv else a.label}")
            ok, text = run_action(a, out, root, timeout)
            out += text
            log(text)
            if not ok:
                break
        res.status = "PASS" if ok else "FAIL"
        if not ok:
            res.excerpt = extract.excerpt(out)
        elif ckey and cache:
            cache.store_pass(ckey, sid, time.monotonic() - start, head=head, label=label)
    except SlotTimeout as e:
        res.status, res.note = "DEFERRED", f"slot {e.slot} held by {e.holder}; waited {holder.timeout if holder else 0:.0f} s"
    finally:
        if holder:
            holder.release()
        res.seconds = time.monotonic() - start
    return res


def unneeded(m: dict, plan: Plan, cache: gcache.Cache | None) -> set[str]:
    """Suites pulled in only as a dependency (the build) whose every dependant is served from the cache: nothing needs them."""
    if cache is None or not cache.enabled:
        return set()
    hit = {j.suite: bool((k := cache_key(m, j, cache)) and cache.lookup(k)) for j in plan.jobs}
    out = set()
    for j in plan.jobs:
        users = [u.suite for u in plan.jobs if j.suite in plan.needs_override.get(u.suite, [])]
        if users and all(w.startswith("needed by") for w in j.why) and all(hit.get(u) or u in out for u in users) and not hit.get(j.suite):
            out.add(j.suite)
    return out


def run_plan(m: dict, plan: Plan, *, keep_going: bool, root: Path, lock_root: Path, label: str, log: Callable[[str], None],
             note: Callable[[str], None], cache: gcache.Cache | None = None, head: str = "") -> list[Result]:
    results: list[Result] = []
    status: dict[str, str] = {}
    stopped = False
    skip_unneeded = unneeded(m, plan, cache)
    for job in plan.jobs:
        blocked = [d for d in plan.needs_override.get(job.suite, []) if status.get(d) in ("FAIL", "SKIPPED", "DEFERRED")]
        if job.suite in skip_unneeded:
            r = Result(job.suite, "UNNEEDED", why=",".join(job.why), note="every suite that needs it is cached")
        elif blocked:
            r = Result(job.suite, "SKIPPED", why=",".join(job.why), note=f"needs {blocked[0]}")
        elif stopped:
            r = Result(job.suite, "SKIPPED", why=",".join(job.why), note="stopped after a failure")
        else:
            log(f"\n== {job.suite} ({','.join(job.why)})")
            r = run_job(m, job, root=root, lock_root=lock_root, label=label, log=log, note=note, cache=cache, head=head)
            log(f"-> {r.status} {r.seconds:.1f}s {r.note}")
            if r.status == "FAIL" and not keep_going:
                stopped = True
        status[job.suite] = r.status
        results.append(r)
    return results


# ----- output ----------------------------------------------------------------------------------------------------------------------------
def verdict(results: list[Result]) -> tuple[str, int]:
    st = [r.status for r in results]
    if "FAIL" in st or "SKIPPED" in st:
        return "FAIL", 1
    if "DEFERRED" in st:
        return "DEFERRED (not a pass)", 2
    # CACHED and UNNEEDED are passes: a stored pass on identical inputs. MAC_ONLY (CI mode) is neither: the summary lists it as pending
    return "PASS", 0


def render(plan: Plan, results: list[Result], *, base: str, head: str, dry: bool, log_path: str | None, seconds: float, refused: str | None = None,
           limit: int = MAX_LINES) -> list[str]:
    head_lines = [f"gate T{plan.tier} base {base} head {head} changed {len(plan.changed)}" + (f"  FULL: {plan.full_reasons[0][:70]}" if plan.full and not any(j.why == ["--only"] for j in plan.jobs) else "")]
    if "FULL:" in head_lines[0] and len(plan.full_reasons) > 1:
        head_lines[0] += f" (+{len(plan.full_reasons) - 1})"
    if refused:
        return [f"REFUSED: {refused}", head_lines[0]]
    rows = []
    for r in results:
        why = r.note if r.status in ("DEFERRED", "SKIPPED", "CACHED", "UNNEEDED", "MAC_ONLY") else r.why
        if r.status == "DEFERRED":
            why = f"{r.suite}: {why}"
            rows.append(f"DEFERRED {why[:110]}")
            continue
        secs = "" if dry else f"{r.seconds:5.1f}s "
        rows.append(f"{('WOULD' if dry else r.status):<8}{secs} {r.suite:<14} {why[:48]}")
    counts = {k: sum(1 for r in results if r.status == k) for k in ("PASS", "CACHED", "FAIL", "SKIPPED", "DEFERRED", "NONE")}
    if dry:
        total = f"DRY RUN: {len(results)} suite(s) would run; nothing executed"
    else:
        v, _ = verdict(results)
        total = f"{v}: {counts['PASS']} pass, {counts['CACHED']} cached, {counts['FAIL']} fail, {counts['SKIPPED']} skipped, {counts['DEFERRED']} deferred, {seconds:.0f}s"
        mac = sum(1 for r in results if r.status == "MAC_ONLY")
        total += f", {mac} mac-only" if mac else ""
    tail = [total] + ([f"log: {log_path}"] if log_path else [])
    fixed = len(head_lines) + len(rows) + len(tail)
    budget = max(0, limit - fixed)
    exc: list[str] = []
    for r in results:
        if r.status == "FAIL" and r.excerpt and budget > 2:
            take = min(len(r.excerpt), max(2, min(10, budget - 1)))
            block = [f"--- {r.suite}"] + [f"  {ln}" for ln in r.excerpt[:take]]
            block = block[:budget]
            exc += block
            budget -= len(block)
    lines = head_lines + rows + exc + tail
    if len(lines) > limit:  # many suites: keep the totals and the log path
        keep = limit - len(tail) - 1
        lines = lines[:keep] + [f"... {len(lines) - keep - len(tail)} more lines in the log"] + tail
    return lines


def to_json(plan: Plan, results: list[Result], *, base: str, head: str, log_path: str | None, code: int, dry: bool, m: dict | None = None) -> dict:
    doc = {"tier": plan.tier, "base": base, "head": head, "dry_run": dry, "exit": code, "full": plan.full, "full_reasons": plan.full_reasons[:5],
            "changed": len(plan.changed), "rules": plan.rules, "log": log_path,
            "suites": [{"suite": r.suite, "status": "WOULD" if dry else r.status, "seconds": round(r.seconds, 1), "why": r.why.split(","),
                        "note": r.note, "excerpt": r.excerpt[:10]} for r in results]}
    if m is not None and is_ci():  # CI mode only, so the local document stays as it was
        files = {j.suite: j.files for j in plan.jobs}
        for row in doc["suites"]:
            row["group"] = suite_group(m, row["suite"])
            row["mac_only"] = mac_only(meta(m, row["suite"]), row["suite"])
            row["ci_exclude"] = sorted(ci_excluded(meta(m, row["suite"])))
            if row["suite"] == "e2e.mapped":
                row["files"] = files.get("e2e.mapped", [])
    return doc


def mac_only(s: dict, sid: str) -> bool:
    """A suite a hosted runner cannot answer for: the map's `mac_only` (a reason string) on the suite. One source of truth (WF-3)."""
    return bool(s.get("mac_only"))


def ci_excluded(s: dict) -> dict[str, str]:
    """Test files of a vitest suite that CI does not run, with the reason: the map's `ci_exclude` ({repo path: reason}). Empty off CI."""
    return dict(s.get("ci_exclude") or {}) if is_ci() else {}


def suite_group(m: dict, sid: str) -> str:
    return meta(m, sid).get("group", "other")


# ----- main ------------------------------------------------------------------------------------------------------------------------------
def parse_args(argv: list[str]) -> argparse.Namespace:
    ap = argparse.ArgumentParser(prog="tools/gate.sh", description="Run the tests a change needs (TEST-STRATEGY 4 and 5).")
    ap.add_argument("--tier", type=int, choices=[0, 1, 2, 3])
    ap.add_argument("--base", default="main")
    ap.add_argument("--changed", nargs="*", default=None, metavar="PATH", help="use these paths instead of the git diff")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--only", default=None, help="comma list of suite ids, run exactly these (and what they need)")
    ap.add_argument("--keep-going", action="store_true", help="do not stop at the first failure (default at T2 and T3)")
    ap.add_argument("--fail-fast", action="store_true", help="stop at the first failure (default at T0 and T1)")
    ap.add_argument("--full", action="store_true", help="treat the change as a full run (T2 content)")
    ap.add_argument("--allow-dirty", action="store_true", help="T2 and T3 normally refuse an uncommitted tree")
    ap.add_argument("--reuse-build", action="store_true", help="skip web.build and use web/.next as it is")
    ap.add_argument("--no-cache", action="store_true", help="ignore and do not write the result cache")
    ap.add_argument("--verifier", action="store_true", help="the verifier's run: never uses the cache (also GATE_VERIFIER=1)")
    ap.add_argument("--cache-stats", action="store_true", help="print the cache store (entries, age, hits) and exit")
    ap.add_argument("--group", default=None, help="keep only the suites of this group of the map (CI jobs: links, core-data, web, db, e2e, visual)")
    ap.add_argument("--expect", default=None, metavar="SUITES", help="comma list of suite ids this group must select (CI: the plan job's output); a difference, or none selected, is refused")
    ap.add_argument("--out", default=None, metavar="FILE", help="also write the --json document to FILE")
    ap.add_argument("--visual", action="store_true", help="T3: include the visual-sweep hook (GATE_VISUAL_CMD)")
    return ap.parse_args(argv)


def main(argv: list[str] | None = None, root: Path = ROOT) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    if args.cache_stats:
        print("\n".join(gcache.Cache(root).stats()))
        return 0
    if args.tier is None:
        print("REFUSED: --tier is required")
        return 2
    m = gatemap.load_map()
    t0 = time.monotonic()
    base, head, gitdir = args.base, "?", None
    plan = Plan(args.tier, [])
    try:
        is_ci()  # refuses an unknown GATE_RUNNER before anything runs
        head = git("rev-parse", "--short", "HEAD", root=root).strip()
        gitdir = Path(git("rev-parse", "--absolute-git-dir", root=root).strip())
        common = Path(git("rev-parse", "--path-format=absolute", "--git-common-dir", root=root).strip())
        if args.changed is not None:
            changed = sorted(set(args.changed))
        else:
            changed, _u = changed_files(base, root)
        old_ca = new_ca = None
        if "tools/check-all.sh" in changed:
            old_ca = git("show", f"{base}:tools/check-all.sh", root=root, check=False) or None
            new_ca = (root / "tools/check-all.sh").read_text(encoding="utf-8") if (root / "tools/check-all.sh").is_file() else None
        force_full = args.full or (args.changed is None and gate_full_trailer(root))
        only = [s for s in (args.only or "").split(",") if s] or None
        plan = make_plan(m, args.tier, changed, old_ca=old_ca, new_ca=new_ca, force_full=force_full, only=only,
                         reuse_build=args.reuse_build, visual=args.visual, root=root)
        if args.group:
            known = {meta(m, s).get("group", "other") for s in m["suites"]}
            if args.group not in known:
                raise Refused(f"unknown group {args.group} (known: {', '.join(sorted(known))})")
            keep = {j.suite for j in plan.jobs if suite_group(m, j.suite) == args.group}
            todo = list(keep)
            while todo:  # a suite's `needs` stay with it even when they belong to another group (e2e.mapped needs web.build)
                for dep in meta(m, todo.pop()).get("needs", []):
                    if dep not in keep and any(j.suite == dep for j in plan.jobs):
                        keep.add(dep)
                        todo.append(dep)
            plan.jobs = [j for j in plan.jobs if j.suite in keep]
        if args.expect is not None:
            want = sorted(s for s in args.expect.split(",") if s)
            got = sorted(j.suite for j in plan.jobs if suite_group(m, j.suite) == (args.group or suite_group(m, j.suite)))
            if not got:
                raise Refused("this job selected no suites; a planned group must have work")
            if want != got:
                raise Refused(f"this job's plan differs from the plan job's (expected {','.join(want) or 'nothing'}; got {','.join(got) or 'nothing'})")
        refusal = None
        if args.tier >= 2 and args.changed is None and not args.allow_dirty and is_dirty(root):
            refusal = f"T{args.tier} needs a clean tree (results must name a commit); commit, or pass --allow-dirty"
        if args.tier == 3 and not args.dry_run and load_per_core() > float(os.environ.get("GATE_LOAD_LIMIT", LOAD_LIMIT)):
            refusal = f"machine load {load_per_core():.1f} per core is above {LOAD_LIMIT}; T3 needs a quiet machine"
        if args.reuse_build and args.tier != 3 and not args.dry_run and not (root / "web/.next/BUILD_ID").is_file():
            refusal = "--reuse-build but web/.next has no build"
        if refusal:
            out = render(plan, [], base=base, head=head, dry=args.dry_run, log_path=None, seconds=0, refused=refusal)
            print("\n".join(out))
            return 2
    except Refused as e:
        print(f"REFUSED: {e}")
        return 2

    keep = args.keep_going or (args.tier >= 2 and not args.fail_fast)
    if args.dry_run:
        results = [Result(j.suite, "WOULD", why=",".join(j.why) + (f" [{len(j.files)} file(s)]" if j.narrowed else "")) for j in plan.jobs]
        code = 0
        log_path = None
    else:
        log_dir = gitdir / "gate-logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = str(log_dir / f"{time.strftime('%Y%m%d-%H%M%S')}-tier{args.tier}.log")
        fh = open(log_path, "w", encoding="utf-8")

        def log(t: str) -> None:
            fh.write(t if t.endswith("\n") else t + "\n")
            fh.flush()
        log(f"gate tier {args.tier} base {base} head {head} changed {len(plan.changed)}")
        log("changed: " + " ".join(plan.changed[:200]))
        log("full: " + ("; ".join(plan.full_reasons) if plan.full else "no"))
        for j in plan.jobs:
            log(f"select {j.suite}: {','.join(j.why)}" + (f" files={j.files}" if j.files else ""))
        try:
            why_not = gcache.bypass_reason(no_cache=args.no_cache, verifier=gcache.is_verifier(args.verifier), tier=args.tier)
            why_not = why_not or ("CI runner (GATE_RUNNER=ci: a fresh machine every run)" if is_ci() else None)
            log("cache: " + (f"off ({why_not})" if why_not else "on"))
            results = run_plan(m, plan, keep_going=keep, root=root, lock_root=common / "gate-locks", label=f"{root.name} T{args.tier}", log=log,
                               note=lambda msg: log("NOTE " + msg), cache=None if why_not else gcache.Cache(root, store=common / "gate-cache"), head=head)
        finally:
            fh.close()
        _v, code = verdict(results)
        (gitdir / "gate-logs" / "last.json").write_text(json.dumps(to_json(plan, results, base=base, head=head, log_path=log_path, code=code, dry=False)), encoding="utf-8")
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(to_json(plan, results, base=base, head=head, log_path=log_path, code=code, dry=args.dry_run, m=m)), encoding="utf-8")
    if args.json:
        print(json.dumps(to_json(plan, results, base=base, head=head, log_path=log_path, code=code, dry=args.dry_run, m=m)))
    else:
        print("\n".join(render(plan, results, base=base, head=head, dry=args.dry_run, log_path=log_path, seconds=time.monotonic() - t0)))
    return code


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(3)
    except Exception as e:  # the gate itself broke
        print(f"GATE BROKE: {type(e).__name__}: {e}")
        sys.exit(3)
