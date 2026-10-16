#!/usr/bin/env python3
"""Photo gallery for a trip page: verify photos on Wikimedia Commons, then inject a section.

    python3 _system/gallery.py verify <trip>/gallery/gallery.json
    python3 _system/gallery.py sheet  <trip>/gallery/gallery.json /tmp/sheet.jpg   # contact sheet to eyeball
    python3 _system/gallery.py inject <trip>/gallery/gallery.json <trip>/index.html

`inject` is idempotent: it replaces everything between the gallery markers, so re-run it after
any rebuild of index.html (build_page.py trips call it at the end of the build).

The page stays self-contained: no JS, images hotlinked from Commons, every photo credited with
author and licence and linked to its Commons file page.
"""
from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

UA = {"User-Agent": "nks-travel-gallery/1.0 (personal trip planner)"}
API = "https://commons.wikimedia.org/w/api.php"
OK_LICENSE = re.compile(r"^(CC BY(-SA)?( [0-9.]+)?|CC0.*|Public domain.*|PD.*|CC BY-SA.*)$", re.I)
MIN_WIDTH = 1600
START, END = "<!-- gallery:start -->", "<!-- gallery:end -->"


def _open(req: urllib.request.Request):
    """Paced request; Commons 429s a shared IP quickly, so back off instead of hammering."""
    for wait in (0.6, 20, 60):
        time.sleep(wait if wait < 1 else 0)
        try:
            return urllib.request.urlopen(req, timeout=40)
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            print(f"429 from Commons, waiting {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise SystemExit("Commons keeps returning 429; stop and retry later")


def _get_raw(url: str) -> bytes:
    """Single un-retried request; the caller owns pacing and 429 handling."""
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        return r.read()


def _get(url: str) -> bytes:
    with _open(urllib.request.Request(url, headers=UA)) as r:
        return r.read()


def file_url(fn: str, width: int) -> str:
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(fn.replace(" ", "_")) + f"?width={width}"


def file_page(fn: str) -> str:
    return "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(fn.replace(" ", "_"))


def load(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def photos(data: dict):
    for s in data["sections"]:
        for p in s["photos"]:
            yield s["place"], p


def _imageinfo(files: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for i in range(0, len(files), 40):
        batch = files[i:i + 40]
        q = urllib.parse.urlencode({
            "action": "query", "format": "json", "prop": "imageinfo",
            "iiprop": "size|mime|extmetadata",
            "titles": "|".join("File:" + f.replace("_", " ") for f in batch),
        })
        pages = json.loads(_get(f"{API}?{q}"))["query"]["pages"].values()
        for pg in pages:
            title = pg["title"].removeprefix("File:")
            out[title] = (pg.get("imageinfo") or [{}])[0]
    return out


def verify(data: dict) -> list[str]:
    """Return a list of problems; empty means every photo passed."""
    problems: list[str] = []
    names = [p["file"] for _, p in photos(data)]
    if len(set(names)) != len(names):
        problems.append("duplicate files in gallery.json")
    info = _imageinfo(names)
    for place, p in photos(data):
        fn = p["file"].replace("_", " ")
        ii = info.get(fn)
        tag = f"{place} / {fn}"
        if not ii or "width" not in ii:
            problems.append(f"{tag}: not found on Commons")
            continue
        if ii.get("mime") != "image/jpeg":
            problems.append(f"{tag}: mime {ii.get('mime')}")
        if ii["width"] < MIN_WIDTH or ii["width"] <= ii["height"]:
            problems.append(f"{tag}: {ii['width']}x{ii['height']} (need landscape >= {MIN_WIDTH}px)")
        lic = html.unescape(ii.get("extmetadata", {}).get("LicenseShortName", {}).get("value", ""))
        if not OK_LICENSE.match(lic.strip()):
            problems.append(f"{tag}: licence '{lic}'")
        if not p.get("author") or not p.get("license"):
            problems.append(f"{tag}: missing author/license in json")
        try:
            req = urllib.request.Request(file_url(fn, 900), headers=UA, method="HEAD")
            with _open(req) as r:
                if r.status != 200:
                    problems.append(f"{tag}: hotlink HTTP {r.status}")
        except Exception as e:  # noqa: BLE001
            problems.append(f"{tag}: hotlink failed ({e})")
    return problems


def sheet(data: dict, out: str) -> None:
    from PIL import Image, ImageDraw
    items = list(photos(data))
    cols, tw, th = 4, 360, 240
    rows = (len(items) + cols - 1) // cols
    img = Image.new("RGB", (cols * tw, rows * (th + 18)), "white")
    d = ImageDraw.Draw(img)
    import io
    for i, (place, p) in enumerate(items):
        x, y = (i % cols) * tw, (i // cols) * (th + 18)
        try:
            im = Image.open(io.BytesIO(_get(file_url(p["file"], 480)))).convert("RGB")
            im.thumbnail((tw - 4, th - 2))
            img.paste(im, (x + 2, y + 18))
        except Exception as e:  # noqa: BLE001
            d.text((x + 4, y + 30), f"FAILED {e}", fill="red")
        d.text((x + 4, y + 3), f"{i}: {place[:40]}", fill="black")
    img.save(out, quality=82)
    print(f"wrote {out} ({len(items)} photos, {cols}x{rows})")


CSS = """
<style>
#gallery{padding:50px 0;border-bottom:1px solid var(--line,#ddd)}
#gallery .gwrap{max-width:1080px;margin:0 auto;padding:0 20px}
#gallery h2{margin:0 0 6px}
#gallery .gnote{color:var(--muted,#666);margin:0 0 26px;max-width:62ch}
#gallery .gplace{margin:0 0 34px}
#gallery .gplace h3{margin:0;font-size:1.2rem;letter-spacing:-.01em}
#gallery .gplace .gdays{font-family:var(--font-mono,monospace);font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#666);margin-left:8px;white-space:nowrap}
#gallery .gplace p{margin:3px 0 12px;color:var(--muted,#666);font-size:.95rem}
#gallery .ggrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
#gallery figure{margin:0;position:relative;overflow:hidden;border-radius:6px;background:var(--surface,#fff);border:1px solid var(--line,#ddd)}
#gallery figure a.gimg{display:block;aspect-ratio:3/2;overflow:hidden}
#gallery img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s}
#gallery figure:hover img{transform:scale(1.03)}
#gallery figcaption{padding:7px 9px 8px;font-size:.78rem;line-height:1.35;color:var(--ink,#222)}
#gallery figcaption small{display:block;color:var(--muted,#666);font-size:.68rem;margin-top:2px}
#gallery figcaption small a{color:inherit}
@media (prefers-reduced-motion:reduce){#gallery img{transition:none}}
@media print{#gallery{break-inside:avoid}}

#glb{position:fixed;inset:0;z-index:1000;display:none;background:rgba(10,12,14,.97);color:#fff;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font-body,Georgia,serif)}
#glb.open{display:flex}
#glb .gl-stage{position:relative;flex:1;width:100%;min-height:0;display:flex;align-items:center;justify-content:center;padding:44px 64px 8px;box-sizing:border-box;touch-action:pan-y}
#glb img{max-width:100%;max-height:100%;object-fit:contain;display:block;border-radius:3px;transition:opacity .2s}
#glb img.loading{opacity:.25}
#glb .gl-cap{width:100%;max-width:900px;padding:8px 20px 18px;box-sizing:border-box;text-align:center;font-size:.9rem;line-height:1.4}
#glb .gl-cap small{display:block;color:#b8c0c8;font-size:.75rem;margin-top:3px}
#glb .gl-cap a{color:#cfe3ee}
#glb button{position:absolute;background:rgba(255,255,255,.12);color:#fff;border:0;cursor:pointer;border-radius:50%;width:46px;height:46px;font-size:1.5rem;line-height:1;display:flex;align-items:center;justify-content:center}
#glb button:hover,#glb button:focus-visible{background:rgba(255,255,255,.28);outline:2px solid #fff}
#glb .gl-prev{left:10px;top:50%;margin-top:-23px}
#glb .gl-next{right:10px;top:50%;margin-top:-23px}
#glb .gl-close{right:10px;top:10px;font-size:1.3rem}
#glb .gl-fs{right:64px;top:10px;font-size:1.1rem}
#glb .gl-count{position:absolute;left:16px;top:18px;font-family:var(--font-mono,monospace);font-size:.75rem;letter-spacing:.08em;color:#b8c0c8}
@media (max-width:620px){#glb .gl-stage{padding:48px 6px 4px}#glb .gl-prev,#glb .gl-next{top:auto;bottom:86px;margin:0}#glb .gl-prev{left:12px}#glb .gl-next{right:12px}}
@media (prefers-reduced-motion:reduce){#glb img{transition:none}}
@media print{#glb{display:none!important}}
</style>
"""


LIGHTBOX_JS = r'''
<script>
(function(){
  var root=document.getElementById('gallery'); if(!root) return;
  var links=[].slice.call(root.querySelectorAll('a.gimg'));
  if(!links.length) return;
  var box=document.createElement('div');
  box.id='glb'; box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-label','Photo viewer');
  box.innerHTML='<div class="gl-count"></div><button class="gl-fs" type="button" aria-label="Full screen">&#x26F6;</button><button class="gl-close" type="button" aria-label="Close">&times;</button>'
   +'<div class="gl-stage"><button class="gl-prev" type="button" aria-label="Previous photo">&#8249;</button><img alt=""><button class="gl-next" type="button" aria-label="Next photo">&#8250;</button></div><div class="gl-cap"></div>';
  document.body.appendChild(box);
  var img=box.querySelector('img'), cap=box.querySelector('.gl-cap'), cnt=box.querySelector('.gl-count'), cur=0, opener=null;
  function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML}
  function show(i){
    cur=(i+links.length)%links.length; var a=links[cur];
    img.classList.add('loading'); img.onload=function(){img.classList.remove('loading')};
    img.src=a.getAttribute('data-full'); img.alt=a.getAttribute('data-cap')||'';
    cap.innerHTML=esc(a.getAttribute('data-cap')||'')+'<small>'+esc(a.getAttribute('data-place')||'')+' &middot; '+esc(a.getAttribute('data-credit')||'')+' &middot; <a href="'+a.href+'" target="_blank" rel="noopener">Commons page</a></small>';
    cnt.textContent=(cur+1)+' / '+links.length;
    [1,-1].forEach(function(d){var n=links[(cur+d+links.length)%links.length]; (new Image()).src=n.getAttribute('data-full')});
  }
  function open(i,from){opener=from; box.classList.add('open'); document.documentElement.style.overflow='hidden'; show(i); box.querySelector('.gl-close').focus()}
  function close(){
    if(document.fullscreenElement&&document.exitFullscreen) document.exitFullscreen();
    box.classList.remove('open'); document.documentElement.style.overflow=''; img.removeAttribute('src'); if(opener) opener.focus();
  }
  links.forEach(function(a,i){a.addEventListener('click',function(e){e.preventDefault(); open(i,a)})});
  box.querySelector('.gl-prev').addEventListener('click',function(){show(cur-1)});
  box.querySelector('.gl-next').addEventListener('click',function(){show(cur+1)});
  box.querySelector('.gl-close').addEventListener('click',close);
  box.querySelector('.gl-fs').addEventListener('click',function(){
    if(document.fullscreenElement){document.exitFullscreen()} else if(box.requestFullscreen){box.requestFullscreen()}
  });
  box.addEventListener('click',function(e){ if(e.target===box||e.target.classList.contains('gl-stage')||e.target===cap) close() });
  document.addEventListener('keydown',function(e){
    if(!box.classList.contains('open')) return;
    if(e.key==='Escape') close(); else if(e.key==='ArrowRight') show(cur+1); else if(e.key==='ArrowLeft') show(cur-1);
    else if(e.key==='Tab'){ var f=[].slice.call(box.querySelectorAll('button')); var i=f.indexOf(document.activeElement); e.preventDefault(); f[(i+(e.shiftKey?-1:1)+f.length)%f.length].focus() }
  });
  var x0=null;
  box.addEventListener('touchstart',function(e){x0=e.changedTouches[0].clientX},{passive:true});
  box.addEventListener('touchend',function(e){ if(x0===null) return; var dx=e.changedTouches[0].clientX-x0; x0=null; if(Math.abs(dx)>50) show(cur+(dx<0?1:-1)) },{passive:true});
})();
</script>
'''


def render(data: dict) -> str:
    esc = html.escape
    parts = [START, CSS, '<section id="gallery"><div class="gwrap">',
             '<p class="kicker">Where you are going</p>',
             '<h2>Photo gallery</h2>',
             '<p class="gnote">The places on this plan, in the order you reach them. Click a photo to view it full size, '
             'then use the arrows, arrow keys or a swipe to move through the gallery. These show typical views, '
             'not conditions on your dates.</p>']
    for s in data["sections"]:
        days = f'<span class="gdays">{esc(s["days"])}</span>' if s.get("days") else ""
        parts.append(f'<div class="gplace"><h3>{esc(s["place"])}{days}</h3><p>{esc(s["blurb"])}</p><div class="ggrid">')
        for p in s["photos"]:
            lic = esc(p["license"])
            parts.append(
                f'<figure><a class="gimg" href="{file_page(p["file"])}" target="_blank" rel="noopener" '
                f'data-full="{file_url(p["file"], 1600)}" data-cap="{esc(p["caption"])}" '
                f'data-place="{esc(s["place"])}" data-credit="{esc(p["author"])} &middot; {lic}">'
                f'<img loading="lazy" src="{file_url(p["file"], 900)}" alt="{esc(p["caption"])}"></a>'
                f'<figcaption>{esc(p["caption"])}<small>{esc(p["author"])} &middot; {lic} &middot; '
                f'<a href="{file_page(p["file"])}" target="_blank" rel="noopener">Commons</a></small></figcaption></figure>')
        parts.append("</div></div>")
    parts.append("</div></section>")
    parts.append(LIGHTBOX_JS)
    parts.append(END)
    return "\n".join(parts)


def embedded_files(src: str) -> set[str]:
    """Commons filenames already embedded in the page body (so the gallery never repeats them)."""
    out = set()
    for m in re.finditer(r'<img[^>]*?src="([^"]+)"', src):
        u = m.group(1)
        if "Special:FilePath/" in u:
            fn = urllib.parse.unquote(u.split("Special:FilePath/")[1].split("?")[0])
        elif "wikimedia.org/wikipedia/commons" in u:
            parts = urllib.parse.unquote(u.split("?")[0]).split("/")
            fn = parts[-2] if "/thumb/" in u else parts[-1]
        else:
            continue
        out.add(fn.replace("_", " "))
    return out


def inject(data: dict, page: Path, after: str | None = None, dedupe: bool = False) -> None:
    """Insert the gallery after section id `after` (default: the about/orient intro section)."""
    src = page.read_text(encoding="utf-8")
    src = re.sub(re.escape(START) + r".*?" + re.escape(END) + r"\n?", "", src, flags=re.S)
    used = embedded_files(src) if dedupe else set()
    dropped = []
    for sec in data["sections"]:
        keep = [ph for ph in sec["photos"] if ph["file"].replace("_", " ") not in used]
        dropped += [ph["file"] for ph in sec["photos"] if ph not in keep]
        sec["photos"] = keep
    data = {**data, "sections": [sec for sec in data["sections"] if sec["photos"]]}
    if dropped:
        print(f"dropped {len(dropped)} gallery photos already used on the page: {dropped}")
    block = render(data)
    anchor = re.escape(after) if after else "about|orient"
    m = re.search(r'<section[^>]*id="(' + anchor + r')"[^>]*>.*?</section>', src, flags=re.S)
    if after and not m:
        print(f"warning: no section id={after!r}; falling back to the intro section")
        m = re.search(r'<section[^>]*id="(about|orient)"[^>]*>.*?</section>', src, flags=re.S)
    if m:
        src = src[:m.end()] + "\n" + block + "\n" + src[m.end():]
    else:
        i = src.find("</main>")
        if i < 0:
            raise SystemExit("no intro section and no </main> to anchor the gallery")
        src = src[:i] + block + "\n" + src[i:]
    if 'href="#gallery"' not in src:
        src = re.sub(r'(<a[^>]*href="#(?:about|orient)"[^>]*>.*?</a>)',
                     r'\1<a href="#gallery"><b>&#9632;</b><span>photos</span></a>', src, count=1, flags=re.S)
    page.write_text(src, encoding="utf-8")
    print(f"gallery injected into {page} ({sum(len(s['photos']) for s in data['sections'])} photos)")


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    cmd, gj = sys.argv[1], sys.argv[2]
    data = load(gj)
    if cmd == "verify":
        probs = verify(data)
        print("\n".join(probs) if probs else f"OK: {sum(1 for _ in photos(data))} photos verified")
        sys.exit(1 if probs else 0)
    if cmd == "sheet":
        sheet(data, sys.argv[3])
    elif cmd == "inject":
        probs = [] if "--skip-verify" in sys.argv else verify(data)
        if probs:
            raise SystemExit("verify failed, not injecting:\n  " + "\n  ".join(probs))
        after = sys.argv[sys.argv.index("--after") + 1] if "--after" in sys.argv else None
        inject(data, Path(sys.argv[3]), after=after, dedupe="--dedupe" in sys.argv)
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
