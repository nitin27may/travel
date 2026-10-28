(function(){
const id=P.q('id'),shared=P.q('shared')==='1';
const app=document.getElementById('app');
const E=P.esc;
let t=P.get(id);
const ALL=[['overview','Overview'],['itinerary','Itinerary'],['bookings','Bookings'],['checklist','Checklist'],['travellers','Travellers'],['costs','Costs'],['notes','Notes'],['share','Share']];
const TABS=shared?ALL.slice(0,2):ALL;
let tab=(location.hash||'').slice(1).split('~')[0]||P.tabMemory(id)||'overview';
if(!TABS.find(x=>x[0]===tab))tab='overview';
const collapsed=new Set();
let lastChange='';
const NEEDS=['Step-free','Short walks only','Child seat','Dietary','Carries a baby'];
const NEED_FX={'Step-free':'Trails and viewpoints are re-checked for step-free access.','Short walks only':'Places over 2 h on foot are flagged.','Child seat':'Hire car and transfers need a seat; it goes on the checklist.','Dietary':'Restaurant and hut stops need a diet check.','Carries a baby':'Carrier-friendly routes are preferred; lifts are favoured over steep climbs.'};
if(!t&&!shared){
 /* the service worker keeps a copy of the open trip: put it back if the browser lost it */
 fetch('__trip/'+encodeURIComponent(id)+'.json').then(r=>r.ok?r.json():null).then(j=>{if(j&&j.id===id){const a=P.trips();a.push(j);if(P.save(a))location.reload()}}).catch(()=>{});
}
if(!t){
 P.shell({page:'trip',shared});
 app.innerHTML=`<div class="wrap" style="padding-top:32px"><div class="empty"><h2>This trip is not here</h2><p class="small" style="max-width:46ch">${shared?'The owner may have stopped sharing it, or the link is wrong.':'It may have been deleted on this device. If you just deleted it, use Undo on My trips.'}</p><a class="btn pri" href="index.html">${shared?'See our trips':'Back to My trips'}</a></div></div>`;return}
if(!shared){P.setState(s=>s.ctx=id);P.cacheTrip(t)}
/* the viewer's version of the trip */
function view(){if(!shared)return t;const v=JSON.parse(JSON.stringify(t));let hid=0;v.days.forEach(d=>{const n=d.items.length;d.items=d.items.filter(i=>!i.priv&&!i.stale);hid+=n-d.items.length;d.notes=''});v._hidden=hid;v.bookings=[];return v}
P.shell({page:'trip',trip:t,shared,beforeSwitch:saveScroll});
document.title=t.title+' (planner prototype)';
function saveScroll(){if(shared)return;P.setState(s=>{(s.scroll=s.scroll||{})[id+'|'+tab]=scrollY})}
window.addEventListener('pagehide',saveScroll);
/* head */
function head(){const v=view();const dated=P.hasDates(t);
 return `<div class="wrap">${shared?`<div class="callout" style="margin-top:16px"><b>Shared plan</b><span class="small" style="flex:1">You are viewing ${E(t.title)} read-only. ${v._hidden?`${v._hidden} place${v._hidden>1?'s in this plan are':' in this plan is'} not public · showing ${P.items(v).length}.`:'All places are public.'}</span><a class="btn sm" href="/builder/index.html?copy=${E(t.id)}">Use a copy</a></div>`:''}
 <div class="thead" style="--id:${E(t.identity)}"><div class="cap">${E(P.kindLabel(t.kind))} · <span class="chip info" style="margin-left:4px">In Mine</span></div>
 ${shared?`<h1 style="font:var(--t-trip);text-transform:uppercase;font-size:clamp(30px,7vw,48px)">${E(t.title)}</h1>`:`<input class="title-edit" id="title" value="${E(t.title)}" aria-label="Trip name, press Enter to save" maxlength="60">`}
 <div class="facts"><span>${P.ic('cal')} ${E(P.range(t)||'No dates yet')}</span>${shared?'':`<button type="button" class="btn ghost sm" style="min-height:32px;padding:0 6px" data-act="dates">${PDates.modeOf(t)==='none'?'Add dates':'Change dates'}</button>`}
 <span>${P.ic('users')} ${E(P.partyText(t))}</span><span>${P.ic('pin')} From ${E((t.start&&t.start.city)||'?')}${t.start&&t.start.airport?' ('+E(t.start.airport)+')':''}</span></div>
 ${shared?'':`<div class="row">${dated?`<button type="button" class="btn pri" data-act="ics">${P.ic('cal')} Add to calendar</button>`:`<button type="button" class="btn pri" data-act="dates">${P.ic('cal')} Add dates</button>`}<a class="btn" href="/builder/index.html?edit=${E(id)}">${P.ic('pen')} Edit plan</a><a class="btn" href="today.html?id=${E(id)}">Today</a><button type="button" class="btn" data-act="sharesheet">${P.ic('share')} Share</button><a class="btn" href="print.html?id=${E(id)}">${P.ic('print')} Print</a></div>`}
 </div>
 <div class="tabs sticky" role="tablist" aria-label="Trip sections">${TABS.map(([k,l])=>`<button type="button" class="tab" role="tab" id="tab-${k}" data-tab="${k}" aria-selected="${tab===k}" aria-controls="panel">${l}${k==='bookings'?` <span class="n">${P.bookStats(t).done}/${P.bookStats(t).total}</span>`:k==='checklist'?` <span class="n">${P.checkStats(t).done}/${P.checkStats(t).total}</span>`:''}</button>`).join('')}</div>
 <div id="panel" role="tabpanel" aria-labelledby="tab-${tab}"></div></div>`}
function hash(s){let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return h}
function rnd(seed){let s=seed||1;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
/* overview */
const RQ_CHIP={Requested:'',Researching:'warn',Added:'ok'};
function requestsPanel(){const rq=P.requests();
 return `<div class="panel" aria-labelledby="rq-h"><h2 id="rq-h">Requests ${rq.length?`<span class="chip info">${rq.length}</span>`:''}</h2>${rq.length?`<ul class="list" style="display:grid;gap:10px">${rq.map(r=>`<li class="rq"><div class="row" style="justify-content:space-between;flex-wrap:nowrap;align-items:flex-start"><div style="min-width:0"><b class="small" style="font-weight:600">${E(r.name)}</b><br><span class="meta">${r.kind==='region'?'Region':'Place'}${r.note?' \u00b7 '+E(r.note):''}</span></div><span class="chip ${RQ_CHIP[r.status]||''}" data-status="${E(r.status)}">${E(r.status)}</span></div></li>`).join('')}</ul>`:'<p class="small">No requests yet. In the builder, "Ask us for more" sends one here.</p>'}</div>`}
function mapData(v){const days=[],extras=[],seen=new Set();
 (v.days||[]).forEach(d=>{days.push({n:d.n,points:(d.items||[]).filter(i=>PL[i.id]).map(i=>({id:i.id,lat:PL[i.id].lat,lon:PL[i.id].lon,label:i.name}))});
  const b=PLACES.find(p=>p.name===d.base&&p.type==='town');if(b&&!seen.has(b.id)){seen.add(b.id);extras.push({id:'base-'+b.id,lat:b.lat,lon:b.lon,label:'Base: '+b.name})}});
 return {days,extras,located:days.reduce((n,d)=>n+d.points.length,0)}}
let mapH=null;
function mountMap(){if(mapH){mapH.destroy();mapH=null}const host=document.getElementById('route-map');if(!host)return;const v=view(),md=mapData(v);
 if(!md.located){host.innerHTML='<p class="small" style="padding:16px">None of these places has a location the prototype knows, so there is nothing to draw. Edit the plan in the builder to pick places.</p>';return}
 mapH=ProtoMap.render(host,{days:md.days,extras:md.extras,label:'Map of the route, one colour for each day',
  onPin:(pid,pt,dn)=>{const d=(v.days||[]).find(x=>x.n===dn),it=d&&d.items.find(x=>x.id===pid);if(it)P.itemSheet(t,d,it,{action:'Show in itinerary',onAction:()=>{setTab('itinerary');collapsed.delete(dn);render();const el=document.getElementById('day-'+dn);el&&el.scrollIntoView({block:'start'})}})}})}
function daylight(){const v=view();const rows=(v.days||[]).map(d=>({d,s:P.sunFor(t,d)}));if(!rows.some(r=>r.s))return '';
 const first=rows.find(r=>r.s);const exact=P.hasDates(t);
 return `<div class="panel"><h2>Daylight</h2><p class="small">${exact?`Day ${first.d.n}`:'Mid-'+E(PDates.label(t)||'trip')}: sunrise <b>${first.s.sunrise}</b>, sunset <b>${first.s.sunset}</b> at ${E(first.s.place)}.</p><details style="margin-top:8px"><summary class="small" style="cursor:pointer;min-height:36px;display:flex;align-items:center">Every day</summary><table class="sun-table"><caption class="sr">Sunrise and sunset for each day</caption><thead><tr><th scope="col">Day</th><th scope="col">Base</th><th scope="col">Sunrise</th><th scope="col">Sunset</th></tr></thead><tbody>${rows.filter(r=>r.s).map(r=>`<tr><th scope="row">${r.d.n}</th><td>${E(r.s.place)}</td><td>${r.s.sunrise}</td><td>${r.s.sunset}</td></tr>`).join('')}</tbody></table></details><p class="meta" style="margin-top:6px">Computed from the base's position (shared sun calculator).</p></div>`}
function overview(){const v=view(),tt=P.totals(v),cs=P.costStats(t);const checks=shared?[]:P.checks(t);
 const days=v.days||[];
 const nd=shared?null:P.nextDeadline(t);
 return `<div class="stats"><div class="stat"><span class="cap">Nights</span><b>${tt.nights}</b></div><div class="stat"><span class="cap">Driving</span><b>${P.mins(tt.drive)} ≈</b></div><div class="stat"><span class="cap">Places</span><b>${tt.places}</b></div>${shared?`<div class="stat"><span class="cap">Days</span><b>${days.length}</b></div>`:`<div class="stat"><span class="cap">Known costs</span><b>${cs.total?P.money(cs.sum,t):'None'}</b><span class="meta">${cs.priced} of ${cs.total} priced</span>${cs.free?` <span class="chip ok">${cs.free} Free</span>`:''}</div>`}</div>
 <div class="grid2"><div><div class="panel"><h2>Route by day</h2><div class="mapph"><div id="route-map"></div></div><p class="meta" style="margin-top:6px">Schematic map, no tiles in the prototype. Tap a pin to open the place. The product draws the real route.</p>
 <ul class="route" style="margin-top:12px">${days.map((d,di)=>`<li><button type="button" class="route-row" data-act="gotoday" data-n="${d.n}"><span class="sw" style="background:${P.dayColour(di)}"></span><span style="flex:1"><b class="small" style="font-weight:600">Day ${d.n}${P.hasDates(t)?' · '+P.fmt(P.dayDate(t,d.n),1):''}</b><br><span class="small">${E(d.label||'')}</span></span><span class="meta">${(d.items||[]).length} place${(d.items||[]).length===1?'':'s'} · ${P.mins(P.dayDrive(d))} ≈ drive</span></button></li>`).join('')}</ul></div>
 <div class="panel"><h2>Getting there</h2><p class="small">${E(P.gettingSummary(t))}</p></div></div>
 <div>${shared?'':`<div class="panel" aria-labelledby="rc"><h2 id="rc">Reality checks ${checks.length?`<span class="chip ${checks.some(c=>c.sev!=='info')?'warn':'info'}">${checks.length}</span>`:''}</h2>${checks.length?checks.map(c=>`<div class="check"><span class="sev ${c.sev}">${c.sev==='crit'?'Fix':c.sev==='warn'?'Check':'Note'}</span><div class="small" style="flex:1">${E(c.text)}${c.fixDates?` <button type="button" class="btn ghost sm" style="min-height:28px;padding:0 4px" data-act="dates">Add dates</button>`:''}${c.day?` <a href="/builder/index.html?edit=${E(id)}&day=${c.day}">Fix in builder</a>`:''}</div></div>`).join(''):'<p class="small">Nothing to flag. Distances, opening days and daylight look workable.</p>'}</div>
 ${nd?`<div class="panel"><h2>Next to book</h2><p class="small"><b>${E(nd.b.label)}</b><br>by ${P.fmt(nd.d)}</p><p style="margin-top:6px">${P.dueChip(nd.d)}</p><button type="button" class="btn sm" style="margin-top:8px" data-act="goto" data-tab="bookings">Open Bookings</button></div>`:''}
 ${requestsPanel()}`}${daylight()}</div></div>`}
/* itinerary */
function itinerary(){const v=view();
 let h=`<div class="row" style="margin-bottom:16px"><button class="btn sm" data-act="expand">Expand all</button><button class="btn sm" data-act="collapse">Collapse all</button><span class="sp"></span>${shared?'':`<a class="btn pri" href="/builder/index.html?edit=${E(id)}">${P.ic('pen')} Edit plan</a>`}</div>`;
 if(!(v.days||[]).length)return h+`<div class="empty"><h2>No days yet</h2><p class="small">Build the days in the builder.</p><a class="btn pri" href="/builder/index.html?edit=${E(id)}">Edit plan</a></div>`;
 h+=(v.days||[]).map((d,di)=>{const open=!collapsed.has(d.n),its=d.items||[];
  return `<section class="day" id="day-${d.n}" style="--dc:${P.dayColour(di)}"><button class="day-h" data-act="toggle" data-n="${d.n}" aria-expanded="${open}" aria-controls="db-${d.n}">${P.ic('chev')}<span style="flex:1"><span class="cap">Day ${d.n}${P.hasDates(t)?' · '+P.fmt(P.dayDate(t,d.n),1):''} · ${E(d.base||'')}</span><br><h3>${E(d.label||'Day '+d.n)}</h3></span><span class="meta">${its.length} place${its.length===1?'':'s'} · ${P.mins(P.dayDrive(d))} ≈ drive</span></button>
  <div class="day-b" id="db-${d.n}" ${open?'':'hidden'}>${its.length?its.map(i=>{const leg=+i.driveMin>0?`<div class="leg"><span></span><span>${P.ic('nav')} Drive ${P.mins(i.driveMin)}</span></div>`:'';
   return leg+`<div class="item ${i.stale?'stale':''}"><span class="tm">${E(i.time)}</span><div><div class="nm">${E(i.name)}</div><div class="row" style="gap:6px;margin-top:4px">${+i.durMin?`<span class="meta">${P.mins(i.durMin)}</span>`:''}${i.locked?`<span class="chip ic-lock">${P.ic('lock')} Locked</span>`:''}${i.placed?'<span class="chip">Placed by you</span>':''}${i.mustSee?'<span class="chip info">Must-see</span>':''}${i.stale?'<span class="chip crit">Check this place</span>':''}${i.park?`<a class="meta" href="${P.parkUrl(i.park)}">Park page</a>`:''}</div>${i.note?`<p class="small" style="margin-top:4px">${E(i.note)}</p>`:''}${i.stale?`<p class="small" style="margin-top:4px">This place changed or was removed. <a href="/builder/index.html?edit=${E(id)}">Replace it in the builder</a>.</p>`:''}</div></div>`}).join(''):'<p class="small" style="padding:8px 0">Nothing planned.</p>'}
  ${shared?'':`<div class="field" style="margin:12px 0 0"><label for="dn-${d.n}">Notes for day ${d.n}</label><textarea id="dn-${d.n}" data-f="daynote" data-n="${d.n}" placeholder="Reminders, reservations, who does what">${E(d.notes||'')}</textarea></div>`}</div></section>`}).join('');
 if(shared&&v._hidden)h+=`<p class="meta">${v._hidden} place${v._hidden>1?'s':''} not public · showing ${P.items(v).length}</p>`;
 return h}
/* bookings */
function bookings(){const dated=P.hasDates(t);const bk=(t.bookings||[]).map((b,i)=>({b,i,d:P.byDate(t,b)}));if(dated)bk.sort((x,y)=>(x.d||'9')<(y.d||'9')?-1:1);const s=P.bookStats(t);
 let h=`<div class="row" style="margin-bottom:12px"><span class="small"><b>${s.done} of ${s.total}</b> done</span><span class="sp"></span><button class="btn" data-act="addbk">${P.ic('plus')} Add a booking</button></div>`;
 if(!dated)h+=`<div class="callout"><span class="small" style="flex:1"><b>Book-by dates need travel dates.</b> Add dates and each row shows when to book.</span><button class="btn pri sm" data-act="dates">Add dates</button></div>`;
 h+=`<div class="rows">${bk.length?bk.map(({b,i,d})=>{const left=d?P.diff(P.today(),d):null;const cls=!b.done&&left!=null?(left<0?'crit':left<30?'warn':'ok'):'';
  return `<div class="rrow ${b.done?'done':''}"><input type="checkbox" id="bk${i}" data-f="bkdone" data-i="${i}" data-fk="bk${i}" ${b.done?'checked':''} aria-label="Done: ${E(b.label)}"><div class="main"><b>${E(b.label)}</b><span class="meta">${E(b.kind||'')}${b.rule?' · '+E(b.rule):''}</span></div>
  ${d?`<span class="chip ${cls}">${b.done?'Done':left<0?P.ic('alert')+' Overdue by '+(-left)+' day'+(left===-1?'':'s')+' · was '+P.fmt(d,1):'Book by '+P.fmt(d,1)+' · '+left+' d'}</span>`:`<span class="chip">${dated?'No book-by date':'Add dates for book-by'}</span>`}
  ${b.park?`<a class="meta" href="${P.parkUrl(b.park)}">Park page</a>`:''}
  ${b.link?`<a class="btn sm" href="${E(b.link)}" target="_blank" rel="noopener">Open booking page ${P.ic('link')}</a>`:''}<button class="icon-btn" data-act="rmbk" data-i="${i}" aria-label="Remove ${E(b.label)}">${P.ic('x')}</button></div>`}).join(''):'<p class="small" style="padding:16px 0">No bookings listed.</p>'}</div>`;
 const covered=new Set((t.bookings||[]).map(b=>b.park).filter(Boolean));const parks=[...new Set(P.items(t).map(i=>i.park).filter(Boolean))].filter(p=>!covered.has(p));
 if(parks.length){t.parkDone=t.parkDone||{};h+=`<h2 class="sec-h">Park entry and permits</h2><div class="rows">${parks.map(p=>`<div class="rrow ${t.parkDone[p]?'done':''}"><input type="checkbox" data-f="parkdone" data-p="${E(p)}" data-fk="pk-${E(p)}" ${t.parkDone[p]?'checked':''} aria-label="Entry sorted for ${E(p)}"><div class="main"><b>${E(p.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase()))}</b><span class="meta">Check the day pass or permit before you go</span></div><a class="btn sm" href="${P.parkUrl(p)}">Park page and fees</a></div>`).join('')}</div>`}
 return h}
/* checklist */
function checklist(){const l=t.checklist||[],s=P.checkStats(t);const groups=['Documents','Packing','Kids','Other'];
 let h='';if(P.abroad(t))h+=`<div class="callout"><span class="small" style="flex:1"><b>Passports and entry rules${t.gettingThere&&t.gettingThere.country?' for '+E(t.gettingThere.country):''}.</b> Check passport validity, visas or travel authorisations, and driving permits before you book.</span><a class="btn sm" href="https://travel.gc.ca/destinations" target="_blank" rel="noopener">Entry rules ${P.ic('link')}</a></div>`;
 h+=`<div class="row" style="margin-bottom:8px"><span class="small"><b>${s.done} of ${s.total}</b> done</span><div class="bar" style="flex:1;min-width:120px"><i style="width:${s.total?s.done/s.total*100:0}%"></i></div><button class="btn" data-act="suggest">Suggest packing for this trip</button></div>
 <form class="addrow" data-f="addck"><label class="sr" for="ck-new">New item</label><input id="ck-new" name="label" type="text" placeholder="Add an item, for example Binoculars" required style="flex:1"><label class="sr" for="ck-g">Group</label><select id="ck-g" name="group">${groups.map(g=>`<option>${g}</option>`).join('')}</select><button class="btn pri">${P.ic('plus')} Add</button></form>`;
 if(!l.length)h+=`<div class="empty"><h2>Nothing on the list</h2><p class="small">Add items, or let us suggest packing from the season, the activities and who is coming.</p></div>`;
 groups.forEach(g=>{const rows=l.map((c,i)=>({c,i})).filter(x=>(x.c.group||'Other')===g);if(!rows.length)return;h+=`<h2 class="sec-h">${g} <span class="meta">${rows.filter(r=>r.c.done).length}/${rows.length}</span></h2><div class="rows">${rows.map(({c,i})=>`<div class="rrow ${c.done?'done':''}"><input type="checkbox" data-f="ckdone" data-i="${i}" data-fk="ck${i}" ${c.done?'checked':''} aria-label="${E(c.label)}"><div class="main"><b>${E(c.label)}</b></div><button class="icon-btn" data-act="rmck" data-i="${i}" aria-label="Remove ${E(c.label)}">${P.ic('x')}</button></div>`).join('')}</div>`});
 return h}
/* travellers */
function impacts(){const p=t.party||[],out=[`${p.length} traveller${p.length===1?'':'s'}: stays, lifts and tickets are counted for ${p.length}.`];const kids=p.filter(x=>x.type==='child'),inf=p.filter(x=>x.type==='infant');
 if(kids.length)out.push(`Children (${kids.map(k=>k.age!=null?k.age:'?').join(', ')}): activities over 4 h are flagged for under-8s, and the checklist adds kids' items.`);
 if(inf.length)out.push('Infants: free entry on most lifts and parks, a carrier or buggy on the checklist, and shorter drive legs.');
 const needs=[...new Set(p.flatMap(x=>x.needs||[]))];needs.forEach(n=>out.push(`${n}: ${NEED_FX[n]||'Checked against each place.'}`));return out}
function travellers(){const p=t.party||[];
 let h=`<div class="grid2"><div><div class="rows">${p.map((x,i)=>`<div class="rrow" style="align-items:flex-start"><div style="flex:1 1 200px;min-width:0"><div class="tr-grid"><div class="field" style="margin:0"><label for="pn${i}">Name</label><input id="pn${i}" type="text" data-f="pname" data-i="${i}" data-fk="pn${i}" value="${E(x.name||'')}" placeholder="${x.type==='adult'?'Adult':x.type==='child'?'Child':'Infant'} ${i+1}"></div><div class="field" style="margin:0"><label for="pt${i}">Type</label><select id="pt${i}" data-f="ptype" data-i="${i}" data-fk="pt${i}">${['adult','child','infant'].map(k=>`<option value="${k}" ${x.type===k?'selected':''}>${k[0].toUpperCase()+k.slice(1)}</option>`).join('')}</select></div>${x.type!=='adult'?`<div class="field" style="margin:0"><label for="pa${i}">Age</label><input id="pa${i}" type="number" min="0" max="${x.type==='infant'?2:17}" data-f="page" data-i="${i}" data-fk="pa${i}" value="${x.age!=null?x.age:''}"></div>`:''}</div>
 <div class="needs" style="margin-top:10px" role="group" aria-label="Needs of ${E(x.name||'traveller '+(i+1))}">${NEEDS.map(n=>`<label><input type="checkbox" data-f="pneed" data-i="${i}" data-n="${E(n)}" ${(x.needs||[]).includes(n)?'checked':''}><span class="chip">${E(n)}</span></label>`).join('')}</div></div>
 <button class="icon-btn" data-act="rmp" data-i="${i}" aria-label="Remove ${E(x.name||'traveller '+(i+1))}" ${p.length<2?'disabled':''}>${P.ic('trash')}</button></div>`).join('')}</div>
 <div class="row"><button type="button" class="btn" data-act="addp" data-type="adult">${P.ic('plus')} Add adult</button><button type="button" class="btn" data-act="addp" data-type="child">${P.ic('plus')} Add child</button><button type="button" class="btn" data-act="addp" data-type="infant">${P.ic('plus')} Add infant</button></div></div>
 <div><div class="panel" aria-live="polite"><h2>What this affects</h2>${lastChange?`<p class="callout small" style="margin-bottom:12px">${E(lastChange)}</p>`:''}${pending?`<div class="callout warn small" style="margin-bottom:12px"><span style="flex:1">The plan has not been updated for this change.</span><button type="button" class="btn sm" data-act="review">Review plan changes</button></div>`:''}<ul class="list small" style="display:grid;gap:8px">${impacts().map(x=>`<li>${E(x)}</li>`).join('')}</ul><div class="row" style="margin-top:12px"><a class="btn sm" href="/builder/index.html?edit=${E(id)}">Re-run suggestions in the builder</a></div><p class="meta" style="margin-top:8px">Adding, removing or changing the age of a traveller re-flows the days. Locked and placed stops stay where they are.</p></div></div></div>`;
 return h}
/* costs */
function costs(){const c=t.costs||[],s=P.costStats(t);
 return `<div class="callout"><span class="small" style="flex:1"><b>${s.total?P.money(s.sum,t):'Nothing priced yet'} known</b> · ${s.priced} of ${s.total} priced${s.free?` · ${s.free} free`:''}. Amounts are in ${P.cur(t)}. Only prices we know are counted. Budgets and expense tracking are not in this version.</span></div>
 <div class="rows">${c.map((x,i)=>`<div class="rrow"><div class="main"><b>${E(x.label)}</b></div>${x.free?'<span class="chip ok">Free</span>':''}<label class="lbl sr" for="ca${i}">Amount in ${P.cur(t)}</label><input class="costnum" id="ca${i}" type="number" min="0" step="1" data-f="camt" data-i="${i}" value="${x.amount!=null&&x.amount!==''&&!x.free?x.amount:''}" placeholder="${x.free?'Free':'Not priced'}" ${x.free?'disabled':''}><label class="chk" style="min-height:36px"><input type="checkbox" data-f="cfree" data-i="${i}" ${x.free?'checked':''}> Free</label><button class="icon-btn" data-act="rmc" data-i="${i}" aria-label="Remove ${E(x.label)}">${P.ic('x')}</button></div>`).join('')||'<p class="small" style="padding:16px 0">No costs yet.</p>'}</div>
 <form class="addrow" data-f="addcost"><label class="sr" for="cn">Cost name</label><input id="cn" name="label" type="text" required placeholder="Add a cost, for example Parking" style="flex:1"><label class="sr" for="cna">Amount</label><input id="cna" name="amount" type="number" min="0" placeholder="Amount" class="costnum"><button class="btn pri">${P.ic('plus')} Add</button></form>`}
/* notes */
function notes(){return `<div class="field"><label for="tn">Notes for the whole trip</label><textarea id="tn" data-f="tripnote" style="min-height:140px" placeholder="Anything the group should remember">${E(t.notes||'')}</textarea></div>${(t.days||[]).map(d=>`<div class="field"><label for="nd${d.n}">Day ${d.n}${P.hasDates(t)?' · '+P.fmt(P.dayDate(t,d.n),1):''}: ${E(d.label||'')}</label><textarea id="nd${d.n}" data-f="daynote" data-n="${d.n}">${E(d.notes||'')}</textarea></div>`).join('')}`}
/* share */
function share(){const hid=P.items(t).filter(i=>i.priv||i.stale).length;
 return `<div class="grid2"><div class="panel"><h2>Share this plan</h2><p class="small">A link shows the days and the public places. Your party, bookings, costs and notes are never in it.</p>${hid?`<p class="callout warn small" style="margin-top:12px">${hid} place${hid>1?'s are':' is'} not public, so the viewer sees "${hid} place${hid>1?'s':''} not public" in their place.</p>`:''}<div class="field" style="margin-top:12px"><label for="sl">Link</label><input id="sl" type="text" readonly value="${E(P.shareUrl(id))}"></div><div class="row"><button class="btn pri" data-act="copylink">${P.ic('copy')} Copy link</button><a class="btn" href="${E(P.shareUrl(id))}" target="_blank" rel="noopener">Preview shared view</a></div></div>
 <div class="panel"><h2>Print and calendar</h2><p class="small">A clean page with the itinerary, bookings and checklist.</p><div class="row" style="margin-top:12px"><a class="btn" href="print.html?id=${E(id)}">${P.ic('print')} Print view</a>${P.hasDates(t)?`<button class="btn" data-act="ics">${P.ic('cal')} Add to calendar</button>`:`<button class="btn" data-act="dates">${P.ic('cal')} Add dates</button>`}</div></div></div>`}
/* travellers change the plan: re-flow through the builder engine, show what moved, let the person apply or undo */
let pending=null;
const snapshot=()=>JSON.parse(JSON.stringify(t));
function names(list,fn){return list.map(fn).join('')}
function reflow(snap){const prop=PEngine.propose(snap,t);
 if(!prop.ok){lastChange=(lastChange?lastChange+' ':'')+prop.reason;render();return}
 if(prop.nothing){lastChange=(lastChange?lastChange+' ':'')+'The plan already fits the new party.';render();P.toast('The plan already fits the new party');return}
 diffSheet(snap,prop)}
function diffSheet(snap,prop){pending={snap,prop};const d=prop.diff,n=(t.party||[]).length;
 const sec=(h,list,row)=>list.length?`<h3 class="sec-h" style="margin-top:16px">${h} <span class="meta">${list.length}</span></h3><ul class="list diff-list">${list.map(row).join('')}</ul>`:'';
 const same=prop.pace.before===prop.pace.after;
 P.sheet('Plan changes for '+n+' traveller'+(n===1?'':'s'),`<div id="diff-body"><p class="small">Pace: ${same?`stays <b>${E(prop.pace.after)}</b>`:`<b>${E(prop.pace.before)}</b> to <b>${E(prop.pace.after)}</b>`}. Longest drive a day: ${prop.drive.before===prop.drive.after?'stays '+P.mins(prop.drive.after):P.mins(prop.drive.before)+' to '+P.mins(prop.drive.after)}.</p>
 <p class="meta" style="margin-top:4px">Kept where they are: ${prop.kept.locked} locked, ${prop.kept.placed} placed by you.</p>
 ${prop.bases&&prop.bases.length?`<p class="meta" style="margin-top:4px">Bases: ${E(prop.bases.join(', '))}. Base towns are not listed below.</p>`:''}
 ${sec('Moved',d.moved,x=>`<li data-diff="moved"><b>${E(x.name)}</b> <span class="meta">Day ${x.from} to Day ${x.to}</span></li>`)}${sec('Added',d.added,x=>`<li data-diff="added"><b>${E(x.name)}</b> <span class="meta">Day ${x.day}</span></li>`)}${sec('Removed',d.removed,x=>`<li data-diff="removed"><b>${E(x.name)}</b> <span class="meta">Day ${x.day} · ${E(x.reason)}</span></li>`)}
 ${!d.moved.length&&!d.added.length&&!d.removed.length?'<p class="small" style="margin-top:12px">No place changes day. Only the pace limits change.</p>':''}</div>
 <div class="sheet-f"><button type="button" class="btn" data-undo>Undo this change</button><button type="button" class="btn pri" data-apply>Apply to the plan</button></div>`,
 {focus:'[data-apply]',onClose:()=>{if(pending)render()},mount:(w,close)=>{
  w.querySelector('[data-undo]').onclick=()=>{pending=null;t=P.replace(id,snap);lastChange='Change undone.';close();full();setTab('travellers');P.toast('Change undone')};
  w.querySelector('[data-apply]').onclick=()=>{const before=snap;pending=null;
   upd(x=>{x.days=prop.days;const have=new Set((x.bookings||[]).map(b=>b.label));(prop.bookings||[]).forEach(b=>{if(!have.has(b.label))x.bookings.push(Object.assign({kind:'activity'},b))})},`Plan updated: ${d.moved.length} moved, ${d.added.length} added, ${d.removed.length} removed.`);
   close();full();setTab('travellers');P.toast('Plan updated for the new party',()=>{t=P.replace(id,before);lastChange='Plan change undone.';full();setTab('travellers')})}}})}
const R={overview,itinerary,bookings,checklist,travellers,costs,notes,share};
function render(keepFocus){const fk=keepFocus&&document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.fk;
 const p=document.getElementById('panel');p.innerHTML=R[tab]();document.querySelectorAll('.tab').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===tab))});p.setAttribute('aria-labelledby','tab-'+tab);
 if(tab==='overview')mountMap();else if(mapH){mapH.destroy();mapH=null}
 if(fk){const e=document.querySelector(`[data-fk="${fk}"]`);if(e)e.focus()}}
