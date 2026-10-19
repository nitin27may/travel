# CS7 batch 1: Dolomites 2027

Read on 18 Oct 2026. Records in `data/capture/dolomites-2027/CS7.json`. Blockers shared by every CS7 file are listed in
[CS7-canadian-rockies-2029.md](CS7-canadian-rockies-2029.md).

## Backlog row: Tre Cime

Done: Tre Cime di Lavaredo (`nature.landform.mountain`, Q1257207), the north-face viewpoint by Locatelli (OSM viewpoint node
12091634369, unnamed, 160 m from the hut), Rifugio Auronzo (Q681466), Rifugio Lavaredo (Q3935531), Dreizinnenhütte / Locatelli
(Q1258258), a lodging offer per hut, the toll road (OSM way 25487506, point at the toll booth node 277726434), the Auronzo car park
(OSM way 74709399, lots P1 to P4) and the toll as a timed-entry offer. The loop now `starts_at` Auronzo, `passes` Lavaredo and
Locatelli and `reaches` the viewpoint and the mountain. It keeps `route_is_attraction` (spec example 4); the world draw moves to the
mountain and the viewpoint when a relevance edit is allowed.

## Values for the verifier's sample

| Record | Value | Source |
|---|---|---|
| Tre Cime toll | 40 EUR car, 26 EUR motorcycle, 60 EUR caravan or motorhome ("Prezzi 2026"); ticket valid 12 h from the booked entry; online booking mandatory, no walk-up; free cancellation to 23:59 five days before | auronzo.info car-park page (Comune di Auronzo) |
| Tre Cime toll window | release lead time not published: `searched_none`, operator question | same |
| Rifugio Lavaredo | 120 EUR per person per night, half board, shared room of 4-6 (no year on the page) | rifugiolavaredo.com |
| Dreizinnenhütte | season 28 Jun to 28 Sep 2025 (pattern); booking opens at the start of the year | dreizinnenhuette.com |
| Lago di Braies P4 | 40 EUR per vehicle per day incl. a 16 EUR meal voucher; booking needed only in the restricted summer hours (09:00-16:00) | pragsparking.com (operator of the lot) |

## Lakes and payoffs

Parking (OSM) for Braies (P4), Carezza (visitor-centre lot), Landro, Antorno, Dobbiaco and Misurina. OSM `charge` tags (Carezza, Antorno,
Dobbiaco) are hints, not prices, and were not stored. Payoff links: the tourism board where no land-manager page was found (Croda del
Becco, Fanes, Bullaccia), `official` `searched_none`; Seceda's is the lift operator's page. Piz Boè: only winter photos within 400 m.
