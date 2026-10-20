---
name: travel-public-site-first
description: "travel v2 priority is the no-login read-only public site (search, globe, detail pages); keep and improve what the live site does; no green palette; planner comes second"
metadata:
  node_type: memory
  type: project
  originSessionId: 714f2667-d381-5eea-95c1-8887ada73bc1
  modified: 2026-10-19T17:20:23.045Z
---

On 2026-10-18 Nitin set the order for the travel product.

1. **The public read-only site comes first** and is the key selling point.
   - It works without login. Visitors search trips and places of every kind (trails, hikes, sights, lakes), enter from the globe (pins by continent and country), open full detail pages, and copy or export.
   - The live site (nks-travel.pages.dev: Trips, Places, Globe) already does this well. Improve it, never lose it:
     - a full-screen globe with better animation
     - a trip detail page that is categorised and chronological
2. **Colour:** the existing design system can be revived, but **no green palette**. Use a new palette that works end to end.
3. **Maps:** he likes Google Maps and needs distance and directions. Choose the map stack for look and free-tier cost, Google options included; don't rule Google out on licence alone.
   - Scale: **fewer than 100 users in year one**. Judge maps and services at that size: free tiers that cover it win, Google included. Note only the step to 1,000 users; don't design for 10,000.
   - **Design direction chosen 2026-10-18: C, Trailhead.** It keeps the live site's structure, type and four views, with no green: stone, slate, a navy header and an amber rule. The previews are in `docs/v2/design/redesign/trailhead/`; the Fable foundation spec goes to `docs/v2/design/foundation/`.
   - **Handover, 18 Oct night (before compaction):**
     - STATUS.md lists every merged lane, the running lanes SW-A and SW-B (sweep must-fixes), and stage 3 next (L3c timeline first, S1, L3b, L2b, L4b, capture step 7).
     - Lane reports reach the coordinator after compaction, so merge them per STATUS.
   - **Build state:** the live coordinator handover is `docs/v2/build/public-site/STATUS.md` on branch `claude/serene-goldberg-wtn3di` (worktree `travel-wt/v2`). Read it first after any context reset. It covers lanes, merges, the integration pass, decisions in force and running services. Since 18 Oct (late evening) it also holds the **final plan, stages 1-7**. Nitin asked to work down that list in order and slot new feedback into its stage rather than jumping around. He reviews the whole site once, at stage 6. **Rule (Nitin, 18 Oct):** every finding goes into `docs/v2/build/public-site/BACKLOG.md` first, from him, a verifier, a reviewer or a builder. It gets an ID and a stage, and is marked done with its commit. I am responsible end to end and do gap audits myself. His globe feedback F1-F7 is in `docs/v2/design/globe/owner-feedback-2026-10-18.md`.
   - **19 Oct: nothing is private for now.** Every trip, with its places and trails, is public on the v2 site; old legacy pages get redirects at go-live. Household data stays scrubbed regardless.
   - **19 Oct, late:** stage 3 build lanes merged (timeline, trail tracks, globe, filters, research batches 1-2, Who-it-suits data, smart-search parser). Nitin said "go with all your recommendations": every open Q1-Q41 settled, both mocks approved. Now running D1, S1 Part B, SQ1 part B, orphan-file deletion. Then stage 4 design review. Smart search is parser-first (free), gte-small spike later (Q38); no paid model.
   - **19 Oct, night: Nitin reviews at stage 6 only.** Don't ask him to review before then; finish stage 3 leftovers, stage 4 design review and polish, stage 5 cross-model checks, rebuild the preview (tunnel on port 3440, `/tmp/v2preview`, URL in STATUS.md), run Lighthouse on it, then hand over the link. Stage 7 only with his approval.
4. **Then** the signed-in planner, then the schema and backend. Guest planning (in-memory) is decided at schema time.
5. Order of work: design (wireframes, prototype, end-to-end look) before architecture.

**Why:** "No one worries about what architecture you are using. It's how easy it is to find the solution." Most visitors will never sign in.

**How to apply:**
- Start this round only after the running tasks finish, so agents don't step on each other.
- The spec is `docs/v2/design/product-direction-2026-10-18.md`; the queue is `docs/v2/TODO.md`.
- Related: [[travel-v2-ui-review-loop]], [[travel-app-feedback-2026-10-18]], [[travel-globe-build]].
