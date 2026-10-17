#!/usr/bin/env python3
"""Find gallery candidates on Wikimedia Commons with the fewest possible requests.

    python3 tools/gallery/gallery_find.py <trip>/gallery/gallery-spec.json

Spec:  {"trip": "slug", "places": [{"place": "...", "days": "...", "blurb": "...", "queries": ["...", "..."]}]}

One API request per query (generator=search with imageinfo inline), results cached in
/tmp/gal/<trip>/cache.json so a rerun resumes. Filters: jpeg, landscape, >= 1600 px, reusable
licence, not already embedded in <trip>/index.html. Writes <trip>/gallery/gallery-candidates.json and a
contact sheet /tmp/gal/<trip>/sheet-<n>.jpg per 12 candidates so a human picks by looking.
Backs off 5 minutes on HTTP 429 and stops rather than hammering.
"""
from __future__ import annotations

import html
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gallery as G  # noqa: E402

PER_PLACE = 8
SLEEP = 6


def call(url: str, cache: dict, key: str):
    if key in cache:
        return cache[key]
    for attempt in range(3):
        time.sleep(SLEEP)
        try:
            data = json.loads(G._get_raw(url))
            cache[key] = data
            return data
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            print(f"429, sleeping 300s (attempt {attempt + 1})", flush=True)
            time.sleep(300)
    raise SystemExit("still 429; rerun later, cache keeps progress")


def clean(s: str) -> str:
    s = html.unescape(re.sub(r"<[^>]+>", "", s or ""))
    s = re.sub(r"This (Photo|photo|image).*", "", s).strip()
    return re.sub(r"\s+", " ", s)[:80]


def main() -> None:
    spec_path = Path(sys.argv[1])
    spec = json.loads(spec_path.read_text())
    trip = spec["trip"]
    folder = spec_path.parent
    work = Path("/tmp/gal") / trip
    work.mkdir(parents=True, exist_ok=True)
    cpath = work / "cache.json"
    cache = json.loads(cpath.read_text()) if cpath.exists() else {}
    page = folder / "index.html"
    used = set()
    if page.exists():
        for m in re.findall(r"Special:FilePath/([^?\"']+)", page.read_text(encoding="utf-8")):
            used.add(urllib.parse.unquote(m).replace("_", " "))

    out = []
    for pi, pl in enumerate(spec["places"]):
        cands, seen = [], set()
        for q in pl["queries"]:
            params = urllib.parse.urlencode({
                "action": "query", "format": "json", "generator": "search", "gsrsearch": q,
                "gsrnamespace": 6, "gsrlimit": 20, "prop": "imageinfo",
                "iiprop": "size|mime|extmetadata", "iiextmetadatafilter": "Artist|LicenseShortName",
            })
            data = call(f"{G.API}?{params}", cache, q)
            cpath.write_text(json.dumps(cache))
            pages = sorted((data.get("query", {}).get("pages", {})).values(), key=lambda p: p.get("index", 99))
            for p in pages:
                fn = p["title"].removeprefix("File:")
                ii = (p.get("imageinfo") or [{}])[0]
                if fn in seen or fn in used or ii.get("mime") != "image/jpeg":
                    continue
                if ii.get("width", 0) < G.MIN_WIDTH or ii["width"] <= ii["height"]:
                    continue
                md = ii.get("extmetadata", {})
                lic = html.unescape(md.get("LicenseShortName", {}).get("value", "")).strip()
                if not G.OK_LICENSE.match(lic):
                    continue
                seen.add(fn)
                cands.append({"file": fn, "author": clean(md.get("Artist", {}).get("value", "")) or "Unknown",
                              "license": lic, "w": ii["width"], "h": ii["height"]})
        out.append({**{k: pl[k] for k in ("place", "days", "blurb")}, "candidates": cands[:PER_PLACE]})
        print(f"{pi}: {pl['place']}: {len(cands)} usable, keeping {min(len(cands), PER_PLACE)}", flush=True)
    (folder / spec.get("out", "gallery-candidates.json")).write_text(json.dumps({"trip": trip, "places": out}, indent=1, ensure_ascii=False))

    # contact sheets
    from PIL import Image, ImageDraw
    flat = [(pi, ci, c) for pi, pl in enumerate(out) for ci, c in enumerate(pl["candidates"])]
    tw, th, cols = 300, 200, 4
    for s in range(0, len(flat), 12):
        chunk = flat[s:s + 12]
        rows = (len(chunk) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * tw, rows * (th + 16)), "white")
        d = ImageDraw.Draw(sheet)
        for i, (pi, ci, c) in enumerate(chunk):
            x, y = (i % cols) * tw, (i // cols) * (th + 16)
            tp = work / f"{pi}_{ci}.jpg"
            if not tp.exists():
                time.sleep(2)
                try:
                    tp.write_bytes(G._get(G.file_url(c["file"], 400)))
                except Exception as e:  # noqa: BLE001
                    d.text((x + 4, y + 20), f"FAIL {e}", fill="red")
                    continue
            im = Image.open(tp).convert("RGB")
            im.thumbnail((tw - 4, th - 2))
            sheet.paste(im, (x + 2, y + 16))
            d.text((x + 4, y + 2), f"{pi}.{ci} {out[pi]['place'][:28]}", fill="black")
        sp = work / f"sheet-{s // 12}.jpg"
        sheet.save(sp, quality=80)
        print("sheet", sp, flush=True)


if __name__ == "__main__":
    main()
