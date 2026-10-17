"""Landing page and 404 for the published site. Moved verbatim from publish.sh (P1b);
the only change is that "today" is a parameter (tools/publish.py honours HUB_TODAY)."""
from __future__ import annotations

import argparse
import datetime
import html
import json
import os
import re
from datetime import date
from pathlib import Path


def meta(doc, name):
    m = re.search(r'<meta name="%s" content="([^"]*)"' % re.escape(name), doc)
    return m.group(1) if m else ''

def hero(doc):
    # pattern 1: CSS background url(...) in the hero
    m = re.search(r'url\("(https://commons\.wikimedia\.org/wiki/Special:FilePath/[^"]+)"', doc)
    if not m:
        # pattern 2: first <img src="...">
        m = re.search(r'<img[^>]+src="(https://commons\.wikimedia\.org/wiki/Special:FilePath/[^"]+)"', doc)
    if not m:
        return ''
    return re.sub(r'\?width=\d+', '', m.group(1)) + '?width=900'


def status(t, today):
    try:
        d = datetime.date.fromisoformat(t['date'])
    except Exception:
        return '', ''
    n = (d - today).days
    if n < 0:  return 'past', 'Past trip'
    if n == 0: return 'now', 'Today'
    if n == 1: return 'now', 'Tomorrow'
    if n <= 30: return 'soon', f'In {n} days'
    return '', f'In {n} days'


def card(t, today):
    cls, badge = status(t, today)
    title = html.escape(t['title'])
    # split "Name — detail" so the card headline stays short
    head = title.split(' — ')[0] if ' — ' in title else title
    img = (f'<img loading="lazy" src="{html.escape(t["img"])}" alt="">'
           if t['img'] else '<div class="noimg"></div>')
    bits = ' &#183; '.join([b for b in (html.escape(t['dur']), html.escape(t['region'])) if b])
    return f'''<a class="trip{(" " + cls) if cls else ""}" href="/{t["slug"]}/">
  <figure>{img}{f'<span class="badge {cls}">{badge}</span>' if badge else ''}</figure>
  <div class="body">
    <span class="when">{html.escape(t["dates"]) or "&nbsp;"}</span>
    <h2>{head}</h2>
    <p>{html.escape(t["sub"])}</p>
    <span class="meta">{bits}</span>
  </div>
</a>'''


CSS = """
*{margin:0;padding:0;box-sizing:border-box}
body{background:#14251d;color:#f6f4ee;font-family:"Source Serif 4",Georgia,serif;min-height:100vh;padding:7vh 6vw 10vh}
header{border-bottom:3px solid #d69329;padding-bottom:22px;margin-bottom:34px;max-width:1180px}
.eyebrow{font-family:"IBM Plex Mono",monospace;font-size:.74rem;letter-spacing:.22em;text-transform:uppercase;color:#d69329;margin-bottom:10px}
h1{font-family:"Big Shoulders Display",sans-serif;font-weight:800;text-transform:uppercase;font-size:clamp(2.6rem,8vw,5rem);line-height:.95;letter-spacing:.015em}
.lede{margin-top:12px;color:#a9b8ae;max-width:620px}
h3.sec{font-family:"Big Shoulders Display",sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:1.05rem;color:#6f8579;margin:38px 0 16px;max-width:1180px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;max-width:1180px}
a.trip{display:flex;flex-direction:column;background:#1d3529;border:1px solid #2f4a3b;border-radius:14px;overflow:hidden;text-decoration:none;color:#f6f4ee;transition:border-color .15s,transform .15s,box-shadow .15s}
a.trip:hover{border-color:#d69329;transform:translateY(-3px);box-shadow:0 10px 26px rgba(0,0,0,.35)}
a.trip:focus-visible{outline:3px solid #d69329;outline-offset:3px}
a.trip figure{position:relative;margin:0;height:180px;overflow:hidden;background:#0f1c16}
a.trip img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s}
a.trip:hover img{transform:scale(1.05)}
a.trip .noimg{width:100%;height:100%;background:linear-gradient(135deg,#1d3529,#2f4a3b)}
.badge{position:absolute;top:10px;left:10px;font-family:"IBM Plex Mono",monospace;font-size:.64rem;letter-spacing:.1em;text-transform:uppercase;padding:4px 9px;border-radius:999px;background:rgba(20,37,29,.85);color:#cfd8d2;border:1px solid #3d5b4b}
.badge.now{background:#d69329;color:#2a1e05;border-color:#d69329;font-weight:600}
.badge.soon{background:#0e6b6e;color:#fff;border-color:#0e6b6e}
a.trip .body{padding:16px 18px 18px;display:flex;flex-direction:column;flex:1}
a.trip .when{font-family:"IBM Plex Mono",monospace;font-size:.68rem;letter-spacing:.09em;text-transform:uppercase;color:#d69329;margin-bottom:6px}
a.trip h2{font-family:"Big Shoulders Display",sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.03em;font-size:1.5rem;line-height:1.05}
a.trip p{color:#a9b8ae;font-size:.9rem;margin-top:7px;flex:1}
a.trip .meta{font-family:"IBM Plex Mono",monospace;font-size:.68rem;color:#6f8579;margin-top:12px;padding-top:10px;border-top:1px solid #2f4a3b}
a.trip.past{opacity:.62}
a.trip.past:hover{opacity:1}
footer{margin-top:54px;color:#6f8579;font-size:.78rem;max-width:1180px}
@media(max-width:640px){body{padding:5vh 5vw 8vh}a.trip figure{height:160px}}
"""


