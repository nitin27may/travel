/* THROWAWAY prototype: shared store, helpers, shell. Not product code. */
(function(){
const P=window.P={};
const KEY='proto.trips', SKEY='proto.planner';
const DAY=864e5, MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
P.esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
P.uid=p=>(p||'x')+Math.random().toString(36).slice(2,8);
P.q=k=>new URLSearchParams(location.search).get(k);
/* icons */
const IC={dots:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',check:'<path d="m5 12 5 5 9-10"/>',chev:'<path d="m6 9 6 6 6-6"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',plus:'<path d="M12 5v14M5 12h14"/>',pen:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',print:'<path d="M7 9V4h10v5M7 17H5v-6h14v6h-2M7 14h10v6H7z"/>',cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',moon:'<path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/>',pin:'<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',nav:'<path d="m4 11 16-7-7 16-2-7z"/>',users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',off:'<path d="M3 3l18 18M8.5 8.5A8 8 0 0 0 5 11M2 8a14 14 0 0 1 6-3.3M12 20h.01M16.5 12.5a5 5 0 0 1 1 1"/>',wifi:'<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 20h.01"/>',share:'<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 11 7.6-3.7M8.2 13l7.6 3.7"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'};
P.ic=(n,c)=>`<svg class="ic ${c||''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]||''}</svg>`;
/* dates (UTC strings YYYY-MM-DD) */
P.parse=s=>new Date(s+'T00:00:00Z');
P.iso=d=>d.toISOString().slice(0,10);
P.add=(s,n)=>P.iso(new Date(P.parse(s).getTime()+n*DAY));
P.diff=(a,b)=>Math.round((P.parse(b)-P.parse(a))/DAY);
P.fmt=(s,short)=>{const d=P.parse(s);return `${DN[d.getUTCDay()]} ${d.getUTCDate()} ${MN[d.getUTCMonth()]}${short?'':' '+d.getUTCFullYear()}`};
P.monthNum=m=>typeof m==='number'?m:(m?+String(m).slice(5,7):null);
P.fmtMonth=m=>{if(typeof m==='number')return MN[m-1];const [y,mo]=String(m).split('-');return `${MN[+mo-1]} ${y}`};
P.range=t=>{const d=t.dates||{};if(d.from&&d.to){const a=P.parse(d.from),b=P.parse(d.to);return a.getUTCMonth()===b.getUTCMonth()&&a.getUTCFullYear()===b.getUTCFullYear()?`${a.getUTCDate()}\u2013${b.getUTCDate()} ${MN[b.getUTCMonth()]} ${b.getUTCFullYear()}`:`${P.fmt(d.from,1)} \u2013 ${P.fmt(d.to)}`}if(d.from)return P.fmt(d.from);if(d.month)return P.fmtMonth(d.month)+(d.flexible?' (flexible)':'');return ''};
P.hasDates=t=>!!(t.dates&&t.dates.from);
P.mins=m=>{m=Math.round(m||0);if(m<60)return m+' min';const h=Math.floor(m/60),r=m%60;return r?`${h} h ${r} min`:`${h} h`};
P.hm=m=>{m=((Math.round(m)%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
P.toMin=t=>{const [h,m]=String(t||'09:00').split(':');return (+h)*60+(+m||0)};
/* store */
P.trips=()=>{try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return []}};
P.save=a=>localStorage.setItem(KEY,JSON.stringify(a));
P.get=id=>P.trips().find(t=>t.id===id);
P.update=(id,fn)=>{const a=P.trips(),t=a.find(x=>x.id===id);if(!t)return null;fn(t);t.updated=new Date().toISOString();P.save(a);return t};
P.state=()=>{try{return JSON.parse(localStorage.getItem(SKEY)||'{}')||{}}catch(e){return {}}};
P.setState=fn=>{const s=P.state();fn(s);localStorage.setItem(SKEY,JSON.stringify(s));return s};
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
P.money=n=>'$'+Math.round(n).toLocaleString('en-CA');
P.totals=t=>{const it=P.items(t);return {nights:t.nights!=null?t.nights:Math.max(0,(t.days||[]).length-1),drive:it.reduce((s,x)=>s+(+x.driveMin||0),0),places:it.length}};
P.dayDrive=d=>(d.items||[]).reduce((s,x)=>s+(+x.driveMin||0),0);
P.abroad=t=>!!(t.gettingThere&&(t.gettingThere.abroad||t.gettingThere.mode==='air'));
P.parkUrl=s=>'/parks-app/park.html?slug='+encodeURIComponent(s);
P.dayColour=i=>['var(--id-blue)','var(--id-vermillion)','var(--id-rose)','var(--id-teal)','var(--id-orange)','var(--id-sky)','var(--id-yellow)'][i%7];
P.order=a=>{const r={now:0,upcoming:1,planning:2,past:3};return a.slice().sort((x,y)=>{const px=r[P.phase(x)],py=r[P.phase(y)];if(px!==py)return px-py;return ((x.dates&&x.dates.from)||'9')<((y.dates&&y.dates.from)||'9')?-1:1})};
/* reality checks */
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
/* sun (approximate, placeholder for core/sun) */
P.sun=(iso,lat)=>{lat=lat||45;const d=P.parse(iso),n=Math.floor((d-Date.UTC(d.getUTCFullYear(),0,0))/DAY);const decl=23.44*Math.sin(2*Math.PI*(284+n)/365)*Math.PI/180,l=lat*Math.PI/180;const h=Math.acos(Math.max(-1,Math.min(1,-Math.tan(l)*Math.tan(decl))))*12/Math.PI;return {rise:P.hm(12*60-h*60),set:P.hm(12*60+h*60),hours:h*2}};
/* seed */
const it=(name,time,dur,drive,o)=>Object.assign({id:P.uid('i'),name,slug:name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),time,durMin:dur,driveMin:drive,locked:false,placed:false,mustSee:false,note:''},o||{});
P.seedTrips=()=>{const now=new Date().toISOString();
const alg={id:'t-algonquin',title:'Algonquin weekend',kind:'Weekend near home',mode:'near',start:{city:'Toronto',airport:'YYZ'},party:[{name:'Nitin',type:'adult',needs:[]},{name:'Asha',type:'adult',needs:[]},{name:'Mira',type:'child',age:6,needs:[]}],dates:{month:'2027-09',flexible:true},nights:2,identity:'#0072B2',inMine:true,updated:now,
 days:[{n:1,label:'Drive up and the first trails',base:'Lake of Two Rivers campground',notes:'',items:[it('Algonquin Visitor Centre','12:30',60,200,{park:'algonquin-provincial-park',note:'Exhibits, a viewing deck and the lunch spot.'}),it('Hardwood Lookout Trail','14:30',45,10,{park:'algonquin-provincial-park',mustSee:true}),it('Spruce Bog Boardwalk','16:00',60,8,{park:'algonquin-provincial-park'})]},
 {n:2,label:'On the water, then the canyon',base:'Lake of Two Rivers campground',notes:'',items:[it('Canoe on Canoe Lake','09:00',240,25,{park:'algonquin-provincial-park',locked:true,note:'Half-day hire, life jackets included.'}),it('Peck Lake Trail','14:30',70,20,{park:'algonquin-provincial-park',stale:true}),it('Barron Canyon Trail','16:30',150,95,{park:'algonquin-provincial-park',placed:true,mustSee:true})]},
 {n:3,label:'Beaver pond and home',base:'Toronto',notes:'',items:[it('Beaver Pond Trail','09:00',60,10,{park:'algonquin-provincial-park'}),it('Drive home to Toronto','11:30',0,210)]}],
 gettingThere:{mode:'car',summary:'About 3 h by car from Toronto, 260 km.',abroad:false},
 bookings:[{label:'Campsite at Lake of Two Rivers',by:155,rule:'Opens 5 months ahead, fills fast',link:'https://reservations.ontarioparks.ca/',done:false,kind:'stay'},{label:'Canoe hire on Canoe Lake',by:21,link:'https://www.algonquinoutfitters.com/',done:false,kind:'activity'},{label:'Ontario Parks day-use permit',by:3,link:'https://reservations.ontarioparks.ca/',done:false,kind:'park',park:'algonquin-provincial-park'}],
 checklist:[{label:'Health cards and insurance',done:true,group:'Documents'},{label:'Bug spray',done:false,group:'Packing'}],costs:[{label:'Campsite, 2 nights',amount:84},{label:'Canoe hire',amount:90},{label:'Day-use permits',amount:null},{label:'Trails and boardwalks',free:true}],notes:''};
const dol={id:'t-dolomites',title:'Dolomites week',kind:'Week by air',mode:'trip',start:{city:'Toronto',airport:'YYZ'},party:[{name:'Nitin',type:'adult',needs:[]},{name:'Asha',type:'adult',needs:[]},{name:'Mira',type:'child',age:9,needs:[]}],dates:{from:'2027-07-13',to:'2027-07-20'},nights:7,identity:'#D55E00',inMine:true,updated:now,
 days:[{n:1,label:'Land and drive to Ortisei',base:'Ortisei',notes:'',items:[it('Collect hire car at Venice airport','10:30',45,0),it('Drive to Ortisei','12:00',0,165),it('Ortisei old town and dinner','18:30',120,5)]},
 {n:2,label:'Seceda ridge',base:'Ortisei',notes:'',items:[it('Seceda cable car and ridge walk','08:30',300,10,{park:'puez-odle-nature-park',locked:true,mustSee:true,note:'Lift slot 08:30. Gusts above 50 km/h: swap for the museum.'}),it('Lunch at Rifugio Firenze','13:30',75,0,{park:'puez-odle-nature-park'}),it('Gherdeina museum','16:30',60,15,{priv:true})]},
 {n:3,label:'Alpe di Siusi',base:'Ortisei',notes:'',items:[it('Alpe di Siusi meadow walk','09:30',180,25,{park:'sciliar-catinaccio-nature-park',mustSee:true}),it('Seiser Alm lunch hut','13:00',75,0),it('Easy loop to Compatsch','15:00',90,0,{placed:true})]},
 {n:4,label:'Tre Cime',base:'Cortina',notes:'',items:[it('Drive to Tre Cime toll road','08:00',0,100),it('Tre Cime loop','09:30',240,15,{park:'tre-cime-nature-park',locked:true,mustSee:true,note:'Toll slot booked; start early.'}),it('Cortina dinner','19:00',90,50)]},
 {n:5,label:'Lago di Braies',base:'Cortina',notes:'',items:[it('Lago di Braies shore path','08:30',120,70,{park:'fanes-sennes-braies-nature-park',mustSee:true}),it('Rowing boat on the lake','11:00',45,0,{priv:true}),it('Drive on to Val di Funes','14:00',0,95)]},
 {n:6,label:'Val di Funes',base:'Ortisei',notes:'',items:[it('Santa Maddalena viewpoint','09:00',60,10,{park:'puez-odle-nature-park'}),it('Odle meadows walk','11:00',150,20,{park:'puez-odle-nature-park'})]},
 {n:7,label:'Bolzano and the last evening',base:'Ortisei',notes:'',items:[it('Otzi the Iceman museum','10:00',120,50),it('Market lunch in Bolzano','12:30',75,5),it('Evening packing and dinner','19:00',90,50)]},
 {n:8,label:'Fly home',base:'Venice',notes:'',items:[it('Drive to Venice airport','07:00',0,170),it('Flight home','12:30',0,0)]}],
 gettingThere:{mode:'air',abroad:true,country:'Italy',summary:'YYZ to Venice (VCE), then a hire car for 2 h 45 min to Ortisei.'},
 bookings:[{label:'Flights YYZ to Venice',by:330,rule:'Fares rise 5 months out',link:'https://www.aircanada.com/',done:true,kind:'flight'},{label:'Ortisei apartment, 5 nights',by:120,link:'https://www.booking.com/',done:true,kind:'stay'},{label:'Cortina apartment, 2 nights',by:100,link:'https://www.booking.com/',done:false,kind:'stay'},{label:'Hire car with child seat',by:90,link:'https://www.rentalcars.com/',done:false,kind:'car'},{label:'Seceda cable car slot',by:42,rule:'Slots open 6 weeks ahead',link:'https://www.seceda.it/',done:false,kind:'activity'},{label:'Tre Cime toll road slot',by:28,rule:'Slots open 4 weeks ahead',link:'https://www.tre-cime.info/',done:false,kind:'activity',park:'tre-cime-nature-park'},{label:'Lago di Braies car access (July)',by:14,link:'https://www.pragsertal.info/',done:false,kind:'park',park:'fanes-sennes-braies-nature-park'}],
 checklist:[{label:'Passports valid 6 months past return',done:true,group:'Documents'},{label:'International driving permit',done:false,group:'Documents'},{label:'Travel insurance, with hiking cover',done:false,group:'Documents'},{label:'Plug adapters (type F/L)',done:false,group:'Documents'},{label:'Rain jackets',done:false,group:'Packing'},{label:'Trekking poles',done:false,group:'Packing'},{label:'Snacks for the drives',done:false,group:'Kids'}],
 costs:[{label:'Flights, 3 people',amount:2400},{label:'Ortisei apartment',amount:1650},{label:'Cortina apartment',amount:640},{label:'Hire car, 8 days',amount:560},{label:'Seceda cable car',amount:96},{label:'Tre Cime toll',amount:30},{label:'Meals',amount:null},{label:'Ridge and meadow walks',free:true}],notes:'Ask Asha about the museum day if the weather turns.'};
const ban={id:'t-banff',title:'Banff long weekend',kind:'Long weekend by car',mode:'near',start:{city:'Calgary',airport:'YYC'},party:[{name:'Nitin',type:'adult',needs:[]},{name:'Asha',type:'adult',needs:[]}],dates:{from:'2026-09-04',to:'2026-09-07'},nights:3,identity:'#CC79A7',inMine:true,updated:now,
 days:[{n:1,label:'Drive west and Tunnel Mountain',base:'Tunnel Mountain campground',notes:'Arrived 15:30, the campsite was great.',items:[it('Drive Calgary to Banff','13:00',0,90),it('Banff town and Bow Falls','15:30',90,10,{park:'banff-national-park'}),it('Tunnel Mountain summit','17:30',90,5,{park:'banff-national-park'})]},
 {n:2,label:'Lakes',base:'Tunnel Mountain campground',notes:'',items:[it('Moraine Lake shuttle and Rockpile','06:30',150,45,{park:'banff-national-park',mustSee:true,locked:true}),it('Lake Louise lakeshore','11:00',120,15,{park:'banff-national-park'}),it('Fairview Lookout','14:00',60,3,{park:'banff-national-park',placed:true})]},
 {n:3,label:'Canyon and Bow Valley',base:'Tunnel Mountain campground',notes:'',items:[it('Johnston Canyon to the Upper Falls','09:00',180,30,{park:'banff-national-park',mustSee:true}),it('Bow Valley Parkway drive','13:00',0,60),it('Sundance Canyon','15:30',90,10,{park:'banff-national-park'})]},
 {n:4,label:'Home',base:'Calgary',notes:'',items:[it('Two Jack Lake breakfast','08:00',60,10,{park:'banff-national-park'}),it('Drive home to Calgary','10:30',0,95)]}],
 gettingThere:{mode:'car',summary:'1 h 30 min west from Calgary on the Trans-Canada.',abroad:false},
 bookings:[{label:'Tunnel Mountain campsite',by:150,link:'https://reservation.pc.gc.ca/',done:true,kind:'stay'},{label:'Moraine Lake shuttle',by:40,link:'https://reservation.pc.gc.ca/',done:true,kind:'activity'},{label:'Parks Canada Discovery Pass',by:7,link:'https://parks.canada.ca/',done:true,kind:'park',park:'banff-national-park'}],
 checklist:[{label:'Discovery Pass printed',done:true,group:'Documents'},{label:'Bear spray',done:true,group:'Packing'},{label:'Layers for cold mornings',done:true,group:'Packing'}],
 costs:[{label:'Campsite, 3 nights',amount:93},{label:'Discovery Pass, 4 days',amount:42},{label:'Moraine Lake shuttle',amount:16},{label:'Hikes',free:true}],notes:'Johnston Canyon: the lower falls were busy, go before 09:00.'};
return [alg,dol,ban]};
P.reseed=()=>P.save(P.seedTrips());
if(!P.trips().length&&!P.state().noSeed)P.reseed();
/* ui helpers */
P.toast=(msg,undo)=>{let w=document.getElementById('toasts');if(!w){w=document.createElement('div');w.id='toasts';w.setAttribute('role','status');document.body.appendChild(w)}
 const el=document.createElement('div');el.className='toast';el.innerHTML=`<span>${P.esc(msg)}</span>${undo?'<button type="button">Undo</button>':''}`;w.appendChild(el);let tm;const kill=()=>{clearTimeout(tm);el.remove()};
 if(undo)el.querySelector('button').onclick=()=>{kill();undo()};tm=setTimeout(kill,undo?9000:3500);return kill};
P.sheet=(title,html,opt)=>{opt=opt||{};document.querySelectorAll('.sheet-wrap').forEach(e=>e.remove());const prev=document.activeElement;const w=document.createElement('div');w.className='sheet-wrap';
 w.innerHTML=`<div class="scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${P.esc(title)}"><div class="sheet-h"><h2>${P.esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${P.ic('x')}</button></div><div class="sheet-b">${html}</div></div>`;
 document.body.appendChild(w);requestAnimationFrame(()=>w.classList.add('open'));
 const esc=e=>{if(e.key==='Escape')close()};
 const close=()=>{w.classList.remove('open');document.removeEventListener('keydown',esc);setTimeout(()=>{w.remove();if(prev&&prev.focus&&document.contains(prev))prev.focus()},200)};
 document.addEventListener('keydown',esc);
 w.addEventListener('click',e=>{if(e.target.closest('[data-close]'))close()});
 const f=w.querySelector('form');if(f)f.addEventListener('submit',e=>{e.preventDefault();opt.onSubmit&&opt.onSubmit(new FormData(f),close,f)});
 const first=w.querySelector('input,select,textarea');setTimeout(()=>first&&first.focus(),60);if(opt.mount)opt.mount(w,close);return {el:w,close}};
document.addEventListener('click',e=>{document.querySelectorAll('.menu:not([hidden])').forEach(m=>{if(!m.parentElement.contains(e.target))m.hidden=true});const sw=document.getElementById('switcher');if(sw&&!sw.hidden&&!e.target.closest('#switcher,#chip'))sw.hidden=true});
/* dates sheet and calendar */
P.addDatesSheet=(id,done)=>{const t=P.get(id);if(!t)return;const n=t.nights!=null?t.nights:2;
 P.sheet(P.hasDates(t)?'Change dates':'Add dates',`<form><p class="small" style="margin-bottom:16px">${P.esc(t.title)}. Dates unlock book-by dates, opening-hours checks and the calendar file.</p><div class="field"><label for="d-from">First day</label><input id="d-from" name="from" type="date" required value="${P.esc((t.dates&&t.dates.from)||'')}"></div><div class="field"><label for="d-nights">Nights</label><input id="d-nights" name="nights" type="number" min="0" max="60" value="${n}"></div><p class="meta" id="d-to-note"></p><div class="sheet-f"><button type="button" class="btn" data-close>Cancel</button><button class="btn pri">Save dates</button></div></form>`,
 {mount:(w)=>{const upd=()=>{const f=w.querySelector('#d-from').value,nn=+w.querySelector('#d-nights').value||0;w.querySelector('#d-to-note').textContent=f?`Last day ${P.fmt(P.add(f,nn))}`:''};w.addEventListener('input',upd);upd()},
 onSubmit:(fd,close)=>{const from=fd.get('from'),nn=+fd.get('nights')||0;if(!from)return;P.update(id,t=>{t.dates={from,to:P.add(from,nn)};t.nights=nn});close();P.toast('Dates added. Book-by dates are now on Bookings.');done&&done()}})};
P.ics=t=>{const esc=s=>String(s||'').replace(/([,;\\])/g,'\\$1').replace(/\n/g,'\\n'),ymd=s=>s.replace(/-/g,'');const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Trip Plans prototype//EN','CALSCALE:GREGORIAN'];const stamp=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
 const ev=(uid,d,sum,desc)=>L.push('BEGIN:VEVENT','UID:'+uid+'@proto.trips','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+ymd(d),'DTEND;VALUE=DATE:'+ymd(P.add(d,1)),'SUMMARY:'+esc(sum),'DESCRIPTION:'+esc(desc),'END:VEVENT');
 (t.days||[]).forEach(d=>{const dt=P.dayDate(t,d.n);if(dt)ev(t.id+'-d'+d.n,dt,`${t.title}: Day ${d.n}, ${d.label||''}`,(d.items||[]).map(i=>`${i.time} ${i.name}`).join('\n'))});
 (t.bookings||[]).forEach((b,i)=>{const d=P.byDate(t,b);if(d&&!b.done)ev(t.id+'-b'+i,d,`Book by today: ${b.label} (${t.title})`,b.link||'')});L.push('END:VCALENDAR');return L.join('\r\n')};
P.download=(name,text,type)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type||'text/calendar'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
P.addToCalendar=t=>{P.download((t.title||'trip').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.ics',P.ics(t));P.toast('Calendar file downloaded: days and book-by dates.')};
P.copyLink=url=>{const done=()=>P.toast('Link copied');if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(done,()=>{window.prompt('Copy this link',url)});else window.prompt('Copy this link',url)};
P.shareUrl=id=>location.origin+'/planner/trip.html?id='+encodeURIComponent(id)+'&shared=1';
P.shareSheet=id=>{const t=P.get(id);if(!t)return;const hidden=P.items(t).filter(i=>i.priv).length;
 P.sheet('Share '+t.title,`<p class="small">Anyone with the link sees the days and public places only. Your party, bookings, costs and notes stay private.</p>${hidden?`<p class="callout warn small" style="margin-top:12px">${hidden} place${hidden>1?'s are':' is'} not public and will not show to the viewer.</p>`:''}<div class="field" style="margin-top:12px"><label for="sl">Link</label><input id="sl" type="text" readonly value="${P.esc(P.shareUrl(id))}"></div><div class="sheet-f"><a class="btn" href="${P.esc(P.shareUrl(id))}" target="_blank" rel="noopener">Preview shared view</a><button class="btn pri" data-copy>Copy link</button></div>`,{mount:w=>w.querySelector('[data-copy]').onclick=()=>P.copyLink(P.shareUrl(id))})};
/* context switcher: switching keeps the page and the tab */
P.tabMemory=id=>(P.state().tab||{})[id];
P.go=id=>{const page=location.pathname.split('/').pop()||'index.html';const q='?id='+encodeURIComponent(id);P.setState(s=>s.ctx=id);
 if(page==='trip.html')location.href='trip.html'+q+(location.hash||'#'+(P.tabMemory(id)||'overview'));
 else if(page==='today.html')location.href='today.html'+q;
 else if(page==='print.html')location.href='print.html'+q;
 else location.href='trip.html'+q+'#'+(P.tabMemory(id)||'overview')};
P.shell=function(o){o=o||{};const trips=P.trips(),st=P.state();const ctx=o.trip||trips.find(t=>t.id===st.ctx)||null;
 const page=o.page||'';const h=document.createElement('header');h.className='hdr';
 const chip=ctx?`<button class="hdr-btn chip-trip" id="chip" aria-haspopup="true" aria-expanded="false" aria-label="Current trip: ${P.esc(ctx.title)}. Switch trip"><span class="dot" style="background:${P.esc(ctx.identity||'')}"></span><span class="t">${P.esc(ctx.title)}</span><span class="d">${P.esc(P.range(ctx)||'No dates')}</span>${P.ic('chev')}</button>`:`<button class="hdr-btn chip-trip" id="chip" aria-haspopup="true" aria-expanded="false"><span class="t">No trip open</span>${P.ic('chev')}</button>`;
 h.innerHTML=`<div class="hdr-in"><a class="brand" href="index.html">Trip Plans</a><nav aria-label="Main"><a href="index.html" ${page==='index'?'aria-current="page"':''}>My trips</a>${ctx?`<a href="trip.html?id=${encodeURIComponent(ctx.id)}" ${page==='trip'?'aria-current="page"':''}>Plan</a><a href="today.html?id=${encodeURIComponent(ctx.id)}" ${page==='today'?'aria-current="page"':''}>Today</a>`:''}</nav><span class="sp"></span>${o.shared?'<span class="chip">Shared view</span>':chip}<button class="hdr-btn" id="theme" aria-label="Switch theme">${P.ic('moon')}</button></div>`;
 document.body.prepend(h);
 const th=document.getElementById('theme');const setIc=()=>{th.innerHTML=P.ic(document.documentElement.dataset.theme==='dark'?'sun':'moon')};setIc();
 th.onclick=()=>{const n=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=n;try{localStorage.setItem('travel:v1:theme',n)}catch(e){}setIc()};
 if(!o.shared){
 const sw=document.createElement('div');sw.id='switcher';sw.hidden=true;sw.setAttribute('role','menu');
 sw.innerHTML=`<div class="cap" style="padding:6px 12px">Switch trip. You stay on the same page.</div>`+P.order(trips).map(t=>{const nd=P.nextDeadline(t),ph=P.phase(t);return `<button class="sw-item" role="menuitem" data-sw="${P.esc(t.id)}" ${ctx&&ctx.id===t.id?'aria-current="true"':''}><span class="dot" style="background:${P.esc(t.identity)}"></span><span style="flex:1"><b>${P.esc(t.title)}</b><span class="meta">${P.esc(P.range(t)||'No dates')}${ph==='now'?' · travelling now':''}${nd?' · next: '+P.esc(nd.b.label)+' by '+P.fmt(nd.d,1):''}</span></span>${ctx&&ctx.id===t.id?P.ic('check'):''}</button>`}).join('')+`<div class="sw-foot"><a class="btn sm" href="index.html">All my trips</a><a class="btn sm" href="/builder/index.html">New trip</a></div>`;
 document.body.appendChild(sw);
 const chipEl=document.getElementById('chip');chipEl.onclick=()=>{sw.hidden=!sw.hidden;chipEl.setAttribute('aria-expanded',String(!sw.hidden))};
 sw.addEventListener('click',e=>{const b=e.target.closest('[data-sw]');if(b){if(o.beforeSwitch)o.beforeSwitch();P.go(b.dataset.sw)}})}
 /* prototype drawer */
 const pb=document.createElement('button');pb.id='proto-btn';pb.textContent='Prototype controls';pb.setAttribute('aria-expanded','false');document.body.appendChild(pb);
 const dr=document.createElement('div');dr.id='proto-drawer';dr.hidden=true;dr.setAttribute('role','region');dr.setAttribute('aria-label','Prototype controls');
 dr.innerHTML=`<div class="cap" style="margin-bottom:8px">Prototype controls</div><div class="field"><label for="pt">Today's date${st.today?' (set by you)':' (real date)'}</label><input id="pt" type="date" value="${P.today()}"></div><button class="btn sm" id="pt-set">Set today</button><button class="btn sm" id="pt-real">Use real date</button><hr style="border:0;border-top:1px solid var(--line);margin:12px 0"><button class="btn sm" id="p-reseed">Reseed demo data</button><button class="btn sm" id="p-clear">Clear all trips</button><button class="btn sm" id="p-off">Offline badge: ${st.offline?'on':'off'}</button><p class="meta" style="margin-top:8px">Reseed and Clear replace every trip in this browser, including builder drafts.</p>`;
 document.body.appendChild(dr);
 pb.onclick=()=>{dr.hidden=!dr.hidden;pb.setAttribute('aria-expanded',String(!dr.hidden))};
 dr.querySelector('#pt-set').onclick=()=>{const v=dr.querySelector('#pt').value;if(v){P.setState(s=>s.today=v);location.reload()}};
 dr.querySelector('#pt-real').onclick=()=>{P.setState(s=>{delete s.today});location.reload()};
 dr.querySelector('#p-reseed').onclick=()=>{P.setState(s=>{delete s.noSeed;s.ctx=null});P.reseed();location.href='index.html'};
 dr.querySelector('#p-clear').onclick=()=>{P.setState(s=>{s.noSeed=true;s.ctx=null});P.save([]);location.href='index.html'};
 dr.querySelector('#p-off').onclick=()=>{P.setState(s=>s.offline=!s.offline);location.reload()};
 if(o.bottomBar)document.body.classList.add('has-bar');
};
})();
