/* Desktop layouts of the Trip Builder prototype (1024 px and wider; the phone layout below is builder.js alone).
   Same state S, same actions A, same URL contract; this file only builds the HTML of each stage for a wide screen: a step rail
   (stages 0 to 4 and "Your plan"), then columns that use the width (wireframes-desktop W0 to W8, WE, WC). Classic script: it
   shares the globals of builder.js (S, U, A, SH, ic, esc, stage helpers). render() calls dscreen() when isDesk(). */
'use strict';
const dwrap = (inner, cls = '') => `<div class="dwrap ${cls}">${inner}</div>`;

/* ---------- the step rail: done, current and upcoming; Back at the left, the primary action at the right end ---------- */
function railNodes() { return [[0, 'Kind'], [1, 'Start'], [2, 'Where'], [3, 'Pick'], [4, 'Days and driving'], [7, 'Your plan']]; }
function railVal(n) {
  if (n === 0) return S.kind && U.marked ? KINDS[S.kind].label : '';
  if (n === 1) return S.kind ? S.origin.name + ' · ' + whenLabel(S) : '';
  if (n === 2) return S.kind ? (isNear() ? S.reachH + ' h reach' : destName()) : '';
  if (n === 3) return S.picks.length ? S.picks.length + ' picked' : '';
  if (n === 4) return S.kind ? S.nights + (S.nights === 1 ? ' night' : ' nights') : '';
  if (n === 7) return S.plan ? S.plan.days.length + ' days' : '';
  return '';
}
function railPrimary() {
  const s = S.stage;
  if (s === 0) return { l: 'Pick a kind of trip', dis: true };
  if (s === 3) return { l: S.kind === 'day' ? 'Build my day' : 'Next: ' + ({ 4: 'Days and driving' }[nextOf(3)] || 'Build my days'), dis: !S.picks.length };
  if (s === 4) return { l: 'Build my days' };
  if (s === 5) return null;
  const n = nextOf(s);
  return { l: 'Next: ' + (stageName(n) || 'Build my days') };
}
/* every stage has a node; stages the kind does not ask are "skipped" (muted, not clickable) unless you are on one (deep link) */
function rail() {
  const cur = S.stage === 5 ? 7 : S.stage, nodes = railNodes(), ci = nodes.findIndex((x) => x[0] === cur), pr = railPrimary(), asks = asked();
  const kindName = S.kind ? KINDS[S.kind].label.toLowerCase() : 'this trip';
  const back = S.stage > 0 && S.stage < 5;
  return `<div class="drail"><div class="drail-in"><button class="btn drail-back" data-a="back" ${back ? '' : 'disabled'} aria-label="Back">${ic('back')} Back</button>
  <nav aria-label="Trip steps"><ol class="dsteps">${nodes.map(([n, l], i) => { const skip = n >= 1 && n <= 4 && !asks.includes(n) && S.kind; const st = n === cur ? 'cur' : skip ? 'skip' : i < ci ? 'done' : 'up'; const v = skip && n !== cur ? 'Skipped' : railVal(n);
    return `<li><button class="dstep ${st}" ${st === 'skip' ? `disabled aria-disabled="true" title="Not needed for a ${esc(kindName)}"` : `data-a="go" data-v="${n}"`} ${st === 'cur' ? 'aria-current="step"' : ''}><span class="dn">${st === 'done' ? ic('check', 's') : i + 1}</span><span class="dt"><b>${l}</b><small>${esc(v || (st === 'up' ? 'Not yet' : ''))}</small></span></button></li>`; }).join('')}</ol></nav>
  ${pr ? `<button class="btn pri drail-next" data-a="${S.stage === 4 ? 'build' : 'next'}" ${pr.dis ? 'disabled' : ''}>${pr.l}</button>` : '<span class="drail-next"></span>'}</div></div>`;
}

