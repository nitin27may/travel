#!/usr/bin/env python3
"""Merge the raw lane files into the final data layer the page builder reads.

Inputs  (data/): national.json provincial.json links-national.json links-provincial.json
                 adventures.json verify-adventures.json
Outputs (data/): sights.json trails.json adventures.merged.json   (bookings.json and bases.json are used as-is)
Rules: link files only fill nulls/zeros; a fetched verification overrides an adventure's limits;
every adult_only trail must resolve to a family alternative or the merge fails.
"""
import json
from pathlib import Path

D = Path(__file__).resolve().parent / "data"
load = lambda n: json.loads((D / n).read_text(encoding="utf-8"))
nat, prov = load("national.json"), load("provincial.json")
ln, lp = load("links-national.json"), load("links-provincial.json")

trails, sights = [], []
for src, links in ((nat, ln), (prov, lp)):
    for t in src["trails"]:
        L = links["trails"].get(t["id"], {})
        t = dict(t)
        for k in ("alltrails_url", "official_url"):
            if not t.get(k) and L.get(k):
                t[k] = L[k]
        for k in ("km", "mi", "gain_m"):
            if not t.get(k) and L.get(k):
                t[k] = L[k]
                t.setdefault("stats_note", L.get("stats_source"))
        if t.get("km") and not t.get("mi"):
            t["mi"] = round(t["km"] * 0.621371, 1)
        t["alltrails_checked"] = False  # URLs came from search results; alltrails.com returned 403 to fetch
        trails.append(t)
    for s in src["sights"]:
        L = links["sights"].get(s["id"], {})
        s = dict(s)
        if not s.get("official_url") and L.get("official_url"):
            s["official_url"] = L["official_url"]
        sights.append(s)

ids = [x["id"] for x in trails + sights]
dups = {i for i in ids if ids.count(i) > 1}
by_id = {x["id"]: x for x in trails + sights}
errs = []
if dups:
    errs.append(f"duplicate ids: {sorted(dups)}")
for t in trails:
    if t["audience"] == "adult_only":
        fa = t.get("family_alternative_id")
        if not fa or fa not in by_id:
            errs.append(f"{t['id']}: family_alternative_id {fa!r} does not resolve")
        if not t.get("less_walking_alternative"):
            errs.append(f"{t['id']}: no less_walking_alternative")
if errs:
    raise SystemExit("MERGE FAILED:\n  " + "\n  ".join(errs))

adv = load("adventures.json")
ver = load("verify-adventures.json")["entries"]
for a in adv:
    v = ver.get(a["id"])
    if v and v.get("fetched"):
        for k in ("min_age", "min_height_cm", "max_weight_kg", "min_weight_kg"):
            if v.get(k) is not None:
                a[k] = v[k]
        for k in ("price_cad_2026", "season_window", "child_6yo_ok"):
            if v.get(k):
                a[k] = v[k]
        a["operator_url"] = v.get("operator_url")
        a["status"] = "VERIFIED"
        a["verify_note"] = v.get("note", "")
known = {a["id"] for a in adv}
extra = {k: v for k, v in ver.items() if k not in known}
(D / "sights.json").write_text(json.dumps(sights, indent=1, ensure_ascii=False))
(D / "trails.json").write_text(json.dumps(trails, indent=1, ensure_ascii=False))
(D / "adventures.merged.json").write_text(json.dumps({"adventures": adv, "verified_only": extra}, indent=1, ensure_ascii=False))
from collections import Counter
print(f"sights {len(sights)}, trails {len(trails)} {dict(Counter(t['audience'] for t in trails))}, adventures {len(adv)} (+{len(extra)} verify-only)")
print("alltrails:", sum(1 for t in trails if t.get('alltrails_url')), "official:", sum(1 for t in trails if t.get('official_url')), "of", len(trails))
