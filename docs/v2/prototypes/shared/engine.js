/* Prototype engine: simple but real. Cluster to bases, order by nearest neighbour on a drive matrix, fill days to a budget. */
const KINDS={
 day:{label:'Day trip',meta:'by car',mode:'near',nights:0,reach:2,band:[0,0]},
 weekend:{label:'Weekend',meta:'1 or 2 nights · by car',mode:'near',nights:2,reach:3,band:[1,2]},
 long:{label:'Long weekend',meta:'3 or 4 nights · by car',mode:'near',nights:3,reach:4,band:[3,4]},
 weekcar:{label:'A week by car',meta:'from home',mode:'near',nights:7,reach:6,band:[5,8]},
 weekair:{label:'A week by air',meta:'fly somewhere',mode:'trip',nights:7,band:[6,9]},
 holiday:{label:'Longer holiday',meta:'10 to 21 nights',mode:'trip',nights:14,band:[10,21]},
};
const PACE={relaxed:{vis:300,mult:1.2,drive:180,l:'Relaxed'},standard:{vis:420,mult:1,drive:240,l:'Standard'},full:{vis:540,mult:.85,drive:300,l:'Full'}};
const VIBES={easy:['Easy walks',p=>p.diff===1&&p.dur<=150],views:['Big views',p=>p.ic||/lift|gondola|cable|ridge|Peak|Tower|summit|Sass|Seceda/i.test(p.name+p.sub)],lakes:['Lakes and water',p=>/Lago|Lake|Falls|Bow|Canoe|Grotto|beach|cruise|Islands/i.test(p.name+p.sub)],culture:['Culture and indoors',p=>p.in||p.type==='town'],adventure:['Adventure',p=>p.diff>=2||p.type==='activity'],nature:['Parks and nature',p=>p.type==='park'||p.type==='hike']};
const rad=x=>x*Math.PI/180;
function hav(a,b){const dl=rad(b.lat-a.lat),dn=rad(b.lon-a.lon);const h=Math.sin(dl/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dn/2)**2;return 12742*Math.asin(Math.sqrt(h))}
function mtn(a){return a.lat>45.5&&a.lat<47.5&&a.lon>10&&a.lon<13||a.lat>50&&a.lon<-114}
function drive(a,b){if(!a||!b)return 0;const km=hav(a,b);if(km<.5)return 5;const f=(mtn(a)||mtn(b))?1.7:1.3;const spd=km>150?95:km>60?80:60;return Math.max(5,Math.round(km*f/spd*60/5)*5)}
function airDrive(c,ap){const km=hav(c,ap);return Math.max(10,Math.round(km*1.3/65*60/5)*5)}
function fd(m){m=Math.round(m);if(m<60)return m+' min';const h=Math.floor(m/60),r=m%60;return r?h+' h '+String(r).padStart(2,'0'):h+' h'}
function hm(m){m=Math.round(m);return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function sunsetMin(month){if(!month)return null;const[t]=SUNSET[month-1].split(':');const[h,mm]=SUNSET[month-1].split(':').map(Number);return h*60+mm}
/* Sun times come from shared/sun.js (ProtoSun, a port of core/src/sun); the SUNSET table is only the fallback when sun.js is not loaded.
   zoneOf: IANA zone for a point (placeholder data holds Italy and Canada only). dayIso: the date of plan day n (0-based), a mid-month date when only a month is known. */
function zoneOf(pt){const cc=(pt&&pt.cc)||'CA';if(cc==='IT')return'Europe/Rome';if(cc==='IS')return'Atlantic/Reykjavik';if(cc==='CA')return pt.lon<-110?'America/Edmonton':'America/Toronto';return'UTC'}
function dayIso(S,n){const w=whenInfo(S);let t=null;if(w.from){t=new Date(w.from);t.setDate(t.getDate()+n)}else if(w.month){t=new Date(w.month<=10?2027:2026,w.month-1,15);t.setDate(t.getDate()+n)}return t?iso(t):null}
/** sunset in minutes after local midnight for plan day `d` ({n, base}) at its base, or null without a month */
function sunsetFor(S,d){const date=dayIso(S,d.n);if(!date)return null;const b=d.base||S.origin;
 if(typeof ProtoSun==='undefined')return sunsetMin(whenInfo(S).month);
 const pt={lat:b.lat,lon:b.lon,cc:(PL[b.id]&&PL[b.id].cc)||(b.cc)||S.origin.cc};const r=ProtoSun.sunFor(pt.lat,pt.lon,date,zoneOf(pt));return r?r.setMin:null}
/* Departure: S.departAt is the clock time (minutes) of the flight, or of the time you must be home by; default 16:00 by air, 17:00 by car. */
function defaultDepart(S){return S.flyMode==='fly'?16*60:17*60}
/** minutes free on the last day for a stop: depart time minus the airport buffer (2 h 30 by air), the drive to the airport or home, and an 08:30 start */
function departSlack(S,base){const dep=S.departAt==null?defaultDepart(S):S.departAt;return dep-(S.flyMode==='fly'?150:0)-drive(base,endPt(S))-510}
function dateOf(s){const[a,b,c]=s.split('-').map(Number);return new Date(a,b-1,c)}
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function fmtDate(d,long){return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]+' '+d.getDate()+' '+MS[d.getMonth()]+(long?' '+d.getFullYear():'')}
const TODAY=new Date(2026,9,27);
function whenInfo(S){const w=S.when;let month=null,from=null,to=null;
 if(w.type==='dates'&&w.from){from=dateOf(w.from);to=w.to?dateOf(w.to):null;month=from.getMonth()+1}
 else if(w.type==='month')month=w.month;else if(w.type==='next'){from=new Date(2026,10,6);to=new Date(2026,10,8);month=11}
 else if(w.type==='this'){from=new Date(2026,9,30);to=new Date(2026,10,1);month=10}
 return{month,from,to,dated:!!(from&&(w.type==='dates'||w.type==='next'||w.type==='this')),type:w.type}}