/* ---------- stage 0: Kind (3 x 2 tiles) with the other ways in at the side ---------- */
function d0() {
  const d = drafts(), sv = savedSlugs();
  const tiles = Object.keys(KINDS).map((k) => `<button class="tile ${S && S.kind === k && U.marked ? 'on' : ''}" data-a="kind" data-v="${k}"><span class="ico">${ic(KINDS[k].mode === 'trip' ? 'plane' : 'car')}</span><span class="grow"><b>${KINDS[k].label}</b><small>${KINDS[k].meta}</small></span>${ic('chev')}</button>`).join('');
  const rows = d.slice(-3).reverse().map((x) => `<button class="mrow" data-a="resume" data-v="${x.id}"><span class="idsq" style="background:${x.identity};margin:0"></span><span class="tx"><span class="title">${esc(x.title || 'Untitled')}</span><span class="meta" style="display:block">${x.n ? x.n + ' places · ' : ''}${x.state}</span></span>${ic('chev')}</button>`).join('');
  const cap = U.flags.capped ? `<div class="note crit">${ic('warn', 's')}<span>20 plans on this device. Delete one or sign in to keep more. <button class="btn sm" data-a="sheet" data-v="drafts">Open Mine</button></span></div>` : '';
  return dwrap(`<h1 class="dh">Plan a trip</h1><p class="dsub">What kind of trip? Pick one; the rest is pre-filled and you can change it on the next step.</p>${cap}
  <section aria-label="Kinds of trip"><div class="tilegrid">${tiles}</div></section>
  <aside class="d0more" aria-label="Other ways in"><section><h2 class="dcap">Your plans</h2>${d.length ? `<div class="dlist">${rows}</div><div class="flex g12 wrap"><button class="lnk" data-a="sheet" data-v="drafts">Resume a draft</button><a class="lnk" href="/planner/index.html">All plans in Mine</a></div>` : '<p class="small">No plans yet. Your plans save on this device as you go.</p>'}</section>
  <section><h2 class="dcap">Or start from</h2><div class="dlist"><button class="mrow" data-a="sheet" data-v="saved"><span class="tx title">A place you saved</span>${ic('chev')}</button><button class="mrow" data-a="sheet" data-v="ours"><span class="tx title">One of our trips</span>${ic('chev')}</button><button class="mrow" data-a="surprise"><span class="tx title">Surprise me</span>${ic('chev')}</button></div></section>
  <section><h2 class="dcap">From your saved places</h2>${sv.length ? '' : '<p class="small">Nothing saved yet. Save parks and places in the parks prototype.</p>'}<div class="chips">${sv.map((x) => `<button class="pill sm" data-a="fromSaved" data-v="${esc(x)}">${ic('star', 's')}${esc(savedName(x))}</button>`).join('')}</div></section></aside>`);
}

