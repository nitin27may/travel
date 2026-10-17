# Astronomical / nautical darkness windows — the aurora question.
# Reuses the NOAA solar geometry from sun-times.py. Iceland is UTC+0 year-round.
# Reference implementation: core/src/sun (TypeScript), CLI: node core/bin/sun.ts --lat .. --lon .. --zone .. --date ..
# Longitude is positive EAST in the NOAA formula below (Reykjavik -21.94, Bergen +5.32). Do not negate it.
# tools/tests/test_sun_scripts.py runs this script against values taken from core/src/sun.
import math, datetime

def hour_angle_event(lat, lon_east, date, zenith_deg, tz=0):
    g = 2*math.pi/365.0*(date.timetuple().tm_yday-1)
    eqtime = 229.18*(0.000075+0.001868*math.cos(g)-0.032077*math.sin(g)
                     -0.014615*math.cos(2*g)-0.040849*math.sin(2*g))
    decl = (0.006918-0.399912*math.cos(g)+0.070257*math.sin(g)
            -0.006758*math.cos(2*g)+0.000907*math.sin(2*g)
            -0.002697*math.cos(3*g)+0.00148*math.sin(3*g))
    z, la = math.radians(zenith_deg), math.radians(lat)
    cos_ha = (math.cos(z)/(math.cos(la)*math.cos(decl))) - math.tan(la)*math.tan(decl)
    if cos_ha < -1 or cos_ha > 1:
        return None
    ha = math.degrees(math.acos(cos_ha))
    return (720 - 4*(lon_east+ha) - eqtime + tz*60,
            720 - 4*(lon_east-ha) - eqtime + tz*60)

def fmt(m):
    m = round(m) % 1440
    return f"{int(m//60)%24:02d}:{int(m%60):02d}"

places = [("Reykjavik",64.15,-21.94), ("Myvatn",65.64,-16.91), ("Hofn",64.25,-15.21)]  # lon positive EAST
print(f"{'date':12s} {'place':11s} {'nautical dark (-12)':26s} {'astro dark (-18)':26s} hrs")
for d in [datetime.date(2027,8,28), datetime.date(2027,9,1), datetime.date(2027,9,4),
          datetime.date(2027,9,8), datetime.date(2027,9,12), datetime.date(2027,9,15)]:
    for name, lat, lon in places:
        n = hour_angle_event(lat, lon, d, 102.0)
        a = hour_angle_event(lat, lon, d, 108.0)
        ns = f"{fmt(n[1])} - {fmt(n[0])}" if n else "none (never dark)"
        if a:
            astro = f"{fmt(a[1])} - {fmt(a[0])}"
            hrs = ((a[0]+1440) - a[1])/60.0
            hrs = f"{hrs:.1f}"
        else:
            astro, hrs = "none (never fully dark)", "0"
        print(f"{d.isoformat():12s} {name:11s} {ns:26s} {astro:26s} {hrs}")
    print()
