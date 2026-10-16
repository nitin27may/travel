"""Verify every Commons filename embedded in index.html actually resolves before shipping.
Retries on 429 — without backoff the API rate-limits and reports working images as failures."""
import re, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0 (nks-travel trip planner; +https://nks-travel.pages.dev/)"}


def check(encoded_name):
    url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{encoded_name}?width=1200"
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers=UA, method="HEAD")
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(3 * (attempt + 1)); continue
            return e.code
        except Exception:
            time.sleep(2 * (attempt + 1))
    return "ERR"


if __name__ == "__main__":
    doc = Path(__file__).with_name("index.html").read_text(encoding="utf-8")
    names = sorted(set(re.findall(r"Special:FilePath/([^\"?]+)", doc)))
    bad = []
    for n in names:
        s = check(n)
        if s != 200:
            bad.append((n, s)); print("FAIL", s, urllib.parse.unquote(n))
        time.sleep(0.4)
    print(f"\nchecked {len(names)}  failures {len(bad)}")
    sys.exit(1 if bad else 0)
