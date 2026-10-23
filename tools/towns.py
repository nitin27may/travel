#!/usr/bin/env python3
"""The towns layer: data/reference/towns/** written ONLY from the public GeoNames dump, verbatim (META-2; store.ts A33).

    python3 tools/towns.py build             # download if not cached, derive, write data/reference/towns/**
    python3 tools/towns.py build --refresh   # download again (a newer dump)
    python3 tools/towns.py --check           # re-derive from the CACHED download and fail on any difference (no network)

Why this file is the trust root. The site serves every town exactly as the public gazetteer holds it (nothing moved, dropped or
flagged), and its privacy check accepts a town's point only when it equals the point the towns file holds. So the file must be
GeoNames' own numbers. Rules that keep it so:

  * Every row comes from `cities1000.txt` inside the downloaded zip: name, ASCII name, latitude, longitude and population are copied
    as the dump has them. Nothing is edited, added or rounded; a row the dump does not hold cannot appear.
  * The filter is mechanical and the same for every country and every town; no town name, id or coordinate is written in this
    file or in any file it reads: feature class P, not a section/historical/abandoned/destroyed code, population of at least
    POPULATION_MIN, and EITHER within ANCHOR_RADIUS of an anchor (a public point of the catalogue, rounded; anchors.json) OR a large
    city (population of at least HUB_POPULATION_MIN) in a country that holds an anchor-radius town.
  * The manifest records the source URLs, the download date, the licence (GeoNames, CC BY 4.0) and the SHA-256 of each downloaded
    file, the filter, the anchors file's hash, and each part's size and SHA-256.
  * `--check` re-derives everything from the cached download and the committed anchors and fails on any byte of difference. With
    no cached download it still verifies every part against the manifest (and says it could not check the source).

The only external calls are two GeoNames files, fetched sequentially under a mkdir lock (macOS has no flock), cached under
tools/.cache/geonames (gitignored), with the project's user agent. No Google, no scraping.

Town ids are `<cc>-<admin1>-<slug>` (nearby spec 3.1, owner Q76): `<admin1>` is the lower-case ISO 3166-2 subdivision suffix mapped
from the GeoNames admin1 code by tools/towns_admin1.json (each entry carries the GeoNames name it must match, so a wrong code fails
the build), `00` when that table has no entry for the country. The slug is the ASCII name in kebab case; when two towns of one
country and admin1 share a slug, the lower GeoNames id keeps it and the others take `-<geonames id>`.

Row: [id, name, lat, lon, population, admin1, ascii name, geonames id].
"""
from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import gzip
import hashlib
import io
import json
import re
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from geo import haversine_km  # noqa: E402
from locations import UA  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "tools" / ".cache" / "geonames"
OUT = ROOT / "data" / "reference" / "towns"
ADMIN1_TABLE = Path(__file__).with_name("towns_admin1.json")
LOCK = Path("/tmp/travel-geonames.lock.d")

DUMP = "https://download.geonames.org/export/dump/"
FILES = {"cities1000.zip": DUMP + "cities1000.zip", "admin1CodesASCII.txt": DUMP + "admin1CodesASCII.txt"}
LICENCE = {"name": "Creative Commons Attribution 4.0", "id": "CC BY 4.0", "url": "https://creativecommons.org/licenses/by/4.0/", "attribution": "Contains data from GeoNames, CC BY 4.0", "source_url": "https://www.geonames.org/"}

# ---- the filter: the same for every country and every town -------------------------------------------------------------------------
FEATURE_CLASS = "P"
# section of a populated place, historical, abandoned, destroyed, historical capital: not places a visitor can be near today
EXCLUDED_FEATURE_CODES = ("PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH")
POPULATION_MIN = 1000  # near_town counts settlements of at least this many people (capture contract 3.7)
ANCHOR_RADIUS = 100  # a town within this distance of an anchor is kept, so a point near a border still finds the town across it
HUB_POPULATION_MIN = 100_000  # large cities are kept in every country that holds an anchor-radius town (short-trip hubs, nearby spec Q55)
ANCHOR_DECIMALS = 2  # anchors are public points rounded to about a kilometre
GZIP_BUDGET = 20_000  # bytes per part, gzip level 9 (nearby spec 5.6)

