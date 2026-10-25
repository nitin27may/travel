import sys, json
sys.path.insert(0,'.')
import cm
from pathlib import Path
# usage: run_geo.py key lat lon [radius]
key, lat, lon = sys.argv[1], sys.argv[2], sys.argv[3]
rad = int(sys.argv[4]) if len(sys.argv)>4 else 1000
g = cm.geosearch(lat, lon, rad)
titles = [x["title"] for x in g]
info = cm.imageinfo(titles) if titles else {}
rows=[]
for x in g:
    s = cm.summarize(x["title"], info.get(x["title"],{}))
    s["dist"]=x["dist"]; s["lat"]=x["lat"]; s["lon"]=x["lon"]
    rows.append(s)
import re
BAD=re.compile(r"unsplash|pexels|flickr.*nc|\bNC\b",re.I)
ok=[r for r in rows if not BAD.search(r["title"]+r["desc"]) and r["mime"]=="image/jpeg" and r["w"]>=1600 and r["w"]>r["h"] and cm.OK.match(r["lic"]) ]
Path(f"geo_{key}.json").write_text(json.dumps({"key":key,"lat":lat,"lon":lon,"radius":rad,"all":len(rows),"ok":ok,"rejected":[r for r in rows if r not in ok]},indent=1))
print(key, "total",len(rows),"usable",len(ok))
for r in ok[:0]: print(f" {r['dist']:>5.0f}m {r['w']}x{r['h']} {r['lic']:<12} {r['title'][:70]} | {r['desc'][:60]}")
