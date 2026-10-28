/* THROWAWAY prototype: shared store, helpers, shell. Not product code.
   Loaded after shared/contract.js, sun.js, ics.js, map.js, builder/data.js, shared/engine.js, dates.js and glue.js.
   Every read and write of proto.trips goes through shared/contract.js (readTrips, writeTrips). The contract keeps a fixed set of
   fields, so the planner-only ones (notes, item done/stale/private, booking kind/rule/park, checklist group, park ticks,
   country) live in proto.planner.ext keyed by trip id and are merged back on read. */
(function(){
const P=window.P={};
const C=window.ProtoContract;
const SKEY='proto.planner', XKEY='proto.planner.ext';
const DAY=864e5, MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
P.esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
P.uid=p=>(p||'x')+Math.random().toString(36).slice(2,8);
P.q=k=>new URLSearchParams(location.search).get(k);
/* icons */
const IC={dots:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',check:'<path d="m5 12 5 5 9-10"/>',chev:'<path d="m6 9 6 6 6-6"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',plus:'<path d="M12 5v14M5 12h14"/>',pen:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',print:'<path d="M7 9V4h10v5M7 17H5v-6h14v6h-2M7 14h10v6H7z"/>',cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',moon:'<path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/>',pin:'<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',nav:'<path d="m4 11 16-7-7 16-2-7z"/>',users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',off:'<path d="M3 3l18 18M8.5 8.5A8 8 0 0 0 5 11M2 8a14 14 0 0 1 6-3.3M12 20h.01M16.5 12.5a5 5 0 0 1 1 1"/>',wifi:'<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 20h.01"/>',share:'<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 11 7.6-3.7M8.2 13l7.6 3.7"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',alert:'<path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'};
P.ic=(n,c)=>`<svg class="ic ${c||''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]||''}</svg>`;
/* dates (UTC strings YYYY-MM-DD) */
P.parse=s=>new Date(s+'T00:00:00Z');
P.iso=d=>d.toISOString().slice(0,10);
P.add=(s,n)=>P.iso(new Date(P.parse(s).getTime()+n*DAY));
P.diff=(a,b)=>Math.round((P.parse(b)-P.parse(a))/DAY);
P.fmt=(s,short)=>{const d=P.parse(s);return `${DN[d.getUTCDay()]} ${d.getUTCDate()} ${MN[d.getUTCMonth()]}${short?'':' '+d.getUTCFullYear()}`};
P.monthNum=m=>C.monthNumber(m);
P.fmtMonth=m=>MN[P.monthNum(m)-1]||'';
P.range=t=>{const d=t.dates||{};if(d.from&&d.to&&d.to!==d.from){const a=P.parse(d.from),b=P.parse(d.to);return a.getUTCMonth()===b.getUTCMonth()&&a.getUTCFullYear()===b.getUTCFullYear()?`${a.getUTCDate()}–${b.getUTCDate()} ${MN[b.getUTCMonth()]} ${b.getUTCFullYear()}`:`${P.fmt(d.from,1)} – ${P.fmt(d.to)}`}if(d.from)return P.fmt(d.from);if(P.monthNum(d.month))return (d.flexible?'Around ':'')+P.fmtMonth(d.month)+(d.flexible?' (flexible)':'');if(d.flexible)return 'Flexible';return ''};
P.hasDates=t=>!!(t.dates&&t.dates.from);
/* durations and money in the builder's house format: '4 h 20', '45 min'; EUR for Italy, CAD for Canada, named once */
P.mins=m=>window.ProtoEngine.fd(m||0);
P.cur=t=>{const it=P.items(t).find(i=>PL[i.id]);return it&&PL[it.id].cc==='IT'?'EUR':'CAD'};
P.dueChip=d=>{const left=P.diff(P.today(),d);return left<0?`<span class="chip crit" data-overdue="${-left}">${P.ic('alert')} Overdue by ${-left} day${left===-1?'':'s'}</span>`:`<span class="chip ${left<30?'warn':'ok'}">${left===0?'Book today':'In '+left+' day'+(left===1?'':'s')}</span>`};
P.due=(t,b)=>{const d=P.byDate(t,b);if(!d)return null;const left=P.diff(P.today(),d);return {d,left,overdue:left<0}};
P.hm=m=>{m=((Math.round(m)%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
P.toMin=t=>{const [h,m]=String(t||'09:00').split(':');return (+h)*60+(+m||0)};
P.kindLabel=k=>(window.ProtoEngine.KINDS[k]&&window.ProtoEngine.KINDS[k].label)||k||'Trip';
/* store: contract in, contract out; planner-only fields ride in proto.planner.ext */
const xread=()=>{try{return JSON.parse(localStorage.getItem(XKEY)||'{}')||{}}catch(e){return {}}};
const nonEmpty=o=>Object.keys(o).length>0;
function pack(t){const x={};
 if(t.notes)x.notes=t.notes;
 if(t.parkDone&&nonEmpty(t.parkDone))x.parkDone=t.parkDone;
 const g=t.gettingThere||{};if(g.abroad||g.country)x.gt={abroad:!!g.abroad,country:g.country||''};
 const it={};(t.days||[]).forEach(d=>(d.items||[]).forEach(i=>{const e={};['done','stale','priv'].forEach(k=>{if(i[k])e[k]=1});if(nonEmpty(e))it[i.id]=e}));if(nonEmpty(it))x.items=it;
 const bk={};(t.bookings||[]).forEach(b=>{const e={};['kind','rule','park'].forEach(k=>{if(b[k])e[k]=b[k]});if(nonEmpty(e))bk[b.label]=e});if(nonEmpty(bk))x.bookings=bk;
 const ck={};(t.checklist||[]).forEach(c=>{if(c.group)ck[c.label]=c.group});if(nonEmpty(ck))x.checklist=ck;
 return x}
function unpack(t,x){x=x||{};
 t.notes=x.notes||'';t.parkDone=x.parkDone||{};
 t.gettingThere=Object.assign({},t.gettingThere,x.gt||{});
 (t.days||[]).forEach(d=>(d.items||[]).forEach(i=>{Object.assign(i,{done:false,stale:false,priv:false},Object.fromEntries(Object.keys((x.items||{})[i.id]||{}).map(k=>[k,true])))}));
 (t.bookings||[]).forEach(b=>Object.assign(b,(x.bookings||{})[b.label]||{}));
 (t.checklist||[]).forEach(c=>{c.group=(x.checklist||{})[c.label]||'Other'});
 return t}
/* a stored trip the contract would refuse (no traveller, no start) would block every save, so mend those two fields on read */
function mend(t){if(!t.party.length)t.party=[{type:'adult',needs:[]}];if(!t.start.city)t.start.city='Home';return t}
P.trips=()=>{const ext=xread();return C.readTrips(localStorage).map(t=>mend(unpack(t,ext[t.id])))};
P.save=a=>{const ext={};a.forEach(t=>{const x=pack(t);if(nonEmpty(x))ext[t.id]=x});
 const r=C.writeTrips(localStorage,a);
 if(!r.ok){console.error('proto.trips not saved',r.problems);P.toast&&P.toast('Could not save: '+r.problems[0].msg);return false}
 localStorage.setItem(XKEY,JSON.stringify(ext));P.refreshHeader&&P.refreshHeader();return true};
P.get=id=>P.trips().find(t=>t.id===id);
P.update=(id,fn)=>{const a=P.trips(),t=a.find(x=>x.id===id);if(!t)return null;fn(t);t.updated=new Date().toISOString();P.save(a);return P.get(id)};
P.replace=(id,snap)=>{const a=P.trips(),i=a.findIndex(x=>x.id===id);if(i<0)return null;a[i]=snap;P.save(a);return P.get(id)};
P.requests=()=>C.readRequests(localStorage);
P.state=()=>{try{return JSON.parse(localStorage.getItem(SKEY)||'{}')||{}}catch(e){return {}}};
P.setState=fn=>{const s=P.state();fn(s);localStorage.setItem(SKEY,JSON.stringify(s));P.refreshHeader&&P.refreshHeader();return s};
P.realToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
P.today=()=>P.state().today||P.realToday();
P.phase=t=>{if(!P.hasDates(t))return 'planning';const n=P.today();if(t.dates.to&&t.dates.to<n)return 'past';if(t.dates.from<=n)return 'now';return 'upcoming'};
P.dayDate=(t,n)=>P.hasDates(t)?P.add(t.dates.from,n-1):null;
P.items=t=>(t.days||[]).flatMap(d=>d.items||[]);
P.partyText=t=>{const p=t.party||[];const c=k=>p.filter(x=>x.type===k);const out=[];const a=c('adult'),ch=c('child'),inf=c('infant');if(a.length)out.push(`${a.length} adult${a.length>1?'s':''}`);if(ch.length)out.push(`${ch.length} ${ch.length>1?'children':'child'} (${ch.map(x=>x.age!=null?x.age:'?').join(', ')})`);if(inf.length)out.push(`${inf.length} infant${inf.length>1?'s':''}`);return out.join(', ')||'No travellers yet'};
P.byDate=(t,b)=>{if(!P.hasDates(t))return null;const v=b.by;if(v==null||v==='')return null;if(/^\d{4}-\d\d-\d\d$/.test(v))return v;const m=String(v).match(/^(\d+)\s*d?$/);return m?P.add(t.dates.from,-(+m[1])):null};
P.bookStats=t=>{const b=t.bookings||[];return {done:b.filter(x=>x.done).length,total:b.length}};
P.checkStats=t=>{const b=t.checklist||[];return {done:b.filter(x=>x.done).length,total:b.length}};
P.costStats=t=>{const c=t.costs||[];const priced=c.filter(x=>x.free||(x.amount!=null&&x.amount!==''));return {total:c.length,priced:priced.length,free:c.filter(x=>x.free).length,sum:c.reduce((s,x)=>s+(x.free?0:(+x.amount||0)),0)}};
P.nextDeadline=t=>{const l=(t.bookings||[]).filter(b=>!b.done).map(b=>({b,d:P.byDate(t,b)})).filter(x=>x.d).sort((a,b)=>a.d<b.d?-1:1);return l[0]||null};
P.money=(n,t)=>(t?P.cur(t)+' ':'')+Math.round(n).toLocaleString('en-CA');
P.totals=t=>{const it=P.items(t);return {nights:t.nights!=null?t.nights:Math.max(0,(t.days||[]).length-1),drive:it.reduce((s,x)=>s+(+x.driveMin||0),0),places:it.length}};
P.dayDrive=d=>(d.items||[]).reduce((s,x)=>s+(+x.driveMin||0),0);
P.abroad=t=>{const g=t.gettingThere||{};return !!(g.abroad||g.mode==='air'||g.mode==='fly')};
P.gettingSummary=t=>{const g=t.gettingThere||{};
 if(g.mode==='fly'||g.mode==='air'){const a=AIRPORTS[g.arrive],f=AIRPORTS[g.from];return `Fly ${f?f.n+' ('+g.from+')':(g.from||'from home')} to ${a?a.n+' ('+g.arrive+')':(g.arrive||'your destination')}${g.leave&&g.leave!==g.arrive&&AIRPORTS[g.leave]?', home from '+AIRPORTS[g.leave].n+' ('+g.leave+')':''}, then drive. Drive times are placeholders.`}
 return `By car from ${(t.start&&t.start.city)||'home'}. Drive times are placeholders, not routing.`};
P.parkUrl=s=>'/parks-app/park.html?slug='+encodeURIComponent(s);
/* the same order as shared/map.js, so a day has the same colour in the route list and on the map */
P.dayColour=i=>['var(--id-blue)','var(--id-orange)','var(--id-rose)','var(--id-sky)','var(--id-vermillion)','var(--id-teal)','var(--id-yellow)'][i%7];
P.order=a=>{const r={now:0,upcoming:1,planning:2,past:3};return a.slice().sort((x,y)=>{const px=r[P.phase(x)],py=r[P.phase(y)];if(px!==py)return px-py;return ((x.dates&&x.dates.from)||'9')<((y.dates&&y.dates.from)||'9')?-1:1})};
/* reality checks, packing */
P.checks=t=>{const out=[],p=t.party||[];const kids=p.filter(x=>x.type!=='adult');const youngest=kids.reduce((m,x)=>Math.min(m,x.age!=null?x.age:99),99);
(t.days||[]).forEach(d=>{const dr=P.dayDrive(d);const its=d.items||[];
 if(dr>300)out.push({sev:'warn',day:d.n,text:`Day ${d.n} has ${P.mins(dr)} of driving. Plan a long stop or move one place.`});
 if(!its.length)out.push({sev:'info',day:d.n,text:`Day ${d.n} has nothing planned yet.`});
 const last=its[its.length-1];if(last&&P.toMin(last.time)+(+last.durMin||0)>20*60+30)out.push({sev:'warn',day:d.n,text:`Day ${d.n} runs past 20:30. Check light and the drive back.`});
 its.forEach(i=>{if(i.stale)out.push({sev:'crit',day:d.n,text:`"${i.name}" has changed or been removed from the catalogue. Replace it in the builder.`});
  if(kids.length&&youngest<8&&(+i.durMin||0)>=240)out.push({sev:'warn',day:d.n,text:`"${i.name}" is ${P.mins(i.durMin)} long and you have a child aged ${youngest}. Consider a shorter option.`});
  const needSF=p.some(x=>(x.needs||[]).includes('Step-free'));if(needSF&&/trail|ridge|hike|summit/i.test(i.name))out.push({sev:'warn',day:d.n,text:`"${i.name}" may not be step-free. Someone in the party needs step-free access.`})})});
if(!P.hasDates(t))out.push({sev:'info',text:'No dates yet, so opening hours, seasonal closures and book-by dates cannot be checked.',fixDates:1});
else (t.bookings||[]).forEach(b=>{const d=P.byDate(t,b);if(d&&!b.done&&d<P.today())out.push({sev:'crit',text:`"${b.label}" was due ${P.fmt(d)} and is not ticked off.`})});
const lk=P.items(t).filter(i=>i.locked).length;if(lk)out.push({sev:'info',text:`${lk} place${lk>1?'s are':' is'} locked and will not move if you re-run suggestions.`});
return out};
/* packing suggestions */
P.packing=t=>{const names=P.items(t).map(i=>i.name).join(' ').toLowerCase();const m=P.hasDates(t)?+t.dates.from.slice(5,7):(t.dates&&t.dates.month?P.monthNum(t.dates.month):null);const s=[];const add=(g,l)=>s.push({group:g,label:l,done:false});
add('Packing','Rain jackets');add('Packing','Sunscreen and sunglasses');add('Packing','Refillable water bottles');
if(m&&(m>=11||m<=3))add('Packing','Warm layers, gloves and hats');else if(m&&m>=6&&m<=8)add('Packing','Sun hats and light layers');else add('Packing','Fleece or mid layer');
if(/trail|hike|ridge|lookout|canyon|boardwalk/.test(names)){add('Packing','Hiking boots, broken in');add('Packing','Daypacks and a small first-aid kit')}
if(/canoe|lake|paddle|swim/.test(names)){add('Packing','Quick-dry towels and swimwear');add('Packing','Life jackets (or confirm hire)')}
if(/seceda|lift|ridge|tre cime|summit/.test(names))add('Packing','Trekking poles and a warm layer for the ridge');
const kids=(t.party||[]).filter(x=>x.type!=='adult');if(kids.length){add('Kids','Snacks for the drives');add('Kids','Spare clothes in the daypack');add('Kids','Books or a tablet for long legs');add('Kids','Child seat or booster (bring or hire)')}
if((t.party||[]).some(x=>x.type==='infant')){add('Kids','Nappies, wipes and a changing mat');add('Kids','Baby carrier')}
if(P.abroad(t)){add('Documents','Plug adapters');add('Documents','Copies of passports, kept apart from the originals')}
return s};
/* sun: shared/sun.js, the port of core/src/sun. Longitude is positive east. */
P.zoneOf=p=>p.cc==='IT'?'Europe/Rome':(p.lon<-100?'America/Edmonton':'America/Toronto');
P.baseOf=(t,d)=>PLACES.find(p=>p.name===d.base)||PL[((d.items||[]).find(i=>PL[i.id])||{}).id]||CITIES.find(c=>c.name===d.base)||CITIES.find(c=>c.name===(t.start&&t.start.city))||null;
P.sunDate=(t,n)=>{if(P.hasDates(t))return P.dayDate(t,n);const m=P.monthNum(t.dates&&t.dates.month);if(m){const td=P.today(),y=+td.slice(0,4)+(m<+td.slice(5,7)?1:0);return `${y}-${String(m).padStart(2,'0')}-15`}return P.today()};
P.sunFor=(t,d)=>{const b=P.baseOf(t,d);if(!b)return null;const iso=P.sunDate(t,d.n),zone=P.zoneOf(b),s=window.ProtoSun.sunFor(b.lat,b.lon,iso,zone);return s?Object.assign({iso,zone,place:b.name,lat:b.lat,lon:b.lon},s):null};
P.endsAfterSunset=(t,d,it)=>{const b=P.baseOf(t,d);if(!b||!it.time)return false;const p=PL[it.id]||b;const iso=P.sunDate(t,d.n);return window.ProtoSun.endsAfterSunset(p.lat,p.lon,iso,P.zoneOf(p),P.toMin(it.time)+(+it.durMin||0),30)};
/* seed: the engine builds the demo trips, with the builder's date model ('next weekend' resolves through ProtoEngine.whenInfo) */
P.seedTrips=()=>window.PEngine.seedTrips().map(t=>Object.assign(t,{updated:new Date().toISOString()}));
P.reseed=()=>P.save(P.seedTrips());
if(!P.trips().length&&!P.state().noSeed)P.reseed();
/* a deep link to a demo trip works even when another app (the builder) seeded proto.trips first with different ids */
P.ensureDemo=id=>{if(!id||P.trips().some(t=>t.id===id)||P.state().noSeed)return;const s=P.seedTrips().find(t=>t.id===id);if(s){const a=P.trips();a.push(s);P.save(a)}};
try{P.ensureDemo(new URLSearchParams(location.search).get('id'))}catch(e){}
/* ui helpers */
const held=[];
P.toast=(msg,undo)=>{if(document.querySelector('.sheet-wrap')){held.push([msg,undo]);return}let w=document.getElementById('toasts');if(!w){w=document.createElement('div');w.id='toasts';w.setAttribute('role','status');document.body.appendChild(w)}
 const el=document.createElement('div');el.className='toast';el.innerHTML=`<span>${P.esc(msg)}</span>${undo?'<button type="button">Undo</button>':''}`;w.appendChild(el);let tm;const kill=()=>{clearTimeout(tm);el.remove()};
 if(undo)el.querySelector('button').onclick=()=>{kill();undo()};tm=setTimeout(kill,undo?9000:3500);return kill};
const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
P.sheet=(title,html,opt)=>{opt=opt||{};document.querySelectorAll('.sheet-wrap').forEach(e=>e.remove());document.querySelectorAll('.toast').forEach(e=>e.remove());const prev=document.activeElement;const w=document.createElement('div');w.className='sheet-wrap';
 w.innerHTML=`<div class="scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${P.esc(title)}"><div class="sheet-h"><h2>${P.esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${P.ic('x')}</button></div><div class="sheet-b">${html}</div></div>`;
 document.body.appendChild(w);requestAnimationFrame(()=>w.classList.add('open'));
 const key=e=>{if(e.key==='Escape'){e.preventDefault();close();return}
  if(e.key==='Tab'){const f=[...w.querySelectorAll(FOCUSABLE)].filter(x=>x.offsetParent!==null);if(!f.length)return;const a=f[0],z=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}else if(!w.contains(document.activeElement)){e.preventDefault();a.focus()}}};
 const close=()=>{w.classList.remove('open');document.removeEventListener('keydown',key);setTimeout(()=>{w.remove();held.splice(0).forEach(h=>P.toast(h[0],h[1]));if(opt.onClose)opt.onClose();if(prev&&prev.focus&&document.contains(prev))prev.focus();else{const f=document.querySelector('[role=tab][aria-selected=true]')||document.querySelector('main h1,main');if(f){if(!f.hasAttribute('tabindex')&&!/^(BUTTON|A|INPUT)$/.test(f.tagName))f.setAttribute('tabindex','-1');f.focus()}}},200)};
 document.addEventListener('keydown',key);
 w.addEventListener('click',e=>{if(e.target.closest('[data-close]'))close()});
 const f=w.querySelector('form');if(f)f.addEventListener('submit',e=>{e.preventDefault();opt.onSubmit&&opt.onSubmit(new FormData(f),close,f)});
 setTimeout(()=>{const first=w.querySelector(opt.focus||'input:not([type=radio]),select,textarea,[data-autofocus]')||w.querySelector('input:checked')||w.querySelector('.sheet-f .btn.pri')||w.querySelector('[data-close]');first&&first.focus()},60);if(opt.mount)opt.mount(w,close);return {el:w,close}};
document.addEventListener('click',e=>{document.querySelectorAll('.menu:not([hidden])').forEach(m=>{if(!m.parentElement.contains(e.target))m.hidden=true})});
/* sign-in: there are no accounts in the prototype, and nothing here pretends otherwise */
P.signinSheet=()=>P.sheet('Sign in',`<p><span class="chip warn">Not in the prototype</span></p><p class="small" style="margin-top:12px">There are no accounts here and nothing is sent anywhere. Your trips live in this browser only. In the product, signing in moves the trips on this device into your account once.</p><div class="sheet-f"><button type="button" class="btn pri" data-close>Got it</button></div>`);
/* dates sheet: exact range, a month, or a flexible window. One model shared with the builder (dates.js); nights are kept across modes */
P.addDatesSheet=(id,done)=>{const t=P.get(id);if(!t)return;const D=window.PDates;let mode=D.modeOf(t);if(mode==='none')mode='exact';
 const near=['day','weekend'].includes(t.kind),nights=t.nights!=null?t.nights:2,seed=D.seedFor(t,P.realToday());
 const months=D.MN.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');
 P.sheet(P.hasDates(t)||D.modeOf(t)!=='none'?'Change dates':'Add dates',`<form><p class="small" style="margin-bottom:16px">${P.esc(t.title)}. Exact dates unlock book-by dates, opening-hours checks and the calendar file. A month or a window still checks the season.</p>
 <fieldset class="seg-f"><legend class="lbl">How sure are the dates?</legend><div class="seg">${near?`<button type="button" class="pill" data-preset="next">Next weekend</button><button type="button" class="pill" data-preset="this">This weekend</button>`:''}${D.MODES.map(([k,l])=>`<label class="pill"><input type="radio" name="mode" value="${k}" ${k===mode?'checked':''}>${l}</label>`).join('')}</div></fieldset>
 <div class="field" data-for="exact"><label for="d-from">First day</label><input id="d-from" name="from" type="date" value="${P.esc(seed.from)}"></div>
 <div class="field" data-for="month flex"><label for="d-month">Month</label><select id="d-month" name="month">${months}</select></div>
 <div class="field"><label for="d-nights">Nights</label><input id="d-nights" name="nights" type="number" min="0" max="60" value="${nights}"></div>
 <p class="meta" id="d-note" aria-live="polite"></p><div class="sheet-f"><button type="button" class="btn" data-close>Cancel</button><button class="btn pri">Save dates</button></div></form>`,
 {mount:(w)=>{w.querySelector('#d-month').value=String(seed.month);
  const upd=()=>{const m=w.querySelector('input[name=mode]:checked').value,f=w.querySelector('#d-from').value,nn=+w.querySelector('#d-nights').value||0;
   w.querySelectorAll('[data-for]').forEach(x=>x.hidden=!x.dataset.for.split(' ').includes(m));
   const days=(t.days||[]).length,mm=+w.querySelector('#d-month').value;
   w.querySelector('#d-note').textContent=(m==='exact'?(f?`Last day ${P.fmt(P.add(f,nn))}. `:''):m==='month'?`We use ${D.MN[mm-1]} for opening days and daylight. `:`A window around ${D.MN[mm-1]}, give or take two weeks. `)+(days&&days!==nn+1?`The plan has ${days} day${days===1?'':'s'}; use Edit plan to match ${nn} night${nn===1?'':'s'}.`:'')};
  w.addEventListener('input',upd);w.addEventListener('change',upd);
  w.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const r=D.resolve(b.dataset.preset);w.querySelector('input[value=exact]').checked=true;w.querySelector('#d-from').value=r.from;w.querySelector('#d-nights').value=D.diffDays(r.from,r.to);upd()});upd()},
 onSubmit:(fd,close)=>{const m=fd.get('mode'),nn=Math.max(0,+fd.get('nights')||0),from=fd.get('from'),mo=+fd.get('month');
  if(m==='exact'&&!from){const i=document.getElementById('d-from');i&&i.focus();return}
  P.update(id,x=>{x.dates=D.datesFor(m,{from,nights:nn,month:mo});x.nights=nn});close();P.toast(m==='exact'?'Dates saved. Book-by dates are now on Bookings.':'Dates saved. Add exact dates later for book-by dates.');done&&done()}})};
/* calendar: shared/ics.js, timed items plus all-day book-by events */
P.icsFor=t=>{const c=JSON.parse(JSON.stringify(t));c.bookings=(t.bookings||[]).filter(b=>!b.done).map(b=>Object.assign({},b,{by:P.byDate(t,b)||b.by}));return window.ProtoICS.build(C.normalise(c))};
P.download=(name,text,type)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type||'text/calendar'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
P.addToCalendar=t=>{const r=P.icsFor(t);if(!r.events){P.toast('Nothing to export yet: add exact dates and times first.');return r}
 P.download((t.title||'trip').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.ics',r.text);P.toast(`Calendar file downloaded: ${r.events} events, timed stops and book-by days${r.skipped.length?` (${r.skipped.length} left out)`:''}.`);return r};
P.copyLink=url=>{const done=()=>P.toast('Link copied');if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(done,()=>{window.prompt('Copy this link',url)});else window.prompt('Copy this link',url)};
P.shareUrl=id=>location.origin+'/planner/trip.html?id='+encodeURIComponent(id)+'&shared=1';
P.shareSheet=id=>{const t=P.get(id);if(!t)return;const hidden=P.items(t).filter(i=>i.priv).length;
 P.sheet('Share '+t.title,`<p class="small">Anyone with the link sees the days and public places only. Your party, bookings, costs and notes stay private.</p>${hidden?`<p class="callout warn small" style="margin-top:12px">${hidden} place${hidden>1?'s are':' is'} not public and will not show to the viewer.</p>`:''}<div class="field" style="margin-top:12px"><label for="sl">Link</label><input id="sl" type="text" readonly value="${P.esc(P.shareUrl(id))}"></div><div class="sheet-f"><a class="btn" href="${P.esc(P.shareUrl(id))}" target="_blank" rel="noopener">Preview shared view</a><button type="button" class="btn pri" data-copy>Copy link</button></div>`,{mount:w=>w.querySelector('[data-copy]').onclick=()=>P.copyLink(P.shareUrl(id))})};
/* an item sheet, opened from a map pin */
P.itemSheet=(t,d,it,opt)=>{opt=opt||{};const pl=PL[it.id];
 P.sheet(it.name,`<p class="cap">Day ${d.n}${P.hasDates(t)?' · '+P.fmt(P.dayDate(t,d.n)):''} · ${P.esc(d.base||'')}</p><p class="small" style="margin-top:8px"><b>${P.esc(it.time||'No time yet')}</b>${+it.durMin?' · '+P.mins(it.durMin):''}${+it.driveMin?' · drive '+P.mins(it.driveMin):''}</p>${pl&&pl.sub?`<p class="small" style="margin-top:6px">${P.esc(pl.sub)}</p>`:''}${it.note?`<p class="note" style="margin-top:6px">${P.esc(it.note)}</p>`:''}<div class="row" style="margin-top:6px">${it.locked?'<span class="chip ic-lock">'+P.ic('lock')+' Locked</span>':''}${it.placed?'<span class="chip">Placed by you</span>':''}${it.mustSee?'<span class="chip info">Must-see</span>':''}</div><div class="sheet-f">${it.park?`<a class="btn" href="${P.parkUrl(it.park)}">Park page</a>`:''}${opt.action?`<button type="button" class="btn pri" data-pin-act>${P.esc(opt.action)}</button>`:''}<button type="button" class="btn" data-close>Close</button></div>`,
  {mount:(w,close)=>{const b=w.querySelector('[data-pin-act]');if(b)b.onclick=()=>{close();opt.onAction&&opt.onAction()}}})};
/* offline: a real service worker (sw.js) caches the shell and the open trip; the badge follows navigator.onLine */
P.secure=()=>location.protocol==='https:'||/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
P.swReady=null;
if('serviceWorker' in navigator&&P.secure()){P.swReady=navigator.serviceWorker.register('sw.js').then(()=>navigator.serviceWorker.ready).catch(e=>{console.warn('service worker not registered',e);return null})}
P.cacheTrip=t=>{if(!P.swReady||!t)return;P.swReady.then(r=>{const a=r&&(r.active||navigator.serviceWorker.controller);if(a)a.postMessage({type:'cache-trip',id:t.id,json:JSON.stringify(t)})})};
P.netChip=()=>{const on=navigator.onLine;return `<span class="chip ${on?'ok':'warn'}" id="net-badge" data-online="${on}">${P.ic(on?'wifi':'off')} ${on?'Online · saved for offline':'Offline · using the copy on this device'}</span>`};
P.watchNet=()=>{const f=()=>{const el=document.getElementById('net-badge');if(el)el.outerHTML=P.netChip();const h=document.getElementById('net');if(h)h.hidden=navigator.onLine};addEventListener('online',f);addEventListener('offline',f);f()};
/* context switcher: switching keeps the page and the tab */
P.tabMemory=id=>(P.state().tab||{})[id];
P.go=id=>{const page=location.pathname.split('/').pop()||'index.html';const q='?id='+encodeURIComponent(id);P.setState(s=>s.ctx=id);
 if(page==='trip.html')location.href='trip.html'+q+(location.hash||'#'+(P.tabMemory(id)||'overview'));
 else if(page==='today.html')location.href='today.html'+q;
 else if(page==='print.html')location.href='print.html'+q;
 else location.href='trip.html'+q+'#'+(P.tabMemory(id)||'overview')};
let HDR=null;
function chipInner(ctx){return ctx?`<span class="dot" style="background:${P.esc(ctx.identity||'var(--id-none)')}"></span><span class="t">${P.esc(ctx.title)}</span><span class="d">${P.esc(P.range(ctx)||'No dates')}</span>${P.ic('chev')}`:`<span class="t">No trip open</span>${P.ic('chev')}`}
function navInner(ctx,page){return `<a href="../index.html">Home</a><a href="../parks-app/index.html">Parks</a><a href="index.html" aria-current="page">Trips</a><a href="/builder/index.html">Plan</a>`}
function switcherInner(trips,ctx){return `<div class="cap" style="padding:6px 12px">Switch trip. You stay on the same page.</div>`+P.order(trips).map(t=>{const nd=P.nextDeadline(t),ph=P.phase(t);return `<button type="button" class="sw-item" role="menuitem" data-sw="${P.esc(t.id)}" ${ctx&&ctx.id===t.id?'aria-current="true"':''}><span class="dot" style="background:${P.esc(t.identity||'var(--id-none)')}"></span><span style="flex:1"><b>${P.esc(t.title)}</b><span class="meta">${P.esc(P.range(t)||'No dates')}${ph==='now'?' · travelling now':''}${nd?' · next: '+P.esc(nd.b.label)+' by '+P.fmt(nd.d,1):''}</span></span>${ctx&&ctx.id===t.id?P.ic('check'):''}</button>`}).join('')+`<div class="sw-foot"><a class="btn sm" href="index.html">All my trips</a><a class="btn sm" href="/builder/index.html">New trip</a></div>`}
/* re-render the header chip, the nav links and the switcher from the store: called on every save, delete, undo and switch */
P.refreshHeader=()=>{if(!HDR||HDR.o.shared)return;const trips=P.trips(),st=P.state();const id=(HDR.o.trip&&HDR.o.trip.id)||st.ctx;const ctx=trips.find(t=>t.id===id)||null;
 const chip=document.getElementById('chip');if(chip){chip.innerHTML=chipInner(ctx);chip.setAttribute('aria-label',ctx?`Current trip: ${ctx.title}. Switch trip`:'No trip open. Switch trip')}
 const nav=document.getElementById('hdr-nav');if(nav)nav.innerHTML=navInner(ctx,HDR.o.page);
 const sw=document.getElementById('switcher');if(sw)sw.innerHTML=switcherInner(trips,ctx)};
P.shell=function(o){o=o||{};const trips=P.trips(),st=P.state();const ctx=o.trip||trips.find(t=>t.id===st.ctx)||null;HDR={o};
 const page=o.page||'';const h=document.createElement('header');h.className='hdr';
 const chip=`<button type="button" class="hdr-btn chip-trip" id="chip" aria-haspopup="true" aria-expanded="false" aria-controls="switcher" aria-label="${ctx?'Current trip: '+P.esc(ctx.title)+'. Switch trip':'No trip open. Switch trip'}">${chipInner(ctx)}</button>`;
 h.innerHTML=`<div class="hdr-in"><a class="brand" href="index.html">Trip Plans</a><nav aria-label="Main" id="hdr-nav">${navInner(ctx,page)}</nav><span class="sp"></span><span class="chip warn" id="net" hidden>${P.ic('off')} Offline</span>${o.shared?'<span class="chip">Shared view</span>':chip}<button type="button" class="hdr-btn" id="theme" aria-label="Switch theme">${P.ic('moon')}</button></div>`;
 document.body.prepend(h);
 const th=document.getElementById('theme');const setIc=()=>{th.innerHTML=P.ic(document.documentElement.dataset.theme==='dark'?'sun':'moon')};setIc();
 th.onclick=()=>{ProtoTheme.toggle();setIc()};addEventListener('storage',e=>{if(e.key===ProtoTheme.KEY)setIc()});
 if(!o.shared){
 const sw=document.createElement('div');sw.id='switcher';sw.className='switcher';sw.hidden=true;sw.setAttribute('role','menu');sw.setAttribute('aria-label','Switch trip');
 sw.innerHTML=switcherInner(trips,ctx);document.body.appendChild(sw);
 const chipEl=document.getElementById('chip');
 const shut=back=>{sw.hidden=true;chipEl.setAttribute('aria-expanded','false');if(back)chipEl.focus()};
 chipEl.addEventListener('click',()=>{sw.hidden=!sw.hidden;chipEl.setAttribute('aria-expanded',String(!sw.hidden));if(!sw.hidden){const c=sw.querySelector('[aria-current]')||sw.querySelector('.sw-item');c&&c.focus()}});
 sw.addEventListener('click',e=>{const b=e.target.closest('[data-sw]');if(b){if(o.beforeSwitch)o.beforeSwitch();P.go(b.dataset.sw)}});
 sw.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();shut(true)}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const f=[...sw.querySelectorAll('.sw-item,.sw-foot a')];const i=f.indexOf(document.activeElement);f[(i+(e.key==='ArrowDown'?1:-1)+f.length)%f.length].focus()}else if(e.key==='Tab'){setTimeout(()=>{if(!sw.contains(document.activeElement))shut(false)},0)}});
 document.addEventListener('click',e=>{if(!sw.hidden&&!e.target.closest('#switcher,#chip'))shut(false)})}
 /* prototype drawer */
 const pb=document.createElement('button');pb.type='button';pb.id='proto-btn';pb.textContent='Prototype controls';pb.setAttribute('aria-expanded','false');pb.setAttribute('aria-controls','proto-drawer');document.body.appendChild(pb);
 const dr=document.createElement('div');dr.id='proto-drawer';dr.hidden=true;dr.setAttribute('role','region');dr.setAttribute('aria-label','Prototype controls');
 dr.innerHTML=`<div class="cap" style="margin-bottom:8px">Prototype controls</div><div class="field"><label for="pt">Today's date${st.today?' (set by you)':' (real date)'}</label><input id="pt" type="date" value="${P.today()}"></div><button type="button" class="btn sm" id="pt-set">Set today</button><button type="button" class="btn sm" id="pt-real">Use real date</button><hr style="border:0;border-top:1px solid var(--line);margin:12px 0"><button type="button" class="btn sm" id="p-reseed">Reseed demo data</button><button type="button" class="btn sm" id="p-clear">Clear all trips</button><p class="meta" style="margin-top:8px">Reseed and Clear replace every trip in this browser, including builder drafts. The offline badge follows your connection; use the browser's offline mode to see it.</p>`;
 document.body.appendChild(dr);
 pb.onclick=()=>{dr.hidden=!dr.hidden;pb.setAttribute('aria-expanded',String(!dr.hidden))};
 dr.querySelector('#pt-set').onclick=()=>{const v=dr.querySelector('#pt').value;if(v){P.setState(s=>s.today=v);location.reload()}};
 dr.querySelector('#pt-real').onclick=()=>{P.setState(s=>{delete s.today});location.reload()};
 dr.querySelector('#p-reseed').onclick=()=>{P.setState(s=>{delete s.noSeed;s.ctx=null});P.reseed();location.href='index.html'};
 dr.querySelector('#p-clear').onclick=()=>{P.setState(s=>{s.noSeed=true;s.ctx=null});P.save([]);location.href='index.html'};
 if(o.bottomBar)document.body.classList.add('has-bar');
 P.watchNet();
};
})();
