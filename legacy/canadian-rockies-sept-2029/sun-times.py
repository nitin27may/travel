# Reference implementation: core/src/sun (TypeScript), CLI: node core/bin/sun.ts --lat .. --lon .. --zone .. --date ..
# Longitude is positive EAST in the NOAA formula below (Reykjavik -21.94, Bergen +5.32). Do not negate it.
# tools/tests/test_sun_scripts.py runs this script against values taken from core/src/sun.
import math, datetime

def solar_events(lat, lon, date, tz_offset_hours):
    # NOAA solar calculator (lon positive EAST), returns (sunrise, sunset, civil_dawn, civil_dusk, daylight_hours) local time
    def frac_year(d):
        return 2*math.pi/365.0*(d.timetuple().tm_yday-1)
    g = frac_year(date)
    eqtime = 229.18*(0.000075+0.001868*math.cos(g)-0.032077*math.sin(g)
                     -0.014615*math.cos(2*g)-0.040849*math.sin(2*g))
    decl = (0.006918-0.399912*math.cos(g)+0.070257*math.sin(g)
            -0.006758*math.cos(2*g)+0.000907*math.sin(2*g)
            -0.002697*math.cos(3*g)+0.00148*math.sin(3*g))
    def event(zenith_deg):
        z = math.radians(zenith_deg)
        la = math.radians(lat)
        cos_ha = (math.cos(z)/(math.cos(la)*math.cos(decl))) - math.tan(la)*math.tan(decl)
        if cos_ha < -1: return None  # never sets
        if cos_ha > 1: return "never"  # never rises
        ha = math.degrees(math.acos(cos_ha))
        sunrise = 720 - 4*(lon+ha) - eqtime
        sunset  = 720 - 4*(lon-ha) - eqtime
        return sunrise + tz_offset_hours*60, sunset + tz_offset_hours*60
    def fmt(m):
        m = m % 1440
        m = round(m)
        return f"{int(m//60)%24:02d}:{int(m%60):02d}"
    r = event(90.833)
    c = event(96.0)
    if r is None:
        return "MIDNIGHT SUN (sun never sets)"
    sr, ss = r
    daylight = (ss-sr)/60.0
    if c is None:
        civ = "no civil twilight end (light all night)"
    else:
        civ = f"civil dawn {fmt(c[0])} / civil dusk {fmt(c[1])}"
    return f"sunrise {fmt(sr)}  sunset {fmt(ss)}  daylight {daylight:.2f} h  |  {civ}"

# Rockies bases; MDT is UTC-6 in September. Longitude positive EAST, so Canada is negative.
places = [
    ("Banff",              51.18, -115.57),
    ("Jasper",             52.87, -118.08),
    ("Lake Louise",        51.43, -116.18),
    ("Kananaskis Village", 50.93, -115.14),
]
for d in [datetime.date(2029,9,8), datetime.date(2029,9,11), datetime.date(2029,9,15),
          datetime.date(2029,9,18), datetime.date(2029,9,22)]:
    print("="*78)
    print(d.isoformat())
    for name, lat, lon in places:
        print(f"  {name:20s} {solar_events(lat, lon, d, -6)}")
