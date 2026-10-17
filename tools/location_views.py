#!/usr/bin/env python3
"""Generated views of the location store: WISHLIST.md, the list page and the globe's places.json.

Pure functions over the v2 store dict, plus `write_all` for the three files. Stdlib only.
Nothing here reads the clock: the build stamp is the store's own `updated` date, so the same store
always gives the same bytes and a hook run never leaves a diff in git.

Public fields only (plan decision D14): first line of notes, http(s) source URLs, no screenshot or
inbox path, no resolver internals.
"""
from __future__ import annotations

import json
import os
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIEW_SCHEMA = "locations-view/1"
GLOBE_SCHEMA = "globe-places/1"
MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
NOTE_MAX = 280


@dataclass
class Paths:
    """Every file the tool reads or writes, derived from one root so tests can point at a tmp dir."""
    root: Path
    store: Path = field(init=False)
    vocab: Path = field(init=False)
    wishlist: Path = field(init=False)
    list_page: Path = field(init=False)
    globe_places: Path = field(init=False)
    template: Path = field(init=False)
    css: Path = field(init=False)
    countries_json: Path = field(init=False)
    trips_root: Path = field(init=False)

    def __post_init__(self) -> None:
        self.root = Path(self.root)
        r = self.root
        self.store = r / "data" / "locations" / "locations.json"
        self.vocab = r / "data" / "vocab" / "tags.json"
        self.wishlist = r / "data" / "locations" / "WISHLIST.md"
        self.list_page = r / "legacy" / "locations" / "index.html"
        self.globe_places = r / "legacy" / "globe" / "assets" / "data" / "places.json"
        self.template = r / "legacy" / "_system" / "site" / "locations.html"
        self.css = r / "legacy" / "_system" / "site" / "site.css"
        self.countries_json = r / "data" / "reference" / "countries.json"
        self.trips_root = r / "legacy"


def default_paths() -> Paths:
    return Paths(Path(os.environ.get("LOCATIONS_ROOT", ROOT)))


# ----------------------------------------------------------------------------- joins
class Index:
    """Lookup dicts built once per load. Rows are the store's own dicts, not copies."""

    def __init__(self, data: dict):
        self.country = {r["code"]: r for r in data.get("countries", [])}
        self.region = {r["id"]: r for r in data.get("regions", [])}
        self.area = {r["id"]: r for r in data.get("areas", [])}
        self.place = {r["id"]: r for r in data.get("places", [])}
        self.tag = {r["id"]: r for r in data.get("tags", [])}
        self.collection = {r["id"]: r for r in data.get("collections", [])}
        self.tags_of: dict[str, list[str]] = {}
        for r in data.get("place_tags", []):
            self.tags_of.setdefault(r["place_id"], []).append(r["tag_id"])
        for v in self.tags_of.values():
            v.sort()
        self.sources_of: dict[str, list[dict]] = {}
        self.sources_of_collection: dict[str, list[dict]] = {}
        for r in sorted(data.get("sources", []), key=lambda s: s["id"]):
            if r.get("place_id"):
                self.sources_of.setdefault(r["place_id"], []).append(r)
            if r.get("collection_id"):
                self.sources_of_collection.setdefault(r["collection_id"], []).append(r)
        self.visits_of: dict[str, list[dict]] = {}
        for r in data.get("visits", []):
            self.visits_of.setdefault(r["place_id"], []).append(r)
        self.stops_of: dict[str, list[str]] = {}
        for r in sorted(data.get("collection_places", []), key=lambda r: (r["collection_id"], r["position"])):
            self.stops_of.setdefault(r["collection_id"], []).append(r["place_id"])
        self.collections_of: dict[str, list[str]] = {}
        for cid in sorted(self.stops_of):
            for pid in dict.fromkeys(self.stops_of[cid]):
                self.collections_of.setdefault(pid, []).append(cid)

    def geo(self, place: dict) -> tuple[dict, dict, dict]:
        """(country, region, area) rows for a place; empty dicts when a link is broken."""
        area = self.area.get(place.get("area_id"), {})
        region = self.region.get(area.get("region_id"), {})
        country = self.country.get(region.get("country"), {})
        return country, region, area


# ----------------------------------------------------------------------------- helpers
def first_line(text: str | None, limit: int = NOTE_MAX) -> str:
    for line in (text or "").splitlines():
        line = line.strip()
        if line:
            return line if len(line) <= limit else line[: limit - 1].rstrip() + "…"
    return ""


def public_links(sources: list[dict]) -> list[dict]:
    out = []
    for s in sources:
        url = s.get("url") or ""
        if url.startswith(("http://", "https://")):
            out.append({"type": s.get("type") or "source", "url": url})
    return out


