# Vehicle & rental gap-close — the unpaved-road clause, UT-261, and what to actually book

Trip: **10 Sep – 4 Oct 2028**, Las Vegas (LAS) pickup → Salt Lake City (SLC) drop-off, ~2,400 mi.
Drivers: two adults, both over 25, Canadian licences, Canadian residents. Test age for the booster rules: a child of 11.

This file closes the seven open questions left by `research-logistics.md` §5–§6. It does not
replace that file; it corrects and extends it. Read §6.4 there first for the baseline.

**Headline: the prior research's conclusion is right about the contract text and wrong about the
consequence.** Every major does ban unpaved roads. But because this rental *commences in Nevada*,
Nevada statute caps what the damage waiver may exclude, and the cap is causation-based. That
changes the answer materially.

---

## Contents

1. [The crux — does "unpaved" catch a graded numbered state highway?](#1-the-crux)
2. [Clause-by-clause, verbatim, with URLs](#2-clause-by-clause-verbatim)
3. [The Nevada override — NRS 482.31555 and why it is the whole ballgame](#3-the-nevada-override)
4. [Which company most plausibly permits UT-261](#4-which-company-most-plausibly-permits-ut-261)
5. [One-way LAS→SLC drop fee](#5-one-way-lasslc-drop-fee)
6. [Which booking class genuinely delivers AWD/4WD](#6-which-booking-class-genuinely-delivers-awd4wd)
7. [Moab Jeep day-hire as the fallback](#7-moab-jeep-day-hire)
8. [Foreign licence, additional drivers, age](#8-foreign-licence-additional-drivers-age)
9. [Child seat / booster law for a child of 11, five states](#9-child-seat--booster-law-for-a-child-of-11)
10. [RECOMMENDATION](#10-recommendation)
11. [Open GAPs](#11-open-gaps)

---

## 1. The crux

**Does the unpaved-road exclusion apply to UT-261 / the Moki Dugway?**

UT-261 is a numbered, state-maintained Utah highway; ~3 mi of it (the Dugway) is graded gravel at
10–11% grade. So the question is which *test* each contract uses:

| Test used | Does UT-261's Dugway fail it? | Who uses this test |
|---|---|---|
| "on unpaved roads" / "unpaved road or off-road" | **Yes — fails.** The surface is gravel. Nothing in the wording turns on maintenance, numbering or ownership. | Avis, Budget, Enterprise, National, Alamo, Sixt (waiver clause) |
| "off paved roads **or on roads which are not regularly maintained**" | **Yes — fails the first limb.** The "or" is disjunctive: leaving pavement is enough; being maintained does not rescue it. | Hertz (prohibited-use §5) |
| "other than on a paved road **or graded private road or driveway**" | **Yes — fails.** It is graded, but it is *public*, not private. The carve-out does not reach it. | Sixt (prohibited-use §7) |
| "'Off roading' or driving on **undeveloped or unimproved** roads" | **Arguably no.** A graded, signed, numbered, maintained state highway is a developed and improved road. This is the only wording with a real argument. | Turo |
| "regularly maintained **hard surface** roadways" | **Yes — fails.** Gravel is not a hard surface. | Hertz (Iowa-variant LDW wording; not the Nevada wording) |

**Bottom line on the text: five of the six wordings catch the Moki Dugway. Only Turo's
"undeveloped or unimproved" test has a defensible argument that a graded numbered state highway
is outside the exclusion — and Turo has other problems (§2).** "Graded", "maintained", "state
highway" and "numbered route" appear nowhere as carve-outs in any major's contract.

There is one important structural point: **prohibited-use breach and waiver-exclusion are two
different things.** A prohibited-use breach lets the company terminate the rental and sue for
breach. Whether it also strips the damage waiver depends on the waiver clause — and in Nevada,
statute controls that. See §3.

---

## 2. Clause-by-clause, verbatim

### Avis — §1.5(a)(7) prohibited use (Avis Budget Group drafting)

> "1.5(a)(7) Use the Vehicle (i) to carry hazardous materials; (ii) in a test, race, or contest;
> **(iii) on unpaved roads**; and/or (iv) recklessly or while overloaded"

And in the damage-waiver disclosure on the same page, the waiver does not apply to loss from:

> "…use or operation by an unauthorized driver; violation of the terms of the Rental Agreement;
> **operating off paved roads**, use to push or tow something; or obtaining car through fraud or
> misrepresentation."

Source: <https://www.avis.com/en/legal-documents/rental-terms> (fetched and text-extracted
2026-09-05; the page serves the Avis Budget Group unified terms, paragraph numbering 1.5).
Prior research also has the older Avis §15 "AUTOMATICALLY TERMINATE… AND VOIDS ALL LIABILITY
PROTECTION" formulation — see `research-logistics.md` §6.4.

### Budget — §1.5, identical drafting

Same corporate group, same numbering, same clause. Prior research §6.4 quotes the all-caps
voiding sentence verbatim. Source: <https://www.budget.com/en/legal-documents/rental-terms>

### Enterprise / National / Alamo — one contract, three brands

These are Enterprise Holdings brands running the **same master rental agreement text**. Verified
directly in National's own Emerald Club Master Rental Agreement PDF:

> "**16. Limits on Use** … (10) **Vehicle shall not be driven on an unpaved road or off-road.**"

> "**17. Optional Loss Damage Waiver (LDW).** … The following actions shall invalidate LDW:
> a. if vehicle is damaged when used or driven: … **(10) on an unpaved road or off road**;"

Sources:
<https://national.spin-cdn.com/media/emerald_club_program_rules_and_conditions_pdfs/20170607_ec_final_2017.pdf>
(p. 21 and p. 26) and the identically-worded
<https://nationalcar.com.mx/pdf/EmeraldClub-Master-Rental-Agreement-2016.pdf>.
Enterprise-brand version of the same text:
<https://legislature.vermont.gov/Documents/2018/WorkGroups/House%20Judiciary/Bills/S.105/S.105~Enterprise%20Car%20Rental~Enterprise%20Car%20Rental%20Terms%20and%20Conditions~4-10-2018.pdf>

The same National PDF explicitly states the brands share terms:
> "such rental shall otherwise be deemed a National rental subject to the terms of this Rental
> Agreement. Renter agrees that the terms and conditions of the **Enterprise brand rental
> agreement** shall apply only to the extent of any required disclosures under state or provincial
> law."

**Alamo:** alamo.com returns 403 to every automated fetch. Alamo is the third Enterprise Holdings
brand and the shared-text clause above is the basis for treating it identically.
`GAP:` an Alamo-branded copy of the clause — alamo.com/en/rental-terms-and-conditions.html,
/content/dam/alamo/pdf/us/rental-terms.pdf and /en/car-rental/one-way.html all 403 to curl;
WebFetch renders the one-way marketing page only, which carries no drop-charge language.

### Hertz — §5 prohibited use, and it is the *softest* wording of any major

> "**d. ENGAGE IN ANY WILLFUL OR WANTON MISCONDUCT, WHICH, AMONG OTHER THINGS, MAY INCLUDE
> RECKLESS CONDUCT SUCH AS: THE FAILURE TO USE SEAT BELTS, THE FAILURE TO USE CHILD SEATS OR OTHER
> CHILD RESTRAINTS WHERE LEGALLY REQUIRED, USE WHEN OVERLOADED, USE OFF PAVED ROADS OR ON ROADS
> WHICH ARE NOT REGULARLY MAINTAINED, LEAVING THE CAR AND FAILING TO REMOVE THE KEYS…**"

And the link to the waiver:

> "e. **USE OF THE CAR IN A MANNER PROHIBITED IN PARAGRAPH 5 OF THESE TERMS AND CONDITIONS WILL,
> TO THE EXTENT PERMITTED BY APPLICABLE LAW, VOID LDW**…"

Source: <https://images.hertz.com/pdfs/09_2016_TermsandConditions_Gold_enUS.pdf> (US Gold Terms &
Conditions; §5 prohibited uses, §4(e) LDW void). This closes the GAP left in
`research-logistics.md` §6.4, which could not find Hertz's verbatim clause.

Two things worth noting about the Hertz wording:
- It frames off-pavement use as an **example of willful or wanton misconduct**, not as a standalone
  prohibition. That is arguably a higher bar than Avis/Enterprise's flat ban — a careful daytime
  descent of a signed state highway is hard to characterise as wanton. It is an argument, not a
  safe harbour.
- The phrase "**TO THE EXTENT PERMITTED BY APPLICABLE LAW**" is what imports the Nevada statute
  in §3.

Hertz's Iowa variant uses a different and stricter test — "**OPERATING THE CAR OTHER THAN ON
REGULARLY MAINTAINED HARD SURFACE ROADWAYS, INCLUDING PRIVATE DRIVEWAYS AND PARKING LOTS**" —
which shows Hertz knows how to write a hard-surface test when it wants one, and did not use it in
the Nevada or general clause.

### Sixt — the only major with a "graded" carve-out, but it is limited to *private* roads

Prohibited uses §7, identical in the Nevada and Utah state forms:
> "• **On other than a paved road or graded private road or driveway**;"

Utah LDW exclusion:
> "(g) **is caused by driving on unpaved roads**"

Sources: <https://www.sixt.com/shared/t-c/sixt_US_en_NEVADA.pdf> ·
<https://www.sixt.com/shared/t-c/sixt_US_en_UTAH.pdf>

UT-261 is graded but **public**, so the carve-out does not help. Sixt's Nevada form also carries
the statutory block (§3).

### Turo — the most permissive *wording*, the least usable *protection*

> "'Off roading' or driving on undeveloped or unimproved roads"

is a prohibited use, with the stated consequence of "voiding your protection for any physical
damage to a host's vehicle."
Sources: <https://help.turo.com/en_us/prohibited-uses-Hyi0E4l49> · <https://turo.com/us/en/policies/terms>

"Undeveloped or unimproved" is a genuinely different test and a maintained numbered state highway
is a strong candidate for being neither. **But:**
- Turo is not a "short-term lessor" leasing a "passenger car" in the sense of NRS 482.3151–482.3159,
  so the Nevada statutory cap in §3 that rescues the majors most likely does **not** apply to a
  Turo booking. `GAP:` no Nevada authority found either way on whether peer-to-peer car sharing
  falls inside NRS 482.3151–.3159. Treat as "probably not covered".
- Nothing lets an individual host waive the platform-level prohibition. A host's text message
  saying "sure, go ahead" restores nothing.
- No Turo host will do a 25-day LAS→SLC one-way at a sane price.

Turo is not the answer here. Its wording is interesting, not useful.

### Dollar / Thrifty

`GAP:` verbatim unpaved clause still not obtainable — dollar.com General Policies only says LDW
"does not apply if: (1) the renter uses the vehicle in violation of the Rental Agreement", and
thrifty.com serves no static terms page. Both are Hertz brands; assume Hertz-family wording.
<https://www.dollar.com/AboutUs/GeneralPolicies.aspx>

---

## 3. The Nevada override

This is the single most consequential finding in this file, and it was not in the prior research.

**NRS 482.31555 — "Short-term lessor authorized to restrict applicability of waiver of damages
under certain circumstances"** is an *exhaustive permissive list*. A Nevada lessor **may** exclude
the waiver only in the enumerated circumstances:

> "A short-term lessor **may** provide in a lease of a passenger car that a waiver of damages does
> not apply in the following circumstances:
> **1.** Damage or loss resulting from an authorized driver's:
> (a) Intentional, willful, wanton or reckless conduct.
> (b) Operation of the car in violation of NRS 484C.110 [DUI].
> (c) Towing or pushing with the car.
> **(d) Operation of the car on an unpaved road if the damage or loss is a direct result of the
> road or driving conditions.**
> **2.** Damage or loss occurring when the passenger car is: (a) Used for hire. (b) Used in
> connection with conduct that constitutes a felony. (c) Involved in a speed test or contest or in
> driver training activity. (d) Operated by a person other than an authorized driver.
> **(e) Operated in a foreign country or outside of the States of Nevada, Arizona, California,
> Idaho, Oregon and Utah, unless the lease expressly provides that the passenger car may be
> operated in other locations.**"

Source: <https://nevada.public.law/statutes/nrs_482.31555>
(official: <https://www.leg.state.nv.us/NRS/NRS-482.html#NRS482Sec31555> — leg.state.nv.us 403s to
automated fetch)

And it cannot be contracted around:

> "**NRS 482.3159 Waiver of provisions is void.** A waiver of any of the provisions of NRS 482.3151
> to 482.3159, inclusive, is contrary to public policy and is **void and unenforceable**."

Source: <https://nevada.public.law/statutes/nrs_482.3159>

"Passenger car" is defined broadly enough to cover any SUV:

> "'Passenger car' means a motor vehicle designed for carrying **10 persons or less**, except a
> motorcycle, an electric bicycle, an electric scooter or a moped."

Source: <https://nevada.public.law/statutes/nrs_482.087>
(A 12-passenger van would fall outside this. Any SUV or minivan on this trip is inside it.)

### The majors implement it, verbatim, in their Nevada blocks

**Hertz** — "FOR RENTALS COMMENCING IN NEVADA":
> "IF YOU HAVE ACCEPTED LDW, THEN YOUR LDW WILL BE VOID AND YOU WILL BE RESPONSIBLE FOR LOSS OR
> DAMAGE TO THE CAR **ONLY IN THE FOLLOWING CIRCUMSTANCES**: (i) DAMAGE OR LOSS RESULTING FROM (A)
> THE INTENTIONAL, WILLFUL, WANTON OR RECKLESS CONDUCT…, (C) … TOW OR PUSH ANYTHING, OR **(D)
> OPERATION OF THE CAR BY YOU OR AN AUTHORIZED OPERATOR ON AN UNPAVED ROAD IF THE DAMAGE OR LOSS
> IS A DIRECT RESULT OF THE ROAD OR DRIVING CONDITIONS**; (ii) … (E) OPERATED OUTSIDE OF THE
> UNITED STATES OR CANADA…"

Source: <https://images.hertz.com/pdfs/09_2016_TermsandConditions_Gold_enUS.pdf>

**National / Enterprise / Alamo** — "FOR RENTALS ORIGINATING IN NEVADA":
> "The following invalidate LDW: a. Damage or loss resulting from: (1) the intentional, willful,
> wanton or reckless conduct…; (2) operation … under the influence…; (3) … tow or push anything;
> or **(4) operation of the Vehicle by Renter or AAD(s) on an unpaved road if the damage or loss
> is a direct result of the road or driving conditions**;"

Source: <https://national.spin-cdn.com/media/emerald_club_program_rules_and_conditions_pdfs/20170607_ec_final_2017.pdf>
(pp. 52–54, block headed "FOR RENTALS ORIGINATING IN NEVADA")

**Sixt** — Nevada form, same block:
> "…an Authorized Driver's: (i) intentional, willful, wanton, or reckless conduct; (ii) operation
> of the Vehicle while intoxicated in violation of Nevada Revised Statutes 484C.110; or (iii) use
> of the Vehicle to push or tow anything, **or on an unpaved road if the damage or loss is a
> direct result of the road or driving conditions**"

Source: <https://www.sixt.com/shared/t-c/sixt_US_en_NEVADA.pdf>

### What this actually means for the Moki Dugway

For a rental **picked up at Las Vegas**:

- Driving UT-261 is still a **breach of the limits-on-use clause**. That is unchanged. The company
  can terminate the rental. Do not tell them you did it.
- But the **damage waiver is not automatically voided**. It is voided only if the loss "is a direct
  result of the road or driving conditions". Park at the Muley Point pullout and get rear-ended by
  another tourist? Covered. Slide a wheel off the shelf on wet gravel? Not covered — that is
  squarely "a direct result of the road".
- Blanket "any violation automatically voids all protection" wording of the Avis/Budget kind is,
  as to the *damage waiver*, unenforceable against a Nevada-commencing rental by force of NRS
  482.3159. Avis and Budget do not publish a Nevada block, which is a mild negative signal — you
  would be relying on the statute over their drafting rather than on their own text.
- **Liability protection (SLI) and roadside/PAI are separate products and are NOT protected by
  this statute.** NRS 482.3151–.3159 covers the *waiver of damages* only. A prohibited-use breach
  can still knock out supplemental liability cover. This matters more than the collision exposure
  on a road with no railings.

### The trap nobody has flagged: Colorado and Wyoming

NRS 482.31555(2)(e) lets the lessor exclude the waiver for operation "outside of the States of
Nevada, Arizona, California, Idaho, Oregon and Utah, **unless the lease expressly provides** that
the passenger car may be operated in other locations."

**This itinerary drives through Colorado and Wyoming, neither of which is on that list.** You are
fine only because the majors' contracts expressly permit US-wide operation:

- National/Enterprise/Alamo §16(9): "Vehicle shall not be driven or taken outside the **United
  States and Canada**" — i.e. anywhere inside the US is expressly permitted.
- Hertz Nevada block (ii)(E): waiver void only if "**OPERATED OUTSIDE OF THE UNITED STATES OR
  CANADA**".
- Sixt Nevada is the risk: its LDW excludes loss that "results from use of the Vehicle **outside
  the geographic area specified on the Face Page**". If Sixt writes a restricted state list onto
  the face page at the counter, Colorado and Wyoming days are uninsured.

**Action at the counter: confirm the rental agreement expressly permits operation in all 50 US
states, and that no restricted-state list appears on the face page.** This takes ten seconds and
is worth more than any other question you can ask.

---

## 4. Which company most plausibly permits UT-261

**Plainly: NONE of them permits it.** There is no major US rental contract under which driving the
Moki Dugway is a permitted use. Anyone who tells you otherwise is reading a marketing page, not a
contract. That is the honest answer to the question as asked.

The useful question is *which contract leaves you least exposed when you do it anyway*, and there
is a clear ranking for a Nevada-commencing rental:

| Rank | Company | Why |
|---|---|---|
| **1** | **Hertz** | Only major whose prohibited-use clause conditions the off-pavement example on "**willful or wanton misconduct**" rather than banning it flat; publishes an explicit Nevada block capping LDW voiding to causation; expressly permits US/Canada-wide operation. |
| **1=** | **National / Enterprise / Alamo** | Flat ban in §16(10), *but* publishes the same Nevada statutory block, so the waiver survives absent road-caused damage; expressly permits US/Canada-wide operation; best one-way and best AWD class control (§5, §6). |
| 3 | Sixt | Same Nevada block, but the "geographic area specified on the Face Page" exclusion is a live risk for the Colorado/Wyoming legs, and the "graded **private** road" carve-out does not reach a public highway. |
| 4 | Avis / Budget | Flat ban plus all-caps "automatically voids all liability protection" drafting and **no published Nevada block**. The statute should override, but you would be litigating their own text. Worst drafting to be on the wrong side of. |
| 5 | Turo | Best wording ("undeveloped or unimproved"), almost certainly outside the Nevada statutory protection, no one-way, no 25-day product. |

**If a single name is wanted: National (or Enterprise/Alamo — same paper).** It ties Hertz on the
contract question and wins decisively on items 5 and 6.

---

## 5. One-way LAS→SLC drop fee

Published policy is unchanged from `research-logistics.md` §6.1 and re-verified:

- **National:** "There is typically **no drop charge** (also called an 'inter-city fee') for
  one-way rentals between airport locations." + "*Restrictions may apply."
  <https://www.nationalcar.com/en/car-rental/one-way.html>
- **Enterprise:** drop charge "varies depending on location and time of year… disclosed at the time
  of reservation." <https://www.enterprise.com/en/car-rental/one-way.html>
- **Alamo:** no drop-charge statement at all; the page says only that "prices vary by location,
  vehicle, date and availability" (re-fetched 2026-09-05).
  <https://www.alamo.com/en/car-rental/one-way.html>
- Avis §8 "one way service fee"; Budget §1.4(b) "different rates and additional fees"; Hertz
  "intercity fee"; Sixt "one-way charge or service fee"; Dollar/Thrifty "a one-way drop fee will
  apply." No schedules published by any of them.

**LAS and SLC are both major airport locations in the Enterprise Holdings network**, which is
exactly the fact pattern National's "typically no drop charge between airport locations" sentence
describes. That remains the only written commitment on the market.

`GAP: an actual quoted LAS→SLC drop fee.` Not closeable now, and not for a mechanical reason:

- Every major's rate engine is client-side JavaScript; enterprise.com, alamo.com and hertz.com all
  return 403 to automated fetching. Aggregators (qeeq.com, roadgenius.com) render prices in JS and
  returned no figures on fetch.
- More fundamentally, **September 2028 is roughly 24 months out and no US major opens inventory
  that far ahead.** There is nothing to quote yet.
- Third-party guidance puts generic US one-way drop fees at "$200–600" depending on company and
  distance, which is a range, not a quote, and is not route-specific.
  <https://roadsuv.com/car-rental-guides/one-way-car-rental-avoid-drop-off-fees/>

**How to close it:** around **September–October 2027**, run the same LAS→SLC 10 Sep–4 Oct query on
nationalcar.com, hertz.com and avis.com and compare all-in totals. Until then, treat National as
the working assumption and budget a contingency of USD 0–600 for the drop charge.

---

## 6. Which booking class genuinely delivers AWD/4WD

The prior finding stands and is re-verified live against
<https://www.nationalcar.com/en/rental-cars/us/suvs/> (fetched 2026-09-05). National is the only
major that publishes drivetrain as a class attribute, and the plain SUV classes are 2WD.

**National's current US SUV classes, exactly as published:**

| Class | Published example models | Seats | Drivetrain |
|---|---|---|---|
| Compact SUV | Hyundai Kona or similar | 5 | 2WD |
| **Compact SUV AWD** | Hyundai Kona AWD or similar | 5 | AWD |
| Midsize SUV | Nissan Rogue or similar | 5 | 2WD |
| **Midsize SUV AWD** | Nissan Rogue AWD or similar | 5 | AWD |
| Standard SUV | Chevrolet Equinox or similar | 5 | 2WD |
| **Standard SUV AWD** | Chevrolet Equinox or similar | 5 | AWD |
| **Intermediate SUV 4WD** | Ford Edge 4WD or similar | 5 | 4WD |
| Full Size SUV | Chevrolet Tahoe, Jeep Wagoneer, Ford Expedition or similar | 7 | 2WD |
| **Full Size SUV AWD** | Chevrolet Tahoe, Jeep Wagoneer, Ford Expedition or similar | 7 | AWD |
| Premium Crossover / **Premium Crossover AWD** | Dodge Durango or similar | 7 | 2WD / AWD |
| **Jeep** | Jeep Wrangler or similar | 4 | 4WD |
| **Jeep Wrangler 4 door** | Jeep Wrangler Unlimited or similar | 5 | 4WD |
| **Premium All-Terrain** | Jeep Wrangler Rubicon, Land Rover Defender AWD or similar | 4 | 4WD |

**Nothing here is a model guarantee.** Every entry says "or similar", and Hertz states the
principle in its terms:

> "In general, Hertz accepts reservations only for a **class of vehicles**, and not for vehicles
> either of specific makes, model years or models **or with particular characteristics not common
> to all vehicles in the class**."
> <https://www.hertz.com/rentacar/reservation/reviewmodifycancel/templates/rentalTerms.jsp?KEYWORD=LEGALUS&EOAG=LAS>

Avis states it more bluntly: "Renters reserve a car in a specific group, not a specific make and
model. **Vehicle make, model, trim, features and color are not guaranteed.**"

**So there are exactly three levers, in descending order of reliability:**

1. **Book a class whose *name contains* AWD or 4WD.** AWD then stops being "a characteristic not
   common to all vehicles in the class" and becomes the class definition. This is the only
   contractual lever that works. For this party: **Full Size SUV AWD** (7 seats, room for 25 days
   of luggage for three) or **Standard SUV AWD** if the price gap is large.
2. **Book a class whose name *is* a model** — "Jeep Wrangler 4 door" (Wrangler Unlimited or
   similar, 5 seats) or "Premium All-Terrain" (Rubicon / Defender, 4 seats). These buy genuine
   ground clearance (Wrangler base ~9.7 in, Rubicon more) rather than the ~7.4–8.4 in that a Tahoe
   or Telluride actually has. Trade-off: a 4-door Wrangler over 2,400 mi of interstate and
   mountain passes with three people and 25 days of bags is loud, thirsty and short on cargo. The
   Premium All-Terrain class is published as **4 seats**, which is tight for three plus luggage.
3. **National Emerald Aisle at LAS** — "Choose your own car — Choose any make, model and color at
   the reserved Midsize rate. The keys are in the cars." Offered at both Las Vegas and Salt Lake
   City. You physically inspect the drivetrain badge before taking the keys. Not a contractual
   guarantee, but it is the practical answer and it is free.
   <https://www.nationalcar.com/en/emerald-club/services/emerald-aisle.html>

**Hertz:** `GAP:` Hertz's guaranteed-model programmes could not be verified. hertz.com/us/en/vehicles/*
and the "American Collection" Jeep pages are fully client-side and return an empty document body to
both curl and WebFetch. What is known: the **Adrenaline Collection is performance cars only** (six
V8 models) and does not include the Wrangler; Hertz separately announced a **Jeep Wrangler 4xe
collection** in a press release, which is marketing rather than a contractual model guarantee, and
is a plug-in hybrid — the wrong tool for 2,400 miles of remote Utah with sparse charging.
<https://newsroom.hertz.com/press-releases/press-release-details/it-s-a-hertz-jeep-r-4x4-thing-hertz-adds-2025-jeep-wrangler-to-its-newest-fleet-yet/>

**The ground-clearance point from `research-logistics.md` §6.2 is unchanged and important:** even
"Full Size SUV AWD" gets you a Tahoe/Expedition/Wagoneer at roughly car-like clearance with poor
approach and departure angles. AWD ≠ clearance. For the Moki Dugway (a graded road, not an
obstacle course) that is fine. For Shafer Trail and the Moonscape Overlook spur it is not.

---

## 7. Moab Jeep day-hire

| Operator | Rate | Min age | Insurance / deposit | Trails permitted | One-way |
|---|---|---|---|---|---|
| **Canyonlands Jeep and Car Rentals**, Moab | **$330/day (2026), $345/day (2027)**; 200 free miles/day; 10-hour rental period. 2028 not yet published. | **25** | CDW **$40/day, $7,000 deductible**. CDW **required for international renters** without US-based full-coverage insurance. **"We do not accept insurance issued through Credit Card companies."** Optional glass & tyre cover **$25**, "highly recommend[ed] … when renting vehicles that are going to be traveling on non-paved roads." No debit cards. | Explicitly recommends **Shafer Trail**, Gemini Bridges, Fins and Things, Onion Creek. Rubicons with 2" Mopar lift and 35" tyres. A trail guide comes with the rental and names the prohibited trails. | **No** — two in-town locations plus airport only. |
| **Twisted Jeeps**, Moab (also Silverton CO) | Wrangler 4-dr **$345 (1–2 days) / $315 (3–4) / $285 (5+)**; Gladiator **$295 / $265 / $235** | **21** (note: differs from Canyonlands) | CDW "only waives damage **beyond $5,000.00**"; excludes property damage and bodily injury; **available to non-residents only**. Additional drivers need their own full-coverage insurance or proof of coverage. Full comprehensive insurance mandatory for US citizens. Pets $500 penalty. Cancel 7 days ahead for full refund. | No named trail restrictions published. | Not stated. |
| **Cliffhanger Jeep Rental**, Moab (1331 US-191, 435-259-0889) | `GAP` — no rates published | `GAP` | `GAP` | Advertises "Modified and Extreme Jeep Rubicons" and local trail guidance; 10 locations incl. Moab, Telluride, Silverton, Durango — relevant if you also want a San Juans day. | `GAP` |

Sources: <https://www.canyonlandsjeep.com/jeep-rentals/> · <https://twistedjeeps.com/reservations/> ·
<https://www.cliffhangerjeeprental.com/>

**On the Moki Dugway specifically:** none of these operators publishes a restriction that would
catch UT-261, and it would be perverse if they did — it is a public state highway, and the Dugway
is a 45-minute detour from Moab's trail network, not part of it. Their restrictions target named
technical 4x4 trails. **But the Dugway is 150 mi from Moab (2.5 h each way), so hiring a Moab Jeep
to drive the Moki Dugway makes no sense.** The Moab Jeep solves Shafer Trail, not UT-261.

`GAP:` an operator's explicit written permission covering UT-261 — none publishes a road-by-road
list. Ask by email when booking; get it in writing.

Both Canyonlands and Twisted publish 2027 pricing already, so an early booking locks the rate.
Budget **~$390–420/day all-in** for one Canyonlands day with CDW and glass/tyre cover.

---

## 8. Foreign licence, additional drivers, age

Confirmed and unchanged from `research-logistics.md` §6.7, plus three additions:

- **A Canadian provincial licence is sufficient. No IDP needed.** "Canadians with a provincial or
  territorial driver's licence do not need an IDP to drive in the U.S."
  <https://travel.gc.ca/travelling/documents/international-driving-permit>
  Do **not** rely on an IDP alone — Hertz: "You can't rent a Hertz vehicle with only an
  International Driver's Permit."
- **Bring the passport.** Avis LAS: "If the drivers license is not U.S.-issued, you must present
  your drivers license **and either a passport or a Canadian enhanced license** in the driver's
  name." <https://www.avis.com/en/locations/nam/us/nv/las-vegas/las>
- **No digital licences.** Avis and Enterprise both require a physical licence.
- **Both drivers are over 25, so no young-driver surcharge applies** (it would be $19–27/day, i.e.
  $475–675 over 25 days). No other foreign-resident restriction was found at any major — no
  foreign-renter surcharge, no proof-of-residence requirement, no restriction tied to
  non-US-resident status. Foreign-renter status only bites at the *Moab Jeep* operators, where it
  works in your favour at Twisted Jeeps (CDW is "available to non-residents only") and against you
  at Canyonlands (CDW becomes mandatory, at $40/day, and they will not accept credit-card cover).
- **NEW — the second adult driver is free and automatic at National/Enterprise/Alamo.** The master
  agreement defines an Additional Authorized Driver to include, without extra charge or separate
  listing:
  > "any individual, in addition to Renter, who (i) has permission of the Renter to drive Vehicle
  > and is **a member of Renter's immediate family (including same or opposite sex domestic
  > partner) who permanently resides with Renter** … All AADs must possess a valid driver's license
  > and meet the minimum rental age."
  <https://national.spin-cdn.com/media/emerald_club_program_rules_and_conditions_pdfs/20170607_ec_final_2017.pdf>
  Nevada statute reinforces this: NRS 482.31555(4)/the Nevada block define "authorized driver" to
  include "the renter's spouse if the spouse is a licensed driver and satisfies the car rental
  company's minimum age requirement."
- **NEW — credit card must be in the renter's name**, per the same agreement: "A valid credit card
  issued in Renter's name must be presented upon its initial use at time of rental." This closes
  the GAP left in `research-logistics.md` §6.7 about Enterprise's name-match rule. It is also the
  precondition for Canadian card CDW (see §6.5 there), and it rules out a debit-card one-way.
- Card CDW conclusion from `research-logistics.md` §6.5 is **partially softened** by §3 above: card
  CDW sits on top of the rental agreement's waiver. In Nevada that waiver now survives an unpaved
  detour unless the road caused the damage — so card CDW is not automatically worthless on the
  Dugway. It remains worthless if you damage the car *because of* the road. Book and pay the full
  rental on the RBC Avion (or equivalent) card, in the driver's name, and decline the counter CDW;
  25 days is inside the 48-day cap.

---

## 9. Child seat / booster law for a child of 11

**Answer up front: a child of 11 needs no booster in any of the five states. A properly fitted
adult lap-and-shoulder belt is legally sufficient in Nevada, Utah, Arizona, Colorado and Wyoming.**
The child is above every threshold in all five, and by a clear margin in four of them. The nearest
threshold is Colorado's and Wyoming's, both at age 9.

| State | Statute | Restraint required | Belt permitted from | Age 11 |
|---|---|---|---|---|
| **Nevada** | NRS 484B.157(1) | "a child who is **less than 6 years of age and who weighs 60 pounds or less**" must be in a child restraint system | age 6, or over 60 lb | **Belt. No booster.** |
| **Utah** | Utah Code 41-6a-1803(1)(a)(ii)–(iii) | "each person **younger than eight years old**" in a child restraint device; exempt if under 8 but **57 inches or taller** | "each person that is **at least eight years old and no less than 16 years old**" — properly fastened safety belt | **Belt. No booster.** |
| **Arizona** | ARS 28-907(A)–(B) | under 5 in a child restraint; and each passenger "**at least five years of age, who is under eight years of age and who is not more than four feet nine inches tall**" in a child restraint | age 8, or over 4'9" | **Belt. No booster.** |
| **Colorado** | CRS 42-4-236(2)(a)(I),(IV) and (2)(b), **as amended effective 1 Jan 2025** | "every child who is **under nine years of age** … shall be properly restrained in a child restraint system"; ages 4–8 and ≥40 lb: "in a child restraint system **or booster seat**; and **in the rear seat** of a vehicle, if a rear seat is available" | "every child who is **at least nine years of age but less than eighteen years of age** … properly restrained in a safety belt" | **Belt. No booster. No rear-seat mandate at 11.** |
| **Wyoming** | W.S. 31-5-1303(a) | "each child … **who has not reached his ninth birthday** is properly secured in a child safety restraint system **in a seat of the vehicle other than the front seat**" | age 9 | **Belt. No booster. No rear-seat mandate at 11.** |

Sources: <https://nevada.public.law/statutes/nrs_484B.157> ·
<https://le.utah.gov/xcode/Title41/Chapter6A/C41-6a-P18_1800010118000101.pdf> ·
<https://www.azleg.gov/ars/28/00907.htm> ·
<https://codes.findlaw.com/co/title-42-vehicles-and-traffic/co-rev-st-sect-42-4-236.html>
(current as of 1 Jan 2025, showing both the pre- and post-2025 text) ·
<https://wyoleg.gov/statutes/compress/title31.pdf> (Title 31, ch. 5, art. 13)

Notes worth carrying:
- **Colorado tightened its law on 1 Jan 2025**, raising the booster threshold from under-8 to
  under-9 and the belt-required age band from 8–16 to 9–18. Any pre-2025 summary you find online is
  wrong. It still does not reach a child of 11.
- Do **not** book a child seat from the rental company. Enterprise Holdings classifies child seats
  as "Optional Accessories", and its LDW expressly "**DOES NOT PROVIDE PROTECTION FOR … OPTIONAL
  ACCESSORIES**". You would be on the hook for a lost or damaged seat, and none is needed anyway.
- Every one of the five states' laws also requires the belt to fit properly. Wyoming even codifies
  this as the exemption test: "the lap and shoulder belts of the vehicle will fit properly across
  the collarbone, chest and hips of the child and the belts do not pose a danger to the neck, face
  or abdominal area." If the child is small for their age, bring a backless booster for
  comfort and fit — as a safety choice, not a legal one.
- Nevada's own rental-contract disclosure repeats the state seat-belt rule: "Nevada law requires any
  driver of a passenger car and any passenger **5 years of age or older** who rides in the front or
  back seat … to wear a safety belt."
- Hertz treats "THE FAILURE TO USE CHILD SEATS OR OTHER CHILD RESTRAINTS **WHERE LEGALLY REQUIRED**"
  as an example of willful/wanton misconduct voiding LDW. Since no restraint is legally required at
  11, this clause is not engaged.

---

## 10. RECOMMENDATION

**Book: National Car Rental, class "Full Size SUV AWD" (SIPP FFDR), LAS pickup → SLC drop-off,
25 days, on an Emerald Club membership. And yes — take one separate Moab Jeep day.**

Reasoning, in the order it matters:

1. **National is the only company that wins on all three axes at once.** Its Nevada block caps
   LDW voiding at causation, exactly as NRS 482.31555 requires (Hertz ties here); it is the only
   group with a *written* statement that one-way between airport locations typically carries no
   drop charge (Hertz, Avis, Budget and Sixt all reserve the right to charge an undisclosed fee);
   and it is the only company that publishes drivetrain as a class attribute so you can actually
   *buy* AWD instead of hoping for it.
2. **"Full Size SUV AWD", not "Full Size SUV".** The word AWD in the class name is the entire
   protection. Booking plain "Full-size SUV" buys a 2WD Tahoe. Confirm the AWD badge in the aisle
   before taking the keys — Emerald Aisle at LAS lets you do exactly that, at the reserved rate.
3. **Drive the Moki Dugway in that vehicle, in the dry, and understand what you are doing.** It is
   a limits-on-use breach at every major — there is no company under which it is permitted. But
   because the rental commences in Nevada, NRS 482.3159 makes the "automatically voids all
   protection" drafting unenforceable as to the damage waiver, and the waiver survives unless the
   loss is a direct result of the road. The residual exposure is real but bounded: gravel damage
   and any road-caused incident on those three miles. Do it dry, in daylight, in low gear, slowly.
   Do not attempt it wet or with snow forecast.
4. **Take the Loss Damage Waiver at the counter anyway**, and separately confirm the agreement
   expressly permits operation in all 50 states — the Colorado and Wyoming legs fall outside NRS
   482.31555(2)(e)'s default state list, and Sixt in particular restricts to a face-page geography.
   This is the single highest-value counter question.
5. **A separate Moab Jeep day IS needed — but for Shafer Trail, not for the Dugway.** Book
   **Canyonlands Jeep and Car Rentals**, one day, ~$345 + $40 CDW + $25 glass/tyre ≈ **$410 all-in**.
   They name Shafer Trail as a recommended route, their vehicles have the clearance and tyres for
   it, and it is the only structure under which those miles are actually insured. Minimum age 25,
   credit card only, no one-way, book early to lock 2027 pricing. Twisted Jeeps is the fallback at
   a similar rate with a lower age minimum and a $5,000 CDW threshold.
6. **Drop Factory Butte, the Moonscape Overlook spur and Yankee Boy Basin from the main-rental
   itinerary**, or fold Moonscape into the Moab Jeep day if the routing allows. Those need real
   clearance, not AWD, and a Tahoe on 20-inch road tyres is the wrong vehicle regardless of what
   the contract says.
7. **No booster seat.** Nothing to buy, nothing to book, nothing to declare, in any of the five
   states.
8. **Costs to carry:** drop fee $0–600 (unknown until ~Sept 2027); Moab Jeep ~$410 for one day;
   no under-25 surcharge; second driver free as a resident domestic partner; no IDP.

**What would change this recommendation:** if the LAS→SLC one-way quote at National in autumn 2027
comes in materially above Hertz's, switch to Hertz — its prohibited-use wording is the softest of
any major and it publishes the same Nevada block. Do not switch to Avis or Budget at any price;
their drafting is the worst to be on the wrong side of and they publish no Nevada block. Do not use
Turo, whose wording is the most favourable and whose statutory protection is almost certainly
absent.

---

## 11. Open GAPs

| # | Gap | Source that failed | How to close |
|---|---|---|---|
| 1 | Actual quoted LAS→SLC one-way drop fee | nationalcar.com / hertz.com / avis.com rate engines are client-side JS; enterprise.com and alamo.com return 403 to all automated fetches; qeeq.com and roadgenius.com render prices in JS and returned no figures | Sept 2028 inventory is ~24 months out and not yet loaded by any US major. Re-run the query manually around **September–October 2027**. |
| 2 | Alamo-branded copy of the unpaved clause | alamo.com/en/rental-terms-and-conditions.html, /content/dam/alamo/pdf/us/rental-terms.pdf, /en/car-rental/one-way.html — all HTTP 403 | Rely on the Enterprise Holdings shared-text provision quoted in §2, or pick up a printed agreement at an Alamo counter. |
| 3 | Whether Hertz's Jeep/4x4 collection is a *guaranteed* model booking | hertz.com/us/en/vehicles/jeep/wrangler and the American Collection Jeep page return an empty document body to both curl and WebFetch (fully client-side) | Phone Hertz Gold reservations and ask whether the class is model-guaranteed at LAS. |
| 4 | Currency of the Enterprise Holdings and Hertz T&C documents used here | The National Emerald Club master agreement fetched is dated 2017 and the Hertz US Gold T&C is dated 2016; both companies' current terms pages are unfetchable | The Nevada carve-out is **statutory** (NRS 482.31555 + 482.3159), so it binds regardless of contract vintage. Still, verify the counter agreement at pickup. |
| 5 | Whether Nevada's short-term-lessor statute reaches Turo | No Nevada authority located either way on peer-to-peer car sharing under NRS 482.3151–.3159 | Moot if Turo is not used, as recommended. |
| 6 | Cliffhanger Jeep Rental rates, age minimum, CDW, deposit | cliffhangerjeeprental.com publishes none of it | Phone 435-259-0889. |
| 7 | Written operator permission covering UT-261 specifically | No Moab operator publishes a road-by-road permitted list | Email the operator and keep the reply. Moot under the recommendation, since the Dugway is driven in the main rental. |
| 8 | Dollar/Thrifty verbatim unpaved clause | dollar.com General Policies has only the "in violation of the Rental Agreement" formula; thrifty.com serves no static terms page | Moot under the recommendation. |

