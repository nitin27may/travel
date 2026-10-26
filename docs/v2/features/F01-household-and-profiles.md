# F01. Household and profiles

> **Amended 25 Oct 2026 (trip origin and nearest airport):** the home base as "the trip origin default" (behaviour 2) is level O4 of the origin ladder in [trip-origin-and-nearest-airport.md](trip-origin-and-nearest-airport.md) section 3. A copy's or a device's explicit start comes first, and the public default (a researched gateway or the nearest airport) comes after. Before the planner exists, O4 is a single private Starting from on the account (ORG-H, Q246), not a point.

## Purpose

Most of a trip's setup is the same every time: where the family lives, who travels, their ages, how
they like to travel and what to avoid. The household holds those standing facts once, privately, and
every new trip starts from them. This is the "pre-fill, don't re-ask" rule from the vault intake
notes, and the source of the passport and pass reminders in `Plan.md`.

## User stories

1. As a parent, I want to enter my family once (names, birth years, heights where needed), so that every trip knows the kids' ages at travel and which activities they can do.
2. As a parent, I want to set our home base (Whitby) and a default day-trip radius (2 h drive), so that "day trip from home" and "distance from you" work without asking.
3. As a planner, I want our standing preferences (balanced pace, mid-range, waterfalls and lookouts, avoid unfenced cliffs with young kids, no long drives without a break) to pre-fill every new trip, so that I only change what differs.
4. As a parent, I want passport expiry dates stored privately, so that the app warns me when a passport will not be valid 6 months after a planned return.
5. As a household member, I want our passes (Ontario Parks vehicle pass, Parks Canada Discovery Pass) recorded with expiry dates, so that budgets drop those fees and I get a renewal reminder.
6. As a second adult, I want to edit the household too, so that both parents can keep it current.

## Detailed behaviour

1. **Household creation.** On first sign-in the user is asked for a household name ("Singh family") and a home base (address search or a pin). Skippable; a household is created anyway with only the owner in it.
2. **Home base.** Stored as a point, a label and an IANA time zone (derived from the point, editable). Used as the trip origin default, the lens for Explore when no trip is open, and the start of day-trip drive times.
3. **Default day-trip radius** in drive minutes (default 120), from the intake question "how far are you willing to drive each way". Offered as chips: under 1 h, 1-2 h, 2-3 h, 3 h+.
4. **People.** Each person: name, birth date or birth year (one of them), height (optional; asked only when an activity in the user's plans has a height rule, with the reason shown: "Via ferrata Loen needs 40-120 kg; add weights?"), weight (same rule, optional), fitness 1-5, mobility notes, dietary notes, citizenship(s), passport expiry date. Never a passport number.
5. **Ages are computed at travel dates.** A child born 2016 is shown as "10 now, 11 on the Patagonia trip" (Feb 2027). Eligibility checks use the age on the item's date.
6. **Adults in the household** are users linked to `household_member` with role owner or adult. Children are `person` rows without accounts. An adult can be invited by email.
7. **Standing preferences** (household `prefs`): usual transport (car, transit, bike, mixed), budget style (budget, mid-range, comfortable, splurge), pace (slow, balanced, packed), interests (tags from the vocabulary: waterfall, lookout, cave, swimming, splash pad, hands-on museum...), avoid rules (free text plus structured rules: "max single drive without a stop 2 h", "no exposed edges for under-10s", "max walk per day 12 km"), dietary.
8. **Avoid rules become checks.** Each structured rule maps to a day check (F07). "Long single stretches with nothing to break them up" from `Travel Preferences.md` becomes "drive over 2 h without a stop".
9. **Memberships and passes.** Label, linked catalog offer (kind `pass`) when known, expiry date. Creates a household task "Renew Ontario Parks pass" 14 days before expiry. Covered entities show "covered by your pass" in Explore and the budget treats their fees as zero.
10. **Passport rule.** For each trip with a return date and a destination, the destination's document rule (01-domain-model.md 3.5, `document_rule`) is checked against each traveller's passport expiry. Failing produces a Documents task on that trip ("Kai's passport expires 20 Apr 2027; Argentina needs validity for the stay; renew before 15 Feb 2027") and a household-level task when there is no trip yet.
11. **Profile page per person** shows upcoming trips, what they can and cannot do on each (from eligibility), and their passport status. Visible to household adults only.
12. **Multiple households.** A user may belong to more than one (their own family, their parents'). A trip belongs to at most one household; a switcher sits in Settings.
13. **Units and language** come from the user's settings (F17), not the household.

## Data touched

`household`, `household_member`, `person`, `membership`, `traveller` (trip copies), `task` (household-level rows with `household_id` and no `trip_id`), `document_rule`, `offer` (kind pass), `relation` (`covered_by`).

### Schema additions

- `person.weight_kg int` (optional; only for activities with weight limits, e.g. via ferrata harness 40-120 kg).
- `household.prefs` JSON keys, validated by a Zod schema: `radius_min`, `transport`, `budget_style`, `pace`, `interests[]`, `avoid[]` (each `{rule, value, note}`), `dietary`.
- `membership.covers_entity_ids` is not needed: coverage lives on `relation(covered_by)` from the pass offer.

## Operations and MCP tools

Operations: `household.create`, `household.update_prefs`, `household.set_home`, `person.add`, `person.update`, `person.remove`, `membership.add`, `membership.update`, `membership.remove`, `household.invite_adult`, `household.leave`.

MCP: read only in v1. `get_household` (scope `trips:read`) returns names, ages at given dates, fitness, interests, avoid rules; **never** passport dates, heights or weights unless the client holds `people:read` (not granted by default). Clients use it to plan ("the kids are 10 and 12"); they cannot change people.

## Edge cases

- A person with only an age band ("teen") and no birth year: eligibility checks treat the lower bound of the band and flag "confirm age" on age-limited items.
- A guest on one trip (a grandparent) is a `traveller` with a name and age band only, not a household person.
- Birth year only: age at travel can be off by one; checks within one year of a limit are shown as "check: Kai may be 9 or 10 on this date".
- Two households both claiming the same child (separated parents): each household has its own `person` row; no linking in v1.
- Home base outside any area with coverage: Explore still works by distance, with a "we know little near you" note.

## Acceptance criteria

1. Creating a trip from a household with 4 people pre-selects all 4 as travellers with ages computed at the trip's start date.
2. Changing a person's birth year updates the age shown on every open trip within one reload (or live via broadcast).
3. A passport expiring within 6 months after a trip's return date produces exactly one Documents task on that trip; editing the expiry to a later date marks the task not_needed.
4. Passport dates never appear in any response to a viewer link, a public template, or an MCP token without `people:read` (privacy test with sentinel values).
5. A pass with an expiry creates one renewal task 14 days before; renewing (new expiry) moves it.

## Milestone

M0 (household, people, home base, auth), M2 (preferences pre-fill trips, avoid rules as checks), M3 (passport and pass tasks).

## Open questions

1. Store weight at all, or ask per activity and keep it on the trip only? Default: optional on the person, private.
2. Should a second adult be able to remove the owner? Default: no; ownership transfer is explicit.
3. School calendar entry per household (for the travel year, F03) here or there? Default: in F03, stored on the household.
