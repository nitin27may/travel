#!/usr/bin/env python3
"""Build vermont-pins.kml + vermont-pins.csv + the master table from pins.json."""
import json, csv, html

pins = {p["name"]: p for p in json.load(open("pins.json"))}

# manual corrections / additions: name -> (lat, lon, note)
FIX = {
 "Smugglers' Notch": (44.55530, -72.79587, "corrected: OSM saddle, 675 m. Nominatim returned the RESORT in Jeffersonville, 3.5 km away on the wrong side"),
 "Stowe Gondola SkyRide": (44.52903, -72.78428, "Mansfield Base Lodge"),
 "Mount Mansfield Auto Toll Road": (44.53750, -72.79080, "APPROX - entrance off Mountain Rd/VT-108"),
 "Highgate Springs border crossing": (44.97932, -73.10530, "APPROX - this is the village; the I-89 port of entry is ~3 km north at the 45th parallel"),
 "Boyden Valley Winery": (44.64887, -72.88916, "64 VT Route 104"),
 "Creamery Covered Bridge, Montgomery": (44.86724, -72.65252, "Creamery Bridge Rd, West Hill"),
 "Great Eddy Covered Bridge, Waitsfield": (44.18937, -72.82350, "Bridge Street"),
 "Stowe Pinnacle trailhead": (44.43882, -72.66764, "corrected from user-supplied Google pin - Nominatim was ~970 m off, on the trail line not the lot"),
 "Pinnacle Meadows overflow lot": (44.43779, -72.64712, "Stowe Land Trust. User-supplied pin"),
}