ANCHOR_SOURCES = (
    ("data/capture/points.json", "points"),
    ("data/relevance/inputs/points.json", "points"),
    ("data/relevance/inputs/points.json", "towns"),
    ("data/trips/base-points.json", "records"),
)


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def gz(b: bytes) -> int:
    return len(gzip.compress(b, 9, mtime=0))


# ---- download (the only network use) ------------------------------------------------------------------------------------------------
@contextlib.contextmanager
def lock(wait_s: int = 300):
    t0 = time.time()
    while True:
        try:
            LOCK.mkdir()
            break
        except FileExistsError:
            if time.time() - t0 > wait_s:
                raise SystemExit(f"{LOCK} is held; another external download is running. Wait or remove it if it is stale.")
            time.sleep(2)
    try:
        yield
    finally:
        with contextlib.suppress(OSError):
            LOCK.rmdir()


def fetch(refresh: bool) -> dict[str, dict]:
    """Downloads the dump files that are not cached (all of them with refresh); returns their meta (url, date, sha256, bytes)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    meta_path = CACHE / "meta.json"
    meta: dict[str, dict] = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    todo = [n for n in FILES if refresh or n not in meta or not (CACHE / n).exists()]
    if todo:
        with lock():
            for i, name in enumerate(todo):
                if i:
                    time.sleep(2)
                req = urllib.request.Request(FILES[name], headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=120) as r:
                    body = r.read()
                    last_modified = r.headers.get("Last-Modified")
                (CACHE / name).write_bytes(body)
                meta[name] = {"url": FILES[name], "downloaded": dt.date.today().isoformat(), "last_modified": last_modified, "bytes": len(body), "sha256": sha256(body)}
                print(f"downloaded {name}: {len(body)} bytes, sha256 {meta[name]['sha256']}")
        meta_path.write_text(json.dumps(meta, indent=1, sort_keys=True) + "\n")
    for name, m in meta.items():
        if name in FILES and sha256((CACHE / name).read_bytes()) != m["sha256"]:
            raise SystemExit(f"{CACHE / name} does not match the SHA-256 recorded when it was downloaded; delete tools/.cache/geonames and build --refresh")
    return {n: meta[n] for n in FILES}


def cached_meta() -> dict[str, dict] | None:
    """The cache's meta when every file is present and matches its hash, else None (no network)."""
    meta_path = CACHE / "meta.json"
    if not meta_path.exists():
        return None
    meta = json.loads(meta_path.read_text())
    for name in FILES:
        p = CACHE / name
        if name not in meta or not p.exists() or sha256(p.read_bytes()) != meta[name]["sha256"]:
            return None
    return {n: meta[n] for n in FILES}


# ---- the dump ---------------------------------------------------------------------------------------------------------------------
def read_cities() -> list[list[str]]:
    with zipfile.ZipFile(CACHE / "cities1000.zip") as z:
        text = z.read("cities1000.txt").decode("utf-8")
    return [line.split("\t") for line in text.split("\n") if line]


def read_admin1() -> dict[str, str]:
    out: dict[str, str] = {}
    for line in (CACHE / "admin1CodesASCII.txt").read_text(encoding="utf-8").split("\n"):
        if line:
            code, name, _ascii, _gid = line.split("\t")[:4]
            out[code] = name
    return out


def load_iso_table() -> dict:
    return json.loads(ADMIN1_TABLE.read_text())["countries"]


# ---- anchors ------------------------------------------------------------------------------------------------------------------
def points_from(path: str, key: str) -> list[tuple[float, float]]:
    f = ROOT / path
    if not f.exists():
        return []
    doc = json.loads(f.read_text())
    block = doc.get(key, {})
    items = block.values() if isinstance(block, dict) else block
    out = []
    for it in items:
        p = it.get("point", it) if isinstance(it, dict) else None
        if isinstance(p, dict) and isinstance(p.get("lat"), (int, float)) and isinstance(p.get("lon"), (int, float)):
            out.append((float(p["lat"]), float(p["lon"])))
    return out


def derive_anchors() -> list[list[float]]:
    pts = {(round(la, ANCHOR_DECIMALS), round(lo, ANCHOR_DECIMALS)) for path, key in ANCHOR_SOURCES for la, lo in points_from(path, key)}
    return [[la, lo] for la, lo in sorted(pts)]


