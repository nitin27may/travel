/* Sun times for the prototypes: a plain-JS port of core/src/sun/index.ts (NOAA-style fit, 365-day year).
   Longitude is positive EAST (Reykjavik is -21.94). Times are minutes after local midnight in the IANA zone, with that
   date's UTC offset read through Intl (daylight saving included). Tested against `node core/bin/sun.ts` in tests/sun.test.js.
   Browser: window.ProtoSun. Node: require('./sun.js'). */
(function (root) {
  'use strict';
  var RAD = Math.PI / 180;
  var ZENITH = { sunrise: 90.833, civil: 96, nautical: 102, astronomical: 108 };

  function zoneOffsetMin(zone, at) {
    var parts = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(at);
    var tz = parts.filter(function (p) { return p.type === 'timeZoneName'; })[0];
    var m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(tz ? tz.value : 'GMT');
    if (!m) return 0;
    return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
  }
  function dayOfYear(iso) {
    var p = iso.split('-').map(Number);
    return Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(p[0], 0, 1)) / 86400000) + 1;
  }
  function solarTerms(iso) {
    var g = (2 * Math.PI / 365) * (dayOfYear(iso) - 1);
    var eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    return { eqtime: eqtime, decl: decl };
  }
  function offsetOn(zone, iso, lon) {
    var p = iso.split('-').map(Number);
    return zoneOffsetMin(zone, new Date(Date.UTC(p[0], p[1] - 1, p[2], 12) - Math.round(lon * 4) * 60000));
  }
  /** {kind:'normal',rise,set} | {kind:'never-sets'} | {kind:'never-rises'}; minutes after local midnight, may fall outside 0..1440 */
  function solarEvent(lat, lon, iso, zenithDeg, tzOffsetMin) {
    var t = solarTerms(iso), la = lat * RAD;
    var cosHa = Math.cos(zenithDeg * RAD) / (Math.cos(la) * Math.cos(t.decl)) - Math.tan(la) * Math.tan(t.decl);
    if (cosHa < -1) return { kind: 'never-sets' };
    if (cosHa > 1) return { kind: 'never-rises' };
    var ha = Math.acos(cosHa) / RAD;
    return { kind: 'normal', rise: 720 - 4 * (lon + ha) - t.eqtime + tzOffsetMin, set: 720 - 4 * (lon - ha) - t.eqtime + tzOffsetMin };
  }
  function sunDay(lat, lon, iso, zone) {
    var off = offsetOn(zone, iso, lon);
    return {
      sunrise: solarEvent(lat, lon, iso, ZENITH.sunrise, off),
      civil: solarEvent(lat, lon, iso, ZENITH.civil, off),
      nautical: solarEvent(lat, lon, iso, ZENITH.nautical, off),
      astronomical: solarEvent(lat, lon, iso, ZENITH.astronomical, off)
    };
  }
  /** "HH:MM", rounded to the minute and wrapped into one day */
  function fmtClock(min) {
    var m = ((Math.round(min) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  /** {sunrise:'HH:MM', sunset:'HH:MM', riseMin, setMin} or null when the sun never rises or never sets that day */
  function sunFor(lat, lon, iso, zone) {
    var e = solarEvent(lat, lon, iso, ZENITH.sunrise, offsetOn(zone, iso, lon));
    if (e.kind !== 'normal') return null;
    return { sunrise: fmtClock(e.rise), sunset: fmtClock(e.set), riseMin: e.rise, setMin: e.set };
  }
  /** The same record as `node core/bin/sun.ts --json`, for tests */
  function report(lat, lon, zone, iso) {
    var d = sunDay(lat, lon, iso, zone);
    function rise(e) { return e.kind === 'normal' ? fmtClock(e.rise) : null; }
    function set(e) { return e.kind === 'normal' ? fmtClock(e.set) : null; }
    return { date: iso, sunrise: rise(d.sunrise), sunset: set(d.sunrise), civilDawn: rise(d.civil), civilDusk: set(d.civil),
      sunState: d.sunrise.kind === 'normal' ? 'normal' : d.sunrise.kind === 'never-sets' ? 'never sets' : 'never rises' };
  }
  /** true when an activity ending at endMin (minutes after midnight) ends after sunset minus marginMin (default 30). False when there is no sunset to compare. */
  function endsAfterSunset(lat, lon, iso, zone, endMin, marginMin) {
    var s = sunFor(lat, lon, iso, zone);
    return !!s && endMin > s.setMin - (marginMin == null ? 30 : marginMin);
  }

  var api = { ZENITH: ZENITH, zoneOffsetMin: zoneOffsetMin, solarTerms: solarTerms, offsetOn: offsetOn, solarEvent: solarEvent, sunDay: sunDay, fmtClock: fmtClock, sunFor: sunFor, report: report, endsAfterSunset: endsAfterSunset };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ProtoSun = api;
})(typeof window !== 'undefined' ? window : globalThis);