def season_names(months: list[int] | None) -> list[str]:
    return [MONTHS[m - 1] for m in (months or []) if isinstance(m, int) and 1 <= m <= 12]


def trip_url(slug: str | None, paths: Paths) -> str | None:
    if slug and (paths.trips_root / slug / "index.html").is_file():
        return f"../{slug}/"
    return None


def gmap(p: dict, country_name: str = "", region_name: str = "") -> str:
    if p.get("lat") is not None:
        return f"https://maps.google.com/?q={p['lat']},{p['lon']}"
    return "https://maps.google.com/?q=" + urllib.parse.quote_plus(f"{p['name']} {region_name} {country_name}".strip())


# ----------------------------------------------------------------------------- views
def _sort_key(row: dict) -> tuple:
    return (row["country_name"], row["region_name"], row["area_name"], row["name"], row["id"])


def view(data: dict, paths: Paths | None = None) -> dict:
    """The list-page contract `locations-view/1` (plan section 2.2)."""
    paths = paths or default_paths()
    ix = Index(data)
    rows = []
    for p in data.get("places", []):
        country, region, area = ix.geo(p)
        rows.append({
            "id": p["id"], "name": p["name"], "kind": p["kind"], "status": p["status"], "kid_fit": p["kid_fit"],
            "season": season_names(p.get("season_months")),
            "country": country.get("code", ""), "country_name": country.get("name", ""),
            "country_a3": country.get("a3"),
            "region": region.get("code", ""), "region_name": region.get("name", ""),
            "region_iso": region.get("iso_3166_2"),
            "area": area.get("slug", ""), "area_name": area.get("name", ""),
            "lat": p.get("lat"), "lon": p.get("lon"), "elevation_m": p.get("elevation_m"),
            "wikidata": p.get("wikidata"), "image": p.get("image"),
            "tags": [t for t in ix.tags_of.get(p["id"], [])],
            "stats": p.get("stats") or {}, "stats_verified": bool(p.get("stats_verified")),
            "note": first_line(p.get("notes")),
            "links": public_links(ix.sources_of.get(p["id"], [])),
            "trip": p.get("trip"), "trip_url": trip_url(p.get("trip"), paths),
            "location_status": p["location_status"],
            "collections": ix.collections_of.get(p["id"], []),
            "added": p["added"],
        })
    rows.sort(key=_sort_key)
    used = sorted({t for r in rows for t in r["tags"]})
    cols = []
    for c in sorted(data.get("collections", []), key=lambda c: c["id"]):
        cols.append({"id": c["id"], "name": c["name"], "country": c.get("country"),
                     "notes": first_line(c.get("notes")), "stops": list(ix.stops_of.get(c["id"], [])),
                     "links": public_links(ix.sources_of_collection.get(c["id"], []))})
    return {
        "schema": VIEW_SCHEMA, "updated": data.get("updated"),
        "countries": {r["code"]: r["name"] for r in sorted(data.get("countries", []), key=lambda r: r["code"])},
        "tags": {t: ix.tag[t]["label"] if t in ix.tag else t for t in used},
        "places": rows, "collections": cols,
    }


def globe_places(data: dict, paths: Paths | None = None) -> dict:
    """The globe contract `globe-places/1`, built from view() rows so the two pages agree (plan 2.3)."""
    v = view(data, paths)
    keys = ("id", "name", "kind", "status", "country", "country_a3", "region_name", "area_name", "lat", "lon",
            "note", "links", "wikidata", "trip", "trip_url", "location_status")
    rows = [{k: r[k] for k in keys} for r in v["places"] if r["status"] != "dropped"]
    return {"schema": GLOBE_SCHEMA, "updated": v["updated"], "count": len(rows), "places": rows}


