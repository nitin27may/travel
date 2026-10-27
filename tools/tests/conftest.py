"""Shared fixtures for tools/tests. CI sets runner variables that change what the gate does (GATE_RUNNER=ci: no cache, no slots,
timing suites MAC_ONLY). A test of local behaviour must not inherit them, so every test starts without them; a test of CI mode
sets GATE_RUNNER itself."""
from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _no_ci_runner_env(monkeypatch):
    for name in ("GATE_RUNNER", "GITHUB_EVENT_NAME", "GATE_VERIFIER"):
        monkeypatch.delenv(name, raising=False)
