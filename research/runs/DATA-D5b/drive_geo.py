import sys, json, re
sys.path.insert(0,'.')
import cm
from pathlib import Path
T=json.load(open('targets.json'))
RAD=1500
only=[int(x) for x in sys.argv[1:]]
for i,t in enumerate(T):
    if only and i not in only: continue
    out=Path(f"geo_{i}.json")
    if out.exists(): continue
    g=cm.geosearch(t['lat'],t['lon'],RAD)
    titles=[x['title'] for x in g]
    info=cm.imageinfo(titles) if titles else {}
    rows=[]
    for x in g:
        s=cm.summarize(x['title'],info.get(x['title'],{})); s['dist']=x['dist']; s['lat']=x['lat']; s['lon']=x['lon']; rows.append(s)
    BAD=re.compile(r"unsplash|pexels",re.I)
    ok=[r for r in rows if not BAD.search(r['title']+r['desc']) and r['mime']=='image/jpeg' and r['w']>=1600 and r['w']>r['h'] and cm.OK.match(r['lic'])]
    out.write_text(json.dumps({"key":i,"name":t['name'],"lat":t['lat'],"lon":t['lon'],"radius":RAD,"all":len(rows),"ok":ok,"rejected":[r for r in rows if r not in ok]},indent=1))
    print(i,t['name'],len(rows),len(ok),flush=True)
print('GEODONE')
