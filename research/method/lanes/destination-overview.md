# Lane: destination overview

Status: draft (17 Oct 2026).

## 1. Purpose

Produce the **area guide** that orients someone who has never been: what the place physically is, why
it is famous (the specific thing), what you cannot get elsewhere, its sub-regions, the numbers, and what
to know before reading any day. This is the former trip skill's mandatory "orientation section",
moved from each trip page into the catalog so every trip in the area reuses it.

Questions:
1. What is the place physically (geology, geography) in two or three sentences, and why does it look the
   way it does?
2. The specific thing it is famous for (enrosadira on dolomitic limestone, not "stunning scenery"), and
   where that photograph is taken from.
3. What is unique, including culture and language (Ladin in the Dolomites; the WWI front line on trails).
4. The sub-regions (2-6), what each is for, and how they connect.
5. Practical culture: booking culture, cash, language, tipping, storm cycles, driving style, opening
   habits (Sunday closures, siesta).
6. Seasons at a glance (pointer to the timing lane).

## 2. Produces

`area` rows (the tree and polygons, from importers) and an **area guide** attached to the area:
`area.guide jsonb` (or an `area_guide` table if it grows): `summary`, `physical`, `famous_for`
(`[{thing, where_seen_from: entity, best_light}]`, `unique` list, `subregions`
(`[{area_id, for, typical_days}]`), `know_before` list (3-6 blunt points), `numbers` (elevation range,
area, main towns), `languages`, `currency`, `time_zone`, `emergency_number`, `driving_side`, `plugs`.

## 3. Required fields

`summary` (our words, 80-150 words), `physical`, `famous_for` (at least one item tied to an entity),
`subregions` (when the area has children), `know_before` (at least 3), `time_zone`, `currency`,
`languages`.

## 4. Optional fields

`history` (short), `etiquette`, `safety` (wildlife, water, heat), `connectivity` (cell coverage, eSIM
notes), `money` (cash needs, card acceptance), `tipping`, `sundays_and_holidays`, `best_for` (trip types
that suit it with reasons).

## 5. Sources, in order

National or regional tourism boards; park management plans; UNESCO listings; Wikipedia and Wikidata for
facts (paraphrase, CC BY-SA text is never copied); geology surveys; reputable guidebooks for culture.

## 6. Evidence rules

Every claim in the summary must be supported by an evidence row or by an accepted entity elsewhere in the
catalog (the skill's rule: "if the intro says unspoilt, something in research must support it"). No
brochure adjectives without a fact behind them.

## 7. Leave empty

Superlatives without a source; population or visitor numbers older than 5 years; anything copied.

## 8. Freshness

Summaries 2 years (review prompt); `know_before` 365 days (rules change: shuttle-only access, new
reservation systems).

## 9. Traps

Generic geology; "the famous village is often the wrong one to sleep in" belongs in stays, but flag it
here as a know-before point; forgetting the access-booking culture (Moraine Lake shuttle, Dolomites
passes with timed access).

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "update", "target_kind": "area", "target_id": "area_dolomites", "base_version": 1,
  "patch": { "guide": {
    "physical": "Fossil coral reefs and atolls of a Triassic sea, lifted and tilted by the Alpine collision; dolomite rock weathers into towers and walls.",
    "famous_for": [ { "thing": "enrosadira, the pink glow at sunset on dolomite walls", "where_seen_from": "ent_seceda" } ],
    "know_before": [ "Lifts and huts run mid-June to late September", "Afternoon thunderstorms are common in July", "Ladin, German and Italian are all spoken; place names have two or three forms" ],
    "time_zone": "Europe/Rome", "currency": "EUR", "languages": ["it", "de", "lld"] } },
  "evidence": [ { "field": "guide.physical", "value": "...", "source": { "url": "https://whc.unesco.org/en/list/1237", "publisher": "UNESCO", "kind": "official" }, "observed_on": "2026-10-17", "quote": "Dolomites inscribed for their geomorphology and fossil reef systems", "confidence": "official" } ] } ] }
```
