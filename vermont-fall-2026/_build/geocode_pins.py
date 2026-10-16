#!/usr/bin/env python3
"""Geocode every trip destination and emit KML + CSV for Google My Maps import."""
import json, time, urllib.parse, urllib.request, csv, sys

UA = "vt-trip-planner/1.0 (nitin27may@gmail.com)"

# name, [query, fallback query...], day, category
PLACES = [
 ("Base — 1592 Center Rd, Hyde Park", ["1592 Center Road, Hyde Park, Vermont", "Center Road, Hyde Park, Vermont"], "Base", "Logistics"),
 ("Hannaford, Morrisville", ["Hannaford, Fairgrounds Plaza, Morrisville, Vermont", "Hannaford Morrisville Vermont"], "Thu", "Logistics"),
 ("Highgate Springs border crossing", ["Highgate Springs Border Crossing, Vermont"], "Thu/Sun", "Logistics"),
 ("Le Tandoor, Brossard QC", ["1555 Boulevard Provencher, Brossard, Quebec"], "Thu/Sun", "Food"),
 ("Moss Glen Falls (Stowe)", ["Moss Glen Falls, Stowe, Vermont"], "Thu", "Waterfall"),
 ("Raja Indian & Nepali, Stowe", ["151 Main Street, Stowe, Vermont"], "Thu/Fri/Sat", "Food"),
 ("Stowe Pinnacle trailhead", ["Stowe Pinnacle Trail, Stowe, Vermont", "Upper Hollow Road, Stowe, Vermont"], "Fri", "Hike"),
 ("Emily's Bridge (Gold Brook)", ["Gold Brook Covered Bridge, Stowe, Vermont"], "Fri", "Covered bridge"),
 ("Stowe Community Church", ["Stowe Community Church, Main Street, Stowe, Vermont"], "Fri", "Village"),
 ("Stowe Gondola SkyRide", ["Stowe Mountain Resort, Stowe, Vermont"], "Fri", "Lift"),
 ("Mount Mansfield Auto Toll Road", ["Mount Mansfield Toll Road, Stowe, Vermont"], "Fri alt", "Drive-up"),
 ("Bingham Falls", ["Bingham Falls, Stowe, Vermont"], "Fri", "Waterfall"),
 ("Smugglers' Notch", ["Smugglers Notch, Vermont", "Smugglers Notch State Park, Vermont"], "Fri", "Scenic drive"),
 ("Barnes Camp boardwalk", ["Barnes Camp, Stowe, Vermont", "Barnes Camp Visitor Center Vermont"], "Fri", "Boardwalk"),
 ("Sunset Rock, Stowe", ["Sunset Rock, Stowe, Vermont"], "Fri", "Viewpoint"),
 ("von Trapp Bierhall", ["Trapp Family Lodge, Stowe, Vermont"], "Fri", "Food"),
 ("Mount Pisgah South trailhead", ["Mount Pisgah, Westmore, Vermont"], "Sat", "Hike"),
 ("Pulpit Rock (Pisgah)", ["Pulpit Rock, Westmore, Vermont"], "Sat", "Viewpoint"),
 ("Lake Willoughby South Beach", ["Lake Willoughby, Westmore, Vermont"], "Sat", "Viewpoint"),
 ("Lake Willoughby North Beach", ["North Beach, Lake Willoughby, Westmore, Vermont", "Westmore, Vermont"], "Sat", "Viewpoint"),
 ("Craftsbury Common", ["Craftsbury Common, Vermont"], "Sat", "Village"),
 ("Craftsbury General Store", ["Craftsbury General Store, Craftsbury, Vermont", "South Craftsbury Road, Craftsbury, Vermont"], "Sat", "Food"),
 ("Barr Hill Natural Area", ["Barr Hill Natural Area, Greensboro, Vermont", "Barr Hill Road, Greensboro, Vermont"], "Sat", "Viewpoint"),
 ("Fisher Covered Railroad Bridge", ["Fisher Covered Railroad Bridge, Wolcott, Vermont"], "Sat", "Covered bridge"),
 ("Prospect Rock, Johnson", ["Prospect Rock, Johnson, Vermont"], "Sat opt", "Hike"),
 ("Ten Bends Beer, Hyde Park", ["Ten Bends Beer, Hyde Park, Vermont"], "Sat opt", "Food"),
 ("Cambridge Junction / Poland Bridge", ["Poland Covered Bridge, Cambridge, Vermont", "Cambridge Junction Covered Bridge Vermont"], "Sun", "Covered bridge"),
 ("Gates Farm Covered Bridge", ["Gates Farm Covered Bridge, Cambridge, Vermont"], "Sun", "Covered bridge"),
 ("Boyden Valley Winery", ["Boyden Valley Winery, Cambridge, Vermont"], "Sun opt", "Food"),
 ("Longley Covered Bridge", ["Longley Covered Bridge, Montgomery, Vermont"], "Sun", "Covered bridge"),
 ("Comstock Covered Bridge", ["Comstock Covered Bridge, Montgomery, Vermont"], "Sun", "Covered bridge"),
 ("Fuller Covered Bridge", ["Fuller Covered Bridge, Montgomery, Vermont"], "Sun", "Covered bridge"),
 ("Hutchins Covered Bridge", ["Hutchins Covered Bridge, Montgomery, Vermont"], "Sun", "Covered bridge"),
 ("Creamery Covered Bridge, Montgomery", ["Creamery Covered Bridge, Montgomery, Vermont"], "Sun", "Covered bridge"),
 ("Missisquoi NWR visitor centre", ["Missisquoi National Wildlife Refuge, Swanton, Vermont"], "Sun opt", "Nature"),
 ("Great Eddy Covered Bridge, Waitsfield", ["Great Eddy Covered Bridge, Waitsfield, Vermont", "Village Covered Bridge, Waitsfield, Vermont"], "Backup", "Covered bridge"),
 ("Warren Store / Warren village", ["Warren Store, Warren, Vermont", "Warren, Vermont"], "Backup", "Village"),
 ("Warren Falls", ["Warren Falls, Warren, Vermont"], "Backup", "Waterfall"),
 ("Lincoln Gap (top of pass)", ["Lincoln Gap, Vermont"], "Backup", "Scenic drive"),
 ("Sunset Ledge trailhead", ["Sunset Ledge, Lincoln, Vermont", "Lincoln Gap, Lincoln, Vermont"], "Backup", "Hike"),
 ("Appalachian Gap overlook", ["Appalachian Gap, Vermont"], "Backup", "Viewpoint"),
 ("Mad River Glen", ["Mad River Glen, Fayston, Vermont"], "Backup opt", "Lift"),
 ("Cold Hollow Cider Mill", ["Cold Hollow Cider Mill, Waterbury Center, Vermont"], "Backup only", "Food"),
 ("Mount Elmore / Elmore State Park", ["Elmore State Park, Vermont"], "Reserve", "Hike"),
 ("Laraway Lookout trailhead", ["Laraway Mountain, Waterville, Vermont"], "Reserve", "Hike"),
 ("Molly Stark Mountain", ["Molly Stark Mountain, Vermont"], "Reserve", "Hike"),
 ("Mount Abraham", ["Mount Abraham, Lincoln, Vermont"], "Reserve", "Hike"),
 ("Jay Peak tram", ["Jay Peak Resort, Jay, Vermont"], "Reserve", "Lift"),
 ("Peacham village", ["Peacham, Vermont"], "Reserve", "Village"),
 ("Barnet", ["Barnet, Vermont"], "Reserve", "Village"),
 ("Grand Isle (Champlain Islands)", ["Grand Isle, Vermont"], "Reserve", "Scenic drive"),
]

def geocode(queries):
    for q in queries:
        url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
            {"q": q, "format": "json", "limit": 1, "countrycodes": "us,ca"})
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            data = json.load(urllib.request.urlopen(req, timeout=20))
        except Exception as e:
            print(f"    ! error {e}", file=sys.stderr); data = []
        time.sleep(1.1)
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"]), q, data[0]["display_name"]
    return None

rows, failed = [], []
for name, queries, day, cat in PLACES:
    r = geocode(queries)
    if r:
        lat, lon, used, disp = r
        rows.append({"name": name, "lat": lat, "lon": lon, "day": day,
                     "category": cat, "matched": disp})
        print(f"OK  {name:45s} {lat:.5f},{lon:.5f}")
    else:
        failed.append(name); print(f"FAIL {name}")

json.dump(rows, open("pins.json", "w"), indent=1)
print(f"\n{len(rows)} geocoded, {len(failed)} failed: {failed}")
