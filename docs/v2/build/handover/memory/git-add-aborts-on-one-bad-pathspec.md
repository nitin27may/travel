---
name: git-add-aborts-on-one-bad-pathspec
description: "`git add a b c` stages NOTHING if any one path is missing (e.g. already git rm'd), and a following commit still succeeds with whatever was staged before"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b3bcfe36-70cc-5124-b5c4-d603637eeec6
  modified: 2026-09-16T23:06:23.494Z
---

`git add <p1> <p2> ...` is all-or-nothing: one pathspec that matches no file
(`fatal: pathspec '...' did not match any files`) aborts the whole add and stages none of the
others. The usual trigger is listing a file already removed with `git rm` — it is staged as a
deletion, so it no longer exists as a path.

**Why it matters:** the next `git commit` still succeeds, committing only what was staged
earlier. On 2026-09-16 this produced workgraph.ai PR #162 titled "Fix KB Ask returning zero
sources" containing only a 92-line workflow deletion and none of the fix. Checking the commit's
exit code did not catch it; only a merge-time mergeability stop (UNKNOWN) prevented it landing.

**How to apply:**
- Check `git add`'s own exit code (`git add ... || exit 1`), not just the commit's.
- Don't list already-`git rm`'d files in a later `git add`; or use `git add -A -- <dir>`.
- Before pushing, assert the commit's file count:
  `git show --name-only --format= HEAD | grep -c .` against the number you expect, and that
  `git status --short` is empty.
- Before merging, confirm GitHub sees the expected head SHA and file count
  (`gh pr view N --json headRefOid,files`) and pin the merge with `-f sha=`. After an amend +
  force-push, GitHub's PR view can briefly lag and still show the old head.

Related: [[gh-pr-create-no-json-flag]], [[workgraph-suite-baseline-drifts]]
