/* Date and season helpers (prototype). "Today" is fixed to 27 Oct 2026 unless the controls change the month. */
(function () {
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONFULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function iso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function days(a, b) { return Math.round((b - a) / 86400000); }
  function dm(d) { return d.getDate() + ' ' + MON[d.getMonth()]; }
  function dmy(d) { return dm(d) + ' ' + d.getFullYear(); }
  function mY(d) { return MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function dow(d) { return DOW[d.getDay()] + ' ' + dmy(d); }
  function inWindows(season, d) { return season.windows.some(function (w) { return d >= iso(w[0]) && d <= iso(w[1]); }); }
  function monthStatus(season, m) {
    if (!season || season.kind === 'none') return null;
    if (season.kind === 'allyear') return 'open';
    var s = new Date(2026, m, 1), e = new Date(2026, m + 1, 0), full = false, any = false;
    season.windows.forEach(function (w) { var a = iso(w[0]), b = iso(w[1]); if (a <= s && b >= e) full = true; if (a <= e && b >= s) any = true; });
    return full ? 'open' : any ? 'part' : 'closed';
  }
  function seasonLabel(season) { if (!season || season.kind === 'none') return null; return season.kind === 'allyear' ? 'Open all year' : season.label; }
  window.LIB = { MON: MON, MONFULL: MONFULL, iso: iso, days: days, dm: dm, dmy: dmy, mY: mY, dow: dow, inWindows: inWindows, monthStatus: monthStatus, seasonLabel: seasonLabel };
})();
