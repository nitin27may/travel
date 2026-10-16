#!/usr/bin/env python3
"""Turn a human selection into gallery.json.

    python3 _system/gallery_pick.py <trip>/gallery-picks.json

picks file: {"trip": "slug", "authors": {"bad author string": "Fixed Name"}, "picks": {"0.0": "caption", ...}}
Ids are "<place>.<candidate>" from the contact sheets made by gallery_find.py. Section order
follows the candidates file; places with no picks are dropped.
"""
import json
import sys
from pathlib import Path

p = Path(sys.argv[1])
cfg = json.loads(p.read_text())
cand = json.loads((p.parent / "gallery-candidates.json").read_text())
fix = cfg.get("authors", {})
sections = []
for pi, pl in enumerate(cand["places"]):
    photos = []
    for ci, c in enumerate(pl["candidates"]):
        cap = cfg["picks"].get(f"{pi}.{ci}")
        if not cap:
            continue
        author = next((v for k, v in fix.items() if k in c["author"]), c["author"])
        photos.append({"file": c["file"], "caption": cap, "author": author, "license": c["license"]})
    if photos:
        sections.append({"place": pl["place"], "blurb": pl["blurb"], "days": pl.get("days", ""), "photos": photos})
out = {"trip": cand["trip"], "sections": sections}
(p.parent / "gallery.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
print(f"wrote gallery.json: {len(sections)} sections, {sum(len(s['photos']) for s in sections)} photos")
