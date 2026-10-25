import sys,json,glob,urllib.parse
sys.path.insert(0,'.')
import picks,rank,cm
WT='/Users/nks/workspace/travel-wt/v2-DATA-D5b'
T=json.load(open('targets.json'))
led=[];gaps=[];byfile={}
def pick(i,s):
    _,rows=rank.cands(i)
    m=[r for r in rows if s.lower() in r['title'].lower()]
    m.sort(key=lambda r:len(r['title']))
    return m[0]
for i,(note,subs) in sorted(picks.P.items()):
    t=T[i]; photos=[];L=[]
    for s in subs:
        r=pick(i,s)
        assert cm.OK.match(r['lic']) and r['w']>=1600 and r['mime']=='image/jpeg',r
        author=r['author'] or 'Unknown'
        photos.append({"file":r['title'],"licence":r['lic'],"author":author,"attribution":f"{author}, {r['lic']}, via Wikimedia Commons","source_url":"https://commons.wikimedia.org/wiki/"+urllib.parse.quote(r['title'].replace(' ','_'),safe=':_(),'),"width":r['w'],"height":r['h']})
        gt=None
        if r.get('lat') is not None: gt={'lat':r['lat'],'lon':r['lon']}
        fb=({'method':'geosearch','point':[t['lat'],t['lon']],'radius_m':1500} if r['src']=='geo' else {'method':'text search','query':r['src'][4:]})
        L.append({"file":r['title'],"source_url":photos[-1]['source_url'],"author":author,"licence":r['lic'],"width":r['w'],"height":r['h'],"taken":r['date'] or None,"geotag":gt,"distance_from_record_point_m":(round(r['dist']) if 'dist' in r and gt else None),"found_by":fb})
    led.append({"target":i,"ref":t['ref'],"name":t['name'],"record_point":[t['lat'],t['lon']],"point_source":t['pt_src'],"searched_on":"2026-10-25","subject_check":note,"photos":L})
    byfile.setdefault(t['file'],{})[t['ref']]=photos
for i,(nm,tried,why) in sorted(picks.GAPS.items()):
    t=T[i]; gaps.append({"target":i,"ref":t['ref'],"name":t['name'],"status":"No licensed photo yet","searched_on":"2026-10-25","tried":tried,"why":why})
json.dump({"schema":"d5b-photo-picks/1","run":"DATA-D5b","searched_on":"2026-10-25","picks":led,"gaps":gaps},open('photo-picks.json','w'),indent=1,ensure_ascii=False)
if '--write' in sys.argv:
    for f,m in byfile.items():
        f=WT+'/'+f; d=json.load(open(f)); n=0
        for r in d['records']:
            if r['ref'] in m:
                assert not r.get('photos'); r['photos']=m[r['ref']]; n+=1
        assert n==len(m),(f,n,len(m))
        open(f,'w').write(json.dumps(d,indent=2,ensure_ascii=False)+"\n"); print('wrote',f,n)
print(len(led),'picks',len(gaps),'gaps')
