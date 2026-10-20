---
name: no-cap-on-parallel-agents
description: Nitin lifted the two-agent parallel limit; run as many agents as the work needs
metadata:
  node_type: memory
  type: feedback
  originSessionId: b1312c41-91e9-5074-911d-23cff7196302
  modified: 2026-09-29T15:05:29.374Z
---

Run as many parallel agents as the work needs. The earlier "at most two agents in parallel" limit is withdrawn.

**Why:** Nitin said so directly on 2026-09-29 ("you don't have to limit up to two parallel agents, you can run as many as needed"), after I held back a planning agent because two build agents were already running.

**How to apply:**
- Launch independent work (planning docs, research, separate release builds) at once instead of queueing behind a cap.
- Keep the other safety rules: separate worktrees and ports per agent, `df -h /home/nitin27may` before big installs, never two agents on the same files, and no deleting anything without asking ([[confirm-every-deletion]]).
- Model split still applies: Opus plans, Sonnet builds ([[branch-commit-and-model-split]]).
