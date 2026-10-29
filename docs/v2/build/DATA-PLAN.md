# Data plan: every data and research task in one order, with its bundle, and how the data is verified

Written 26 Oct 2026 by travel-planner (Opus 5.5) on `public/PLAN-CONSOLIDATE`, from `main` ce94e12e with
`public/CATALOGUE-EARLY` merged. **Planned only: no data, code or database changed.** Requirement PLAN
[R-251](../PLAN.md); BACKLOG 15.263 to 15.273; owner question Q290 (section 6.2). Principles cited by number from
[principles.md](../design/foundation/principles.md): P1 (design for scale), P8 (protect the catalogue), P9 (one data
boundary).

**The request (coordinator for the owner, 26 Oct 2026).** One plan for all data enhancement: the measured state, every
pending research and data task in one ordered table, the load and verify pipeline, how data is verified before and after
it reaches Neon, the data rules on one page, and a coverage scoreboard re-measured at every release. **Owner follow-up
the same day:** every pending research item gets a place in a release bundle with its hours added to that bundle; research
runs in the data seat beside the build so each bundle ships with the data its features display.

**This page is the successor of** [public-site/DATA-ROADMAP.md](public-site/DATA-ROADMAP.md) for anything pending (that
page keeps the batch history, the dependency graph of 25 Oct, the service table and the DD-1 to DD-8 log) and of the
task table in [MASTER-ORDER](MASTER-ORDER.md) 3.4 (which now points here). [CATALOGUE-EARLY.md](CATALOGUE-EARLY.md) stays
the authority for the load briefs (LOCAL-3 to CAT-Q); section 3 here only orders them with the research. The release
bundles and their rules are [RELEASE-PLAN](RELEASE-PLAN.md) 0a.

> **26 Oct 2026, evening (ALIGN, R-256):** rows 45 to 50 add the data-seat work of the UX fixes, the entity graph and the
> parks spec (UXB-W, EG-M, EG-D, PA-R-CA, PA-MUS, PA-R-ON); the seat also builds PM-G (D, counted as Infra); TRP-GL-D,
> L4, ORPH-7, AREA-2 and UXB-W are merged; the D10 splits for the other trips and the D8-R facts move into C's window
> (they still count in D and E). Data hours: **194 h**. Seat schedule 2.2 rewritten to MASTER-ORDER 5.4.
> [alignment-2026-10-26.md](alignment-2026-10-26.md) 2.4.

> **27 Oct 2026 (BUILDER-DEPS):** rows 51 to 63 add the builder program's data work (drive model, region groups, lodging,
> transport notes, landscapes, holidays) to **data seat 1** (67.5 h over D to J) and the gazetteer (509 h) to a new **data seat
> 2** (Q-DC7). DT-P0 moved to seat B3 (a code-run import). Seat 1's queue order is unchanged; the new rows use its spare
> in D, E and F. Detail: [builder-dependency-map.md](builder-dependency-map.md).