function whenLabel(S){const w=whenInfo(S);if(w.type==='dates'&&w.from)return fmtDate(w.from)+(w.to?' to '+fmtDate(w.to):'');if(w.type==='next')return'Next weekend';if(w.type==='this')return'This weekend';if(w.type==='month')return MONTHS[w.month-1];if(w.type==='flex')return'Flexible';return'Not sure yet'}
function nightsOf(S){const w=S.when;if(w.type==='dates'&&w.from&&w.to)return Math.round((dateOf(w.to)-dateOf(w.from))/864e5);return null}
function youngest(S){const k=S.party.filter(t=>t.type!=='adult');if(!k.length)return null;return Math.min(...k.map(t=>t.type==='infant'?0:t.age))}
function counts(S){return{a:S.party.filter(t=>t.type==='adult').length,c:S.party.filter(t=>t.type==='child').length,i:S.party.filter(t=>t.type==='infant').length}}
function partyLabel(S){const c=counts(S);const y=S.party.filter(t=>t.type==='child').map(t=>t.age);const p=[];p.push(c.a+(c.a===1?' adult':' adults'));if(c.c)p.push(c.c+(c.c===1?' child':' children')+' ('+y.join(', ')+')');if(c.i)p.push(c.i+(c.i===1?' infant':' infants'));return p.join(' · ')}
function needs(S,n){return S.party.some(t=>(t.needs||[]).includes(n))}
function eff(S){const y=youngest(S);const pace=S.paceSet?S.pace:((y!==null&&y<6)?'relaxed':'standard');const P=PACE[pace];
 return{pace,P,driveDay:S.driveDay??P.drive,moves:S.movesSet?S.moves:((y!==null&&y<10)?'fewer':'balanced'),paceAuto:!S.paceSet&&pace==='relaxed'}}
/** age in plain words: 0 an infant, 1 to 2 a toddler, else "age N" */
function ageWord(y){return y===0?'an infant':y<=2?'a toddler':'age '+y}
function misfit(S,p){const r=[];const y=youngest(S);if(y!==null&&y<p.kids)r.push('Not suitable for '+ageWord(y));if(needs(S,'stroller')&&!p.s)r.push('No stroller');if(needs(S,'stepfree')&&!p.st)r.push('Not step-free');if(needs(S,'dog')&&!p.dg)r.push('No dogs');if(y!==null&&y<10&&p.diff===3)r.push('Hard hike');return r}
function closedIn(S,p){const m=whenInfo(S).month;return !!(m&&p.cl&&p.cl.includes(m))}
function originPt(S){return S.origin}
function reachMin(S,p){return drive(S.origin,p)}
function regionList(S){if(S.area&&PARKS[S.area])return[PARKS[S.area].reg];return S.regions}
function areaPlaces(S){return PLACES.filter(p=>S.area?p.park===S.area:true)}
function allCandidates(S){ // before filters
 const K=KINDS[S.kind];let list;
 if(S.area)list=PLACES.filter(p=>p.park===S.area);
 else if(K.mode==='near'){const lim=S.reachH*60;list=PLACES.filter(p=>drive(S.origin,p)<=lim);if(S.areas.length)list=list.filter(p=>S.areas.includes(p.area)||p.type==='town'&&S.areas.some(a=>PLACES.some(q=>q.area===a&&drive(q,p)<=60)))}
 else list=PLACES.filter(p=>S.regions.includes(p.reg));
 return list}
