import json,sys,re,glob,math,urllib.parse
sys.path.insert(0,'.')
import cm
WT='/Users/nks/workspace/travel-wt/v2-DATA-D5a'
DRY = '--write' not in sys.argv
P=json.load(open('picks.json')); T=json.load(open('targets.json'))
SPECIAL={'johnston-canyon-walk':['part/legacy/canadian-rockies-sept-2029/sights/johnston-canyon#walk'],
 'larch-valley':['part/legacy/canadian-rockies-sept-2029/trails/larch-valley-sentinel-pass#larch-valley'],
 'tre-cime-di-lavaredo-loop':['place/tre-cime-di-lavaredo-loop'],
 'lake-agnes-tea-house':['legacy/canadian-rockies-sept-2029/trails/lake-agnes']}
byid={}
for t in T: byid.setdefault(t['id'],[]).append(t['ref'])
def refs_for(i): return SPECIAL.get(i) or byid.get(i,[])
def cache(path): return json.load(open(path))
def resolve(spec,q):
    if spec.startswith('t:'):
        _,k,n=spec.split(':'); d=cache(f'txt_{k}.json'); r=d['ok'][int(n)]; return r,{'method':'text search','query':d['query'],'key':k}
    if '@' in spec:
        k,n=(spec.split(':@') if ':@' in spec else (q,spec[1:])); d=cache(f'geo_{k}.json'); r=d['ok'][int(n)]
        return r,{'method':'geosearch','point':[d['lat'],d['lon']],'radius_m':d['radius'],'key':k,'dist_m':round(r['dist'])}
    # plain title: find in geo or text caches
    for f in glob.glob('geo_*.json')+glob.glob('txt_*.json'):
        d=cache(f)
        for r in d['ok']:
            if r['title']=='File:'+spec:
                if f.startswith('geo_'): return r,{'method':'geosearch','point':[d['lat'],d['lon']],'radius_m':d['radius'],'key':d['key'],'dist_m':round(r['dist'])}
                return r,{'method':'text search','query':d['query'],'key':d['key']}
    ii=cm.imageinfo(['File:'+spec]); r=cm.summarize('File:'+spec,ii['File:'+spec]); r['dist']=0; 
    return r,{'method':'text or geosearch result, looked up by title (see research note)','key':None}
LIC_OK=cm.OK
out=[];recmap={}
for key,p in P.items():
    if p['files'][0].startswith('REUSE:'): continue
    photos=[];led=[]
    for spec in p['files']:
        r,how=resolve(spec,p['q'])
        assert LIC_OK.match(r['lic']) and r['w']>=1600 and r['mime']=='image/jpeg', r
        fn=r['title']
        author=r['author'] or 'Unknown'
        photos.append({"file":fn,"licence":r['lic'],"author":author,"attribution":f"{author}, {r['lic']}, via Wikimedia Commons",
          "source_url":"https://commons.wikimedia.org/wiki/"+urllib.parse.quote(fn.replace(' ','_'),safe=':_(),'),"width":r['w'],"height":r['h']})
        led.append({"file":fn,"source_url":photos[-1]['source_url'],"author":author,"licence":r['lic'],"width":r['w'],"height":r['h'],"taken":r.get('date') or None,"geotag":r.get('coord') or {'lat':r.get('lat'),'lon':r.get('lon')} if (r.get('coord') or r.get('lat')) else None,"found_by":how})
    refs=[x for i in p['ids'] for x in refs_for(i)]
    if not refs: print('NO REF for',key,p['ids'])
    out.append({"pick":key,"stop_ids":p['ids'],"refs":refs,"searched_on":"2026-10-25","subject_check":p['subject'],"photos":led})
    for r in refs: recmap[r]=photos
# reuse
for key,p in P.items():
    if p['files'][0].startswith('REUSE:'):
        src=p['files'][0][6:]
        recmap['__reuse__'+key]=(src,[x for i in p['ids'] for x in refs_for(i)],p['subject'])
json.dump({'picks':out},open('ledger_picks.json','w'),indent=1,ensure_ascii=False)
print(len(out),'picks',len(recmap),'records')
# coverage
allt={t['ref']:t for t in T}
miss=[t for t in T if t['ref'] not in recmap and not any(isinstance(v,tuple) and t['ref'] in v[1] for v in recmap.values())]
print('uncovered target records:'); [print(' ',t['id'],t['ref']) for t in miss]
if not DRY:
    files={f:d for f,d in ((f,json.load(open(f))) for f in glob.glob(WT+'/data/capture/*/*.json')) if isinstance(d,dict) and d.get('schema')=='capture/1'}
    idx={}
    for f,d in files.items():
        for r in d['records']: idx[r['ref']]=(f,r)
    for ref,v in recmap.items():
        if ref.startswith('__reuse__'): continue
        f,r=idx[ref]; r['photos']=v
    for ref,v in list(recmap.items()):
        if ref.startswith('__reuse__'):
            src,refs,_=v
            ph=idx[src][1].get('photos') if src in idx else None
            if src=='larch': ph=recmap[SPECIAL['larch-valley'][0]]
            if src=='johnston': ph=recmap[SPECIAL['johnston-canyon-walk'][0]]
            for r in refs:
                idx[r][1]['photos']=ph
    for f,d in files.items():
        open(f,'w').write(json.dumps(d,indent=2,ensure_ascii=False)+"\n")
    print('written')