/* ---------- stage 1: Start (three columns and a summary column) ---------- */
function partyInline() {
  const rows = S.party.map((t, i) => `<div class="prow2" role="group" aria-label="Traveller ${i + 1}">
   <span class="fld pname"><input data-i="tname" data-v="${t.id}" value="${esc(t.name)}" placeholder="Name (optional)" aria-label="Name of traveller ${i + 1}"></span>
   <span class="seg g4">${['adult', 'child', 'infant'].map((ty) => `<button class="pill sm ${t.type === ty ? 'on' : ''}" data-a="ttype" data-v="${t.id}:${ty}" aria-pressed="${t.type === ty}">${ty[0].toUpperCase() + ty.slice(1)}</button>`).join('')}</span>
   ${t.type === 'child' ? `<span class="flex g4"><button class="btn sm" data-a="tage" data-v="${t.id}:-1" aria-label="Younger">${ic('minus', 's')}</button><span class="title agev">Age ${t.age}</span><button class="btn sm" data-a="tage" data-v="${t.id}:1" aria-label="Older">${ic('plus', 's')}</button></span>` : ''}
   <span class="seg g4">${[['stroller', 'Stroller'], ['stepfree', 'Step-free'], ['dog', 'Dog'], ['first', 'First-timer']].map(([k, l]) => `<button class="pill sm ${(t.needs || []).includes(k) ? 'on' : ''}" data-a="tneed" data-v="${t.id}:${k}" role="checkbox" aria-checked="${(t.needs || []).includes(k)}">${l}</button>`).join('')}</span>
   <button class="ib ${t.decider ? 'deciding' : ''}" data-a="tdec" data-v="${t.id}" role="switch" aria-checked="${!!t.decider}" aria-label="Deciding traveller" title="Deciding: leads this plan">${ic('star')}</button>
   ${S.party.length > 1 ? `<button class="ib" data-a="tdel" data-v="${t.id}" aria-label="Remove traveller ${i + 1}">${ic('trash')}</button>` : ''}</div>`).join('');
  return `<div class="ptable">${rows}<div class="prow2 padd"><span class="small">Add</span>${['adult', 'child', 'infant'].map((ty) => `<button class="btn sm" data-a="tadd" data-v="${ty}">${ic('plus', 's')} ${ty[0].toUpperCase() + ty.slice(1)}</button>`).join('')}</div></div><p class="small" style="margin:8px 0 0">Your party stays on this device. A shared link never carries it.</p>`;
}
function calInline() {
  if (!U.cal) initCal();
  const r = SH.dates(); const foot = (r.f || '').replace(/<\/?footer>/g, '');
  return `<div class="dcal">${r.b}<div class="flex g8 wrap" style="padding:0 12px 4px">${foot}</div></div>`;
}
function reachInline() {
  if (!isNear()) return '';
  const n = allCandidates(S).length;
  return `<h3 class="dcap">Longest drive from home, each way</h3><div class="seg" role="group" aria-label="Reach">${[2, 3, 4, 6, 8].map((h) => `<button class="pill ${S.reachH === h ? 'on' : ''}" data-a="reach" data-v="${h}" aria-pressed="${S.reachH === h}">${h} h</button>`).join('')}</div>
  <p class="title" style="margin:12px 0 4px">${n} place${n === 1 ? '' : 's'} within ${S.reachH} h ≈ of ${esc(S.origin.name)}</p>${n <= 5 ? `<button class="lnk sm" data-a="ask" data-v="region|Near ${esc(S.origin.name)}">${n ? 'So far. ' : ''}Ask us for more</button>` : ''}`;
}
function d1() {
  const near = isNear(), w = S.when;
  const chips = ['toronto', 'hamilton', 'ottawa', 'montreal', 'milan'].map((id) => { const c = CITIES.find((x) => x.id === id); return `<button class="pill sm ${S.origin.id === id ? 'on' : ''}" data-a="city" data-v="${id}">${c.name}</button>`; }).join('');
  const dateChips = `<div class="seg">${near && (S.kind === 'day' || S.kind === 'weekend') ? `<button class="pill ${w.type === 'next' ? 'on' : ''}" data-a="when" data-v="next">Next weekend</button><button class="pill ${w.type === 'this' ? 'on' : ''}" data-a="when" data-v="this">This weekend</button>` : ''}
   <button class="pill ${w.type === 'month' ? 'on' : ''}" data-a="sheet" data-v="month">${w.type === 'month' ? MONTHS[w.month - 1] : 'A month'} ${ic('down', 's')}</button>
   <button class="pill ${w.type === 'dates' ? 'on' : ''}" data-a="deskDates">Exact dates</button>
   <button class="pill ${w.type === 'flex' ? 'on' : ''}" data-a="when" data-v="flex">Flexible</button>
   <button class="pill ${w.type === 'unsure' ? 'on' : ''}" data-a="when" data-v="unsure">Not sure yet</button></div>`;
  const left = `<section class="dcard" aria-label="From where"><h2 class="dcap">Starting from</h2>${originField()}
   <div class="meta" style="margin-top:6px">${esc(S.origin.name)}, ${esc(S.origin.sub)}${S.origin.hub ? ' · public hub' : ''}${S.locOn ? ' · from your location' : ''}</div>
   <div class="chips" style="margin-top:8px">${chips}</div><div style="margin-top:4px">${U.locBusy ? '<span class="meta">Finding you…</span>' : `<button class="lnk sm" data-a="useloc">${ic('loc', 's')} Use my location (stays on this device)</button>`}</div>
   ${U.locErr ? `<div class="note crit">${ic('warn', 's')}<span>We could not use your location. Pick a town or airport.</span></div>` : ''}${!near ? airportLine() : ''}
   <h3 class="dcap" style="margin-top:16px">What to expect</h3>${hintBlock()}<div style="margin-top:8px">${kindCheck()}</div><h3 class="dcap" style="margin-top:16px">Because of your party</h3>${partyBox()}</section>`;
  const who = `<section class="dcard dwho" aria-label="Who is going"><h2 class="dcap">Who is going</h2>${partyInline()}</section>`;
  const when = `<section class="dcard" aria-label="When"><h2 class="dcap">When?</h2>${dateChips}${w.type === 'dates' ? calInline() : '<p class="small" style="margin:10px 0 0">Choose exact dates to see a calendar here. A month or a weekend works too; Next works without a date.</p>'}</section>`;
  const side = `<aside class="dside dsum" aria-label="Summary">${S.area ? farCard() : ''}${near ? '' : `<h2 class="dcap">Your trip</h2><p class="small" style="margin:0">${esc(destName())} · ${esc(whenLabel(S))} · ${esc(partyLabel(S))}</p>`}${reachInline()}</aside>`;
  return dwrap(`<h1 class="dh">${KINDS[S.kind].label}: where from, who and when</h1><div class="d1grid">${left}${when}${side}${who}</div>`);
}

