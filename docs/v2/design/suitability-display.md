# Suitability display: "Who it suits" on places, chips on cards and day rows, and the three filters

Status: design, 18 Oct 2026 (travel-design-reviewer). Governs how the suitability data in
[research/suitability.md](../../../research/method/suitability.md) and
[research/suitability-applicability.md](../../../research/method/suitability-applicability.md) is shown. The data model,
the R/A/N matrix and the lanes stay in those two pages; this page owns layout, chip vocabulary, wording,
colour and the acceptance checks for S1. Mock: [suitability-display/mock/index.html](suitability-display/mock/index.html)
(`?theme=dark`), screenshots in [suitability-display/mock/shots/](suitability-display/mock/shots/).

What is built today (checked on :3430, 18 Oct 2026): the place page's "Who it suits" section is a stub. Tre
Cime shows one neutral chip "6+ years"; Lake Louise shows an italic line "Kid fit has not been assessed yet."
Nothing else from the model renders. This page replaces that section.

## 1. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | **Three looks for a suitability value: rule, advice, gap.** A rule (operator or official) is a quiet filled chip (`--surface-2`, `--ink` 600, lock glyph). Advice (our judgement, a recommendation) is the outlined neutral chip (`--line-2`, `--ink-2`, person glyph). A gap is a dashed `--line-2` chip in `--muted` reading "Not checked yet". | K3 and K4: a rule and our judgement must never look the same. The lock is understood without a legend (P4). The dashed look already means "unsettled" in the system (idea chips); a gap is unsettled research. |
| D2 | **Chips name the family effort, never its number.** "Moderate · CAI E · 3–4 h", not "FE3 · CAI E". The original grade stays after the name (K5). | "FE3" needs a manual (P4). The five names (Stroll, Easy, Moderate, Hard, Technical) are the filter's options too, so the card and the filter use one vocabulary. |
| D3 | **"Not stated by the operator" is a value, and it reads like one.** In the limits chip an R limit that was searched and not found appears as "weight not stated". In the detail row: "Not stated by the operator · searched 12 Oct 2026 · ask before booking", in `--ink-2`, no dashed border. | A parent must not assume "no limit" from an empty slot (P2). A searched-none is an answer (K2), so it never looks like a gap. |
| D4 | **The limits chip's "+n" counts every operator ban, including pregnancy and medical exclusions.** "Age 8+ · 23 kg min · swim test +2". The +2 opens the full rules list. "Know before you go" keeps kit, wear, fitness, waiver and weigh-in. | Pregnancy and medical bans stop a visit for one traveller (P2 safety exception). Counting them at rest costs no width and keeps the 3-value cap. Changes applicability 5.1 rule 4 and PC1 (section 7). |
| D5 | **Place cards carry two chips (kids, effort); day rows carry three.** The card's kids chip is `kids_from` ("Age 8+" or "From about 6"), the effort chip is the family-effort name. No slot 3 on cards. | P8: list data ships only what cards and filters need. Both are filter facets; slot 3 (stroller, braking, vessel) is a detail value and stays on the place page and the day row. Changes applicability 5.1 (section 7). |
| D6 | **Fit against a party profile has three colours**: fits = `--ok` chip; our advice says no = `--warn` chip ("Not suited to a 3-year-old"); an operator rule says no = `--crit` chip ("Not for under 8 · operator rule"). | tokens.md 3: `--warn` is possible-but-check, `--crit` is "breaks the day". The timeline design's `--warn` example is an advice fail and stays as written. |
| D7 | **The place page section = chip row, one warning line, a research line, then six groups.** Limits and Who it suits are open; Effort and time, the kind block, Facilities and When you can go are collapsed to a header with their values inline. One click opens a group; one click on any value opens its provenance. | P2 and P3: the chip row answers "can we go"; the groups answer the next questions one click each; provenance is one more. |
| D8 | **A missing R field keeps its row and shows the gap chip; missing A fields collapse into one closing line per group.** The section head carries "9 of 12 family checks done · read 12 Oct 2026". | The owner's rule that empty markers stay. The research line frames every gap as in progress, so the section reads as unfinished research, not as a broken page. |
| D9 | **A group that is N for the whole profile is not drawn.** A bungee page has no Facilities group; its Effort and time group is one row, time on site (D11). | Applicability 5.2. This is not a missing-data case: nothing is missing. The owner's marker rule applies to sections with R or A fields only. |
| D11 | **A group draws when any of its properties is R or A for the type, even one row.** A bungee page keeps "Effort and time" with its one row, time on site (`on_site_min` is R for bungee; its family-effort grade is N). Section 2.2's statement that a bungee page has no Effort group is withdrawn; what a bungee page does not show is an effort *name*. | Applicability 5.2 and D9 agree: only an all-N group is absent. Dropping a group that holds an R property would hide a missing R check (owner marker rule). Decided in S1 Part B, 3.21. |
| D10 | **Filters: "Kids" primary; "Effort" and "Stroller" under More filters.** Exact labels and options in section 5. | P4 decision (four primary filters) and T4. |