def trip_record(slug, doc):
    t = re.search(r'<title>([^<]*)', doc)
    sub = re.search(r'class="sub">([^<]*)', doc)
    return {
        'slug': slug,
        'title': html.unescape(t.group(1)).strip() if t else slug,
        'sub': html.unescape(sub.group(1)).strip() if sub else '',
        'img': hero(doc),
        'date': meta(doc, 'trip-date'),
        'dates': meta(doc, 'trip-dates'),
        'dur': meta(doc, 'trip-duration'),
        'region': meta(doc, 'trip-region'),
    }


def write_trips_json(root: Path, out: Path, today: date) -> int:
    """The trip list as JSON for the web app: every served legacy trip page (not the site pages),
    sorted like the hub, with the same Today / In N days / Past trip badge the hub computes."""
    manifest = json.loads((root / 'legacy' / 'MANIFEST.json').read_text(encoding='utf-8'))
    trips = []
    for f in manifest['folders']:
        if not f.get('served') or f.get('kind') == 'site-page' or f.get('private'):
            continue
        page = root / 'legacy' / f['slug'] / 'index.html'
        if not page.is_file():
            continue
        t = trip_record(f['slug'], page.read_text(encoding='utf-8'))
        for k in ('dates', 'dur', 'region'):
            t[k] = html.unescape(t[k])   # meta attributes carry entities such as &ndash;
        t['status'], t['badge'] = status(t, today)
        trips.append(t)
    trips.sort(key=lambda t: (t['date'] or '9999', t['slug']))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(trips, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    return len(trips)


def write_hub(site: Path, today: date) -> None:
    site = str(site)
    trips = []
    SITE_PAGES = {'globe', 'locations'}   # site pages, not trips: no card, linked from the header instead
    for slug in sorted(os.listdir(site)):
        f = os.path.join(site, slug, 'index.html')
        if slug in SITE_PAGES or not os.path.isdir(os.path.join(site, slug)) or not os.path.exists(f):
            continue
        doc = open(f, encoding='utf-8').read()
        if 'name="trip-private"' in doc:      # placeholder for a page taken private (MANIFEST "private")
            continue
        trips.append(trip_record(slug, doc))

    def key(t):
        try:
            return datetime.date.fromisoformat(t['date'])
        except Exception:
            return datetime.date(2099, 1, 1)
    trips.sort(key=key)

    upcoming = [t for t in trips if status(t, today)[0] != 'past']
    past     = [t for t in trips if status(t, today)[0] == 'past']

    out = [
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<title>Trip Plans</title>',
    '<meta name="description" content="Researched travel itineraries — trails, maps, timings and conditions.">',
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Mono:wght@450;600&display=swap" rel="stylesheet">',
    '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'%3E%3Crect x=\'8\' y=\'4\' width=\'16\' height=\'24\' rx=\'2\' fill=\'%230e6b6e\'/%3E%3C/svg%3E">',
    '<style>' + CSS + '</style></head><body>',
    '<header><p class="eyebrow">Field plans</p><h1>Trip Plans</h1>',
    '<p class="lede">Researched itineraries &mdash; trails, maps, timings and conditions. Each plan keeps its own address.</p>',
    '<p class="lede" style="margin-top:10px"><a href="globe/" style="color:#d69329">Explore the globe</a> &mdash; spin the earth, drill into countries, states and cities.</p>',
    '<p class="lede" style="margin-top:10px"><a href="locations/" style="color:#d69329">Browse the locations list</a> &mdash; every saved place by country, region and area, with filters and a link to the globe.</p></header>',
    ]
    if upcoming:
        out.append('<h3 class="sec">Upcoming</h3><div class="grid">')
        out += [card(t, today) for t in upcoming]
        out.append('</div>')
    if past:
        out.append('<h3 class="sec">Past</h3><div class="grid">')
        out += [card(t, today) for t in past]
        out.append('</div>')
    out.append('<footer>Published from ~/workspace/travel &mdash; run ./publish.sh to update. '
               'Add a trip by creating &lt;slug&gt;/index.html beside it; the card image is taken from that page\'s hero.</footer>')
    out.append('</body></html>')
    open(os.path.join(site,'index.html'),'w',encoding='utf-8').write('\n'.join(out))
    # A real 404 page. Without one, Cloudflare Pages serves the hub with a 200 for every unknown path,
    # which hid the fact that old files had been removed (16 Oct 2026).
    nf = ('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">'
          '<title>Not found</title><style>' + CSS + '</style></head><body><header><p class="eyebrow">404</p><h1>Not here</h1>'
          '<p class="lede">That page does not exist on this site. <a href="/" style="color:#d69329">Back to the trip list</a>.</p></header></body></html>')
    open(os.path.join(site,'404.html'),'w',encoding='utf-8').write(nf)
    print(f"  hub: {len(upcoming)} upcoming, {len(past)} past")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description='Trip list for the web app (the HTML hub is written by tools/publish.py).')
    ap.add_argument('--json', metavar='OUT', required=True, help='write the served legacy trips as JSON')
    ap.add_argument('--root', default=str(Path(__file__).resolve().parent.parent))
    args = ap.parse_args(argv)
    today = date.fromisoformat(os.environ['HUB_TODAY']) if os.environ.get('HUB_TODAY') else date.today()
    n = write_trips_json(Path(args.root), Path(args.json), today)
    print(f'  hub json: {n} trips -> {args.json}')
    return 0


if __name__ == '__main__':
    import sys
    sys.exit(main())
