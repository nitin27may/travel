#!/usr/bin/env python3
"""Fill the reference tables in PLAN.md (between <!-- BEGIN:x --> and <!-- END:x --> markers) from data/*.json."""
import json, re
from pathlib import Path

HERE = Path(__file__).resolve().parent
D = lambda n: json.loads((HERE / "data" / n).read_text(encoding="utf-8"))
sights, trails, bookings = D("sights.json"), D("trails.json"), D("bookings.json")
adv = D("adventures.merged.json")["adventures"]


def link(label, url):
    return f"[{label}]({url})" if url else "GAP"


def table(head, rows):
    out = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
    out += ["| " + " | ".join(str(c).replace("|", "/").replace("\n", " ") for c in r) + " |" for r in rows]
    return "\n".join(out)


def trail_rows(ts):
    rows = []
    for t in ts:
        dist = f"{t['km']} km ({t['mi']} mi)" if t.get("km") else "GAP"
        rows.append([f"**{t['name']}**<br>{t['park']}", t["difficulty"], dist, f"{t['gain_m']} m" if t.get("gain_m") else "GAP",
                     t.get("hours", ""), link("Map", t["map_url"]), link("AllTrails", t.get("alltrails_url")),
                     link("Official", t.get("official_url")), t["child_note"][:140], t.get("family_alternative_id") or ""])
    return rows


blocks = {
    "sights": table(["Sight", "Park", "Time", "Map", "Official", "Why", "Child note", "Status"],
                    [[f"**{s['name']}**", s["park"], f"{s.get('time_needed_hours','')} h", link("Map", s["map_url"]),
                      link("Official", s.get("official_url")), s["why_must_do"][:120], s.get("child_note", "")[:100], s["status"]] for s in sights]),
    "trails-family": table(["Trail", "Level", "Distance", "Gain", "Time", "Map", "AllTrails", "Official", "For a 6 year old", "Alt"],
                           trail_rows([t for t in trails if t["audience"] in ("family", "both")])),
    "trails-adult": table(["Trail", "Level", "Distance", "Gain", "Time", "Map", "AllTrails", "Official", "Why adults only", "Family alternative"],
                          trail_rows([t for t in trails if t["audience"] == "adult_only"])),
    "bookings": table(["Booking", "Provider", "Opens (2026 pattern)", "Sells out", "Cost (CAD 2026)", "Must do", "Link", "Status"],
                      [[b["item"], b["provider"], b["opens_2026_pattern"][:90], b["sells_out_note"][:80], b["cost_cad_2026"][:50],
                        "yes" if b.get("must_do") else "no", link("Book", b.get("book_url")), b["status"]] for b in bookings]),
    "adventures": table(["Adventure", "Park", "Min age", "Height", "Weight", "Child 6 yrs", "Price (CAD 2026)", "Early Sept", "Map", "Status"],
                        [[a["name"], a["park"], a.get("min_age") or "GAP", a.get("min_height_cm") or "none stated", a.get("max_weight_kg") or "-",
                          a["child_6yo_ok"], str(a.get("price_cad_2026", ""))[:60], str(a.get("season_window", ""))[:70], link("Map", a["map_url"]), a["status"]] for a in adv]),
}
p = HERE / "PLAN.md"
s = p.read_text(encoding="utf-8")
for k, body in blocks.items():
    pat = re.compile(rf"(<!-- BEGIN:{k} -->).*?(<!-- END:{k} -->)", re.S)
    if not pat.search(s):
        print(f"warning: markers for {k} missing")
        continue
    s = pat.sub(lambda m: f"{m.group(1)}\n{body}\n{m.group(2)}", s)
p.write_text(s, encoding="utf-8")
print("tables written:", {k: body.count(chr(10)) - 1 for k, body in blocks.items()})