function candidates(S){let list=allCandidates(S);const f=S.filt;
 if(S.area)list=list.filter(p=>p.type!=='town');
 if(f.kids&&youngest(S)!==null)list=list.filter(p=>!(youngest(S)<p.kids));
 if(f.stroller||needs(S,'stroller'))list=list.filter(p=>p.s);
 if(f.step||needs(S,'stepfree'))list=list.filter(p=>p.st);
 if(f.dogs||needs(S,'dog'))list=list.filter(p=>p.dg);
 if(f.indoor)list=list.filter(p=>p.in);
 if(!f.hard)list=list.filter(p=>p.diff<3||S.picks.includes(p.id));
 if(S.vibes.length)list=list.filter(p=>p.type==='town'||S.vibes.some(v=>VIBES[v][1](p)));
 const first=needs(S,'first');
 const o=KINDS[S.kind].mode==='near'?(p=>drive(S.origin,p)):(p=>0);
 list.sort((a,b)=>(a.type==='town'?0:1)-(b.type==='town'?0:1)||(first?(b.ic?1:0)-(a.ic?1:0):0)||o(a)-o(b)||a.name.localeCompare(b.name));
 return list}
function nearPicked(S,pid,n=4){const c=PL[pid];if(!c)return[];return candidates(S).concat(S.area?[]:[]).filter(p=>p.id!==pid&&!S.picks.includes(p.id)&&p.type!=='town'&&!closedIn(S,p)&&!misfit(S,p).length).map(p=>({p,m:drive(c,p)})).filter(x=>x.m<=60).sort((a,b)=>a.m-b.m).slice(0,n)}
function withinDriving(S,n=12){const picks=S.picks.map(i=>PL[i]).filter(Boolean);if(!picks.length)return[];const lim=Math.max(30,Math.round(eff(S).driveDay/3));
 const pool=S.area?PLACES.filter(p=>p.park===S.area):PLACES.filter(p=>KINDS[S.kind].mode==='near'?drive(S.origin,p)<=S.reachH*60:S.regions.includes(p.reg));
 return pool.filter(p=>!S.picks.includes(p.id)&&p.type!=='town'&&!closedIn(S,p)&&!misfit(S,p).length).map(p=>{let best=1e9,from=null;picks.forEach(q=>{const m=drive(q,p);if(m<best){best=m;from=q}});return{p,m:best,from}}).filter(x=>x.m<=lim).sort((a,b)=>a.m-b.m).slice(0,n)}
function estimateDays(S){const E=eff(S);const ps=S.picks.map(i=>PL[i]).filter(p=>p&&p.type!=='town');if(!ps.length)return{days:1,nights:0};
 let min=0;ps.forEach(p=>min+=p.dur*E.P.mult+25);const d=Math.max(1,Math.ceil(min/(E.P.vis*.9)));return{days:d,nights:Math.max(0,d-1)}}
/* ---- build ---- */
function poolPlaces(S){const near=KINDS[S.kind].mode==='near';const pr=S.area&&PARKS[S.area]?PARKS[S.area].reg:null;
 return PLACES.filter(p=>p.type!=='town'&&!closedIn(S,p)&&!misfit(S,p).length&&(S.area?p.park===S.area:near?drive(S.origin,p)<=S.reachH*60+60:S.regions.includes(p.reg)||p.reg===pr))}
