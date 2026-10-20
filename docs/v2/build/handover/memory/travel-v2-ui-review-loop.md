---
name: travel-v2-ui-review-loop
description: "travel v2 prototype UI work ends with a design-reviewer UI/UX review (Opus; never Fable) (colour, intuitiveness, smooth motion) and its fixes; the owner finds it \"very basic\" so far"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 714f2667-d381-5eea-95c1-8887ada73bc1
  modified: 2026-10-18T13:52:57.299Z
---

For the travel v2 prototype (`travel-wt/v2/prototype`, branch `claude/serene-goldberg-wtn3di`), every round of UI work finishes with a review by Fable (Agent model "fable") of the whole UI/UX: colour combination, visual design, intuitiveness, smooth animation. The findings are then implemented and re-verified with Playwright before reporting back.

**Why:** On 2026-10-18 Nitin said the prototype "looks very basic". He asked for a complete UI/UX rethink and then a Fable review "because we need a good UI/UX overall, with good color combination and design... very intuitive, smooth, good animation".

He added that every component must be reviewed properly too, "we are putting the foundation for design". The Fable pass therefore covers:
- the component library one by one, with states and motion: buttons, inputs, selects, chips, cards, tables, sheets, popovers, tabs, the rail and trip header, map pins, the drag handle, toasts, empty states and forms
- tokens, information architecture and accessibility, not only the screens

Its output becomes the written component foundation spec, not just a list of fixes.

**Gate before applying any design (2026-10-18).** Nitin wants the design cross-checked against real trip-planning use before it touches the prototype. That means parallel trips (Patagonia and Dolomites booked in the same weeks, a day trip in between), with data linked to one trip and always knowing which trip you are on. The rules and scenarios S1-S10 are in `docs/v2/design/trip-scope-scenarios.md`.

The order is:
1. The design previews.
2. The design reviewer (Opus) reviews the design system and every component against those rules.
3. A scenario walk is recorded in `docs/v2/design/scenario-check.md`.
4. Only then is the design applied to the prototype.

**How to apply:**
- Design and planning go to Opus. Previews come before implementation (an Opus redesign agent writes to `docs/v2/design/redesign/`).
- Coding goes to Sonnet.
- The design reviewer (Opus) reviews the result, then fixes are made.
- Do not report a UI round as done without the design-review pass.
- Related: [[travel-platform-plan-then-build-next-week]], [[travel-app-feedback-2026-10-18]], [[model-split-research-on-opus]].

**Model rule (Nitin, 18 Oct 2026):** do not use the Fable model for anything. The travel-design-reviewer agent runs on Opus. Its frontmatter in both repos says `model: opus`.
