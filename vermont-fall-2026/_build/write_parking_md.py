import json
C=json.load(open("_build/parking-curated.json")); B=C["best"]; U=C["unmapped"]
ORD=["Stowe Pinnacle trailhead","Pinnacle Meadows overflow lot","Moss Glen Falls (Stowe)",
"Stowe Community Church","Stowe Gondola SkyRide","Bingham Falls","Barnes Camp boardwalk",
"Smugglers' Notch","Sunset Rock, Stowe","Mount Pisgah South trailhead","Lake Willoughby South Beach",
"Lake Willoughby North Beach","Craftsbury Common","Craftsbury General Store","Barr Hill Natural Area",
"Fisher Covered Railroad Bridge","Prospect Rock, Johnson","Cambridge Junction / Poland Bridge",
"Gates Farm Covered Bridge","Longley Covered Bridge","Comstock Covered Bridge","Fuller Covered Bridge",
"Hutchins Covered Bridge","Creamery Covered Bridge, Montgomery","Great Eddy Covered Bridge, Waitsfield",
"Warren Falls","Lincoln Gap (top of pass)","Sunset Ledge trailhead","Appalachian Gap overlook",
"Mount Elmore / Elmore State Park","Emily's Bridge (Gold Brook)","Missisquoi NWR visitor centre"]
o=["""# PARKING — every stop
Researched 7 Sept 2026 against OpenStreetMap (Overpass), plus the two pins you supplied.
**This matters more than usual on this trip**: the schedule's early starts exist because the lots
are tiny, not because the driving is long.

**Confidence column:**
`OSM` = a real mapped lot, coordinates verified · `USER` = a Google pin you sent ·
`ROADSIDE` = no lot exists, you park on the verge · `GAP` = a lot exists but is not mapped anywhere
I can verify — **send me a Google pin like you did for the Pinnacle**.

| Stop | Parking | Conf. | Map | Notes |
|---|---|---|---|---|"""]
for nm in ORD:
    if nm in B:
        la,lo,label,conf,note=B[nm]
        o.append(f"| {nm} | {label} | `{conf}` | [pin](https://maps.google.com/?q={la},{lo}) | {note} |")
    elif nm in U:
        note=U[nm]; conf="GAP" if "NEEDS A GOOGLE PIN" in note else ("ROADSIDE" if "Roadside" in note or "Street" in note else "note")
        o.append(f"| {nm} | {'**unverified**' if conf=='GAP' else 'roadside / none'} | `{conf}` | — | {note} |")
o.append("""
## The four I could not verify — please send a Google pin

OpenStreetMap simply has no lot mapped for these, and guessing a trailhead lot is exactly the
error that had you circling a back road at the Pinnacle.

1. **Mount Pisgah South trailhead** — the one that matters most; it is Saturday's hike. Sources say
   lots on **both sides of VT-5A**. The only mapped lot nearby is *Willoughby Lake South End*,
   **1.5 km away and the wrong one** — do not let the GPS send you there.
2. **Lake Willoughby South Beach** — roadside on VT-5A. Free as of Apr 2026, but a fee was "in
   talks" — check signage on the day.
3. **Prospect Rock, Johnson** — Long Trail roadside lot on VT-15.
4. **Mount Elmore** — you drive into the state park and park inside, so there is no separate lot to
   pin, but note the **gate does not open until 10:00**.

## What the verified data changed

- **Lincoln Gap has two named lots 94 m apart** — *Lincoln Gap Long Trail Trailhead Parking* and
  *Sunset Ledge Trail Head Parking*. The research said "about 100 yards"; that is now exact.
  **Sunset Ledge is Long Trail SOUTH, so use the southern lot.**
- **Sunset Rock's lot is tagged capacity 10** — the second-smallest confirmed lot on the trip after
  the Pinnacle's nine.
- **Appalachian Gap's overlook lot is 14 m from the viewpoint**, asphalt and public. That is the
  drive-up claim, confirmed in data.
- **Bingham Falls has a named lot 340 m from the gorge** — the falls pin and the parking pin are
  not the same place, which matters on a road with limited pull-offs.
- **Smugglers' Notch parking sits 219 m from the saddle** and is free.
- **The Stowe gondola's Lower Barnes Lot is tagged `access=private`** — do not aim for it.
- **All five Montgomery bridges are roadside**, no lots at all. Fuller sits in a residential street;
  park considerately. That is fine for 10-minute stops but means no facilities anywhere on Sunday.
""")
open("PARKING.md","w").write("\n".join(o)+"\n")
print("PARKING.md written")