## 2. The place page section, per kind

Common anatomy, in order (desktop 1440 and phone 390 share it; phone stacks and the chip row wraps):

```
WHO IT SUITS                                   9 of 12 family checks done · read 12 Oct 2026
[🔒 limits or fit chip] [effort or time chip] [kind's deciding chip]        <- 3 chips at rest
⚠ one warning line: the hazard that decides the day, or the cancellation cause
▾ LIMITS AND RULES         (open)   rows: label · value · basis · read date · chevron
▾ WHO IT SUITS             (open)   age band, kid note, carrier, stroller or on board, wheelchair, capacity
▸ EFFORT AND TIME          Easy · Parks Canada Easy · 2.4 km · 50 m · 1–1 h 30     (collapsed, values inline)
▸ ON THE TRAIL             waymarked · catwalks fenced · 2 water crossings           (kind block, collapsed)
▸ FACILITIES               toilets at the lot · no water · shade partial             (collapsed)
▸ WHEN YOU CAN GO          May–Oct via road · ice cleats Nov–Apr                     (collapsed)
```

Row anatomy inside an open group: `dl` two columns (label 160 px mono 12 `--muted`; value serif 15.5
`--ink`); after the value, a mono 12.5 `--muted` provenance stub "operator rule · read 12 Oct 2026"; the
whole row is a button that opens the provenance popover (components 5.2): basis in words, the quote, the
source title and publisher as a link, the read date, our method note for `our_inference`, and every
conflict ("Sources disagree: a reseller page lists 140 kg · read 12 Oct"). Honesty chips ("Sources
disagree", dashed `--crit`) keep their short tooltip (P4 exception).

Gap rendering, both levels:
- R field missing: the row stays; its value cell is the gap chip "Not checked yet". For a limit-type R field
  on an operated profile the chip reads "Limits not checked yet · ask the operator".
- A fields missing: one closing line per group, mono 12.5 `--muted`, "?" glyph, "Not checked yet: toilets,
  signal".
- Every R field missing in the whole section: the chip row shows one gap chip "Family checks not done yet"
  and the research line reads "0 of 12 family checks done"; the groups still draw with their gap rows. This
  is the Lake Louise case today.

### 2.1 Family trail (`hike`): Johnston Canyon, Lower Falls

```
desktop 1440 (content column 680)
┌──────────────────────────────────────────────────────────────────────────────┐
│ WHO IT SUITS                           11 of 12 family checks done · read 12 Oct 2026 │
│ [👤 From about 4 · our judgement] [🥾 Easy · Parks Canada Easy · 1–1 h 30] [⛔ No stroller · steps] │
│ ⚠ Catwalks are fenced; ice cleats needed Nov–Apr                                      │
│ ▾ LIMITS AND RULES                                                                     │
│   Minimum age        No minimum age · operator states none · read 12 Oct 2026      ›   │
│   Group size         Not stated by Parks Canada · searched 12 Oct · no restriction found › │
│ ▾ WHO IT SUITS                                                                         │
│   Recommended        From about 4 · our judgement: 2.4 km, 50 m, fenced catwalks   ›   │
│   For a child        Short and fenced; the Lower Falls tunnel is the payoff for under-6s │
│   Carrier            Carrier OK · our judgement                                     ›   │
│   Stroller           None · steps and narrow catwalks · Parks Canada                ›   │
│   Wheelchair         Not checked yet                                                   │
│ ▸ EFFORT AND TIME    Easy · Parks Canada Easy · 2.4 km · 50 m up · adults 1–1 h 30 · with a 6-year-old about 2 h (our rule) │
│ ▸ ON THE TRAIL       waymarked · catwalks fenced · [Not checked yet] water crossings    │
│ ▸ FACILITIES         toilets at the lot · food: cafe at the lot · Not checked yet: water, shade, signal │
│ ▸ WHEN YOU CAN GO    open all year via road · bears: carry spray                       │
└──────────────────────────────────────────────────────────────────────────────┘

phone 390
┌────────────────────────────────────┐
│ WHO IT SUITS                       │
│ 11 of 12 family checks done        │
│ [👤 From about 4 · our judgement]  │
│ [🥾 Easy · Parks Canada Easy · 1–1 h 30] │
│ [⛔ No stroller · steps]            │
│ ⚠ Catwalks are fenced; ice cleats  │
│   needed Nov–Apr                   │
│ ▾ LIMITS AND RULES                 │
│   Minimum age                      │
│   No minimum age · operator states │
│   none · read 12 Oct 2026        › │
│   …                                │
└────────────────────────────────────┘
```

- At rest: advice chip (no rule exists, so slot 1 is the age band), effort chip, stroller chip (slot 3 for a
  trail). Warning line from `hazards` and `exposure`.
- Click: a group header opens the rows (200 ms, chevron rotates); a row opens its provenance popover.
- Provenance: the stub after each value; the popover on click.
- Hard limit vs advice: no hard limit here, so no lock anywhere. The age band row says "our judgement" and
  gives the numbers.
- Not stated: `group_min` searched-none reads as a sentence with the search date, in `--ink-2`.
- Missing R: `navigation` is R for hike and missing, so "ON THE TRAIL" shows the gap chip in its row and the
  research line says 11 of 12. `wheelchair` is A: it joins the closing line when missing (shown here as a row
  because the mock opens the group).

### 2.2 Whitewater raft (`rafting`): Kicking Horse, family section

```
[🔒 Age 6+ · 23 kg min · swim test +2] [🌊 Class I–III · 2 h on water · 3 h 30 total] [🧥 Wetsuit, helmet, PFD provided]
⚠ Age and weight can rise with the river level; glacial water
▾ LIMITS AND RULES
  Minimum age        6 · operator rule · read 12 Oct 2026                    ›
  Minimum weight     23 kg (50 lb) · operator rule · not negotiable           ›
  Maximum weight     Not stated by the operator · searched 12 Oct 2026 · ask before booking
  Swimming           Must be comfortable in moving water · operator rule     ›
  Pregnancy          Not allowed · operator rule                             ›
  Medical            Heart, back and neck conditions excluded · operator rule ›
  Waiver             A parent or guardian signs for under-18s · operator rule ›
  With an adult      Not stated by the operator · searched 12 Oct 2026
▾ WHO IT SUITS
  Recommended        From about 8 · our judgement: Class III waves on the Tradition section
  For a child        The Gentle section is the one for a first raft; the Tradition section adds Class III.
▸ ON THE WATER       Gentle: Class I–III · Tradition: Class II–IV · July high water raises both · water temperature not published (glacial, our inference) · PFDs in child sizes from 15 kg
▸ EFFORT AND TIME    2 h on the water · 3 h 30 on site
▸ FACILITIES         toilets at the base
▸ WHEN YOU CAN GO    mid-May to September · cancelled for river level and lightning · refund
```

- At rest: the merged rule chip carries three values and "+2" (pregnancy and medical). Slot 2 is the water
  class and time (effort is N; the class is the grade, A10). Slot 3 is kit.
- "+2" opens the LIMITS AND RULES group scrolled to the first hidden rule.
- Hard vs advice: every row in LIMITS carries the lock; "not negotiable" follows a harness or seat reason.
- Not stated: `max_weight_kg` and `adult_required` as sentences with the date.
- Missing R: none in this example; the research line reads "15 of 15".

### 2.3 Zip line (`zipline`): Golden Skybridge zip

```
[🔒 Age 8+ · 30–125 kg · height not stated +1] [⏱ About 1 h on site] [🛑 Guide brakes for you]
⚠ You are weighed on site; wind cancels
▾ LIMITS AND RULES
  Minimum age        8 · operator rule · read 12 Oct 2026                    ›
  Weight             30 to 125 kg · operator rule · harness · not negotiable  ›
  Height             Not stated by the operator · searched 12 Oct 2026 · ask before booking
  With an adult      Under 14 with an adult on the course · operator rule    ›
  Pregnancy          Not allowed · operator rule                             ›
  Waiver             Guardian signs under 18 · operator rule                 ›
▾ WHO IT SUITS
  Recommended        From about 8 · our judgement: the weight floor, not nerves
  For a child        Under 30 kg cannot ride; there is no tandem option here.
▸ EFFORT AND TIME    about 1 h on site
▸ THE COURSE         guide brakes · 2 lines, longest 600 m · stairs between lines · tandem: Not checked yet
▸ FACILITIES         toilets at the base
▸ WHEN YOU CAN GO    May–October · cancelled for wind and lightning · rebook
```

- The limits chip shows a "not stated" item as one of its three values (D3). "+1" is pregnancy.
- Slot 2 is time (effort N, PC3). Slot 3 is braking, which decides whether a child must do anything.
- Missing R: none. Missing A (`tandem_under_kg`) shows in the collapsed kind block as a gap chip.

### 2.4 Boat tour (`boat`): Maligne Lake cruise

```
[🔒 No minimum age · operator states none] [⏱ 90 min · stop at Spirit Island] [🚼 Strollers stay at the dock]
⚠ Sailings cancelled in high wind
▾ LIMITS AND RULES
  Minimum age        No minimum age · operator states none · read 12 Oct 2026   ›
▾ WHO IT SUITS
  Recommended        Any age · our judgement: enclosed, heated, 90 min
  For a child        A 15-minute shore stop breaks the sit; bring a snack for the return.
  Stroller on board  Not allowed on the boat; leave it at the dock · operator rule ›
  Wheelchair         Partial · two accessible boats, book ahead · operator info ›
▸ THE BOAT           enclosed · sheltered lake · seasickness risk low · landing: Spirit Island, 15 min
▸ EFFORT AND TIME    90 min on site
▸ FACILITIES         toilets on board · food: none on board · Not checked yet: accessible toilet
▸ WHEN YOU CAN GO    June to early October · cancelled for wind · refund
```

- "No minimum age" is a `no_limit` rule: it earns the lock and the fill, because the operator said so.
- Slot 3 is `stroller_on_board` (a carriage rule, A6), not a surface.
- `stroller` is N for boats: no row, no marker (D9).

### 2.5 Via ferrata (`ferrata`): Mt Norquay, Explorer route

```
[🔒 Age 12+ · 40–120 kg · guide required] [🧗 Hard · Schall B · 2–2 h 30] [🪢 Harness, helmet, lanyard provided]
⚠ Serious exposure; lightning closes the route; exit after the bridge at 45 min
▾ LIMITS AND RULES
  Minimum age        12 · operator rule · read 12 Oct 2026 · 14 for Skyline and Summiteer ›
  Weight             40 to 120 kg · operator rule · harness · not negotiable  [Sources disagree] ›
  Guide              Required · operator rule                                 ›
  Fitness            "Comfortable hiking continuously for one hour or more" · operator ›
  Waiver             Legal guardian signs for under-18s · operator rule       ›
▾ WHO IT SUITS
  Recommended        From 12 · the operator's rule; our judgement adds 40 kg as the real gate
  For a child        A 12-year-old under 40 kg cannot go. Children's full-body harnesses are rated to about 40 kg.
▸ EFFORT AND TIME    Hard · Schall B · 2–2 h 30 on the cable · 300 m vertical · approach 20 min by chairlift
▸ ON THE CABLE       kit provided · child harness: Not checked yet · descent by chairlift
▸ FACILITIES         bail-out: after the bridge, 45 min · signal: Not checked yet
▸ WHEN YOU CAN GO    June–October · cancelled for lightning · rebook
```

- Slot 1 merges age, weight and the guide rule (all operator rules). Slot 2 is the effort name with the
  Schall grade. Slot 3 is kit.
- The weight row carries the honesty chip "Sources disagree" (a reseller's 140 kg); its tooltip and the
  popover give both figures and which one we chose.
- `bail_out` is R for ferrata and present; `signal` is A and missing, so it appears in the closing line.

### 2.6 Hot spring (`hot_spring`): Myvatn Nature Baths

```
[🔒 Age 1+ · under 12 with an adult · armbands under 8] [⏱ About 2 h] [🌡 36–40 °C · cloudy water]
⚠ Cloudy water: a child under the surface cannot be seen
▾ LIMITS AND RULES
  Minimum age        1 · operator rule · read 12 Oct 2026                    ›
  With an adult      Under 12 in an adult's care at all times · operator rule ›
  Floats             Armbands required for ages 1–8 · operator rule          ›
  Pregnancy          Ask a doctor · operator advice                          ›
▾ WHO IT SUITS
  Recommended        Any age from 1 · our judgement: shallow entry, warm, but cloudy
  For a child        The water is cloudy; keep under-8s within arm's reach even with armbands.
  Wheelchair         Step-free · official info                               ›
▸ EFFORT AND TIME    Not checked yet (time on site)
▸ THE WATER          36–40 °C · cloudy · entry: steps · lifeguard: Not checked yet
▸ FACILITIES         toilets · food: cafe · Not checked yet: accessible toilet, parking
▸ WHEN YOU CAN GO    open all year · Not checked yet: closures
```

- "Pregnancy · Ask a doctor" is advice (`ask_doctor`), so its row has the person glyph, not the lock, even
  inside LIMITS AND RULES.
- Missing R: `on_site_min` is R and missing, so the collapsed EFFORT AND TIME header shows the gap chip in
  place of its values. The research line reads "10 of 11".

## 3. Chip vocabulary

### 3.1 Chip kinds (adds to components.md 2.8)

| Chip | Look | Glyph | Text pairs (light / dark) | Where |
|---|---|---|---|---|
| **rule** (hard limit, `no_limit` rule, guide required) | `--surface-2` fill, no border, `--ink` 600 | lock 13 px | `--ink` on `--surface-2` 13.66 / 12.24 AAA | slot 1 when any rule exists |
| **advice** (age band, recommendation, our judgement) | 1 px `--line-2`, `--ink-2` 500 | person 13 px | `--ink-2` on `--surface` 12.09 / 10.76 AAA | slot 1 when no rule exists; detail rows |
| **value** (slot 2 and 3) | neutral: 1 px `--line-2`, `--ink-2` | the kind glyph (walker, wave, clock, stroller, boat, brake, thermometer) | as advice | slots 2 and 3 |
| **gap** | 1 px dashed `--line-2`, `--muted` | none | `--muted` on `--surface` 6.94 / 7.45 AA | a missing R field's row; the whole row when all R fields are missing |
| **fits** | `--ok-soft`, `--ok`, check | check | 5.53 / 7.87 | slot 1 with a party profile, when every rule and our advice pass |
| **advice fail** | `--warn-soft`, `--warn`, triangle | triangle | 6.11 / 7.84 | slot 1 with a profile, when our advice says no and no rule does |
| **rule fail** | `--crit-soft`, `--crit`, no icon | none (the words carry it) | 5.45 / 6.36 | slot 1 with a profile, when an operator or official rule excludes the youngest |
| **honesty** (existing) | dashed `--crit` | triangle | 6.61 / 7.01 | "Sources disagree" on a row, never in the three slots |

UI borders: `--line-2` on `--surface` 3.67 / 3.42 (passes 3:1). The lock and the fill together make a
rule readable without colour. Nothing in the chip set is amber: amber stays for selected, now and the
primary action. Green appears only on "fits". Coral appears only on a rule fail and on honesty chips.

### 3.2 Wording

| Case | Chip text | Rule |
|---|---|---|
| hard age | "Age 8+" | "Age" then the number and "+"; years are implied |
| age and weight | "Age 8+ · 23 kg min" | "min" or "max" after a one-ended weight; a range "30–125 kg" needs neither |
| height | "120–195 cm" or "120 cm min" | metric only on the chip; the quote keeps inches |
| swim test | "swim test" | the operator's rule in two words; the row quotes it |
| adult rule | "under 14 with an adult" | the number first |
| guide | "guide required" | |
| no limit | "No minimum age" | only for `no_limit` (the source says so); it earns the lock. `none_stated` (silent sources) reads like `searched_none`: "Minimum age not stated" |
| searched none inside the chip | "height not stated" | counts as one of the three values |
| overflow | "+2" | after the third value; counts every remaining operator ban (D4) |
| age band | "From about 6" on cards and day rows; "From about 6 · our judgement" on the place page | "about" says judgement in one word; the glyph says it too |
| effort | "Moderate · CAI E · 3–4 h" | name · original grade · adult time; a trail with no grade: "Moderate · our grade · 3–4 h" |
| time only | "About 1 h on site", "90 min · stop at Spirit Island" | for effort-N kinds |
| water class | "Class I–III · 2 h on water" | the class is the grade for paddling (A10) |
| fits | "Fits a 6-year-old" | |
| advice fail | "Not suited to a 3-year-old" | the timeline design's wording, unchanged |
| rule fail | "Not for under 8 · operator rule" | the basis in two words |
| stroller, three states | "No stroller access" (the record says there is none), "Not checked yet" (nobody has looked), "Stroller not stated" (looked, and the source never says) | S1c: "None" alone is ambiguous and is never used for a stroller. The same three words serve the chip, the row and any card |
| gap | "Not checked yet" | identical on rows and lines; "Limits not checked yet · ask the operator" for a missing limit on an operated kind |

A chip never wraps inside itself. A limits chip may hold up to three values and "+n"; if it would still
overflow its column it truncates with an ellipsis and a `title` only on cards, never on a day row or a place
page, where it may take the full row width instead.

### 3.3 Where chips merge, and how many

| Surface | Chips | Wrap |
|---|---|---|
| place card (list, map card) | kids (`kids_from`, rule or advice look) · effort name (omitted when effort is N) | no; two chips fit at 1 column 390 and at 4 columns ≥ 1280 |
| trip card | "Kids from 6" (derived) · "Hike effort: moderate" (unchanged, L3b) | no |
| day row (timeline entry) | slot 1 · slot 2 · slot 3 after the title, before the honesty, idea and To book chips | **yes, to a second line on phone**, limits chip first. Recorded as an exception to timeline-design 10 ("chips may wrap only in the selector footer"). The entry's mono meta drops "child rule" (timeline 4.2), since the chips carry it. |
| place page section | slot 1 · slot 2 · slot 3, then the warning line | yes (the section is a reading surface) |
| trip page expanded entry | the same chips plus the open LIMITS group (trip-timeline.md 3.10) | yes |

Chip limits and merging checked against the principles:

- **P2 safety exception.** Every hard rule is at rest: the first three in words, the rest as a count. Closures,
  bookings and the main hazard are outside the chips (warning marks on day rows, the warning line on the place
  page).
- **P3 glance.** A card answers "for whom" and "how hard" in two chips. A day row adds the kind's condition.
- **P4 no manual.** No codes ("FE3"), no abbreviations other than units; the lock, the person and the dashed
  border are the only symbols, and each has words beside it.
- **P6 right moment.** Age and effort on the row; stroller, braking, vessel on the row for the kind that
  needs it; steepness, kit sizes and provenance when the place opens.
- **T4 families first.** The kids chip is the first chip on every surface, and the Kids filter is primary.
- **Colour.** Green only on fits. Amber nowhere in the chip set. Coral only on a rule fail and on honesty.
  `--warn` is text on `--warn-soft` and never a fill (tokens.md 3).

## 4. Day row and card wireframes

```
day row, desktop (timeline entry, content column)
16:30 ○ 🥾 Johnston Canyon, Lower Falls  45 min
          [👤 From about 4] [🥾 Easy · Parks Canada Easy · 1–1 h 30] [⛔ No stroller · steps]
          2.4 km · 50 m up · catwalks · ⚠ ice cleats Nov–Apr
          Short and fenced; the tunnel is the payoff for under-6s.

day row, phone (content column about 290)
16:30 ○ 🥾 Johnston Canyon, Lower Falls
          [👤 From about 4] [⛔ No stroller · steps]
          [🥾 Easy · Parks Canada Easy · 1–1 h 30]
          2.4 km · 50 m up · catwalks

place card (list)
┌──────────────────────┐
│ photo 16:10          │
│ JOHNSTON CANYON      │
│ Trail · Banff · May–Oct │
│ [👤 From about 4] [🥾 Easy] │
│ summary …            │
└──────────────────────┘
place card for a raft: [🔒 Age 6+] [🌊 Class I–III]     (the water class is the effort for paddling)
place card for a boat: [🔒 No minimum age]              (effort N: one chip)
place card not researched: [Not checked yet]            (gap chip; the card is not hidden)
```

With a party profile (trip pages only): slot 1 becomes the fit chip; the rule or advice that failed is the
first LIMITS row when the entry expands, with numbers ("30 kg minimum; a 6-year-old is usually 20 to 25 kg").

## 5. The three filters

Primary pill: **Kids**. Under "More filters": **Effort**, **Stroller** (with Carrier OK and Step-free, which
this page does not change). Pills are components 2.7: at rest the label; active `--accent-soft` with the
chosen value; × clears. Counts update as you choose (P4); the empty state suggests the nearest match.

| Pill at rest | Menu title (mono 12 label) | Control and options | Active pill | Count line |
|---|---|---|---|---|
| **Kids** | "Youngest child" | stepper "− 6 +" (0 to 17) and quick chips "Baby · 4 · 6 · 8 · 10 · 12"; "Any age" clears | "Kids · 6" | "38 places for a 6-year-old · 4 more are a stretch, shown faded" |
| **Effort** | "How hard" | checkboxes with counts: "Stroll · flat, made surface · 12", "Easy · a clear path, no hands · 21", "Moderate · rough or steep, sure footing · 18", "Hard · long, exposed, or hands sometimes · 9", "Technical · harness or scrambling · 3" | "Effort · Stroll, Easy" | "41 places with an effort rating · 12 have none and are not shown (boat tours, lifts, bungee)" |
| **Stroller** | "Push a stroller here" | radio: "Any stroller · paved, boardwalk or fine gravel" / "All-terrain stroller · packed gravel and roots too"; "Off" clears | "Stroller · any" | "17 places · 5 for part of the way, marked on the card" |

Rules behind the labels:
- Kids reads `kids_from` only: a hard `min_age` above the age hides the place; an `age_band.from` above it
  fades the card to 60% with its advice chip still legible ("From about 8"), which is the reason on the card.
  A `null` (gap) never passes: the place is hidden, and the count line adds "n not checked yet".
- Effort reads `family_effort`: a multi-select on the five names; the card's effort chip shows the original
  grade, so a visitor sees why a trail is Moderate.
- Stroller reads `stroller_ok`: "Any stroller" passes `yes`; "All-terrain" passes `yes` and `partly`; conveyances
  pass on `stroller_on_board` yes or folded. A `partly` card shows "Stroller: first 1.2 km" as its slot 3 on
  the day row and in the card's `title`; on the card itself the kids and effort chips stay (D5).
- No filter ever names a kind. Adding a kind adds a derive mapping, never an option (A8).

First-use check (no help text): each label is a noun a parent uses ("Kids", "Effort", "Stroller"); every
option is a plain phrase with its meaning after a dot; the count line names what left the results and why.

## 6. Acceptance checks (S1, measured on the built pages at 1440 x 900 and 390 x 844, light and dark)

1. The place page's "Who it suits" section shows, for every kind in scope: a chip row of at most three chips,
   one warning line when `hazards` or `weather_cancel` has a value, the research line "n of m family checks
   done · read <date>", and only the groups the profile marks R or A. A bungee page has no Facilities and
   no Effort group and no marker for them.
2. Every hard limit in the record (`operator_rule`, `official_rule`, including `no_limit`) is visible at
   rest: in the first chip's words or in its "+n" count. Pregnancy and medical bans are counted in "+n".
3. The first chip is a rule chip (fill, lock) when any rule exists, else an advice chip (outline, person), else
   the gap chip. No chip in the section is amber; the only green is a "fits" chip when a profile is present.
4. Effort chips read the family-effort name followed by the original grade; the strings "FE1" to "FE5" do not
   appear anywhere on the public site.
5. A `searched_none` limit reads "<field> not stated" in the chip when it is R, and "Not stated by the operator ·
   searched <date> · ask before booking" in its row, in `--ink-2` with no dashed border.
6. A missing R field keeps its row and shows "Not checked yet" as a dashed chip; missing A fields of a group
   collapse into one "Not checked yet: a, b" line; an N field never renders, not even as "not stated".
7. Clicking any value row opens a popover with basis, quote, source link with publisher, read date and every
   conflict; Esc closes it and returns focus to the row. "Sources disagree" has a tooltip and the same popover.
8. Each collapsed group header shows its values inline; opening is 200 ms `--e-out`, chevron rotates; reduced
   motion fades.
9. Cards carry at most two chips (kids, effort); day rows carry three and may wrap to two lines on phone with
   the limits chip first; the entry's meta line no longer contains a child rule.
10. Filters: "Kids" is a primary pill; "Effort" and "Stroller" are under More filters with the labels and
    options in section 5; the count line changes as described when each is active; a `gap` never passes a
    positive filter.
11. Contrast: every pair in 3.1 and `--warn` on `--surface` (6.92 / 8.31) for the warning line.
12. Phone: no horizontal scroll at 390; every row, group header and chip "+n" target is at least 44 px tall;
    the chip row wraps without clipping.
13. Screen reader: the chip row is a list named "Who it suits"; a rule chip's accessible name starts with
    "Operator rule:" or "Official rule:"; an advice chip's with "Our judgement:"; a gap chip's with "Not
    checked yet:" and the field name; a group header is a button with `aria-expanded`.

## 7. Conflicts found, and what changes where

| # | Conflict | Resolution | Change required |
|---|---|---|---|
| C1 | Applicability 5.1 writes "FE3 · CAI E" on chips; P4 forbids codes that need a manual. | Chips use the family-effort name; the number stays internal and in the filter's `title`. | applicability 5.1 rule 2 and the slot-2 column (edited, see below) |
| C2 | Applicability 5.1 rule 4 and PC1 put pregnancy and medical bans in "Know before you go", which timeline-design 4.5 renders as a collapsed panel; P2's safety exception wants a visible mark for anything that stops a visit. | The limits chip's "+n" counts them, so they are marked at rest and one click away; KBYG keeps kit, wear, fitness, waiver and weigh-in. | applicability 5.1 rule 4 and PC1 (edited) |
| C3 | Applicability 5.1 says three chips "on a day row and a place card"; P8 says list data carries only the kids chip and filter fields. | Cards: kids and effort (both filter facets). Day rows: three. | applicability 5.1 heading and A7 (edited); P8's "the kids chip" becomes "the kids and effort chips" (coordinator to confirm; not edited here) |
| C4 | Timeline-design 4.2 puts the "child rule" in the entry's mono meta and lists only honesty, idea and To book as chips; applicability puts three suitability chips on the row. Timeline-design 10 says chips wrap only in the selector footer, but three chips cannot fit a 290 px phone column. | Suitability chips lead the entry's chip row; meta drops the child rule; chips may wrap on an entry. | timeline-design.md 4.2 and 10 (flagged for the coordinator; not edited here) |
| C5 | Timeline-design 3.2 colours "Not suited to a 3 year old" `--warn`; applicability slot 1 writes "Not for under 8 (operator rule)" with no colour; tokens.md says `--crit` is "breaks the day". | Advice fail `--warn`; rule fail `--crit`; fits `--ok`. | none (both pages are consistent with D6; timeline's example is an advice fail) |
| C6 | Applicability 5.2 "a section with no R or A fields is not drawn" against the owner's "empty sections stay visible as markers". | Compatible: the marker rule covers sections with R or A fields. A whole-profile N section is not missing data. | applicability 5.2 gains one sentence (edited) |
| C7 | suitability.md 6.4 orders the section chips, times, facilities, water safety, season; applicability 5.2 orders limits, who, effort and time, kind block, facilities, when. | 5.2 is newer and wins; times fold into "Effort and time". | none (6.4 already defers to Fable's design) |
| C8 | The built page shows "Kid fit has not been assessed yet." as italic prose; the spec says "Not checked yet" as a hollow chip. | One gap chip plus the research line. | S1 build brief |
| C9 | Applicability 5.1 "rule chips are solid" has no token meaning. | Solid = `--surface-2` fill, `--ink` 600, lock; defined in 3.1. | components.md 2.8 gains rule, advice, gap, fits, advice-fail and rule-fail chips (coordinator to schedule with the next foundation round; tokens unchanged) |
| C10 | Applicability 5.3 says the Kids filter "hides above a hard rule, dims above the band" but gives no label or option values. | Section 5. | applicability 5.3 points here (edited) |

Edits made to [suitability-applicability.md](../../../research/method/suitability-applicability.md) in this pass are
listed in its change log under 18 Oct 2026 (display rules).

## 8. Questions for the owner

1. **"From about 6" for our judgement.** The chip says "about" instead of "(our judgement)"; the place page
   row spells it out. Is "about" honest enough on a card, or should the card chip also carry the words?
2. **Faded cards in the Kids filter.** A place whose advice age is above the youngest stays in the list at
   60% with its "From about 8" chip. Keep that, or hide it like a hard rule does?

## 9. Pending display rule: `usable_partial` (CF, comes with S1)

`suit_level` can now be `usable_partial` (suitability.md 4.1). S1 shows it as **"usable, partly unverified"** wherever the level shows. Rules for S1 to build, not yet drawn:

- The badge and the research line say "Usable, partly unverified" in place of "Usable"; the count stays ("partly unverified · 21 of 30").
- The words are plain text next to the badge, not colour alone, and the badge keeps the `usable` style (neutral outline). It is never `--warn` or `--crit`: the record is usable, the label says some answers are thin.
- The soft fields (`softRequired`) show their gap or "not stated" chip as today; the safety-critical ones (`softSafety`) lead the "Not checked yet" line so a parent sees the limit that is missing first.
- A filter or sort that treats `usable` as a floor treats `usable_partial` as below `usable` and above `draft`.

## 10. Age wording (REVIEW4 4.24)

One age is written one way. `web/lib/format/age.ts` (`ageLabel(kind, value, basis)`) is the only place an age phrase is made; cards, chips, lists,
table cells, the filter bar, trip tags, day rows and place pages call it. Dropped: "Ages N+", "Age N+", "Kids from N", "All ages", "N+ years".

| Kind | Words | Where |
|---|---|---|
| `control` | "Youngest child 6", "Youngest child Baby" | the Kids pill, its active chip, a parsed reading |
| `fit`, advice or plan | "From about 6", "Any age" | place card and page chips, trip card, trip hero, table cells |
| `fit`, rule | "Minimum age 8", "No minimum age" | the lock chip (operator or official rule) |
| `fits`, `advice_fail`, `rule_fail` | "Fits age 6", "Not suited to age 3", "Not for under 8 · operator rule" | day rows and stops against the chosen age |

The basis words of a trip stay: "From about 6 · our plan" (the plan's own number) and "From about 10 · checked" (computed or raised to the proven floor).
A place's basis is drawn by the chip's look (lock for a rule, person for advice), not by extra words. Ticket price tiers ("Ages 6–12") are not a
suitability age and keep their own wording.

**One source of truth for a plan's age.** `statedAge()` in `web/lib/public/trips.ts`: a plan whose own file names a family profile states that
profile's youngest age ("families with a child from about 6"); every other plan states its typed `ageFit`. The card tag, the hero chip, the plan bar and
the Youngest child filter all start from it, so the Rockies read "From about 6 · our plan" on the card and "From about 6" in the hero, as the plan says. A computed
value or the proven floor still replaces a plan's number when the records allow it (`tags.ts`), and the report `research/trip-tag-conflicts.md`
lists the difference. With `?kid=6` the Rockies fits; with `?kid=5` it fades, since the plan was written for 6.

## Change log

| Date | Change |
|---|---|
| 2026-10-18 | First design: six kinds, chip vocabulary (rule, advice, gap, fits, two fails), card and day-row merging, three filter labels, 13 acceptance checks, 10 conflicts with resolutions; mock rendered at 1440 and 390 in light and dark |
| 2026-10-19 | S1 Part B: D11 settles 3.21 (a bungee page keeps its one-row "Effort and time" group); the built page implements sections 1 to 4 and the three chip looks, with native disclosures for groups and provenance |
| 2026-10-20 | FIXA: section 10, one age formatter and one stated age per plan (REVIEW4 4.24); the rule chip reads "Minimum age N" |
| 2026-10-18 | CF: "No minimum age" moves from `none_stated` to the new `no_limit` state; section 9 records the pending `usable_partial` label "usable, partly unverified" |

## Rendering check (18 Oct 2026)

Chromium 1248 on the Arc GPU (`--use-gl=angle --use-angle=gl`), 1440 and 390 at 2x, light and dark, read in
viewport tiles. Fixed during the check, and now rules in this page:
- A phone document 413 px wide: the hot spring's limits chip and the raft fit chip were wider than their
  columns. Each value in a limits chip is now at most about 14 characters ("adult under 12", not "under 12
  with an adult"), and the rule-fail chip reads "Not for under 6 · operator rule", not "Not for a 5-year-old".
- The day-row effort chip carried the time and overflowed a 246 px phone column; day rows drop the time
  (the entry's duration already shows it). Place pages and cards keep "1–1 h 30".
- Card chips truncated with an ellipsis at four columns; cards now let the chip row wrap to two lines and
  never truncate a chip (an exception to components 3.1's one-line chip row, recorded here).
- Collapsed group summaries ran together ("Easy · Parks Canada Easy 2.4 km"); items are now separated by a
  `--line-2` middle dot.
- On phone the collapsed group header kept its title and summary on one line; the summary now wraps under
  the title, indented to the row column.
- The provenance popover was absolutely positioned and covered the next row; it opens in flow under its row
  on the mock (the built page uses the real popover of components 5.2, anchored to the row).
- The research line "15 of 15" broke across its count on phone; the count no longer wraps.
