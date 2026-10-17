#!/usr/bin/env python3
"""Location store (schema v2): the laundry list of places we might go, kept as data.

    python3 tools/locations.py add "Lake Louise" --country CA --region AB --tags lake,family
    python3 tools/locations.py import locations/inbox/batch.json
    python3 tools/locations.py collection add --slug gaspesie-loop --name "..." --places ID,ID
    python3 tools/locations.py edit ID --status shortlisted --note-append "..." --tags-add a,b
    python3 tools/locations.py visit add ID --date 2026-10-02 [--end ...] [--trip SLUG]
    python3 tools/locations.py tag alias waterfalls waterfall | tag list
    python3 tools/locations.py validate
    python3 tools/locations.py build [--check]    # data/locations/WISHLIST.md, locations/index.html, globe places.json
    python3 tools/locations.py list [--country CA] [--q charlevoix] [--status idea] [--tag lake]

Store: data/locations/locations.json (schema v2, one array per table, one row per line). Hierarchy is
country > region > area > place with fixed path ids like CA/AB/banff-national-park/lake-louise.
Resolution uses Wikidata first (coordinates, parent chain, country), then OpenStreetMap Nominatim.
Stdlib only. One network request at a time, a second apart. LOCATIONS_ROOT points the tool at
another root (tests, dry runs).

Exit codes: 0 ok, 1 error or validation failure, 2 ambiguous (candidates printed, re-run with --pick N).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import location_views as V  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
Paths = V.Paths
PATHS = Paths(Path(os.environ.get("LOCATIONS_ROOT", ROOT)))   # tests: monkeypatch.setattr(D, "PATHS", D.Paths(tmp))
UA = "nks-travel-locations/0.1 (personal trip planner; nitin27may@gmail.com)"
WD = "https://www.wikidata.org/w/api.php"
NOMINATIM = "https://nominatim.openstreetmap.org/search"

SCHEMA_VERSION = 2
KINDS = ("trail", "viewpoint", "waterfall", "lake", "mountain", "park", "town", "city", "island",
         "beach", "canyon", "valley", "activity", "lodge", "drive", "museum", "lighthouse",
         "region", "place")
STATUSES = ("idea", "shortlisted", "planned", "visited", "dropped")
KID_FIT = ("yes", "strong-kid", "no", "unknown")

# Wikidata instance-of (P31) to our kind. Checked in order; first hit wins.
P31_KIND = [
    ({"Q2143825", "Q1233637", "Q5004679"}, "trail"),            # hiking trail, trail, path
    ({"Q34038", "Q7707728"}, "waterfall"),
    ({"Q23397", "Q211302", "Q187223", "Q3215290"}, "lake"),      # lake, glacial lake, tarn, lake group
    ({"Q8502", "Q54050", "Q207326", "Q1437459", "Q2633353"}, "mountain"),  # mountain, hill, summit, peak
    ({"Q46169", "Q473972", "Q179049", "Q22698", "Q1377575", "Q3918" , "Q2028015"}, "park"),  # national park, protected area, nature reserve, park, state park
    ({"Q150784", "Q39816", "Q1322134"}, "canyon"),               # canyon, valley, gorge
    ({"Q23442", "Q1322134"}, "island"),
    ({"Q39715"}, "lighthouse"),
    ({"Q33506", "Q207694"}, "museum"),
    ({"Q40080", "Q2287072"}, "beach"),
    ({"Q130003", "Q1783585", "Q5107"}, "activity"),              # ski resort, cable car, (generic)
    ({"Q515", "Q1549591", "Q1093829"}, "city"),
    ({"Q3957", "Q5084", "Q532", "Q17366755", "Q486972", "Q15284"}, "town"),  # town, hamlet, village, human settlement, municipality
    ({"Q27096213", "Q82794", "Q3455524"}, "region"),              # geographic entity, region
]
COUNTRY_QID = {"Q16": "CA", "Q30": "US", "Q38": "IT", "Q142": "FR", "Q881": "VN", "Q668": "IN", "Q414": "AR",
               "Q298": "CL", "Q39": "CH", "Q20": "NO", "Q189": "IS", "Q419": "PE", "Q800": "CR", "Q145": "GB",
               "Q29": "ES", "Q45": "PT", "Q17": "JP", "Q664": "NZ", "Q408": "AU", "Q96": "MX", "Q183": "DE", "Q40": "AT"}
NON_PLACE_P31 = {"Q5", "Q3305213", "Q11424", "Q7725634", "Q482994", "Q13442814", "Q4830453"}  # human, painting, film, literary work, album, article, business

LOCATION_STATUS = ("resolved", "unconfirmed")
RESOLVERS = ("wikidata", "nominatim", "manual", "none")
SOURCE_TYPES = ("instagram", "facebook", "tiktok", "youtube", "reddit", "blog", "article", "official",
                "guidebook", "friend", "note")
LAYOUTS = ("single", "by-country")
INITIAL_ALIASES = {"waterfalls": "waterfall", "lighthouses": "lighthouse", "gorges": "gorge", "canyons": "canyon",
                   "lakes": "lake", "suspension-bridges": "suspension-bridge", "mountains": "mountain"}
DROP_TAGS = {"location-unconfirmed"}

# One entry per column: (name, type, nullable). Order is the order written to the file.
COLUMNS: dict[str, list[tuple[str, str, bool]]] = {
    "countries": [("code", "text", False), ("a3", "text", True), ("name", "text", False)],
    "regions": [("id", "text", False), ("country", "text", False), ("code", "text", False),
                ("name", "text", False), ("iso_3166_2", "text", True)],
    "areas": [("id", "text", False), ("region_id", "text", False), ("slug", "text", False), ("name", "text", False)],
    "places": [("id", "text", False), ("area_id", "text", False), ("name", "text", False),
               ("resolved_name", "text", True), ("kind", "text", False), ("status", "text", False),
               ("trip", "text", True), ("lat", "real", True), ("lon", "real", True), ("elevation_m", "int", True),
               ("location_status", "text", False), ("resolver", "text", False), ("wikidata", "text", True),
               ("image", "text", True), ("season_months", "json", False), ("kid_fit", "text", False),
               ("stats", "json", False), ("stats_verified", "bool", False), ("notes", "text", False),
               ("added", "date", False)],
    "place_tags": [("place_id", "text", False), ("tag_id", "text", False)],
    "tags": [("id", "text", False), ("label", "text", False), ("alias_of", "text", True)],
    "sources": [("id", "text", False), ("place_id", "text", True), ("collection_id", "text", True),
                ("type", "text", False), ("url", "text", True), ("note", "text", True),
                ("screenshot", "text", True), ("post_date", "date", True), ("saved", "date", False)],
    "visits": [("id", "text", False), ("place_id", "text", False), ("date_start", "pdate", False),
               ("date_end", "pdate", True), ("trip", "text", True), ("notes", "text", False)],
    "collections": [("id", "text", False), ("name", "text", False), ("country", "text", True),
                    ("notes", "text", False), ("added", "date", False)],
    "collection_places": [("collection_id", "text", False), ("position", "int", False), ("place_id", "text", False)],
}
TABLES = tuple(COLUMNS)    # file order of the arrays
PK = {"countries": ("code",), "regions": ("id",), "areas": ("id",), "places": ("id",), "place_tags": ("place_id", "tag_id"),
      "tags": ("id",), "sources": ("id",), "visits": ("id",), "collections": ("id",),
      "collection_places": ("collection_id", "position")}
ROOT_SCALARS = ("schema_version", "updated", "layout", "parts")
PLACE_ID_RE = re.compile(r"^[A-Z]{2}/[A-Za-z0-9-]+/[a-z0-9-]+/[a-z0-9-]+$")
DAY_MONTH_YEAR = re.compile(r"\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})\b")


class Fail(Exception):
    """A user-facing error. `code` is the process exit code (1 error, 2 ambiguous)."""

    def __init__(self, msg: str, code: int = 1):
        super().__init__(msg)
        self.code = code


# ----------------------------------------------------------------------------- helpers
# ----------------------------------------------------------------------------- helpers
def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "x"


def haversine_km(a_lat, a_lon, b_lat, b_lon) -> float:
    r = 6371.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = math.radians(b_lat - a_lat), math.radians(b_lon - a_lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def make_id(country: str, region: str, area: str, name: str) -> str:
    return "/".join([country.upper(), slugify(region).upper() if len(region) <= 3 else slugify(region),
                     slugify(area), slugify(name)])


def kind_from_p31(ids: list[str]) -> str:
    s = set(ids)
    for group, kind in P31_KIND:
        if s & group:
            return kind
    return "place"


def today() -> str:
    return dt.date.today().isoformat()



def default_label(tag_id: str) -> str:
    s = tag_id.replace("-", " ")
    return s[:1].upper() + s[1:]


def parse_months(vals) -> list[int]:
    """Accept Sep, September, 9 or a list of those. Returns sorted distinct ints 1-12."""
    if vals is None:
        return []
    if isinstance(vals, (str, int)):
        vals = [vals]
    out = set()
    for v in vals:
        if isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= 12:
            out.add(v)
            continue
        s = str(v).strip()
        if s.isdigit() and 1 <= int(s) <= 12:
            out.add(int(s))
        elif s[:3].title() in V.MONTHS:
            out.add(V.MONTHS.index(s[:3].title()) + 1)
        else:
            raise Fail(f"cannot read month {v!r}; use Sep, September or 9")
    return sorted(out)


def parse_post_date(note: str | None) -> str | None:
    m = DAY_MONTH_YEAR.search(note or "")
    if not m:
        return None
    try:
        return dt.date(int(m.group(3)), V.MONTHS.index(m.group(2)) + 1, int(m.group(1))).isoformat()
    except ValueError:
        return None


def valid_date(s) -> bool:
    if not isinstance(s, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return False
    try:
        dt.date.fromisoformat(s)
        return True
    except ValueError:
        return False


def valid_pdate(s) -> bool:
    if not isinstance(s, str):
        return False
    if re.fullmatch(r"\d{4}", s):
        return True
    if re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", s):
        return True
    return valid_date(s)


def _pdate_bounds(s: str) -> tuple[str, str]:
    """Earliest and latest day a partial date can mean."""
    if len(s) == 4:
        return f"{s}-01-01", f"{s}-12-31"
    if len(s) == 7:
        return f"{s}-01", f"{s}-31"
    return s, s


def load_a3(path: Path | None = None) -> dict[str, str]:
    """ISO alpha-2 to alpha-3 from data/reference/countries.json (keyed by numeric code)."""
    path = path or PATHS.countries_json
    if not path.is_file():
        return {}
    return {v["a2"]: v["a3"] for v in json.loads(path.read_text(encoding="utf-8")).values()
            if v.get("a2") and v.get("a3")}


def region_iso(country: str, code: str) -> str | None:
    return f"{country}-{code}" if re.fullmatch(r"[A-Z]{1,3}", code or "") else None


# ----------------------------------------------------------------------------- store
def empty_store() -> dict:
    data = {"schema_version": SCHEMA_VERSION, "updated": today(), "layout": "single"}
    for t in TABLES:
        data[t] = []
    seed_aliases(data)
    return data


def seed_aliases(data: dict) -> None:
    for alias, target in INITIAL_ALIASES.items():
        ensure_tag(data, target)
        if not any(t["id"] == alias for t in data["tags"]):
            data["tags"].append({"id": alias, "label": default_label(alias), "alias_of": target})


def ensure_tag(data: dict, tid: str) -> None:
    if not any(t["id"] == tid for t in data["tags"]):
        data["tags"].append({"id": tid, "label": default_label(tid), "alias_of": None})


def normalize_tags(data: dict, raw, kind: str | None) -> list[str]:
    """slugify, resolve alias, drop a tag equal to the kind and the retired location-unconfirmed tag."""
    amap = {t["id"]: t.get("alias_of") for t in data["tags"]}
    out: list[str] = []
    for t in raw or []:
        if not str(t).strip():
            continue
        s = slugify(str(t))
        seen = set()
        while amap.get(s) and s not in seen:
            seen.add(s)
            s = amap[s]
        if s in DROP_TAGS or s == kind or s in out:
            continue
        ensure_tag(data, s)
        out.append(s)
    return sorted(out)


def ordered_row(table: str, row: dict) -> dict:
    cols = [c[0] for c in COLUMNS[table]]
    out = {c: row.get(c) for c in cols}
    for k, v in row.items():       # unknown columns survive a round trip so validate can name them
        if k not in out:
            out[k] = v
    return out


def _sort_key(table: str, row: dict):
    return tuple(row.get(k) for k in PK[table])


def dumps(data: dict) -> str:
    """Root scalars one per line, then each table as an array with one compact JSON row per line."""
    parts = []
    for k in ROOT_SCALARS:
        if k in data:
            parts.append(f"{json.dumps(k)}: {json.dumps(data[k], ensure_ascii=False)}")
    for t in TABLES:
        if t not in data:
            continue
        rows = sorted((ordered_row(t, r) for r in data[t]), key=lambda r: _sort_key(t, r))
        if rows:
            body = ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows)
            parts.append(f'"{t}": [\n{body}\n]')
        else:
            parts.append(f'"{t}": []')
    return "{\n" + ",\n".join(parts) + "\n}\n"


# --- load/save IO section (single file, or one file per country when layout is by-country) ---
ROOT_TABLES = ("countries", "tags", "collections", "collection_places")   # always live in the root file
PART_TABLES = ("regions", "areas", "places", "place_tags", "sources", "visits")
PART_KEYS = {"schema_version", "country", *PART_TABLES}


def part_path(cc: str) -> Path:
    return PATHS.store.parent / f"{cc}.json"


def _read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as ex:
        raise Fail(f"{path.name} is not valid JSON: {ex}")


def _first(key) -> str:
    return str(key or "").split("/", 1)[0]


def _check_part(cc: str, part: dict, schema_version) -> None:
    where = f"{cc}.json"
    extra = sorted(set(part) - PART_KEYS)
    if extra:
        raise Fail(f"{where}: unknown top-level key(s) {extra}")
    if part.get("country") != cc:
        raise Fail(f"{where}: country is {part.get('country')!r}, expected {cc!r}")
    if part.get("schema_version") != schema_version:
        raise Fail(f"{where}: schema_version {part.get('schema_version')!r} differs from the root file")
    owner = {"regions": lambda r: r.get("country"), "areas": lambda r: _first(r.get("region_id")),
             "places": lambda r: _first(r.get("area_id")), "place_tags": lambda r: _first(r.get("place_id")),
             "sources": lambda r: _first(r.get("place_id")) if r.get("place_id") else cc,
             "visits": lambda r: _first(r.get("place_id"))}
    for t, who in owner.items():
        for r in part.get(t, []):
            if who(r) != cc:
                raise Fail(f"{where}: {t} row {json.dumps(r, ensure_ascii=False)[:90]} belongs to {who(r)!r}, not {cc!r}")


def load() -> dict:
    if not PATHS.store.exists():
        return empty_store()
    data = _read_json(PATHS.store)
    if data.get("layout") != "by-country":
        return data
    parts = data.get("parts")
    if not isinstance(parts, list):
        raise Fail("layout is by-country but parts is not a list")
    for cc in parts:
        path = part_path(cc)
        if not path.is_file():
            raise Fail(f"part {cc}.json is listed in parts but missing")
        part = _read_json(path)
        _check_part(cc, part, data.get("schema_version"))
        for t in PART_TABLES:
            data.setdefault(t, []).extend(part.get(t, []))
    return data


def _country_maps(data: dict) -> tuple[dict, dict]:
    region_cc = {r["id"]: r.get("country") or _first(r["id"]) for r in data.get("regions", [])}
    area_cc = {a["id"]: region_cc.get(a.get("region_id")) or _first(a["id"]) for a in data.get("areas", [])}
    return region_cc, area_cc


def split_rows(data: dict) -> tuple[dict, dict[str, dict]]:
    """Route rows to a country. Anything that cannot be routed stays in the root so no row is lost."""
    region_cc, area_cc = _country_maps(data)
    place_cc = {p["id"]: area_cc.get(p.get("area_id")) or _first(p["id"]) for p in data.get("places", [])}
    root = {k: data[k] for k in ROOT_SCALARS if k in data}
    for t in ROOT_TABLES:
        root[t] = list(data.get(t, []))
    parts: dict[str, dict] = {}

    def put(cc, t, row):
        if cc and re.fullmatch(r"[A-Z]{2}", cc):
            parts.setdefault(cc, {k: [] for k in PART_TABLES})[t].append(row)
        else:
            root.setdefault(t, []).append(row)

    for r in data.get("regions", []):
        put(region_cc[r["id"]], "regions", r)
    for r in data.get("areas", []):
        put(area_cc[r["id"]], "areas", r)
    for r in data.get("places", []):
        put(place_cc[r["id"]], "places", r)
    for t in ("place_tags", "visits"):
        for r in data.get(t, []):
            put(place_cc.get(r.get("place_id")), t, r)
    for r in data.get("sources", []):
        if r.get("place_id"):
            put(place_cc.get(r["place_id"]), "sources", r)
        else:
            root["sources"] = root.get("sources", []) + [r]      # collection-owned
    root["parts"] = sorted(parts)
    return root, parts


def _rows_text(table: str, rows: list[dict]) -> str:
    rows = sorted((ordered_row(table, r) for r in rows), key=lambda r: _sort_key(table, r))
    if not rows:
        return f'"{table}": []'
    body = ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows)
    return f'"{table}": [\n{body}\n]'


def dumps_part(cc: str, schema_version, part: dict) -> str:
    items = [f'"schema_version": {json.dumps(schema_version)}', f'"country": {json.dumps(cc)}']
    items += [_rows_text(t, part.get(t, [])) for t in PART_TABLES]
    return "{\n" + ",\n".join(items) + "\n}\n"


def _write_if_changed(path: Path, text: str) -> None:
    if not path.exists() or path.read_text(encoding="utf-8") != text:
        path.write_text(text, encoding="utf-8")


def _listed_parts() -> list[str]:
    """Parts named by the root file on disk right now (before this save replaces it)."""
    try:
        old = json.loads(PATHS.store.read_text(encoding="utf-8")) if PATHS.store.exists() else {}
    except json.JSONDecodeError:
        return []
    return [cc for cc in old.get("parts", []) if isinstance(cc, str) and re.fullmatch(r"[A-Z]{2}", cc)] \
        if old.get("layout") == "by-country" else []


def save(data: dict, touch: bool = True) -> None:
    """Sort, write the store in the one-row-per-line format, then rebuild the generated views."""
    if touch:
        data["updated"] = today()
    PATHS.store.parent.mkdir(parents=True, exist_ok=True)
    old_parts = _listed_parts()
    if data.get("layout") == "by-country":
        root, parts = split_rows(data)
        data["parts"] = root["parts"]
        for cc, part in parts.items():
            _write_if_changed(part_path(cc), dumps_part(cc, data.get("schema_version"), part))
        text = dumps(root)
        keep = set(parts)
    else:
        data.pop("parts", None)
        text = dumps(data)
        keep = set()
    _write_if_changed(PATHS.store, text)
    for cc in old_parts:                      # a part the store no longer lists is stale
        if cc not in keep:
            part_path(cc).unlink(missing_ok=True)
    V.write_all(data, PATHS)
# --- end IO section ---


def ensure_v2(data: dict) -> dict:
    if data.get("schema_version") != SCHEMA_VERSION:
        raise Fail("locations.json is schema v1: run python3 tools/migrate_locations_v2.py first")
    for t in TABLES:
        data.setdefault(t, [])
    return data


def next_id(rows: list[dict], prefix: str, width: int) -> str:
    n = 0
    for r in rows:
        m = re.fullmatch(re.escape(prefix) + r"-(\d+)", r.get("id", ""))
        if m:
            n = max(n, int(m.group(1)))
    return f"{prefix}-{n + 1:0{width}d}"


def find_duplicate(data: dict, pid: str, name: str, lat, lon, region_id: str) -> dict | None:
    """Same id, same name in the same region, or another place within 300 m."""
    for p in data["places"]:
        if p["id"] == pid:
            return p
        if p["area_id"].rsplit("/", 1)[0] == region_id and slugify(p["name"]) == slugify(name):
            return p
        if lat is not None and p.get("lat") is not None and p.get("kind") != "region":
            km = haversine_km(lat, lon, p["lat"], p["lon"])
            # inside 300 m it is the same thing; a trail, a lake and a summit can all sit within 1.5 km
            if km < 0.3:
                return p
            if km < 1.5:
                print(f"  note: {name} is {km:.1f} km from {p['id']}; kept as a separate place", file=sys.stderr)
    return None


def find_place(data: dict, key: str) -> dict:
    """Exact id, else the one place whose id ends in /key or whose name slug matches."""
    for p in data["places"]:
        if p["id"] == key:
            return p
    hits = [p for p in data["places"] if p["id"].endswith("/" + key) or slugify(p["name"]) == slugify(key)]
    if len(hits) == 1:
        return hits[0]
    if not hits:
        raise Fail(f"no place {key!r}")
    raise Fail("ambiguous place; use the full id: " + ", ".join(p["id"] for p in hits), 2)


# ----------------------------------------------------------------------------- network
# ----------------------------------------------------------------------------- network
_last_call = 0.0


def _get(url: str, params: dict, min_gap: float = 1.0) -> dict:
    global _last_call
    wait = min_gap - (time.time() - _last_call)
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
    last_err = None
    for attempt, backoff in enumerate((0, 3, 10, 30)):
        if backoff:
            print(f"  retry {attempt} in {backoff}s: {last_err}", file=sys.stderr)
            time.sleep(backoff)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                _last_call = time.time()
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as ex:
            last_err = ex
            if ex.code not in (429, 500, 502, 503, 504):
                raise
        except (urllib.error.URLError, TimeoutError, OSError) as ex:   # DNS blips, resets
            last_err = ex
    raise RuntimeError(f"gave up after retries: {last_err}")


def wd_search(name: str, limit: int = 7) -> list[dict]:
    j = _get(WD, {"action": "wbsearchentities", "search": name, "language": "en", "type": "item",
                  "limit": limit, "format": "json"})
    return j.get("search", [])


def wd_entities(ids: list[str]) -> dict:
    out = {}
    for i in range(0, len(ids), 50):
        j = _get(WD, {"action": "wbgetentities", "ids": "|".join(ids[i:i + 50]),
                      "props": "claims|labels|descriptions", "languages": "en", "format": "json"})
        out.update(j.get("entities", {}))
    return out


def claim_vals(entity: dict, prop: str) -> list:
    out = []
    for s in entity.get("claims", {}).get(prop, []):
        dv = s.get("mainsnak", {}).get("datavalue")
        if dv:
            out.append(dv["value"])
    return out


def claim_ids(entity: dict, prop: str) -> list[str]:
    return [v["id"] for v in claim_vals(entity, prop) if isinstance(v, dict) and "id" in v]


def label(entity: dict) -> str:
    return entity.get("labels", {}).get("en", {}).get("value", entity.get("id", "?"))


def walk_admin_chain(start_ids: list[str], max_hops: int = 6) -> tuple[list[dict], dict | None, dict | None]:
    """Follow P131 (located in) upward. Returns (chain entities, region entity, country entity).
    Region = first ancestor with an ISO 3166-2 code (P300). Country = first with ISO 3166-1 (P297)."""
    chain, region, country = [], None, None
    frontier = list(start_ids)
    seen = set()
    for _ in range(max_hops):
        frontier = [i for i in frontier if i not in seen]
        if not frontier:
            break
        ents = wd_entities(frontier)
        nxt = []
        for i in frontier:
            e = ents.get(i)
            if not e:
                continue
            seen.add(i)
            chain.append(e)
            if region is None and claim_vals(e, "P300"):
                region = e
            if country is None and claim_vals(e, "P297"):
                country = e
            nxt += claim_ids(e, "P131")
            if country is None:
                nxt += claim_ids(e, "P17")
        if region is not None and country is not None:
            break
        frontier = nxt
    return chain, region, country


def reverse_area(lat: float, lon: float) -> str | None:
    """Nominatim reverse lookup for the county / municipality a point sits in. One request."""
    try:
        j = _get("https://nominatim.openstreetmap.org/reverse",
                 {"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 10, "addressdetails": 1}, min_gap=1.1)
    except Exception:
        return None
    a = j.get("address", {})
    for k in ("county", "municipality", "city_district", "town", "city", "village", "state_district"):
        if a.get(k):
            return a[k]
    return None


def resolve_wikidata(name: str, country_hint: str | None, region_hint: str | None, pick: int | None,
                     kind_hint: str | None = None) -> dict | None:
    cands = wd_search(name)
    if not cands:
        return None
    ents = wd_entities([c["id"] for c in cands])
    scored = []
    for c in cands:
        e = ents.get(c["id"], {})
        p31 = claim_ids(e, "P31")
        if set(p31) & NON_PLACE_P31:
            continue
        coords = claim_vals(e, "P625")
        if not coords:
            continue
        score = 1
        desc = (c.get("description") or "").lower()
        if country_hint:
            cands_cc = {COUNTRY_QID.get(q) for q in claim_ids(e, "P17")} - {None}
            if cands_cc:
                score += 3 if country_hint.upper() in cands_cc else -5   # wrong country is disqualifying
            elif _country_name(country_hint).lower() in desc:
                score += 2
        if region_hint and region_hint.lower() in desc:
            score += 2
        if slugify(c.get("label", "")) == slugify(name):
            score += 1
        if kind_hint and kind_from_p31(p31) == kind_hint:
            score += 2
        scored.append((score, c, e, coords[0], p31))
    scored = [t for t in scored if t[0] > 0]
    if not scored:
        return None
    scored.sort(key=lambda t: -t[0])
    if pick is not None:
        chosen = scored[pick]
    else:
        if len(scored) > 1 and scored[0][0] - scored[1][0] < 2 and not (country_hint and scored[0][0] >= 4):
            print("AMBIGUOUS: re-run with --pick N", file=sys.stderr)
            for n, (s, c, e, co, p31) in enumerate(scored):
                print(f"  --pick {n}: {c['id']} {c.get('label')} | {c.get('description')} | score {s} | {co['latitude']:.3f},{co['longitude']:.3f}", file=sys.stderr)
            sys.exit(2)
        chosen = scored[0]
    _, c, e, co, p31 = chosen
    chain, region_e, country_e = walk_admin_chain(claim_ids(e, "P131") + claim_ids(e, "P17"))
    protected = claim_ids(e, "P3018")  # located in protected area
    area_e = None
    if protected:
        area_e = wd_entities(protected[:1]).get(protected[0])
    elif chain and region_e is not None and chain[0] is not region_e and chain[0] is not country_e:
        area_e = chain[0]
    area_name = label(area_e) if area_e else reverse_area(co["latitude"], co["longitude"])
    country_code = (claim_vals(country_e, "P297")[0] if country_e else (country_hint or "XX")).upper()
    iso2 = claim_vals(region_e, "P300")[0] if region_e else None   # e.g. CA-AB
    region_code = iso2.split("-", 1)[1] if iso2 and "-" in iso2 else (region_hint or "unknown")
    elev = claim_vals(e, "P2044")
    img = claim_vals(e, "P18")
    return {
        "name": c.get("label") or name,
        "wikidata": c["id"],
        "description": c.get("description"),
        "lat": round(co["latitude"], 5), "lon": round(co["longitude"], 5),
        "kind": kind_from_p31(p31),
        "country": country_code, "country_name": label(country_e) if country_e else _country_name(country_code),
        "region": region_code, "region_name": label(region_e) if region_e else (region_hint or "Unknown"),
        "area_name": area_name,
        "elevation_m": int(float(elev[0]["amount"])) if elev else None,
        "image": f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(img[0])}" if img else None,
        "resolver": "wikidata",
    }


def resolve_nominatim(name: str, country_hint: str | None, region_hint: str | None) -> dict | None:
    region_q = region_hint if region_hint and len(region_hint) > 3 else None   # a code like "QC" hurts the query
    q = " ".join(x for x in [name, region_q, _country_name(country_hint) if country_hint else None] if x)
    params = {"q": q, "format": "jsonv2", "addressdetails": 1, "limit": 3}
    if country_hint:
        params["countrycodes"] = country_hint.lower()
    rows = _get(NOMINATIM, params, min_gap=1.1)
    if not rows:
        return None
    r = rows[0]
    a = r.get("address", {})
    cc = (a.get("country_code") or country_hint or "xx").upper()
    region_name = a.get("state") or a.get("province") or a.get("region") or region_hint or "Unknown"
    return {
        "name": name, "wikidata": None, "description": r.get("display_name"),
        "lat": round(float(r["lat"]), 5), "lon": round(float(r["lon"]), 5),
        "kind": _nominatim_kind(r.get("class"), r.get("type")),
        "country": cc, "country_name": a.get("country") or _country_name(cc),
        "region": _region_code_guess(cc, region_name), "region_name": region_name,
        "area_name": a.get("county") or a.get("municipality") or a.get("town") or a.get("village"),
        "elevation_m": None, "image": None, "resolver": "nominatim",
    }


def _nominatim_kind(cls, typ) -> str:
    t = (typ or "").lower()
    for k in ("waterfall", "lake", "island", "beach", "lighthouse", "museum", "canyon", "valley", "peak"):
        if k in t:
            return "mountain" if k == "peak" else k
    if cls in ("highway", "route") or t in ("footway", "path", "track"):
        return "trail"
    if t in ("national_park", "nature_reserve", "protected_area", "park"):
        return "park"
    if t in ("city",):
        return "city"
    if t in ("town", "village", "hamlet", "municipality"):
        return "town"
    if t in ("viewpoint",):
        return "viewpoint"
    return "place"


COUNTRY_NAMES = {"CA": "Canada", "US": "United States", "IT": "Italy", "FR": "France", "VN": "Vietnam",
                 "IN": "India", "AR": "Argentina", "CL": "Chile", "CH": "Switzerland", "NO": "Norway",
                 "IS": "Iceland", "PE": "Peru", "CR": "Costa Rica", "GB": "United Kingdom", "ES": "Spain",
                 "PT": "Portugal", "JP": "Japan", "NZ": "New Zealand", "AU": "Australia", "MX": "Mexico"}
REGION_CODES = {("CA", "quebec"): "QC", ("CA", "alberta"): "AB", ("CA", "british columbia"): "BC",
                ("CA", "ontario"): "ON", ("CA", "nova scotia"): "NS", ("US", "new york"): "NY",
                ("US", "vermont"): "VT", ("US", "new hampshire"): "NH", ("US", "colorado"): "CO",
                ("US", "arizona"): "AZ", ("US", "utah"): "UT", ("US", "wyoming"): "WY",
                ("US", "massachusetts"): "MA", ("US", "alaska"): "AK"}


def _country_name(code: str | None) -> str:
    return COUNTRY_NAMES.get((code or "").upper(), code or "Unknown")


def _region_code_guess(cc: str, region_name: str) -> str:
    return REGION_CODES.get((cc, region_name.lower()), slugify(region_name))



# ----------------------------------------------------------------------------- commands
def _source_rows(spec: dict, saved: str | None = None) -> list[dict]:
    """Normalise the source forms a spec may carry into rows without ids."""
    raw = list(spec.get("sources") or [])
    if not raw and (spec.get("source") or spec.get("screenshot") or spec.get("source_note")):
        raw = [{"type": spec.get("source_type") or "note", "url": spec.get("source"),
                "note": spec.get("source_note"), "screenshot": spec.get("screenshot")}]
    out = []
    for s in raw:
        note = s.get("note")
        out.append({"type": s.get("type") or "note", "url": s.get("url"), "note": note,
                    "screenshot": s.get("screenshot"),
                    "post_date": s.get("post_date") or parse_post_date(note),
                    "saved": s.get("saved") or saved or today()})
    return out


def build_place(spec: dict, pick: int | None = None, offline: bool = False) -> dict:
    """Resolve one spec into a bundle: place row (no area_id yet), geography names, raw tags, sources.

    spec keys: name, country, region, area, kind, tags, season, kid_fit, stats, notes, status, trip,
    lat, lon, unconfirmed, display_name, alias, source(s), source_type, source_note, screenshot.
    Given both lat and lon the network is skipped and the resolver is recorded as manual."""
    name = spec["name"].strip()
    lat_in, lon_in = spec.get("lat"), spec.get("lon")
    if (lat_in is None) != (lon_in is None):
        raise Fail("give both --lat and --lon")
    manual = lat_in is not None
    res = None
    if not offline and not manual:
        try:
            res = resolve_wikidata(name, spec.get("country"), spec.get("region_name") or spec.get("region"), pick,
                                   kind_hint=spec.get("kind"))
        except SystemExit:
            raise
        except Exception as ex:  # network or parse trouble: fall through to Nominatim
            print(f"  wikidata failed for {name}: {ex}", file=sys.stderr)
        if res is None:
            try:
                res = resolve_nominatim(name, spec.get("country"), spec.get("region_name") or spec.get("region"))
            except Exception as ex:
                print(f"  nominatim failed for {name}: {ex}", file=sys.stderr)
    if res is None:
        res = {"name": name, "wikidata": None, "description": None, "lat": None, "lon": None,
               "kind": spec.get("kind") or "place", "country": (spec.get("country") or "XX").upper(),
               "country_name": _country_name(spec.get("country")), "region": spec.get("region") or "unknown",
               "region_name": spec.get("region_name") or spec.get("region") or "Unknown",
               "area_name": spec.get("area"), "elevation_m": None, "image": None, "resolver": "none"}
    if manual:
        res = dict(res, lat=float(lat_in), lon=float(lon_in), resolver="manual")
    # explicit hints win over the resolver for the hierarchy; the resolver wins for coordinates
    country = (spec.get("country") or res["country"]).upper()
    region = spec.get("region") or res["region"]
    region_code = slugify(region).upper() if len(region) <= 3 else slugify(region)
    area_name = spec.get("area") or res.get("area_name") or res["region_name"]
    kind = spec.get("kind") or res["kind"]
    pid = make_id(country, region, area_name, spec.get("alias") or name)
    place = {
        "id": pid, "area_id": "/".join(pid.split("/")[:3]),
        "name": spec.get("display_name") or name, "resolved_name": res["name"], "kind": kind,
        "status": spec.get("status", "idea"), "trip": spec.get("trip"),
        "lat": res["lat"], "lon": res["lon"], "elevation_m": res.get("elevation_m"),
        "location_status": "unconfirmed" if spec.get("unconfirmed") else "resolved",
        "resolver": res["resolver"], "wikidata": res.get("wikidata"), "image": res.get("image"),
        "season_months": parse_months(spec.get("season")), "kid_fit": spec.get("kid_fit") or "unknown",
        "stats": spec.get("stats") or {}, "stats_verified": False,
        "notes": spec.get("notes", ""), "added": today(),
    }
    return {"place": place,
            "country": {"code": country, "name": spec.get("country_name") or res["country_name"]},
            "region": {"id": f"{country}/{region_code}", "code": region_code,
                       "name": spec.get("region_name") or res["region_name"]},
            "area": {"id": place["area_id"], "slug": slugify(area_name), "name": area_name},
            "tags": list(spec.get("tags") or []), "sources": _source_rows(spec)}


def ensure_geo(data: dict, country: dict, region: dict, area: dict) -> None:
    """Create any missing country, region and area rows. Existing rows keep their names."""
    if not any(c["code"] == country["code"] for c in data["countries"]):
        data["countries"].append({"code": country["code"], "a3": load_a3().get(country["code"]),
                                  "name": country["name"]})
    if not any(r["id"] == region["id"] for r in data["regions"]):
        data["regions"].append({"id": region["id"], "country": country["code"], "code": region["code"],
                                "name": region["name"], "iso_3166_2": region_iso(country["code"], region["code"])})
    if not any(a["id"] == area["id"] for a in data["areas"]):
        data["areas"].append({"id": area["id"], "region_id": region["id"], "slug": area["slug"], "name": area["name"]})


def add_sources(data: dict, rows: list[dict], *, place_id: str | None = None, collection_id: str | None = None) -> None:
    for s in rows:
        data["sources"].append({"id": next_id(data["sources"], "src", 5), "place_id": place_id,
                                "collection_id": collection_id, **s})


def insert_bundle(data: dict, b: dict) -> dict:
    """Add a built place and everything hanging off it. A colliding id gets -2, -3."""
    p = b["place"]
    ids = {x["id"] for x in data["places"]}
    pid, n = p["id"], 2
    while pid in ids:
        pid = f"{p['id']}-{n}"
        n += 1
    p["id"] = pid
    ensure_geo(data, b["country"], b["region"], b["area"])
    data["places"].append(p)
    for t in normalize_tags(data, b["tags"], p["kind"]):
        data["place_tags"].append({"place_id": pid, "tag_id": t})
    add_sources(data, b["sources"], place_id=pid)
    return p


def _chain(data: dict, p: dict) -> str:
    ix = V.Index(data)
    c, r, a = ix.geo(p)
    return f"{c.get('name')} > {r.get('name')} > {a.get('name')}"


def cmd_add(args) -> int:
    data = ensure_v2(load())
    spec = {
        "name": args.name, "country": args.country, "region": args.region, "area": args.area,
        "kind": args.kind, "tags": [t for t in (args.tags or "").split(",") if t],
        "season": [m for m in (args.season or "").split(",") if m] or None, "kid_fit": args.kid or "unknown",
        "stats": json.loads(args.stats) if args.stats else {}, "notes": args.note or "",
        "source": args.source, "source_type": args.source_type, "source_note": args.source_note,
        "screenshot": args.screenshot, "status": args.status, "trip": args.trip, "lat": args.lat, "lon": args.lon,
        "unconfirmed": args.unconfirmed, "display_name": args.display_name, "alias": args.alias,
    }
    b = build_place(spec, pick=args.pick, offline=args.offline)
    p = b["place"]
    dup = find_duplicate(data, p["id"], p["name"], p["lat"], p["lon"], b["region"]["id"])
    if dup and not args.force:
        print(f"DUPLICATE of {dup['id']} ({dup['name']}); use --force to add anyway, or edit that entry", file=sys.stderr)
        return 1
    p = insert_bundle(data, b)
    save(data)
    print(f"added {p['id']} | {p['kind']} | {p['lat']},{p['lon']} | {_chain(data, p)} | via {p['resolver']}")
    return 0


def cmd_import(args) -> int:
    """Batch file: {"places": [spec, ...], "collections": [...]}; spec as in build_place, plus optional "pick"."""
    data = ensure_v2(load())
    batch = json.loads(Path(args.file).read_text(encoding="utf-8"))
    added, skipped = [], []
    for spec in batch.get("places", []):
        try:
            b = build_place(spec, pick=spec.get("pick"), offline=args.offline)
        except SystemExit as ex:
            skipped.append((spec["name"], f"ambiguous (exit {ex.code})"))
            continue
        p = b["place"]
        dup = find_duplicate(data, p["id"], p["name"], p["lat"], p["lon"], b["region"]["id"])
        if dup and not spec.get("force"):
            skipped.append((spec["name"], f"duplicate of {dup['id']}"))
            continue
        p = insert_bundle(data, b)
        added.append(p)
        print(f"  + {p['id']} ({p['resolver']})")
    for col in batch.get("collections", []):
        col = dict(col)
        col["places"] = [resolve_stop(data, i) for i in col.get("places", [])]
        upsert_collection(data, col)
    save(data)
    print(f"imported {len(added)}, skipped {len(skipped)}")
    for n, why in skipped:
        print(f"  skipped {n}: {why}")
    return 0


def resolve_stop(data: dict, key: str) -> str:
    """A collection stop may be a full id or a name; map names through everything now in the store."""
    ids = {p["id"] for p in data["places"]}
    if key in ids:
        return key
    for p in data["places"]:
        for k in (p["name"], p.get("resolved_name"), p["id"].rsplit("/", 1)[1]):
            if k and slugify(k) == slugify(key):
                return p["id"]
    return key


def upsert_collection(data: dict, col: dict) -> None:
    cid = col.get("id") or col["slug"]
    added = col.get("added") or today()
    known = {p["id"] for p in data["places"]}
    stops = list(col.get("places", []))
    missing = [i for i in stops if i not in known]
    if missing:
        print(f"  collection {cid}: unknown place ids {missing}", file=sys.stderr)
    data["collections"] = [c for c in data["collections"] if c["id"] != cid]
    data["collection_places"] = [r for r in data["collection_places"] if r["collection_id"] != cid]
    data["sources"] = [s for s in data["sources"] if s.get("collection_id") != cid]
    data["collections"].append({"id": cid, "name": col["name"], "country": col.get("country"),
                                "notes": col.get("notes", ""), "added": added})
    for n, pid in enumerate(stops, 1):
        data["collection_places"].append({"collection_id": cid, "position": n, "place_id": pid})
    srcs = _source_rows({"sources": col.get("sources"), "source": col.get("source"),
                         "source_type": col.get("source_type"), "source_note": col.get("source_note"),
                         "screenshot": col.get("screenshot")}, saved=added)
    add_sources(data, srcs, collection_id=cid)


def cmd_collection(args) -> int:
    data = ensure_v2(load())
    stops = [resolve_stop(data, p.strip()) for p in args.places.split(",") if p.strip()]
    col = {"id": args.slug, "name": args.name, "country": args.country.upper() if args.country else None,
           "places": stops, "notes": args.note or "",
           "source": args.source, "source_type": args.source_type}
    upsert_collection(data, col)
    save(data)
    print(f"collection {args.slug} saved")
    return 0


def _clean_sources_type(url: str | None, given: str | None) -> str:
    if given:
        return given
    return "instagram" if url and "instagram.com" in url else "note"


def cmd_edit(args) -> int:
    data = ensure_v2(load())
    p = find_place(data, args.id)
    pid = p["id"]
    changed = []
    if args.name:
        p["name"] = args.name; changed.append("name")
    if args.kind:
        p["kind"] = args.kind; changed.append("kind")
    if args.status:
        if args.status == "visited" and not any(v["place_id"] == pid for v in data["visits"]):
            raise Fail("status visited needs a visit: use `visit add` instead")
        p["status"] = args.status; changed.append("status")
    if args.kid:
        p["kid_fit"] = args.kid; changed.append("kid_fit")
    if args.season is not None:
        p["season_months"] = parse_months([m for m in args.season.split(",") if m]); changed.append("season")
    if args.no_trip:
        p["trip"] = None; changed.append("trip")
    elif args.trip:
        p["trip"] = args.trip; changed.append("trip")
    if args.area:
        region_id = p["area_id"].rsplit("/", 1)[0]
        region = next((r for r in data["regions"] if r["id"] == region_id), None)
        if region is None:
            raise Fail(f"region {region_id} missing")
        area = {"id": f"{region_id}/{slugify(args.area)}", "slug": slugify(args.area), "name": args.area}
        ensure_geo(data, {"code": region["country"], "name": ""}, {"id": region_id, "code": region["code"], "name": region["name"]}, area)
        p["area_id"] = area["id"]; changed.append("area")
    if args.stats:
        p["stats"] = {**(p.get("stats") or {}), **json.loads(args.stats)}; changed.append("stats")
    if args.note is not None:
        p["notes"] = args.note; changed.append("notes")
    if args.note_append:
        p["notes"] = (p["notes"] + "\n" if p["notes"] else "") + args.note_append; changed.append("notes")
    if args.lat is not None or args.lon is not None:
        if args.lat is None or args.lon is None:
            raise Fail("give both --lat and --lon")
        p["lat"], p["lon"], p["resolver"] = float(args.lat), float(args.lon), "manual"
        if not args.unconfirmed:
            p["location_status"] = "resolved"
        changed.append("coordinates")
    if args.unconfirmed:
        p["location_status"] = "unconfirmed"; changed.append("location_status")
    if args.confirmed:
        p["location_status"] = "resolved"; changed.append("location_status")
    if args.tags_add:
        have = {r["tag_id"] for r in data["place_tags"] if r["place_id"] == pid}
        for t in normalize_tags(data, args.tags_add.split(","), p["kind"]):
            if t not in have:
                data["place_tags"].append({"place_id": pid, "tag_id": t})
        changed.append("tags")
    if args.tags_remove:
        drop = set(normalize_tags(data, args.tags_remove.split(","), None))
        data["place_tags"] = [r for r in data["place_tags"] if not (r["place_id"] == pid and r["tag_id"] in drop)]
        changed.append("tags")
    if args.source or args.screenshot or args.source_note:
        spec = {"source": args.source, "source_type": _clean_sources_type(args.source, args.source_type),
                "source_note": args.source_note, "screenshot": args.screenshot}
        add_sources(data, _source_rows(spec), place_id=pid)
        changed.append("sources")
    if not changed:
        raise Fail("nothing to change; see `edit --help`")
    save(data)
    print(f"edited {pid}: {', '.join(dict.fromkeys(changed))}")
    return 0


def cmd_visit(args) -> int:
    data = ensure_v2(load())
    p = find_place(data, args.id)
    if not valid_pdate(args.date) or (args.end and not valid_pdate(args.end)):
        raise Fail("dates are YYYY, YYYY-MM or YYYY-MM-DD")
    if args.end and _pdate_bounds(args.end)[1] < _pdate_bounds(args.date)[0]:
        raise Fail("--end is before --date")
    data["visits"].append({"id": next_id(data["visits"], "vis", 5), "place_id": p["id"], "date_start": args.date,
                           "date_end": args.end, "trip": args.trip or p.get("trip"), "notes": args.note or ""})
    p["status"] = "visited"
    save(data)
    print(f"visit {data['visits'][-1]['id']} recorded for {p['id']}; status visited")
    return 0


def cmd_tag(args) -> int:
    data = ensure_v2(load())
    if args.verb == "list":
        use = Counter(r["tag_id"] for r in data["place_tags"])
        for t in sorted(data["tags"], key=lambda t: t["id"]):
            alias = f" -> {t['alias_of']}" if t.get("alias_of") else ""
            print(f"{t['id']:<28} {use.get(t['id'], 0):>3}  {t['label']}{alias}")
        return 0
    if len(args.names) != 2:
        raise Fail("usage: tag alias ALIAS CANONICAL")
    alias, canon = slugify(args.names[0]), slugify(args.names[1])
    amap = {t["id"]: t.get("alias_of") for t in data["tags"]}
    while amap.get(canon):
        canon = amap[canon]
    if alias == canon:
        raise Fail("a tag cannot be its own alias")
    ensure_tag(data, canon)
    row = next((t for t in data["tags"] if t["id"] == alias), None)
    if row is None:
        row = {"id": alias, "label": default_label(alias), "alias_of": None}
        data["tags"].append(row)
    row["alias_of"] = canon
    for t in data["tags"]:            # tags that pointed at the new alias now point past it
        if t.get("alias_of") == alias:
            t["alias_of"] = canon
    seen, rows = set(), []
    for r in data["place_tags"]:
        tid = canon if r["tag_id"] == alias else r["tag_id"]
        if (r["place_id"], tid) not in seen:
            seen.add((r["place_id"], tid))
            rows.append({"place_id": r["place_id"], "tag_id": tid})
    data["place_tags"] = rows
    save(data)
    print(f"{alias} is now an alias of {canon}")
    return 0


# ----------------------------------------------------------------------------- validate
def _type_ok(v, t: str) -> bool:
    if t == "text":
        return isinstance(v, str)
    if t == "int":
        return isinstance(v, int) and not isinstance(v, bool)
    if t == "real":
        return isinstance(v, (int, float)) and not isinstance(v, bool)
    if t == "bool":
        return isinstance(v, bool)
    if t == "json":
        return isinstance(v, (list, dict))
    if t == "date":
        return valid_date(v)
    if t == "pdate":
        return valid_pdate(v)
    return False


def validate(data: dict, paths: Paths | None = None) -> list[str]:
    paths = paths or PATHS
    if data.get("schema_version") != SCHEMA_VERSION:
        return ["store is not schema v2 (v1 has `version`): run python3 tools/migrate_locations_v2.py"]
    errs: list[str] = []
    for k in data:
        if k not in ROOT_SCALARS and k not in TABLES:
            errs.append(f"unknown top-level key {k!r}")
    if not valid_date(data.get("updated")):
        errs.append("updated must be an ISO date")
    layout = data.get("layout")
    if layout not in LAYOUTS:
        errs.append(f"layout {layout!r} not in {LAYOUTS}")
    if layout == "by-country":
        parts = data.get("parts")
        if not isinstance(parts, list) or not all(isinstance(x, str) and re.fullmatch(r"[A-Z]{2}", x) for x in parts):
            errs.append("parts must be a list of ISO2 codes when layout is by-country")
    elif "parts" in data:
        errs.append("parts is only allowed when layout is by-country")

    rows: dict[str, list[dict]] = {}
    for t in TABLES:
        r = data.get(t, [])
        if not isinstance(r, list) or not all(isinstance(x, dict) for x in r):
            errs.append(f"{t}: must be an array of objects")
            r = []
        rows[t] = r
    # shape: unknown columns, types, nulls, primary keys
    for t, rs in rows.items():
        cols = {c[0]: c for c in COLUMNS[t]}
        seen = set()
        for r in rs:
            where = f"{t} {'/'.join(str(r.get(k)) for k in PK[t])}"
            for k in r:
                if k not in cols:
                    errs.append(f"{where}: unknown column {k!r}")
            for name, typ, nullable in COLUMNS[t]:
                v = r.get(name)
                if v is None:
                    if not nullable:
                        errs.append(f"{where}: {name} is required")
                elif not _type_ok(v, typ):
                    errs.append(f"{where}: {name} must be {typ}, got {v!r}")
            key = tuple(r.get(k) for k in PK[t])
            if key in seen:
                errs.append(f"{t}: duplicate key {'/'.join(str(x) for x in key)}")
            seen.add(key)

    ix = V.Index({t: rows[t] for t in TABLES})
    country_codes, region_ids, area_ids = set(ix.country), set(ix.region), set(ix.area)
    place_ids, tag_ids, coll_ids = set(ix.place), set(ix.tag), set(ix.collection)

    for r in rows["countries"]:
        if not re.fullmatch(r"[A-Z]{2}", str(r.get("code"))):
            errs.append(f"countries {r.get('code')}: code must be two upper-case letters")
    for r in rows["regions"]:
        w = f"regions {r.get('id')}"
        if r.get("country") not in country_codes:
            errs.append(f"{w}: country {r.get('country')!r} is not in countries")
        if r.get("id") != f"{r.get('country')}/{r.get('code')}":
            errs.append(f"{w}: id must be country/code")
        want = region_iso(str(r.get("country")), str(r.get("code")))
        if r.get("iso_3166_2") != want:
            errs.append(f"{w}: iso_3166_2 should be {want!r}")
    for r in rows["areas"]:
        w = f"areas {r.get('id')}"
        if r.get("region_id") not in region_ids:
            errs.append(f"{w}: region_id {r.get('region_id')!r} is not in regions")
        if not re.fullmatch(r"[a-z0-9-]+", str(r.get("slug"))):
            errs.append(f"{w}: slug must match [a-z0-9-]+")
        if r.get("id") != f"{r.get('region_id')}/{r.get('slug')}":
            errs.append(f"{w}: id must be region_id/slug")
    for r in rows["places"]:
        w = f"places {r.get('id')}"
        if not PLACE_ID_RE.match(str(r.get("id"))):
            errs.append(f"{w}: id does not match {PLACE_ID_RE.pattern}")
        if r.get("area_id") not in area_ids:
            errs.append(f"{w}: area_id {r.get('area_id')!r} is not in areas")
        if r.get("kind") not in KINDS:
            errs.append(f"{w}: kind {r.get('kind')!r} not in {KINDS}")
        if r.get("status") not in STATUSES:
            errs.append(f"{w}: status {r.get('status')!r} not in {STATUSES}")
        if r.get("kid_fit") not in KID_FIT:
            errs.append(f"{w}: kid_fit {r.get('kid_fit')!r} not in {KID_FIT}")
        if r.get("location_status") not in LOCATION_STATUS:
            errs.append(f"{w}: location_status {r.get('location_status')!r} not in {LOCATION_STATUS}")
        if r.get("resolver") not in RESOLVERS:
            errs.append(f"{w}: resolver {r.get('resolver')!r} not in {RESOLVERS}")
        lat, lon = r.get("lat"), r.get("lon")
        if (lat is None) != (lon is None):
            errs.append(f"{w}: lat and lon must both be set or both empty")
        if isinstance(lat, (int, float)) and not -90 <= lat <= 90:
            errs.append(f"{w}: lat out of range")
        if isinstance(lon, (int, float)) and not -180 <= lon <= 180:
            errs.append(f"{w}: lon out of range")
        if lat is None and r.get("kind") != "region" and r.get("location_status") != "unconfirmed":
            errs.append(f"{w}: no coordinates (resolver failed); add --lat/--lon, re-resolve, or mark it unconfirmed")
        if r.get("wikidata") is not None and not re.fullmatch(r"Q\d+", str(r["wikidata"])):
            errs.append(f"{w}: wikidata must look like Q123")
        if r.get("image") is not None and not str(r["image"]).startswith("https://"):
            errs.append(f"{w}: image must be an https URL")
        sm = r.get("season_months")
        if isinstance(sm, list):
            if not all(isinstance(m, int) and not isinstance(m, bool) and 1 <= m <= 12 for m in sm) \
                    or sm != sorted(set(sm)):
                errs.append(f"{w}: season_months must be distinct sorted ints 1-12")
        elif sm is not None:
            errs.append(f"{w}: season_months must be an array")
        st = r.get("stats")
        if isinstance(st, dict):
            if not all(isinstance(v, (str, int, float)) and not isinstance(v, bool) for v in st.values()):
                errs.append(f"{w}: stats values must be numbers or strings")
        elif st is not None:
            errs.append(f"{w}: stats must be an object")
        trip = r.get("trip")
        if trip and not (paths.trips_root / trip).is_dir():
            errs.append(f"{w}: trip folder {trip!r} does not exist")
        if r.get("status") == "visited" and not ix.visits_of.get(r.get("id")):
            errs.append(f"{w}: status visited needs at least one visit")
    for r in rows["tags"]:
        w = f"tags {r.get('id')}"
        if not re.fullmatch(r"[a-z0-9-]+", str(r.get("id"))):
            errs.append(f"{w}: id must be a slug")
        a = r.get("alias_of")
        if a is not None:
            if a not in tag_ids:
                errs.append(f"{w}: alias_of {a!r} is not in tags")
            elif a == r.get("id"):
                errs.append(f"{w}: a tag cannot alias itself")
            elif ix.tag[a].get("alias_of"):
                errs.append(f"{w}: alias_of {a!r} is itself an alias")
    for r in rows["place_tags"]:
        w = f"place_tags {r.get('place_id')}/{r.get('tag_id')}"
        if r.get("place_id") not in place_ids:
            errs.append(f"{w}: place_id is not in places")
        if r.get("tag_id") not in tag_ids:
            errs.append(f"{w}: tag_id is not in tags")
        elif ix.tag[r["tag_id"]].get("alias_of"):
            errs.append(f"{w}: tag_id is an alias; point at the canonical tag")
    for r in rows["sources"]:
        w = f"sources {r.get('id')}"
        if not re.fullmatch(r"src-\d{5}", str(r.get("id"))):
            errs.append(f"{w}: id must look like src-00001")
        owners = [k for k in ("place_id", "collection_id") if r.get(k)]
        if len(owners) != 1:
            errs.append(f"{w}: exactly one of place_id or collection_id must be set")
        if r.get("place_id") and r["place_id"] not in place_ids:
            errs.append(f"{w}: place_id is not in places")
        if r.get("collection_id") and r["collection_id"] not in coll_ids:
            errs.append(f"{w}: collection_id is not in collections")
        if r.get("type") not in SOURCE_TYPES:
            errs.append(f"{w}: type {r.get('type')!r} not in {SOURCE_TYPES}")
        if r.get("url") is not None and not str(r["url"]).startswith(("http://", "https://")):
            errs.append(f"{w}: url must be http(s)")
        if r.get("screenshot") is not None and not str(r["screenshot"]).startswith("locations/inbox/"):
            errs.append(f"{w}: screenshot must be a path under locations/inbox/")
    for r in rows["visits"]:
        w = f"visits {r.get('id')}"
        if not re.fullmatch(r"vis-\d{5}", str(r.get("id"))):
            errs.append(f"{w}: id must look like vis-00001")
        if r.get("place_id") not in place_ids:
            errs.append(f"{w}: place_id is not in places")
        s, e = r.get("date_start"), r.get("date_end")
        if valid_pdate(s) and e is not None and valid_pdate(e) and _pdate_bounds(e)[1] < _pdate_bounds(s)[0]:
            errs.append(f"{w}: date_end is before date_start")
        if r.get("trip") and not (paths.trips_root / r["trip"]).is_dir():
            errs.append(f"{w}: trip folder {r['trip']!r} does not exist")
    for r in rows["collections"]:
        w = f"collections {r.get('id')}"
        if r.get("country") is not None and r["country"] not in country_codes:
            errs.append(f"{w}: country {r['country']!r} is not in countries")
        if not ix.stops_of.get(r.get("id")):
            errs.append(f"{w}: no places")
    pos: dict[str, list[int]] = {}
    for r in rows["collection_places"]:
        w = f"collection_places {r.get('collection_id')}#{r.get('position')}"
        if r.get("collection_id") not in coll_ids:
            errs.append(f"{w}: collection_id is not in collections")
        if r.get("place_id") not in place_ids:
            errs.append(f"{w}: unknown place {r.get('place_id')}")
        if isinstance(r.get("position"), int):
            pos.setdefault(str(r.get("collection_id")), []).append(r["position"])
    for cid, ps in pos.items():
        if sorted(ps) != list(range(1, len(ps) + 1)):
            errs.append(f"collection_places {cid}: positions must be contiguous from 1")
    return errs


def warnings(data: dict) -> list[str]:
    out = []
    if data.get("layout") == "single" and len(data.get("places", [])) > 300:
        out.append("layout is single with more than 300 places; consider `layout split`")
    return out


def cmd_validate(args) -> int:
    data = load()
    errs = validate(data)
    for e in errs:
        print("ERROR " + e)
    for w in warnings(data):
        print("WARN " + w)
    print("ok" if not errs else f"{len(errs)} problem(s)")
    return 1 if errs else 0


# ----------------------------------------------------------------------------- build / list
def cmd_build(args) -> int:
    data = ensure_v2(load())
    if args.check:
        bad = V.stale(data, PATHS)
        for p in bad:
            print(f"stale: {p.relative_to(PATHS.root)}")
        print("up to date" if not bad else f"{len(bad)} generated file(s) differ; run `locations.py build`")
        return 1 if bad else 0
    written = V.write_all(data, PATHS)
    for p in written:
        print(f"wrote {p.relative_to(PATHS.root)}")
    if not written:
        print("up to date")
    if PATHS.template.is_file() and PATHS.list_page not in V.render_all(data, PATHS):
        print("note: list page skipped; the template does not read locations-view/1 yet", file=sys.stderr)
    return 0


def cmd_layout(args) -> int:
    data = ensure_v2(load())
    target = "by-country" if args.mode == "split" else "single"
    if data.get("layout") == target:
        print(f"layout is already {target}")
        return 0
    data["layout"] = target
    if target == "single":
        data.pop("parts", None)
    save(data, touch=False)          # a layout change is not a content change
    msg = f"split into {len(data['parts'])} part(s): {', '.join(data['parts'])}" if target == "by-country" \
        else "merged back into locations.json"
    print(msg)
    return 0


def cmd_list(args) -> int:
    data = ensure_v2(load())
    ix = V.Index(data)
    q = (args.q or "").lower()
    tag = slugify(args.tag) if args.tag else None
    if tag:
        tag = ix.tag.get(tag, {}).get("alias_of") or tag
    for p in sorted(data["places"], key=lambda p: p["id"]):
        country, region, area = ix.geo(p)
        if args.country and country.get("code") != args.country.upper():
            continue
        if args.status and p["status"] != args.status:
            continue
        if tag and tag not in ix.tags_of.get(p["id"], []):
            continue
        hay = " ".join([p["id"], p["name"], area.get("name", ""), region.get("name", ""), p.get("notes", ""),
                        " ".join(ix.tags_of.get(p["id"], []))]).lower()
        if q and q not in hay:
            continue
        print(f"{p['id']:<60} {p['kind']:<10} {p['status']:<11} {p['lat']},{p['lon']}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("add"); a.add_argument("name")
    a.add_argument("--country"); a.add_argument("--region"); a.add_argument("--area"); a.add_argument("--kind", choices=KINDS)
    a.add_argument("--tags"); a.add_argument("--season", help="comma months, e.g. Sep,Oct"); a.add_argument("--kid", choices=KID_FIT)
    a.add_argument("--stats", help='json, e.g. {"km": 9.5, "gain_m": 543}'); a.add_argument("--note")
    a.add_argument("--source"); a.add_argument("--source-type", default="instagram", choices=SOURCE_TYPES)
    a.add_argument("--source-note"); a.add_argument("--screenshot", help="path under locations/inbox/")
    a.add_argument("--status", default="idea", choices=STATUSES)
    a.add_argument("--lat", type=float); a.add_argument("--lon", type=float, help="with --lat: skip the resolvers, resolver manual")
    a.add_argument("--trip"); a.add_argument("--unconfirmed", action="store_true")
    a.add_argument("--display-name"); a.add_argument("--alias", help="name used for the id slug")
    a.add_argument("--pick", type=int); a.add_argument("--force", action="store_true"); a.add_argument("--offline", action="store_true")
    a.set_defaults(fn=cmd_add)

    i = sub.add_parser("import"); i.add_argument("file"); i.add_argument("--offline", action="store_true"); i.set_defaults(fn=cmd_import)

    c = sub.add_parser("collection"); c.add_argument("verb", choices=["add"]); c.add_argument("--slug", required=True)
    c.add_argument("--name", required=True); c.add_argument("--country"); c.add_argument("--places", required=True, help="ids or names")
    c.add_argument("--note"); c.add_argument("--source"); c.add_argument("--source-type", default="instagram", choices=SOURCE_TYPES)
    c.set_defaults(fn=cmd_collection)

    e = sub.add_parser("edit"); e.add_argument("id", help="place id, or a unique name or id tail")
    e.add_argument("--name"); e.add_argument("--kind", choices=KINDS); e.add_argument("--status", choices=STATUSES)
    e.add_argument("--kid", choices=KID_FIT); e.add_argument("--season", help="replaces the months; empty string clears")
    e.add_argument("--trip", metavar="SLUG"); e.add_argument("--no-trip", action="store_true")
    e.add_argument("--area", metavar="NAME", help="move to another area of the same region")
    e.add_argument("--tags-add"); e.add_argument("--tags-remove")
    e.add_argument("--note", help="replace the notes"); e.add_argument("--note-append", help="add a paragraph to the notes")
    e.add_argument("--stats", help="json merged into the existing stats")
    e.add_argument("--lat", type=float); e.add_argument("--lon", type=float)
    g = e.add_mutually_exclusive_group(); g.add_argument("--unconfirmed", action="store_true"); g.add_argument("--confirmed", action="store_true")
    e.add_argument("--source"); e.add_argument("--source-type", choices=SOURCE_TYPES)
    e.add_argument("--source-note"); e.add_argument("--screenshot", help="path under locations/inbox/")
    e.set_defaults(fn=cmd_edit)

    v = sub.add_parser("visit"); v.add_argument("verb", choices=["add"]); v.add_argument("id")
    v.add_argument("--date", required=True, help="YYYY, YYYY-MM or YYYY-MM-DD"); v.add_argument("--end")
    v.add_argument("--trip"); v.add_argument("--note"); v.set_defaults(fn=cmd_visit)

    t = sub.add_parser("tag"); t.add_argument("verb", choices=["alias", "list"]); t.add_argument("names", nargs="*")
    t.set_defaults(fn=cmd_tag)

    ly = sub.add_parser("layout", help="convert the store between one file and one file per country")
    ly.add_argument("mode", choices=["split", "single"]); ly.set_defaults(fn=cmd_layout)

    sub.add_parser("validate").set_defaults(fn=cmd_validate)
    b = sub.add_parser("build"); b.add_argument("--check", action="store_true"); b.set_defaults(fn=cmd_build)
    r = sub.add_parser("render", help="alias of build"); r.add_argument("--check", action="store_true"); r.set_defaults(fn=cmd_build)
    l = sub.add_parser("list"); l.add_argument("--country"); l.add_argument("--q"); l.add_argument("--status", choices=STATUSES)
    l.add_argument("--tag"); l.set_defaults(fn=cmd_list)

    args = ap.parse_args(argv)
    try:
        return args.fn(args)
    except Fail as ex:
        print(f"error: {ex}", file=sys.stderr)
        return ex.code


if __name__ == "__main__":
    sys.exit(main())
