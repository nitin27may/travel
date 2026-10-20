---
name: push-after-each-logical-block
description: Nitin wants every committed logical block pushed to the remote branch immediately so he can pull and look on another machine
metadata: 
  node_type: memory
  type: feedback
  originSessionId: df543784-33c8-5ca6-801e-26886b4b17b8
  modified: 2026-09-08T22:11:57.439Z
---

After committing a logical block of work (a verified feature group), push the branch to origin right
away rather than batching pushes or waiting to be asked.

**Why:** Nitin reviews and tests on other machines (MacBook, Windows) and wants to `git pull` the
current state at any time. Stated 2026-09-08 during the WorkGraph Desktop work
([[workgraph-desktop-plan]]), where the branch `feat/desktop-foundation` sat unpushed for twenty-nine
commits before he asked.

**How to apply:** `git push` follows each commit of a coherent, verified group (checks green, smoke
green where applicable). Still never push half-integrated states or work from agents that has not been
verified; the unit is the logical block, not every file save. Commits themselves still happen only for
work the user asked for.