/* ---------- stage 2: Where (regions as a card grid, map beside it) ---------- */
function d2() {
  let left;
  if (isNear()) {
    const n = allCandidates(S).length;
    left = `${farCard()}<section class="dcard"><h2 class="dcap">Longest drive from home, each way</h2><div class="seg">${[2, 3, 4, 6, 8].map((h) => `<button class="pill ${S.reachH === h ? 'on' : ''}" data-a="reach" data-v="${h}" aria-pressed="${S.reachH === h}">${h} h</button>`).join('')}</div>
    <p class="title" style="margin:14px 0 8px">Within ${S.reachH} h ≈ of ${esc(S.origin.name)}: ${n} place${n === 1 ? '' : 's'}</p>
    ${n === 0 ? `<div class="note warn">${ic('warn', 's')}<span>Nothing we hold within ${S.reachH} h of ${esc(S.origin.name)}. <button class="lnk sm" data-a="reach" data-v="${Math.min(8, S.reachH + 2)}">Try ${Math.min(8, S.reachH + 2)} h</button></span></div>` : `<h3 class="dcap">Narrow to (optional)</h3><div class="chips">${Object.keys(AREAS).filter((a) => PLACES.some((p) => p.area === a)).map((a) => { const c = PLACES.filter((p) => p.area === a && drive(S.origin, p) <= S.reachH * 60).length; return `<button class="pill sm ${S.areas.includes(a) ? 'on' : ''} ${c ? '' : 'later'}" data-a="${c ? 'area' : 'ask'}" data-v="${c ? a : 'region|' + AREAS[a]}">${AREAS[a]} ${c}${c ? '' : ' · Ask us'}</button>`; }).join('')}</div>`}</section>`;
  } else {
    const C = COUNTRIES[S.cc], macro = C.macros.find((m) => m.id === S.macro) || C.macros[0];
    const cnt = (r) => PLACES.filter((p) => p.reg === r).length, tot = (m) => m.regions.reduce((s, r) => s + cnt(r), 0);
    const card = (r) => { const R = REGIONS[r], c = cnt(r), on = S.regions.includes(r), lock = S.area && PARKS[S.area].reg !== r;
      return `<button class="rcard ${on ? 'on' : ''}" ${lock ? 'disabled' : ''} data-a="${c ? 'region' : 'ask'}" data-v="${c ? r : 'region|' + R.name}" role="checkbox" aria-checked="${on}"><span class="rtop"><span class="chk ${on ? 'on' : ''}">${on ? ic('check', 's') : ''}</span><b>${R.name}</b><span class="chip ${c >= 6 ? '' : c ? 'warn' : 'gap'}">${c >= 6 ? c + ' places' : c ? 'Thin: ' + c : '0'}</span></span>
       <span class="small">${c ? (R.note ? R.note : '') : 'Not researched yet. Ask us to research it'}</span><span class="meta">${c && R.gw.length ? 'Fly into ' + R.rec.concat(R.gw.filter((g) => !R.rec.includes(g))).slice(0, 2).join(' or ') + (R.car ? ' · ' + R.car : '') : ''}</span></button>`; };
    left = `<section class="dcard"><h2 class="dcap">Country</h2><div class="seg">${Object.keys(COUNTRIES).map((c) => `<button class="pill ${S.cc === c ? 'on' : ''}" data-a="country" data-v="${c}" aria-pressed="${S.cc === c}">${COUNTRIES[c].name}</button>`).join('')}<button class="pill later" data-a="ask" data-v="region|">Somewhere else · Ask us</button></div>
     ${S.area ? `<div class="note keep" style="margin-top:10px">${ic('pin', 's')}<span>Area pinned: ${esc(PARKS[S.area].name)}. The region is set by it.</span></div>` : ''}
     <h3 class="dcap" style="margin-top:16px">Area</h3><div class="seg">${C.macros.map((m) => `<button class="pill sm ${m.id === macro.id ? 'on' : ''}" data-a="macro" data-v="${m.id}" aria-pressed="${m.id === macro.id}">${m.name} ${tot(m)}</button>`).join('')}</div></section>
     <section aria-label="Regions"><h2 class="dcap">${macro.name}: pick one or more</h2><div class="rgrid">${macro.regions.map(card).join('')}
      <div class="rcard ask"><b>Not here?</b><span class="small">We never pad with places we have not researched. Tell us what you want and we note it.</span><button class="btn sm44" data-a="ask" data-v="region|">Ask us for more</button></div></div></section>
     ${S.regions.every((r) => !cnt(r)) ? `<div class="note crit">${ic('warn', 's')}<span>No places in the regions you chose yet. Pick another, or ask us to research it.</span></div>` : ''}`;
  }
  const n = allCandidates(S).length;
  return dwrap(`<h1 class="dh">Where</h1><div class="d2grid"><div class="dcol2">${left}<p class="small" style="margin:0">${isNear() ? n + ' places · ' + S.reachH + ' h ≈' : S.regions.length + ' region' + (S.regions.length === 1 ? '' : 's') + ' · ' + n + ' places'}</p></div>
  <div class="dmap"><div class="mapbox" data-map="where" style="min-height:420px"></div><p class="small">We draw only what we hold: squares are places, filled amber are in your selection${isNear() ? ', and the outline is the area your places cover' : ''}. Prototype map: no tiles, no network.</p></div></div>`);
}
const hull = (pts) => { // convex hull of [lat, lon] (monotone chain)
  const p = pts.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]); if (p.length < 3) return [];
  const cr = (o, a, b) => (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
  const lo = [], up = [];
  p.forEach((q) => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
  p.slice().reverse().forEach((q) => { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); });
  return lo.slice(0, -1).concat(up.slice(0, -1));
};
function dmapOpts(id) {
  if (id === 'where') {
    if (isNear()) {
      const inR = allCandidates(S), set = new Set(inR.map((p) => p.id));
      const near = PLACES.filter((p) => drive(S.origin, p) <= S.reachH * 60 + 180);
      return { days: [], extras: [{ id: 'origin', lat: S.origin.lat, lon: S.origin.lon, label: 'Start: ' + S.origin.name, tone: 'sel', caption: S.origin.name }].concat(near.map((p) => ({ id: 'w-' + p.id, lat: p.lat, lon: p.lon, label: p.name + (set.has(p.id) ? ' (in reach)' : ' (outside reach)'), tone: set.has(p.id) ? 'sel' : 'dim' }))),
        outline: hull(inR.map((p) => [p.lat, p.lon])), label: 'Map of the places within your reach of ' + S.origin.name };
    }
    const C = COUNTRIES[S.cc], regs = C.macros.flatMap((m) => m.regions);
    return { days: [], extras: regs.flatMap((r) => PLACES.filter((p) => p.reg === r).map((p) => ({ id: 'w-' + p.id, lat: p.lat, lon: p.lon, label: p.name + (S.regions.includes(r) ? ' (selected region)' : ''), tone: S.regions.includes(r) ? 'sel' : 'dim' })))
      .concat(S.regions.filter((r) => REGIONS[r]).map((r) => ({ id: 'rc-' + r, lat: REGIONS[r].lat, lon: REGIONS[r].lon, label: REGIONS[r].name, tone: 'sel', caption: REGIONS[r].name }))),
      outline: S.regions.length ? hull(PLACES.filter((p) => S.regions.includes(p.reg)).map((p) => [p.lat, p.lon])) : [], label: 'Map of ' + C.name + ': the regions you selected are filled' };
  }
  if (id === 'preview') return mapOpts('picks');
  return null;
}

