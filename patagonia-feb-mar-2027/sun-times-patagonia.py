import math, datetime, sys
sys.path.insert(0,'/tmp')
def ev(lat, lon_w, date, tz):
    g = 2*math.pi/365.0*(date.timetuple().tm_yday-1)
    eq = 229.18*(0.000075+0.001868*math.cos(g)-0.032077*math.sin(g)-0.014615*math.cos(2*g)-0.040849*math.sin(2*g))
    d = (0.006918-0.399912*math.cos(g)+0.070257*math.sin(g)-0.006758*math.cos(2*g)+0.000907*math.sin(2*g)-0.002697*math.cos(3*g)+0.00148*math.sin(3*g))
    def e(z):
        z=math.radians(z); la=math.radians(lat)
        c=math.cos(z)/(math.cos(la)*math.cos(d))-math.tan(la)*math.tan(d)
        ha=math.degrees(math.acos(c))
        return 720-4*(lon_w+ha)-eq+tz*60, 720-4*(lon_w-ha)-eq+tz*60
    f=lambda m:"%02d:%02d"%(round(m)%1440//60,round(m)%60)
    r=e(90.833); c=e(96.0)
    return f"{f(c[0])} | {f(r[0])} | {f(r[1])} | {f(c[1])} | {(r[1]-r[0])/60:.2f}"
P=[("El Calafate",-50.34,72.28),("El Chalten",-49.33,72.89),("Ushuaia",-54.80,68.30),("Buenos Aires",-34.60,58.38)]
print("place | date | civil dawn | sunrise | sunset | civil dusk | daylight h")
for n,la,lo in P:
    d=datetime.date(2027,2,26)
    while d<=datetime.date(2027,3,11):
        print(n,"|",d,"|",ev(la,lo,d,-3)); d+=datetime.timedelta(1)
