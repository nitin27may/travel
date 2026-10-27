/* PLACEHOLDER DATA: invented for a throwaway prototype. Not researched, not real, do not reuse. */
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const MS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SUNSET=['16:55','17:40','18:20','19:55','20:35','21:00','20:50','20:10','19:15','18:15','16:45','16:25']; // placeholder
const CITIES=[
 {id:'toronto',name:'Toronto',sub:'Ontario, Canada',cc:'CA',lat:43.65,lon:-79.38,hub:true},
 {id:'hamilton',name:'Hamilton',sub:'Ontario, Canada',cc:'CA',lat:43.255,lon:-79.87},
 {id:'ottawa',name:'Ottawa',sub:'Ontario, Canada',cc:'CA',lat:45.42,lon:-75.70,hub:true},
 {id:'montreal',name:'Montreal',sub:'Quebec, Canada',cc:'CA',lat:45.50,lon:-73.57,hub:true},
 {id:'londonon',name:'London',sub:'Ontario, Canada',cc:'CA',lat:42.98,lon:-81.25},
 {id:'vancouver',name:'Vancouver',sub:'British Columbia, Canada',cc:'CA',lat:49.28,lon:-123.12,hub:true},
 {id:'calgary',name:'Calgary',sub:'Alberta, Canada',cc:'CA',lat:51.05,lon:-114.07,hub:true},
 {id:'milan',name:'Milan',sub:'Lombardy, Italy',cc:'IT',lat:45.46,lon:9.19,hub:true},
 {id:'newyork',name:'New York',sub:'USA',cc:'US',lat:40.71,lon:-74.0,hub:true},
 {id:'london',name:'London',sub:'United Kingdom',cc:'GB',lat:51.51,lon:-0.13,hub:true},
];
const AIRPORTS={
 YYZ:{n:'Toronto Pearson',lat:43.677,lon:-79.631,cc:'CA'},YTZ:{n:'Billy Bishop (Toronto Island)',lat:43.628,lon:-79.396,cc:'CA'},
 YHM:{n:'Hamilton John C. Munro',lat:43.173,lon:-79.935,cc:'CA'},BUF:{n:'Buffalo Niagara (US)',lat:42.94,lon:-78.73,cc:'US'},
 YOW:{n:'Ottawa Macdonald-Cartier',lat:45.32,lon:-75.67,cc:'CA'},YUL:{n:'Montreal Trudeau',lat:45.47,lon:-73.74,cc:'CA'},
 YXU:{n:'London (Ontario)',lat:43.03,lon:-81.15,cc:'CA'},YYC:{n:'Calgary',lat:51.113,lon:-114.02,cc:'CA'},YVR:{n:'Vancouver',lat:49.19,lon:-123.18,cc:'CA'},
 MXP:{n:'Milan Malpensa',lat:45.63,lon:8.723,cc:'IT'},LIN:{n:'Milan Linate',lat:45.445,lon:9.277,cc:'IT'},BGY:{n:'Milan Bergamo',lat:45.67,lon:9.70,cc:'IT'},
 JFK:{n:'New York JFK',lat:40.64,lon:-73.78,cc:'US'},EWR:{n:'Newark',lat:40.69,lon:-74.17,cc:'US'},LGA:{n:'New York LaGuardia',lat:40.78,lon:-73.87,cc:'US'},
 LHR:{n:'London Heathrow',lat:51.47,lon:-0.454,cc:'GB'},LGW:{n:'London Gatwick',lat:51.15,lon:-0.19,cc:'GB'},
 VCE:{n:'Venice Marco Polo',lat:45.505,lon:12.352,cc:'IT'},VRN:{n:'Verona Villafranca',lat:45.396,lon:10.888,cc:'IT'},TSF:{n:'Treviso',lat:45.648,lon:12.194,cc:'IT'},
 BZO:{n:'Bolzano (seasonal)',lat:46.46,lon:11.326,cc:'IT'},INN:{n:'Innsbruck (Austria)',lat:47.26,lon:11.344,cc:'AT'},MUC:{n:'Munich (Germany)',lat:48.354,lon:11.786,cc:'DE'},
 FLR:{n:'Florence',lat:43.81,lon:11.2,cc:'IT'},PSA:{n:'Pisa',lat:43.68,lon:10.4,cc:'IT'},
};
// macro regions per country; regions: n = places we hold, status
const COUNTRIES={
 IT:{name:'Italy',macros:[
  {id:'north',name:'Northern Italy',regions:['dolomites','garda','lombardy']},
  {id:'central',name:'Central Italy',regions:['tuscany']},
  {id:'south',name:'Southern Italy',regions:['puglia','amalfi']}]},
 CA:{name:'Canada',macros:[
  {id:'east',name:'Eastern Canada',regions:['ontario']},
  {id:'west',name:'Western Canada',regions:['rockies']}]},
};
const REGIONS={
 dolomites:{name:'Dolomites',cc:'IT',note:'Val Gardena, Cortina, Braies',gw:['VCE','VRN','TSF','BZO','INN','MUC'],rec:['VCE','VRN'],car:'Car needed',lat:46.55,lon:11.9},
 garda:{name:'Lake Garda',cc:'IT',note:'Sirmione, Malcesine, Limone',gw:['VRN','BGY','MXP'],rec:['VRN'],car:'Car useful',lat:45.65,lon:10.7},
 lombardy:{name:'Lombardy lakes',cc:'IT',note:'',gw:['MXP','LIN','BGY'],rec:['MXP'],car:'',lat:45.9,lon:9.2},
 tuscany:{name:'Tuscany',cc:'IT',note:'Siena, Val d\'Orcia',gw:['FLR','PSA'],rec:['FLR'],car:'Car needed',lat:43.3,lon:11.3},
 puglia:{name:'Puglia',cc:'IT',note:'',gw:[],rec:[],car:'',lat:40.9,lon:17.0},
 amalfi:{name:'Amalfi coast',cc:'IT',note:'',gw:[],rec:[],car:'',lat:40.6,lon:14.6},
 ontario:{name:'Ontario',cc:'CA',note:'Muskoka, Niagara, Bruce',gw:['YYZ','YOW','YUL'],rec:['YYZ'],car:'Car needed',lat:44.5,lon:-79.5},
 rockies:{name:'Canadian Rockies',cc:'CA',gw:['YYC','YVR'],rec:['YYC'],car:'Car needed',note:'Banff, Lake O\'Hara, Castle',lat:51.4,lon:-116},
};
// near-mode narrowing areas (Ontario)
const AREAS={muskoka:'Muskoka & Algonquin',niagara:'Niagara',bruce:'Bruce Peninsula',hamilton:'Hamilton',pec:'Prince Edward County',kingston:'Kingston & 1000 Islands',toronto:'Toronto',garda:'Lake Garda',dolomites:'Dolomites',tuscany:'Tuscany'};
// type: town|sight|hike|activity|park. dur minutes (before pace). kids = youngest age that fits. diff 1-3. flags: s stroller, st step-free, dg dogs, in indoor, ic iconic
// bk: [label, days before]; cl: closed months (1-12); pr: price per adult (0 free) or null unknown
function mk(a){return Object.assign({stay:false},a)}
const PLACES=[
 // Dolomites
 {id:'ortisei',name:'Ortisei',type:'town',reg:'dolomites',cc:'IT',lat:46.575,lon:11.671,dur:90,kids:0,diff:1,s:1,st:1,dg:1,ic:1,sub:'Val Gardena town',pr:null},
 {id:'cortina',name:"Cortina d'Ampezzo",type:'town',reg:'dolomites',cc:'IT',lat:46.537,lon:12.136,dur:90,kids:0,diff:1,s:1,st:1,dg:1,ic:1,sub:'Mountain town',pr:null},
 {id:'bolzano',name:'Bolzano',type:'town',reg:'dolomites',cc:'IT',lat:46.498,lon:11.355,dur:120,kids:0,diff:1,s:1,st:1,dg:1,sub:'City in the valley',pr:null},
 {id:'brunico',name:'Brunico',type:'town',reg:'dolomites',cc:'IT',lat:46.796,lon:11.936,dur:90,kids:0,diff:1,s:1,st:1,dg:1,sub:'Pustertal town',pr:null},
 {id:'corvara',name:'Corvara',type:'town',reg:'dolomites',cc:'IT',lat:46.549,lon:11.877,dur:60,kids:0,diff:1,s:1,st:1,dg:1,sub:'Alta Badia village',pr:null},
 {id:'seceda',name:'Seceda lift and ridge',type:'hike',reg:'dolomites',cc:'IT',lat:46.601,lon:11.720,dur:180,kids:5,diff:2,s:0,st:0,dg:1,ic:1,bk:['Seceda lift slot',25],cl:[11],pr:42,sub:'Cable car and ridge walk'},
 {id:'siusi',name:'Alpe di Siusi walk',type:'hike',reg:'dolomites',cc:'IT',lat:46.541,lon:11.620,dur:150,kids:3,diff:1,s:1,st:0,dg:1,ic:1,cl:[11],pr:24,sub:'Europe\'s largest alpine meadow'},
 {id:'tre-cime',name:'Tre Cime di Lavaredo loop',type:'hike',reg:'dolomites',cc:'IT',lat:46.619,lon:12.302,dur:240,kids:7,diff:2,s:0,st:0,dg:1,ic:1,bk:['Tre Cime toll road',14],cl:[11,12,1,2,3,4,5],pr:35,sub:'10 km loop'},
 {id:'braies',name:'Lago di Braies',type:'sight',reg:'dolomites',cc:'IT',lat:46.694,lon:12.085,dur:90,kids:0,diff:1,s:1,st:1,dg:1,ic:1,bk:['Braies car access',10],pr:0,sub:'Lake walk 3.5 km'},
 {id:'funes',name:'Val di Funes',type:'sight',reg:'dolomites',cc:'IT',lat:46.634,lon:11.724,dur:90,kids:0,diff:1,s:1,st:1,dg:1,pr:0,sub:'Church and meadow views'},
 {id:'sorapis',name:'Lago di Sorapis',type:'hike',reg:'dolomites',cc:'IT',lat:46.529,lon:12.213,dur:330,kids:10,diff:3,s:0,st:0,dg:0,cl:[11,12,1,2,3,4,5],pr:0,sub:'Hard day hike'},
 {id:'cinque',name:'Cinque Torri',type:'hike',reg:'dolomites',cc:'IT',lat:46.5,lon:12.04,dur:150,kids:4,diff:1,s:0,st:0,dg:1,bk:['Cinque Torri lift',7],cl:[11],pr:20,sub:'Open-air war museum'},
 {id:'carezza',name:'Lago di Carezza',type:'sight',reg:'dolomites',cc:'IT',lat:46.408,lon:11.577,dur:60,kids:0,diff:1,s:1,st:1,dg:1,pr:0,sub:'Short lake path'},
 {id:'lagazuoi',name:'Lagazuoi cable car',type:'activity',reg:'dolomites',cc:'IT',lat:46.519,lon:12.007,dur:150,kids:3,diff:1,s:1,st:1,dg:0,cl:[11,12],pr:28,sub:'Cable car and tunnels'},
 {id:'gherdeina',name:'Museum Gherdëina',type:'sight',reg:'dolomites',cc:'IT',lat:46.575,lon:11.672,dur:60,kids:5,diff:1,s:1,st:1,dg:0,in:1,pr:8,sub:'Local history, indoors'},
 {id:'otzi',name:'Ötzi museum',type:'sight',reg:'dolomites',cc:'IT',lat:46.498,lon:11.355,dur:90,kids:6,diff:1,s:1,st:1,dg:0,in:1,ic:1,pr:13,sub:'Archaeology museum, indoors'},
 {id:'dobbiaco',name:'Lago di Dobbiaco',type:'sight',reg:'dolomites',cc:'IT',lat:46.73,lon:12.22,dur:60,kids:0,diff:1,s:1,st:1,dg:1,pr:0,sub:'Easy lake loop'},
 {id:'misurina',name:'Lago di Misurina',type:'sight',reg:'dolomites',cc:'IT',lat:46.58,lon:12.255,dur:60,kids:0,diff:1,s:1,st:1,dg:1,pr:0,sub:'Lakeside stop'},
 {id:'renon',name:'Earth pyramids of Renon',type:'activity',reg:'dolomites',cc:'IT',lat:46.54,lon:11.45,dur:120,kids:3,diff:1,s:0,st:0,dg:1,pr:6,sub:'Cable car and short walk'},
 {id:'pordoi',name:'Sass Pordoi lift',type:'activity',reg:'dolomites',cc:'IT',lat:46.49,lon:11.81,dur:120,kids:0,diff:1,s:1,st:1,dg:0,bk:['Sass Pordoi lift slot',5],cl:[11],pr:30,sub:'Summit by cable car'},
 // Garda
 {id:'sirmione',name:'Sirmione',type:'town',reg:'garda',cc:'IT',lat:45.49,lon:10.608,dur:120,kids:0,diff:1,s:1,st:1,dg:1,ic:1,pr:null,sub:'Castle town on a peninsula'},
 {id:'malcesine',name:'Malcesine and Monte Baldo',type:'activity',reg:'garda',cc:'IT',lat:45.76,lon:10.81,dur:180,kids:3,diff:1,s:1,st:1,dg:0,bk:['Monte Baldo lift',3],pr:27,sub:'Rotating cable car'},
 {id:'limone',name:'Limone sul Garda',type:'town',reg:'garda',cc:'IT',lat:45.81,lon:10.79,dur:90,kids:0,diff:1,s:1,st:1,dg:1,pr:null,sub:'Lakeside village'},
 {id:'gardaland',name:'Lago di Tenno',type:'sight',reg:'garda',cc:'IT',lat:45.88,lon:10.77,dur:75,kids:0,diff:1,s:1,st:0,dg:1,pr:0,sub:'Turquoise lake above Garda'},
 // Tuscany
 {id:'siena',name:'Siena',type:'town',reg:'tuscany',cc:'IT',lat:43.318,lon:11.33,dur:180,kids:0,diff:1,s:0,st:0,dg:1,ic:1,pr:null,sub:'Piazza del Campo'},
 {id:'sangi',name:'San Gimignano',type:'town',reg:'tuscany',cc:'IT',lat:43.468,lon:11.043,dur:120,kids:0,diff:1,s:0,st:0,dg:1,pr:null,sub:'Tower town'},
 {id:'orcia',name:"Val d'Orcia drive",type:'sight',reg:'tuscany',cc:'IT',lat:43.07,lon:11.6,dur:150,kids:0,diff:1,s:1,st:1,dg:1,pr:0,sub:'Cypress roads'},
 // Ontario
 {id:'huntsville',name:'Huntsville',type:'town',reg:'ontario',area:'muskoka',cc:'CA',lat:45.327,lon:-79.216,dur:60,kids:0,diff:1,s:1,st:1,dg:1,sub:'Muskoka town',pr:null},
 {id:'tobermory',name:'Tobermory',type:'town',reg:'ontario',area:'bruce',cc:'CA',lat:45.255,lon:-81.665,dur:60,kids:0,diff:1,s:1,st:1,dg:1,sub:'Harbour village',pr:null},
 {id:'notl',name:'Niagara-on-the-Lake',type:'town',reg:'ontario',area:'niagara',cc:'CA',lat:43.255,lon:-79.07,dur:90,kids:0,diff:1,s:1,st:1,dg:1,sub:'Historic town',pr:null},
 {id:'picton',name:'Picton',type:'town',reg:'ontario',area:'pec',cc:'CA',lat:44.0,lon:-77.14,dur:60,kids:0,diff:1,s:1,st:1,dg:1,sub:'Prince Edward County town',pr:null},
 {id:'kingston',name:'Kingston',type:'town',reg:'ontario',area:'kingston',cc:'CA',lat:44.23,lon:-76.48,dur:90,kids:0,diff:1,s:1,st:1,dg:1,ic:1,sub:'Limestone waterfront city',pr:null},
 {id:'algonquin',name:'Lake of Two Rivers beach and trails',type:'park',reg:'ontario',area:'muskoka',park:'algonquin-provincial-park',cc:'CA',lat:45.585,lon:-78.49,dur:210,kids:0,diff:1,s:0,st:0,dg:1,ic:1,bk:['Day-use permit',3],pr:12,sub:'Provincial park, trails and canoes'},
 {id:'arrowhead',name:'Arrowhead Provincial Park',type:'park',reg:'ontario',area:'muskoka',cc:'CA',lat:45.31,lon:-79.22,dur:180,kids:0,diff:1,s:1,st:0,dg:1,bk:['Day-use permit',3],pr:12,sub:'Ice trail in winter, lake swim in summer'},
 {id:'niagara',name:'Niagara Falls',type:'sight',reg:'ontario',area:'niagara',cc:'CA',lat:43.0896,lon:-79.0849,dur:180,kids:0,diff:1,s:1,st:1,dg:0,ic:1,pr:25,sub:'Falls and the boat tour'},
 {id:'grotto',name:'Bruce Peninsula: The Grotto',type:'hike',reg:'ontario',area:'bruce',cc:'CA',lat:45.2,lon:-81.55,dur:240,kids:6,diff:2,s:0,st:0,dg:0,ic:1,bk:['Grotto parking reservation',30],cl:[11,12,1,2,3,4],pr:15,sub:'Cliffs and turquoise cave'},
 {id:'webster',name:"Hamilton: Webster's Falls",type:'sight',reg:'ontario',area:'hamilton',cc:'CA',lat:43.2623,lon:-79.9805,dur:90,kids:0,diff:1,s:0,st:0,dg:1,pr:0,sub:'Waterfall walk'},
 {id:'dundas',name:'Hamilton: Dundas Peak',type:'hike',reg:'ontario',area:'hamilton',cc:'CA',lat:43.2656,lon:-79.9803,dur:120,kids:5,diff:2,s:0,st:0,dg:1,bk:['Conservation area reservation',2],pr:0,sub:'Lookout hike'},
 {id:'sandbanks',name:'Sandbanks Provincial Park',type:'park',reg:'ontario',area:'pec',cc:'CA',lat:43.91,lon:-77.25,dur:240,kids:0,diff:1,s:1,st:0,dg:0,ic:1,bk:['Day-use permit',3],cl:[11,12,1,2,3],pr:15,sub:'Dunes and beach'},
 {id:'elora',name:'Elora Gorge',type:'hike',reg:'ontario',area:'toronto',cc:'CA',lat:43.683,lon:-80.43,dur:150,kids:4,diff:1,s:0,st:0,dg:1,pr:8,sub:'Gorge trail and tubing in summer'},
 {id:'thousand',name:'Thousand Islands cruise',type:'activity',reg:'ontario',area:'kingston',cc:'CA',lat:44.34,lon:-76.14,dur:150,kids:0,diff:1,s:1,st:1,dg:0,cl:[11,12,1,2,3,4],pr:38,sub:'Boat cruise'},
 {id:'rom',name:'Royal Ontario Museum',type:'sight',reg:'ontario',area:'toronto',cc:'CA',lat:43.668,lon:-79.395,dur:180,kids:3,diff:1,s:1,st:1,dg:0,in:1,ic:1,pr:26,sub:'Museum, indoors'},
 {id:'cntower',name:'CN Tower',type:'sight',reg:'ontario',area:'toronto',cc:'CA',lat:43.6426,lon:-79.3871,dur:90,kids:0,diff:1,s:1,st:1,dg:0,in:1,ic:1,bk:['CN Tower timed entry',2],pr:43,sub:'Observation deck'},
 {id:'fort',name:'Fort Henry',type:'sight',reg:'ontario',area:'kingston',cc:'CA',lat:44.2328,lon:-76.4568,dur:120,kids:5,diff:1,s:0,st:0,dg:0,cl:[11,12,1,2,3,4],pr:18,sub:'19th-century fort'},

 // Parks prototype places (PLACEHOLDER). park = slug of /parks-app/park.html?slug=
 {id:'banff-town',name:'Banff townsite',type:'town',reg:'rockies',cc:'CA',lat:51.178,lon:-115.571,dur:90,kids:0,diff:1,s:1,st:1,dg:1,ic:1,sub:'Mountain town',pr:null},
 {id:'lake-louise-village',name:'Lake Louise village',type:'town',reg:'rockies',cc:'CA',lat:51.425,lon:-116.18,dur:60,kids:0,diff:1,s:1,st:1,dg:1,sub:'Village near the lake',pr:null},
 {id:'pincher-creek',name:'Pincher Creek',type:'town',reg:'rockies',cc:'CA',lat:49.485,lon:-113.95,dur:60,kids:0,diff:1,s:1,st:1,dg:1,sub:'Prairie town near Castle',pr:null},
 {id:'lake-louise',name:'Lake Louise',type:'sight',reg:'rockies',park:'banff-national-park',cc:'CA',lat:51.4254,lon:-116.1773,dur:120,kids:0,diff:1,s:1,st:1,dg:1,ic:1,bk:['Lake Louise shuttle',14],pr:0,sub:'Lakeshore walk'},
 {id:'moraine-lake',name:'Moraine Lake',type:'sight',reg:'rockies',park:'banff-national-park',cc:'CA',lat:51.3217,lon:-116.186,dur:120,kids:0,diff:1,s:1,st:1,dg:1,ic:1,bk:['Moraine Lake shuttle',30],cl:[11,12,1,2,3,4,5],pr:0,sub:'Road closed in winter; shuttle only'},
 {id:'johnston-canyon',name:'Johnston Canyon',type:'hike',reg:'rockies',park:'banff-national-park',cc:'CA',lat:51.2455,lon:-115.8397,dur:150,kids:4,diff:1,s:0,st:0,dg:1,ic:1,pr:0,sub:'Catwalk trail to the falls'},
 {id:'banff-gondola',name:'Banff gondola',type:'activity',reg:'rockies',park:'banff-national-park',cc:'CA',lat:51.1465,lon:-115.5708,dur:120,kids:0,diff:1,s:1,st:1,dg:0,bk:['Gondola timed ticket',3],pr:70,sub:'Sulphur Mountain summit'},
 {id:'bow-falls',name:'Bow Falls',type:'sight',reg:'rockies',park:'banff-national-park',cc:'CA',lat:51.1654,lon:-115.5615,dur:45,kids:0,diff:1,s:1,st:1,dg:1,pr:0,sub:'Short riverside stop'},
 {id:'six-glaciers',name:'Plain of Six Glaciers',type:'hike',reg:'rockies',park:'banff-national-park',cc:'CA',lat:51.405,lon:-116.2,dur:300,kids:8,diff:3,s:0,st:0,dg:1,cl:[11,12,1,2,3,4],pr:0,sub:'Long hike to the tea house'},
 {id:'ohara-circuit',name:"Lake O'Hara alpine circuit",type:'hike',reg:'rockies',park:'lake-ohara-area',cc:'CA',lat:51.3567,lon:-116.3425,dur:360,kids:10,diff:3,s:0,st:0,dg:0,bk:["Lake O'Hara bus seat",90],cl:[10,11,12,1,2,3,4,5],pr:0,sub:'High alpine route'},
 {id:'lake-ohara',name:"Lake O'Hara",type:'sight',reg:'rockies',park:'lake-ohara-area',cc:'CA',lat:51.3562,lon:-116.3414,dur:180,kids:5,diff:1,s:0,st:0,dg:0,ic:1,bk:["Lake O'Hara bus seat",90],cl:[10,11,12,1,2,3,4,5],pr:0,sub:'Lake loop'},
 {id:'opabin',name:'Opabin Plateau',type:'hike',reg:'rockies',park:'lake-ohara-area',cc:'CA',lat:51.348,lon:-116.338,dur:240,kids:8,diff:2,s:0,st:0,dg:0,bk:["Lake O'Hara bus seat",90],cl:[10,11,12,1,2,3,4,5],pr:0,sub:'Plateau and viewpoints'},
 {id:'castle-falls',name:'Castle Falls',type:'sight',reg:'rockies',park:'castle-provincial-park',cc:'CA',lat:49.31,lon:-114.35,dur:60,kids:0,diff:1,s:0,st:0,dg:1,pr:0,sub:'Short falls walk'},
 {id:'beaver-mines',name:'Beaver Mines Lake',type:'sight',reg:'rockies',park:'castle-provincial-park',cc:'CA',lat:49.41,lon:-114.18,dur:90,kids:0,diff:1,s:1,st:0,dg:1,pr:0,sub:'Lake and picnic area'},
 {id:'lookout-trail',name:'Lookout Trail',type:'hike',reg:'ontario',area:'muskoka',park:'algonquin-provincial-park',cc:'CA',lat:45.55,lon:-78.55,dur:60,kids:4,diff:1,s:0,st:0,dg:1,pr:0,sub:'1.9 km loop with a view'},
 {id:'spruce-bog',name:'Spruce Bog Boardwalk',type:'hike',reg:'ontario',area:'muskoka',park:'algonquin-provincial-park',cc:'CA',lat:45.57,lon:-78.52,dur:60,kids:0,diff:1,s:1,st:1,dg:1,pr:0,sub:'1.5 km boardwalk'},
 {id:'canoe-lake',name:'Canoe on Canoe Lake',type:'activity',reg:'ontario',area:'muskoka',park:'algonquin-provincial-park',cc:'CA',lat:45.55,lon:-78.75,dur:150,kids:6,diff:1,s:0,st:0,dg:1,cl:[11,12,1,2,3,4],pr:45,sub:'Rental canoe, paddle half a day'},
].map(mk);
const PL={};PLACES.forEach(p=>PL[p.id]=p);
// saved places (Locations list) for "start from a place you saved"
const SAVED=['braies','algonquin','grotto','sirmione'];
// the trip we copy
const OUR_TRIP={id:'dolomites-trip',name:'Dolomites',days:10,nights:9,start:'2027-07-13',picks:['ortisei','cortina','seceda','siusi','tre-cime','braies','funes','cinque','lagazuoi','carezza','gherdeina'],stay:['ortisei','cortina'],pace:'standard',driveDay:240};
// hints (placeholder) by region type and month
const HINTS={
 IT:m=>[ [4,5,6,7,8,9,10].includes(m)?['ok','Lifts and mountain roads open']:m===11?['warn','Many lifts close early Nov; Tre Cime road closed']:[ 'warn','Most summer lifts and passes closed'],
   [7,8].includes(m)?['warn','Busy: book lifts and parking ahead']:['ok','Quieter, easier parking'] ],
 CA:m=>[ [11,12,1,2,3].includes(m)?['warn','Some parks reduce services; boat tours closed']:['ok','Parks and trails open'], [6,7,8].includes(m)?['warn','Busy: day-use permits sell out']:[9,10].includes(m)?['ok','Fall colour, cooler hikes']:['ok','Quieter'] ],
};

const PARKS={
 'banff-national-park':{name:'Banff National Park',hub:'calgary',reg:'rockies',cc:'CA',lat:51.18,lon:-115.57,type:'trip'},
 'lake-ohara-area':{name:"Lake O'Hara area",hub:'calgary',reg:'rockies',cc:'CA',lat:51.356,lon:-116.34,type:'trip'},
 'castle-provincial-park':{name:'Castle Provincial Park',hub:'calgary',reg:'rockies',cc:'CA',lat:49.35,lon:-114.25,type:'trip'},
 'algonquin-provincial-park':{name:'Algonquin Provincial Park',hub:'toronto',reg:'ontario',cc:'CA',lat:45.58,lon:-78.5,type:'near'},
};