function full(){const fk=document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.fk;app.innerHTML=head();render();if(fk){const e=document.querySelector(`[data-fk="${fk}"]`);e&&e.focus()}const c=document.querySelector('#chip .d');if(c)c.textContent=P.range(t)||'No dates'}
function setTab(k,scroll){saveScroll();tab=k;P.setState(s=>{(s.tab=s.tab||{})[id]=k});if(location.hash!=='#'+k)history.replaceState(null,'','#'+k);render();if(scroll)scrollTo(0,0);else{const sy=(P.state().scroll||{})[id+'|'+k];if(sy)scrollTo(0,sy)}}
function upd(fn,msg){t=P.update(id,fn);if(msg)lastChange=msg}
app.addEventListener('click',e=>{
 const tb=e.target.closest('[data-tab]');if(tb&&tb.closest('.tabs')){setTab(tb.dataset.tab);return}
 const a=e.target.closest('[data-act]');if(!a)return;const act=a.dataset.act,i=+a.dataset.i;
 switch(act){
 case 'dates':P.addDatesSheet(id,()=>{t=P.get(id);full()});break;
 case 'review':if(pending)diffSheet(pending.snap,pending.prop);break;
 case 'ics':P.addToCalendar(t);break;
 case 'sharesheet':P.shareSheet(id);break;
 case 'copylink':P.copyLink(P.shareUrl(id));break;
 case 'goto':setTab(a.dataset.tab,true);break;
 case 'gotoday':setTab('itinerary');collapsed.delete(+a.dataset.n);render();document.getElementById('day-'+a.dataset.n).scrollIntoView({block:'start'});break;
 case 'toggle':{const n=+a.dataset.n;collapsed.has(n)?collapsed.delete(n):collapsed.add(n);render();document.querySelector(`[data-act=toggle][data-n="${n}"]`).focus();break}
 case 'expand':collapsed.clear();render();break;
 case 'collapse':(t.days||[]).forEach(d=>collapsed.add(d.n));render();break;
 case 'rmbk':{const rm=t.bookings[i];upd(x=>x.bookings.splice(i,1));full();P.toast('Removed "'+rm.label+'"',()=>{upd(x=>x.bookings.splice(i,0,rm));full()});break}
 case 'addbk':P.sheet('Add a booking',`<form><div class="field"><label for="b-l">What needs booking</label><input id="b-l" name="label" type="text" required></div><div class="field"><label for="b-b">Book this many days before the trip</label><input id="b-b" name="by" type="number" min="0" placeholder="${P.hasDates(t)?'For example 30':'Used once you add dates'}"></div><div class="field"><label for="b-k">Booking page (optional)</label><input id="b-k" name="link" type="url" placeholder="https://"></div><div class="sheet-f"><button type="button" class="btn" data-close>Cancel</button><button class="btn pri">Add booking</button></div></form>`,{onSubmit:(fd,close)=>{const l=(fd.get('label')||'').trim();if(!l)return;upd(x=>x.bookings.push({label:l,by:fd.get('by')?+fd.get('by'):null,link:fd.get('link')||'',done:false,kind:'other'}));close();full();P.toast('Booking added')}});break;
 case 'rmck':{const rm=t.checklist[i];upd(x=>x.checklist.splice(i,1));full();P.toast('Removed "'+rm.label+'"',()=>{upd(x=>x.checklist.splice(i,0,rm));full()});break}
 case 'suggest':{const have=new Set((t.checklist||[]).map(c=>c.label.toLowerCase()));const add=P.packing(t).filter(c=>!have.has(c.label.toLowerCase()));upd(x=>x.checklist=(x.checklist||[]).concat(add));full();P.toast(add.length?`Added ${add.length} suggestions from the season, activities and who is coming`:'Nothing new to suggest');break}
 case 'rmc':{const rm=t.costs[i];upd(x=>x.costs.splice(i,1));full();P.toast('Removed "'+rm.label+'"',()=>{upd(x=>x.costs.splice(i,0,rm));full()});break}
 case 'addp':{const ty=a.dataset.type,before=P.checks(t).length,snap=snapshot();const age=ty==='child'?5:ty==='infant'?1:null;upd(x=>x.party.push(Object.assign({name:'',type:ty,needs:[]},age!=null?{age}:{})),'');
  const after=P.checks(t).length;lastChange=`Added ${ty==='adult'?'an adult':'a '+ty}${age!=null?' (age '+age+')':''}. ${after>before?(after-before)+' new reality check'+(after-before>1?'s':'')+' on Overview.':'No new reality checks.'}${ty!=='adult'?' Use Suggest packing on Checklist for kids items.':''}`;
  full();setTab('travellers');reflow(snap);break}
 case 'rmp':{const rm=t.party[i],snap=snapshot();upd(x=>x.party.splice(i,1),`Removed ${rm.name||rm.type}. Counts for stays and lifts are updated.`);full();setTab('travellers');P.toast('Removed traveller',()=>{t=P.replace(id,snap);lastChange='Restored.';full();setTab('travellers')});reflow(snap);break}
 }});