function lightStop(S,base,exclude){let best=null,bm=1e9;PLACES.filter(p=>p.dur<=90&&!exclude.has(p.id)&&!closedIn(S,p)&&!misfit(S,p).length&&(S.area?(p.park===S.area||p.type==='town'&&p.reg===PARKS[S.area].reg):S.regions.includes(p.reg)||KINDS[S.kind].mode==='near'&&drive(S.origin,p)<=S.reachH*60+60)).forEach(p=>{const m=drive(base,p);if(m<=30&&m<bm){bm=m;best=p}});return best}
function freeDays(plan){return plan.days.filter(d=>!d.items.length&&!d.kind)}
function perms(a){if(a.length<=1)return[a];const r=[];a.forEach((x,i)=>perms(a.slice(0,i).concat(a.slice(i+1))).forEach(p=>r.push([x].concat(p))));return r}
function arrPt(S){return KINDS[S.kind].mode==='trip'&&S.flyMode!=='drive'?AIRPORTS[S.arrive]:S.origin}
function endPt(S){return KINDS[S.kind].mode==='trip'&&S.flyMode!=='drive'?AIRPORTS[S.leave]:S.origin}
function destCc(S){if(S.area&&PARKS[S.area])return PARKS[S.area].cc;if(KINDS[S.kind].mode==='near')return S.origin.cc==='IT'?'IT':'CA';return S.cc}
function flyMode(S){const K=KINDS[S.kind];if(K.mode==='near')return'drive';return S.origin.cc===destCc(S)&&hav(S.origin,{lat:REGIONS[regionList(S)[0]||'dolomites'].lat,lon:REGIONS[regionList(S)[0]||'dolomites'].lon})<700?'drive':'fly'}
function blankDay(n,base,moveFrom,budget){return{n,base,moveFrom,items:[],note:'',used:0,dsum:0,budget}}
function buildPlan(S,prev){
 const K=KINDS[S.kind],E=eff(S);S.flyMode=flyMode(S);
 const N=S.kind==='day'?0:Math.max(1,S.nights),nd=N+1,air=S.flyMode==='fly';
 const keptPrev=new Set(prev?prev.days.flatMap(d=>d.items.filter(it=>it.locked||it.placed||(it.fromTrip&&!S.releaseTrip)).map(it=>it.pid)):[]);
 const misfitOut=[];
 const picks=S.picks.map(i=>PL[i]).filter(p=>p&&!PARKS[p.id]).filter(p=>{if(!prev||keptPrev.has(p.id)||!misfit(S,p).length)return true;misfitOut.push({pid:p.id,reason:misfit(S,p).join(', ')});return false});
 const sights=picks.filter(p=>p.type!=='town');
 const cen=sights.length?{lat:sights.reduce((s,p)=>s+p.lat,0)/sights.length,lon:sights.reduce((s,p)=>s+p.lon,0)/sights.length}:(picks[0]||S.origin);
 let bases=[];
 const home={id:'home',name:S.origin.name,lat:S.origin.lat,lon:S.origin.lon,home:true};
 if(S.kind==='day'){bases=[home]}
 else{
  const regs=new Set(picks.map(p=>p.reg));if(!regs.size)regionList(S).forEach(r=>regs.add(r));
  let cand=PLACES.filter(p=>p.type==='town'&&regs.has(p.reg)&&drive(cen,p)<=170);
  picks.filter(p=>p.type==='town').forEach(t=>{if(!cand.includes(t))cand.push(t)});
  if(!cand.length)cand=PLACES.filter(p=>p.type==='town').sort((a,b)=>drive(cen,a)-drive(cen,b)).slice(0,3);
  const pinned=cand.filter(t=>S.stay[t.id]);
  let k;if(S.kind==='weekend')k=1;else{k=E.moves==='fewer'?Math.ceil(N/6):E.moves==='balanced'?Math.ceil(N/4):Math.ceil(N/3);k=Math.min(k,4)}
  if(S.bases!=='auto')k=+S.bases;k=Math.max(pinned.length,Math.min(k,N,cand.length)||1);
  const cost=set=>sights.reduce((s,p)=>s+Math.min(...set.map(b=>drive(p,b))),0)+set.length*25;
  const set=pinned.slice();
  while(set.length<k){let best=null,bc=1e12;cand.forEach(c=>{if(set.includes(c))return;const v=cost(set.concat([c]))+drive(arrPt(S),c)*.05;if(v<bc){bc=v;best=c}});if(!best)break;set.push(best)}
  const A=arrPt(S),Z=endPt(S);let bo=null,bv=1e12;
  perms(set).forEach(pm=>{let v=drive(A,pm[0])+drive(pm[pm.length-1],Z);for(let i=1;i<pm.length;i++)v+=drive(pm[i-1],pm[i])*1.3;if(v<bv){bv=v;bo=pm}});
  if(S.reverseOnce){bo=bo.slice().reverse();S.reverseOnce=false}
  bases=bo.map(b=>({id:b.id,name:b.name,lat:b.lat,lon:b.lon}));
 }
 // nights per base
 const asg=sights.map(p=>({p,bi:bases.reduce((bi,b,i)=>drive(p,b)<drive(p,bases[bi])?i:bi,0)}));
 let nts;
 if(bases.length===1)nts=[N];else{const w=bases.map((b,i)=>asg.filter(a=>a.bi===i).length+1),W=w.reduce((a,b)=>a+b,0);nts=w.map(x=>Math.max(1,Math.round(N*x/W)));let diff=N-nts.reduce((a,b)=>a+b,0);let g=0;while(diff!==0&&g++<50){const i=diff>0?w.indexOf(Math.max(...w)):nts.indexOf(Math.max(...nts));nts[i]+=diff>0?1:-1;diff+=diff>0?-1:1;if(nts[i]<1){nts[i]=1;}}}
 bases.forEach((b,i)=>b.nights=nts[i]);
 // days
 const vis=E.P.vis;const days=[];
 for(let d=0;d<nd;d++){let bi=0,c=0;if(S.kind!=='day'){for(let i=0;i<bases.length;i++){c+=nts[i];if(d<c){bi=i;break}bi=i}}
  const b=bases[bi];const mf=d>0&&days[d-1].base!==b?days[d-1].base:null;
  let bud=vis;if(nd>1){if(d===0)bud=Math.round(vis*(air?.4:.85));else if(d===N)bud=Math.round(vis*(air?.4:.75));else if(mf)bud=Math.round(vis*.7)}
  const day=blankDay(d,b,mf,bud);day.dsum=0;days.push(day)}
 const limit=S.kind==='day'?Math.max(E.driveDay,S.reachH*120+30):E.driveDay;
 const unfit=[];
 const fixed=new Set();
 // keep what the person placed or locked
 if(prev){prev.days.forEach((pd,di)=>pd.items.forEach(it=>{if(!picks.find(p=>p.id===it.pid)&&!(it.auto&&(it.locked||it.placed)))return;if(!(it.locked||it.placed||(it.fromTrip&&!S.releaseTrip)))return;const d=days[Math.min(di,nd-1)];const p=PL[it.pid];const last=d.items.length?PL[d.items[d.items.length-1].pid]:(d.moveFrom||d.base);const leg=drive(last,p);d.items.push({pid:it.pid,locked:it.locked,placed:it.placed,fromTrip:it.fromTrip,half:it.half});d.used+=leg+p.dur*E.P.mult;d.dsum+=leg;fixed.add(it.pid)}))}
 days.forEach(d=>{if(d.items.length){const l=PL[d.items[d.items.length-1].pid];d.back=drive(l,d.base)}});
 const baseOf=new Map();bases.forEach((b,i)=>{});
 const itemsFree=sights.concat(picks.filter(p=>p.type==='town'&&!bases.find(b=>b.id===p.id))).filter(p=>!fixed.has(p.id));
 const grp=bases.map(()=>[]);itemsFree.forEach(p=>{const bi=bases.reduce((bi,b,i)=>drive(p,b)<drive(p,bases[bi])?i:bi,0);grp[bi].push(p)});
 const musts=id=>S.must[id]?1:0;
 grp.forEach((g,bi)=>{const b=bases[bi];const myDays=days.filter(d=>d.base===b);
  // nearest-neighbour chain from base
  const left=g.slice(),chain=[];let cur=b;while(left.length){let bi2=0;left.forEach((p,i)=>{if(drive(cur,p)-(musts(p.id)?30:0)<drive(cur,left[bi2])-(musts(left[bi2].id)?30:0))bi2=i});const p=left.splice(bi2,1)[0];chain.push(p);cur=p}
  let di=0;const cap=Math.max(1,Math.ceil(chain.length/Math.max(1,myDays.length-(myDays.length>2?1:0))));
  chain.forEach(p=>{let placed=false;
   for(let j=di;j<myDays.length&&!placed;j++){const d=myDays[j];const last=d.items.length?PL[d.items[d.items.length-1].pid]:(d.moveFrom||d.base);const leg=drive(last,p),back=drive(p,d.base);const dur=p.dur*E.P.mult;
    if(d.items.length<cap+(j===myDays.length-1?9:0)&&d.dsum+leg+back<=limit&&d.used+leg+dur<=d.budget){d.items.push({pid:p.id});d.used+=leg+dur;d.dsum+=leg;d.back=back;placed=true;di=j}}
   if(!placed){ // try any day
    for(const d of days){const last=d.items.length?PL[d.items[d.items.length-1].pid]:(d.moveFrom||d.base);const leg=drive(last,p),back=drive(p,d.base),dur=p.dur*E.P.mult;if(d.dsum+leg+back<=limit&&d.used+leg+dur<=d.budget&&(d.base===b||d.base.id!=='x')){d.items.push({pid:p.id});d.used+=leg+dur;d.dsum+=leg;d.back=back;placed=true;break}}}
   if(!placed&&S.must[p.id]){const d=days.slice().sort((a,b)=>a.used-b.used)[0];d.items.push({pid:p.id});d.used+=drive(d.base,p)+p.dur*E.P.mult;placed=true}
   if(!placed)unfit.push({pid:p.id,reason:drive(b,p)*2>limit?'Too far for a day out from your base':'Every day is full'})})});
 // light arrival stop on day 1 when the arrival budget allows
 if(nd>1&&!days[0].items.length){const d0=days[0];const st=air?13*60+drive(AIRPORTS[S.arrive],d0.base)+45:9*60+drive(S.origin,d0.base);const ss=sunsetFor(S,d0)||1110;
  if(st<=Math.min(ss-90,17*60+30)){const ex=new Set(S.picks.concat(days.flatMap(d=>d.items.map(i=>i.pid))));const l=lightStop(S,d0.base,ex);if(l)d0.items.push({pid:l.id,auto:true})}}
 // light stop on the departure day only when the departure time leaves 3 h or more (departSlack)
 if(nd>1&&!days[nd-1].items.length){const dl=days[nd-1];const slack=departSlack(S,dl.base);
  if(slack>=180){const ex=new Set(S.picks.concat(days.flatMap(d=>d.items.map(i=>i.pid))));const l=lightStop(S,dl.base,ex);
   if(l&&drive(dl.base,l)*2+l.dur*E.P.mult<=slack)dl.items.push({pid:l.id,auto:true})}}
 misfitOut.forEach(m=>unfit.push(m));
 const plan={days:days.map(d=>({n:d.n,base:d.base,moveFrom:d.moveFrom,items:d.items,note:(prev&&prev.days[d.n]&&prev.days[d.n].note)||''})),bases,unfit,builtAt:Date.now(),nights:N};
 recalc(plan,S);return plan}
