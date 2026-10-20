---
name: travel-ux-principles
description: "Nitin's UX bar for the travel product (18 Oct 2026): design for 10,000 items, progressive disclosure, a glance then a few clicks, filters with no manual, smooth linked transitions, the right metadata at the right moment"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 714f2667-d381-5eea-95c1-8887ada73bc1
  modified: 2026-10-18T20:19:07.303Z
---

Nitin set the bar for every design and review of the travel product (18 Oct 2026).
- **Scale:** the UI must work with 10,000 places and trips.
- **Progressive disclosure:** show everything, but progressively. The first view answers the main question.
- **Glance, then clicks:** a day or a place is read at a glance, and its deeper detail is a few clicks away ("tick, tick, click, click"). On a trip day that means: should we go, how long, how steep, any booking missed.
- **Search and filters** must be obvious on first use, with no documentation.
- **Motion:** open and close transitions are smooth and keep context.
- **Metadata** is shown where it matters, as chips, not paragraphs.
- **Primary goal:** about 90% of visitors read and copy; about 10% plan.

**Why:** "That's the whole idea of UI UX ... each information is very important and how and when to show it." He wants whoever designs or reviews to "wear that hat".

**How to apply:**
- Read `docs/v2/design/foundation/principles.md` (P1-P7) before designing or reviewing, and cite the principles by number.
- Design reviews (the travel-design-reviewer agent on Opus, never Fable) score every screen against them.
- The verifier sweep includes a first-use walk and a large-data check.

**Also a core principle (18 Oct):** at go-live the UI must not let anyone copy the catalogue in bulk (P8: no whole-catalogue files, light list data, per-item exports, edge bot protection, no hostile anti-copy tricks). The site moves to a server gradually, so everything stays behind one data boundary (P9).

Related: [[travel-v2-ui-review-loop]], [[travel-public-site-first]], [[ui-motion-and-non-modal-overlays]].