/* ---------- stage 3: Pick (filters rail, results, tray and map) ---------- */
function d3() {
  const y = youngest(S), m = whenInfo(S).month, p3 = stage3(), near = isNear() && (S.kind === 'day' || S.kind === 'weekend');
  const sw = (on, a, v, l, sub) => toggleSw(on, a, v, l, sub);
  const filters = `<aside class="dfilters" aria-label="Filters"><h2 class="dcap">Filters</h2>
   ${y !== null ? `<h3 class="dcap">Who</h3><button class="pill ${S.filt.kids ? 'on' : ''}" data-a="filt" data-v="kids" aria-pressed="${S.filt.kids}">Kids ${y === 0 ? 'infant' : y + '+'}: fits the youngest</button>` : ''}
   ${near ? `<h3 class="dcap">Longest drive, each way</h3><div class="seg">${[2, 3, 4, 6, 8].map((h) => `<button class="pill sm ${S.reachH === h ? 'on' : ''}" data-a="reach" data-v="${h}" aria-pressed="${S.reachH === h}">${h} h</button>`).join('')}</div>` : ''}
   <h3 class="dcap">Looking for</h3><div class="seg">${Object.keys(VIBES).map((v) => `<button class="pill sm ${S.vibes.includes(v) ? 'on' : ''}" data-a="vibe" data-v="${v}" aria-pressed="${S.vibes.includes(v)}">${VIBES[v][0]}</button>`).join('')}</div>
   <h3 class="dcap">Month</h3><div class="seg">${MS.map((mm, i) => `<button class="pill sm ${m === i + 1 ? 'on' : ''}" data-a="setMonth" data-v="${i + 1}" aria-pressed="${m === i + 1}">${mm}</button>`).join('')}</div>
   <h3 class="dcap">Also</h3>${sw(S.filt.indoor, 'filt', 'indoor', 'Rainy day: indoor only')}${sw(S.filt.stroller, 'filt', 'stroller', 'Stroller ok')}${sw(S.filt.step, 'filt', 'step', 'Step-free')}${sw(S.filt.dogs, 'filt', 'dogs', 'Dogs welcome')}${sw(S.filt.hard, 'filt', 'hard', 'Include hard hikes')}
   <button class="lnk" data-a="clearFilt">Clear filters</button></aside>`;
  const mid = `<section class="dresults" aria-label="Places">${p3.parts.inner}</section>`;
  const tray = `<aside class="dtray" aria-label="Your picks"><h2 class="dcap">Your picks</h2><div class="mapbox" data-map="picks" style="min-height:220px;margin:0 0 6px"></div><p class="small" style="margin:0 0 8px">Squares are towns; pins are your picks in a rough driving order.</p>${trayHTML()}</aside>`;
  return dwrap(`<div class="d3grid">${filters}${mid}${tray}</div>`, 'wide');
}

