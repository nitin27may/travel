---
name: parallel-bash-shared-cwd
description: "Parallel Bash calls share one shell cwd — a `cd` in one silently re-roots the others; always use absolute paths in parallel batches"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b3bcfe36-70cc-5124-b5c4-d603637eeec6
  modified: 2026-09-13T22:20:15.770Z
---

When several Bash calls go out in the same batch, they share a single shell working directory. A `cd` inside one call changes where the *others* run, with no error.

**Why:** on 2026-09-13 in workgraph.ai a batch contained `cd backend && uv sync` alongside `cd <repo> && git worktree add .claude/worktrees/chore-mcp-json`. The relative worktree path resolved inside the other call's cwd, creating a worktree nested at `.claude/worktrees/wp-0-1-work-item-schema/backend/.claude/worktrees/chore-mcp-json`. The same round, ruff, tsc and a `.gitignore` read all failed with "No such file or directory" because an earlier call's `cd backend` had moved them — and one grep printed a false "no errors" because its `cd web` failed before the command it guarded.

It happened again the same evening, with worse stakes: a parallel call's `cd /workgraph.ai/backend` re-rooted a sibling `cd <worktree> && git checkout fix/… && git rebase origin/main`, so the checkout and rebase ran in the **main checkout** that the dev services `--reload` from. Caught only because a later `git checkout` in the worktree failed with "already used by worktree at /workgraph.ai". Fixed by `git -C <main> checkout main`.

**How to apply:** in any batch of parallel Bash calls, never rely on `cd`. For git, always `git -C <absolute path>`, never `cd … && git …`. Put the absolute path in a variable at the top of each command (`R=/abs/repo; git -C "$R" …`, `cd "$B" && …` with `B` absolute), and pass `-C`/`--prefix`/`-p` flags instead of changing directory. Treat a "none found"/"clean" result from a command that began with a relative `cd` as unverified. See also [[workgraph-ba-buddy-production-readiness]].

**Recurred 2026-10-16, worse:** a `cd ..` in one parallel Bash call moved the shared cwd between another call's `cd travel &&` and its `git add -A && git commit && git push`, so a travel-repo commit landed in the notes repo and was pushed there (fixed by amend + force-with-lease). Rule now: in any message with more than one Bash call, never rely on cwd; use `git -C <abs path>` and absolute paths for every command, and keep commit/push calls alone in their own message.
