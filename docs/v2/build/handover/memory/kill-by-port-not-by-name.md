---
name: kill-by-port-not-by-name
description: Never pkill -f next-server (or any dev server by name) on this machine — other agents' UI checks and other projects run their own; kill the exact PID listening on the port
metadata:
  type: feedback
---

On 2026-09-24 a `pkill -f next-server` meant to restart the presentation web dev server also killed a `next dev` belonging to another agent's `workgraph.ai` ui-check run (worktree agent-a18024d8be71ef074). This machine routinely has several Next servers for different projects at once.

**Why:** process names are shared across projects; only the port identifies whose server it is.

**How to apply:** find the PID with `ss -ltnp | grep :<port>` and kill that PID only. Start the presentation web with `API_PROXY_URL=http://localhost:8010 pnpm exec next dev -p 3000` (the proxy default is :8000, which is taken, see [[nks-ubuntu-port-8000-taken]]). Do not run `next build` in apps/web while its dev server is up; they share `.next` and the dev server wedges.
