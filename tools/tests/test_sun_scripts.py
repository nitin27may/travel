"""The legacy sun scripts must agree with core/src/sun (the reference; see core/bin/sun.ts).

The expected values below were written from `node core/bin/sun.ts` (longitude positive east). The scripts once
negated the longitude and were off by 8 minutes per degree; if one drifts again this fails.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def run(script: str) -> str:
    out = subprocess.run([sys.executable, str(ROOT / "legacy" / script)], capture_output=True, text=True, check=True)
    return out.stdout


def line(output: str, date: str, place: str) -> str:
    in_day = False
    for row in output.splitlines():
        if re.match(r"^\d{4}-\d{2}-\d{2}", row):
            in_day = row.startswith(date)
        elif in_day and row.strip().startswith(place):
            return row
    raise AssertionError(f"{place} {date} not in output")


def test_iceland_reykjavik_sun_times():
    row = line(run("iceland-ring-road/sun-times.py"), "2027-09-08", "Reykjavik")
    assert "sunrise 06:28" in row and "sunset 20:24" in row
    assert "civil dawn 05:37" in row and "civil dusk 21:15" in row


def test_iceland_myvatn_dark_times():
    out = run("iceland-ring-road/dark-times.py")
    row = next(r for r in out.splitlines() if r.startswith("2027-09-08") and "Reykjavik" in r)
    assert "23:59 - 02:52" in row
    row = next(r for r in out.splitlines() if r.startswith("2027-09-01") and "Reykjavik" in r)
    assert "none (never fully dark)" in row


def test_norway_bergen_sun_times():
    row = line(run("norway-summer/sun-times.py"), "2028-07-08", "Bergen")
    assert "sunrise 04:26" in row and "sunset 23:01" in row
    assert "civil dawn 02:51" in row and "civil dusk 00:36" in row


def test_rockies_banff_sun_times():
    row = line(run("canadian-rockies-sept-2029/sun-times.py"), "2029-09-08", "Banff")
    assert "sunrise 07:05" in row and "sunset 20:16" in row


def test_patagonia_copy_agrees_with_norway_copy():
    # same file contents apart from nothing: both must give the east-positive answer
    row = line(run("patagonia-feb-mar-2027/sun-times.py"), "2028-07-08", "Bergen")
    assert "sunrise 04:26" in row
