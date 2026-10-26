# Review: NAV-C contracts (copies/1, trip-custom/1, detector keys)

Reviewer: senior code audit, Opus, 26 Oct 2026. Read only; no code changed.
Scope: commit `e51a756c` on `main`: `core/src/schema/copies.ts`, `core/src/schema/trip-custom.ts`, the detector change in
`core/src/privacy/detect.ts`, `core/test/schema/copies.test.ts`, `core/test/schema/trip-custom.test.ts`.
Specs: [navigation-and-mine.md](../../features/navigation-and-mine.md) 3, 4.2, 10 (NAV-C), Q204;
[trip-origin-and-nearest-airport.md](../../features/trip-origin-and-nearest-airport.md) 8.1, 10;
[trip-overview-and-customisation.md](../../features/trip-overview-and-customisation.md) 5.6 and its amendments (CUS-C).

Evidence: the core suites for schema, privacy and normalise pass (13 files, 172 tests). Each finding marked "confirmed" was
reproduced with a scratch script against the merged code (not committed).

## Verdict

**Changes needed before NAV-2 and NAV-3 build on this contract.** Nothing here is live yet (no `web/` caller), so there is
no production incident today, but two of the findings (C1, C2) break guarantees the contract claims, and fixing them after
NAV-2 stores real envelopes costs a version bump. The merge rule itself (idempotency on the copy id, the account winning on
same trip and start, the newest-first cap) is correct and well tested.

Required list (in order):

1. C1: `writeCopies` must refuse to overwrite a newer or changed envelope (compare-and-set).
2. C2: the merge entry points must parse, not trust a TS type; add a boundary test against bare `.parse`/`.safeParse`.
3. M1: compare times as instants, not strings; restrict `copiedAt` to UTC `Z`.
4. M2: `markMerged` takes the ids the server confirmed, not the plan.
5. M6: fix the 64 KB test (it passes for the wrong reason) and the crash property (it does not crash for n > 20).
6. L1: refuse protocol-relative `photo` paths.

M3, M4, M5 and the open questions go to the NAV-2, NAV-3, ORG-C and CUS-C owners as written requests; they need not block.

## Findings, by severity

### High

**C1. `writeCopies` overwrites a newer envelope and any other tab's write.** Confirmed.
`core/src/schema/copies.ts:222-232`. `readCopies` and `moveLegacyCopies` refuse a `copies/2` value, but the write path
does not look at what is stored: it validates the caller's envelope and calls `setItem`. A tab running old code that read
the envelope before a newer tab upgraded it writes `copies/1` over `copies/2` on its next add or remove. The same blind
write loses updates between two open tabs (tab A holds a stale envelope, tab B adds a copy, tab A removes one: B's copy is
gone). Spec 3.1 says "a bad or newer envelope is left untouched"; that holds only on read.
Scratch check: storage holding `{"schema":"copies/2",...}`, `writeCopies(s, emptyCopies())` returns `{ok:true}` and the
`copies/2` value is replaced.
Fix: make it compare-and-set. `writeCopies(storage, env, base: string | null)` where `base` is the raw text the caller
read; re-read `COPIES_KEY` first and return `{ ok: false, reason: "newer" }` when it names `copies/N` with N > 1, and
`{ ok: false, reason: "changed" }` when it differs from `base`. The web layer then re-reads, re-applies the mutation once
and writes again. `moveLegacyCopies` passes `currentRaw`. Add tests for both refusals.

**C2. Validation outside Zod is easy to bypass, and the server-side merge trusts a TS type.**
`copies.ts:446` (`planMerge(copies: readonly CopyItem[], ...)`), `copies.ts:438` (`copyToDraftRow`), and the exported raw
schemas `copyItem`, `copiesEnvelope` (`copies.ts:56`, `79`) and `tripCustom` (`trip-custom.ts:77`).
The rules that Zod cannot hold (4 KB a copy, 60 overrides, unique ids, one copy per trip, unique op ids, 64 KB) live in
`parseCopy`, `parseEnvelope` and `parseTripCustom`. Nothing stops `copiesEnvelope.safeParse(x)` or `tripCustom.parse(x)`
in `web/`, which silently skips them, and no test or lint rule blocks it. Worse, NAV-3's route will receive copies as JSON
from the browser; `planMerge` and `copyToDraftRow` accept anything cast `as CopyItem`. `copyToTripCustom` re-validates the
doc, but `id` (a client-chosen primary key, NAV-D), `title` and `source_trip` reach the row unchecked.
Fix:
- `planMerge(input: unknown, account, cap)` parses with `parseEnvelope` (or each item with `parseCopy`) and returns the
  issues; or a branded `ParsedCopy` type only `parseCopy` can produce.
- A boundary test in `core/test/schema/` that greps `core/src` and `web/` for `copyItem.`, `copiesEnvelope.` and
  `tripCustom.` followed by `parse`/`safeParse` outside these two files and their tests, and fails. The JSON Schema export
  test may keep using the raw objects.
