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
| `rebuild` | `rebuild(S, prev) -> plan` | As `build`, keeping items the person placed or locked in `prev` (and notes) |
| `fits` | `fits(S, plan, dayIndex, pid, {relax?, half?}) -> {ok, reasons[], legMin, backMin, durMin}` | Pure check: does the place fit that day's drive limit, visiting limit, closures and party misfits. `relax` allows 1.5x limits, `half` halves the duration |
| `fillFree` | `fillFree(S, plan) -> {plan, filled[dayIndex], stillEmpty[dayIndex]}` | Fills empty non-arrival, non-departure days: pass 1 a light stop within 30 min of the base, pass 2 the nearest unused place that fits with relaxed limits and half-day allowed. Mutates `plan`. Phase 1B extends it (offer "Remove this day" when `stillEmpty` is not empty) |
| `recalc` | `recalc(plan, S) -> plan` | Recompute times, legs, drive, warnings (drive, sunset, long day, closed) after any edit |
| `freeDays` | `freeDays(plan) -> day[]` | Days with no items and no arrival or departure kind |
| `planStats` | `planStats(plan, S) -> {days, avg, tot, moves, items, priced, free[], cost, cur, books[], warns}` | Totals for the review screen |
| `bookAhead` | `bookAhead(plan, S) -> [{pid,item,place,days,by,label,day}]` | Book-by dates (exact when dated, approximate for a month) |
| `toTrip` | `toTrip(S) -> trip` | Builder state to the `proto.trips` record; pass through `ProtoContract.normalise` |
| `whenInfo` | `whenInfo(S) -> {type, month, from, to, dated}` | Month and dates from `S.when` |
| `drive`, `hav` | `drive(a, b) -> minutes`, `hav(a, b) -> km` | Placeholder drive time from coordinates and a factor (not routing) |
| `eff` | `eff(S) -> {P, driveDay, moves}` | Effective pace limits for the party |
| `misfit`, `closedIn`, `lightStop` | `misfit(S, place) -> string[]`, `closedIn(S, place) -> bool`, `lightStop(S, base, excludeSet) -> place|null` | Filters used by fits and fillFree |
| `fd`, `hm` | `fd(min) -> "2 h 05"`, `hm(min) -> "09:30"` | Formatters |

Not changed in phase 0: the engine still uses the placeholder `SUNSET` table and its own `icsOf`; phase 1B swaps them for `shared/sun.js` and `shared/ics.js`.
