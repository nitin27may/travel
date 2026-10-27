(function(){
const E=P.esc,app=document.getElementById('app');
const id=P.q('id')||P.state().ctx;let t=P.get(id);
if(!t){P.shell({page:'today'});app.innerHTML=`<div class="wrap" style="padding-top:32px"><div class="empty"><h2>Pick a trip</h2><p class="small">Today shows one trip at a time. Choose which trip you are travelling on.</p><a class="btn pri" href="index.html">My trips</a></div></div>`;return}
P.setState(s=>s.ctx=id);P.shell({page:'today',trip:t,bottomBar:true});
document.title='Today · '+t.title+' (planner prototype)';
const st=()=>P.state();
function realDay(){if(!P.hasDates(t))return null;const n=P.diff(t.dates.from,P.today())+1;return n>=1&&n<=(t.days||[]).length?n:null}
function curDay(){const q=+P.q('day');if(q)return q;const p=(st().pretend||{})[id];return p||realDay()||1}
let day=curDay();
function maps(i,d){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(i.name+(d&&d.base?' near '+d.base:''))}
function render(){
 t=P.get(id);const days=t.days||[];const d=days.find(x=>x.n===day)||days[0];
 const rd=realDay(),pret=(st().pretend||{})[id],off=st().offline||!navigator.onLine;
 if(!d){app.innerHTML=`<div class="wrap"><div class="empty" style="margin-top:32px"><h2>No days to show</h2><p class="small">This trip has no days yet.</p><a class="btn pri" href="/builder/index.html?edit=${E(id)}">Edit plan</a></div></div>`;return}
 const its=(d.items||[]).slice().sort((a,b)=>P.toMin(a.time)-P.toMin(b.time));const nxt=its.find(i=>!i.done);const after=nxt&&its[its.indexOf(nxt)+1];
 const date=P.hasDates(t)?P.dayDate(t,d.n):P.today();const sun=P.sun(date,P.abroad(t)?46.5:49);const done=its.filter(i=>i.done).length;
 const leave=nxt?P.toMin(nxt.time)-(+nxt.driveMin||0):0;
 app.innerHTML=`<div class="wrap" style="padding-bottom:24px">
 <div class="page-h" style="padding-bottom:8px"><div><div class="cap">${E(t.title)} · Day ${d.n}${P.hasDates(t)?' · '+P.fmt(P.dayDate(t,d.n)):''}</div><h1 style="font-size:clamp(34px,8vw,56px)">Today</h1></div><span class="sp"></span><span class="chip ${off?'warn':'ok'}">${P.ic(off?'off':'wifi')} ${off?'Offline · using the copy on this phone':'Online · saved for offline'}</span></div>
 ${rd?'':`<div class="callout"><span class="small" style="flex:1"><b>${P.hasDates(t)?'Not travelling today.':'No dates yet.'}</b> Showing day ${d.n}. ${P.hasDates(t)?'Your first day is '+P.fmt(t.dates.from)+'.':''}</span></div>`}
 <div class="row" style="margin-bottom:12px"><label class="lbl" for="pret">Pretend today is day</label><select id="pret" style="width:auto;min-width:96px">${days.map(x=>`<option value="${x.n}" ${x.n===d.n?'selected':''}>Day ${x.n}</option>`).join('')}</select>${pret?'<button class="btn sm" data-act="unpretend">Use real date</button>':''}</div>
 <div class="tabs" role="tablist" aria-label="Day switcher">${days.map(x=>`<button class="tab" role="tab" data-day="${x.n}" aria-selected="${x.n===d.n}">Day ${x.n}${rd===x.n?' ·':''}</button>`).join('')}</div>
 <div class="grid2">
 <div>
 ${nxt?`<section class="panel" style="border-left:6px solid ${E(t.identity)}" aria-label="Next up"><div class="cap">Next</div><h2 style="font:var(--t-section);text-transform:uppercase;margin:4px 0 8px">${E(nxt.name)}</h2>
  <p class="small"><b>${E(nxt.time)}</b>${+nxt.durMin?' · '+P.mins(nxt.durMin):''}</p>
  ${+nxt.driveMin?`<p class="small" style="margin-top:6px">${P.ic('nav')} <b>Leave by ${P.hm(leave)}</b> · drive ${P.mins(nxt.driveMin)} from ${E(it_prev(its,nxt,d))}</p>`:'<p class="small" style="margin-top:6px">No driving needed.</p>'}
  ${nxt.note?`<p class="note" style="margin-top:6px">${E(nxt.note)}</p>`:''}
  ${after?`<p class="meta" style="margin-top:8px">Then ${E(after.time)} ${E(after.name)}${+after.driveMin?' · '+P.mins(after.driveMin)+' drive':''}</p>`:''}
  <div class="row" style="margin-top:12px"><a class="btn pri" href="${maps(nxt,d)}" target="_blank" rel="noopener">${P.ic('nav')} Open in maps</a><button class="btn" data-act="done" data-id="${E(nxt.id)}">${P.ic('check')} Done</button>${nxt.park?`<a class="btn" href="${P.parkUrl(nxt.park)}">Park page</a>`:''}</div></section>`
  :`<section class="panel"><div class="cap">Next</div><h2 style="font:var(--t-section);text-transform:uppercase;margin:4px 0 8px">${its.length?'All done for today':'Nothing planned'}</h2><p class="small">${its.length?'Every stop is ticked off. Add a stop below if plans changed.':'This day has no stops. Add one below.'}</p></section>`}
 <section class="panel"><h2>Today · ${done} of ${its.length} done</h2>${its.length?`<div>${its.map(i=>`<div class="rrow ${i.done?'done':''}" style="${nxt&&nxt.id===i.id?'background:var(--accent-soft);margin:0 -16px;padding:10px 16px;border-radius:8px':''}"><input type="checkbox" data-f="tick" data-id="${E(i.id)}" ${i.done?'checked':''} aria-label="Done: ${E(i.name)}"><div class="main"><b>${E(i.time)} ${E(i.name)}</b><span class="meta">${+i.durMin?P.mins(i.durMin):''}${+i.driveMin?' · drive '+P.mins(i.driveMin):''}${i.placed?' · added by you':''}</span></div><a class="btn sm" href="${maps(i,d)}" target="_blank" rel="noopener" aria-label="Open ${E(i.name)} in maps">${P.ic('nav')} Maps</a></div>`).join('')}</div>`:'<p class="small">Nothing to do today.</p>'}</section></div>
 <div>
 <section class="panel"><h2>Weather</h2><p class="small"><b>14° to 22°</b> · gusts 25 km/h</p><p class="meta" style="margin-top:4px">Placeholder. The product shows the live forecast and a Plan B rule here.</p></section>
 <section class="panel"><h2>Sun</h2><div class="row"><span class="chip">${P.ic('sun')} Sunrise ${sun.rise}</span><span class="chip">${P.ic('moon')} Sunset ${sun.set}</span></div><p class="meta" style="margin-top:6px">Approximate (placeholder for the sun calculator). Base: ${E(d.base||'')}</p></section>
 <section class="panel"><h2>Add a stop</h2><form id="qa"><div class="field"><label for="qn">Place or activity</label><input id="qn" name="n" type="text" required placeholder="Gelato in town"></div><div class="field"><label for="qt">Time</label><input id="qt" name="t" type="time" required value="${E(P.hm(new Date().getHours()*60+60).slice(0,5))}"></div><button class="btn pri">${P.ic('plus')} Add to day ${d.n}</button></form></section>
 </div></div></div>
 <nav class="bottombar" aria-label="Trip"><a href="today.html?id=${E(id)}" aria-current="page">${P.ic('sun')}Today</a><a href="trip.html?id=${E(id)}#itinerary">${P.ic('pin')}Plan</a><a href="trip.html?id=${E(id)}#bookings">${P.ic('cal')}Bookings</a><a href="trip.html?id=${E(id)}#checklist">${P.ic('check')}Checklist</a></nav>`;
}
function it_prev(its,n,d){const k=its.indexOf(n);return k>0?its[k-1].name:(d.base||'your base')}
app.addEventListener('click',e=>{
 const dt=e.target.closest('[data-day]');if(dt){day=+dt.dataset.day;P.setState(s=>{(s.pretend=s.pretend||{})[id]=day});history.replaceState(null,'','today.html?id='+encodeURIComponent(id));render();return}
 const a=e.target.closest('[data-act]');if(!a)return;
 if(a.dataset.act==='unpretend'){P.setState(s=>{delete (s.pretend||{})[id]});day=realDay()||1;render()}
 if(a.dataset.act==='done'){setDone(a.dataset.id,true)}});
function setDone(iid,v){P.update(id,x=>x.days.forEach(d=>d.items.forEach(i=>{if(i.id===iid)i.done=v})));render()}
app.addEventListener('change',e=>{if(e.target.id==='pret'){day=+e.target.value;P.setState(s=>{(s.pretend=s.pretend||{})[id]=day});render();document.getElementById('pret').focus()}
 if(e.target.dataset.f==='tick')setDone(e.target.dataset.id,e.target.checked)});
app.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.target);const n=(fd.get('n')||'').trim();if(!n)return;
 P.update(id,x=>{const d=x.days.find(z=>z.n===day);d.items.push({id:P.uid('i'),name:n,slug:n.toLowerCase().replace(/[^a-z0-9]+/g,'-'),time:fd.get('t'),durMin:60,driveMin:0,locked:false,placed:true,mustSee:false,note:'Added on the day'})});render();P.toast('Added "'+n+'" to day '+day)});
render();
})();
