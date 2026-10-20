---
name: confirm-every-deletion
description: Nitin's UI rule (2026-09-24) - any action that deletes or drops user data must ask for confirmation first, stating exactly what will be lost; applies to Abandon, Mark done, Discard and every delete in workgraph.ai
metadata:
  type: feedback
---

In workgraph.ai, every action that deletes or drops something the user made asks for confirmation first, and the confirmation says exactly what goes (a count, not a vague "are you sure"). It is inline and non-modal, per [[ui-motion-and-non-modal-overlays]], and the destructive button is not the default focus.

**Why:** Nitin said "for any deletion, if we are going to drop something, we have to ask for confirmation". It came up while designing the BA Buddy session lifecycle (Abandon deletes the whole draft, Mark done deletes the unpublished items), after he had already said Abandon should be easy.

**How to apply:** no exceptions for "easy" deletes: Abandon, Mark done, Discard, removing a node or item, clearing a draft, any bulk removal. Reversible actions with an Undo (mark, move, rename) do not need a dialog. Pair with [[no-default-selection-explicit-choice]]: the tool never creates or destroys anything the user did not explicitly choose. The session model is in `.claude/plans/ba-buddy/wo-33-session-lifecycle-and-partial-publish.md` in workgraph.ai once written.
