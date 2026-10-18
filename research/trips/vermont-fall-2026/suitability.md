# Suitability and relevance pass, Vermont fall (lane R6)

Researched 18 Oct 2026 by travel-researcher. Files:
- `data/suitability/vermont-fall-2026/R6.json` (6 records)
- `data/relevance/vermont-fall-2026/R6.json` (6 records)
- `data/suitability/kind-map.json`: Stowe Recreation Path changed from `trail/hike` to `trail/walk`, with the reason.

## What was checked

| Source | Used for |
|---|---|
| gostowe.com Stowe Recreation Path (opened) | 5.3 mi paved, mostly flat, open all year, leashed dogs, four parking areas |
| vtrans.vermont.gov/notch (opened) | 40 ft single and 45 ft combination vehicle ban, fines from $10,000; no closure dates |
| vermontpublic.org (search result, 2023) and other press | the Notch closes each winter, dates vary |
| fpr.vermont.gov Darling State Park (opened) | CCC toll road, 3,500 ft summit, 1912 fire tower |
| skiburke.com area activities (opened) | toll road subject to closures for private events; tower 360 degree view |
| northstarmonthly.com toll road article | HTTP 429; not read |
| montgomeryhistoricalsociety.org (search result) | six covered bridges in town plus one on the Enosburg line |
| Wikidata (search, then coordinates checked) | QIDs below |

## Findings

1. **No hard limits anywhere.** None of the six stops has an operator or land-manager age, height or weight rule.
2. **The Smugglers' Notch rule is about vehicles**: single vehicles over 40 ft and combinations over 45 ft are banned, fines from $10,000. VTrans publishes no fixed closure dates; the season window in the record is from press reports (`community`, flagged by `W_SUIT_COMMUNITY_ONLY`).
3. **Stowe Recreation Path is paved and mostly flat** on the tourism board's page, so `stroller: smooth` is `official_info`. `wheelchair` stays `searched_none`: no accessibility statement was found, and `step_free` needs one.
4. **The trip's "Covered bridge loop" sits on the Cabot and Peacham day in the summary trip**, but the plan's covered-bridge loop is Montgomery on the drive home. The record uses Montgomery and carries a hint.

## Open conflicts

| Record | Field | Conflict |
|---|---|---|
| Burke Mountain overlook | access | trip research gives $5 per carload, 08:00-17:00 (press) against $10 (an older blog); neither re-read |
| Covered bridge loop | count | "more covered bridges than any other town in the country" (plan) is not supported by the historical society's own count of six plus one |
| Smugglers' Notch | season | press dates only; VTrans states none |

## Applicability questions

- **Smugglers' Notch** is mapped as a `viewpoint`, but it is a pass driven through. The `drive` profile (`vehicle_limits`, `road_surface`, `drive_min`) fits the published facts better; the vehicle ban had to go into `hazards`. Recommended: change it to `drive/scenic_drive` in kind-map.json after a review.
- **Burke Mountain overlook** is reached by a toll road; as a viewpoint the road season sits in `access_season`, which is right, but the toll road's own facts (`vehicle_limits`, surface) have no home on the viewpoint profile.

## Operator questions (for the owner to send, Q14)

| To | Contact | Question |
|---|---|---|
| Burke Mountain Resort (toll road) | 802-626-7300 | 2027 toll road season, hours and fee; distance from the summit lot to the fire tower; is the summit area step-free? |
| Vermont State Parks (Darling State Park) | 802-828-1534 | Is the fire tower climb open to children; is the top railed? |
| Stowe Recreation | stowerec.org | Is the path rated accessible for wheelchairs along its whole length; any steep sections? |
| VTrans | vtrans.vermont.gov | Typical closing and opening dates for VT-108 through the Notch |
| Town of Montgomery | town office | Posted clearance and weight on each covered bridge; which bridges are open to cars |

## Records and levels

| Record | Profile | Level | Notes |
|---|---|---|---|
| Covered bridge loop (Montgomery) | drive | Usable | access season, vehicle limits `searched_none` |
| Hyde Park village | town | Usable | wheelchair `searched_none` |
| Peacham village | town | Usable | wheelchair `searched_none` |
| Stowe Recreation Path | walk | Usable | gain, wheelchair `searched_none` |
| Burke Mountain overlook | viewpoint | Usable | stroller, wheelchair, access season, walk_m `searched_none` |
| Smugglers' Notch | viewpoint | Usable | season is community only |

6 of 6 Usable, 0 Complete.

## Relevance

| Record | QID | Draw | Standing | Distinction | Class | draw_suggested |
|---|---|---|---|---|---|---|
| Covered bridge loop | searched_none | regional | top | rare | drive/scenic-parkway | local (no signals fetched) |
| Hyde Park village | Q9005587 (the village; the town is Q2051042) | local | ordinary | common | town/historic-village | local |
| Peacham village | Q108940081 (the village CDP; the town is Q1949894) | regional | top | rare | town/historic-village | local |
| Stowe Recreation Path | Q7620698 (no coordinates on Wikidata) | regional | top | rare | trail/riverside | local |
| Burke Mountain overlook | Q4998953 (not the North Carolina Q31619083) | regional | good | common | viewpoint/summit-panorama | local |
| Smugglers' Notch | Q7546619 (the state park; the search returns the ski resort Q7546617 first) | regional, peak national 25 Sep - 15 Oct | good | rare | drive/mountain-pass | local |

Designations: Darling State Park and Smugglers' Notch State Park, both `scope: parent`.