/* ---------- stage 4: Days and driving (form and a live preview of what this will build) ---------- */
function previewPlan() {
  const sc = Object.assign({}, S, { picks: S.picks.slice(), must: Object.assign({}, S.must), stay: Object.assign({}, S.stay), reverseOnce: false, plan: null });
  try { const pl = buildPlan(sc, null); return { pl, st: planStats(pl, sc) }; } catch (e) { return null; }
}
function d4() {
  const p4 = stage4(), pv = previewPlan(), E = eff(S), est = estimateDays(S);
  let prev = '<p class="small">Pick at least one place to preview.</p>';
  if (pv) {
    const { pl, st } = pv, free = freeDays(pl).length, maxD = Math.max(...pl.days.map((d) => d.driveTotal == null ? d.drive : d.driveTotal));
    prev = `<div class="dprev" aria-live="polite"><h2 class="dcap">What this will build</h2>
     <div class="dstat"><div><b>${pl.days.length}</b><span>days</span></div><div><b>${pl.bases.length}</b><span>base${pl.bases.length === 1 ? '' : 's'}</span></div><div><b>${fd(st.avg)}</b><span>driving a day ≈</span></div><div><b>${st.moves}</b><span>move${st.moves === 1 ? '' : 's'}</span></div></div>
     <ul class="dpl">${pl.bases.map((b) => `<li><b>${esc(b.name)}</b> · ${b.nights} night${b.nights === 1 ? '' : 's'}</li>`).join('')}</ul>
     <p class="small" style="margin:8px 0">Pace ${PACE[E.pace].l} · about ${PACE[E.pace].vis / 60} h of visiting a day${S.kind !== 'day' && S.kind !== 'weekend' ? ' · moves ' + E.moves : ''}. Longest day on the road ${fd(maxD)} ≈.</p>
     ${S.kind !== 'day' && S.nights > est.nights + 2 ? `<div class="note warn">${ic('info', 's')}<span>${S.nights} nights is more than your picks need: about ${S.nights - est.nights} day${S.nights - est.nights === 1 ? '' : 's'} would be free (${free} free in this preview).</span></div>` : ''}
     ${pl.unfit.length ? `<div class="note warn" style="margin-top:8px">${ic('warn', 's')}<span>${pl.unfit.length} pick${pl.unfit.length === 1 ? '' : 's'} would not fit: ${esc(pl.unfit.map((u) => PL[u.pid].name).join(', '))}.</span></div>` : ''}</div>`;
  }
  return dwrap(`<h1 class="dh">Days and driving</h1><div class="d4grid"><section class="dform">${p4.parts.form}</section>
   <aside class="dprevcol">${prev}<div class="mapbox" data-map="preview" style="min-height:260px;margin:12px 0 0"></div><section aria-label="Also within your driving">${p4.parts.also}</section></aside></div>`);
}

