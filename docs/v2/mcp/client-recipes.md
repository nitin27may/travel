# Client recipes: worked sessions, call by call

Each recipe shows the user's request, the calls a well-behaved client makes, and what it tells the
user. Arguments are abbreviated (`…`) where they repeat earlier pages. These recipes double as
acceptance tests for M0-M5: each should run end to end against a seeded database.

Last verified 25 Oct 2026 against main f2dee4b. Recipes 1 to 10 use the target tool set of [README.md](README.md) and
need the planner; none of them runs today. Section 0 is how to connect now and after the sign-in tasks of
[auth-and-sign-in.md](auth-and-sign-in.md).

## 0. Connecting a client (current setup)

| Surface | Works | How |
|---|---|---|
| Local stdio (owner) | **today** | Claude Code in the repo root loads `.mcp.json` (`node core/bin/mcp.ts`); no credential. Check with `/mcp` in Claude Code, or `npx @modelcontextprotocol/inspector node core/bin/mcp.ts` |
| Public remote, no sign-in | after MCP-1 and a production deploy | Claude Code: `claude mcp add --transport http travel-public https://travel-beta-tan.vercel.app/mcp/`. claude.ai: Settings, Connectors, Add custom connector, the same URL, no authentication |
| Private remote, OAuth | after MCP-O, O-M2 and MCP-E | claude.ai or Desktop: add a custom connector with `https://travel-beta-tan.vercel.app/mcp/private/` and leave the client id empty (Claude identifies itself with its metadata document); sign in on our page, choose what it may do, Allow. Claude Code: `claude mcp add --transport http travel https://travel-beta-tan.vercel.app/mcp/private/`, then `/mcp` and Authenticate (a loopback browser sign-in) |
| Private remote, personal access token | after MCP-T and MCP-2 | create a token on `/account/` (Access tokens), store it in your shell's secret store as `TRAVEL_PAT`, then `claude mcp add --transport http travel https://travel-beta-tan.vercel.app/mcp/private/ --header "Authorization: Bearer $TRAVEL_PAT"`. Never paste the token into chat or commit it; in a shared `.mcp.json` use an environment reference, not the value (check that your Claude Code version expands `${TRAVEL_PAT}` in headers) |
| Local development of the remote routes | MCP-0 onward | `npm run dev` in `web/`, child branch values only, `http://localhost:3000/mcp/` and `/mcp/private/`; the MCP Inspector at `http://localhost:6274` is on the origin allowlist |

Use the trailing slash in every URL above: the site redirects `/mcp` to `/mcp/`, and the OAuth resource must match the
URL exactly. A Vercel preview URL does not work for MCP (Vercel Authentication blocks clients).

---

## 1. A family plans 4 days in Banff

> "Plan 4 days in Banff for us in mid-September. Kids are 9 and 6. Nothing over 8 km."

1. `household {action:"get"}` → home Whitby, party of 4 (Adult 1, Adult 2, Child 1 (9), Child 2 (6)), pace balanced, avoid "unfenced cliffs".
2. Ask: "Which dates exactly, and are you flying into Calgary?" → "15-19 Sep 2029, yes."
3. `list_templates {area:"banff-national-park", month:9, nights:{min:3,max:5}, party:{ages:[42,40,9,6]}}` → "Banff family 4 nights (curated), fit: good".
4. Offer it. User: "Show me." `fork_template {template:"tpl_banff_family4", start_date:"2029-09-15", mode:"preview"}` → outline, to-book list (Moraine shuttle, Banff Gondola), warning "Johnston Canyon upper falls 5.2 km: OK".
5. User: "Swap the gondola for something free." `search {for_trip:… , q:"viewpoint", filters:{cost_band_max:0}, area:"banff-town"}` → Surprise Corner, Tunnel Mountain summit (4.3 km, fits).
6. `fork_template {…, mode:"apply", preview_id:"prv_…"}` → trip created.
7. `edit_trip {ops:[{op:"remove_item", item:"itm_gondola"}, {op:"add_item", entity_id:"ent_tunnel_mtn", to:{day:2, after:"itm_lunch"}}]}`.
8. `check_trip` → all days ok; one warning "Day 3 drive 2 h 10 with nothing to break it" with fix "add Castle Mountain lookout at 55 min" → user accepts → `edit_trip` with the fix ops.
9. Tell the user: the trip URL, "2 things to book: Moraine Lake shuttle (seats open 15 Apr 2029 08:00 MT, sells out in minutes), Johnston Canyon parking needs nothing." `reservations {action:"add", items:[{kind:"activity", status:"to_book", title:"Moraine Lake shuttle", offer_id:"off_moraine_shuttle"}]}` → reminders scheduled.

