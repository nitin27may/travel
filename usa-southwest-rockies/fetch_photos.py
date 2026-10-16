#!/usr/bin/env python3
"""One API call per query: generator=search + prop=imageinfo returns the real thumb URL,
which IS the existence check. Serial + polite delay + backoff on 429."""
import json, urllib.parse, urllib.request, re, sys, time

UA = "Mozilla/5.0 (compatible; nks-trip-planner/1.0; +https://nks-travel.pages.dev)"
BADWORD = re.compile(r"(map|diagram|chart|logo|seal|plaque|poster|cover|locator|wikivoyage|"
                     r"banner|stamp|coin|graph|sign_|_sign|brochure|leaflet|scan|"
                     r"bathroom|restroom|toilet|parking|campus|motel|hotel_|museum|"
                     r"cicada|insect|beetle|flower|lichen|boxcar|mine|mill_|smelter|"
                     r"bierstadt|mccomas|moran_thomas|painting|lithograph|engraving|"
                     r"sketch|drawing|portrait|\bby_[A-Z]|book|title_page|"
                     r"visitor_cent|gift_shop|campground|restaurant|brewery)", re.I)
OKMIME = {"image/jpeg", "image/png"}

QUERIES = {
 "zion":           ["Zion National Park canyon", "Zion Canyon Virgin River"],
 "angels":         ["Angels Landing Zion"],
 "narrows":        ["Narrows Zion National Park hiking"],
 "canyonoverlook": ["Canyon Overlook Trail Zion"],
 "kanarra":        ["Kanarra Creek Canyon Utah"],
 "bryce":          ["Bryce Canyon hoodoos amphitheater", "Bryce Canyon National Park sunrise"],
 "queensgarden":   ["Queens Garden Bryce Canyon"],
 "horseshoe":      ["Horseshoe Bend Glen Canyon Arizona"],
 "antelope":       ["Antelope Canyon slot canyon"],
 "powell":         ["Lake Powell Glen Canyon Arizona"],
 "monument":       ["Monument Valley buttes", "Monument Valley Navajo"],
 "moki":           ["Moki Dugway Utah highway"],
 "natbridges":     ["Natural Bridges National Monument Utah"],
 "factorybutte":   ["Factory Butte Utah"],
 "bentonite":      ["Bentonite Hills Utah badlands", "Caineville Utah"],
 "moonscape":      ["Moonscape Overlook Utah", "Hanksville Utah desert"],
 "delicate":       ["Delicate Arch Utah"],
 "devilsgarden":   ["Landscape Arch Arches National Park", "Double O Arch Utah"],
 "windows":        ["Turret Arch Arches National Park", "North Window Arches"],
 "mesaarch":       ["Mesa Arch Canyonlands Utah"],
 "canyonlands":    ["Canyonlands National Park Island in the Sky", "Grand View Point Utah"],
 "deadhorse":      ["Dead Horse Point Utah"],
 "durango":        ["Durango Silverton Narrow Gauge Railroad train"],
 "mesaverde":      ["Cliff Palace Mesa Verde Colorado"],
 "milliondollar":  ["Million Dollar Highway Colorado", "Red Mountain Pass Colorado"],
 "silverton":      ["Silverton Colorado"],
 "ouray":          ["Ouray Colorado", "Box Canyon Falls Ouray Colorado"],
 "bluelakes":      ["Blue Lakes Sneffels Colorado"],
 "monarch":        ["Monarch Pass Colorado", "Hoosier Pass Colorado"],
 "frisco":         ["Dillon Reservoir Colorado", "Tenmile Range Colorado"],
 "wyoming":        ["Wind River Range Wyoming"],
 "teton":          ["Grand Teton National Park", "Teton Range Wyoming"],
 "jennylake":      ["Jenny Lake Grand Teton Wyoming"],
 "schwabacher":    ["Oxbow Bend Snake River Wyoming", "Schwabacher Landing Wyoming"],
 "prismatic":      ["Grand Prismatic Spring Yellowstone"],
 "oldfaithful":    ["Old Faithful Yellowstone geyser"],
 "yellowstonecyn": ["Lower Falls Yellowstone River", "Artist Point Yellowstone"],
 "lamar":          ["Lamar Valley Yellowstone", "Yellowstone bison herd"],
 "washburn":       ["Mount Washburn Yellowstone"],
 "saltlake":       ["Great Salt Lake Utah", "Stansbury Island Utah"],
 "vegas":          ["Las Vegas Nevada aerial"],
}