function dayStart(plan,S,d){const air=S.flyMode==='fly';if(d.n===0&&plan.days.length>1){const A=arrPt(S);const m=drive(A,d.base);return air?Math.min(19*60,13*60+(air?airDriveMin(S,d.base):m)+45):9*60+m}
 return d.n===0?8*60+30:8*60+30}
function airDriveMin(S,b){return drive(AIRPORTS[S.arrive],b)}
function recalc(plan,S){const E=eff(S),n=plan.days.length,m=whenInfo(S).month;
 plan.days.forEach(d=>{d.kind=n>1&&d.n===0?'arrival':n>1&&d.n===n-1?'departure':null;let cur=dayStart(plan,S,d);let lunch=false,legs=0;let loc=d.moveFrom||d.base;d.lunchAfter=-1;
  d.items.forEach((it,i)=>{const p=PL[it.pid];if(!p)return;const leg=drive(loc,p);it.leg=leg;legs+=leg;cur+=leg;it.t=cur;it.dur=Math.round(p.dur*E.P.mult*(it.half?.5:1)/5)*5;cur+=it.dur;if(!lunch&&cur>=12*60+30&&cur<=14*60+30){lunch=true;d.lunchAfter=i;cur+=45}loc=p});
  const last=d.n===n-1&&n>1;const tgt=last?(S.flyMode==='fly'?AIRPORTS[S.leave]:S.origin):d.base;
  d.endLeg=last||d.items.length?drive(loc,tgt):0;d.endTo=last?(S.flyMode==='fly'?S.leave:S.origin.name):d.base.name;
  legs+=d.endLeg;d.drive=legs;d.inLeg=(d.n===0&&n>1)?drive(arrPt(S),d.base):0;d.driveTotal=d.drive+d.inLeg;d.end=cur+d.endLeg;d.visit=d.items.reduce((s,i)=>s+(i.dur||0),0);
  d.warns=[];const lim=E.driveDay;
  if(d.drive>lim+10&&n>1||(S.kind==='day'&&d.drive>Math.max(lim,S.reachH*120+30)))d.warns.push({k:'drive',t:'Drives '+fd(d.drive)+', over your '+fd(lim)+' a day',fix:'drive'});
  const ss=sunsetFor(S,d);if(ss&&d.items.length&&cur>ss+10)d.warns.push({k:'sun',t:'Day ends '+fd(cur-ss)+' after sunset ('+hm(ss)+')',fix:'move'});
  d.items.forEach(it=>{const p=PL[it.pid];it.sunWarn=false;it.sunAt=undefined;if(ss&&p&&p.type==='hike'&&it.t+it.dur>ss-30){const after=it.t+it.dur>ss;it.sunWarn=it.t>ss?'starts':after?'after':'near';it.sunAt=hm(ss);d.warns.push({k:'hike',sev:after?'crit':'warn',t:p.name+(it.t>ss?' starts '+hm(it.t)+', after':' ends '+hm(it.t+it.dur)+', '+(after?'after':'within 30 min of'))+' sunset ('+hm(ss)+')',pid:it.pid,fix:'hike'})}});
  if(d.visit>E.P.vis*1.15)d.warns.push({k:'long',t:'Long day: '+fd(d.visit)+' of visiting',fix:'move'});
  d.items.forEach(it=>{const p=PL[it.pid];if(m&&p&&p.cl&&p.cl.includes(m))d.warns.push({k:'closed',t:p.name+' is closed in '+MS[m-1],pid:it.pid,fix:'remove'})});
  d.free=Math.max(0,E.P.vis-d.visit-d.drive*.5)});
 plan.warnCount=plan.days.reduce((s,d)=>s+d.warns.length,0);
 return plan}
