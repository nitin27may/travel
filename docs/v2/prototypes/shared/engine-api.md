# Engine API (`shared/engine.js`)

The builder engine, moved here from `builder/engine.js` so the planner can re-flow a day. It is a classic script (no modules): it
needs `builder/data.js` loaded first (globals `PLACES`, `PL`, `PARKS`, `REGIONS`, `AIRPORTS`, `SUNSET`, `MS`, `MONTHS`), then
`shared/engine.js`. The builder keeps using its globals; everything else uses `window.ProtoEngine`.
(Phase 1 should lift `data.js` to `shared/` if the planner needs places; until then load `../builder/data.js`.)

```html
<script src="../builder/data.js"></script>
<script src="../shared/engine.js"></script>
```

State `S` is the builder's state object (`newState(kind)` in `builder.js`): `kind, nights, picks[], must{}, stay{}, regions[], cc, area,
origin{name,lat,lon,cc}, party[], when{type,from,to,month}, pace, paceSet, arrive, leave, airFrom, flyMode, reachH, bases, filt, title,
id, plan, checklist, done`. A plan is `{days:[{n,base,moveFrom,items:[{pid,auto?,locked?,placed?,t,dur,leg}],kind,drive,visit,end,free,warns[]}], bases[], unfit[], builtAt, nights, warnCount}`
with `n` 0-based. `toTrip(S)` converts it to the `proto.trips` shape (`contract.js`, `n` 1-based).

| Function | Signature | Does |
|---|---|---|
| `build` | `build(S) -> plan` | Fresh plan from picks, kind, nights, pace; clusters to bases, orders by nearest neighbour, fills to a budget; recalculates times |
| `rebuild` | `rebuild(S, prev) -> plan` | As `build`, keeping items the person placed or locked in `prev` (and notes). A kept pick that no longer fits (closed, party misfit) is dropped from the days and returned in `plan.unfit` with a reason |
| `fits` | `fits(S, plan, dayIndex, pid, {relax?, half?}) -> {ok, reasons[], legMin, backMin, durMin}` | Pure check: does the place fit that day's drive limit, visiting limit, closures and party misfits. `relax` allows 1.5x limits, `half` halves the duration |
| `fillFree` | `fillFree(S, plan) -> {plan, filled[], relaxed[], half[], stillEmpty[]}` (day indexes) | Fills empty non-arrival, non-departure days in two passes. Pass 1: a light stop within 30 min of the base. Pass 2: relaxed limits (1.5x), first with full duration, then half duration (the item gets `half:true`; `recalc` halves its time). `relaxed` lists days filled in pass 2, `half` those filled with a half-day item. A day in `stillEmpty` can be removed (nights minus one) or given a place by hand. Mutates `plan`; never touches placed or locked items |
| `recalc` | `recalc(plan, S) -> plan` | Recompute times, legs, drive, warnings (drive, sunset, long day, closed) after any edit |
| `freeDays` | `freeDays(plan) -> day[]` | Days with no items and no arrival or departure kind |
| `planStats` | `planStats(plan, S) -> {days, avg, tot, moves, items, priced, free[], cost, cur, books[], warns}` | Totals for the review screen |
| `bookAhead` | `bookAhead(plan, S) -> [{pid,item,place,days,by,label,day}]` | Book-by dates (exact when dated, approximate for a month) |
| `toTrip` | `toTrip(S) -> trip` | Builder state to the `proto.trips` record; pass through `ProtoContract.normalise`. Resolves dates for "next weekend" (6 to 8 Nov 2026) and "this weekend" (30 Oct to 1 Nov 2026), so `dates.from` and `dates.to` are set; a month-only or flexible trip keeps `dates.month` and `dates.flexible`. (Builder's `fromTrip` maps `dates.flexible` back to `when.type='flex'`) |
| `whenInfo` | `whenInfo(S) -> {type, month, from, to, dated}` | Month and dates from `S.when` |
| `drive`, `hav` | `drive(a, b) -> minutes`, `hav(a, b) -> km` | Placeholder drive time from coordinates and a factor (not routing) |
| `eff` | `eff(S) -> {P, driveDay, moves}` | Effective pace limits for the party |
| `misfit`, `closedIn`, `lightStop` | `misfit(S, place) -> string[]`, `closedIn(S, place) -> bool`, `lightStop(S, base, excludeSet) -> place|null` | Filters used by fits and fillFree |
| `sunsetFor` | `sunsetFor(S, day) -> minutes|null` | Sunset in minutes after midnight at the day's base, from `shared/sun.js`; null when the day has no date. Replaces the placeholder `SUNSET` table |
| `departSlack`, `defaultDepart` | `departSlack(S, base) -> minutes`, `defaultDepart(S) -> minutes` | Time left on the departure day after the drive (and 2.5 h at the airport when flying); the build adds a light stop when it is 3 h or more. Default departure 16:00 flying, 17:00 otherwise |
| `icsOf` | `icsOf(plan, S) -> string` | Timed calendar text for a dated plan, built with `shared/ics.js`; empty when the trip has no dates |
| `zoneOf` | internal, used by `sunsetFor` | IANA zone for a point: Italy `Europe/Rome`, Iceland `Atlantic/Reykjavik`, Canada `America/Edmonton` west of longitude -110 and `America/Toronto` elsewhere, else UTC |
| `fd`, `hm` | `fd(min) -> "2 h 05"`, `hm(min) -> "09:30"` | Formatters |

Items carry `half:true` when they hold half the usual time (set by `fillFree` or the item sheet's "Half a day" switch). Sun and calendar output now come from `shared/sun.js` and `shared/ics.js`; the old `SUNSET` table is no longer used for warnings.