# name -> (trail?, km_rt, ascent_m, walk_type, time_on_site, score, note)
D = {
 "Base — 1592 Center Rd, Hyde Park": ("-","-","-","-","-","-","Hotel"),
 "Hannaford, Morrisville": ("No","-","-","-","30 m","-","Thu picnic shop"),
 "Highgate Springs border crossing": ("No","-","-","-","15-30 m","-","24 h port"),
 "Le Tandoor, Brossard QC": ("No","-","-","-","60 m","-","Only good veg meal on the drive"),
 "Moss Glen Falls (Stowe)": ("Yes","0.8","17","O&B","60 m","8","Rim spur steep/eroded"),
 "Raja Indian & Nepali, Stowe": ("No","-","-","-","75 m","-","Closed Wed AND Sun"),
 "Stowe Pinnacle trailhead": ("Yes","5.5","457","O&B","3 h","9","MAIN LOT - holds ~9 cars, fills before 09:00 on weekdays"),
 "Pinnacle Meadows overflow lot": ("No","-","-","-","-","-","OVERFLOW, Stowe Land Trust, Pinnacle Rd. 1.6 km EAST of the trailhead by road"),
 "Emily's Bridge (Gold Brook)": ("No","-","-","-","15 m","6","1844; the flex item"),
 "Stowe Community Church": ("Stroll","1.5","flat","-","45 m","8","Village + viewpoint"),
 "Stowe Gondola SkyRide": ("No","-","-","Lift","90 m","7","10:00-16:30, $40-43, book online"),
 "Mount Mansfield Auto Toll Road": ("No","-","-","Drive","90 m","7","$37/veh + $14/pax, 9:30-16:30"),
 "Bingham Falls": ("Yes","0.8","46 down","O&B","45 m","8","STEEP WET STAIRS - grip matters"),
 "Smugglers' Notch": ("No","-","-","Pull-offs","60 m","10","Top of pass. No vehicles over 40 ft"),
 "Barnes Camp boardwalk": ("Yes","1.1","flat","Boardwalk","20 m","6","Wetland + beaver dam"),
 "Sunset Rock, Stowe": ("Yes","0.8","40","O&B","45 m","8","10 min walk from Sunset St"),
 "von Trapp Bierhall": ("No","-","-","-","90 m","7","11:30-21:00, Resy. Thin on veg"),
 "Mount Pisgah South trailhead": ("Yes","3.5","274","O&B","2 h","9","TRIMMED to Pulpit Rock"),
 "Pulpit Rock (Pisgah)": ("Yes","3.5","274","O&B","-","9","Ledge 650 ft above the lake"),
 "Lake Willoughby South Beach": ("No","0.3","flat","-","60 m","10","Picnic. Cold in October"),
 "Lake Willoughby North Beach": ("No","-","-","-","15 m","7","Quick look from the north end"),
 "Craftsbury Common": ("Stroll","1.0","flat","-","45 m","8","White-fenced hilltop green"),
 "Craftsbury General Store": ("No","-","-","-","30 m","7","OPTIONAL. Sat 7:00-21:00. Only staffed food in the Kingdom - skip it and there is nothing until Morrisville"),
 "Barr Hill Natural Area": ("Yes","1.1","27","Loop","50 m","9","VIEW IS AT THE TRAILHEAD FIELD"),
 "Fisher Covered Railroad Bridge": ("No","-","-","-","15 m","7","Last covered RR bridge used in the US"),
 "Prospect Rock, Johnson": ("Yes","4.2","140","O&B","70 m","7","Suspension bridge over the Lamoille"),
 "Ten Bends Beer, Hyde Park": ("No","-","-","-","60 m","5","At the doorstep"),
 "Cambridge Junction / Poland Bridge": ("Walk-through","0.3","flat","-","20 m","7","1887, 2nd-largest single span in VT"),
 "Gates Farm Covered Bridge": ("No","-","-","-","10 m","5","1897, last Burr arch of the era"),
 "Boyden Valley Winery": ("No","-","-","-","30 m","5","VERIFY SUNDAY HOURS"),
 "Longley Covered Bridge": ("No","-","-","-","10 m","7","1863. VT-118 + Longley Bridge Rd"),
 "Comstock Covered Bridge": ("No","-","-","-","10 m","7","1883. Off VT-118 N"),
 "Fuller Covered Bridge": ("No","-","-","-","10 m","7","1890. South Richford Rd"),
 "Hutchins Covered Bridge": ("No","-","-","-","15 m","6","1883. DIRT after 50 yards"),
 "Creamery Covered Bridge, Montgomery": ("No","-","-","-","15 m","6","1883. WEST HILL RD not Hill West Rd"),
 "Missisquoi NWR visitor centre": ("Yes","2.0","flat","Boardwalk","20 m","5","6,729 acres, peak migration"),
 "Great Eddy Covered Bridge, Waitsfield": ("No","-","-","-","45 m","7","1833, oldest still in service"),
 "Warren Store / Warren village": ("Stroll","0.8","flat","-","-","7","Village + covered bridge"),
 "Warren Falls": ("Yes","0.3","20","O&B","45 m","7","Carved-granite gorge"),
 "Lincoln Gap (top of pass)": ("No","-","-","Drive","20 m","6","WOODED - no view from the car"),
 "Sunset Ledge trailhead": ("Yes","3.5","119","O&B","75 m","8","LT SOUTH. West to Champlain/Adirondacks"),
 "Appalachian Gap overlook": ("No","0.02","-","-","45 m","9","DRIVE-UP. 20 m from the car"),
 "Mad River Glen": ("No","-","-","Lift","60 m","7","$20. LAST CHAIR LOADS 14:30"),
 "Cold Hollow Cider Mill": ("No","-","-","-","60 m","6","BACKUP DAY ONLY - dropped from Sunday"),
 "Mount Elmore / Elmore State Park": ("Yes","6.0-6.8","448","Loop","3 h","9","RESERVE. GATE OPENS 10:00"),
 "Laraway Lookout trailhead": ("Yes","5.8","424","O&B","3 h","6","RESERVE"),
 "Molly Stark Mountain": ("Yes","4.0","314","O&B","2 h","6","RESERVE. Molly Stark's Balcony"),
 "Mount Abraham": ("Yes","8.4","762","O&B","4 h","10","RESERVE. Above treeline, 4,006 ft"),
 "Jay Peak tram": ("No","-","-","Lift","2 h","8","RESERVE. $15, weekends to Oct 11"),
 "Peacham village": ("No","-","-","-","2 h","8","RESERVE. NEK festival Fri Oct 2"),
 "Barnet": ("No","-","-","-","2 h","8","RESERVE. NEK festival Sat Oct 3"),
 "Grand Isle (Champlain Islands)": ("No","-","-","Drive","2 h","8","RESERVE. Sunday alternative route"),
}

