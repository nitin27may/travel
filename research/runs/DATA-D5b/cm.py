#!/usr/bin/env python3
"""Cached, locked, sequential Commons client for D5a. Every network call logs to calls.log."""
import json, os, subprocess, sys, time, urllib.parse, hashlib, html, re
from pathlib import Path
HERE = Path(__file__).resolve().parent
UA = "travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)"
API = "https://commons.wikimedia.org/w/api.php"
LOCK = "/tmp/travel-commons.lock"
CACHE = HERE / "cache"; CACHE.mkdir(exist_ok=True)
LOG = HERE / "calls.log"
OK = re.compile(r"^(CC BY(-SA)?( [0-9.]+)?|CC0.*|Public domain.*|PD.*|CC BY-SA.*)$", re.I)

def fetch(url, binary=False, key=None):
    k = hashlib.sha1((key or url).encode()).hexdigest()
    p = CACHE / (k + (".bin" if binary else ".json"))
    if p.exists():
        return p.read_bytes() if binary else json.loads(p.read_text())
    cmd = ["/opt/homebrew/bin/flock", LOCK, "bash", "-c",
           'sleep 2; curl -sS -L -A "$0" -w "\\n%{http_code}" "$1"', UA, url]
    r = subprocess.run(cmd, capture_output=True)
    body, _, code = r.stdout.rpartition(b"\n")
    code = code.decode().strip()
    with open(LOG, "a") as f:
        f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {code} {url[:200]}\n")
    if code == "429":
        raise SystemExit("429 from Commons: stop and report")
    if code != "200":
        raise SystemExit(f"HTTP {code} for {url}")
    if binary:
        p.write_bytes(body); return body
    d = json.loads(body)
    if "error" in d:
        raise RuntimeError("API error "+d["error"].get("code","?"))
    p.write_text(json.dumps(d)); return d

def fetch_retry(url, tries=4):
    for i in range(tries):
        try:
            return fetch(url)
        except RuntimeError as e:
            with open(LOG,"a") as f: f.write(f"  {e}; wait {30*(i+1)}s\n")
            time.sleep(30*(i+1))
    raise SystemExit("search stays busy; stop and report")

def geosearch(lat, lon, radius=1000, limit=50):
    q = urllib.parse.urlencode({"action":"query","format":"json","list":"geosearch","gscoord":f"{lat}|{lon}",
        "gsradius":radius,"gsnamespace":6,"gslimit":limit,"gsprimary":"all"})
    d = fetch_retry(f"{API}?{q}")
    return d.get("query",{}).get("geosearch",[])

def textsearch(q, limit=30):
    qq = urllib.parse.urlencode({"action":"query","format":"json","list":"search","srsearch":q,"srnamespace":6,"srlimit":limit})
    d = fetch_retry(f"{API}?{qq}")
    return [x["title"] for x in d.get("query",{}).get("search",[])]

def imageinfo(titles):
    out = {}
    titles = [t for t in titles]
    for i in range(0, len(titles), 50):
        b = titles[i:i+50]
        q = urllib.parse.urlencode({"action":"query","format":"json","prop":"imageinfo","iiprop":"size|mime|url|extmetadata",
            "iiextmetadatafilter":"Artist|LicenseShortName|ImageDescription|DateTimeOriginal|Categories|GPSLatitude|GPSLongitude|Credit|UsageTerms|NonFree|Restrictions",
            "titles":"|".join(b)})
        d = fetch(f"{API}?{q}")
        for pg in d.get("query",{}).get("pages",{}).values():
            ii = (pg.get("imageinfo") or [{}])[0]
            out[pg["title"]] = ii
    return out

def clean(s):
    return re.sub(r"\s+"," ",html.unescape(re.sub(r"<[^>]+>","",s or ""))).strip()

def summarize(title, ii):
    md = ii.get("extmetadata",{})
    g = lambda k: clean(md.get(k,{}).get("value",""))
    return {"title":title,"w":ii.get("width",0),"h":ii.get("height",0),"mime":ii.get("mime"),
            "lic":g("LicenseShortName"),"author":g("Artist"),"desc":g("ImageDescription")[:140],
            "date":g("DateTimeOriginal"),"nonfree":g("NonFree"),"restr":g("Restrictions")}

def thumb(title, width=400):
    fn = title.removeprefix("File:").replace(" ","_")
    url = "https://commons.wikimedia.org/wiki/Special:FilePath/"+urllib.parse.quote(fn)+f"?width={width}"
    return fetch(url, binary=True)

def coords(titles):
    out={}
    for i in range(0,len(titles),50):
        q=urllib.parse.urlencode({"action":"query","format":"json","prop":"coordinates","coprimary":"all","titles":"|".join(titles[i:i+50])})
        d=fetch_retry(f"{API}?{q}")
        for pg in d["query"]["pages"].values():
            c=(pg.get("coordinates") or [None])[0]
            out[pg["title"]]=(c["lat"],c["lon"]) if c else None
    return out
