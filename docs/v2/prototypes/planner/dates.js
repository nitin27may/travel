/* THROWAWAY prototype: the one date model the planner and the builder share.
   A trip's dates are one of three modes, stored in the contract shape (shared/contract.js `dates`) and mapped to the
   builder's `S.when` (builder.js / shared/engine.js whenInfo):
     exact  {from, to}                    <-> when {type:'dates', from, to}
     month  {month: 1..12}                <-> when {type:'month', month}
     flex   {month, flexible:true}        <-> when {type:'flex', month}   (a window around that month)
   Nights live on the trip, not in the dates, so switching mode never changes them; an exact range is from + nights.
   'Next weekend' and 'This weekend' (builder presets) are resolved to an exact range through ProtoEngine.whenInfo. */
(function () {
  'use strict';
  var C = window.ProtoContract;
  var MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function pad(n) { return String(n).padStart(2, '0'); }
  function localIso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(s, n) { var p = s.split('-').map(Number); var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function diffDays(a, b) { var x = a.split('-').map(Number), y = b.split('-').map(Number); return Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 864e5); }

  var D = window.PDates = {
    MN: MN,
    MODES: [['month', 'A month'], ['exact', 'Exact dates'], ['flex', 'Flexible']],
    addDays: addDays, diffDays: diffDays,
    monthNum: function (m) { return C.monthNumber(m); },
    modeOf: function (t) {
      var d = (t && t.dates) || {};
      if (d.from) return 'exact';
      if (d.flexible) return 'flex';
      return D.monthNum(d.month) ? 'month' : 'none';
    },
    /** the builder's S.when for a trip */
    whenOf: function (t) {
      var d = (t && t.dates) || {}, m = D.monthNum(d.month), mode = D.modeOf(t);
      if (mode === 'exact') return { type: 'dates', from: d.from, to: d.to || d.from };
      if (mode === 'month') return { type: 'month', month: m };
      if (mode === 'flex') return m ? { type: 'flex', month: m } : { type: 'flex' };
      return { type: 'unsure' };
    },
    /** contract dates from a builder `when` (next/this resolve to an exact range) */
    fromWhen: function (when) {
      var w = when || {};
      if (w.type === 'next' || w.type === 'this') { var r = D.resolve(w.type); return { from: r.from, to: r.to }; }
      if (w.type === 'dates' && w.from) return { from: w.from, to: w.to || w.from };
      if (w.type === 'month' && w.month) return { month: +w.month };
      if (w.type === 'flex') return w.month ? { month: +w.month, flexible: true } : { flexible: true };
      return {};
    },
    /** 'next' | 'this' weekend as {from,to} ISO dates, from the same engine call the builder uses */
    resolve: function (type) {
      var w = window.ProtoEngine.whenInfo({ when: { type: type } });
      return { from: localIso(w.from), to: localIso(w.to) };
    },
    /** dates for a mode. opts: {from, nights, month}. Nights are only used to place the end of an exact range. */
    datesFor: function (mode, o) {
      if (mode === 'exact' && o.from) return { from: o.from, to: addDays(o.from, Math.max(0, o.nights | 0)) };
      if (mode === 'month' && o.month) return { month: +o.month };
      if (mode === 'flex') return o.month ? { month: +o.month, flexible: true } : { flexible: true };
      return {};
    },
    /** defaults for switching to `mode` from the trip's current dates; `today` is YYYY-MM-DD */
    seedFor: function (t, today) {
      var d = (t && t.dates) || {}, m = D.monthNum(d.month) || (d.from ? +d.from.slice(5, 7) : +today.slice(5, 7));
      var y = +today.slice(0, 4);
      var from = d.from || (y + (m < +today.slice(5, 7) ? 1 : 0)) + '-' + pad(m) + '-01';
      return { from: from, month: m };
    },
    label: function (t) {
      var d = (t && t.dates) || {}, m = D.monthNum(d.month), mode = D.modeOf(t);
      if (mode === 'month') return MN[m - 1];
      if (mode === 'flex') return m ? 'Around ' + MN[m - 1] : 'Flexible';
      return '';
    }
  };
})();
