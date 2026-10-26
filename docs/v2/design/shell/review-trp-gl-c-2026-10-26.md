# Review: TRP-GL-C, booking windows in the trip export contract (26 Oct 2026)

Reviewer: independent code audit (Opus), read-only. Scope: commit `ef3b89dc` as merged in `0a56479b`, against brief 7.3 of
[briefs-bundle-A.md](../../build/briefs-bundle-A.md) and MUST-6 of
[review-trp2b-2026-10-23.md](../trip-page/review-trp2b-2026-10-23.md). Files read in full: `core/src/export/bookings.ts`,
`core/src/export/csv.ts`, `core/src/export/types.ts` (diff), `core/src/schema/api/export.ts` (diff),
`core/src/catalogue/stub/index.ts` (diff), `web/lib/export/{plan,build.server,client}.ts` (diff),
`web/lib/server/exports.ts`, `web/lib/server/respond.ts` (respond), `core/test/export/bookings.test.ts`,
`core/test/catalogue/contract/exportFormats.cases.ts` (K30), `web/tests/export/{formats,trip-routes}.test.ts` (diff). Context read:
`web/lib/public/trips.ts` (category rows), `web/components/trips/model.ts` (`bookRuleLabel`),
`web/components/actions/TripPrintView.tsx` (`printTime`), `core/src/privacy/dateless.ts`, the Rockies and Dolomites source
rows. Ran only `core/test/export/bookings.test.ts` (11 passed). No builds.

## Verdict

**Keep the merge; changes needed before v0.4 go-live.** No code blocker: the contract shape is sound, nothing dated or
guessed reaches an output, and the parity with the page is pinned from real data. But MUST-6 is closed in the contract
only. For the Rockies the "Book ahead" column holds 11 research notes and no window, the one window that matters most
(the Moraine Lake and Lake Louise shuttle) is dropped because its note is dated, and one note states the household's
make-up. Three code defects in the CSV/`forPage` path and one deferral that points at the wrong row also need fixing.

Changes needed, in order:

1. Rockies booking content (F1): data and scrub fix, owner call on the household sentence.
2. CSV order follows the timeline, not the clock text, after `forPage` (F2).
3. `forPage` matches stops to timeline entries one to one, so a place visited twice in a day keeps two rows (F3).
4. Open a real row for the API's time source and repeated rows. SHOULD-9 covers routed lines only (F4).
5. The API `print` format prints the bookings, and K30 checks it (F5).
6. The stub fixture gets booking rows, and the stub applies `withStopBookings` (F6).
7. TRP-GL: the page imports core `bookRuleText`, `bookRuleLabel` goes, the third wording in `trips.ts:283` goes, and
   `printTime` moves out of `components/` (F7, F8).
8. Rename `ExportStop.bookRule` to `bookAhead` while nothing fills it (F9).

## Findings, by severity

### High

**F1. Rockies "Book ahead" is research notes, not windows; the key window is lost; one note names the household.**
`web/lib/public/trips.ts:355-363` builds the Rockies rows from `legacy/canadian-rockies-sept-2029/data/bookings.json`
`deadline_note` through `undatedSentences`. Recomputed from the source, the 11 exported Rockies bookings all have
`rule: null`. Their notes:

- start with the research marker "INFERENCE 2029:", or carry "GAP";
- several say there is nothing to book: "no booking expected" (johnston-canyon), "no advance booking needed" (jasper-skytram),
  "check bulletins ...; carry bear spray" (wildlife-orders), "buy online on the day" (kananaskis-pass). The CSV still
  writes each one as Kind "booking", and the toast counts it as "to book ahead" (`web/lib/export/client.ts:47`);
- `shuttle-moraine-lakelouise`, the costliest miss on the trip (seats released "about mid-April", then 08:00 two days
  before), has every sentence dated. The scrub drops it whole, so the export has no row for it;
- larch-valley-group ships a note that states the party size and the child's age against the group-of-four rule.
  That is household composition. `HOUSEHOLD_TEXT` (`core/src/privacy/dateless.ts:46`) does not
  catch it.