def wishlist_md(data: dict, paths: Paths | None = None) -> str:
    ix = Index(data)
    entries = []
    for p in data.get("places", []):
        country, region, area = ix.geo(p)
        entries.append((p, country.get("name", ""), region.get("name", ""), area.get("name", "")))
    entries.sort(key=lambda e: (e[1], e[2], e[3], e[0]["name"], e[0]["id"]))
    by_status: dict[str, int] = {}
    for p, *_ in entries:
        by_status[p["status"]] = by_status.get(p["status"], 0) + 1
    collections = sorted(data.get("collections", []), key=lambda c: c["name"])
    out = ["# Wishlist", "",
           f"Generated from `data/locations/locations.json` on {data.get('updated', '')}. Do not edit by hand; "
           "add with `python3 tools/locations.py add ...` or the `location` skill.", "",
           f"{len(entries)} places in {len({e[1] for e in entries})} countries, "
           f"{len(collections)} collections. By status: " + ", ".join(f"{k} {v}" for k, v in sorted(by_status.items())) + ".", "",
           "Legend: kind · season · status · stats from the source post are unverified until a research lane confirms them.", ""]
    cur = (None, None, None)
    for p, cn, rn, an in entries:
        key = (cn, rn, an)
        if key[0] != cur[0]:
            out += [f"## {key[0]}", ""]
        if key[:2] != cur[:2]:
            out += [f"### {key[1]}", ""]
        if key != cur:
            out += [f"#### {key[2]}", ""]
        cur = key
        season = ",".join(season_names(p.get("season_months"))) or "season ?"
        stat_s = " · ".join(f"{k} {v}" for k, v in (p.get("stats") or {}).items())
        bits = [f"**{p['name']}**", p["kind"], season, p["status"]]
        if p.get("kid_fit") not in (None, "unknown"):
            bits.append(f"kids: {p['kid_fit']}")
        if stat_s:
            bits.append(stat_s + " (unverified)" if not p.get("stats_verified") else stat_s)
        links = [f"[map]({gmap(p, cn, rn)})"]
        if p.get("wikidata"):
            links.append(f"[wd](https://www.wikidata.org/wiki/{p['wikidata']})")
        for s in ix.sources_of.get(p["id"], []):
            if s.get("url"):
                links.append(f"[{s.get('type', 'source')}]({s['url']})")
        if p.get("trip"):
            links.append(f"[trip](../{p['trip']}/)")
        line = f"- {' · '.join(bits)} · {' '.join(links)}"
        tags = ix.tags_of.get(p["id"], [])
        if tags:
            line += " · " + " ".join("#" + t for t in tags)
        out.append(line)
        first = first_line(p.get("notes"), limit=10_000)
        if first:
            out.append(f"  - {first}")
        out.append(f"  - <sub>{p['id']}</sub>")
    if collections:
        out += ["", "## Collections (road trips and multi-stop ideas)", ""]
        for c in collections:
            out += [f"### {c['name']}", ""]
            if (c.get("notes") or "").strip():
                out += [c["notes"].strip(), ""]
            for n, pid in enumerate(ix.stops_of.get(c["id"], []), 1):
                p = ix.place.get(pid)
                if p:
                    _, region, _ = ix.geo(p)
                    country = ix.geo(p)[0]
                    out.append(f"{n}. {p['name']} ({region.get('name', '')}) "
                               f"[map]({gmap(p, country.get('name', ''), region.get('name', ''))})")
                else:
                    out.append(f"{n}. {pid} (unknown id)")
            for s in ix.sources_of_collection.get(c["id"], []):
                if s.get("url"):
                    out.append(f"\nSource: [{s.get('type', 'link')}]({s['url']})")
            out.append("")
    return "\n".join(out).rstrip() + "\n"


def list_page_html(data: dict, paths: Paths | None = None) -> str | None:
    """Fill the page template. Returns None when the template is missing or does not yet read the
    `locations-view/1` contract (the draft template reads the v1 fields and would render wrongly)."""
    paths = paths or default_paths()
    if not paths.template.is_file():
        return None
    html = paths.template.read_text(encoding="utf-8")
    if VIEW_SCHEMA not in html:
        return None
    css = paths.css.read_text(encoding="utf-8") if paths.css.is_file() else ""
    blob = json.dumps(view(data, paths), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return (html.replace("/*__SITE_CSS__*/", css)
                .replace("__BUILT__", str(data.get("updated", "")))
                .replace("__SITE_DATA__", blob))


def _globe_json(g: dict) -> str:
    """One place per line so a changed place is a one-line diff."""
    head = {k: g[k] for k in ("schema", "updated", "count")}
    top = json.dumps(head, ensure_ascii=False, separators=(",", ":"))[:-1]
    rows = ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in g["places"])
    return f'{top},"places":[\n{rows}\n]}}\n' if rows else f'{top},"places":[]}}\n'


def render_all(data: dict, paths: Paths | None = None) -> dict[Path, bytes]:
    paths = paths or default_paths()
    out: dict[Path, bytes] = {
        paths.wishlist: wishlist_md(data, paths).encode("utf-8"),
        paths.globe_places: _globe_json(globe_places(data, paths)).encode("utf-8"),
    }
    page = list_page_html(data, paths)
    if page is not None:
        out[paths.list_page] = page.encode("utf-8")
    return out


def stale(data: dict, paths: Paths | None = None) -> list[Path]:
    """Outputs whose bytes on disk differ from what render_all would write."""
    return [p for p, b in render_all(data, paths).items() if not p.is_file() or p.read_bytes() != b]


def write_all(data: dict, paths: Paths | None = None) -> list[Path]:
    """Write only the files whose bytes changed. Returns the paths written."""
    written = []
    for p, b in render_all(data, paths).items():
        if p.is_file() and p.read_bytes() == b:
            continue
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b)
        written.append(p)
    return written
