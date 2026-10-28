/* Helpers for the builder specs. The builder is plain scripts with top-level globals (S, U, A, find, render ...), so specs drive
   it through page.evaluate and then assert on the DOM the person sees. */
const DOLOMITES = ['ortisei', 'seceda', 'siusi', 'braies', 'funes'];

/** Open the builder, build the "week by air, Dolomites" demo plan and return with the editor showing. */
async function dolomitesPlan(page, base, opts = {}) {
  await page.goto(base + '/builder/?fast');
  await page.evaluate(({ nights, picks, when, extra }) => {
    U.ctx = null; chooseKind('weekair');
    S.picks = picks; S.stay = { ortisei: true }; S.nights = nights; S.nightsTouched = true;
    if (when) S.when = when;
    Object.assign(S, extra || {});
    S.plan = buildPlan(S, null); S.unfit = S.plan.unfit; S.cfg0 = cfgSig(S); S.checklist = defaultChecklist();
    S.title = titleOf(S); histReset('Built'); S.stage = 7; U.justBuilt = true; save(true); render();
  }, { nights: opts.nights ?? 6, picks: opts.picks || DOLOMITES, when: opts.when, extra: opts.extra });
}
/** The seeded trips (Algonquin weekend, Dolomites 10 days) are in proto.trips on first load; open one in the editor. */
async function openSeeded(page, base, index) {
  await page.goto(base + '/builder/?fast');
  const id = await page.evaluate((i) => ProtoContract.readTrips(localStorage)[i].id, index);
  await page.goto(base + '/builder/?fast&edit=' + id);
  return id;
}
/** Index of the first plan day that has at least `n` stops */
const dayWith = (page, n) => page.evaluate((k) => S.plan.days.findIndex((d) => d.items.length >= k), n);
const names = (page, d) => page.evaluate((i) => S.plan.days[i].items.map((x) => PL[x.pid].name), d);
const noHScroll = (page) => page.evaluate(() => ({ doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, body: document.body.scrollWidth - document.body.clientWidth, frame: (() => { const f = document.querySelector('#frame'); return f.scrollWidth - f.clientWidth; })(), bodyEl: (() => { const f = document.querySelector('#body'); return f.scrollWidth - f.clientWidth; })() }));
module.exports = { DOLOMITES, dolomitesPlan, openSeeded, dayWith, names, noHScroll };
