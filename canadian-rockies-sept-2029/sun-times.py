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

places = [
    ("Bergen",        60.39,  5.32),
    ("Flam/Aurland",  60.86,  7.11),
    ("Alesund",       62.47,  6.15),
    ("Andalsnes",     62.57,  7.69),
    ("Loen/Stryn",    61.87,  6.85),
    ("Bodo",          67.28, 14.40),
    ("Reine, Lofoten",67.93, 13.09),
    ("Svolvaer",      68.23, 14.57),
    ("Tromso",        69.65, 18.96),
    ("Senja (Fjordgard)",69.44,17.65),
]
for d in [datetime.date(2028,6,24), datetime.date(2028,7,1), datetime.date(2028,7,8),
          datetime.date(2028,7,18), datetime.date(2028,7,29), datetime.date(2028,8,12)]:
    print("="*78)
    print(d.isoformat())
    for name, lat, lon in places:
        # NOAA convention: lon positive WEST -> pass -lon for east longitudes
        print(f"  {name:20s} {solar_events(lat, -lon, d, 2)}")