The page's "By category" view already shows the same text, so this is not a new leak. But the export copies it into a
machine-readable CSV and into the API body.

Fix:
- give the Rockies booking rows a dateless `bookRule`. For the shuttle, for example, "Opens 2 days before Day 8 at 08:00 local" for
  the rolling 60 %, plus a note for the spring release. This is a research task;
- strip the `INFERENCE \d{4}:` prefix and a bare "GAP" in the public scrub;
- leave out rows whose note says there is nothing to book, or give them their own kind (e.g. "check"), not "booking";
- owner decision: are party-size and child-age phrases public? If not, add them to `HOUSEHOLD_TEXT`.

Acceptance in the brief ("Rockies CSV shows at least one Book ahead value") is met by the letter only.

**F2. The CSV sorts by the clock inside the time text, and undoes the order `forPage` set.**
`core/src/export/csv.ts:24,29`: `clockOf` pulls `HH:MM` out of "~08:45", "about 19:30" or "07:30 PT" and sorts on that
string. A part of the day ("Morning") sorts as `99:99`, so it goes after every timed row. Two zone-line times on one day
("07:30 PT", "08:15 MT") sort by local clock, not by sequence. `forPage` (`web/lib/export/plan.ts:52`) has already put the
rows in the timeline's order and renumbered `order`, and the header comment promises "in the timeline's order". The web
test says "in the page's order within a day" (`web/tests/export/trip-routes.test.ts:357-360`) but checks only membership
(`toContain`), not order.

Fix: sort by `day, order` when the model comes from `forPage`. A flag on the model, or always `order` for stops with a
non-`HH:MM` time, would do. Keep the clock sort for the API's authored `HH:MM`. Assert the CSV row order against the
timeline entry order in the test.

### Medium

**F3. `forPage` collapses a place visited twice in a day.**
`entryOf` (`web/lib/export/plan.ts:30`) always returns the first entry with the stop's `placeSlug`. The dedupe key is
`${day}:${rank}` (line 57). Two stops for the same place on one day (out and back, morning and sunset) get the first
entry's index, so the second is dropped and the first takes the morning time. `TripPrintView.rowsOf` prints every entry,
so print and CSV would differ. The uniqueness test (`trip-routes.test.ts:368`) asserts `day:placeSlug` is unique, which
the dedupe guarantees by construction. It would pass with this bug present.

Fix: assign entries to stops one to one (consume a matched entry, then the next stop with the same slug takes the next
entry) and key the dedupe by entry id. Replace the uniqueness assertion with "CSV stop rows per day = printed rows per
day" from `rowsOf`'s own entry filter.

**F4. Two time sources, and the deferral names a row that does not own the work.**
The browser CSV now writes the profile's printed times, one row per timeline row. The API (`web/lib/server/exports.ts`)
still builds from `buildTripExport` with no session. Its `csv`, `json` and `print` write the authored `HH:MM`, which shows a
suggested time as fixed (T3), and they repeat Rockies stops once per track (Bow Lake three times). The `csv.ts` header
says this lasts "until SHOULD-9". SHOULD-9 (`review-trp2b-2026-10-23.md:223`) covers routed lines in API KML and GPX only.

Fix: open a row today (or widen SHOULD-9 in its source table) for "the API export schedules the default profile and
stamps times and rows as `forPage` does". The clean form moves `forPage`'s time stamping into `core/src/export` with a
core `printTime`, so both paths call one function (P9). It must land before the server switch, with SHOULD-9.

**F5. The API `print` format carries no bookings.**
`core/src/catalogue/printText.ts` has no booking text. `exportFileOf` serves `print` through it (`exports.ts:59`). The
browser print is TRP-GL's, but the API's print is core's, and brief step 5 asks for the rule "in JSON, CSV and the print
model". K30 checks json and csv only.

