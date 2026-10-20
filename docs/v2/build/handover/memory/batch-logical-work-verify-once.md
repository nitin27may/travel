---
name: batch-logical-work-verify-once
description: Nitin's working-style rule (2026-09-24) - combine logically related changes into one larger PR and verify the feature once, carefully, instead of many small slow verification rounds
metadata:
  type: feedback
---

For workgraph.ai UI work, group related pieces into one change per feature and verify that feature once and carefully (full Vitest, tsc, build, all shot files one at a time, read the screenshots, then my own independent rerun), rather than a separate small PR and a full verification round for each piece.

**Why:** each verification round on the serial stub harness (one run at a time on ports 3301/8799) costs 60-110 minutes for the agent plus 15 minutes for the reviewer, so many small PRs multiply the wait. Nitin said "combine logical things into one and then verify that feature, so it is an optimized verification". He declined making the harness ports configurable (2026-09-24): keep running a single harness instance.

**How to apply:** plan batches by feature area (for example trail outcomes 32c+32d together; session lifecycle, resume rows and History 33c+33d+33e together; polish and small wizard changes together), one agent per batch, one harness user at a time. Keep batches from growing so large that one agent runs out of room: split a batch at a natural seam if it passes about 15 hours of estimated work. Never skip the independent rerun before merging.
