#!/usr/bin/env python3
"""Check every URL in data/*.json and index.html. Sequential, 1.5 s between requests per domain,
20 s timeout, HEAD then GET fallback. Writes links-report.txt. Fixes nothing."""
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
GAP_S, TIMEOUT = 1.5, 20
UNVERIFIABLE_HOSTS = ("alltrails.com", "google.com", "maps.google.com", "goo.gl")
SKIP_HOSTS = ("fonts.googleapis.com", "fonts.gstatic.com", "commons.wikimedia.org", "upload.wikimedia.org")


def collect():
    urls = set()
    rx = re.compile(r"https?://[^\s\"'<>\\)]+")
    for p in sorted((HERE / "data").glob("*.json")):
        urls.update(rx.findall(p.read_text(encoding="utf-8")))
    html = (HERE / "index.html").read_text(encoding="utf-8")
    urls.update(u.replace("&amp;", "&") for u in re.findall(r'(?:href|src)="(https?://[^"]+)"', html))
    out = set()
    for u in urls:
        u = u.rstrip(".,;")
        host = urllib.parse.urlparse(u).netloc.lower()
        if host and not host.endswith(SKIP_HOSTS) and host not in SKIP_HOSTS:
            out.add(u)
    return sorted(out)


last = {}


def fetch(url, method):
    host = urllib.parse.urlparse(url).netloc
    wait = GAP_S - (time.time() - last.get(host, 0))
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status, ""
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:   # DNS, timeout, TLS
        return 0, type(e).__name__ + ": " + str(e)[:80]
    finally:
        last[host] = time.time()


def classify(url):
    host = urllib.parse.urlparse(url).netloc.lower()
    code, err = fetch(url, "HEAD")
    if code >= 400 or code == 0:
        code, err = fetch(url, "GET")
    unver = host.endswith(UNVERIFIABLE_HOSTS) or any(h in url for h in ("google.com/maps",))
    if 200 <= code < 400:
        return "OK", code, err
    if unver and code in (403, 429, 0, 400, 404, 405, 503):
        return "UNVERIFIABLE", code, err
    if code in (401, 403, 405, 429, 999, 503) and not unver:
        return "UNVERIFIABLE", code, err
    return "BROKEN", code, err


def main():
    urls = collect()
    print(f"{len(urls)} unique URLs")
    res = []
    for i, u in enumerate(urls, 1):
        st, code, err = classify(u)
        res.append((u, st, code, err))
        if st != "OK":
            print(f"[{i}/{len(urls)}] {st} {code} {u} {err}", flush=True)
    c = Counter(r[1] for r in res)
    lines = [f"Links checked: {len(res)}", f"OK: {c['OK']}", f"UNVERIFIABLE (AllTrails/Google/bot-blocked): {c['UNVERIFIABLE']}",
             f"BROKEN: {c['BROKEN']}", "", "BROKEN list:"]
    lines += [f"  {code or 'ERR'} {u} {err}" for u, st, code, err in res if st == "BROKEN"] or ["  none"]
    lines += ["", "UNVERIFIABLE list:"] + [f"  {code or 'ERR'} {u}" for u, st, code, err in res if st == "UNVERIFIABLE"]
    (HERE / "links-report.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines[:4]))


if __name__ == "__main__":
    main()
