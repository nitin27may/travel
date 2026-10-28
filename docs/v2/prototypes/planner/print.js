(function(){
const E=P.esc,app=document.getElementById('app');
const id=P.q('id')||P.state().ctx,t=P.get(id);
if(!t){app.innerHTML=`<div class="print-page"><div class="empty"><h2>Nothing to print</h2><p class="small">That trip is not on this device.</p><a class="btn pri" href="index.html">My trips</a></div></div>`;return}
document.title='Print · '+t.title;
let prevTheme;
window.addEventListener('beforeprint',()=>{prevTheme=document.documentElement.dataset.theme;document.documentElement.dataset.theme='light'});
window.addEventListener('afterprint',()=>{if(prevTheme)document.documentElement.dataset.theme=prevTheme});
const dated=P.hasDates(t);
const bk=(t.bookings||[]).map(b=>({b,d:P.byDate(t,b)})).sort((x,y)=>(x.d||'9')<(y.d||'9')?-1:1);
app.innerHTML=`<div class="print-page" style="--id:${E(t.identity)}">
<div class="print-bar noprint"><a class="btn" href="trip.html?id=${E(id)}#share">Back to trip</a><button class="btn pri" id="pr">${P.ic('print')} Print</button><button class="hdr-btn" id="theme" style="border-color:var(--line-2);color:var(--ink)" aria-label="Switch theme">${P.ic('moon')}</button><span class="meta">Prototype: the print button opens the browser print dialog, in light colours.</span></div>
<div class="cap">Trip plan</div><h1>${E(t.title)}</h1>
<p class="small">${dated?E(P.range(t)):'Dates to be set'} · ${t.nights!=null?t.nights+' nights':''} · ${E(P.partyText(t))} · from ${E((t.start&&t.start.city)||'')}${t.start&&t.start.airport?' ('+E(t.start.airport)+')':''}</p>
${t.gettingThere&&t.gettingThere.summary?`<p class="small">${E(t.gettingThere.summary)}</p>`:''}
<h2>Itinerary</h2>
${(t.days||[]).map(d=>`<h3>Day ${d.n}${dated?' · '+P.fmt(P.dayDate(t,d.n)):''}: ${E(d.label||'')}</h3><p class="meta">Base: ${E(d.base||'')}</p><table>${(d.items||[]).map(i=>`<tr><td class="t">${E(i.time)}</td><td><b>${E(i.name)}</b>${i.mustSee?' (must-see)':''}${i.locked?' (locked)':''}<br><span class="meta">${+i.driveMin?'Drive '+P.mins(i.driveMin)+' · ':''}${+i.durMin?P.mins(i.durMin):''}${i.note?' · '+E(i.note):''}</span></td></tr>`).join('')||'<tr><td>Nothing planned</td></tr>'}</table>${d.notes?`<p class="note" style="margin-top:6px">Notes: ${E(d.notes)}</p>`:''}`).join('')}
<h2>Bookings</h2>${bk.length?`<table>${bk.map(({b,d})=>`<tr><td class="t"><span class="box ${b.done?'on':''}"></span></td><td><b>${E(b.label)}</b><br><span class="meta">${d?'Book by '+P.fmt(d):dated?'':'Book-by date appears once dates are set'}${b.link?' · '+E(b.link):''}</span></td></tr>`).join('')}</table>`:'<p class="small">No bookings.</p>'}
<h2>Checklist</h2>${(t.checklist||[]).length?`<table>${t.checklist.map(c=>`<tr><td><span class="box ${c.done?'on':''}"></span>${E(c.label)} <span class="meta">${E(c.group||'')}</span></td></tr>`).join('')}</table>`:'<p class="small">Nothing on the list.</p>'}
<p class="meta" style="margin-top:24px">Printed ${P.fmt(P.today())}. Prices, budgets and private notes are not included.</p></div>`;
document.getElementById('pr').onclick=()=>window.print();
const th=document.getElementById('theme');th.onclick=()=>ProtoTheme.toggle();
// proto controls are not needed on the print page
})();