def api(params, tries=5):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(5 * (i + 1)); continue
            raise
        except Exception:
            time.sleep(3); continue
    return {}

def search_with_urls(q, limit=30, width=1400):
    d = api({"action":"query","generator":"search","gsrsearch":q,"gsrnamespace":6,
             "gsrlimit":limit,"prop":"imageinfo","iiprop":"url|mime|extmetadata",
             "iiurlwidth":width,"format":"json"})
    out = []
    for pg in (d.get("query", {}).get("pages", {}) or {}).values():
        ii = (pg.get("imageinfo") or [{}])[0]
        title = pg.get("title","").removeprefix("File:")
        if not ii.get("thumburl") or ii.get("mime") not in OKMIME:
            continue
        if BADWORD.search(title):
            continue
        w = ii.get("thumbwidth") or 0
        if w < 700:            # reject tiny originals that upscale badly
            continue
        meta = ii.get("extmetadata") or {}
        art = re.sub("<[^>]+>", "", (meta.get("Artist",{}) or {}).get("value","") or "").strip()
        lic = ((meta.get("LicenseShortName",{}) or {}).get("value","") or "").strip()
        out.append({"file": title, "thumb": ii["thumburl"], "w": w,
                    "artist": art[:60], "license": lic[:40]})
    return out

REQUIRE = {
 "zion": "zion",
 "angels": "angel",
 "narrows": "narrow|zion",
 "canyonoverlook": "canyon.?overlook",
 "kanarra": "kanarra",
 "bryce": "bryce",
 "queensgarden": "queen|bryce",
 "horseshoe": "horseshoe",
 "antelope": "antelope",
 "powell": "powell|glen.?canyon",
 "monument": "monument.?valley",
 "moki": "moki|dugway|cedar.?mesa",
 "natbridges": "natural.?bridge|sipapu|kachina|owachomo",
 "factorybutte": "factory.?butte",
 "bentonite": "bentonite|caineville",
 "moonscape": "moonscape|factory.?butte|hanksville|caineville",
 "delicate": "delicate.?arch",
 "devilsgarden": "landscape.?arch|double.?o|devils.?garden",
 "windows": "turret|window|arches",
 "mesaarch": "mesa.?arch",
 "canyonlands": "canyonland|island.?in.?the.?sky|grand.?view|green.?river.?overlook",
 "deadhorse": "dead.?horse",
 "durango": "durango|silverton.*railroad|narrow.?gauge",
 "mesaverde": "mesa.?verde|cliff.?palace|balcony.?house",
 "milliondollar": "million.?dollar|red.?mountain|us.?550|ouray|silverton",
 "silverton": "silverton",
 "ouray": "ouray",
 "bluelakes": "blue.?lake|sneffels",
 "monarch": "monarch.?pass|hoosier",
 "frisco": "frisco|dillon|tenmile|ten.?mile|silverthorne",
 "wyoming": "wind.?river|pinedale|green.?river",
 "teton": "teton",
 "jennylake": "jenny.?lake|hidden.?falls|inspiration.?point",
 "schwabacher": "oxbow|schwabacher|snake.?river",
 "prismatic": "prismatic",
 "oldfaithful": "old.?faithful|geyser.?basin|castle.?geyser|grand.?geyser",
 "yellowstonecyn": "lower.?falls|artist.?point|yellowstone.?(river|canyon)|grand.?canyon.*yellowstone",
 "lamar": "lamar|bison|buffalo|wolf|elk",
 "washburn": "washburn|dunraven",
 "saltlake": "salt.?lake|stansbury|antelope.?island|spiral.?jetty",
 "vegas": "las.?vegas|strip"
}

result = {}
for key, qs in QUERIES.items():
    need = re.compile(REQUIRE.get(key, '.'), re.I)
    got, seen = [], set()
    for q in qs:
        for it in search_with_urls(q):
            k = it["file"].lower()
            if not need.search(it["file"]):
                continue
            if k not in seen:
                seen.add(k); got.append(it)
        time.sleep(1.2)
        if len(got) >= 8:
            break
    result[key] = got[:6]
    print(f"{key:16s} {len(result[key])}  {result[key][0]['file'][:58] if result[key] else 'NONE'}")

json.dump(result, open("photos.json","w"), indent=1)
tot = sum(len(v) for v in result.values())
empty = [k for k,v in result.items() if not v]
print(f"\nTOTAL {tot} verified images / {len(result)} locations")
print("EMPTY:", empty or "none")