- NAV-3 acceptance (written request): the route checks `source_trip` against the public, listed trips before insert. A
  draft pointing at a private or unlisted slug must be refused, or `/t/<id>/` (CUS-1) becomes a way to load a private
  trip's template by slug.

### Medium

**M1. Time comparisons are string comparisons on a format that allows offsets and any precision.** Confirmed.
`copies.ts:52` accepts `z.iso.datetime({ offset: true })`; `copies.ts:317`, `329` and `452` compare with `localeCompare`
and `>=` on the strings. `"2026-10-20T12:00:00+05:00"` (07:00Z) sorts after `"2026-10-20T08:00:00Z"`, and
`"10:00:00Z"` sorts after `"10:00:00.500Z"` (`Z` > `.`). Scratch check: `planMerge` with cap 1 inserted the older of two
copies. In `moveLegacyCopies` the same error can let an older legacy draft replace a newer re-copy. `localeCompare` is also
locale-dependent for what should be a byte order.
Fix: `copiedAt: z.iso.datetime()` (UTC `Z` only; `addCopy` and the legacy writer already use `toISOString()`), and compare
`Date.parse(a) - Date.parse(b)` in all three places. Add a property case with mixed precision.

**M2. `markMerged` deletes device copies the server may not have inserted.** `copies.ts:479-482`.
It removes every id in `plan.insert`. `insert ... on conflict (id) do nothing` silently skips an id another account
already holds (a device that merged into account A, crashed before `markMerged`, then signs in as B), and the NAV-D cap
trigger (`P0001 drafts_cap`) can refuse rows under a race. In both cases the copy leaves the device and is not in the
account the toast names.
Fix: `markMerged(env, taken: { inserted: string[]; already: string[]; sameTrip: string[] }, ...)` where `inserted` comes
from the route's `returning id`; anything in `plan.insert` not returned stays on the device and is counted. The toast
counts `inserted`, not `plan.insert.length`.

**M3. Legacy drafts that fail the strict schema stay under the old key forever, invisible.** `copies.ts:260-280`, `321-323`.
`fromLegacy` maps a draft through `parseCopy`; one bad override value (the old `CopyDraft.overrides` is
`Record<number, string>`), one `placeSlug` that is not a slug, a missing `savedAt`, or a child's age outside 0 to 17
rejects the whole draft. It is "kept" under `travel:v1:copy-drafts`, which nothing reads after NAV-2. That is the bug NAV
exists to fix (gotcha: "NAV-2 must move them, never drop them").
Also: while anything is kept, the move runs and rewrites the old key on every read, and a kept draft fills any slot the
visitor frees (Remove, then the next read pulls an old draft in, and the toast's Undo then fails on the cap).
Fix (NAV-C or a written request to NAV-2): map legacy drafts leniently (drop invalid overrides and additions, clamp the
party to the schema, `copiedAt` from `savedAt` or the move time); keep only drafts with no valid `slug` or `start`. Do
not auto-fill freed slots: move over-cap drafts only once, and let NAV-2 show "N older copies did not fit" from `kept`.

**M4. Forward compatibility of the strict schemas needs a written rule, and two names will collide.**
- Both objects are strict, so a reader of `/1` treats an unknown key as `invalid`, not `newer`. Widening is safe for old
  stored data (new keys are optional), so CUS-C's planned additions (`window`, `removed`, `maybe`, `title`, `moved`,
  `days`, `notes`, `custom`) are fine **only while no `trip-custom/1` doc is stored**. After the first stored doc, any new
  key must be `trip-custom/2`, or a stale browser tab (or a rolled-back deploy) reports good docs as invalid. Write this
  rule into the header of both files and into CUS-C's brief.
- `days`: the copy's snapshot `days` is a count (`copies.ts:62`); CUS-C's `days` is "add or drop a day". Two meanings
  across the mapping invite a wrong `copyToTripCustom`. Ask CUS-C to name it `dayEdits` (or similar).
- `notes` is a public key in the detector (`detect.ts:46`), and CUS-C's `custom` carries a visitor's point outside the
  home radius, which the detector does not see. CUS-C must add private keys for both (for example `customNotes`,
  `custom`), not reuse `notes`.
- `planner_draft.source_revision` (overview 5.6) has no source in `copies/1`: merged copies arrive with a null revision,
  so the planner cannot tell template drift for them. Reserve an optional `rev` in `copies/1` now, while adding it is
  free.

**M5. Detector: the `from` rule is narrow by design; its gaps and one collision should be pinned.**
`detect.ts:57-58`, `118-122`, `249`.
- What it catches: a prefixed origin reference (`iata:`, `hub:`, `town:`, `gn:`, any case) under a `from` key, as a
  string or inside an object or array there, and the same inside a JSON string body. No public data file has a `from` with
  those prefixes today (checked with `git grep`), so there is no false positive on windows, age bands, legs or `point.from`.
  A global value rule is not an option: `town:` appears as a public `key` in `data/suitability/scope.json`.
