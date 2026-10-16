#!/usr/bin/env python3
import json, urllib.parse
rows=json.load(open("_build/pins-final.json"))
def maplink(r):
    return f"https://maps.google.com/?q={r['lat']},{r['lon']}"
LABEL={"Base":"Base","Thu":"Thu 1","Thu/Fri/Sat":"Thu-Sat","Thu/Sun":"Thu+Sun","Fri":"Fri 2",
 "Fri alt":"Fri alt","Sat":"Sat 3","Sat opt":"Sat opt","Sun":"Sun 4","Sun opt":"Sun opt",
 "Backup":"Backup","Backup opt":"Backup opt","Backup only":"Backup only","Reserve":"RESERVE"}
out=["""# MASTER TABLE — every location, one row each
Generated from `pins-final.json`. 51 destinations: everything currently scheduled **plus**
everything researched and held in reserve. Regenerate with `python3 build_master_table.py`.

**Trail column:** `No` = you never leave the car park, pure sightseeing. `Yes` = you walk to the
view. `Stroll` = pavement/village. `Walk-through` = the bridge itself. `Lift`/`Drive` = mechanical.
**km** is round trip. **Ascent** in metres.

**Score:** 10 = unmissable and cheap · 9 = unmissable but costs effort · 8 = strong ·
7 = worth the stop, first to cut · 6 = only because it's on the road · 5 = filler.

| # | Location | Day | Type | Trail | km RT | Ascent | Time | Score | Map | Notes |
|---|---|---|---|---|---|---|---|---|---|---|"""]
for i,r in enumerate(rows,1):
    sc=r["score"]
    scd=f"**{sc}**" if sc not in("-","?") and int(sc)>=9 else sc
    note=r["note"].replace("|","·")
    out.append(f"| {i} | {r['name']} | {LABEL.get(r['day'],r['day'])} | {r['cat']} | {r['trail']} | "
               f"{r['km']} | {r['asc']} | {r['time']} | {scd} | [pin]({maplink(r)}) | {note} |")

sched=[r for r in rows if r["day"]!="Reserve"]
hikes=[r for r in rows if r["trail"]=="Yes" and r["day"]!="Reserve"]
nowalk=[r for r in rows if r["trail"] in ("No",) and r["day"]!="Reserve"]
out.append(f"""
## Totals

| | Count |
|---|---|
| Destinations in the plan | **{len(sched)}** |
| Held in reserve (researched, not scheduled) | **{len(rows)-len(sched)}** |
| **Stops needing a trail** | **{len(hikes)}** |
| **Stops with no walking at all** | **{len(nowalk)}** |

### The trail stops, shortest first
""")
hs=sorted(hikes,key=lambda r: float(str(r["km"]).split("-")[0]))
out.append("| Stop | Day | km RT | Ascent | Time | Score |")
out.append("|---|---|---|---|---|---|")
for r in hs:
    out.append(f"| {r['name']} | {LABEL.get(r['day'],r['day'])} | **{r['km']}** | {r['asc']} m | {r['time']} | {r['score']} |")
out.append("""
### The no-walking stops — sorted by score
""")
nw=sorted(nowalk,key=lambda r: -(int(r["score"]) if str(r["score"]).isdigit() else 0))
out.append("| Stop | Day | Score | Why |")
out.append("|---|---|---|---|")
for r in nw:
    if str(r["score"]).isdigit():
        out.append(f"| {r['name']} | {LABEL.get(r['day'],r['day'])} | {r['score']} | {r['note']} |")
open("MASTER-TABLE.md","w").write("\n".join(out)+"\n")
print("MASTER-TABLE.md written")
