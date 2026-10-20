---
name: travel-taxonomy-extensible
description: "Nitin's rule for the travel data model (18 Oct 2026). The place and activity taxonomy must miss no type people visit or do, and extend by data entry without a schema or UI rebuild. One capture contract tells every researcher and crawler what to collect."
metadata:
  node_type: memory
  type: project
  originSessionId: 714f2667-d381-5eea-95c1-8887ada73bc1
  modified: 2026-10-18T22:32:46.029Z
---

On 18 Oct 2026 Nitin stressed this, after several rounds on kinds, suitability and relevance.

**1. Complete taxonomy.** It must cover every kind of place or activity a person goes out for, across nature, water, air, snow, culture and family play. His examples:
- trails and hikes, with summits and viewpoints that are part of a trail
- lakes, and multi-day treks such as the Alta Via
- via ferrata, rock climbing
- boating, canoe, cruise, jet ski
- skiing, and zip lines with their variants
- the many activities at a place like Niagara

**2. Extends without a rebuild.** A new subcategory is a vocabulary entry. It inherits its parent's capture contract, applicability, display and relevance class. The UI renders sections from the contract, never from per-type code.

**3. Activities are first-class offers on places.** Each has its own operator, limits, season, duration, price and booking details. Difficulty maps onto the same family-effort scale from the activity's own grade:
- ski piste colours
- climbing grades
- whitewater classes
- via ferrata grades

Places link by part-of and offers relations, which drives "at this place you can also...".

**4. One capture contract.** Every researcher, crawler and scraper reads it before collecting, so the data captured is exactly what the UI will show.

**Why:** "So that in future we don't have to rebuild it from scratch... if we have all those data, everything will come together very beautifully." He said not to disturb the current flow; this is a standing requirement.

**How to apply:**
- Check any schema, kind or crawl work against this rule.
- The spec is `docs/v2/research/capture-contract.md`, written by an Opus planner on 18 Oct, with backlog rows in stage 3a.
- It builds on `research/suitability-applicability.md` and `research/relevance.md`.

Related: [[travel-ux-principles]], [[travel-public-site-first]].