/* ---------- review: two columns ---------- */
function d8() {
  const r = stage8(), chunks = r.raw.split('<div class="sect" style="padding-bottom:0"><span class="cap">'), head = chunks.shift();
  const by = {}; chunks.forEach((c) => { const k = c.slice(0, c.indexOf('<')).replace(/\s*\(.*$/, '').trim(); by[k] = '<div class="sect" style="padding-bottom:0"><span class="cap">' + c; });
  const keys = Object.keys(by), pick = (...ns) => ns.map((n) => by[keys.find((k) => k.startsWith(n))] || '').join('');
  const dated = r.dated;
  const actions = `<div class="dcard dactions"><h2 class="dcap">Finish</h2>${dated ? `<button class="btn pri full" data-a="ics">${ic('cal', 's')} Add to calendar</button>` : `<button class="btn pri full" data-a="sheet" data-v="dates">Add dates</button>`}
   <button class="btn full" data-a="copyLink">${ic('share', 's')} Copy link</button><button class="btn full" data-a="doPrint">${ic('print', 's')} Print or save as PDF</button><a class="btn full" href="/planner/trip.html?id=${S.id}" style="text-decoration:none">${ic('book', 's')} Open trip home</a><p class="small" style="margin:6px 0 0;text-align:center">Sign in to keep it on every device</p></div>`;
  return dwrap(`<div class="d8grid"><div class="d8main"><div class="dback"><button class="btn" data-a="back">${ic('back')} Back to the plan</button></div>${head}${pick('Book ahead', 'Reality', 'Warnings', 'Did not fit').replace(/<div class="flex" style="justify-content:flex-end"><button class="lnk sm" data-a="goReview">Open Review<\/button><\/div>/, '')}</div>
   <aside class="d8side">${actions}${pick('Known costs', 'Before you go', 'Share')}</aside></div>`);
}

/* ---------- the screen switch ---------- */
function dscreen() {
  switch (S.stage) {
    case 0: return { h: rail(), b: d0(), f: '' };
    case 1: return { h: rail(), b: d1(), f: '' };
    case 2: return { h: rail(), b: d2(), f: '' };
    case 3: return { h: rail(), b: d3(), f: '' };
    case 4: return { h: rail(), b: d4(), f: '' };
    case 5: { const r = stage5(); return { h: rail(), b: dwrap(r.b), f: '' }; }
    case 7: if (S.plan) return stage7(); return d4wrap();
    case 8: if (S.plan) { const r = stage8(); return { h: r.h.replace('class="shdr"', 'class="shdr dsh"'), b: d8(), f: '' }; } return d4wrap();
    default: return { h: rail(), b: d0(), f: '' };
  }
}
function d4wrap() { S.stage = 4; return { h: rail(), b: d4(), f: '' }; }
A.deskDates = function () { S.when = { type: 'dates', from: null, to: null }; initCal(); render(); };
setTimeout(() => document.body.classList.add('ready'), 400); // transitions of the drawer start after first paint
