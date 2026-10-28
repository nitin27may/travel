/* THROWAWAY prototype: "our Dolomites trip" as published days with versions (fixes B-F6: a copy keeps the published days and
   their versions A, B, C instead of being rebuilt from picks). PLACEHOLDER content, invented for the prototype.
   Place ids are keys of PL (builder/data.js). A day with `v` has versions; its items come from the chosen version. */
(function () {
  'use strict';
  var D = [
    { base: 'Ortisei', items: ['ortisei'] },
    { base: 'Ortisei', items: ['seceda'] },
    { base: 'Ortisei', v: { A: ['siusi'], B: ['carezza', 'funes'], C: ['gherdeina', 'otzi'] } },
    { base: 'Ortisei', items: ['funes', 'renon'] },
    { base: 'Cortina', items: ['pordoi', 'cortina'] },
    { base: 'Cortina', items: ['braies'] },
    { base: 'Cortina', v: { A: ['tre-cime'], B: ['misurina'], C: ['cinque'] } },
    { base: 'Cortina', items: ['lagazuoi'] },
    { base: 'Cortina', items: ['sorapis'] },
    { base: 'Cortina', items: ['dobbiaco'] }
  ];
  var WHY = {
    A: 'Our standard day: the full walk or lift',
    B: 'Shorter, with fewer steps and a nap-friendly pace',
    C: 'Rainy day: indoors or under cover'
  };
  window.OURS = {
    id: 'dolomites-trip', name: 'Dolomites', rev: '2026-10-20', revText: '20 Oct', start: '2027-07-13', nights: 9,
    days: D.map(function (d, i) { return { key: 'd' + (i + 1), n: i + 1, base: d.base, items: d.items, v: d.v || null }; }),
    why: WHY,
    // 0 = Sunday ... 6 = Saturday. Invented closing days, used for the Fix-level warning (W_HOURS)
    closedDays: { gherdeina: [1], otzi: [1] }
  };
})();
