import sys,json,urllib.parse
sys.path.insert(0,'.')
import cm
L=json.load(open('photo-picks.json'))['picks']
files=sorted({x['file'] for p in L for x in p['photos']})
res={}
for i in range(0,len(files),40):
    b=files[i:i+40]
    q=urllib.parse.urlencode({"action":"query","format":"json","maxlag":"6","prop":"imageinfo|categories","iiprop":"size|mime|extmetadata","iiextmetadatafilter":"Artist|LicenseShortName","cllimit":"max","clshow":"!hidden","titles":"|".join(b)})
    d=cm.fetch_retry(f"{cm.API}?{q}")
    for pg in d['query']['pages'].values():
        ii=(pg.get('imageinfo') or [{}])[0]; md=ii.get('extmetadata',{})
        res[pg['title']]={'w':ii.get('width'),'lic':cm.clean(md.get('LicenseShortName',{}).get('value','')),'author':cm.clean(md.get('Artist',{}).get('value','')),'cats':[c['title'][9:] for c in pg.get('categories',[])]}
json.dump(res,open('verify-fresh-2026-10-25.json','w'),indent=1,ensure_ascii=False)
bad=0
for p in L:
    for x in p['photos']:
        r=res.get(x['file'])
        if not r or r['lic']!=x['licence'] or r['author']!=x['author'] or r['w']!=x['width'] or not cm.OK.match(r['lic']): print('DIFF',x['file']);bad+=1
print(len(files),'files; mismatch',bad)
