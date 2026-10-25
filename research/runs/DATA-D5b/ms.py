import sys,io,json
sys.path.insert(0,'.')
import cm, rank
from PIL import Image, ImageDraw
i=int(sys.argv[1]); off=int(sys.argv[2]) if len(sys.argv)>2 else 0
extra=sys.argv[3].split(',') if len(sys.argv)>3 and sys.argv[3] else None
T,rows=rank.cands(i,extra)
sel=rows[off:off+9]
tw,th,cols=400,280,3
nr=(len(sel)+cols-1)//cols
sh=Image.new('RGB',(cols*tw,nr*(th+16)),'white'); d=ImageDraw.Draw(sh)
print(T['name'],'total cands',len(rows),'shown',off,'-',off+len(sel))
for n,r in enumerate(sel):
    x,y=(n%cols)*tw,(n//cols)*(th+16)
    try:
        im=Image.open(io.BytesIO(cm.thumb(r['title'],400))).convert('RGB'); im.thumbnail((tw-4,th-2)); sh.paste(im,(x+2,y+16))
    except BaseException as e: d.text((x+4,y+20),'FAIL '+str(e)[:40],fill='red')
    d.text((x+4,y+2),f"{n} {r['title'][5:48]}",fill='black')
    print(n,r['score'],round(r.get('dist',-1)),r['w'],r['lic'],r['title'][5:60],'|',r['desc'][:60],'|',r['date'][:10],'|',r['src'][:30])
sh.save(f'sheets/s{i}_{off}.jpg',quality=80); print(f'sheets/s{i}_{off}.jpg')