Fix: a "Book ahead" block after the meta line in `printText` (MUST-6 wording), plus one K30 assertion on the `print`
body.

**F6. On the stub, K30 tests the empty case only; the stub differs from the web store.**
`core/src/catalogue/stub/fixture.ts:224` gives every category row `bookRule: null, bookNote: null`. So K30 on the stub
compares `[]` with `[]`, and its CSV loop never runs. Only the web targets exercise the non-empty path. The stub also
fills `bookings` but does not run `withStopBookings` (`stub/index.ts:539`), so a stop's `bookRule` would differ by store.

Fix: plant two booking rows in the stub fixture, one rule with `placeSlug` on a stop's day and one note-only, and apply
`withStopBookings` in `StubStore.exportModel`.

**F7. Three wordings of one rule, not one.**
`bookRuleText` (core) and `bookRuleLabel` (`web/components/trips/model.ts:111`) are copies; the parity test pins them on
four rules and on the real Dolomites row, which is adequate for a copy. A third wording also exists:
`web/lib/public/trips.ts:283` sets `detail` to "Opens N days before Day M", with no time or zone. `CategoryView.tsx:11`
renders it beside the chip, so the Tre Cime row says the rule twice in two forms. With `dayN: null` it says "Day null".

Fix (TRP-GL, which owns `web/components/**`): import `bookRuleText` in `model.ts`, delete `bookRuleLabel` and then the
parity test, set `detail` to null on a row with a rule, and fix the dangling " local" in `bookRuleText` (UI-NOTES row 1)
in that one place. The core tests that pin "... Day 3 local" (`core/test/export/bookings.test.ts:47,63,83`) change with it.

**F8. A library imports a component.**
`web/lib/export/plan.ts:8` imports `printTime` from `@/components/actions/TripPrintView` (a `.tsx` view). `plan.ts` says it
is pure and can run on the server. The import drags the print view's module graph into every `forPage` consumer and
inverts the lib → components direction. The brief forbade touching `components/`, so the builder could not move it.

Fix (TRP-GL): move `printTime` to `web/lib/export/time.ts`, or to core with F4. `TripPrintView` and `plan.ts` both import
it.

**F9. `ExportStop.bookRule` holds more than a rule, and nothing fills it.**
`withStopBookings` (`core/src/export/bookings.ts:70`) writes `bookAheadText`, the rule joined with the note, into a field
named `bookRule`. A note-only booking puts a note in `bookRule`. No real booking row has a `placeSlug` (both trips'
logistics rows set `placeSlug: null`, `trips.ts:282,360`), so the field is empty everywhere today. Renaming it is free now
and costly after go-live.

Fix: rename it to `bookAhead` in `types.ts`, `schema/api/export.ts`, `csv.ts` and the tests. Record the data gap (logistics
rows name no place, so the TRP2b2 rule "each booked stop's window prints next to its time" cannot hold yet) as an open
data row. Do not leave it only in a hand-back.

### Low

- **F10. `day` is the first of `days`, not the rule's day.** `bookings.ts:51` uses `Math.min(...r.days)`. When a rule says
  "before Day 5" on a row whose days are `[3, 5]`, the booking sorts and prints at the head of day 3. Prefer
  `bookRule.dayN` when present, then `min(days)`.
- **F11. Contract change: acceptable, document it.** Making `bookings` required in a `strictObject` breaks any older
  reader of the json body, and the old shape fails the new parse. That is acceptable: the API is not deployed (PLAN R-8),
  every store must answer, `[]` is cheap, and a required field is the right call over an optional one that readers must
  guess about. OpenAPI is honestly unchanged, since `body` is a string, but that means the export model's shape is
  published nowhere outside Zod. Before go-live, publish `exportModel` as a named component schema in the OpenAPI
  document (documentation only) and add a model `version` field, so the next change is detectable.
