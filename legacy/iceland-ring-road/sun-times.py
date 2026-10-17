import math, datetime

def solar_events(lat, lon, date, tz_offset_hours):
    # NOAA solar calculator, returns (sunrise, sunset, civil_dawn, civil_dusk, daylight_hours) local time
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

# Iceland is UTC+0 all year — no daylight saving, so tz_offset = 0.
places = [
    ("Reykjavik",        64.15, -21.94),
    ("Vik i Myrdal",     63.42, -19.01),
    ("Jokulsarlon",      64.05, -16.18),
    ("Hofn",             64.25, -15.21),
    ("Seydisfjordur",    65.26, -14.01),
    ("Myvatn",           65.64, -16.91),
    ("Akureyri",         65.68, -18.09),
    ("Grundarfjordur",   64.92, -23.25),
]
for d in [datetime.date(2027,8,28), datetime.date(2027,9,1), datetime.date(2027,9,4),
          datetime.date(2027,9,8),  datetime.date(2027,9,12), datetime.date(2027,9,15),
          datetime.date(2027,9,20), datetime.date(2027,7,15)]:
    print("="*90)
    print(d.isoformat(), d.strftime("%a"))
    for name, lat, lon in places:
        # NOAA convention: lon positive WEST. Iceland lons stored negative(east-convention) -> negate.
        print(f"  {name:18s} {solar_events(lat, -lon, d, 0)}")
