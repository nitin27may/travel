import sys,json,urllib.parse,time,re
sys.path.insert(0,'.')
import cm
L=json.load(open('ledger_picks.json'))['picks']
files=sorted({x['file'] for p in L for x in p['photos']})
print(len(files),'unique files')
res={}
for i in range(0,len(files),40):
    b=files[i:i+40]
    q=urllib.parse.urlencode({"action":"query","format":"json","maxlag":"6","prop":"imageinfo|categories","iiprop":"size|mime|extmetadata","iiextmetadatafilter":"Artist|LicenseShortName","cllimit":"max","clshow":"!hidden","titles":"|".join(b)})
    d=cm.fetch_retry(f"{cm.API}?{q}")
    for pg in d['query']['pages'].values():
        ii=(pg.get('imageinfo') or [{}])[0]
        md=ii.get('extmetadata',{})
        res[pg['title']]={'w':ii.get('width'),'h':ii.get('height'),'lic':cm.clean(md.get('LicenseShortName',{}).get('value','')),'author':cm.clean(md.get('Artist',{}).get('value','')),'cats':[c['title'][9:] for c in pg.get('categories',[])]}
json.dump(res,open('verify_fresh.json','w'),indent=1,ensure_ascii=False)
bad=0
for p in L:
    for x in p['photos']:
        r=res.get(x['file'])
        if not r: print('MISSING',x['file']);bad+=1;continue
        if r['lic']!=x['licence'] or r['author']!=x['author'] or r['w']!=x['width'] or not cm.OK.match(r['lic']):
            print('DIFF',x['file'],r['lic'],x['licence'],r['author'][:30],x['author'][:30],r['w'],x['width']);bad+=1
print('mismatch',bad)
