(function(){
let tab='all';
const app=document.getElementById('app');
const st=P.state();tab=(location.hash||'').slice(1)||'all';
function counts(a){const c={all:a.length,planning:0,upcoming:0,past:0};a.forEach(t=>{const p=P.phase(t);if(p==='planning')c.planning++;else if(p==='past')c.past++;else c.upcoming++});return c}
function card(t){
 const ph=P.phase(t),b=P.bookStats(t),c=P.checkStats(t),nd=P.nextDeadline(t),inCtx=P.state().ctx===t.id;
 const dates=P.hasDates(t)?P.range(t):(t.dates&&t.dates.month?P.range(t):'');
 const av=(t.party||[]).slice(0,3).map(p=>`<span class="av" title="${P.esc(p.name||p.type)}">${P.esc((p.name||p.type[0]).slice(0,1).toUpperCase())}</span>`).join('');
 const stale=P.items(t).some(i=>i.stale);
 return `<article class="card ${ph==='now'?'now':''}" style="--id:${P.esc(t.identity)}" data-id="${P.esc(t.id)}" aria-label="${P.esc(t.title)}">
 <div class="card-top"><div><div class="cap">${P.esc(t.kind||'Trip')}${ph==='now'?' · travelling now':''}</div><h2>${P.esc(t.title)}</h2></div>
 <div class="menu-wrap"><button class="icon-btn" data-act="menu" aria-haspopup="true" aria-label="Menu for ${P.esc(t.title)}">${P.ic('dots')}</button>
 <div class="menu" hidden role="menu"><button data-act="rename" role="menuitem">${P.ic('pen')} Rename</button><button data-act="dup" role="menuitem">${P.ic('copy')} Duplicate</button><button data-act="share" role="menuitem">${P.ic('share')} Share</button><button data-act="del" class="danger" role="menuitem">${P.ic('trash')} Delete</button></div></div></div>
 <div class="facts">${P.hasDates(t)?`<span>${P.ic('cal')} ${P.esc(dates)}</span>`:`<span>${P.ic('cal')} ${dates?P.esc(dates)+' ·':''} <button class="btn ghost sm" style="min-height:32px;padding:0 6px" data-act="dates">Add dates</button></span>`}
  <span>${P.ic('pin')} ${P.esc((t.start&&t.start.city)||'')}</span></div>
 <div class="facts"><span class="avatars" aria-hidden="true">${av}</span><span>${(t.party||[]).length} traveller${(t.party||[]).length===1?'':'s'}</span><span>${t.nights!=null?t.nights:0} night${t.nights===1?'':'s'}</span></div>
 <div class="prog"><div><div class="meta">Bookings ${b.done} of ${b.total}</div><div class="bar" role="progressbar" aria-label="Bookings done" aria-valuenow="${b.done}" aria-valuemax="${b.total}"><i style="width:${b.total?b.done/b.total*100:0}%"></i></div></div>
  <div><div class="meta">Checklist ${c.done} of ${c.total}</div><div class="bar" role="progressbar" aria-label="Checklist done" aria-valuenow="${c.done}" aria-valuemax="${c.total}"><i style="width:${c.total?c.done/c.total*100:0}%"></i></div></div></div>
 ${nd?`<div class="small">Next: <b>${P.esc(nd.b.label)}</b> by ${P.fmt(nd.d,1)}</div>`:''}
 ${stale?`<div><span class="chip crit">A place needs replacing</span></div>`:''}
 <div class="row"><span class="chip info">In Mine</span>${inCtx?'<span class="chip">Open now</span>':''}<span class="sp"></span>${ph==='now'?`<a class="btn sm" href="today.html?id=${encodeURIComponent(t.id)}">Today</a>`:''}<a class="btn pri" href="trip.html?id=${encodeURIComponent(t.id)}" data-act="open">Open</a></div></article>`}
function render(){
 const all=P.order(P.trips()),c=counts(all);
 const list=all.filter(t=>{const p=P.phase(t);return tab==='all'||(tab==='planning'&&p==='planning')||(tab==='past'&&p==='past')||(tab==='upcoming'&&(p==='upcoming'||p==='now'))});
 const T=[['all','All'],['planning','Planning'],['upcoming','Upcoming'],['past','Past']];
 let h=`<div class="wrap"><div class="page-h"><div><div class="cap">In Mine on this device</div><h1>My trips</h1></div><span class="sp"></span><a class="btn" href="/builder/index.html?copy=dolomites">Use a copy of one of our trips</a><a class="btn pri" href="/builder/index.html">${P.ic('plus')} New trip</a></div>`;
 if(!all.length){h+=`<div class="empty"><h2>No trips yet</h2><p class="small" style="max-width:46ch">Start from your own idea, or take a copy of one of our trips and change it. Everything you make stays in Mine.</p><div class="row" style="justify-content:center"><a class="btn pri" href="/builder/index.html">New trip</a><a class="btn" href="/builder/index.html?copy=dolomites">Use a copy of one of our trips</a></div></div>`}
 else{
 h+=`<div class="tabs" role="tablist" aria-label="Trip status">${T.map(([k,l])=>`<button class="tab" role="tab" data-tab="${k}" aria-selected="${tab===k}">${l} <span class="n">${c[k]}</span></button>`).join('')}</div>`;
 if(!list.length){const msg={planning:['Nothing in planning','Trips without dates show here until you add dates.'],upcoming:['Nothing upcoming','Add dates to a planning trip and it moves here.'],past:['No past trips yet','Trips move here after their last day.'],all:['','']}[tab];h+=`<div class="empty"><h2>${msg[0]}</h2><p class="small">${msg[1]}</p></div>`}
 else h+=`<div class="cards">${list.map(card).join('')}</div>`}
 h+=`<p class="meta" style="padding-bottom:32px">Trips live in this browser. <a href="#" data-act="signin">Sign in to keep them on every device.</a></p></div>`;
 app.innerHTML=h;
}
function ctxId(e){const c=e.target.closest('.card');return c&&c.dataset.id}
document.addEventListener('click',e=>{
 const tb=e.target.closest('[data-tab]');if(tb){tab=tb.dataset.tab;history.replaceState(null,'','#'+tab);render();return}
 const a=e.target.closest('[data-act]');if(!a)return;const act=a.dataset.act,id=ctxId(e);
 if(act==='signin'){e.preventDefault();P.sheet('Sign in','<p class="small">The prototype has no accounts. In the product, signing in moves the trips on this device into your account once.</p><div class="sheet-f"><button class="btn pri" data-close>Got it</button></div>');return}
 if(act==='menu'){const m=a.nextElementSibling;const was=m.hidden;document.querySelectorAll('.menu').forEach(x=>x.hidden=true);m.hidden=!was;if(!m.hidden)m.querySelector('button').focus();return}
 if(act==='open'){P.setState(s=>s.ctx=id);return}
 if(act==='dates'){P.addDatesSheet(id,render);return}
 if(act==='share'){P.shareSheet(id);return}
 if(act==='rename'){const t=P.get(id);P.sheet('Rename trip',`<form><div class="field"><label for="rn">Trip name</label><input id="rn" name="n" type="text" required maxlength="60" value="${P.esc(t.title)}"></div><div class="sheet-f"><button type="button" class="btn" data-close>Cancel</button><button class="btn pri">Rename</button></div></form>`,{onSubmit:(fd,close)=>{const n=(fd.get('n')||'').trim();if(n){P.update(id,x=>x.title=n);close();render();P.toast('Renamed')}}});return}
 if(act==='dup'){const a2=P.trips(),i=a2.findIndex(x=>x.id===id),src=a2[i];const cp=JSON.parse(JSON.stringify(src));cp.id=P.uid('t-');cp.title=src.title+' (copy)';cp.updated=new Date().toISOString();cp.inMine=true;
  const pal=['#0072B2','#D55E00','#CC79A7','#0097A7','#E69F00','#56B4E9'];const used=a2.map(x=>x.identity);cp.identity=pal.find(c=>!used.includes(c))||pal[(a2.length)%pal.length];
  (cp.days||[]).forEach(d=>(d.items||[]).forEach(it=>it.id=P.uid('i')));a2.splice(i+1,0,cp);P.save(a2);render();P.toast('Duplicated as "'+cp.title+'"');return}
 if(act==='del'){const a2=P.trips(),i=a2.findIndex(x=>x.id===id),t=a2[i];a2.splice(i,1);P.save(a2);const wasCtx=P.state().ctx===id;if(wasCtx)P.setState(s=>s.ctx=null);render();
  P.toast('Deleted "'+t.title+'"',()=>{const b=P.trips();b.splice(Math.min(i,b.length),0,t);P.save(b);if(wasCtx)P.setState(s=>s.ctx=id);render();P.toast('Restored "'+t.title+'"')});return}
});
window.addEventListener('hashchange',()=>{tab=(location.hash||'').slice(1)||'all';render()});
P.shell({page:'index'});render();
})();
