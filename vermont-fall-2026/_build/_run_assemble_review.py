#!/usr/bin/env python3
import json
P=json.load(open("_build/_review_parts.json"))
theme=open("../_system/themes/autumn.css").read().split("{",1)[1].rsplit("}",1)[0]

HTML = """<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vermont Oct 1–4, 2026 — plan review &amp; decisions</title>
<meta name="trip-date" content="2026-10-01"><meta name="trip-duration" content="4 days">
<meta name="trip-region" content="Vermont, USA">
<style>
:root{%THEME%}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:var(--font-body),Georgia,"Times New Roman",serif;line-height:1.6;
  -webkit-text-size-adjust:100%}
h1,h2,h3{font-family:var(--font-display),"Helvetica Neue",Arial,sans-serif;
  letter-spacing:.01em;line-height:1.12;margin:0 0 .4em}
h1{font-size:clamp(1.9rem,5vw,3rem)}h2{font-size:clamp(1.4rem,3.4vw,2rem);margin-top:0}
h3{font-size:1.12rem}
.mono,.num,.sc,td.mono{font-family:var(--font-mono),ui-monospace,"SF Mono",Menlo,monospace;
  font-size:.86em;font-variant-numeric:tabular-nums}
.wrap{max-width:1240px;margin:0 auto;padding:0 20px}
header.hero{background:var(--bg-deep);color:var(--ink-on-deep);padding:44px 0 38px;
  border-bottom:5px solid var(--accent)}
header.hero h1{color:#fff}
header.hero p{color:var(--muted-on-deep);max-width:64ch;margin:.5em 0 0}
.kpis{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.kpi{background:var(--bg-deep-2);border:1px solid #4a4034;border-radius:8px;padding:9px 14px}
.kpi b{display:block;font-family:var(--font-mono),monospace;font-size:1.3rem;color:var(--highlight-on-deep)}
.kpi span{font-size:.74rem;text-transform:uppercase;letter-spacing:.09em;color:var(--muted-on-deep)}
nav.sticky{position:sticky;top:0;z-index:50;background:var(--surface);
  border-bottom:1px solid var(--line);padding:9px 0;overflow-x:auto}
nav.sticky .wrap{display:flex;gap:6px;white-space:nowrap}
nav.sticky a{font-family:var(--font-mono),monospace;font-size:.78rem;text-decoration:none;
  color:var(--muted);padding:6px 11px;border-radius:6px;border:1px solid transparent}
nav.sticky a:hover{background:var(--accent-soft);color:var(--accent-dark);border-color:var(--line)}
section{padding:46px 0;border-bottom:1px solid var(--line);scroll-margin-top:56px}
.lede{font-size:1.08rem;max-width:72ch;color:var(--ink)}
.muted{color:var(--muted)}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:18px;margin-top:22px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px}
.card h3{margin-top:0}
.card.warn{border-left:5px solid var(--warn);background:var(--warn-soft)}
.card.pick{border-left:5px solid var(--class-3)}
.opts{margin:14px 0 0;padding:0;list-style:none}
.opts li{padding:9px 0;border-top:1px dashed var(--line);font-size:.95rem}
.opts li:first-child{border-top:0}
.tag{display:inline-block;font-family:var(--font-mono),monospace;font-size:.68rem;
  text-transform:uppercase;letter-spacing:.07em;padding:2px 7px;border-radius:4px;
  background:var(--highlight-soft);color:var(--highlight-ink);border:1px solid var(--highlight);
  vertical-align:2px;margin-left:6px}
.tag.rec{background:#e7efe0;color:#33421f;border-color:var(--class-3)}
.pinmap{width:100%;height:auto;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
.pinmap .grid{font-family:var(--font-mono),monospace;font-size:10px;fill:var(--muted)}
.pinmap .lbl{font-family:var(--font-mono),monospace;font-size:11px;fill:var(--ink);paint-order:stroke;
  stroke:var(--surface);stroke-width:3px;stroke-linejoin:round}
.pin{cursor:pointer;transition:r .12s}
.pin:hover{r:11}
.pin.dim{opacity:.13}
.legend{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0}
.lg{display:flex;align-items:center;gap:7px;font-size:.8rem;font-family:var(--font-mono),monospace;
  border:1px solid var(--line);background:var(--surface);border-radius:20px;padding:5px 13px;cursor:pointer}
.lg .dot{width:11px;height:11px;border-radius:50%}
.lg[aria-pressed=false]{opacity:.4}
.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:20px 0 12px}
.controls input[type=search]{font:inherit;font-size:.92rem;padding:9px 13px;border:1px solid var(--line);
  border-radius:8px;background:var(--surface);color:var(--ink);min-width:210px}
button.f{font-family:var(--font-mono),monospace;font-size:.78rem;padding:8px 13px;border-radius:8px;
  border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer}
button.f[aria-pressed=true]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent-dark)}
.tblwrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
table{border-collapse:collapse;width:100%;min-width:940px;font-size:.9rem}
th{background:var(--header);color:var(--header-ink);font-family:var(--font-display),sans-serif;
  font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;text-align:left;padding:11px 10px;
  position:sticky;top:0;cursor:pointer;white-space:nowrap}
th:hover{background:var(--accent-dark)}
th::after{content:"";opacity:.5;margin-left:5px}
th[data-dir=asc]::after{content:"^"}th[data-dir=desc]::after{content:"v"}
td{padding:10px;border-top:1px solid var(--line);vertical-align:top}
tr.hi td{background:var(--highlight-soft)}
tr:hover td{background:var(--accent-soft)}
.nm b{display:block;font-family:var(--font-display),sans-serif;font-size:1rem;font-weight:700}
.nm .sub{display:block;color:var(--muted);font-size:.78rem;line-height:1.4;margin-top:2px;max-width:46ch}
.chip{display:inline-block;font-family:var(--font-mono),monospace;font-size:.7rem;padding:3px 8px;
  border-radius:20px;color:#fff;background:var(--c);white-space:nowrap}
td.tw{color:var(--accent-dark);font-weight:600}
td.nw{color:var(--muted)}
td.sc{font-weight:700;font-size:1rem}
a.mp{font-family:var(--font-mono),monospace;font-size:.74rem;text-decoration:none;color:var(--accent-dark);
  border:1px solid var(--line);border-radius:6px;padding:4px 9px;display:inline-block}
a.mp:hover{background:var(--accent);color:#fff}
.count{font-family:var(--font-mono),monospace;font-size:.8rem;color:var(--muted);margin-left:auto}
.loops{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px;margin-top:18px}
.loop{background:var(--surface);border:1px solid var(--line);border-left:5px solid var(--c,var(--accent));
  border-radius:10px;padding:16px}
.loop a{color:var(--accent-dark);font-family:var(--font-mono),monospace;font-size:.8rem;word-break:break-all}
.budget{width:100%;border-collapse:collapse;margin-top:16px;font-size:.92rem;min-width:0}
.budget th{position:static;cursor:default}
.budget td,.budget th{padding:9px 11px}
details{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}
summary{cursor:pointer;font-family:var(--font-mono),monospace;font-size:.8rem;color:var(--accent-dark)}
footer{padding:34px 0 60px;color:var(--muted);font-size:.86rem}
@media(max-width:640px){section{padding:32px 0}.nm .sub{display:none}}
@media print{nav.sticky,.controls,.legend{display:none}section{page-break-inside:avoid}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
</style></head><body>

<header class="hero"><div class="wrap">
<h1>Vermont, 1–4 October 2026</h1>
<p>Plan review and open decisions. Every destination researched so far — scheduled and reserve —
with what it costs, whether you have to walk, and what it is worth. Base: 1592 Center Rd, Hyde Park.</p>
<div class="kpis">
<div class="kpi"><b>51</b><span>destinations</span></div>
<div class="kpi"><b>43</b><span>in the plan</span></div>
<div class="kpi"><b>12</b><span>need a trail</span></div>
<div class="kpi"><b>26</b><span>no walking</span></div>
<div class="kpi"><b>17 km</b><span>on foot, 4 days</span></div>
<div class="kpi"><b>4</b><span>decisions open</span></div>
</div></div></header>

<nav class="sticky"><div class="wrap">
<a href="#decide">Decisions</a><a href="#map">Map</a><a href="#table">All destinations</a>
<a href="#budget">Time budget</a><a href="#loops">Loop links</a><a href="#files">Files</a>
</div></nav>

<section id="decide"><div class="wrap">
<h2>Four decisions to make</h2>
<p class="lede">Everything else is settled. These four change the shape of the trip, and each one
is a genuine trade rather than an obvious call.</p>
<div class="grid2">

<div class="card warn"><h3>1. Friday is overloaded</h3>
<p>12 h 30 door to door, ~9 h on site, 9.7 km on foot. It carries the 3-hour hike
<em>and</em> the gondola <em>and</em> the Notch.</p>
<ul class="opts">
<li><b>Cut the gondola</b> <span class="tag rec">recommended</span> — score 7, 90 min, $40–43,
foliage queues. Frees the day without touching a 9 or a 10.</li>
<li><b>Keep it, cut Emily's Bridge and Barnes Camp</b> — saves only 35 min. Doesn't really solve it.</li>
<li><b>Keep everything</b> — accept a 13-hour day on the back of Thursday's 8.75-hour drive.</li>
</ul></div>

<div class="card pick"><h3>2. Mount Pisgah — how far up</h3>
<p>Currently trimmed to <b>Pulpit Rock, 3.5 km / 274 m / 2 h</b>. The full hike is 7.1 km / 503 m / 3 h 45.</p>
<ul class="opts">
<li><b>Pulpit Rock only</b> <span class="tag rec">current</span> — the ledge 650 ft above the lake
is the shot. The summit is treed and has no view.</li>
<li><b>Full hike</b> — adds the North and West overlooks and the full-length lake panorama.
<b>Costs Barr Hill</b>, which scores 9 for 1.1 km.</li>
</ul></div>

<div class="card"><h3>3. Saturday — Willoughby or the gaps</h3>
<p>The Two Gaps day is currently the weather backup, triggered by the Sept 29 check.</p>
<ul class="opts">
<li><b>Willoughby stays primary</b> <span class="tag rec">current</span> — it holds the trip's only
other 10, and the gaps day peaks at 9.</li>
<li><b>Swap them</b> — a real choice, but you would be trading a 10 for a 9.</li>
<li><b>Note:</b> the NEK Fall Foliage Festival runs Sept 27 – Oct 4 — Peacham Fri, Barnet Sat,
Groton Sun. Wrong corner of the Kingdom, 1 h 15+ away, and it conflicts with Willoughby.</li>
</ul></div>

<div class="card"><h3>4. Sunday — bridges or the islands</h3>
<p>Cold Hollow is dropped, so the Waterbury detour is gone either way.</p>
<ul class="opts">
<li><b>Covered-bridge route</b> <span class="tag rec">current</span> — five bridges plus Montgomery,
on the road you were driving anyway, and it reaches the border ~30 min earlier.</li>
<li><b>Lake Champlain Islands</b> — the islands peak exactly Oct 4, but +1 h 30–2 h puts you in the
Sunday afternoon border queue. Home ~20:30.</li>
</ul></div>

</div>
<details><summary>Two things to verify by phone before any of this is fixed</summary>
<p><b>Warren highway dept 802-496-2709</b> — a full Lincoln Gap culvert replacement was scheduled
for 2026 and neither town site posted a resolution. The road otherwise closes ~Oct 15, so the dates
are fine.<br>
<b>Mad River Glen 802-496-3551</b> — 2026 single chair foliage dates, only if the gaps day happens.
Last chair loads 14:30.</p></details>
</div></section>

<section id="map"><div class="wrap">
<h2>Every destination, mapped</h2>
<p class="lede">Larger dots score 9 or 10. Tap any pin to open it in Google Maps. Use the legend to
isolate a day.</p>
<div class="legend" id="legend">
<button class="lg" data-g="thu" aria-pressed="true"><span class="dot" style="background:var(--class-3)"></span>Thu</button>
<button class="lg" data-g="fri" aria-pressed="true"><span class="dot" style="background:var(--class-1)"></span>Fri — Stowe</button>
<button class="lg" data-g="sat" aria-pressed="true"><span class="dot" style="background:var(--class-4)"></span>Sat — Kingdom</button>
<button class="lg" data-g="sun" aria-pressed="true"><span class="dot" style="background:var(--class-5)"></span>Sun — bridges</button>
<button class="lg" data-g="backup" aria-pressed="true"><span class="dot" style="background:var(--class-6)"></span>Backup — gaps</button>
<button class="lg" data-g="reserve" aria-pressed="true"><span class="dot" style="background:var(--muted)"></span>Reserve</button>
</div>
%SVG%
<p class="muted" style="font-size:.84rem;margin-top:10px">Coordinates geocoded from OpenStreetMap.
<b>Smugglers' Notch is corrected</b> — every geocoder returns the ski resort in Jeffersonville,
3.5 km away on the wrong side; this uses the actual pass saddle at 44.5553, −72.7959.
Highgate Springs and the Mansfield toll road are approximate and marked as such in the table.</p>
</div></section>

<section id="table"><div class="wrap">
<h2>All 51 destinations</h2>
<p class="lede">Click a column heading to sort. <b>Trail</b> tells you whether you leave the car park:
<span class="mono">No</span> is pure sightseeing, <span class="mono">Yes</span> means you walk to the view.
Distances are round trip.</p>
<div class="controls">
<input type="search" id="q" placeholder="Search name or note..." aria-label="Search destinations">
<button class="f" data-w="1" aria-pressed="false">Trail only</button>
<button class="f" data-w="0" aria-pressed="false">No walking only</button>
<button class="f" data-s="9" aria-pressed="false">Score 9+</button>
<button class="f" data-s="8" aria-pressed="false">Score 8+</button>
<button class="f" data-hide="reserve" aria-pressed="false">Hide reserve</button>
<span class="count" id="count"></span>
</div>
<div class="tblwrap"><table id="t"><thead><tr>
<th data-t="n">#</th><th data-t="s">Location</th><th data-t="s">Day</th><th data-t="s">Type</th>
<th data-t="s">Trail</th><th data-t="v">km RT</th><th data-t="s">Ascent</th><th data-t="s">Time</th>
<th data-t="v">Score</th><th>Map</th></tr></thead>
<tbody>
%TBODY%
</tbody></table></div>
<p class="muted" style="font-size:.84rem;margin-top:12px"><b>Scoring:</b> 10 = unmissable and cheap ·
9 = unmissable but costs effort · 8 = strong · 7 = worth the stop, first to cut ·
6 = only because it's on the road · 5 = filler.</p>
</div></section>

<section id="budget"><div class="wrap">
<h2>Time budget by day</h2>
<table class="budget">
<thead><tr><th>Day</th><th>Driving</th><th>On site</th><th>On foot</th><th>Ascent</th><th>Door to door</th></tr></thead>
<tbody>
<tr><td>Thu 1 — arrival evening</td><td class="mono">55 m</td><td class="mono">2 h 45</td><td class="mono">0.8 km</td><td class="mono">17 m</td><td class="mono">after 6 h 40 driving</td></tr>
<tr class="hi"><td><b>Fri 2 — Stowe</b></td><td class="mono">2 h 05</td><td class="mono">~9 h</td><td class="mono"><b>9.7 km</b></td><td class="mono"><b>~500 m</b></td><td class="mono"><b>12 h 30</b></td></tr>
<tr><td>Sat 3 — Northeast Kingdom</td><td class="mono">3 h 02</td><td class="mono">4 h 30</td><td class="mono">5.9 km</td><td class="mono">~300 m</td><td class="mono">9 h 30, home 15:45</td></tr>
<tr><td>Sun 4 — bridges home</td><td class="mono">2 h 20</td><td class="mono">2 h 20</td><td class="mono">0.5 km</td><td class="mono">—</td><td class="mono">+ drive to Whitby</td></tr>
<tr><td class="muted">Backup — Two Gaps</td><td class="mono">3 h 20</td><td class="mono">4 h 30</td><td class="mono">4.9 km</td><td class="mono">~140 m</td><td class="mono">~9 h 30</td></tr>
</tbody></table>
<p class="lede" style="margin-top:18px"><b>~17 km on foot across four days, and Friday carries 57% of it.</b>
That is the right shape — one committed day, one moderate, two easy — but it is also why Friday is
decision one. Only one stop on the whole trip exceeds 5 km.</p>
</div></section>

<section id="loops"><div class="wrap">
<h2>Loop links</h2>
<div class="loops">
<div class="loop" style="--c:var(--class-1)"><h3>Friday — Stowe</h3>
<a href="https://www.google.com/maps/dir/1592+Center+Rd,+Hyde+Park,+VT/Stowe+Pinnacle+Trailhead,+Upper+Hollow+Rd,+Stowe,+VT/Emily's+Covered+Bridge,+Covered+Bridge+Rd,+Stowe,+VT/Stowe+Community+Church,+Main+St,+Stowe,+VT/Stowe+Mountain+Resort,+Stowe,+VT/Bingham+Falls+Trailhead,+Mountain+Rd,+Stowe,+VT/Smugglers'+Notch+State+Park,+Stowe,+VT/1592+Center+Rd,+Hyde+Park,+VT/" target="_blank" rel="noopener">Open loop directions</a></div>
<div class="loop" style="--c:var(--class-4)"><h3>Saturday — Northeast Kingdom</h3>
<a href="https://www.google.com/maps/dir/1592+Center+Rd,+Hyde+Park,+VT/Mount+Pisgah+South+Trailhead,+VT-5A,+Westmore,+VT/Lake+Willoughby+South+Beach,+VT-5A,+Westmore,+VT/Craftsbury+Common,+VT/1521+Barr+Hill+Rd,+Greensboro,+VT/Fisher+Covered+Railroad+Bridge,+Wolcott,+VT/1592+Center+Rd,+Hyde+Park,+VT/" target="_blank" rel="noopener">Open loop directions</a></div>
<div class="loop" style="--c:var(--class-5)"><h3>Sunday — covered bridges home</h3>
<a href="https://www.google.com/maps/dir/1592+Center+Rd,+Hyde+Park,+VT/Cambridge+Junction+Covered+Bridge,+Cambridge,+VT/Gates+Farm+Covered+Bridge,+Cambridge,+VT/Longley+Covered+Bridge,+Montgomery,+VT/Comstock+Covered+Bridge,+Montgomery,+VT/Fuller+Covered+Bridge,+Montgomery,+VT/Enosburg+Falls,+VT/Swanton,+VT/Highgate+Springs,+VT/" target="_blank" rel="noopener">Open route directions</a></div>
<div class="loop" style="--c:var(--class-6)"><h3>Backup — Two Gaps</h3>
<a href="https://www.google.com/maps/dir/1592+Center+Rd,+Hyde+Park,+VT/Great+Eddy+Covered+Bridge,+Waitsfield,+VT/Warren+Falls,+Warren,+VT/Lincoln+Gap+Road,+Warren,+VT/Appalachian+Gap,+VT-17,+Buels+Gore,+VT/Waitsfield,+VT/1592+Center+Rd,+Hyde+Park,+VT/" target="_blank" rel="noopener">Open loop directions</a></div>
</div></div></section>

<section id="files"><div class="wrap">
<h2>Files</h2>
<p class="lede"><b>vermont-pins.kml</b> — import into Google My Maps (Create New Map, Import) for a
real pin map, foldered by day, with scores and trail data in every pin description.
<b>vermont-pins.csv</b> is the same data if you prefer CSV import.</p>
<p class="muted"><b>PLAN.md</b> the full itinerary · <b>MASTER-TABLE.md</b> this table in markdown ·
<b>MASTER-MAP-AND-SCORES.md</b> time budgets and scoring rationale ·
<b>OPTIONS-viewpoints.md</b> drive-vs-hike analysis ·
<b>research-gaps-and-viewpoints.md</b> sources for everything above.</p>
</div></section>

<footer><div class="wrap">
Generated %DATE% from <span class="mono">pins-final.json</span>. Regenerate with
<span class="mono">python3 build_review.py &amp;&amp; python3 assemble_review.py</span>.
Scores are judgements, not facts — argue with them.
</div></footer>

<script>
(function(){
var tb=document.querySelector('#t tbody'),rows=[].slice.call(tb.rows),
    q=document.getElementById('q'),cnt=document.getElementById('count'),
    fs=[].slice.call(document.querySelectorAll('button.f')),
    lg=[].slice.call(document.querySelectorAll('.lg')),
    pins=[].slice.call(document.querySelectorAll('.pin'));
function on(b){return b.getAttribute('aria-pressed')==='true';}
function apply(){
  var term=(q.value||'').toLowerCase(),
      w=fs.filter(function(b){return on(b)&&b.dataset.w!==undefined;}).map(function(b){return b.dataset.w;}),
      s=fs.filter(function(b){return on(b)&&b.dataset.s;}).map(function(b){return +b.dataset.s;}),
      hide=fs.filter(function(b){return on(b)&&b.dataset.hide;}).map(function(b){return b.dataset.hide;}),
      minS=s.length?Math.max.apply(null,s):0,n=0;
  rows.forEach(function(r){
    var ok=true;
    if(term&&r.textContent.toLowerCase().indexOf(term)<0)ok=false;
    if(w.length&&w.indexOf(r.dataset.w)<0)ok=false;
    if(minS&&+r.dataset.s<minS)ok=false;
    if(hide.indexOf(r.dataset.g)>=0)ok=false;
    r.style.display=ok?'':'none';if(ok)n++;
  });
  cnt.textContent=n+' of '+rows.length+' shown';
}
q.addEventListener('input',apply);
fs.forEach(function(b){b.addEventListener('click',function(){
  if(b.dataset.w!==undefined)fs.forEach(function(o){if(o!==b&&o.dataset.w!==undefined)o.setAttribute('aria-pressed','false');});
  if(b.dataset.s)fs.forEach(function(o){if(o!==b&&o.dataset.s)o.setAttribute('aria-pressed','false');});
  b.setAttribute('aria-pressed',on(b)?'false':'true');apply();});});
lg.forEach(function(b){b.addEventListener('click',function(){
  b.setAttribute('aria-pressed',on(b)?'false':'true');
  var off=lg.filter(function(x){return !on(x);}).map(function(x){return x.dataset.g;});
  pins.forEach(function(p){p.classList.toggle('dim',off.indexOf(p.dataset.g)>=0);});});});
[].slice.call(document.querySelectorAll('#t th[data-t]')).forEach(function(th,i){
  th.addEventListener('click',function(){
    var dir=th.getAttribute('data-dir')==='asc'?'desc':'asc',t=th.dataset.t;
    [].slice.call(th.parentNode.children).forEach(function(o){o.removeAttribute('data-dir');});
    th.setAttribute('data-dir',dir);
    rows.sort(function(a,b){
      var x=a.cells[i],y=b.cells[i],va,vb;
      if(t==='v'){va=parseFloat(x.dataset.v!==undefined?x.dataset.v:x.textContent)||0;
                  vb=parseFloat(y.dataset.v!==undefined?y.dataset.v:y.textContent)||0;}
      else if(t==='n'){va=+x.textContent;vb=+y.textContent;}
      else{va=x.textContent.trim().toLowerCase();vb=y.textContent.trim().toLowerCase();}
      return (va<vb?-1:va>vb?1:0)*(dir==='asc'?1:-1);});
    rows.forEach(function(r){tb.appendChild(r);});});});
apply();
})();
</script>
</body></html>
"""
import datetime
out=(HTML.replace("%THEME%",theme).replace("%SVG%",P["svg"])
        .replace("%TBODY%",P["tbody"]).replace("%DATE%","7 September 2026"))
open("review.html","w").write(out)
print("review.html:",len(out),"bytes")
