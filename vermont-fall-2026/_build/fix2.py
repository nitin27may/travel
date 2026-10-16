import json, time, urllib.parse, urllib.request
UA="vt-trip-planner/1.0 (nitin27may@gmail.com)"
def q(s,**kw):
    p={"q":s,"format":"json","limit":4,"countrycodes":"us"}; p.update(kw)
    u="https://nominatim.openstreetmap.org/search?"+urllib.parse.urlencode(p)
    d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":UA}),timeout=20)); time.sleep(1.1)
    return [(round(float(x["lat"]),5),round(float(x["lon"]),5),x.get("class"),x.get("type"),x["display_name"][:70]) for x in d]
for s in ["Elephants Head Stowe Vermont","Smugglers Notch mountain pass Vermont",
          "Smugglers Notch State Park campground Vermont",
          "Mansfield Base Lodge Stowe Vermont","Stowe Mountain Resort gondola base Vermont",
          "Highgate Springs Port of Entry Vermont","US Customs Highgate Springs Vermont"]:
    print(f"\n=== {s}")
    for r in q(s): print("   ",r)