app.addEventListener('change',e=>{const f=e.target.dataset.f;if(!f)return;const i=+e.target.dataset.i,v=e.target;
 switch(f){
 case 'bkdone':upd(x=>x.bookings[i].done=v.checked);full();break;
 case 'parkdone':upd(x=>{x.parkDone=x.parkDone||{};x.parkDone[v.dataset.p]=v.checked});render(true);break;
 case 'ckdone':upd(x=>x.checklist[i].done=v.checked);full();break;
 case 'pname':upd(x=>x.party[i].name=v.value.trim());break;
 case 'ptype':{const snap=snapshot();upd(x=>{const p=x.party[i];p.type=v.value;if(p.type==='adult')delete p.age;else if(p.age==null)p.age=p.type==='infant'?1:5},`Changed to ${v.value}.`);full();setTab('travellers');reflow(snap);break};
 case 'page':{const snap=snapshot();upd(x=>x.party[i].age=v.value===''?null:+v.value,`Age set to ${v.value}. Activities over 4 h are re-checked for under-8s.`);full();setTab('travellers');reflow(snap);break}
 case 'pneed':{const n=v.dataset.n;upd(x=>{const p=x.party[i];p.needs=p.needs||[];const k=p.needs.indexOf(n);if(v.checked&&k<0)p.needs.push(n);if(!v.checked&&k>=0)p.needs.splice(k,1)},v.checked?`${n}: ${NEED_FX[n]}`:`${n} removed.`);full();setTab('travellers');break}
 case 'camt':upd(x=>x.costs[i].amount=v.value===''?null:+v.value);full();setTab('costs');break;
 case 'cfree':upd(x=>{x.costs[i].free=v.checked;if(v.checked)x.costs[i].amount=null});full();setTab('costs');break;
 case 'title':break;
 }});