> **28 Oct 2026 (S2-DATA, owner: "consolidate all data stuff into data planning"):** section 2.4 takes in the 13 data gaps
> the Step 2 build found (DG-01 to DG-13, moved here from `design/step2/data-gaps-2026-10-28.md`, which is now a pointer),
> maps each to an existing task or one of eight new S2D tasks, and orders the next three data batches (S2-A to S2-C,
> 18.5 h in seat 1's spare in windows C and D), and 2.4.5 indexes the other scattered data lists. BACKLOG 15.390.

> **28 Oct 2026 (LOCTYPE, owner: "putting it based on location type"):** section 2.5 adds what each family of types must
> carry (address, map links, trail and park links, type facts), the registry diff and its ratchet, and the plan for the 155
> store places: rows 72 to 78 (27 h, D and E) plus code tasks LT-C and LT-M (14 h). Spec
> [features/location-type-requirements.md](../features/location-type-requirements.md); BACKLOG 15.391.

## 0. Decision in one paragraph

**One data seat runs a single ordered queue (section 2): the early half of the catalogue load first (bundle B's Internal,
in bundle A's build window), then the Rockies and Dolomites research that bundle C displays, then the other trips for D,
then the trip-level layers (windows, overview facts, bases, overview-trip stops) for E.** Every task has a bundle and its
hours count in that bundle (RELEASE-PLAN 0a.2). Today data is verified from the files only; from bundle B a database
cross-check (section 4) proves Postgres equals the files after every load, on the child and read-only on production.
Each bundle's T3 re-measures one scoreboard (section 5). **Trade-off:** the catalogue load takes the seat's first 35 h,
so the Rockies research the report puts first starts about one bundle later than it could; in return bundle B loads a
verified catalogue and every later research batch is checked against the database too. About 59 h of work had no task
before today (research the report found uncovered, Opus sample reviews, the track fetcher and its runs, the cross-check).

## 1. State (measured 26 Oct 2026)

Source: [research/reports/coverage-2026-10-26.md](../../../research/reports/coverage-2026-10-26.md) (COVERAGE-AUDIT, the
repo's own tools, read-only). Its tables are not copied here; the numbers below are the baseline of the scoreboard.

| Measure | 26 Oct | Note |
|---|---|---|
| Capture records | 498 (place 304, route 143 of which 118 trails, offer 50, event 1; 8 stays among them) | 405 in trip lanes, 93 in `catalogue` |
| At the required tier | 114 (23%) | 384 below usable, 3,731 missing required keys, all in the 8 trips with days |
| Store places | 74: 54 basics done, 19 with gaps, 1 identity open (Grand-Sault) | none at the contract's `complete` level |
| Placement | `E_PLACE_AREA` 227, `E_PLACE_ORPHAN` 7, 1 record without a point, 33 approximate | 0 points person-checked; 208 agent-checked |
| Trails | distance 115, gain 113, time 105 of 118; geometry 9 of 118 (Dolomites only); relevance 43 of 118 | 6 Quebec catalogue trails withheld for want of a track |
| Photos | in the data: trails 106/118, places 43/304, offers 8/50, store 62/74; shown on 60 of 355 place pages | PHO-R not shipped |
| Trip layers | seasons 14/14, windows 1/14, base plans 1/14, overview facts 0/14, gateways 0/13, stay records 8 | Rockies is the only trip with windows and bases |
| Overview trips | 6 trips with no capture records, about 88 stops | Costa Rica, Norway, Switzerland, Quebec, Niagara, New Hampshire |
| Dated `searched_none` | capture 107, suitability 487, relevance 297, store 49 | |
| Measured research rate | 4.1 agent-min per place, 2.9 per record (D2b); photos 0.7 min per target (D5a) | Sonnet with sidecars; excludes tracks and Opus review |

## 2. Every pending data and research task, in order

### 2.1 The ordered table

Order: the seat's queue (section 2.2 rows), which follows the report's recommended order (Rockies, then Dolomites, Utah
and Patagonia, then the rest; one Opus research lane at a time; one runner each for Commons, Overpass and Wikidata) after
the catalogue load. "Bundle" is the release whose features display the result; the hours count there. "Row" is the
data-seat row of [MASTER-ORDER](MASTER-ORDER.md) 5.4. Ids marked (new) had no task before this page.

| # | Id | What | h | Model | Blocked by | Owner decision needed | Bundle | Row |
|---|---|---|---|---|---|---|---|---|
| 1 | D1B-Q | The five open D1b rulings (Lac du Chatelard, Cinque Torri and Fiscalina and Vallunga payoffs, Mount Indefatigable, Federa `reaches`, Grand View Point point) | 0.5 owner | owner | | **answered 26 Oct 2026, as recommended** (section 2.3); done | C, D | 5 |
| 2 | LOCAL-3 | Drift stage in check-all (CATALOGUE-EARLY 11.1) | 3 | Sonnet | | | B | 1 |
| 3 | TRP-GL-D | Identity of Emerald Lake shore, Lake Louise shore, Paint Pots (closure B4, D5) | 2 | Opus | | | A | **done** (merged 26 Oct; storing blocked by the ledger pin, run note) |
| 4 | RIS-M | `research_meta` migration (11.2) | 7 | Opus builder, review | | | B | 2 |
| 5 | RIS-L | The 26 seed families on the engine (11.3) | 8 | Sonnet, Opus review | RIS-M | | B | 3 |
| 6 | RIS-T | Load tests with exposure parity (11.4) | 7 | Sonnet, verifier | RIS-L | | B | 4 |
| 7 | LOCAL-5 | `db:rehearse` on the child (11.5) | 2 | Sonnet | RIS-T | | B | 4 |
| 8 | CAT-V | Read-only production drift job (11.6) | 2 | Sonnet | LOCAL-5 | | B | 5 |
| 9 | DV-1 (new) | Database cross-check `db:crosscheck`: field-by-field compare, counts with `seed_commit`, referential integrity, role grants, exposure parity (section 4, brief 7.2) | 6 | Sonnet 5, Opus review 1 | RIS-L | | B | 5 |
| 10 | L4 | Cross-check the 74 stored places: 10-value samples against sources | 2 | Sonnet verifier | | | A | **done** (merged 26 Oct: 60 values, 93.3% confirmed) |
| 11 | D610 | The 42 dated texts list (BACKLOG 3.10) and the D6a run note | 1 | Haiku | | | A | 5 |
| 12 | ORPH-7 | Place records for the 7 offers that say where nowhere (`E_PLACE_ORPHAN` 7 to 0) | 3 | Opus | | | C | **done** (merged 26 Oct) |
| 13 | CAT-1 | First production load on bundle B's release day (11.7) | 1.5 | coordinator | CAT-V, DV-1, B approval | Q280 to Q286 answered | B | release day |
| 14 | TRK-1 (new) | Track fetcher for trails with capture records: OSM relations from the record's `links`, files keyed by public slug, no prototype place needed (brief 7.1) | 7 | Sonnet 6, Opus review 1 | | | C | 7 |
| 15 | AREA-2 | Areas for the 227 records with none, Rockies (114) first; a missing type is one `types.json` entry by one writer with Opus review | 6 | Opus | | | C | **done** (merged 26 Oct: `E_PLACE_AREA` 227 to 28, 76 new store places) |
| 16 | D3 | Trail facts for the rest: access points 105, `starts_at` 105, Wikidata 75 of 118 trails | 10 | Opus | | D1B-Q 3 answered 26 Oct (drop it from the plan) | C | 8 |
| 17 | TRL-REL (new) | Relevance answers for the 75 trails with none | 3.5 | Sonnet, Opus sample | | | C | 8 |
| 18 | ORG-G | Gateways for the 13 public trips (`data/trips/gateways.json`) | 3 | Opus | ORG-D (B2 row 6) | | C | 9 |
| 19 | TRK-CA (new) | Track runs for the Canadian trails: 67 Rockies, then the 6 withheld Quebec trails (OSM ids in the D2b-ca run note); Overpass one runner | 5 | Sonnet run, Opus review of held-back lines | TRK-1 | | C | 9 |
| 20 | TRK-DO (new) | Dolomites: the 9 held-back tracks (6 unconfirmed, Lagazuoi and Siusi wrong relation, Nuvolau not stitching) and the Fanes second way; start overrides for Cinque Torri and Fanes in `inputs.json` | 2 | Sonnet run, Opus review | TRK-1 | **Siusi**: which plateau walk is meant (owner input needed); D1B-Q 2 and 4 answered 26 Oct (no payoff parts; Federa to `reaches`) | C | 9 |
| 21 | TRK-RW (new) | The other trips' trails: Utah 13, Patagonia 7, Iceland 5, Chamonix 3, Algonquin 2, Vermont 1 | 2 | Sonnet run | TRK-1 | | C (rides D if short) | 9 |
| 22 | D10-RO (new) | Rockies records below usable that no other task covers: 77 places, 18 other routes, 1 event (keys: links, access points, best time, on-site minutes, access season, wheelchair) | 7 | Sonnet fills, Opus 10-record review | | D1B-Q 3 answered 26 Oct | C | 10 |
| 23 | D10-DO (new) | Dolomites: 34 places, 3 other routes, 8 stays | 3.5 | Sonnet, Opus review | | D1B-Q 2, 4 answered 26 Oct | C (rides D if short) | 10 |
| 24 | RIS-H | Registry homes for `duration_min`, `activity_min`, `book_url` (25 offers can never pass without them) and 4 more properties | 3 | Opus, B2 contract lane | not beside STY-P | | C | B2 row 8 |
| 25 | OFR-1 (new) | The 44 offers below usable: hours 40, `access_cost` 27, summary 27, then the 25 experience offers once RIS-H lands (Rockies 34, Dolomites 4, Patagonia, Iceland, Chamonix 2 each) | 3.5 | Sonnet, Opus review | RIS-H for the last 25 | | C | 11 |
| 26 | D5c | Photos for the 159 trip place records and 42 offers without one, after the points above are final; Commons one runner | 4 | Opus picks, Haiku runs | the Commons runner free | | C | 11 |
| 27 | DV-2 (new) | Page-level parity spot check: sampled rendered pages and `/api/v1` bodies against Postgres rows (brief 7.3) | 3 | Sonnet | DV-1, CAT-1 | | C | 11 |
| 28 | D8-R | Rockies overview facts: access season, booking state, durations, effort for every plan item | 8 | Opus | | | E | 12 |
| 29 | D10-UT (new) | Utah: 11 places, 1 other route; the 8 D2b records in lane `usa-southwest-rockies` count with it | 1.5 | Sonnet, Opus review | before REQ-RF (B2 row 13) | D1B-Q 5 answered 26 Oct (Grand View Point corrected by changeset) | D | 12 |
| 30 | D10-PA (new) | Patagonia: 19 places | 2 | Sonnet, Opus review | before REQ-RF | | D | 12 |
| 31 | D10-IC (new) | Iceland: 24 places | 2 | Sonnet, Opus review | before REQ-RF | | D | 12 |
| 32 | D10-CH (new) | Chamonix: 16 places, 2 other routes | 1.5 | Sonnet, Opus review | before REQ-RF | D1B-Q 1 answered 26 Oct (drop the stop) | D | 12 |
| 33 | D10-PAST (new) | Algonquin 4 places; Vermont 4 places, 1 other route | 1 | Sonnet, Opus review | | | D | 12 |
| 34 | D8 | Overview facts for the other 7 trips with days | 8 | Opus | D8-R | | E | 13 |
| 35 | STO-1 (new) | The 19 store places with gaps (links 9, parking 9, image via L3, Kennecott booking, Manitou trail facts) and the 7 Sepaq park fees | 1.5 | Sonnet | | **Grand-Sault** identity (3 candidates; owner input needed: only that one place waits, the other 18 and the fees go ahead); Sepaq fees: `searched_none`, dated, answered 26 Oct | D | 13 |
| 36 | L3 | Photos for the 12 store places without one, wider sources (Openverse, Geograph) | 4 | Opus picks, Haiku runs | gallery support for Openverse | **DD-3** (licences beyond the allowlist) | D | 13 |
| 37 | D7 | Best-time windows for 13 trips: the 7 others with days first, then the 6 overview trips | 16 | Opus | OVR-Ca (B2 row 13) | **Q99** (6 overview trips); **Utah dates** (hard line 1 Oct); **Norway** window A or B | E | 14 |
| 38 | RIS-A | Promote research left in run notes (D7-R access seasons, D3a and D4a proposals, D1b facts, D9-R town facts) | 8 | Opus | RIS-H, STY-P (B2 row 14) | | E | 15 |
| 39 | D9 | Base plans for the other trips with days | 8.5 | Opus | STY-Ca, STY-E (B2 row 15) | Q109 to Q116, DD-6 answered 26 Oct; **Dolomites base split** (3 or 2 bases); **Switzerland** pass choice and **Norway** dates for those two if TD gives them days | E | 16 |
| 40 | OVT (new) | The 6 overview trips' stops (about 88) captured at the required tier, photos at 0.7 min each | 7 | Sonnet, Opus review | TD-1 (B2 row 16) gives them days | | E | 16 |
| 41 | DP | Dolomites prose to records (5 research files) | 4 | Opus | not beside D9 on the Dolomites | | later (optional) | 17 |
| 42 | L5 | New areas and places: added through the `location` skill on the owner's request, each to the 4b completion standard of DATA-ROADMAP | per request | Opus, Sonnet fills | | the owner names them | the next bundle after it merges | after row 17 |
| 43 | PERU | Peru: research notes only, no page, no data | | | | **dates and length** | not on the train | |
| 44 | SYNC | Catalogue sync to production on every bundle that changes data (RELEASE-PLAN 6 step 9a, CATALOGUE-EARLY 11.7) | 0.3 per bundle | coordinator | CAT-1 | release approval covers it (Q282) | every bundle from B | release day |
| 45 | UXB-W (26 Oct) | Official weather and climate links for the 14 public trips (with the UXB-WL schema) | 3 | Opus | | | C | **done** (merged 26 Oct) |
| 46 | EG-M (26 Oct) | Migration `relation_kinds`, `entity.run_by`, enum and SQL drift test, loader mapping ([entity-graph](../features/entity-graph.md) 11.3) | 2.5 | Opus builder (lane S) | EG-C, RIS-L | QG5 | C | MASTER-ORDER 5.4 row 5 |
| 47 | EG-D (26 Oct) | The 10 wrong-target relation fixes (changeset), the Larch Valley meadows variant (researched), `E_CAP_REL_TARGET` strict, graph rebuilt | 3 | Sonnet 1.5, Opus researcher 1.5 | EG-C, EG-I | QG1 to QG5 | C | row 5 |
| 48 | PA-R-CA (26 Oct) | Rockies parks (Banff, Jasper, Yoho, Kootenay, Kananaskis Country) through the locations store first, 2 zones, every entry requirement reshaped from the D8-R proposals, the Tre Cime toll ([protected-area-entry](../features/protected-area-entry.md) 11) | 6 | Opus researcher | PA-C; not beside D10-RO on the Rockies lane files | QP1 to QP6 answered | C | row 5 |
| 49 | PA-MUS (26 Oct) | US park fees off the place onto `#entrance-fee` offers, `covered_by` the national pass | 2.5 | Sonnet, Opus review 0.5 | PA-C | | E | row 17 |
| 50 | PA-R-ON (26 Oct) | Algonquin pilot: minimal park, two campgrounds, backcountry permit | 4 | Opus researcher | PA-3C | | G | row 20 |
| 51 | DT-T0 (27 Oct) | Terrain classes and wave 0 `data/reference/drive/areas.json` (about 25 areas) | 3 | Opus | DT-C | | D | D window |
| 52 | DT-S0 research (27 Oct) | Wave 0 seasonal roads and passes (code half in seat B3) | 5 | Opus | DT-1a | | E | E window |
| 53 | DT-F0 research (27 Oct) | Wave 0 ferries and CA-US crossings (code half in seat B3) | 5 | Opus | DT-1a | | E | E window |
| 54 | TB-RG (27 Oct) | Region groups for IT, CA, US, FR, IS (`data/reference/region-groups.json`, new) | 6 | Opus 3, Sonnet 3 | LST2b-C | Q-TB7 | E | **done 28 Oct 2026** (branch `fs1/REF`): `region-groups/1` with 17 groups for CA, US, IT, FR, IS, AR, CH (QB7 bases: NUTS-1, census divisions, traveller groups), plus `hubs.json` (27 hubs, Wikidata CC0) and `airports.json` (652 airports, OurAirports public domain) for PlanService; schemas `core/src/schema/reference.ts`; flat file per PlanService, not the per-country macro/travel shape of trip-builder-location-metadata 3 (DC-5 or TB-MD reshapes) |
| 55 | TK-S rules (27 Oct) | Type default seasons per category (code half in seat B3) | 2 | Opus | TK-C | | E | E window |
| 56 | TK-L (27 Oct) | `derive-landscape`: DEM relief, Natural Earth coast, type rules (one at a time on `core/bin/capture.ts`) | 7 | Sonnet 6, Opus review 1 | TK-C2, DC-L | Q-TK5 | E | E window |
| 57 | DC-5 (27 Oct) | Region groups for wave 1 countries over 25 first-level units (extends row 54's file) | 2 | Opus | TB-RG, DC-C | | E | E window |
| 58 | TB-BL (27 Oct) | Lodging counts per candidate town from DC-1's Geofabrik extracts, ODbL class | 3.5 | Sonnet, Haiku check | DC-1, SRC-A | Q-SRC1 | F | F window |
| 59 | TB-D4 (27 Oct) | Region transport notes with a source for the offered regions | 4 | Opus | TB-RG | Q-TB8 | F | F window |
| 60 | DT-W1 (27 Oct) | Drive model wave 1: profiles reviewed, terrain for seven T1 countries, ferries, borders, passes, recalibration | 28 | Opus 23, Sonnet 5 | DT wave 0 accepted, wave 1 list | | G | G window |
| 61 | TK-H (27 Oct) | Public-holiday reference for long-weekend chips | 2 | Sonnet | DC-L | | J | after row 20 |
| 62 | DC-W0 (27 Oct, data seat 2) | Wave 0: ON, QC, NY, VT, NH, ME, MA to T2; Italy T1 with Lombardy and the Dolomites at T2; Canada T1; US T0. Credits rows 33 (Algonquin, Vermont), 40 (Quebec, Niagara, New Hampshire stops), 50 (entry rules), 59 | 172 | Sonnet, Haiku; Opus about 25 | DC-1 to DC-4, DC-6, **DC-SRV merged first**, D5c done | Q-DC2 to Q-DC6 | E (lands E to F) | seat 2 |
| 63 | DC-W1 (27 Oct, data seat 2) | Wave 1: 28 countries and 2 SARs at T0 (105 h, F); T1 for CH, IS, AR, CL, NO, CR, FR (170 h, G) | 275 | mixed | DC-W0 accepted | Q-DC2 | F, G | seat 2 |

Totals by bundle (hours counted in RELEASE-PLAN 0a.2): A 5, B 36.5, C 62.5, D 13.5, E 55.5; 173 h with DP and L5 outside. **With rows 45 to 50 (26 Oct, ALIGN): A 5, B 36.5, C 77, D 13.5, E 58, G 4; 194 h.** **With rows 51 to 63 (27 Oct, BUILDER-DEPS): seat 1 adds D 3, E 27, F 7.5, G 28, J 2 (67.5 h, of which DT-P0's 5 h moved to seat B3 is not counted here); seat 2 adds E 172, F 105, G 170 (447 h). The gazetteer pipeline code (DC-6, DC-1 to DC-4, SRC-L, SRC-AU; D) and DC-SRV's build half (E) run in seat 2 but count as Infra.** PM-G (5 h, Sonnet builder in this seat during D's window) is counted as D's Infra, not here.
Of these, the work no task covered before today: TRK-1 7, TRK-CA 5, TRK-DO 2, TRK-RW 2, D10 18.5, TRL-REL 3.5, OFR-1 3.5,
STO-1 1.5, OVT 7, DV-1 6, DV-2 3 (59 h). The report's 29 h becomes 34 h here because each D10 split carries its Opus
10-record review (3.5 h) and OFR-1 adds the 25 offers RIS-H unblocks (1.5 h).

**The 384 draft trip records, by trip and kind** (from `capture.ts gaps --tier required --trip <t> --json`, run 26 Oct;
kinds as the tool counts them, keys missing in brackets):

| Trip | Below usable | place | other route | stay, event | trail | offer | Keys | Tasks |
|---|---|---|---|---|---|---|---|---|
| canadian-rockies-2029 | 197 | 77 (723) | 18 (247) | event 1 (5) | 67 (1,069) | 34 (503) | 2,547 | D10-RO; trails D3, TRL-REL, TRK-CA; offers OFR-1; areas AREA-2; orphans ORPH-7 |
| dolomites-2027 | 68 | 34 (201) | 3 (34) | stay 8 (40) | 19 (180) | 4 (19) | 474 | D10-DO; TRK-DO; D3; OFR-1 |
| utah-five-parks | 25 | 11 (56) | 1 (4) | | 13 (93) | | 153 | D10-UT; TRK-RW; D3 |
| patagonia-2027 | 28 | 19 (114) | | | 7 (81) | 2 (17) | 212 | D10-PA; TRK-RW; D3; OFR-1 |
| iceland-ring-road-2027 | 31 | 24 (112) | | | 5 (59) | 2 (7) | 178 | D10-IC; TRK-RW; D3; OFR-1 |
| chamonix-mont-blanc-2028 | 23 | 16 (83) | 2 (18) | | 3 (21) | 2 (12) | 134 | D10-CH; TRK-RW; D3; OFR-1 |
| algonquin-muskoka-2026 | 6 | 4 (11) | | | 2 (7) | | 18 | D10-PAST; TRK-RW |
| vermont-fall-2026 | 6 | 4 (8) | 1 (4) | | 1 (3) | | 15 | D10-PAST; TRK-RW |
| **All** | **384** | **189 (1,308)** | **25 (307)** | **9 (45)** | **117 (1,513)** | **44 (558)** | **3,731** | |

D10 sizing: the place, other-route, stay and event records (223) at the measured 4.1 minutes each (15.2 h), plus one Opus
10-record sample review of 0.5 h per split (3.5 h): 18.5 h. Trail keys are D3 (facts, access points), TRL-REL (relevance)
and TRK (geometry); offer keys are OFR-1 and RIS-H.

### 2.2 The data seat's schedule, window by window

One data seat (Opus researcher, or a Sonnet builder for code-run tasks), one task at a time. A window is the time B1
takes for a bundle's critical path (MASTER-ORDER 5.4); the plan assumes one data-seat hour per B1 hour.

**Rewritten 26 Oct 2026, evening (ALIGN)** to MASTER-ORDER 5.4's new rows. The 25 Oct windows are replaced; lane S has
not started, so it runs at the head of C's window.

| Window (5.4 rows) | B1 hours | Data seat queue | Seat hours | Spare | Ships in |
|---|---|---|---|---|---|
| A finish (1) | 3 | LOCAL-3, RIS-M | 10 | | B |
| C (2 to 11) | 128 | RIS-L; RIS-T, LOCAL-5; CAT-V, DV-1, TRK-1; EG-M, EG-D, PA-R-CA, D5c; D3, TRL-REL; ORG-G, TRK-CA, TRK-DO, TRK-RW; D10-RO, D10-DO; OFR-1, DV-2; D8-R facts, D10-UT, D10-PA, D10-IC, D10-CH, D10-PAST | 106 | 22 | B (lane S, DV-1), C, and D and E for the pulled-forward splits and D8-R |
| D (12 to 14) | 56.5 | PM-G (code); D8; STO-1, L3; D7 (after OVR-Ca) | 34.5 | 22 | D, E |
| E (15 to 17) | 91 | RIS-A; D9, OVT; PA-MUS; DP (optional) | 30 | 61 | E |
| G (20, 21) | 66 | PA-R-ON | 4 | | G |
| F onward | | L5 requests, re-measures, any slipped batch | | | next bundle |
| (27 Oct) D, E, F, G, J additions to seat 1 | | D: DT-T0. E: DT-S0 and DT-F0 research, TB-RG, TK-S rules, TK-L, DC-5. F: TB-BL, TB-D4. G: DT-W1. J: TK-H | 3; 27; 7.5; 28; 2 | E's spare 61 h falls to about 34 h | D to J |
| (27 Oct) **data seat 2** (Q-DC7) | | D: DC-6, DC-1 to DC-4, SRC-L, SRC-AU (Sonnet builder). E: DC-SRV build half, then DC-W0 once DC-SRV merges. F: DC-W0 rest, DC-W1 T0. G: DC-W1 T1 | about 509 h with the code | Opus work only in the Opus lane's spare | E, F, G |

**Where it can slip, and what happens** (25 Oct text; since ALIGN lane S runs at the head of C's window, so bundle B's CAT-1 waits for it or rides C, and C has 22 h spare). Window A has no spare: if lane S runs over, ORPH-7 moves to C and CAT-1 rides
C (RELEASE-PLAN 0a.3 row 3). Window C has 12 h: Overpass outages (the CA split of D2b lost an hour to 502s) or the Opus
weekly cap (research pauses above 70% of the week's use) are the likely causes; then TRK-RW and D10-DO ship partial in C,
each unfilled key a dated `searched_none` and one Known limits line, and finish in D. Nothing in this plan blocks a
bundle (RELEASE-PLAN 0a, B8). Window E has 40 h spare, the place to catch up anything slipped.

### 2.3 Owner decisions that hold data back, and the bundle each unblocks

**26 Oct 2026: the owner answered every decision below that had a written recommendation ("go ahead with all recommended answers"); those tasks are ready.** The values and choices that still need the owner are listed once, in [MASTER-ORDER](MASTER-ORDER.md) 7.3 "Owner inputs still needed".

| Decision | What waited | Bundle it unblocks | Answer (26 Oct 2026) |
|---|---|---|---|
| D1B-Q 1: Lac du Chatelard | the last record without a point (D10-CH) | D | **Answered:** drop the stop. No lake of that name exists in the area (Overpass and Wikidata searched); mark the stop retired, delete no ref |
| D1B-Q 2: Cinque Torri, Fiscalina and Vallunga payoff places | 3 Dolomites places (D10-DO) | C | **Answered:** no payoff parts. The routes are `route_is_attraction`, so none is expected and no new place pages are made |
| D1B-Q 4: Federa `reaches` | the Federa track cut (TRK-DO) | C | **Answered:** move `place/lago-federa` from `starts_at` to `reaches` on the walk (a relation fix, not a point) |
| D1B-Q 3: Mount Indefatigable, decommissioned 2005 | one trail on the Rockies family plan (D3, D10-RO) | C | **Answered:** drop it from the plan, keep the record retired |
| D1B-Q 5: Grand View Point pinned 1.4 km wrong by the ledger | one corrected point (D10-UT) | D | **Answered:** record the OSM overlook (node 6806471756) through a changeset, with a reviewed ledger exception for corrected points |
| Siusi: which plateau walk is meant | the Siusi track (TRK-DO) | C | **Owner input needed** (no recommendation written) |
| Grand-Sault identity (3 candidates in D2b-ca) | 1 store place (STO-1) | D | **Owner input needed** (no recommendation written); STO-1 runs for the other places and holds this one |
| Sepaq fees by hand or `searched_none` (D2b-ca 3) | 7 park fees (STO-1) | D | **Answered:** `searched_none`, dated; fees change yearly |
| DD-3: photo licences beyond CC BY, CC BY-SA, CC0, public domain | L3 (12 store photos) | D | **Answered:** keep the allowlist (DATA-ROADMAP DD-3) |
| Q99: windows for the 6 overview trips | 6 of D7's 13 trips | E | **Answered:** yes |
| Utah dates (hard line 1 Oct); Norway window A or B and group size | D7 window choice for Utah and Norway; D9 Norway | E | **Owner input needed** |
| Q109 to Q116, DD-6 (stays) | D9 and STY-1 | E | **Answered:** as the stay spec section 18 |
| Dolomites base split (3 or 2 bases); Switzerland pass choice | D9 and STY-1 | E | **Owner input needed** |
| Peru dates and length | everything for Peru | not on the train | **Owner input needed** |
| Q290: re-baseline rule for research-filled pages (section 6.2) | data batches that fill place pages (C onward) | C | **Answered:** yes |

Q88 is answered (option A, re-baseline, 25 Oct); MASTER-ORDER 3.4's "blocked: owner" row is corrected by this page.

### 2.4 Gaps found by Step 2 (28 Oct 2026)

**Source.** The Step 2 build (edit mode on `/t/<id>/`, bundle D; [step2/README](../design/step2/README.md),
[build-plan](../design/step2/build-plan.md)) needed data that is missing, thin or inconsistent. Each row is a data task,
not a UI task: the UI already degrades safely (hides a chip, flags an estimate with ≈, says "Not checked yet"). This
section is the only copy of DG-01 to DG-13; BACKLOG 15.390 points here. Principles: P1 (every rule works for any trip, not
the Rockies only), P6 (the right metadata at the moment of adding or moving a stop), P8 (no bulk files; the budget of
DG-11), P9 (results reach the UI through the one data boundary, never a new client-side load).

**Where results go (owner, earlier answer on data research).** Structured results go to `data/` through the `location`
and `research` skills: the store `data/locations/locations.json`, records and sidecars in `data/capture/<trip>/`,
`data/suitability/<trip>/`, `data/relevance/<trip>/`, reference tables in `data/reference/`; trip writes through
`node core/bin/ops.ts`; prose and run notes in `research/`. Method: [research/README.md](../../../research/README.md).

#### 2.4.1 The gaps and where each one lands

"Task" is an existing row of 2.1 or a new S2D task (2.4.2). "Code half" is work for a builder lane, listed so it is not
lost; it is not counted in the data hours.

| ID | Gap | Where it shows | Evidence | Task | Code half (builder lane) | Unblocks | Priority |
|---|---|---|---|---|---|---|---|
| DG-01 | **Rainy-day flag.** The registry already has `indoor` (bool, glance, filter scopes culture, play, intent:do; `core/src/schema/capture/properties.ts`), but no capture record sets it (0 files) and `flagsOf` in `core/src/capture/bands.ts` never emits it | add-picker "Rainy day" chip hidden (UI2) | UI2 hand-back item 5 | **S2D-IND** | `flagsOf` emits `indoor` from the record value, else the type default (Sonnet 1 h, B lane) | the add-picker Rainy day chip; later the builder's Swap for indoor (FINDINGS enhancement 9) | High |
| DG-02 | **Points for stops.** 64 of 91 Rockies stops have a map point on their place page; 27 have none | a moved or added stop with no point falls to a base-to-base estimate (LEG ladder rung 2 or 3, ≈) | LEG hand-back; `ScheduleItem.placePoint` | **S2D-PTS** (with DG-04) | none | real drive times for moved stops (with S2D-LEG) | High |
| DG-03 | **Stored legs for published stops.** Pairs with no stored leg use the 10-minute local move; the bogus "via Lake Louise" 5 h 20 on adults Day 4 | day times on the public page and in edit mode | LEG hand-back "Deferred"; `data/schedules/legs/canadian-rockies-2029.json` (25 Oct) | **S2D-LEG** | fix the split-day start-time back-calculation (Sonnet 2 h) | real drive times for moved stops; honest day totals | High |
| DG-04 | **Area-level and logistics rows.** Marble Canyon, Cave and Basin, stays and logistics rows map to no day stop | Stops tab rows have no `⋯` menu | UI2 hand-back item 2 | **S2D-PTS** | the Stops row carries the schedule item id it joins to (Sonnet 1 h) | remove and move on every Stops row | Medium |
| DG-05 | **Park members.** `PlaceContext.members` does not exist; members are "places within `AREA_DEFAULT_R`" | `add=<park>` arrival, picker groups | E3 hand-back gap 2 | **EG-I** (membership index, [entity-graph](../features/entity-graph.md) 2.3) and **PA-R-CA** (row 48: Rockies parks with `covers_areas`); no new data task | `PlaceContext.members` reads the EG-I index (Sonnet 1.5 h, after EG-I) | park members in the picker and the park arrival | Medium |
| DG-06 | **Day versions as data.** The versions exist in the files (`variants` and per-day `order` by version in `data/schedules/<trip>.json`), but the plan model does not send them; ERFIX derives them from the published days | picker group "From the other versions of this day" | ER-005 | **S2D-VER** (mostly code; a shared contract, so Opus) | the plan model publishes each day's versions from `order` (Opus 2 h) | day versions in the picker without derivation | Medium |
| DG-07 | **Suitability and kids checks incomplete.** Day headers say "3 not checked"; chips say "Kids: not checked yet" | day headers, stop rows, the Kids chip | Rockies Day 1 screenshots | **S2D-SUIT** (rides the D10-RO and D10-DO lane files) | none | kids and step-free checks per day | Medium |
| DG-08 | **Photos.** Many highlights read "No licensed photo yet"; worktrees have an empty rendition cache | summary highlights, Mine thumbnails (MINE-T), covers | S2-SWEEP-after shots | **D5c** (row 26, C: 159 trip places, 42 offers) and **L3** (row 36, D: store); rendering is PHO-R | worktree briefs copy `web/.og-cache` (section 7 common line); no new task | photos on highlights and Mine rows | Medium |
| DG-09 | **Plan timing oddities.** Dolomites Day 2 waits about 5 h ("Free time") for its plan time; Rockies Day 2 (Sunshine Meadows) warns "10 h 25 away from base" | day view | LEG hand-back; ER screenshots | **S2D-TIME** (rides D8-R); Dolomites base question waits on D9's base split (owner input) | none | clean day view for the two flagship trips | Medium |
| DG-10 | **Booking text.** Book-ahead detail repeats words ("lottery ... lottery") and runs long; the card clamps it (SW-029) | summary "8 to book ahead" | SW-029 | **S2D-BOOK** (`data/trips/booking-refs.json`, `data/capture/catalogue/PA-ca.json`) | none | readable book-ahead card | Low |
| DG-11 | **Place size budget.** Place-size median 1.2542 against 1.25 (about 300 bytes over), same with the flag off | `budget:report` (I14) | INT and VER reports | **S2D-SIZE**; Q290's re-baseline does not apply (not a required-tier fill) | none | headroom for every later fill that adds bytes (S2D-IND, S2D-SUIT) | Low, but first in order. Done on lt/SIZE: median 1.2050 of 1.25 |
| DG-12 | **Road network for `W_NO_ROUTE`.** The warning has a level but no definition of "no road" | warning not built | LEG hand-back | data half in **S2D-LEG** (classify the unrouted pairs: lift, trail, ferry, no road); wide coverage is **DT-F0** and **DT-S0** (rows 52, 53, E) | the check in `core/src/checks/days.ts` (Sonnet 2 h, after S2D-LEG) | the `W_NO_ROUTE` warning | Low |
| DG-13 | **Near API.** The near-places API answers `not_available` until N2; the picker reads `/api/v1/places/` pages | add picker | E3 hand-back gap 1 | **N2** (lane NB, code; BACKLOG 8.14 to 8.16); routed times later in N3 (8.13, ORS) | point the picker's one source file at N2 (Sonnet 0.5 h) | distance bands in the picker | Medium |

Owner-held items next to these (not data, listed once in [MASTER-ORDER](MASTER-ORDER.md) 7.3): the ORS key for TB-L
(runtime legs for user-moved stops), the children cap 12 against 8, old title-only draft rows, the analytics beacon
single-page setting.

#### 2.4.2 The new tasks

Data-seat rows continue 2.1's numbering. Hours count in bundle D (Step 2 edit mode ships there) and run in seat 1's spare:
window C has 22 h, window D 22 h (2.2).

| # | Id | What | h | Model | Blocked by | Owner decision needed | Bundle | Order |
|---|---|---|---|---|---|---|---|---|
| 64 | S2D-SIZE (DG-11) | Bring the place-size median under 1.25: trim summaries and links on the largest pages, or move one field to an on-demand file; `budget:report` before and after in the hand-back; merges alone. **Done on lt/SIZE (28 Oct 2026):** median 1.2543 to 1.2050 (headroom 6035 B), col-des-montets back under its cap; the icon stroke style moved from per-icon attributes to one CSS rule, and the links tabs carry no `kind`, `linkOnly:false` or empty `none` | 1 | Sonnet | | | D | 1 |
| 65 | S2D-PTS (DG-02, DG-04) | Every stop of every published trip's days resolves to a place, area, stay or base record with a licensed point (OSM, Wikidata; never Google): the 27 Rockies stops first, then measure and fill the Dolomites; area-level rows (Marble Canyon, Cave and Basin) get place records through the `location` and `research` skills; logistics rows join to the base or stay; a test lists stops without a join | 5 | Opus 2 (identities, joins), Sonnet 3 (points) | not beside D10-RO on the Rockies lane files; Overpass one runner | | D | 2 |
| 66 | S2D-IND (DG-01) | The rule: a type default per node in `data/vocab/types.json` (indoor: museum, gallery, visitor centre, aquarium, indoor play, indoor wall, cafe; mixed: gondola, hot springs, covered viewpoint, left unset by type) plus an explicit `indoor` value on records whose type is mixed; then values for every stop of the Rockies and Dolomites days; `capture.ts build` regenerated | 3 | Opus 1 (rule, one `types.json` writer), Sonnet 2 | S2D-SIZE | none (recommended rule above; the owner sees it in the hand-back) | D | 3 |
| 67 | S2D-LEG (DG-03, DG-12 data half) | After S2D-PTS: `node web/scripts/legs-ors.mjs --trip <slug>` for every consecutive pair of every version (Rockies, Dolomites), then `--check`; each pair in `*.unrouted.json` classified as lift, trail, ferry or no road, with its source; the Day 4 "via Lake Louise" leg re-checked | 3 | Sonnet 2, Opus review 1 | S2D-PTS; `ORS_API_KEY` for the offline script (the key used on 25 Oct; the TB-L runtime key is separate and owner-held) | | D | 4 |
| 68 | S2D-SUIT (DG-07) | Suitability blocks (kids, stroller, step-free, effort) for every day stop of the Rockies and Dolomites, each gap a dated `searched_none`; same lane and agent as D10-RO and D10-DO | 4 | Sonnet 3.5, Opus 10-record review 0.5 | S2D-SIZE; with D10-RO, D10-DO | | D | 5 |
| 69 | S2D-TIME (DG-09) | Review the plan times and base of Dolomites Day 2 and Rockies Day 2; correct through `ops.ts` or explain in the day note | 1.5 | Opus | with D8-R; the Dolomites base half waits on D9's base split | Dolomites base split (3 or 2 bases), already listed | D | 6 |
| 70 | S2D-BOOK (DG-10) | Tighten the book-by strings once at the source: no repeated words, one sentence each | 0.5 | Sonnet | | | D | 6 |
| 71 | S2D-VER (DG-06) | Check that each scheduled day's versions are complete in `order`; the plan-model change is the code half above | 0.5 | Sonnet | the code half | | D | 7 |

Totals: 18.5 h of data work (S2D rows 64 to 71), all in bundle D; code halves about 10 h for builder lanes, booked through
the Step 2 follow-up rows of BACKLOG, not here. **Trade-off:** these take most of window C's 22 h spare, so a long
Overpass outage pushes the D10 splits' partial-ship rule (2.2) into effect earlier; in return edit mode ships in D with
real points, legs and the rainy-day chip instead of ≈ estimates and hidden chips.

#### 2.4.3 Dependencies

| Dependency | Holds | Note |
|---|---|---|
| ORS key | S2D-LEG (offline `ORS_API_KEY`); TB-L runtime legs for user-moved stops (owner item) | the offline key exists; only the runtime key waits on the owner |
| N2 (lane NB, code) | DG-13 | not data-seat work; N3 routed nearby times need ORS after N2 |
| EG-I, PA-R-CA | DG-05 | both already in window C (rows 47, 48) |
| Licences | DG-08 (D5c, L3) | allowlist only: CC BY, CC BY-SA, CC0, public domain (DD-3) |
| Commons one call at a time | D5c, L3 | one runner under `flock /tmp/travel-commons.lock`; never parallel agents |
| Overpass, Wikidata one runner | S2D-PTS, S2D-LEG classification | Overpass at least 10 s apart (6.1) |
| Place budget | S2D-IND, S2D-SUIT | S2D-SIZE merges first, alone |
| Lane files | S2D-PTS, S2D-SUIT | one writer at a time on `data/capture/canadian-rockies-2029/` and `points.json` (with D10-RO) |

#### 2.4.4 The next three data batches (proposed order)

| Batch | Tasks | Hours | Window | Why first |
|---|---|---|---|---|
| **S2-A: stops that resolve** | S2D-SIZE, S2D-PTS, S2D-IND | 9 | C spare | every later fix needs a point and a record per stop; the budget must have room before any fill; the Rainy day chip is a built feature waiting only on data |
| **S2-B: real drive times** | S2D-LEG (plus the builder's split-day fix and `W_NO_ROUTE` check) | 3 | C spare | needs S2-A's points; removes the bogus 5 h 20 leg and the 10-minute fallback on published days |
| **S2-C: honest day checks** | S2D-SUIT, S2D-TIME, S2D-BOOK, S2D-VER | 6.5 | D spare | fills the "not checked" chips and cleans the two flagship days; S2D-SUIT rides the D10-RO and D10-DO files, so it runs right after them |

DG-05, DG-08, DG-13 need no new batch: they close when EG-I and PA-R-CA (C), D5c (C) and L3 (D), and N2 merge.

#### 2.4.5 Other data lists, and the task each maps to

These lists keep their own text (history or prototype detail); each now carries a pointer here, and their pending data
work is owned by the rows named.

| List | Data items in it | Owned by (2.1 or 2.4) |
|---|---|---|
| [research/backlog.md](../../../research/backlog.md) (CS7 payoff places and relations) | Kicking Horse put-ins (partly, `searched_none`); Niagara cluster (trip private, no days); payoff relevance | Niagara: OVT (row 40) once TD-1 gives days; relevance: TRL-REL (row 17); the Tre Cime and Larch Valley draw moves wait on a migration-ledger exception for relevance edits (no task yet; D1B-Q 5's exception covers points only) |
| BACKLOG L8 (place-page enrichment: parking, fees, swimming, boats, loops, best time of day) | every public place's empty sections, with provenance per value | D10 splits (rows 22, 23, 29 to 33), STO-1 (35), OFR-1 (25), then the gazetteer DC-W0 and DC-W1 (rows 62, 63) for new places |
| [prototypes/TODO.md](../prototypes/TODO.md) rows owned by "data" (X-6, B-H1 to B-H3, B-H9, K-H1, K-H2) | invented facts, flags, regions, prices, park entries, drive minutes | candidate rows and suitability: S2D-IND, S2D-SUIT, D10 splits; regions TB-RG and DC-5 (rows 54, 57); hubs and airports ORG-G (row 18); parks PA-R-CA, PA-MUS, PA-R-ON (rows 48 to 50); drive DT-T0 to DT-W1 (rows 51 to 53, 60); prices with read dates OFR-1 |
| [prototypes/FINDINGS-2026-10-27.md](../prototypes/FINDINGS-2026-10-27.md) data enhancements (2 opening hours and booking windows, 5 coverage gate, 9 rain plan, 14 school holidays, camper, train, stays) | per-place hours, closures, booking windows; region coverage; indoor; holidays | D8-R and D8 (rows 28, 34); the coverage gate reads the scoreboard S1 per region; S2D-IND; TK-H (row 61); stays D9 (row 39); camper and train have no task (later, not in year one) |
| Account and Mine (MINE-T thumbnails) | photos on Favourites and copy rows | D5c, L3 (DG-08) |
| BACKLOG rows with data work: TB-L (ORS key), suitability and relevance sidecars, photos and gallery, N2 | | TB-L: owner key (2.4.3); sidecars: S2D-SUIT, TRL-REL, D10 splits; photos: D5c, L3, PHO-R; gallery: TD-3 moves `gallery.json` into `data/trips/`; N2: lane NB (DG-13) |

### 2.5 Requirements by location type (28 Oct 2026)

**Source.** Owner request of 28 Oct 2026 (address, map links, trail links, the park schema, sight facts, "based on
location type"). Spec: [features/location-type-requirements.md](../features/location-type-requirements.md); BACKLOG
15.391. The capture contract already researches by type; this adds the address property, the rule that map links are
generated and never stored, link kinds counted as required keys, nine families over the 324 types, and the ratchet that
switches a new required field on per family only after that family is filled, so the gap budget never rises (spec 5.4).

**The new tasks.** Data rows continue 2.1's numbering; code rows are builder work counted as Infra, listed so they are not
lost.

| # | Id | What | h | Model | Blocked by | Owner decision needed | Bundle | Order |
|---|---|---|---|---|---|---|---|---|
| (code) | LT-C | Contract: `address` property and value, `osm_ref` as `Val`, per-kind link tier keys, two triggers, `family` on categories, `gaps --family`, `gaps --promote`, phase-1 marks, basics layers and the store-point drift report (spec 9.1). **Done 28 Oct 2026** (branch `lt/LTC`, Opus 5.5): gap budget unchanged (W_TIER_REQUIRED 382, keys 3,659); the address marks stay out of the public contract until LT-M (`pageTask`) | 7 | Opus builder 6, Opus review 1 | not beside RIS-H or STY-P on `properties.ts`; one `types.json` writer | | D (Infra, B2 contract lane) | 1 |
| 72 | LT-WHERE | `osm_ref` candidates and address proposals for the 155 store places in one run record (Wikidata, Overpass, Nominatim reverse; one runner each, cached) | 3 | Sonnet 2.5, Haiku check 0.5 | LT-C | | D | 2 |
| 73 | LT-AP | Access-point records (`access.park`, `access.start`) with point and address for the 56 places with none, in batch order | 5.5 | Sonnet 5, Opus review 0.5 | LT-WHERE | | D 2, E 3.5 | with each batch |
| 74 | LT-1 | P0 (8 trip-tied) and P1 (32 in CA/AB, CA/BC): 13 parks, 21 sights, 6 towns; 27 new records; promotions for the families it closes | 6 | Sonnet 4.5, Opus 1.5 | LT-WHERE; PA-R-CA for the 5 Rockies parks | Q-LT1 to Q-LT3 (recommended yes) | D | 3 |
| 75 | LT-2 | P2 and P3 (Utah, Dolomites, Iceland, Patagonia, Chamonix regions): 46 places, 38 new records | 4.5 | Sonnet 4, Opus 0.5 | LT-1 | | E | 4 |
| 76 | LT-3 | P4 (CA/ON, CA/QC, US/VT, US/NH): 30 places with the 6 store trails and the trail promotion | 3.5 | Sonnet 3, Opus 0.5 | LT-2; TRK-1 for tracks | | E | 5 |
| 77 | LT-4 | P5 (no trip region): 39 places | 3 | Sonnet 2.5, Opus 0.5 | LT-3 | | E | 6 |
| 78 | LT-RAT | Promotions the batches left, the final `gaps --budget --write`, an Opus cross-family 10-value sample | 1.5 | Opus | LT-4 | | E | 7 |
| (code) | LT-M | UI: address on the Directions card, OSM link from `osm_ref`, official map link, print address, ICS `LOCATION` and `GEO`, CSV column, API detail and MCP (spec 9.2) | 7 | Sonnet builder 5, Opus reviewer 1, Sonnet verifier 1 | LT-C; S2D-SIZE | | E (Infra) | after LT-1 |

Totals: **27 h of data work** (D 11, E 16) in seat 1's spare (D has about 15.5 h left after S2-C; E about 34 h after the
27 Oct additions); **14 h of code** (LT-C in D, LT-M in E). **First batch: LT-C, then LT-WHERE, then LT-1.**
**Trade-off:** D's spare falls to about 4.5 h, so a slipped S2 batch lands in E; in return the Rockies places get addresses,
access points and the park links before the park page (PA-2) and Step 2's Directions use them.

**Dependencies.** Nominatim, Overpass, Wikidata and Commons one runner each (2.4.3 rules); the place-size budget (S2D-SIZE
first, alone); one writer at a time on `points.json`, `gap-budget.json` and each lane file (not beside D10-RO on the
Rockies files); ODbL values in the identity layer (Q-SRC1, open; spec D7 gives the fallback).

## 3. The load and verify pipeline (from CATALOGUE-EARLY, in order)

Briefs and gates are [CATALOGUE-EARLY.md](CATALOGUE-EARLY.md) 2 and 11; this list only orders them with the research
and adds the cross-check.

| Step | Task | What it proves | Where it runs | Bundle |
|---|---|---|---|---|
| 1 | RIS-M | the database can hold the research contract; the app role cannot read `meta`, `notes_private`, `doc` | local, child | B |
| 2 | RIS-L | every seed family loads through one engine, stamped (`seed_commit`, `load_run`) and reversible by run id | local | B |
| 3 | LOCAL-3 | every `check-all` seeds a throwaway local database from the files, then plans again and expects zero writes | local, each check-all | B |
| 4 | RIS-T | round trip, idempotency, rollback, privacy, size, exposure parity (case 7) | local, then child | B |
| 5 | LOCAL-5 | one command rehearses on the child: reset from production, migrate, dry run, sync, verify, tests | child | B |
| 6 | CAT-V | read-only drift: production against the latest bundle tag's commit, weekly and after each bundle | production, read-only | B |
| 7 | DV-1 | the database cross-check of section 4 as one command, used by LOCAL-5 and CAT-V | local, child, production read-only | B |
| 8 | CAT-1 | the first production load on bundle B's release day; the cross-check on production after it | production | B |
| 9 | DV-2 | page-level parity spot checks after every sync | production read-only | C |
| 10 | SYNC | every bundle with data changes: deploy, smoke, rehearse, sync, cross-check, CAT-V | child, production | from B |
| 11 | CAT-Q | the first three Postgres reads, for callers that already hold a connection | local, child | D |
| 12 | SRV-0 seams | parity per method, 4 clean weekly CAT-V runs | production | K |

## 4. Data verification

### 4.1 Today: files only

Until bundle B, data is verified from the files in git: the validators (`validate.ts --all`, `capture.ts build --check`,
`sources.ts check`, `suitability.ts check`, `relevance.ts check`, `slugs.ts --check`, `locations.py validate` and
`build --check`), the gap budget (`capture.ts gaps --budget --check`: no count may rise), the migration ledger test, the
research run's 10-value sample against its sources (9 of 10 to pass), and an Opus 10-record review per split. Nothing
compares the files with a database, because no catalogue row exists in one.

### 4.2 After the Neon load: the database cross-check

Bundle B adds a cross-check that runs after every load, as one command (`db:crosscheck`, DV-1) wrapping the steps the load
tasks already build. Each check names who builds it, so nothing is built twice.

| # | Check | Pass | Built by |
|---|---|---|---|
| X1 | **Seed and plan again.** Seed a throwaway database from the files, then plan the same commit again | the second plan writes 0 rows | LOCAL-3 (every check-all) |
| X2 | **Read every row back and compare to the files, field by field.** For each seeded table, the row built from the files and the row read from the target, column by column (jsonb compared as normalised JSON, numbers by value, points to 1e-7 degrees) | 0 differing fields; on failure the first 20 differences by table, ref and column | DV-1 (extends `db:verify`, which compares content hashes) |
| X3 | **Row counts per table and per family, stamped.** Counts from the files and from the target, with the `seed_commit` and `load_run` id the target holds | counts equal; `seed_commit` equals the commit under test | DV-1 (writes a `seed-crosscheck/1` JSON) |
| X4 | **Referential integrity.** Every ref a row holds resolves: relation ends, `offer.where`, media owners, area parents, town ids, source ids | 0 orphans | DV-1 (one query per relation; foreign keys cover only part) |
| X5 | **Role grants.** As `travel_app`: `select` succeeds on every public catalogue table and is refused on every private table (`NOT_SEEDED`, household, intake) and on the `meta`, `notes_private` and `doc` columns | every probe as expected | RIS-M's grant test, run by DV-1 against each target |
| X6 | **Exposure parity.** Nothing is `published` or `approved` in Postgres that the site and `/api/v1` do not already serve | the two sets equal | RIS-T case 7, run by DV-1 against each target |
| X7 | **Page-level parity spot checks.** 20 sampled refs per run (places, trails, offers, trip items, stratified by trip): name, area path, point, the facts strip, photo credit and status on the deployed page and `/api/v1` body against the Postgres row | 20 of 20 | DV-2 |
| X8 | **Same on the child, then production read-only.** X2 to X6 inside LOCAL-5's rehearsal on the child; X2 to X7 read-only on production after the sync and weekly through CAT-V | all green | LOCAL-5, CAT-V |
| X9 | **Drift report.** Each production run writes `seed-drift/1` (CAT-V) with per-table status, the cross-check result and `pg_database_size` to `~/Library/Logs/travel/catalogue-drift/`, outside the repository; a difference raises a notification, and the release notes' Data group quotes the last result | written every run | CAT-V, DV-1 |

**When it runs.** Every bundle that changes data runs X2 to X7 on production after its sync (RELEASE-PLAN 6 step 9a), and
the result goes in the notes. CAT-V runs it read-only every week. **Every research batch ends with
`capture.ts gaps --budget --check` and, once RIS-L is merged, a local `db:seed` plus `db:crosscheck --target local`** on
the batch's branch, so a research change the database cannot hold fails in the batch, not on release day. A drift result
is fixed in the JSON and synced, never by editing a row (local-database spec 2.1 rule 1).

## 5. Coverage scoreboard

### 5.1 Definition and who updates it

One table of numbers, re-measured with the repo's tools at every bundle's T3 by the coordinator (or a Haiku agent the
coordinator runs), quoted in the bundle's CHANGELOG "Data" group against the bundle's readiness line (RELEASE-PLAN 0a.4),
and written as a new `research/reports/coverage-<date>.md` by the COVERAGE-AUDIT method when a bundle moves any number by
more than 5 points. Each data batch's hand-back quotes the rows it moved, before and after. The data seat may not mark a
batch done if a number it owns went down.

| # | Measure | Command |
|---|---|---|
| S1 | Records at the required tier, all and per trip (count and %) | `node core/bin/capture.ts gaps --tier required [--trip <t>] --json` |
| S2 | Below usable and missing required keys (`W_TIER_REQUIRED`) | `capture.ts gaps --budget` |
| S3 | `E_PLACE_AREA`, `E_PLACE_ORPHAN`, records without a point, approximate points | `capture.ts gaps --placement` |
| S4 | Store places: basics done, gaps left, identity open | `python3 tools/locations.py basics --report --json` |
| S5 | Trails: distance, gain, time; geometry confirmed and held back; relevance answered | `gaps --tier required --json` (trail kind); count of `data/tracks/*.json` with `confirmed: true`; relevance sidecars |
| S6 | Trip layers: seasons, windows, base plans, overview facts, gateways, stay records (trips with each) | files in `data/seasons/`, `data/windows/`, `data/base-plans/`, the D8 `OV.json` per trip, `data/trips/gateways.json` |
| S7 | Photos: in the data (trails, places, offers, store) and shown (built place pages with a photo) | gaps matrix; one count over the public build |
| S8 | Points: person-checked, agent-checked, none | review states in `data/capture/points.json` |
| S9 | Dated `searched_none`: capture, suitability, relevance, store | counts over the record files and `field_meta` |
| S10 | Postgres (from B): last cross-check result, row totals, `seed_commit`, last 4 CAT-V runs | `db:crosscheck --target production --read-only`, the drift folder |

### 5.2 Baseline and targets per bundle

Targets are the readiness lines of RELEASE-PLAN 0a.4; "held" means the number may not fall.

| Measure | 26 Oct | A | B | C | D | E | H | K |
|---|---|---|---|---|---|---|---|---|
| S1 required tier, all | 114 / 498 (23%) | held | held | Rockies 180/199, Dolomites 68/76 | 448 / 498 (90%), each trip with days 90% | held, plus about 88 overview stops | 90% | held |
| S3 `E_PLACE_AREA`, orphans | 227, 7 | held | held | 25 or fewer (Rockies 0), 0 | held | held | held | held |
| S4 store basics done | 54 / 74 | 54 | 54 | 54 | 73 / 74 | held | held | held |
| S5 trail geometry confirmed; relevance | 9 / 118; 43 / 118 | held | held | 60 or more, every trail attempted; 118 / 118 | held | held | held | held |
| S6 windows; base plans; overview facts; gateways | 1; 1; 0; 0 of 13 | held | held | gateways 13 / 13 | held | windows 8 (14 if Q99), bases 8, facts 8 | held | held |
| S7 pages showing a photo | 60 / 355 | held | held | 250 or more | store 74 / 74 or dated | held | held | held |
| S10 Postgres cross-check | none | | green, child and production | green | green | green | green | 4 clean weekly runs |

## 6. Data policy (one page)

### 6.1 The rules

| Rule | What it says | Method doc |
|---|---|---|
| One runner per service | Commons and Openverse: one runner on the machine, never parallel agents (a 429 hit four at once); Overpass at least 10 s apart; Wikidata one request at a time; Nominatim 1 a second; each under `flock /tmp/travel-<service>.lock`, user agent `travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)`, never an email | [DATA-ROADMAP](public-site/DATA-ROADMAP.md) 5; PLAN section 1 Sources |
| Links only | AllTrails, Google, Tripadvisor, Komoot, Gaia, Wikiloc, Strava are links, never values or coordinates; coordinates never come from Google | [research/README.md](../../../research/README.md); [sources-and-licences.md](../../../research/method/sources-and-licences.md) |
| Licences | photos: CC BY, CC BY-SA, CC0, public domain (NPS public domain for US parks); NC and the Unsplash and Pexels licences rejected (DD-3); credit strings kept as Commons holds them; tracks ODbL with the credit | [sources-and-licences.md](../../../research/method/sources-and-licences.md); [lanes/media.md](../../../research/method/lanes/media.md); [data/tracks/README.md](../../../data/tracks/README.md) |
| A gap is never a yes | every unanswered key is a dated `searched_none` (the date and the sources tried), shown as "Not checked yet"; texts that go stale carry a date | [capture-contract.md](../../../research/method/capture-contract.md) |
| Agent-checked is not person-checked | a point or fact compared with a second source by an agent is `agent_checked`; `person_checked` only when the owner or a named person confirmed it (R-47); no page, report or note says "verified" for agent work | capture-contract; `data/capture/points.json` review states |
| No household data | no party, ages, home town, dates, booking state or stay ideas in any public file, page, API body or Postgres public table; the home point only from the environment; the owner's list origin never revealed (PRIV1); `locations.json` collections and saves never seeded | PLAN section 1 Privacy; [catalogue-intake-and-storage.md](../features/catalogue-intake-and-storage.md) |
| Keep or drop | store a value only when it changes a decision, a display, a filter, a check or money, or proves or dates a stored value; facts for records a batch does not own go into a changeset; reasoning stays in the run note | catalogue-intake 2 |
| Writes through tools | trips through `node core/bin/ops.ts`; the store through `locations.py`; records through the capture commands; generated files rebuilt, never edited | CLAUDE.md folder contract; [research/README.md](../../../research/README.md) |
| Opus seat limits | one Opus research lane at a time; pause above 70% of the week's use; fills that follow a clear contract go to Sonnet, with an Opus 10-record sample review per split | PHASE-E-START usage rule; the coverage report 5 |
| Fields ledger (FL-0, R-235) | a new field names its reader and fill plan in its spec and gets a ledger row in the same commit; the check warns from FA-1 and fails after FA-4 | [AUDITS-AFTER-RELEASE.md](AUDITS-AFTER-RELEASE.md) 9 |
| Audit gates | every batch: the validators and the gap budget (4.1), the 10-value sample, the Opus sample; from B, the local cross-check (4.2); every bundle: the scoreboard (5); once: the field audit (v0.14.1, bundle F) and AU-D before MCP (bundle H) | this page; AUDITS-AFTER-RELEASE |
| Place budget | a data batch that adds bytes to place pages measures `budget:report` before and after and merges alone in its stack; in bundle C, data batches merge before PHO-R's re-baseline (RELEASE-PLAN 0a.3 row 4); Q290 below | MASTER-ORDER 4.5 |

### 6.2 Owner question

| ID | Question | Recommendation | Trade-off |
|---|---|---|---|
| Q290 | Research fills place pages, and the place-size budget (+25% median over each page's baseline, measured on catalogue content since BUD-1) counts every filled row. About 340 records will move from below usable to complete in bundles C to E. May a page's baseline be re-measured once, at the merge where a research batch takes its record from below the required tier to complete (the BUD-1 method, before and after in the hand-back)? | **Yes**, once per page, only for required-tier fills, never for a UI or renderer change | The budget then guards UI and renderer growth, not research growth; P8's list caps and light list rows still bound the data per row. Without it, the C batches use up the headroom the UI tasks need, and each batch needs its own owner ruling as Q88 did (ANSWERED 26 Oct 2026: yes, as recommended (the re-baseline rule: once per page, required-tier fills only; not the bundle-tag question of the same number in briefs-bundle-A 9).) |

## 7. Briefs for the new code tasks

**Common to every brief.** Worktree from the current `main`: `git -C /Users/nks/workspace/travel worktree add
/Users/nks/workspace/travel-wt/v2-<TASK> -b public/<TASK> main`, then `pnpm install --frozen-lockfile` and `cp -R
/Users/nks/workspace/travel/web/.og-cache web/`; the home point from `~/.config/travel-secrets/home-point.env` (Q261).
Read P1 to P9 and T1 to T5 in [principles.md](../design/foundation/principles.md) and cite them. **Must not touch:**
`HANDOVER.md`, `CLAUDE.md`, `legacy/**`, `web/app/themes.css`, `docs/v2/PLAN.md`, `EXECUTION-PLAN.md`, the applied
migrations, the root `.env.local`, another active lane's files (`git worktree list`). **Never:** write to Neon production;
print a connection string, key or the home point; call Overpass, Wikidata or Commons except through the one-runner lock;
put travel material in the Obsidian notes vault. **Verification (T1):** `pnpm --dir core exec tsc --noEmit` and
`pnpm --dir web exec tsc --noEmit` clean; the tests named in the brief; `python3 tools/tree_check.py --check` and
`python3 tools/relink.py check`; Playwright screenshots at 1440x900 and 390x844 in light and dark (theme set through the
site's control) of the pages named, saved outside `web/test-results/`, compared with `main`. **Commit:** stage only owned
paths with `git -C <worktree> add <paths>`, never `-A`; message `<area>(<TASK>): <what>` ending with the Co-Authored-By
trailer of the model that did the work; do not push or merge; the hand-back names the model and pastes the commands with
their exit codes.

### 7.1 TRK-1: the track fetcher for trails with capture records (data seat, Sonnet 6 h, Opus review 1 h; BACKLOG 15.264)

- **Goal.** Any trail with a capture record can get a `trail-track/1` file, without a prototype place: 109 trails have
  no geometry and 6 Quebec trails are withheld for want of one (P1: the fetcher must work for 10,000 trails, not 18).
- **Owns.** `web/scripts/tracks-osm.mjs`; `web/lib/public/tracks.ts` (lookup by capture ref and public slug, beside the
  prototype id); `data/tracks/README.md` (file naming and inputs keyed by ref); the `trail-track-inputs/1` schema for
  ref keys; tests under `web/tests/data/tracks*.test.ts` with offline fixtures.
- **Must not touch.** Any file in `data/tracks/` other than test fixtures (the runs are TRK-CA, TRK-DO, TRK-RW);
  `data/capture/**`; place components; the budget tests and baselines; `web/lib/public/honesty-overrides.ts`.
- **Steps.** 1. Select trails by capture route type `nature.trail.*` and their `links` of kind `osm`, in walking order;
  fall back to `inputs.json` by ref. 2. Name new files by the public slug from `data/catalogue/slugs.json` (stable; the
  18 existing files keep their prototype ids). 3. Keep every existing check: stitching, the 300 m trailhead and
  destination offsets, the 40% length check against the researched distance, `UNCONFIRMED_TRAIL_DATA`, `held_back`
  reasons, `start` overrides. 4. One Overpass request at a time under `flock /tmp/travel-overpass.lock`, at least 10 s
  apart, a local response cache; `--only <ref>` and `--dry-run`. 5. `web/lib/public/tracks.ts` resolves a trail's file by
  ref or slug.
- **Acceptance.** Tests (offline fixtures, no network): a capture-only trail gets a file; a wrong relation stays held back
  with its reason; re-running from the cache leaves the 18 existing files byte-identical; a trail in
  `UNCONFIRMED_TRAIL_DATA` stays unconfirmed. `--dry-run` over the Rockies lists 67 candidates and their relation ids
  without a network call when the cache is warm. Screenshots of `/places/tre-cime-di-lavaredo-loop/` and `/places/peyto-lake-lookout/` unchanged at 1440 and 390, light and dark. Opus review of the
  matching rules. `budget:report` unchanged (no new file is written by this task).
- **Commit.** `tools(TRK-1): track fetcher for trails with capture records`.

### 7.2 DV-1: the database cross-check (data seat, Sonnet 5 h, Opus review 1 h; BACKLOG 15.271)

- **Goal.** One read-only command proves a target database equals the files of a commit (section 4.2 X2 to X6, X9), so
  every load and every week ends with evidence, not a hash alone (P9: the store boundary holds the same data on both sides).
- **Owns.** `core/src/catalogue/postgres/verify/**` (new: field compare, counts, orphans, grant probes, exposure set);
  a `crosscheck` subcommand in `core/bin/db-seed.ts` (after RIS-L merges; one author at a time); the `db:crosscheck` line in
  the root `package.json`; tests under `core/test/catalogue/crosscheck*.test.ts`; one line in `tools/db/drift-check.sh`
  (after CAT-V merges) and in `tools/db/rehearse.mjs` (after LOCAL-5 merges) to call it.
- **Must not touch.** Migrations; the seed builders of RIS-L; `web/**`; any `data/**` file.
- **Steps.** 1. Build the expected rows from the files with the same code `db:seed` uses. 2. Read every row of each
  seeded table inside a read-only transaction; compare column by column (normalised jsonb, numbers by value, points to
  1e-7 degrees); report the first 20 differences. 3. Counts per table and per family; read `seed_commit` and the last
  `load_run`. 4. One orphan query per relation listed in the seed contract. 5. Connect as `travel_app` (role switch on
  local and the child; on production a read-only probe through the target resolver) and probe each public and private
  table and the three protected columns. 6. The exposure set as RIS-T case 7. 7. Write `seed-crosscheck/1` JSON (no
  connection string, no row content beyond refs and column names).
- **Acceptance.** On a seeded local database: green. A planted `update` of one field fails X2 naming the table, ref and
  column; a deleted area parent fails X4; a granted `meta` column fails X5; a private-trip record marked `published` fails
  X6. The command refuses to write (asserted read-only transaction). A sentinel test finds no connection string in output
  or file. Run time under 60 s on the full seed locally. Opus review of the comparison rules. No page changes, so the
  screenshots of `/`, `/places/moraine-lake/` and `/trips/canadian-rockies-2029/` are a regression check only.
- **Commit.** `core(DV-1): database cross-check against the files of a commit`.

### 7.3 DV-2: page-level parity spot checks (data seat, Sonnet 3 h; BACKLOG 15.272)

- **Goal.** After a sync, a sample of what visitors see equals what Postgres holds (section 4.2 X7), so a loader that
  agrees with itself but not with the site is caught.
- **Owns.** `tools/db/page-parity.mjs` (new), its test under `tools/tests/`, the `db:page-parity` line in the root
  `package.json`, one call in `tools/db/drift-check.sh` (sample 10 weekly) after DV-1's line.
- **Must not touch.** `web/**` (it reads pages and `/api/v1` over HTTP only), `core/src/**`, `data/**`.
- **Steps.** Pick 20 refs stratified by kind and trip with a seed from the commit (repeatable); fetch the deployed page
  and `/api/v1` body at a gentle rate (one request a second); read the same refs from the target read-only; compare name,
  area path, point (5 decimals), the facts strip values, photo credit and status; write the result beside CAT-V's.
- **Acceptance.** Against a local `next start` and the local database: 20 of 20; a planted difference in one record's
  distance fails naming the ref and field; the run never sends more than one request a second; no secret in output.
- **Commit.** `tools(DV-2): page-level parity spot checks`.

Research tasks (D10 splits, TRL-REL, OFR-1, STO-1, OVT, the TRK runs) use the DATA brief and prompts in
[briefs/DATA.md](public-site/briefs/DATA.md) and [briefs/DATA-AGENT-PROMPTS.md](public-site/briefs/DATA-AGENT-PROMPTS.md),
with the scope of their row in 2.1, the 4b completion standard of DATA-ROADMAP, the gates of 6.1, and the Rockies-first
order. Each split owns only its trip's lane files and sidecars; `points.json`, `gap-budget.json` and
`data/sources/registry.json` have one writer at a time (the data seat), and the coordinator regenerates the registry at
merge.

## 8. Gotchas

- **Two lanes for Utah.** Four D2b Utah-park records live in `data/capture/usa-southwest-rockies/`; per-trip counts add both.
- **The report's 29 h excluded the Opus sample reviews and the fetcher.** The plan carries them (2.1).
- **D10 and the towns layer.** A split that adds a point in a new admin-1 rebuilds the towns layer; never beside REQ-RF.
- **Track files are named two ways** after TRK-1: the 18 old files by prototype id, new ones by public slug. Never rename
  the old ones (their ids are in `UNCONFIRMED_TRAIL_DATA` and the place pages).
- **Research fills move the place budget.** Measure, merge alone, and Q290.
- **The cross-check reads every row.** On production it counts toward Neon's 5 GB monthly transfer; weekly plus one per
  bundle is about 450 MB (CATALOGUE-EARLY 8).

## Change log

| Date | Change |
|---|---|
| 2026-10-28 (LT-C) | Section 2.5: LT-C done on branch `lt/LTC` (contract, families, `gaps --family`, `gaps --promote`, phase-1 marks, basics layers and the drift report); budget unchanged. Next LT-WHERE, then LT-1 |
| 2026-10-28 (LOCTYPE) | Banner; section 2.5: research requirements by location type (address, generated map links, required link kinds, nine families, the ratchet); rows 72 to 78 (LT-WHERE, LT-AP, LT-1 to LT-4, LT-RAT; 27 h, D 11 and E 16) and code tasks LT-C and LT-M (14 h, Infra). [features/location-type-requirements.md](../features/location-type-requirements.md); BACKLOG 15.391 |
| 2026-10-28 (S2-DATA) | Banner; section 2.4: DG-01 to DG-13 moved here from `design/step2/data-gaps-2026-10-28.md` (now a pointer), each mapped to an existing task or new rows 64 to 71 (S2D-SIZE, S2D-PTS, S2D-IND, S2D-LEG, S2D-SUIT, S2D-TIME, S2D-BOOK, S2D-VER; 18.5 h, bundle D), dependencies, and batches S2-A to S2-C. BACKLOG 15.390 |
| 2026-10-27 (BUILDER-DEPS) | Banner; 2.1 rows 51 to 63 and the totals sentence; 2.2 seat 1 additions and data seat 2. [builder-dependency-map.md](builder-dependency-map.md) |
| 2026-10-26 (ALIGN, evening) | Banner; rows 3, 10, 12, 15 marked done; rows 45 to 50 (UXB-W, EG-M, EG-D, PA-R-CA, PA-MUS, PA-R-ON); totals 194 h; 2.2 rewritten to MASTER-ORDER 5.4 (lane S at the head of C's window; D10 splits and D8-R facts pulled into C; PM-G built in this seat). [alignment-2026-10-26.md](alignment-2026-10-26.md) |
| 2026-10-26 (ANSWERS-5) | Section 2.3 rewritten: D1B-Q 1 to 5, Sepaq fees, DD-3, Q99, Q109 to Q116, DD-6 and Q290 answered as recommended; the tasks that waited on them are ready; the values still needed (Siusi, Grand-Sault, Utah, Norway and Peru dates, Dolomites base split, Switzerland pass) point to MASTER-ORDER 7.3. Nothing else changed |
| 2026-10-26 | First version (PLAN-CONSOLIDATE job 3, planned only): state from the coverage report; every pending data and research task in one order with hours, blockers, owner decisions, bundle and seat row; the 384 draft records by trip and kind; the seat schedule by window with capacity; owner decisions by the bundle they unblock; the load and verify pipeline; the database cross-check X1 to X9; the scoreboard and its targets per bundle; the data policy; briefs TRK-1, DV-1, DV-2; Q290. New tasks: TRK-1, TRK-CA, TRK-DO, TRK-RW, D10 splits, TRL-REL, OFR-1, STO-1, OVT, DV-1, DV-2 |