function planStats(plan,S){const n=plan.days.length;const act=plan.days.filter(d=>d.items.length);const tot=plan.days.reduce((s,d)=>s+d.drive,0);
 const items=plan.days.flatMap(d=>d.items.map(i=>PL[i.pid])).filter(Boolean);const priced=items.filter(p=>p.pr!==null);const c=counts(S);
 const cost=priced.reduce((s,p)=>s+p.pr*(c.a+c.c*.5),0);const cur=items[0]&&items[0].cc==='IT'?'EUR ':'CAD ';
 return{days:n,avg:act.length?tot/act.length:0,tot,moves:plan.days.filter(d=>d.moveFrom).length,items:items.length,priced:priced.length,free:items.filter(p=>p.pr===0),cost:Math.round(cost),cur,books:bookAhead(plan,S),warns:plan.warnCount}}
function bookAhead(plan,S){const w=whenInfo(S);const out=[];plan.days.forEach(d=>d.items.forEach(it=>{const p=PL[it.pid];if(!p||!p.bk)return;let by=null,label;
 if(w.from&&w.dated){const t=new Date(w.from);t.setDate(t.getDate()+d.n-p.bk[1]);by=t;label=fmtDate(t)}
 else if(w.month){const y=w.month<=10?2027:2026;const t=new Date(y,w.month-1,1);t.setDate(t.getDate()-p.bk[1]);by=t;label='about '+t.getDate()+' '+MS[t.getMonth()]+' ≈ (for early '+MONTHS[w.month-1]+')'}
 out.push({pid:p.id,item:p.bk[0],place:p.name,days:p.bk[1],by,label:label||null,day:d.n+1})}));return out}
