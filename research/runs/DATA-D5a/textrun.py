import sys,json,re
sys.path.insert(0,'.')
import cm
from kw import BAD
UNS=re.compile(r"unsplash|pexels",re.I)
def run(key,q):
    out=f"txt_{key}.json"
    import os
    if os.path.exists(out): return
    t=cm.textsearch(q,40) if True else []
    # retry on busy
    info=cm.imageinfo(t) if t else {}
    c=cm.coords(t) if t else {}
    rows=[]
    for x in t:
        s=cm.summarize(x,info.get(x,{})); s['coord']=c.get(x); rows.append(s)
    ok=[r for r in rows if r['mime']=='image/jpeg' and r['w']>=1600 and r['w']>r['h'] and cm.OK.match(r['lic']) and not UNS.search(r['title']+r['desc']) and not BAD.search(r['title'])]
    json.dump({"key":key,"query":q,"all":len(rows),"ok":ok,"rejected":[r for r in rows if r not in ok]},open(out,'w'),indent=1)
    print(key,len(rows),len(ok),flush=True)
for line in open('textq.txt'):
    line=line.strip()
    if not line: continue
    k,q=line.split('|',1); run(k,q)
print('TXDONE',flush=True)