## 2. Pasting an Air Canada confirmation for four

> (pastes the e-ticket email) "Add this to the Dolomites trip."

1. `list_trips` → Dolomites 2027 (trp_dolo27).
2. Extract: AC 892 YYZ 18:30 Mon 12 Jul → VCE 09:05 Tue 13 Jul; AC 893 VCE 11:50 Mon 26 Jul → YYZ 15:10; four passengers with seats; booking reference; total CAD 5,412.36; Terminal 1.
3. Map passengers: the email names four people; the client asks "Is SINGH/KAI MSTR the 9-year-old (Child 1)?" → yes.
4. Shows a summary; user confirms.
5. `reservations {action:"add", items:[{kind:"flight", … segments:[…], travellers:[…], secret:{confirmation:"…"}}]}` (example in tools-reservations.md). If the token lacks `reservations:read`, it omits `secret` and says "Add the booking code in the app; I didn't save it."
6. Reports: anchored on day 1 and day 15; tasks "Check in online (opens 11 Jul 18:30 Toronto time)", "Save boarding passes"; warning "Day 1 plans start after 10:05 (landing + 60 min)".

## 3. Adding a hotel the user booked

> "We booked Hotel Ambra in Ortisei for 13-16 July, breakfast included, free cancellation until 6 July, €620 total, pay at the hotel."

1. `search {q:"Hotel Ambra", kinds:["stay"], area:"val-gardena"}` → found `ent_ambra` (or not: then a custom stay with address).
2. `reservations {action:"add", items:[{kind:"stay", title:"Hotel Ambra, Ortisei", entity_id:"ent_ambra", status:"held", price:{total:620, currency:"EUR", payment:"pay_later"}, cancellation:{refundable:true, free_until:"2027-07-06T23:59", policy:"free until 6 Jul"}, segments:[{start:{local:"2027-07-13T15:00", tz:"Europe/Rome"}, end:{local:"2027-07-16T10:00", tz:"Europe/Rome"}, from:{entity_id:"ent_ambra"}}], details:{breakfast:true}}]}`.
3. Reports: nights 1-3 now based in Ortisei; day routes start there; task "Last day to cancel free: Tue 6 Jul" with reminders 3 Jul and 6 Jul; warning "Night 4 (16 Jul) has no stay".
4. Asks whether the user wants to note where night 4 is.

## 4. "Remind me to book the Moraine shuttle"

