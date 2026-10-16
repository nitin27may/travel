#!/usr/bin/env python3
"""Generate review.html — decision-support page. Self-contained, no external JS."""
import json, math, html

rows = json.load(open("_build/pins-final.json"))
esc = html.escape

DAYCOL = {"Base":"var(--ink)","Thu":"var(--class-3)","Thu/Fri/Sat":"var(--class-3)",
 "Thu/Sun":"var(--class-3)","Fri":"var(--class-1)","Fri alt":"var(--class-1)",
 "Sat":"var(--class-4)","Sat opt":"var(--class-4)","Sun":"var(--class-5)",
 "Sun opt":"var(--class-5)","Backup":"var(--class-6)","Backup opt":"var(--class-6)",
 "Backup only":"var(--class-6)","Reserve":"var(--muted)"}
GROUP = {"Base":"base","Thu":"thu","Thu/Fri/Sat":"thu","Thu/Sun":"thu","Fri":"fri","Fri alt":"fri",
 "Sat":"sat","Sat opt":"sat","Sun":"sun","Sun opt":"sun","Backup":"backup","Backup opt":"backup",
 "Backup only":"backup","Reserve":"reserve"}

# ---------- SVG pin map ----------
pts=[r for r in rows if -73.5 < r["lon"] < -71.9 and 44.0 < r["lat"] < 45.1]
lats=[p["lat"] for p in pts]; lons=[p["lon"] for p in pts]
la0,la1=min(lats)-0.03,max(lats)+0.03; lo0,lo1=min(lons)-0.05,max(lons)+0.05
K=math.cos(math.radians((la0+la1)/2))
W,H=980,760
sx=W/((lo1-lo0)*K); sy=H/(la1-la0); s=min(sx,sy)
ox=(W-(lo1-lo0)*K*s)/2; oy=(H-(la1-la0)*s)/2
def xy(p):
    return (ox+(p["lon"]-lo0)*K*s, oy+(la1-p["lat"])*s)

svg=[f'<svg viewBox="0 0 {W} {H}" class="pinmap" role="img" aria-label="Map of all trip destinations">']
svg.append(f'<rect width="{W}" height="{H}" fill="var(--surface)"/>')
# graticule
lo=math.floor(lo0*4)/4
while lo<lo1:
    x=ox+(lo-lo0)*K*s
    if 0<x<W: svg.append(f'<line x1="{x:.0f}" y1="0" x2="{x:.0f}" y2="{H}" stroke="var(--line)" stroke-width="1"/><text x="{x+3:.0f}" y="{H-6}" class="grid">{lo:.2f}</text>')
    lo+=0.25
la=math.floor(la0*4)/4
while la<la1:
    y=oy+(la1-la)*s
    if 0<y<H: svg.append(f'<line x1="0" y1="{y:.0f}" x2="{W}" y2="{y:.0f}" stroke="var(--line)" stroke-width="1"/><text x="4" y="{y-4:.0f}" class="grid">{la:.2f}</text>')
    la+=0.25
# scale bar: 10 km
km10 = 10/111.1*s
svg.append(f'<line x1="{W-160}" y1="{H-40}" x2="{W-160+km10:.0f}" y2="{H-40}" stroke="var(--ink)" stroke-width="3"/>'
           f'<text x="{W-160}" y="{H-48}" class="grid">10 km</text>')
for r in sorted(pts,key=lambda r:-r["lat"]):
    x,y=xy(r); c=DAYCOL.get(r["day"],"var(--muted)")
    big = str(r["score"]).isdigit() and int(r["score"])>=9
    rad = 8 if big else 5.5
    svg.append(f'<a href="https://maps.google.com/?q={r["lat"]},{r["lon"]}" target="_blank" rel="noopener">'
               f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rad}" fill="{c}" stroke="var(--surface)" stroke-width="2" '
               f'class="pin" data-g="{GROUP.get(r["day"],"x")}"><title>{esc(r["name"])} — {r["day"]} — score {r["score"]}</title></circle></a>')
    if big:
        svg.append(f'<text x="{x+11:.0f}" y="{y+4:.0f}" class="lbl">{esc(r["name"].split(" (")[0].split(" —")[0])}</text>')
svg.append('</svg>')
SVG="\n".join(svg)

# ---------- table ----------
trs=[]
for i,r in enumerate(sorted(rows,key=lambda r:(list(GROUP).index(r["day"]) if r["day"] in GROUP else 99,r["name"])),1):
    sc=r["score"]; scn=int(sc) if str(sc).isdigit() else 0
    tw = "1" if r["trail"] in ("Yes","Stroll","Walk-through") else "0"
    kmv = str(r["km"]).split("-")[0]
    try: kmf=float(kmv)
    except: kmf=0
    cls="hi" if scn>=9 else ""
    trs.append(
     f'<tr data-g="{GROUP.get(r["day"],"x")}" data-w="{tw}" data-s="{scn}" class="{cls}">'
     f'<td class="num">{i}</td>'
     f'<td class="nm"><b>{esc(r["name"])}</b><span class="sub">{esc(r["note"])}</span></td>'
     f'<td><span class="chip" style="--c:{DAYCOL.get(r["day"],"var(--muted)")}">{esc(r["day"])}</span></td>'
     f'<td>{esc(r["cat"])}</td>'
     f'<td class="{"tw" if tw=="1" else "nw"}">{esc(r["trail"])}</td>'
     f'<td class="mono" data-v="{kmf}">{esc(r["km"])}</td>'
     f'<td class="mono">{esc(r["asc"])}</td>'
     f'<td class="mono">{esc(r["time"])}</td>'
     f'<td class="mono sc" data-v="{scn}">{esc(str(sc))}</td>'
     f'<td><a class="mp" href="https://maps.google.com/?q={r["lat"]},{r["lon"]}" target="_blank" rel="noopener">map</a></td></tr>')
TBODY="\n".join(trs)
json.dump({"n":len(rows)},open("/tmp/_c.json","w"))
open("_build/_review_parts.json","w").write(json.dumps({"svg":SVG,"tbody":TBODY}))
print("parts built:",len(rows),"rows,",len(pts),"mapped pins")
