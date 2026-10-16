#!/usr/bin/env python3
"""Find OSM-mapped parking near every trip stop."""
import json, time, urllib.parse, urllib.request, sys, math

pins={r["name"]:r for r in json.load(open("_build/pins-final.json"))}
TARGETS=[ # name, search radius m
 ("Moss Glen Falls (Stowe)",500),("Bingham Falls",600),("Smugglers' Notch",900),
 ("Barnes Camp boardwalk",400),("Sunset Rock, Stowe",600),("Emily's Bridge (Gold Brook)",400),
 ("Stowe Community Church",500),("Stowe Gondola SkyRide",800),
 ("Mount Pisgah South trailhead",900),("Lake Willoughby South Beach",600),
 ("Lake Willoughby North Beach",600),("Craftsbury Common",500),
 ("Barr Hill Natural Area",600),("Fisher Covered Railroad Bridge",400),
 ("Prospect Rock, Johnson",600),("Cambridge Junction / Poland Bridge",500),
 ("Gates Farm Covered Bridge",400),("Longley Covered Bridge",400),
 ("Comstock Covered Bridge",400),("Fuller Covered Bridge",400),
 ("Hutchins Covered Bridge",400),("Creamery Covered Bridge, Montgomery",400),
 ("Sunset Ledge trailhead",700),("Lincoln Gap (top of pass)",700),
 ("Appalachian Gap overlook",600),("Warren Falls",400),
 ("Great Eddy Covered Bridge, Waitsfield",400),("Mount Elmore / Elmore State Park",700),
 ("Craftsbury General Store",400),("Missisquoi NWR visitor centre",700),
]
def hav(a,b,c,d):
    R=6371000;p=math.radians
    return 2*R*math.asin(math.sqrt(math.sin(p(c-a)/2)**2+math.cos(p(a))*math.cos(p(c))*math.sin(p(d-b)/2)**2))

def query(batch):
    parts=[]
    for nm,rad in batch:
        r=pins[nm]
        for t in ("node","way"):
            parts.append(f'{t}["amenity"="parking"](around:{rad},{r["lat"]},{r["lon"]});')
            parts.append(f'{t}["highway"="rest_area"](around:{rad},{r["lat"]},{r["lon"]});')
    q="[out:json][timeout:90];("+"".join(parts)+");out center tags;"
    req=urllib.request.Request("https://overpass-api.de/api/interpreter",
        data=urllib.parse.urlencode({"data":q}).encode(),
        headers={"User-Agent":"vt-trip-planner/1.0 (nitin27may@gmail.com)"})
    return json.load(urllib.request.urlopen(req,timeout=120))["elements"]

found={}
B=6
for i in range(0,len(TARGETS),B):
    batch=TARGETS[i:i+B]
    try:
        els=query(batch)
    except Exception as e:
        print("batch error",e,file=sys.stderr); time.sleep(20); 
        try: els=query(batch)
        except Exception as e2: print("  retry failed",e2,file=sys.stderr); els=[]
    for nm,rad in batch:
        r=pins[nm]; hits=[]
        for e in els:
            la=e.get("lat") or e.get("center",{}).get("lat")
            lo=e.get("lon") or e.get("center",{}).get("lon")
            if la is None: continue
            d=hav(r["lat"],r["lon"],la,lo)
            if d<=rad:
                t=e.get("tags",{})
                hits.append({"lat":round(la,6),"lon":round(lo,6),"dist_m":int(d),
                    "name":t.get("name"),"capacity":t.get("capacity"),
                    "access":t.get("access"),"fee":t.get("fee"),
                    "surface":t.get("surface"),"type":t.get("parking") or t.get("highway")})
        hits.sort(key=lambda h:h["dist_m"])
        found[nm]=hits[:4]
        cap=[h for h in hits if h.get("capacity")]
        print(f"{nm:42s} {len(hits)} lot(s)" + (f"  [capacity tagged: {cap[0]['capacity']}]" if cap else ""))
    time.sleep(4)
json.dump(found,open("_build/parking.json","w"),indent=1)
print("\nwrote _build/parking.json")