1. `get_trip {trip:"…rockies…", include:["reservations"]}` → no shuttle yet.
2. `search {q:"Moraine Lake shuttle", kinds:["activity"]}` → `get` the entity with `offers` → offer `off_moraine_shuttle`: window rule `fixed_date` pattern "mid-April 08:00 MT, 40% of seats; rest 48 h before", sellout "minutes", read 2026-10-12.
3. `reservations {action:"add", items:[{kind:"activity", status:"to_book", title:"Moraine Lake shuttle (4 seats)", offer_id:"off_moraine_shuttle"}]}` → `book_by` computed; tasks and reminders: 7 days before, the evening before, 15 minutes before, at opening, "did you get it?" 2 h after.
4. Tells the user the exact opening time in Mountain and Eastern time, and that the 2029 date follows the 2026 pattern and must be re-checked in early 2029 (a backlog item is created by the server for the offer's freshness).

## 5. The owner researches El Chaltén trails

1. `research_brief {scope:{area:"el-chalten"}, lanes:["trails"]}` → 2 known trails, gaps (trailheads, parking), 1 conflict, OSM candidates (8 routes).
2. Read `lane://trails`, `rules://sources`, `vocab://difficulty`.
3. `start_job {scope:{area:"el-chalten"}, lanes:["trails"], purpose:"Patagonia 2027"}`.
4. For each trail: official park page (Parque Nacional Los Glaciares / APN), the municipal trail map, OSM relation for geometry and gain, then community reports only for current conditions. Create trailhead entities first (`ref`), then trails pointing at them.
5. `propose` in two batches (trailheads + 8 trails; then offers: none needed, entry free; relations `alternative_to` for bad-weather days).
6. `submit_job {summary:"8 trails, 3 trailheads; distances official for 6, OSM for 2", gaps:[{lane:"trails", what:"no official gain for Loma del Pliegue Tumbado", tried:["…"]}]}`.
7. In the app (or `review_queue` + `decide`), the owner accepts; coverage for trails turns "usable".

## 6. The owner bulk-adds 40 Ontario day-trip places

1. The owner pastes the 40-row table from `research/vault-notes/Day Trips Local.md` (name, town, type, cost, best season).
2. `bulk_import {rows:[…40…], resolve:true, default_source:{url:"…", publisher:"owner notes", kind:"community"}, dry_run:true}` → 34 resolved, 3 matched existing (Elora Gorge, Rockwood, Warsaw Caves already in the catalog from `locations.json`), 2 ambiguous ("Rockwood" CA vs village), 1 unresolved.
3. Client asks the owner about the ambiguous ones, fixes them, runs again without `dry_run` → one changeset with 37 creates.
4. `review_queue {changeset_id}` → owner bulk-accepts the suggested ones; facts with only `community` evidence stay `unverified` until a later refresh lane adds official sources (backlog items created per place for hours and fees).

## 7. Adapting the Rockies 14-night template to 10 nights in late June with a 6-year-old

1. `list_templates {area:"canadian-rockies", curated_only:true}` → "Canadian Rockies 14 nights (Sep)", nights range 10-16, valid months 6-9.
2. `adapt_trip {source:"tpl_rockies14", start_date:"2029-06-20", nights:10, travellers:["household:all"], mode:"preview"}`.
3. Preview (see tools-templates.md): 4 days cut in cut order (Jasper rest day, Kananaskis day 2, Yoho repeat, Calgary buffer); Larch Valley replaced (larches not in June; child over gain limit); Plain of Six Glaciers flagged (snow into July); Athabasca ice walk unresolved (min age 8); Moraine shuttle window "already open for June dates".
4. The client explains, asks "Keep the Maligne Lake cruise as a must?" → yes → `adapt_trip {…, keep:["ent_maligne_cruise"], mode:"preview"}` again.
5. Apply; `check_trip`; list to-book items with deadlines; user gets the URL.

## 8. Conditions check the week before Algonquin

1. `conditions-check` prompt with `trip:"algonquin-muskoka-oct-2026"`.
2. `get_trip {days:[1,2,3]}` → Solitaire Lake trail (afternoon), Track and Tower 08:00, Ragged Falls, Dorset tower.
3. `weather` forecast for Dwight and Algonquin Hwy 60 km 25; `sun` for 10-12 Oct.
4. Day 2 rule "if gusts > 50 km/h at 08:00, switch to Plan B": forecast gusts 35 → go.
5. Official checks: Algonquin day permit sales (opens 5 days ahead: Tue 6 Oct), trail closures page, Dorset tower hours. A closure found → trip note (or `propose` if the owner).
6. Verdict per day; offer `edit_trip` for any swaps; remind "buy the Sunday day permit today".

## 9. Share day 3 with the grandparents for 48 hours

> "Send Mum and Dad our plan for Thursday, just that day, for a couple of days."

1. `get_trip {trip:"…dolomites…", days:[3]}` → day 3 is Thu 15 Jul (Seceda ridge, lunch at a hut, Ortisei evening); `shares: []`.
2. The client reads back: "I'll make a read-only link to Thursday 15 July only: the timeline, the map and the hotel's name. No booking details, no notes, no ages. It stops working on Sat 17 Jul at 09:00. Add a PIN?" → "Yes, 2468."
3. `share {action:"create_link", trip:"…", confirmed_by_user:true, link:{scope:"day", target:{day:3}, audience:"guest", expires_at:"2027-07-17T09:00:00+02:00", pin:"2468", label:"Grandparents", include:{times:true, map:true, stays:"name_only", reservations:"none", notes:false}}}`.
4. Output `url: https://app.<domain>/s/k7…`, `shows: [day 3 timeline, map, stay name]`, `hides: [notes, reservations, people]`.
5. The client gives the link and the PIN separately, and mentions it can be revoked any time (`share {action:"revoke_link"}`); the trip's activity feed shows "Claude created a guest link for day 3 (Grandparents), expires Sat 09:00".

## 10. A partner adds a restaurant booking from a phone chat

> "We got a table at Ristorante X in Ortisei on the 14th at 19:30 for four."

1. `list_trips` → Dolomites. 2. `reservations {action:"add", items:[{kind:"restaurant", title:"Ristorante X", segments:[{start:{local:"2027-07-14T19:30", tz:"Europe/Rome"}, from:{label:"Ristorante X, Ortisei"}}], details:{party_size:4}}]}` → anchored on day 2 evening; check warns "Seceda hike ends 18:40, 25 min away: fits".
3. The other parent, who has the trip open in the app, sees it appear live (op broadcast) with "added by Priya via Claude".
