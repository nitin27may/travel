#!/usr/bin/env python3
import json
park=json.load(open("_build/parking.json"))
pins=json.load(open("_build/pins-final.json"))

# curated: name -> (lat, lon, label, confidence, note)
BEST={
 "Moss Glen Falls (Stowe)":(44.485243,-72.627263,"Moss Glen Falls lot","OSM","Small gravel lot, 380 m from the falls"),
 "Bingham Falls":(44.518223,-72.769776,"Bingham Falls Parking","OSM","Named lot on VT-108, 340 m from the gorge. ~15 cars"),
 "Smugglers' Notch":(44.556784,-72.794040,"Notch top parking","OSM","219 m from the saddle, free. Smallest lot of the week"),
 "Barnes Camp boardwalk":(44.539655,-72.791161,"Barnes Camp lot","OSM","290 m from the visitor centre"),
 "Sunset Rock, Stowe":(44.463912,-72.676770,"Sunset St lot","OSM","CAPACITY 10, free, unpaved. Or park behind the Community Church"),
 "Stowe Community Church":(44.465681,-72.684581,"Church lot","OSM","Free, public, 6 m. The village anchor lot"),
 "Stowe Gondola SkyRide":(44.530203,-72.785668,"Mansfield base lot","OSM","170 m. NB Lower Barnes Lot nearby is access=private"),
 "Lake Willoughby North Beach":(44.771335,-72.054463,"North Beach lot","OSM","40 m from the beach"),
 "Craftsbury Common":(44.654270,-72.382750,"Common parking","OSM","79 m from the green"),
 "Barr Hill Natural Area":(44.608770,-72.287795,"Barr Hill trailhead lot","OSM","185 m. The view is from the field right here"),
 "Fisher Covered Railroad Bridge":(44.532889,-72.427605,"Fisher Bridge pull-off","OSM","64 m, free"),
 "Cambridge Junction / Poland Bridge":(44.650638,-72.814207,"Poland Bridge lot","OSM","60 m"),
 "Gates Farm Covered Bridge":(44.644491,-72.876350,"Nearest lot","OSM","350 m — otherwise roadside on VT-15"),
 "Sunset Ledge trailhead":(44.094732,-72.927931,"Sunset Ledge Trail Head Parking","OSM","NAMED lot. LT South starts here"),
 "Lincoln Gap (top of pass)":(44.094898,-72.928308,"Lincoln Gap Long Trail Trailhead Parking","OSM","NAMED. The two gap lots are 94 m apart"),
 "Appalachian Gap overlook":(44.211202,-72.931333,"App Gap overlook lot","OSM","14 m, asphalt, public. The drive-up view"),
 "Warren Falls":(44.093967,-72.863858,"Warren Falls pull-off","OSM","175 m"),
 "Great Eddy Covered Bridge, Waitsfield":(44.189597,-72.824248,"Village lot","OSM","64 m, free, public"),
 "Missisquoi NWR visitor centre":(44.964558,-73.166283,"Macs Bend Parking","OSM","227 m"),
 "Stowe Pinnacle trailhead":(44.43882,-72.66764,"Main trailhead lot","USER","~9 cars. Overflow Pinnacle Meadows is 1.6 km east"),
 "Pinnacle Meadows overflow lot":(44.43779,-72.64712,"Pinnacle Meadows","USER","Stowe Land Trust overflow, 1.6 km from the trailhead"),
}
UNMAPPED={
 "Mount Pisgah South trailhead":"Lots on BOTH sides of VT-5A at the trailhead — not in OSM. The only nearby mapped lot is Willoughby Lake South End, 1.5 km away, which is the WRONG one. NEEDS A GOOGLE PIN.",
 "Lake Willoughby South Beach":"Beach parking is roadside on VT-5A; nearest mapped lot is 834 m off. Free as of Apr 2026 (a fee was 'in talks' — check signage). NEEDS A GOOGLE PIN.",
 "Prospect Rock, Johnson":"Long Trail roadside lot on VT-15 — unmapped. NEEDS A GOOGLE PIN.",
 "Mount Elmore / Elmore State Park":"You drive into the state park and park inside; day use 10:00–sunset, fee applies. No separate lot to pin.",
 "Emily's Bridge (Gold Brook)":"Roadside on Covered Bridge Rd. No lot.",
 "Craftsbury General Store":"Street parking on S Craftsbury Rd, 100 m from the Common lot.",
 "Longley Covered Bridge":"Roadside on VT-118. No lot.",
 "Comstock Covered Bridge":"Roadside on Comstock Bridge Rd. No lot.",
 "Fuller Covered Bridge":"Roadside on South Richford Rd, residential — park considerately.",
 "Hutchins Covered Bridge":"Roadside; access road turns to dirt after ~50 yards.",
 "Creamery Covered Bridge, Montgomery":"Roadside on Creamery Bridge Rd (off WEST HILL RD, not Hill West Rd).",
}
# add parking pins as their own map entries
new=[]
for nm,(la,lo,label,conf,note) in BEST.items():
    if nm in ("Stowe Pinnacle trailhead","Pinnacle Meadows overflow lot"): continue
    src=next((p for p in pins if p["name"]==nm),None)
    if not src: continue
    new.append(dict(name=f"P — {label}",lat=la,lon=lo,day=src["day"],cat="Parking",
        trail="No",km="-",asc="-",wtype="-",time="-",score="-",
        note=f"Parking for {nm}. {note}"))
pins.extend(new)
json.dump(pins,open("_build/pins-final.json","w"),indent=1)
json.dump({"best":BEST,"unmapped":UNMAPPED},open("_build/parking-curated.json","w"),indent=1)
print(f"added {len(new)} parking pins; total {len(pins)}")
