import json, time, urllib.parse, urllib.request
UA="vt-trip-planner/1.0 (nitin27may@gmail.com)"
def q(s, extra=None):
    p={"q":s,"format":"json","limit":3,"countrycodes":"us"}
    if extra: p.update(extra)
    u="https://nominatim.openstreetmap.org/search?"+urllib.parse.urlencode(p)
    r=urllib.request.Request(u,headers={"User-Agent":UA})
    d=json.load(urllib.request.urlopen(r,timeout=20)); time.sleep(1.1)
    return [(float(x["lat"]),float(x["lon"]),x.get("type"),x["display_name"][:75]) for x in d]

tests = {
 "Highgate Springs border": ["Highgate Springs, Vermont", "Interstate 89 Highgate Springs Port of Entry Vermont"],
 "Mansfield Toll Road": ["Mount Mansfield Toll Road, Stowe, Vermont", "Toll House, Stowe Mountain Resort, Vermont", "Mountain Road, Stowe, Vermont"],
 "Boyden Valley Winery": ["Boyden Valley Winery, Vermont", "64 Vermont 104, Cambridge, Vermont", "Boyden Farm, Cambridge, Vermont"],
 "Creamery Bridge Montgomery": ["Creamery Bridge Road, Montgomery, Vermont", "Creamery Covered Bridge, Vermont"],
 "Great Eddy Bridge": ["Village Covered Bridge, Waitsfield, Vermont", "Bridge Street, Waitsfield, Vermont", "Waitsfield, Vermont"],
 "Smugglers Notch pass": ["Smugglers Notch, Cambridge, Vermont", "Smugglers Notch State Park, Stowe, Vermont"],
 "Stowe gondola base": ["Spruce Peak, Stowe, Vermont", "Stowe Mountain Lodge, Stowe, Vermont", "Stowe Gondola, Vermont"],
}
for k,v in tests.items():
    print(f"\n=== {k}")
    for s in v:
        for r in q(s): print("   ", r)