/* Calendar text for a plan. Delegates to shared/ics.js (timed events per stop, all-day book-by events); '' when the trip has no dates. */
function icsOf(plan,S){if(typeof ProtoICS==='undefined'||!whenInfo(S).from)return'';const t=toTrip(Object.assign({},S,{plan}));return ProtoICS.build(typeof ProtoContract!=='undefined'?ProtoContract.normalise(t):t).text}
/* planner contract: proto.trips */
function toTrip(S){const p=S.plan;const st=p?planStats(p,S):null;const w=whenInfo(S);const y=S.when;
 const id=S.id;const tripD=p?p.days.map(d=>({n:d.n+1,label:'Day '+(d.n+1)+' · '+d.base.name+(d.moveFrom?' (move day)':''),base:d.base.name,notes:d.note||'',items:d.items.map(it=>{const pl=PL[it.pid];return{id:it.pid,name:pl.name,slug:pl.id,park:pl.park||undefined,time:hm(it.t),durMin:it.dur,driveMin:it.leg,locked:!!it.locked,placed:!!it.placed,mustSee:!!S.must[it.pid],note:''}})})):[];
 const bk=st?st.books.map(b=>({label:b.item+' ('+b.place+')',by:b.by?iso(b.by):(b.days+'d'),link:'#',done:!!(S.done&&S.done['b'+b.pid])})):[];
 const cl=(S.checklist||[]).map(c=>({label:c.label,done:!!c.done}));
 const costs=st?st.free.map(p=>({label:p.name,free:true})).concat(p.days.flatMap(d=>d.items).map(i=>PL[i.pid]).filter(q=>q.pr>0).map(q=>({label:q.name,amount:q.pr}))):[];
 return{id,title:S.title,kind:S.kind,mode:KINDS[S.kind].mode,start:{city:S.origin.name,airport:KINDS[S.kind].mode==='trip'?S.airFrom:undefined},party:S.party.map(t=>({name:t.name||undefined,type:t.type,age:t.type==='child'?t.age:undefined,needs:t.needs||[]})),
  dates:{from:w.dated&&w.from?iso(w.from):undefined,to:w.dated&&w.to?iso(w.to):undefined,month:w.month||undefined,flexible:y.type==='flex'||undefined},nights:S.nights,identity:S.identity,inMine:true,updated:new Date().toISOString(),
  days:tripD,gettingThere:KINDS[S.kind].mode==='trip'?{from:S.airFrom,arrive:S.arrive,leave:S.leave,mode:S.flyMode}:{from:S.origin.name,mode:'drive'},bookings:bk,checklist:cl,costs}}