- What it misses: the same reference under another key (`start.ref` of `intake-detail/1`, origin spec 10; `origin`,
  `ref`, `fromRef`), the URL form (`bom`, `ottawa`), a resolved label ("Mumbai"), nesting deeper than three levels under
  `from`, and a JSON string under `from`. The copy's party outside `travellers` (`adults`, `children` on a copy item) is
  caught only through its sibling keys `copiedAt` and `added`.
- Collision: ORG's `GET /api/v1/trips/{slug}/getting-there?from=&gw=` goes through `respond()`, which fails closed on any
  hit. If `gettingThere/1` echoes the request under `from` in the prefixed form, or uses a `gw` key, every call returns
  500. ORG-C must design the payload around this (keys `in`, `out`, no echo) or extend the echo lifting.
Fix: add tests that pin the misses as known (so a change is deliberate), and file the ORG-C request. If the owner is open
to it, see the naming question below: a distinct key would let the rule be key-based and fail closed for every form.

**M6. Two tests pass for the wrong reason or do not exercise the case they name.** Confirmed for the first.
- `trip-custom.test.ts:69-74` "refuses a doc over 64 KB": the doubled doc is 21.5 KB; it fails on
  `$.added: Too big: expected array to have <=30 items`. The largest doc the current schema allows is about 11.7 KB, so the
  64 KB rule is unreachable and untested. Assert on the issue text (`at most 65536 bytes`), and until CUS-C adds large
  fields, test `tripCustomRules` directly with a doc built past the cap.
- `copies.test.ts:375-396` crash property: the injected crash is in `removeItem`, but for n > 20 the move ends with
  `setItem(LEGACY_COPIES_KEY, keep)`, so no crash happens for about a fifth of the seeds. Crash on the first legacy-key
  write of either kind.

### Low

**L1. `photo` accepts protocol-relative URLs.** Confirmed. `copies.ts:64`: `^\/[^\s"<>]{1,300}$` accepts
`//evil.example/x.gif` and `/\evil.example/x` (browsers read `\` as `/`). Rendered as an `img src` in a Mine row it loads
from another host. Fix: `^\/(?![\/\\])[^\s"<>\\]{1,299}$` and a test.

**L2. No whole-envelope bound.** `merged` (`copies.ts:87`) gains an entry per account and is never pruned; the "under
80 KB" of spec 3.1 is a consequence of the per-copy rule, not a check. Cap `merged` (for example the 10 most recent) and
add an envelope byte rule. NAV-3's route must cap the request body before `JSON.parse` (20 copies x 4 KB plus slack).

**L3. Crash resurrection.** If the old-key delete fails after a good move, and the visitor then removes the moved copy,
the next read moves the draft back in with a new id. Rare (a throwing `removeItem`); M3's "move once" fix covers it.

**L4. Issues can carry values through paths.** `trip-custom.ts:116`: a path element of a record is its key (`merged`
hashes, override keys) and Zod's strict-object message names unknown keys. The header promises "never a value". Replace
record keys with `[key]` in `issuesOf`, as the detector does for `ORIGIN_REF` keys.

**L5. Small items.**
- `copies.ts:294`, `309`: a throwing `getItem` is reported as `write-failed`; name it `read-failed`.
- `overrides` keys stop at 99 while `days` allows 366; harmless today, note it for long trips.
- `added` op ids `o-1..o-n` from the merge: CUS-C must start its counter after the highest existing op, not at 1.
- Same-trip-and-start copies are dropped from the device with their choices (the account wins, rule 3). As specified;
  the toast should say so.

## Questions for the owner or the spec authors

1. **`from` or a distinct key.** The origin spec chose `from` because `start` is the date. The cost is that the detector
   cannot treat the key as private (windows and legs use `from`), so it relies on the value form. Nothing is stored yet,
   so a rename (`origin` collides with capture `origin`; `fromRef` or `homeRef` does not) is free now and a version bump
   later. Recommendation: rename to `fromRef` in both envelopes and add it to `PRIVATE_KEYS`; keep `from` for the URL key.
2. **Once per device and account (nav 4.2).** `merged[h]` is set even when copies were over the cap, and the flow runs
   only while `merged[h]` is absent, so those copies, and any copy made later on the same device while signed out, never
   merge into that account. Should the merge run whenever local copies exist and the user is signed in, with `merged[h]`
   only suppressing the toast?
3. **Placeholder titles.** Legacy copies carry the title "Trip" until refreshed. Should the merge route set `title` from
   the catalogue by `source_trip` rather than trust the client's title?

## What is good

- The merge rule is pure, shared by route and tests, and its property tests (400 seeds) check the right invariants: every
  copy lands in exactly one bucket, the cap, no repeated trip and start, idempotency, and newest first.
- The legacy move writes, reads back, and only then deletes; a failed write leaves both keys as they were (tested for
  quota, blocked and dropped writes).
- Reads never write; corrupt, newer and invalid are distinct reasons; issues name paths, not party values.
- Cross-field rules stay out of Zod so the schemas still export to JSON Schema, and a test pins that.
- `trip-custom.ts` imports nothing from `privacy/`, keeping the household config out of the Mine bundle.
- The detector change is additive and narrow; no public data file trips the new rules.
