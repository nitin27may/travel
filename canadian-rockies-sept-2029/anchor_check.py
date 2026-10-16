#!/usr/bin/env python3
"""Every href="#x" in index.html must have a matching id="x"."""
import re
import sys
from pathlib import Path

src = (Path(__file__).resolve().parent / "index.html").read_text(encoding="utf-8")
ids = set(re.findall(r'\bid="([^"]+)"', src))
hrefs = re.findall(r'href="#([^"]*)"', src)
bad = sorted({h for h in hrefs if h and h not in ids})
dup = sorted({i for i in ids if len(re.findall(r'\bid="%s"' % re.escape(i), src)) > 1})
print(f"{len(hrefs)} internal hrefs, {len(ids)} ids")
if dup:
    print("duplicate ids:", dup)
if bad:
    print("MISSING TARGETS:", *bad, sep="\n  ")
    sys.exit(1)
print("anchor check OK")