/* ---- public API (see engine-api.md). Globals above stay for builder.js; the planner uses window.ProtoEngine. ---- */
/** Does place `pid` fit on plan day `di` without breaking the day's drive, visiting or closure limits? Pure: changes nothing.
    Returns {ok, reasons:[string], legMin, backMin, durMin}. */
function fits(S,plan,di,pid,opts){opts=opts||{};const d=plan.days[di],p=PL[pid];
 if(!d||!p)return{ok:false,reasons:['Unknown day or place'],legMin:0,backMin:0,durMin:0};
 const E=eff(S),n=plan.days.length,slack=opts.relax?1.5:1;
 const last=d.items.length?PL[d.items[d.items.length-1].pid]:(d.moveFrom||d.base);
 const leg=drive(last,p),back=drive(p,d.base),dur=Math.round(p.dur*E.P.mult/5)*5*(opts.half?.5:1);
 const lim=(S.kind==='day'?Math.max(E.driveDay,S.reachH*120+30):E.driveDay)*slack;
 const driveNow=d.drive-(d.endLeg||0),reasons=[];
 if(driveNow+leg+back>lim+(n>1?10:0))reasons.push('Drive would pass '+fd(lim)+' a day');
 if((d.visit||0)+dur>E.P.vis*1.15*slack)reasons.push('Visiting would pass '+fd(E.P.vis*1.15*slack)+' a day');
 if(closedIn(S,p))reasons.push('Closed this month');
 const m=misfit(S,p);if(m.length)reasons.push(m.join(', '));
 return{ok:!reasons.length,reasons,legMin:leg,backMin:back,durMin:dur}}
/** Fill empty days (no items, not arrival or departure) in two passes. Pass 1 is strict: a light stop within 30 min of the base.
    Pass 2 relaxes the radius and the limits (1.5x), first with the full duration, then with half the duration (the item gets
    `half:true`, which recalc honours). Mutates plan, returns {plan, filled:[dayIndex], relaxed:[dayIndex filled in pass 2],
    half:[dayIndex filled with a half-day item], stillEmpty:[dayIndex]}. A day in stillEmpty can be removed (nights minus one) or
    given a place by hand. Never touches items the person placed or locked. */
function fillFree(S,plan){const filled=[],relaxed=[],half=[];
 const used=()=>new Set(S.picks.concat(plan.days.flatMap(d=>d.items.map(i=>i.pid))));
 const pool=()=>PLACES.filter(p=>p.type!=='town'&&!closedIn(S,p)&&(S.area?p.park===S.area:S.regions.includes(p.reg)||KINDS[S.kind].mode==='near'&&drive(S.origin,p)<=S.reachH*60+60));
 plan.days.forEach((d,di)=>{if(d.items.length||d.kind)return;
  const ex=used();const strict=lightStop(S,d.base,ex);
  if(strict&&fits(S,plan,di,strict.id).ok){d.items.push({pid:strict.id,auto:true});filled.push(di);recalc(plan,S);return}
  const cands=pool().filter(p=>!ex.has(p.id)).map(p=>({p,m:drive(d.base,p)})).sort((a,b)=>a.m-b.m);
  for(const mode of [{relax:true},{relax:true,half:true}]){
   for(const c of cands){const r=fits(S,plan,di,c.p.id,mode);if(r.ok){d.items.push({pid:c.p.id,auto:true,half:mode.half||undefined});filled.push(di);relaxed.push(di);if(mode.half)half.push(di);recalc(plan,S);return}}}});
 recalc(plan,S);
 return{plan,filled,relaxed,half,stillEmpty:plan.days.map((d,i)=>(!d.items.length&&!d.kind)?i:-1).filter(i=>i>=0)}}
/** Build a plan from nothing; rebuild keeps what was placed or locked in `prev`. */
function build(S){return buildPlan(S,null)}
function rebuild(S,prev){return buildPlan(S,prev)}
window.ProtoEngine={build,rebuild,fillFree,fits,recalc,freeDays,planStats,bookAhead,toTrip,whenInfo,drive,hav,fd,hm,eff,misfit,ageWord,closedIn,lightStop,KINDS,PACE,sunsetFor,departSlack,defaultDepart,icsOf};
