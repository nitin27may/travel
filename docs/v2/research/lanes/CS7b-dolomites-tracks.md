# CS7 batch 2: Dolomites trailheads, OSM relations and gains (backlog 3.28, 3.29, 3.30, 3.38)

Read on 19 Oct 2026 by travel-researcher (Opus). Overpass calls ran one at a time under `/tmp/travel-overpass.lock` (run record
`data/capture/runs/api-2026-10-19-cs7b-overpass.json`). Pages were one-page reads. Every point and relation is "agent checked, needs
a person's check".

## 3.38 Trailhead pins: reviewed, none moved

The pins live in the prototype snapshot (`web/data-snapshots/prototype.json`, `access.<id>.trailhead`), which this lane may not
edit. Each one was compared with OSM parking, lift stations and the line of its relation. Distances were computed on 19 Oct 2026.

| Trail | Pin (lat, lon) | Nearest OSM feature | Pin to feature | Pin to nearest vertex of the line | Line end nearest the pin | Verdict |
|---|---|---|---|---|---|---|
| vallunga | 46.56395, 11.77359 | way 255994108, parking "Val - Langental - Vallunga" | 57 m | 4 m | 1,614 m | pin right; path 14 starts in Selva and runs on past the valley to Forcella de Crespëina |
| federa | 46.50584, 12.07888 | node 2444691902, parking | 33 m | 2 m | 1,426 m | pin right; path 437 runs both ways from the Giau road |
| munkel | 46.63567, 11.76576 | node 13961868401, parking (Zanser Alm) | 145 m | 1,431 m | 1,625 m | pin right; the walk climbs path 6 to the Munkel Weg (the snapshot note says so) |
| fiscalina | 46.66684, 12.35448 | way 98002215, parking (fee=yes) | 101 m | 47 m | 1,702 m | pin right; path 102 runs on to the Tre Cime |
| fanes-falls | 46.60263, 12.10671 | relation 11641747, "Parcheggio Sant'Uberto" | 25 m | 325 m | 500 m | pin right; the official walk starts at Pian de Loa, past the closed road from Sant'Uberto |
| cinque-torri | 46.51839, 12.03797 | way 900787870, parking (fee=no) at Bai de Dones | 64 m | 1,292 m | 1,411 m | pin right by design: the chairlift base; the loop is at the top |
| lagazuoi | 46.52751, 12.00892 | node 360633381, "Funivia Lagazuoi" top station | 0 m | 212 m | 509 m | pin right; the relation is the wrong route (see 3.30) |
| pordoi | 46.50028, 11.80775 | node 29916900, "Sass Pordoi" station | 0 m | 189 m | 1,412 m | pin right; path 627 also covers the climb from Passo Pordoi, which the plan rides |
| puflatsch | 46.55184, 11.61718 | node 625195493, "Puflatsch - Bullaccia" station | 0 m | 48 m | 773 m | pin right; a loop that passes the station, and its ends are elsewhere |
| siusi | 46.54236, 11.617 | node 102561714, "Seiser Alm - Alpe di Siusi" station | 0 m | 1,074 m | 1,074 m | pin right; relation 9485181 (path 12 from Seis) is the wrong route |
| nuvolau | 46.48248, 12.05386 | way 235300440, parking at Passo Giau | 37 m | 2,594 m | 2,594 m | pin right; relation 15791396 ("436 Sentiero delle Trincee") is the wrong route |

**Finding.** None of the 11 pins is at fault. Each sits within 150 m of the OSM car park or lift station it names. The held-back
check measures from the pin to the nearer *end* of the line. That fails whenever the walk starts part way along a long relation
(vallunga, federa, fiscalina, puflatsch, pordoi, lagazuoi: the pin is within 212 m of the line) or reaches it by another path
(munkel, fanes-falls, cinque-torri). Three relations are the wrong route (lagazuoi, siusi, nuvolau). Moving the pins to the line
ends would put them at the wrong place, so they were left. The fix is in `web/scripts/tracks-osm.mjs` (hand-back): measure to the
nearest point of the line, and cut the line at the pin and at the destination.

## 3.28 The intended OSM relations