def anchors_text(anchors: list[list[float]]) -> str:
    return "[\n" + ",\n".join(json.dumps(a) for a in anchors) + "\n]\n"


# ---- the filter and the ids ---------------------------------------------------------------------------------------------------
def kebab(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def eligible(r: list[str]) -> bool:
    return r[6] == FEATURE_CLASS and r[7] not in EXCLUDED_FEATURE_CODES and int(r[14] or 0) >= POPULATION_MIN


class Grid:
    """Anchors bucketed by whole degree of latitude, so the radius test touches a handful of anchors per town."""

    def __init__(self, anchors: list[list[float]]):
        self.by_lat: dict[int, list[list[float]]] = {}
        for a in anchors:
            self.by_lat.setdefault(int(a[0] // 1), []).append(a)
        self.reach = int(ANCHOR_RADIUS / 100) + 2  # degrees of latitude: 111 km each, so +2 is a safe margin for the radius

    def near(self, lat: float, lon: float) -> bool:
        base = int(lat // 1)
        for b in range(base - self.reach, base + self.reach + 1):
            for a in self.by_lat.get(b, ()):
                if haversine_km(lat, lon, a[0], a[1]) <= ANCHOR_RADIUS:
                    return True
        return False

    def within(self, lat: float, lon: float, km: float) -> bool:
        base = int(lat // 1)
        reach = int(km / 100) + 2
        return any(haversine_km(lat, lon, a[0], a[1]) <= km for b in range(base - reach, base + reach + 1) for a in self.by_lat.get(b, ()))


def select(cities: list[list[str]], anchors: list[list[float]]) -> list[list[str]]:
    grid = Grid(anchors)
    ok = [r for r in cities if eligible(r)]
    in_radius = {r[0] for r in ok if grid.near(float(r[4]), float(r[5]))}
    countries = {r[8] for r in ok if r[0] in in_radius}
    return [r for r in ok if r[0] in in_radius or (r[8] in countries and int(r[14]) >= HUB_POPULATION_MIN)]


def admin1_iso(cc: str, code: str, names: dict[str, str], table: dict) -> tuple[str, str | None]:
    """(ISO 3166-2 suffix, GeoNames admin1 name). Raises when a tabled country has a code the table does not know or names differently."""
    name = names.get(f"{cc}.{code}")
    t = table.get(cc)
    if t is None:
        return "00", name
    if t == "identity":  # GeoNames already uses the ISO 3166-2 suffix (the US states, the Swiss cantons)
        return code.lower(), name
    entry = t.get(code)
    if entry is None:
        raise SystemExit(f"tools/towns_admin1.json has no entry for {cc}.{code} ({name!r}); add [iso, geonames name] for it")
    if entry[1] != name:
        raise SystemExit(f"tools/towns_admin1.json says {cc}.{code} is {entry[1]!r} but GeoNames calls it {name!r}; the mapping is wrong")
    return entry[0].lower(), name


def build_rows(selected: list[list[str]], names: dict[str, str], table: dict) -> dict[tuple[str, str], dict]:
    """{(cc, iso admin1): {"name": admin1 name, "rows": [...]}} with ids assigned; rows sorted by id."""
    per: dict[tuple[str, str], list[list[str]]] = {}
    iso_name: dict[tuple[str, str], str | None] = {}
    for r in selected:
        cc = r[8].lower()
        iso, nm = admin1_iso(r[8], r[10], names, table)
        per.setdefault((cc, iso), []).append(r)
        iso_name.setdefault((cc, iso), nm)
    out: dict[tuple[str, str], dict] = {}
    for (cc, iso), rs in sorted(per.items()):
        rs.sort(key=lambda r: int(r[0]))
        seen: dict[str, int] = {}
        rows = []
        for r in rs:
            slug = kebab(r[2]) or r[0]
            seen[slug] = seen.get(slug, 0) + 1
            if seen[slug] > 1:
                slug = f"{slug}-{r[0]}"
            rows.append([f"{cc}-{iso}-{slug}", r[1], float(r[4]), float(r[5]), int(r[14]), iso, r[2], int(r[0])])
        rows.sort(key=lambda x: x[0])
        out[(cc, iso)] = {"name": iso_name[(cc, iso)], "rows": rows}
    return out


# ---- parts -------------------------------------------------------------------------------------------------------------------------
def dumps_part(cc: str, admin1s: dict[str, str | None], rows: list[list]) -> bytes:
    head = json.dumps({"schema": "towns-part/1", "cc": cc, "admin1": admin1s}, ensure_ascii=False, separators=(",", ":"))
    body = ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows)
    return (head[:-1] + ',"rows":[\n' + body + "\n]}\n").encode("utf-8")


def make_parts(groups: dict[tuple[str, str], dict]) -> dict[str, bytes]:
    """One part per country; a country over the gzip budget is split per admin1. A single admin1 over the budget fails the build."""
    by_cc: dict[str, dict[str, dict]] = {}
    for (cc, iso), g in groups.items():
        by_cc.setdefault(cc, {})[iso] = g
    parts: dict[str, bytes] = {}
    for cc, regions in sorted(by_cc.items()):
        rows = sorted((r for g in regions.values() for r in g["rows"]), key=lambda r: r[0])
        whole = dumps_part(cc, {iso: g["name"] for iso, g in sorted(regions.items())}, rows)
        if gz(whole) <= GZIP_BUDGET:
            parts[f"{cc}.json"] = whole
            continue
        for iso, g in sorted(regions.items()):
            b = dumps_part(cc, {iso: g["name"]}, g["rows"])
            if gz(b) > GZIP_BUDGET:
                raise SystemExit(f"{cc}-{iso} is {gz(b)} bytes gzip, over the {GZIP_BUDGET} budget; the filter or the split must change")
            parts[f"{cc}-{iso}.json"] = b
    return parts


def derive(cities: list[list[str]], names: dict[str, str], anchors: list[list[float]]) -> tuple[dict[str, bytes], list[list[str]]]:
    selected = select(cities, anchors)
    groups = build_rows(selected, names, load_iso_table())
    return make_parts(groups), selected


def manifest_of(meta: dict[str, dict], anchors_bytes: bytes, parts: dict[str, bytes]) -> dict:
    infos = []
    for name, b in sorted(parts.items()):
        doc = json.loads(b)
        infos.append({"file": name, "cc": doc["cc"], "admin1": sorted(doc["admin1"]), "rows": len(doc["rows"]), "bytes": len(b), "gzip": gz(b), "sha256": sha256(b)})
    downloaded = max(m["downloaded"] for m in meta.values())
    return {
        "schema": "towns-manifest/1",
        "source": {
            "name": "GeoNames",
            "dump": "cities1000 (populated places of at least 1,000 people, and seats of administrative divisions) and admin1CodesASCII",
            "downloaded": downloaded,
            "licence": LICENCE,
            "files": {n: {"url": m["url"], "last_modified": m["last_modified"], "bytes": m["bytes"], "sha256": m["sha256"]} for n, m in sorted(meta.items())},
        },
        "filter": {
            "rule": "Rows of cities1000.txt copied verbatim (name, ascii name, latitude, longitude, population). Kept when feature class is P, the feature code is not excluded, "
            "population is at least population_min, and the town is within radius_km of an anchor, or has at least hub_population_min people in a country that holds a town within radius_km of an anchor. "
            "The same rule for every country; no town is named, moved, added or dropped by hand.",
            "feature_class": FEATURE_CLASS,
            "excluded_feature_codes": list(EXCLUDED_FEATURE_CODES),
            "population_min": POPULATION_MIN,
            "radius_km": ANCHOR_RADIUS,
            "hub_population_min": HUB_POPULATION_MIN,
            "anchors": {"file": "anchors.json", "count": len(json.loads(anchors_bytes)), "decimals": ANCHOR_DECIMALS, "sha256": sha256(anchors_bytes), "from": [f"{p}#{k}" for p, k in ANCHOR_SOURCES]},
            "admin1_table": {"file": "tools/towns_admin1.json", "sha256": sha256(ADMIN1_TABLE.read_bytes())},
            "gzip_budget": GZIP_BUDGET,
        },
        "row": ["id", "name", "lat", "lon", "population", "admin1", "ascii", "geonames_id"],
        "totals": {"parts": len(infos), "rows": sum(i["rows"] for i in infos), "bytes": sum(i["bytes"] for i in infos), "gzip": sum(i["gzip"] for i in infos)},
        "parts": infos,
    }


def manifest_text(m: dict) -> str:
    return json.dumps(m, indent=1, ensure_ascii=False) + "\n"


# ---- commands --------------------------------------------------------------------------------------------------------------------
def expected(meta: dict[str, dict], anchors: list[list[float]]) -> dict[str, bytes]:
    """Every file data/reference/towns/ must hold, by name, derived from the cached download."""
    cities, names = read_cities(), read_admin1()
    parts, _ = derive(cities, names, anchors)
    ab = anchors_text(anchors).encode()
    files = dict(parts)
    files["anchors.json"] = ab
    files["manifest.json"] = manifest_text(manifest_of(meta, ab, parts)).encode()
    return files


def cmd_build(refresh: bool) -> int:
    meta = fetch(refresh)
    files = expected(meta, derive_anchors())
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.json"):
        if old.name not in files:
            old.unlink()
    for name, b in files.items():
        (OUT / name).write_bytes(b)
    m = json.loads(files["manifest.json"])
    print(f"wrote {m['totals']['parts']} parts, {m['totals']['rows']} towns, {m['totals']['bytes']} bytes ({m['totals']['gzip']} gzip) to {OUT.relative_to(ROOT)}")
    return 0


def verify_against_manifest() -> list[str]:
    """The checks that need no download: every part is the file the manifest describes."""
    problems: list[str] = []
    mp = OUT / "manifest.json"
    if not mp.exists():
        return [f"{mp.relative_to(ROOT)} is missing; run: python3 tools/towns.py build"]
    m = json.loads(mp.read_text())
    listed = {p["file"] for p in m["parts"]} | {"anchors.json", "manifest.json"}
    for f in sorted(OUT.glob("*.json")):
        if f.name not in listed:
            problems.append(f"{f.name} is in data/reference/towns but not in the manifest")
    for p in m["parts"]:
        f = OUT / p["file"]
        if not f.exists():
            problems.append(f"{p['file']} is in the manifest but missing")
            continue
        b = f.read_bytes()
        if sha256(b) != p["sha256"]:
            problems.append(f"{p['file']} differs from the manifest (SHA-256): the towns files are written only by tools/towns.py from the GeoNames dump")
        if gz(b) > GZIP_BUDGET:
            problems.append(f"{p['file']} is {gz(b)} bytes gzip, over the {GZIP_BUDGET} budget")
    ap = OUT / "anchors.json"
    if not ap.exists() or sha256(ap.read_bytes()) != m["filter"]["anchors"]["sha256"]:
        problems.append("anchors.json differs from the manifest (SHA-256)")
    if sha256(ADMIN1_TABLE.read_bytes()) != m["filter"]["admin1_table"]["sha256"]:
        problems.append("tools/towns_admin1.json changed since the towns were built; run: python3 tools/towns.py build")
    return problems


def cmd_check() -> int:
    problems = verify_against_manifest()
    meta = cached_meta()
    if meta is None:
        print("note: the GeoNames download is not cached (tools/.cache/geonames), so the source could not be re-derived; the manifest check above is all this machine can do")
    elif not problems:
        anchors = json.loads((OUT / "anchors.json").read_text())
        want = expected(meta, anchors)
        have = {f.name: f.read_bytes() for f in OUT.glob("*.json")}
        for name in sorted(set(want) | set(have)):
            if name not in have:
                problems.append(f"{name}: derived from the download but not committed")
            elif name not in want:
                problems.append(f"{name}: committed but not derived from the download")
            elif have[name] != want[name]:
                problems.append(f"{name}: differs from what the cached GeoNames download gives")
    for p in problems:
        print(f"FAIL {p}")
    if not problems:
        print("OK: data/reference/towns matches " + ("the cached GeoNames download" if meta else "its manifest"))
    return 1 if problems else 0


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("command", nargs="?", choices=["build", "check"], default=None)
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--refresh", action="store_true", help="download the dump again")
    a = ap.parse_args(argv)
    if a.check or a.command == "check":
        return cmd_check()
    if a.command == "build":
        return cmd_build(a.refresh)
    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
