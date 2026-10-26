"""Machine slots for the gate (TEST-STRATEGY 7.3), the minimal form TS-2 needs; TS-4 extends it.

A slot is a lock directory made with mkdir (atomic; flock is not installed on the Mac) under
`$(git rev-parse --git-common-dir)/gate-locks/<slot>/`, so every worktree of one clone shares it. The directory holds an `owner`
file (pid, worktree, label, start time). A lock whose pid is gone is reclaimed. `Slot` is a context manager: it waits up to
`timeout` seconds, printing nothing itself (the caller gets a `note` callback), and always releases, interrupt included.

Slots today hold one gate each (TS-4 lets `build` hold two). Python 3 standard library only.
"""
from __future__ import annotations

import json
import os
import shutil
import time
from pathlib import Path
from typing import Callable

DEFAULT_TIMEOUT = 1200.0  # seconds; GATE_LOCK_TIMEOUT overrides
DEFAULT_POLL = 0.5  # seconds; GATE_LOCK_POLL overrides
NO_OWNER_GRACE = 10.0  # a fresh lock dir may not have its owner file yet


class SlotTimeout(Exception):
    def __init__(self, slot: str, holder: str):
        super().__init__(f"slot {slot} still held by {holder}")
        self.slot, self.holder = slot, holder


def pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def read_owner(d: Path) -> dict | None:
    try:
        return json.loads((d / "owner").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def describe(d: Path) -> str:
    o = read_owner(d)
    return f"{o.get('label', '?')} (pid {o.get('pid', '?')})" if o else "an unknown holder"


def is_stale(d: Path) -> bool:
    o = read_owner(d)
    if o is None:
        try:
            return time.time() - d.stat().st_mtime > NO_OWNER_GRACE
        except OSError:
            return False
    return not pid_alive(int(o.get("pid", 0)))


class Slot:
    def __init__(self, root: Path, name: str, label: str, *, timeout: float | None = None, poll: float | None = None,
                 note: Callable[[str], None] | None = None):
        self.dir = Path(root) / name
        self.name, self.label = name, label
        self.timeout = float(os.environ.get("GATE_LOCK_TIMEOUT", DEFAULT_TIMEOUT)) if timeout is None else timeout
        self.poll = float(os.environ.get("GATE_LOCK_POLL", DEFAULT_POLL)) if poll is None else poll
        self.note = note or (lambda _m: None)
        self.held = False
        self.waited = 0.0

    def try_acquire(self) -> bool:
        self.dir.parent.mkdir(parents=True, exist_ok=True)
        try:
            self.dir.mkdir()
        except FileExistsError:
            if is_stale(self.dir):
                # rename first: two gates reclaiming the same dead lock cannot both win
                grave = self.dir.with_name(f"{self.name}.dead-{os.getpid()}-{time.time_ns()}")
                try:
                    self.dir.rename(grave)
                except OSError:
                    return False
                shutil.rmtree(grave, ignore_errors=True)
                return self.try_acquire()
            return False
        (self.dir / "owner").write_text(json.dumps({"pid": os.getpid(), "label": self.label, "worktree": os.getcwd(),
                                                    "since": time.time()}), encoding="utf-8")
        self.held = True
        return True

    def acquire(self) -> None:
        start = time.monotonic()
        told = False
        while not self.try_acquire():
            if not told:
                self.note(f"waiting for slot {self.name}, held by {describe(self.dir)}")
                told = True
            if time.monotonic() - start >= self.timeout:
                raise SlotTimeout(self.name, describe(self.dir))
            time.sleep(self.poll)
        self.waited = time.monotonic() - start

    def release(self) -> None:
        if self.held:
            o = read_owner(self.dir)
            if o is None or o.get("pid") == os.getpid():
                shutil.rmtree(self.dir, ignore_errors=True)
            self.held = False

    def __enter__(self) -> "Slot":
        self.acquire()
        return self

    def __exit__(self, *_exc) -> None:
        self.release()
