import sys,io,json
sys.path.insert(0,'.')
import cm, rank
from PIL import Image, ImageDraw
# usage: cs.py out "idx=sub1|sub2|sub3" "idx=..."  (substring match on title, case-insens)
out=sys.argv[1]; items=[]
for g in sys.argv[2:]:
    i,subs=g.split('=',1); i=int(i); T,rows=rank.cands(i)
    for s in subs.split('|'):
        m=[r for r in rows if s.lower() in r['title'].lower()]
        if not m: print('NOMATCH',i,s); continue
        items.append((i,T,m[0]))
tw,th,cols=400,280,3
nr=(len(items)+cols-1)//cols
sh=Image.new('RGB',(cols*tw,nr*(th+16)),'white'); d=ImageDraw.Draw(sh)
for n,(i,T,r) in enumerate(items):
    x,y=(n%cols)*tw,(n//cols)*(th+16)
    try:
        im=Image.open(io.BytesIO(cm.thumb(r['title'],400))).convert('RGB'); im.thumbnail((tw-4,th-2)); sh.paste(im,(x+2,y+16))
    except BaseException as e: d.text((x+4,y+20),'FAIL '+str(e)[:40],fill='red')
    d.text((x+4,y+2),f"{n}: t{i} {r['title'][5:44]}",fill='black')
    print(n,f"t{i}",T['name'][:20],'|',r['title'][5:70],'|',r['w'],r['lic'],'|d',round(r.get('dist',-1)),'|',r['date'][:10])
sh.save(out,quality=80); print(out)
