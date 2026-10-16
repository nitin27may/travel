"""HEAD every thumb URL actually used in the page. Drop anything that does not return 200."""
import json, urllib.request, time, concurrent.futures as cf
UA = "Mozilla/5.0 (compatible; nks-trip-planner/1.0)"
PH = json.load(open("photos.json"))

def head(item):
    for attempt in range(2):
        try:
            req = urllib.request.Request(item["thumb"], headers={"User-Agent": UA}, method="GET")
            with urllib.request.urlopen(req, timeout=12) as r:
                data = r.read(2048)
                return (r.status == 200 and len(data) > 500)
        except Exception as e:
            if "429" in str(e):
                time.sleep(6 * (attempt + 1)); continue
            return False
    return False

bad = 0
for key, items in PH.items():
    with cf.ThreadPoolExecutor(max_workers=5) as ex:
        oks = list(ex.map(head, items))
    keep = [i for i, ok in zip(items, oks) if ok]
    if len(keep) != len(items):
        for i, ok in zip(items, oks):
            if not ok:
                print(f"  DROP {key}: {i['file'][:64]}")
        bad += len(items) - len(keep)
    PH[key] = keep
    time.sleep(0.4)

json.dump(PH, open("photos.json", "w"), indent=1)
tot = sum(len(v) for v in PH.values())
thin = {k: len(v) for k, v in PH.items() if len(v) < 3}
print(f"\ndropped {bad}; {tot} images remain")
print("thin (<3):", thin or "none")