- **F12. `ref` exposes internal keys and promises stability it cannot keep.** Rockies refs are legacy booking ids
  (`logistics:larch-valley-group`). Dolomites refs are prototype ids (`logistics:r-auronzo`). Both change at TD-3/TD-4. The
  doc comment says "stable for the trip". Either call it "opaque; stable within one revision" or keep it out of the API
  body. Nothing private in today's values.
- **F13. Trip HTML growth (+2,454 B raw Rockies).** That is about 11 notes at 200 B each. `ExportData` is the right place:
  one model for the menu, the CSV and the print (P9, P8 "exports come from the page"). The cheaper option, deriving
  bookings in the browser from category data, splits the model in two and is not worth about 1 KB gzipped. F1's clean-up
  (dropping "no booking" rows and markers) shrinks it anyway. No byte budget test pins page weight; consider one in
  `page-data.test.ts`.
- **F14. The time-rule test re-implements the matcher.** `trip-routes.test.ts:349-352` finds the entry with the same
  slug-then-title rule as `entryOf`, so a matching error repeats in both. It tests the wiring, not the matching. F3's fix
  should compare against `rowsOf`'s output instead. K30 builds its expected list with the same `tripBookings` the store
  uses. That is acceptable only because the web test binds the words to the page's `bookRuleLabel` rows independently.
- **F15. Plan bookkeeping.** `docs/v2/build/MASTER-ORDER.md:166` still shows TRP-GL-C as "ready". Move it to Done with
  `ef3b89dc` and note the F1, F4 and F9 follow-ups (CLAUDE.md: "when work ships, move its row to Done").
- **F16. Nits.** "Opens 1 days before" has no singular, and a `daysBefore` of 0 reads oddly (in both copies). The CSV
  has no formula-injection guard (a cell starting with `=`, `+`, `-` or `@`). The data is authored, so this is low risk,
  but a one-line prefix in `csvCell` closes it for good. A household hit in any booking note makes `respond()` fail the
  whole trip export with 500. That is correct fail-closed behaviour, but the snapshot report should surface it before
  build, not at request time.

## Questions the brief asked

| Question | Answer |
|---|---|
| Required `bookings` on a public shape | Right call pre-launch; add OpenAPI component schema and a model version before R-8 (F11) |
| Dateless guarantee | Holds: rules are relative by construction; notes pass `undatedSentences` (Rockies) or the K30/web `isDated` tests (Dolomites `l.bookNote` and all names are not scrubbed at build, only tested). The cost is F1: the dated shuttle row vanishes instead of being rewritten |
| Privacy (`ref`, notes, `respond()`) | `ref` holds no private data (F12). Notes: one household sentence passes the detector (F1). `respond()` runs `privacyHits` on the whole envelope, body included, and fails closed |
| `bookRuleText` parity | The test is strong enough for a copy (four rules plus the real row); the page should import the core function now, via TRP-GL (F7) |
| Per-stop `bookRule` | Correct and never guessed (place and day both must match); dead in real data; misnamed (F9) |
| CSV changes | Last column and booking rows at the head of the day: good. One row per timeline row: good, apart from F3. Order: F2 |
| API writes authored times | Real two-source risk, tracked against the wrong row (F4) |
| HTML growth | Acceptable, right place (F13) |
| Edge cases | No bookings: covered (`[]`, empty column). Booking without a day: last, covered. Rule without a time: dangling " local" pinned by tests, fix in one place (F7) |
| Tests' expected values | Web tests read the page model (good). Core unit values are typed, which is fine for units. K30 and the time-rule test partly mirror the implementation (F14) |

## What is right

- The page's rows are the single source: no booking is re-derived from research data, and no booking is placed on a
  stop by its name.
- The web test binds every exported booking to the page's own "By category" row (key, name, rule, note, day) on both
  real trips, and checks the API json equals the page model.
- `bookings` is required and `[]` when empty, so no store can omit it silently.
- The CSV keeps its old columns in place; the new column is last, and a booking with no stop still appears as its own
  row.
- The browser CSV now follows the chosen profile and no longer repeats Rockies stops per track. That closes BACKLOG 15.46
  for the browser path.