ORDER = ["Base","Thu","Fri","Fri alt","Sat","Sat opt","Sun","Sun opt","Backup","Backup opt","Backup only","Reserve","Thu/Fri/Sat","Thu/Sun"]
COLOR = {"Base":"ylw","Thu":"grn","Fri":"blu","Fri alt":"blu","Sat":"red","Sat opt":"red",
         "Sun":"purple","Sun opt":"purple","Backup":"orange","Backup opt":"orange",
         "Backup only":"orange","Reserve":"wht","Thu/Fri/Sat":"grn","Thu/Sun":"grn"}

rows=[]
for name, p in pins.items():
    lat, lon, note = p["lat"], p["lon"], ""
    if name in FIX:
        lat, lon, note = FIX[name]
    d = D.get(name, ("?","-","-","-","-","-",""))
    rows.append(dict(name=name, lat=lat, lon=lon, day=p["day"], cat=p["category"],
                     trail=d[0], km=d[1], asc=d[2], wtype=d[3], time=d[4], score=d[5],
                     note=d[6] + ((" | " + note) if note else "")))
EXTRA_META={"Pinnacle Meadows overflow lot":("Fri","Parking")}
for name,(lat,lon,note) in FIX.items():
    if name not in pins:
        d=D.get(name,("?",)*7); dy,ct=EXTRA_META.get(name,("?","?"))
        rows.append(dict(name=name,lat=lat,lon=lon,day=dy,cat=ct,trail=d[0],km=d[1],
                         asc=d[2],wtype=d[3],time=d[4],score=d[5],note=d[6]+" | "+note))

rows.sort(key=lambda r: (ORDER.index(r["day"]) if r["day"] in ORDER else 99, r["name"]))

# ---- CSV (Google My Maps also imports this directly)
with open("vermont-pins.csv","w",newline="") as f:
    w=csv.writer(f)
    w.writerow(["Name","Latitude","Longitude","Day","Category","Trail","Trail km RT","Ascent m","Walk type","Time on site","Score /10","Notes"])
    for r in rows:
        w.writerow([r["name"],r["lat"],r["lon"],r["day"],r["cat"],r["trail"],r["km"],
                    r["asc"],r["wtype"],r["time"],r["score"],r["note"]])

# ---- KML with one folder per day
def esc(s): return html.escape(str(s))
k=['<?xml version="1.0" encoding="UTF-8"?>',
   '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>',
   '<name>Vermont Fall Trip — Oct 1-4, 2026</name>',
   '<description>Every destination. Folders = day. Import into Google My Maps.</description>']
for c in set(COLOR.values()):
    k.append(f'<Style id="s_{c}"><IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/{c}-blank.png</href></Icon></IconStyle></Style>')
seen=[]
for r in rows:
    if r["day"] not in seen: seen.append(r["day"])
for day in seen:
    k.append(f'<Folder><name>{esc(day)}</name>')
    for r in [x for x in rows if x["day"]==day]:
        desc=(f"Day: {r['day']} | Category: {r['cat']}\n"
              f"Score: {r['score']}/10\n"
              f"Trail: {r['trail']}"
              + (f" — {r['km']} km round trip, {r['asc']} m ascent ({r['wtype']})" if r['trail'] not in ('No','-','?') else "")
              + f"\nTime on site: {r['time']}\n{r['note']}")
        k.append(f'<Placemark><name>{esc(r["name"])}</name>'
                 f'<description>{esc(desc)}</description>'
                 f'<styleUrl>#s_{COLOR.get(r["day"],"wht")}</styleUrl>'
                 f'<Point><coordinates>{r["lon"]},{r["lat"]},0</coordinates></Point></Placemark>')
    k.append('</Folder>')
k.append('</Document></kml>')
open("vermont-pins.kml","w").write("\n".join(k))
json.dump(rows, open("pins-final.json","w"), indent=1)
print(f"{len(rows)} pins -> vermont-pins.kml, vermont-pins.csv")