| Trail | Stored relation(s) | Intended | Source of the route |
|---|---|---|---|
| tre-cime | 1116663 (101) and 1657833 (104, "sopra Rifugio Lavaredo" to Forcella Pian di Cengia) | 101 (relation 1116663) from Rifugio Auronzo by Rifugio Lavaredo to Forcella Lavaredo, then 105 (relation 1067603, to "rif. Auronzo, parcheggio ovest") by the Lange Alm back to the start. Path 104 is not on the loop. Both relations run far past the loop (101 on to Rifugio Lunelli, 105 from San Candido), so each needs cutting. | suedtirol.info "Summer walk around the Drei Zinnen": "trail no. 101", "trail no. 105 to the Lange Alpe hut", 8.8 km, 550 m up, a loop |
| vallunga | 2465034 (14) | 2465034, cut at the head of the valley: the valley walk tops out at 1,817 m; the relation climbs on to 2,866 m | valgardena.it: trail no. 14, 7.5 km, 200 m, highest point 1,817 m, back the same way |
| munkel | 2442695 (Adolf Munkel Weg) | path 6 (relation 6528382) from the Zans car park, the Munkel Weg (2442695), then path 28 (relation 2442693) down to Ranui; trail 35 is relation 2411662 | odlesdolomites.com: "Trail numbers: 6, 35, 28", start Zans car park |
| nuvolau | 15791396 ("436 Sentiero delle Trincee") | 443 (relation 3197403), 439 (relation 3170143), 464 (relation 15791397) and 452 (relation 2261100), each cut to the part between Passo Giau, Rifugio Averau and Rifugio Nuvolau | cortina.dolomiti.org "To Rifugio Nuvolau": paths 443, 439, 464, 452, 9.8 km, 612 m, from and back to Passo Giau |
| sorapis | 3985745 (215) | 3985745, cut at Lago di Sorapis (1,926 m); the relation climbs on to 2,672 m | cortina.dolomiti.org "To Lago Sorapis": path 215, back the same way |
| lagazuoi tunnels | 2282556 (Kaiserjäger Steig) | none found: no OSM relation for the Galleria del Lagazuoi (`searched_none` on the record) | Overpass, relations within 250 m of the top station |
| siusi | 9485181 (path 12) | not decided: the record does not say which plateau walk it is; the Compatsch relations are paths 4, 10, 14, 14B, 30 and the Hans und Paula Steger Weg | owner question |

## 3.29 Gains re-checked

| Trail | Stored | Track | Official, re-read 19 Oct 2026 | Result |
|---|---|---|---|---|
| fanes-falls | 249 m, `official_info` | 808 m | cortina.dolomiti.org: 7 km, 249 m up, 253 m down, from Pian de Loa and back | stored figure confirmed; path 10 runs on to the Fanes plateau (2,103 m) |
| vallunga | 200 m, `official_info` | 1,398 m | valgardena.it: 7.5 km, 200 m up and down, highest point 1,817 m | confirmed (the page is the winter listing; suedtirol.info's summer listing gives 6 km) |
| monte-piana | 600 m, `our_inference` (the plan's outing with the plateau loop) | 519 m | dreizinnen.com tour 22272: 3.9 km, 368 m up, 30 m down, one way to the Bosi hut | official one-way figure added as a conflict; the stored value covers more than that tour |
| sorapis | 550 m, `our_inference` (midpoint of trail reports) | 1,388 m | cortina.dolomiti.org: 10.5 km, 434 m up, 437 m down, 4 h, For Experts, out and back | official 434 m and 10.5 km added as conflicts; the stored 550 m is a pre-migration value (see below) |

The migration ledger pins every pre-migration leaf, so the stored Sorapis 550 m and 12.6 km cannot be replaced. The official
figures are stored as conflicts with `official_info` and the reason. Owner question: allow a `supersedes` override, so an official
re-read can become the shown value without breaking the ledger.

## 3.30 Capture links

`links` entries of kind `osm` (state `filled`) were added to 14 Dolomites route records in `migrated.json`, with the intended
relations from 3.28 (two for the Tre Cime loop, three for the Munkel Weg). The Lagazuoi tunnels and the Alpe di Siusi got
`searched_none` with the query. Rifugio Nuvolau has no capture record, so its relations are only in the table above.

Two code gaps (hand-back): `osmRefsFromCapture` in `web/scripts/tracks-osm.mjs` reads `links.osm` as a string, but capture
`links` is a list of `{kind, url}`, so it finds none of these; and track files are not lane files, so `sources.ts build` does not
register their sources.
