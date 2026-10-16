import json,time,math,urllib.parse,urllib.request,sys
pins={r["name"]:r for r in json.load(open("_build/pins-final.json"))}
found=json.load(open("_build/parking.json"))
RETRY=[("Mount Pisgah South trailhead",1500),("Lake Willoughby South Beach",1200),
 ("Prospect Rock, Johnson",1200),("Mount Elmore / Elmore State Park",1200),
 ("Sunset Ledge trailhead",1200),("Craftsbury General Store",800),
 ("Emily's Bridge (Gold Brook)",800),("Gates Farm Covered Bridge",800),
 ("Longley Covered Bridge",900),("Comstock Covered Bridge",900),
 ("Fuller Covered Bridge",900),("Hutchins Covered Bridge",900),
 ("Creamery Covered Bridge, Montgomery",900)]
def hav(a,b,c,d):
    R=6371000;p=math.radians
    return 2*R*math.asin(math.sqrt(math.sin(p(c-a)/2)**2+math.cos(p(a))*math.cos(p(c))*math.sin(p(d-b)/2)**2))
def q(nm,rad):
    r=pins[nm];parts=[]
    for t in ("node","way"):
        for tag in ('["amenity"="parking"]','["highway"="rest_area"]','["amenity"="parking_space"]','["leisure"="park"]["parking"]'):
            parts.append(f'{t}{tag}(around:{rad},{r["lat"]},{r["lon"]});')
    qs="[out:json][timeout:60];("+"".join(parts)+");out center tags;"
    req=urllib.request.Request("https://overpass-api.de/api/interpreter",
        data=urllib.parse.urlencode({"data":qs}).encode(),
        headers={"User-Agent":"vt-trip-planner/1.0 (nitin27may@gmail.com)"})
    return json.load(urllib.request.urlopen(req,timeout=90))["elements"]
for nm,rad in RETRY:
    try: els=q(nm,rad)
    except Exception as e:
        print("ERR",nm,e,file=sys.stderr); time.sleep(10); continue
    r=pins[nm];hits=[]
    for e in els:
        la=e.get("lat") or e.get("center",{}).get("lat");lo=e.get("lon") or e.get("center",{}).get("lon")
        if la is None: continue
        d=hav(r["lat"],r["lon"],la,lo); t=e.get("tags",{})
        hits.append({"lat":round(la,6),"lon":round(lo,6),"dist_m":int(d),"name":t.get("name"),
          "capacity":t.get("capacity"),"access":t.get("access"),"fee":t.get("fee"),
          "surface":t.get("surface"),"type":t.get("parking")})
    hits.sort(key=lambda h:h["dist_m"])
    if hits: found[nm]=hits[:4]
    print(f"{nm:42s} {len(hits)} -> nearest {hits[0]['dist_m']}m {hits[0].get('name') or ''}" if hits else f"{nm:42s} none within {rad}m")
    time.sleep(3)
json.dump(found,open("_build/parking.json","w"),indent=1)
