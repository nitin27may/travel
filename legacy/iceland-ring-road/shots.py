"""Commons photo search used to source this trip's images. Rate-limited with backoff —
the API returns 429 under load, which reads as a false 'not found' if you don't retry."""
import json, time, urllib.parse, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (nks-travel trip planner; +https://nks-travel.pages.dev/)"}
API = "https://commons.wikimedia.org/w/api.php"


def search(q, n=7):
    url = API + "?" + urllib.parse.urlencode({
        "action": "query", "list": "search", "srsearch": q,
        "srnamespace": "6", "srlimit": str(n), "format": "json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return [h["title"][5:] for h in json.load(r)["query"]["search"]]
        except Exception:
            time.sleep(2 * (attempt + 1))
    return []


if __name__ == "__main__":
    import sys
    for q in sys.argv[1:]:
        print("##", q)
        for t in search(q):
            print("   ", t)
        time.sleep(0.7)
