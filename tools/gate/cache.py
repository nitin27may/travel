"""Gate cache (docs/v2/build/TEST-STRATEGY.md section 6, task TS-3). Python 3 standard library only.

A suite that passed on byte-identical inputs is not run again. The key is SHA-256 over: the suite id, its command (including a
narrowed file list), the git object id of every file its `inputs` globs match (working tree, so uncommitted and untracked edits
count), the toolchain (node, pnpm, python versions and the pnpm lockfile hash) and the env flags that change a result.
Entries live in `<git-common-dir>/gate-cache/<key>.json`, one folder for every worktree of the clone, never tracked.

Only PASS is stored. An entry older than 7 days is ignored and removed. Suites listed in map.json `uncacheable`, tier 3, the
verifier (--verifier or GATE_VERIFIER=1) and --no-cache never read or write the store. A suite with no `inputs` keys on the
whole tree, which is the safe default.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import time
from pathlib import Path

import gatemap

TTL_SECONDS = 7 * 24 * 3600
ENV_PREFIXES = ("NEXT_PUBLIC_",)
ENV_NAMES = ("SKIP_WEB_BUILD", "TZ")
SECRET_ENV = ("HOME_POINT_LAT", "HOME_POINT_LON")  # the value changes results; only its hash enters the key
KEY_VERSION = "1"


def _git(root: Path, *args: str, stdin: bytes | None = None) -> bytes:
    p = subprocess.run(["git", "-C", str(root), *args], input=stdin, capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(f"git {args[0]} failed: {p.stderr.decode('utf-8', 'replace')[:120]}")
    return p.stdout


def common_dir(root: Path) -> Path:
    return Path(_git(root, "rev-parse", "--path-format=absolute", "--git-common-dir").decode().strip())


def file_ids(root: Path) -> dict[str, str]:
    """path -> git object id of the working-tree content, for tracked files and untracked files that are not ignored."""
    ids: dict[str, str] = {}
    for rec in _git(root, "ls-files", "-z", "--stage").split(b"\0"):
        if rec:
            meta, _, path = rec.partition(b"\t")
            ids[path.decode("utf-8", "surrogateescape")] = meta.split()[1].decode()
    z = lambda *a: [p.decode("utf-8", "surrogateescape") for p in _git(root, "ls-files", "-z", *a).split(b"\0") if p]  # noqa: E731
    for p in z("--deleted"):
        ids.pop(p, None)
    dirty = [p for p in z("--modified") if p in ids] + z("--others", "--exclude-standard")
    plain: list[str] = []
    for p in dict.fromkeys(dirty):
        f = root / p
        if f.is_symlink():
            ids[p] = "link:" + hashlib.sha1(os.readlink(f).encode("utf-8", "surrogateescape")).hexdigest()
        elif f.is_file():
            plain.append(p)
        else:
            ids.pop(p, None)
    if plain:
        out = _git(root, "hash-object", "--stdin-paths", stdin="\n".join(plain).encode("utf-8", "surrogateescape")).decode().split()
        if len(out) == len(plain):
            ids.update(zip(plain, out))
        else:  # a path with a newline in it
            for p in plain:
                ids[p] = _git(root, "hash-object", "--", p).decode().strip()
    return ids


def toolchain(root: Path) -> str:
    def ver(*cmd: str) -> str:
        try:
            return subprocess.run(cmd, capture_output=True, text=True, timeout=20, cwd=root).stdout.strip()
        except (OSError, subprocess.SubprocessError):
            return "missing"
    lock = root / "pnpm-lock.yaml"
    lid = hashlib.sha256(lock.read_bytes()).hexdigest()[:16] if lock.is_file() else "none"
    return "|".join([ver("node", "--version"), ver("pnpm", "--version"), ver("python3", "--version"), lid, os.uname().sysname])


def env_flags(env: dict[str, str] | None = None) -> str:
    env = os.environ if env is None else env
    pairs = [f"{k}={env[k]}" for k in sorted(env) if k.startswith(ENV_PREFIXES) or k in ENV_NAMES]
    for k in SECRET_ENV:
        pairs.append(f"{k}=" + (hashlib.sha256(env[k].encode()).hexdigest()[:12] if env.get(k) else "unset"))
    return "|".join(pairs)


class Cache:
    def __init__(self, root: Path, *, store: Path | None = None, tools: str | None = None, env: str | None = None,
                 now=time.time, enabled: bool = True) -> None:
        self.root, self.enabled, self.now = root, enabled, now
        self.store = store or (common_dir(root) / "gate-cache")
        self._tools, self._env = tools, env
        self._ids: dict[str, str] | None = None
        self.hits = 0

    # ----- key ------------------------------------------------------------------------------------------------------------------
    def tools(self) -> str:
        if self._tools is None:
            self._tools = toolchain(self.root)
        return self._tools

    def env(self) -> str:
        if self._env is None:
            self._env = env_flags()
        return self._env

    def ids(self) -> dict[str, str]:
        if self._ids is None:
            self._ids = file_ids(self.root)
        return self._ids

    def inputs_digest(self, inputs: list[str] | None) -> str:
        globs = inputs or ["**"]  # missing or empty: the whole tree
        h = hashlib.sha256()
        for path, oid in sorted(self.ids().items()):
            if gatemap.match_any(globs, path):
                h.update(f"{path}\0{oid}\n".encode("utf-8", "surrogateescape"))
        return h.hexdigest()

    def key(self, suite: str, command: list[str], inputs: list[str] | None) -> str:
        h = hashlib.sha256()
        for part in (KEY_VERSION, suite, json.dumps(command), self.inputs_digest(inputs), self.tools(), self.env()):
            h.update(part.encode("utf-8", "surrogateescape") + b"\x1f")
        return h.hexdigest()

    # ----- store ----------------------------------------------------------------------------------------------------------------
    def _path(self, key: str) -> Path:
        return self.store / f"{key}.json"

    def lookup(self, key: str) -> dict | None:
        p = self._path(key)
        try:
            e = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None
        if e.get("key") != key or e.get("status") != "PASS":
            return None
        if self.now() - float(e.get("time", 0)) > TTL_SECONDS:
            try:
                p.unlink()
            except OSError:
                pass
            return None
        return e

    def record_hit(self, entry: dict) -> None:
        self.hits += 1
        s = self.store / "stats.json"
        try:
            st = json.loads(s.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            st = {}
        st["hits"] = int(st.get("hits", 0)) + 1
        st["saved_seconds"] = round(float(st.get("saved_seconds", 0)) + float(entry.get("seconds", 0)), 1)
        self._write(s, st)

    def store_pass(self, key: str, suite: str, seconds: float, *, head: str = "", label: str = "") -> None:
        self._write(self._path(key), {"key": key, "suite": suite, "status": "PASS", "seconds": round(seconds, 1), "time": self.now(),
                                      "head": head, "worktree": label})

    def _write(self, path: Path, data: dict) -> None:
        try:
            self.store.mkdir(parents=True, exist_ok=True)
            tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
            tmp.write_text(json.dumps(data), encoding="utf-8")
            os.replace(tmp, path)  # atomic: a second gate never reads half an entry
        except OSError:
            pass  # a cache that cannot write is a cache miss, never a failure

    def prune(self) -> int:
        n = 0
        for p in self.store.glob("*.json") if self.store.is_dir() else []:
            if p.name == "stats.json":
                continue
            try:
                e = json.loads(p.read_text(encoding="utf-8"))
                old = self.now() - float(e.get("time", 0)) > TTL_SECONDS
            except (OSError, ValueError):
                old = True
            if old:
                try:
                    p.unlink()
                    n += 1
                except OSError:
                    pass
        return n

    def stats(self) -> list[str]:
        removed = self.prune()
        entries = []
        for p in self.store.glob("*.json") if self.store.is_dir() else []:
            if p.name != "stats.json":
                try:
                    entries.append(json.loads(p.read_text(encoding="utf-8")))
                except (OSError, ValueError):
                    pass
        try:
            st = json.loads((self.store / "stats.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            st = {}
        by: dict[str, int] = {}
        for e in entries:
            by[e.get("suite", "?")] = by.get(e.get("suite", "?"), 0) + 1
        size = sum(p.stat().st_size for p in self.store.glob("*.json")) if self.store.is_dir() else 0
        out = [f"gate cache: {self.store}", f"entries {len(entries)} ({size // 1024} KiB), expired and removed now {removed}, ttl 7 days",
               f"hits so far {st.get('hits', 0)}, seconds saved {st.get('saved_seconds', 0)}"]
        if entries:
            ages = [self.now() - float(e.get("time", 0)) for e in entries]
            out.append(f"oldest {max(ages) / 3600:.1f} h, newest {min(ages) / 3600:.1f} h")
            out.append("per suite: " + ", ".join(f"{k} {v}" for k, v in sorted(by.items())))
        return out


def bypass_reason(*, no_cache: bool, verifier: bool, tier: int) -> str | None:
    if no_cache:
        return "--no-cache"
    if verifier:
        return "verifier mode (Q256: the verifier's subset is uncached)"
    if tier == 3:
        return "T3 is never served from cache"
    return None


def is_verifier(flag: bool, env: dict[str, str] | None = None) -> bool:
    return flag or bool(re.match(r"^(1|true|yes)$", (os.environ if env is None else env).get("GATE_VERIFIER", ""), re.I))
