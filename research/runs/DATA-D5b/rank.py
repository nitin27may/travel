import json,re,sys,math,glob
sys.path.insert(0,'.')
STOP=set("trail loop walk the of to via and de di del la los las lake lago laguna a in from at on viewpoint section path falls fall".split())
def toks(name):
    n=re.sub(r"\(.*?\)","",name.lower()); n=re.sub(r"[^a-zà-ÿ ]"," ",n)
    return [w for w in n.split() if w not in STOP and len(w)>2]
def hav(a,b,c,d):
    R=6371.0;p=math.pi/180
    x=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 2*R*math.asin(math.sqrt(x))
def load(i):
    T=json.load(open('targets.json'))[i]
    g=json.load(open(f'geo_{i}.json'))
    ex=[json.load(open(f)) for f in glob.glob(f'txt_{i}_*.json')]
    return T,g,ex
def cands(i,extra_kw=None):
    T,g,ex=load(i); kw=toks(T['name'])+(extra_kw or [])
    rows=[]
    seen=set()
    for r in g['ok']:
        r=dict(r); r['src']='geo'; rows.append(r); seen.add(r['title'])
    for d in ex:
        for r in d['ok']:
            if r['title'] in seen: continue
            seen.add(r['title']); r=dict(r); r['src']='txt:'+d['query']
            c=r.get('coord')
            if c: r['lat'],r['lon']=c; r['dist']=hav(T['lat'],T['lon'],c[0],c[1])*1000
            rows.append(r)
    for r in rows:
        s=(r['title']+' '+r['desc']).lower()
        r['score']=sum(1 for k in kw if k in s)
    rows.sort(key=lambda r:(-r['score'],r.get('dist',99999)))
    return T,rows
if __name__=='__main__':
    i=int(sys.argv[1]); T,rows=cands(i)
    print(T['name'],len(rows))
    for n,r in enumerate(rows[:int(sys.argv[2]) if len(sys.argv)>2 else 12]):
        print(n,r['score'],round(r.get('dist',-1)),r['w'],r['lic'],r['title'][5:70],'|',r['desc'][:70],'|',r['date'][:20])