app.addEventListener('input',e=>{const f=e.target.dataset.f,v=e.target;if(f==='daynote'){const n=+v.dataset.n;upd(x=>{x.days.find(d=>d.n===n).notes=v.value})}else if(f==='tripnote')upd(x=>x.notes=v.value)});
app.addEventListener('submit',e=>{e.preventDefault();const f=e.target.dataset.f,fd=new FormData(e.target);
 if(f==='addck'){const l=(fd.get('label')||'').trim();if(l){upd(x=>(x.checklist=x.checklist||[]).push({label:l,done:false,group:fd.get('group')||'Other'}));full();P.toast('Added "'+l+'"');const n=document.getElementById('ck-new');n&&n.focus()}}
 if(f==='addcost'){const l=(fd.get('label')||'').trim();if(l){upd(x=>(x.costs=x.costs||[]).push({label:l,amount:fd.get('amount')===''?null:+fd.get('amount')}));full();P.toast('Added "'+l+'"')}}});
app.addEventListener('keydown',e=>{if(e.target.id==='title'&&e.key==='Enter')e.target.blur();
 const tb=e.target.closest&&e.target.closest('[role=tab]');if(tb&&['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){const all=[...tb.parentElement.querySelectorAll('[role=tab]')],i=all.indexOf(tb);e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?all.length-1:(i+(e.key==='ArrowRight'?1:-1)+all.length)%all.length;all[n].focus();all[n].click()}});
app.addEventListener('focusout',e=>{if(e.target.id==='title'){const n=e.target.value.trim();if(n&&n!==t.title){upd(x=>x.title=n);document.title=n+' (planner prototype)';const c=document.querySelector('#chip .t');if(c)c.textContent=n;P.toast('Renamed')}else e.target.value=t.title}});
window.addEventListener('hashchange',()=>{const k=(location.hash||'').slice(1);if(TABS.find(x=>x[0]===k)&&k!==tab)setTab(k)});
full();
const sy=(P.state().scroll||{})[id+'|'+tab];if(sy&&!shared)setTimeout(()=>scrollTo(0,sy),0);
})();
