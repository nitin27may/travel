/* THROWAWAY prototype data: the ONE source for the index and the park page (facts() below feeds both). Nothing here is researched
   except where the repo holds it; every record or row that is invented carries a flag (ph:true on the row, placeholder:true on a
   park) and the page prints a 'Placeholder' tag for it. The word itself never appears inside a value (a test greps for that),
   and every URL is a placeholder URL (U()). Levels: 'full' = every section; 'basics' = compact page with the explicit Basics only state. */
(function () {
  var KINDS = {
    trail: ['trail', 'trails', 'hiking and walking'], lake: ['lake', 'lakes', 'paddling and shores'],
    view: ['view', 'views', 'viewpoints and summits'], waterfall: ['waterfall', 'waterfalls', 'falls and canyons'],
    lift: ['lift', 'lifts', 'gondolas and chairs'], other: ['other place', 'other places', 'cycling, sights and more']
  };
  function items(a) { return a.map(function (s) { var pt = s.charAt(0) !== '~'; if (!pt) s = s.slice(1); var p = s.split('|'); return { name: p[0], chips: p.slice(1), pt: pt }; }); }
  function kinds(o) { return Object.keys(o).map(function (k) { return { id: k, count: o[k][0], items: items(o[k][1]) }; }); }
  function U(slug, key) { return 'https://example.org/placeholder/' + slug + '/' + key; }

  var PARKS = [
    { slug: 'banff-national-park', name: 'Banff National Park', kind: 'national', cc: 'CA', country: 'Canada', rc: 'ab', region: 'Alberta', authority: 'Parks Canada',
      level: 'full', entry: 'fee_book_ahead', places: 56, pts: 56, drive: { calgary: 90 }, ll: [51.18, -115.57], worth: 1,
      season: { kind: 'none' },
      glanceCamp: { v: '4 campgrounds', s: 'reserve ahead', ph: true }, gateway: { town: 'Banff', note: 'inside the park, 0.2 km' }, airport: { code: 'YYC', name: 'Calgary', drive: '1 h 30', ph: true },
      areas: [{ slug: 'lake-louise-area', name: 'Lake Louise area', nolink: true }],
      trips: [{ name: 'Canadian Rockies', days: 'Days 3 to 6 and 9 to 11' }],
      rows: [
        { g: 'fees', cls: 'price', name: 'Daily admission', chip: 'Buy any time', who: 'Everyone entering, every season · per person, per day', price: 'CAD 12.25 adult · 10.75 senior · 24.50 family or group · 17 and under free (2026)', cov: 'Discovery Pass covers it (also Jasper, Yoho, Kootenay)', ex: 'Not needed: through traffic on Highways 1 and 93 South', link: 'Fees page', read: '2026-10-27' },
        { g: 'fees', cls: 'price', name: 'Parks Canada Discovery Pass', chip: 'Buy any time', who: '12 months from purchase', price: 'CAD 83.50 adult · 167.50 family (2026)', cov: 'Covers daily admission here and at 3 other parks we hold', link: 'Buy', read: '2026-10-27' },
        { g: 'book', cls: 'window', name: 'Moraine Lake shuttle seat', chip: 'Launch day, usually April', who: 'Moraine Lake · day visitors (private cars are not allowed)', price: 'Opens on a launch day each year, usually in April, at 08:00 local (40% of seats); then 2 days before, at 08:00 local (60%)', cov: 'In force 1 Jun to 12 Oct · CAD 12.75 adult', link: 'Book', read: '2026-10-27', season: 'the 2026 season' },
        { g: 'day', cls: 'price', name: 'Display your pass', chip: 'On the day', who: 'Every vehicle parked in the park', price: 'Hang the pass from the rear-view mirror; wardens check lots at Lake Louise and Moraine Lake', link: 'Rules', read: '2026-10-27' }
      ],
      safety: { wildlife: null, alerts: 'Parks Canada alerts' },
      closures: [{ member: 'Johnston Canyon', msg: 'trail, day-use area and P1 lot', from: '2026-10-13', to: '2026-12-11', read: '2026-10-27' }],
      services: ['Moraine Lake shuttle runs 1 Jun to 12 Oct (weather permitting)'],
      camps: [
        { name: 'Tunnel Mountain Village I', sites: '618 sites', chip: 'Opens in January', who: 'Tents and RVs · near Banff townsite', price: 'CAD 29.50 to 39.50 per night', win: 'Reservations open mid-January for the season, 08:00 local', read: '2026-10-27', link: 'Reserve', ph: true },
        { name: 'Two Jack Lakeside', sites: '74 sites', chip: 'Opens in January', who: 'Tents and RVs · lake views', price: 'CAD 29.50 per night', win: 'Reservations open mid-January for the season, 08:00 local', read: '2026-10-27', link: 'Reserve', ph: true },
        { name: 'Johnston Canyon', sites: '132 sites', chip: 'Opens in January', who: 'Tents and RVs · closed with the canyon trail in some years', price: 'CAD 29.50 per night', win: 'Reservations open mid-January for the season, 08:00 local', read: '2026-10-27', link: 'Reserve', ph: true },
        { name: 'Lake Louise Tent', sites: '206 sites', chip: 'Opens in January', who: 'Hard-sided and tent sites', price: 'CAD 29.50 per night', win: 'Reservations open mid-January for the season, 08:00 local', read: '2026-10-27', link: 'Reserve', ph: true }
      ],
      gatewayTowns: 'Banff (inside the park)',
      transit: ['Lake Louise Park and Ride', 'Lake Connector', 'Roam 8X'],
      todo: kinds({
        trail: [17, ['Johnston Canyon|From about 4|Easy · 5 km', 'Lake Agnes Teahouse|From about 6|Moderate · 7 km', 'Plain of Six Glaciers|From about 8|Moderate · 14 km', 'Larch Valley|From about 8|Moderate · 9 km', 'Tunnel Mountain|From about 4|Easy · 4 km', 'Sulphur Mountain|From about 7|Hard · 11 km', 'Bow Falls Loop|From about 4|Easy · 3 km', 'Cory Pass|From about 11|Hard · 13 km']],
        lake: [6, ['Moraine Lake|All ages', 'Lake Louise|All ages', 'Lake Minnewanka|All ages', 'Peyto Lake|All ages', 'Bow Lake|All ages', 'Two Jack Lake|All ages']],
        view: [5, ['Bow Summit|All ages', 'Surprise Corner|All ages', 'Vermilion Lakes|All ages', 'Mount Norquay lookout|All ages', 'Mount Rundle viewpoint|All ages']],
        waterfall: [2, ['Bow Falls|All ages', 'Panther Falls|Easy · 1 km']],
        lift: [3, ['Banff Gondola|From about 5', 'Lake Louise Gondola|From about 5', 'Mount Norquay Sightseeing Lift|From about 5']],
        other: [4, ['Bow Valley Parkway|Cycling · Easy', 'Cave and Basin|Sight', 'Banff Upper Hot Springs|Sight', 'Icefields Parkway|Scenic drive']]
      }),
      notChecked: [['Seasons', 'operating season, gate hours'], ['Safety', 'wildlife rules, food storage'], ['Glance', 'summary, photo, designations']],
      sources: [['Parks Canada: Banff official page', '27 Oct 2026'], ['Fees and passes', '27 Oct 2026'], ['Current alerts', '27 Oct 2026']] },

    { slug: 'lake-ohara-area', name: "Lake O'Hara area", kind: 'zone', cc: 'CA', country: 'Canada', rc: 'bc', region: 'British Columbia', authority: 'Parks Canada',
      parent: { slug: 'yoho-national-park', name: 'Yoho National Park' },
      level: 'full', entry: 'fee_book_ahead', places: 6, pts: 6, drive: { calgary: 195 }, ll: [51.35, -116.34], worth: 20,
      season: { kind: 'seasonal', windows: [['2026-06-19', '2026-10-04']], label: 'Jun to Oct', from: '19 Jun', to: '4 Oct', read: '2026-03-02',
        banner: 'The day-use bus runs 19 Jun to 4 Oct (2026 season); the next lottery is usually in early March.' },
      glanceCamp: { v: '1 campground', s: 'lottery', ph: true }, gateway: { town: 'Field', note: 'about 25 km from the day-use bus start', ph: true }, airport: { code: 'YYC', name: 'Calgary', drive: '3 h 15', ph: true },
      trips: [],
      rows: [
        { g: 'book', cls: 'window', name: "Lake O'Hara day-use bus", chip: 'Lottery, usually in March', who: 'Day visitors', price: 'CAD 25.50 per person return · CAD 10 per draw application', cov: 'Lottery: apply usually 2 to 23 Mar at 08:00 local; seats left after the draw until 15:30 the day before · In force 19 Jun to 4 Oct', ex: 'Walking in instead: 22 km return on the fire road', link: 'Booking page', read: '2026-03-02', season: 'the 2026 season' },
        { g: 'fees', cls: 'price', inh: 'Yoho National Park', name: 'Daily admission', chip: 'Buy any time', who: 'Everyone entering · Discovery Pass covers it', price: 'CAD 12.25 adult · 17 and under free (2026)', link: 'Fees page', read: '2026-03-02' }
      ],
      safety: { wildlife: null, alerts: 'Parks Canada alerts for Yoho' },
      closures: [], services: ['The bus is the only motor access; the road is closed to private vehicles'],
      camps: [{ name: "Lake O'Hara Campground", sites: '30 sites', chip: 'Lottery, usually in March', who: 'Tents only · by bus', price: 'CAD 12 per person per night', win: 'Reservations by phone, opening in March', read: '2026-03-02', link: 'Reserve', ph: true }],
      gatewayTowns: 'Field', transit: [],
      todo: kinds({
        trail: [4, ["Opabin Plateau Circuit|Moderate · 8 km", 'Lake McArthur|Moderate · 7 km', 'Lake Oesa|Moderate · 6 km', 'Yukness Ledge|Moderate · 6 km']],
        lake: [2, ["Lake O'Hara|All ages", 'Lake Oesa|All ages']]
      }),
      notChecked: [['Safety', 'wildlife rules, food storage'], ['Glance', 'summary, photo']],
      sources: [["Parks Canada: Lake O'Hara", '2 Mar 2026'], ['Fees page', '2 Mar 2026']] },

    { slug: 'castle-provincial-park', name: 'Castle Provincial Park', kind: 'provincial', cc: 'CA', country: 'Canada', rc: 'ab', region: 'Alberta', authority: 'Alberta Parks',
      level: 'basics', entry: 'not_checked', places: 3, pts: 2, drive: { calgary: 165 }, ll: [49.35, -114.2], worth: 40,
      season: { kind: 'none' }, trips: [{ name: 'Canadian Rockies', days: 'Day 14' }],
      alerts: 'Alberta Parks alerts',
      todo: kinds({ trail: [2, ['Table Mountain Trail|Moderate', '~Windsor Mountain Trail|Hard']], lake: [1, ['Beaver Mines Lake|All ages']] }),
      notChecked: [['Season', 'operating season'], ['Entry and pass', 'fees, passes'], ['Camping', 'campgrounds'], ['Safety and wildlife', 'bears, fire bans'], ['Getting there', 'airport and drive'], ['Summary and photo', '']],
      sources: [['Alberta Parks: Castle', '27 Oct 2026']] },

    { slug: 'algonquin-provincial-park', name: 'Algonquin Provincial Park', kind: 'provincial', cc: 'CA', country: 'Canada', rc: 'on', region: 'Ontario', authority: 'Ontario Parks', placeholder: true,
      level: 'full', entry: 'fee_book_ahead', places: 120, pts: 120, drive: { toronto: 170 }, ll: [45.58, -78.36], worth: 3,
      season: { kind: 'seasonal', windows: [['2026-05-15', '2026-10-15']], label: 'May to Oct', from: '15 May', to: '15 Oct', read: '2026-09-10',
        exceptions: 'Open in winter: Mew Lake campground (yurts), day use along Highway 60' },
      glanceCamp: { v: '5 campgrounds', s: 'book ahead' }, gateway: { town: 'Whitney', note: 'east gate' }, airport: { code: 'YYZ', name: 'Toronto Pearson', drive: '3 h 10', ph: true },
      trips: [],
      rows: [
        { g: 'fees', cls: 'price', name: 'Day-use vehicle permit', chip: 'Buy any time', who: 'Every vehicle stopping in the Highway 60 corridor · per day', price: 'CAD 21 per vehicle (2026)', cov: 'Seasonal permit also sold', ex: 'Not needed: through traffic that does not stop', link: 'Fees page', read: '2026-05-04' },
        { g: 'book', cls: 'window', name: 'Backcountry canoe route permit', chip: '5 months ahead', who: 'Overnight paddlers · per person per night', price: 'CAD 12.50 per person per night', cov: 'Reservations open 5 months ahead of the first night at 07:00 local', link: 'Reserve', read: '2026-09-10', season: 'the 2026 season' },
        { g: 'day', cls: 'price', name: 'Display your permit', chip: 'On the day', who: 'Every vehicle', price: 'Place the permit on the dashboard, face up', read: '2026-05-04' }
      ],
      safety: { wildlife: 'Black bears and moose live here: keep food in the car or bear-proof lockers; do not feed wildlife.', alerts: 'Ontario Parks alerts' },
      closures: [{ member: 'Barron Canyon Trail', msg: 'trail, for bridge repair', from: '2026-11-02', to: '2026-12-15', read: '2026-10-25' }],
      services: ['Highway 60 corridor campgrounds run mid-May to mid-October'],
      camps: [
        { name: 'Canisbay Lake', sites: '241 sites', chip: '5 months ahead', who: 'Tents and RVs · Highway 60 corridor', price: 'CAD 47 per night', win: 'Reservations open 5 months ahead at 07:00 local', read: '2026-09-10', link: 'Reserve' },
        { name: 'Lake of Two Rivers', sites: '240 sites', chip: '5 months ahead', who: 'Tents and RVs · near the Visitor Centre', price: 'CAD 47 per night', win: 'Reservations open 5 months ahead at 07:00 local', read: '2026-09-10', link: 'Reserve' },
        { name: 'Pog Lake', sites: '286 sites', chip: '5 months ahead', who: 'Tents and RVs', price: 'CAD 47 per night', win: 'Reservations open 5 months ahead at 07:00 local', read: '2026-09-10', link: 'Reserve' },
        { name: 'Mew Lake', sites: '131 sites + yurts', chip: '5 months ahead', who: 'Open in winter (yurts)', price: 'CAD 36 to 150 per night', win: 'Reservations open 5 months ahead at 07:00 local', read: '2025-09-01', link: 'Reserve' },
        { name: 'Backcountry interior sites', sites: '2000 km of routes', chip: '5 months ahead', who: 'Canoe-in and hike-in', price: 'CAD 12.50 per person per night', win: 'Same window as the canoe route permit', read: '2026-09-10', link: 'Reserve' }
      ],
      gatewayTowns: 'Huntsville, Whitney, Dwight', transit: [],
      todo: kinds({
        trail: [14, ['Lookout Trail|From about 4|Easy · 2 km', 'Track and Tower|From about 5|Moderate · 7.5 km', 'Centennial Ridges|From about 10|Hard · 10 km', "Booth's Rock|From about 6|Moderate · 5 km", 'Barron Canyon|From about 6|Moderate · 1.5 km', 'Hemlock Bluff|From about 4|Easy · 3.5 km']],
        lake: [9, ['Canoe Lake|All ages', 'Lake of Two Rivers|All ages', 'Smoke Lake|All ages', 'Opeongo Lake|All ages']],
        view: [4, ['Lookout viewpoint|All ages', 'Sunday Creek Bluff|All ages', 'Lake Opeongo shore|All ages']],
        waterfall: [2, ['Whiskey Rapids|Easy · 2 km', 'Chipmunk Rapids|Easy · 1 km']],
        other: [6, ['Algonquin Visitor Centre|Sight', 'Logging Museum|Sight', 'Algonquin Art Centre|Sight', 'Highway 60 cycling|Cycling · Easy']]
      }),
      notChecked: [['Summary', 'photo, designations']],
      sources: [['Ontario Parks: Algonquin', '4 May 2026'], ['Fees', '4 May 2026'], ['Alerts', '25 Oct 2026']] },

    { slug: 'jasper-national-park', name: 'Jasper National Park', kind: 'national', cc: 'CA', country: 'Canada', rc: 'ab', region: 'Alberta', authority: 'Parks Canada', placeholder: true,
      level: 'full', entry: 'fee_book_ahead', places: 31, pts: 31, drive: { calgary: 285 }, ll: [52.87, -118.08], worth: 2,
      season: { kind: 'allyear', read: '2026-10-20' },
      glanceCamp: { v: '3 campgrounds', s: 'reserve ahead' }, gateway: { town: 'Jasper', note: 'inside the park, townsite' }, airport: { code: 'YYC', name: 'Calgary', drive: '4 h 45' },
      trips: [],
      rows: [
        { g: 'fees', cls: 'price', name: 'Daily admission', chip: 'Buy any time', who: 'Everyone entering, every season · per person, per day', price: 'CAD 12.25 adult · 10.75 senior · 24.50 family or group · 17 and under free (2026)', cov: 'Discovery Pass covers it (also Banff, Yoho, Kootenay)', ex: 'Not needed: through traffic on Highway 16 that does not stop', link: 'Fees page', read: '2026-10-20' },
        { g: 'fees', cls: 'price', name: 'Parks Canada Discovery Pass', chip: 'Buy any time', who: '12 months from purchase', price: 'CAD 83.50 adult · 167.50 family (2026)', cov: 'Covers daily admission here and at 3 other parks we hold', link: 'Buy', read: '2026-10-20' },
        { g: 'book', cls: 'window', name: 'Skyline Trail backcountry permit', chip: 'Opens in January', who: 'Overnight hikers · per person per night', price: 'CAD 12.50 per person per night', cov: 'Reservations open mid-January for the season at 08:00 local', link: 'Reserve', read: '2026-10-20', season: 'the 2026 season' },
        { g: 'book', cls: 'window', name: 'Maligne Lake boat cruise', chip: 'Book early in summer', who: 'Day visitors · to Spirit Island', price: 'CAD 85 adult · 42 child', cov: 'Seats sell out on summer weekends; no fixed opening day', link: 'Book', read: '2026-10-20', season: 'the 2026 season' },
        { g: 'day', cls: 'price', name: 'Display your pass', chip: 'On the day', who: 'Every vehicle parked in the park', price: 'Hang the pass from the rear-view mirror', link: 'Rules', read: '2026-10-20' }
      ],
      safety: { wildlife: 'Elk, bears and caribou live here: keep 100 m from bears and wolves and 30 m from elk; keep food in the car or in lockers.', alerts: 'Parks Canada alerts for Jasper' },
      closures: [{ member: 'Maligne Canyon', msg: 'upper trail, for ice and bridge work', from: '2026-11-03', to: '2026-12-01', read: '2026-10-24' }],
      services: ['The Maligne Lake road is ploughed in winter but cruises run only in summer'],
      camps: [
        { name: 'Whistlers', sites: '781 sites', chip: 'Opens in January', who: 'Tents and RVs · near the townsite', price: 'CAD 33 per night', win: 'Reservations open mid-January for the season, 08:00 local', read: '2026-10-20', link: 'Reserve' },
        { name: 'Wapiti', sites: '362 sites', chip: 'Opens in January', who: 'Tents and RVs · open in winter', price: 'CAD 33 per night', win: 'Reservations open mid-January for the season, 08:00 local', read: '2026-10-20', link: 'Reserve' },
        { name: 'Pocahontas', sites: '140 sites', chip: 'Opens in January', who: 'Tents and RVs · near Miette Hot Springs', price: 'CAD 29.50 per night', win: 'Reservations open mid-January for the season, 08:00 local', read: '2026-10-20', link: 'Reserve' }
      ],
      gatewayTowns: 'Jasper (inside the park), Hinton, Valemount',
      transit: ['Jasper Maligne Valley shuttle', 'VIA Rail Canadian'],
      todo: kinds({
        trail: [14, ['Valley of the Five Lakes|From about 5|Easy · 4.5 km', 'Mount Edith Cavell Meadows|From about 7|Moderate · 8 km', 'Sulphur Skyline|From about 8|Hard · 9 km', 'Maligne Canyon|From about 4|Easy · 4 km', 'Old Fort Point|From about 5|Moderate · 3.5 km', 'Bald Hills|From about 9|Hard · 14 km']],
        lake: [6, ['Maligne Lake|All ages', 'Pyramid Lake|All ages', 'Patricia Lake|All ages']],
        view: [4, ['Maligne Lake lookout|All ages', 'Mount Edith Cavell viewpoint|All ages']],
        waterfall: [3, ['Athabasca Falls|All ages', 'Sunwapta Falls|All ages']],
        lift: [1, ['Jasper SkyTram|From about 5']],
        other: [3, ['Icefields Parkway|Scenic drive', 'Miette Hot Springs|Sight', 'Jasper Planetarium|Sight']]
      }),
      notChecked: [['Glance', 'summary, photo, designations']],
      sources: [['Parks Canada: Jasper official page', '20 Oct 2026'], ['Fees and passes', '20 Oct 2026'], ['Current alerts', '24 Oct 2026']] },

    { slug: 'yoho-national-park', name: 'Yoho National Park', kind: 'national', cc: 'CA', country: 'Canada', rc: 'bc', region: 'British Columbia', authority: 'Parks Canada', placeholder: true,
      level: 'full', entry: 'fee', places: 22, pts: 22, drive: { calgary: 195 }, ll: [51.4, -116.5], worth: 5,
      season: { kind: 'allyear', read: '2026-10-20' },
      glanceCamp: { v: '3 campgrounds', s: 'first come or reserve' }, gateway: { town: 'Field', note: 'inside the park, townsite' }, airport: { code: 'YYC', name: 'Calgary', drive: '2 h 30' },
      areas: [{ slug: 'lake-ohara-area', name: "Lake O'Hara area" }], trips: [],
      rows: [
        { g: 'fees', cls: 'price', name: 'Daily admission', chip: 'Buy any time', who: 'Everyone entering, every season · per person, per day', price: 'CAD 12.25 adult · 10.75 senior · 24.50 family or group · 17 and under free (2026)', cov: 'Discovery Pass covers it (also Banff, Jasper, Kootenay)', ex: 'Not needed: through traffic on Highway 1', link: 'Fees page', read: '2026-10-20' },
        { g: 'fees', cls: 'price', name: 'Parks Canada Discovery Pass', chip: 'Buy any time', who: '12 months from purchase', price: 'CAD 83.50 adult · 167.50 family (2026)', cov: 'Covers daily admission here and at 3 other parks we hold', link: 'Buy', read: '2026-10-20' },
        { g: 'day', cls: 'price', name: 'Display your pass', chip: 'On the day', who: 'Every vehicle parked in the park', price: 'Hang the pass from the rear-view mirror; wardens check the Takakkaw Falls and Emerald Lake lots', link: 'Rules', read: '2026-10-20' }
      ],
      safety: { wildlife: 'Black and grizzly bears use the valley floor: carry bear spray on trails and keep food in the car.', alerts: 'Parks Canada alerts for Yoho' },
      closures: [{ member: 'Yoho Valley Road', msg: 'road to Takakkaw Falls, closed for the winter', from: '2026-10-15', to: '2027-06-15', read: '2026-10-24' }],
      services: ['The Takakkaw Falls road opens about mid-June, snow permitting'],
      camps: [
        { name: 'Monarch', sites: '44 sites', chip: 'First come, first served', who: 'Tents and RVs · near Field', price: 'CAD 20 per night', win: 'No reservations; sites fill by midday in July and August', read: '2026-10-20', link: 'Details' },
        { name: 'Kicking Horse', sites: '88 sites', chip: 'Opens in January', who: 'Tents and RVs · near Field', price: 'CAD 29.50 per night', win: 'Reservations open mid-January for the season, 08:00 local', read: '2026-10-20', link: 'Reserve' },
        { name: 'Takakkaw Falls Walk-in', sites: '35 sites', chip: 'First come, first served', who: 'Tents only · short walk from the lot', price: 'CAD 20 per night', win: 'No reservations; open when the road opens', read: '2026-10-20', link: 'Details' }
      ],
      gatewayTowns: 'Field (inside the park), Golden',
      transit: ['Hop-on shuttle to Takakkaw Falls'],
      todo: kinds({
        trail: [10, ['Emerald Lake Circuit|From about 4|Easy · 5 km', 'Iceline Trail|From about 9|Hard · 20 km', 'Wapta Falls Trail|From about 4|Easy · 5 km', 'Hamilton Lake|From about 9|Hard · 11 km', 'Walk in the Past|From about 4|Easy · 1 km']],
        lake: [4, ['Emerald Lake|All ages', 'Wapta Lake|All ages', 'Sherbrooke Lake|Moderate · 6 km']],
        view: [3, ['Spiral Tunnels viewpoint|All ages', 'Natural Bridge|All ages']],
        waterfall: [3, ['Takakkaw Falls|All ages', 'Laughing Falls|Moderate · 9 km', 'Wapta Falls|Easy · 5 km']],
        other: [2, ['Burgess Shale hikes|Guided', 'Field visitor centre|Sight']]
      }),
      notChecked: [['Glance', 'summary, photo, designations']],
      sources: [['Parks Canada: Yoho official page', '20 Oct 2026'], ['Fees and passes', '20 Oct 2026'], ['Current alerts', '24 Oct 2026']] },

    { slug: 'kootenay-national-park', name: 'Kootenay National Park', kind: 'national', cc: 'CA', country: 'Canada', rc: 'bc', region: 'British Columbia', authority: 'Parks Canada', placeholder: true,
      level: 'basics', entry: 'fee', places: 12, pts: 12, drive: { calgary: 185 }, ll: [50.85, -116.05], worth: 6, season: { kind: 'none' }, trips: [],
      alerts: 'Parks Canada alerts for Kootenay',
      todo: kinds({ trail: [7, ['Marble Canyon|Easy · 1.6 km', 'Stanley Glacier|Moderate · 8 km', 'Paint Pots|Easy · 3 km']], lake: [2, ['Olive Lake|All ages']], view: [3, ['Kootenay Valley viewpoint|All ages']] }),
      notChecked: [['Season', 'operating season'], ['Camping', 'campgrounds'], ['Safety and wildlife', 'bears, fire bans'], ['Getting there', 'airport and drive'], ['Summary and photo', '']],
      sources: [['Parks Canada: Kootenay official page', '20 Oct 2026']] },

    { slug: 'bruce-peninsula-national-park', name: 'Bruce Peninsula National Park', kind: 'national', cc: 'CA', country: 'Canada', rc: 'on', region: 'Ontario', authority: 'Parks Canada', placeholder: true,
      level: 'basics', entry: 'fee_book_ahead', places: 9, pts: 9, drive: { toronto: 215 }, ll: [45.23, -81.52], worth: 7,
      season: { kind: 'seasonal', windows: [['2026-05-15', '2026-10-15']], label: 'May to Oct', from: '15 May', to: '15 Oct', read: '2026-10-20' }, trips: [],
      alerts: 'Parks Canada alerts for Bruce Peninsula',
      todo: kinds({ trail: [6, ['Cyprus Lake Trail|Easy · 4 km', 'The Grotto|Easy · 2 km', 'Georgian Bay Trail|Moderate · 8 km']], view: [2, ['Halfway Log Dump|All ages']], other: [1, ['Visitor centre|Sight']] }),
      notChecked: [['Camping', 'campgrounds'], ['Safety and wildlife', 'rattlesnakes, fire bans'], ['Getting there', 'airport and drive'], ['Summary and photo', '']],
      sources: [['Parks Canada: Bruce Peninsula official page', '20 Oct 2026']] },

    { slug: 'killarney-provincial-park', name: 'Killarney Provincial Park', kind: 'provincial', cc: 'CA', country: 'Canada', rc: 'on', region: 'Ontario', authority: 'Ontario Parks', placeholder: true,
      level: 'full', entry: 'fee_book_ahead', places: 18, pts: 18, drive: { toronto: 240 }, ll: [46.0, -81.4], worth: 8,
      season: { kind: 'seasonal', windows: [['2026-05-01', '2026-10-31']], label: 'May to Oct', from: '1 May', to: '31 Oct', read: '2026-10-20', exceptions: 'Open in winter: day use on the park road, snow permitting' },
      glanceCamp: { v: '3 campgrounds', s: 'book ahead' }, gateway: { town: 'Killarney', note: 'village at the end of Highway 637' }, airport: { code: 'YYZ', name: 'Toronto Pearson', drive: '4 h 15' },
      trips: [],
      rows: [
        { g: 'fees', cls: 'price', name: 'Day-use vehicle permit', chip: 'Buy any time', who: 'Every vehicle stopping in the park · per day', price: 'CAD 15 per vehicle (2026)', cov: 'Seasonal permit also sold', ex: 'Not needed: through traffic to the village', link: 'Fees page', read: '2026-10-20' },
        { g: 'book', cls: 'window', name: 'Campsite reservation', chip: '5 months ahead', who: 'Car camping and backcountry · per site per night', price: 'CAD 47 per night; backcountry CAD 12.50 per person per night', cov: 'Reservations open 5 months ahead of the first night at 07:00 local', link: 'Reserve', read: '2026-10-20', season: 'the 2026 season' },
        { g: 'day', cls: 'price', name: 'Display your permit', chip: 'On the day', who: 'Every vehicle', price: 'Place the permit on the dashboard, face up', read: '2026-10-20' }
      ],
      safety: { wildlife: 'Black bears and moose live here: keep food in the car or bear-proof lockers; do not feed wildlife.', alerts: 'Ontario Parks alerts' },
      closures: [{ member: 'Granite Ridge Trail', msg: 'trail, for boardwalk repair', from: '2026-11-02', to: '2026-12-15', read: '2026-10-24' }],
      services: ['George Lake campground runs mid-May to mid-October'],
      camps: [
        { name: 'George Lake', sites: '126 sites', chip: '5 months ahead', who: 'Tents and RVs · main campground', price: 'CAD 47 per night', win: 'Reservations open 5 months ahead at 07:00 local', read: '2026-10-20', link: 'Reserve' },
        { name: 'Carlyle Lake yurts', sites: '4 yurts', chip: '5 months ahead', who: 'Yurts · near the village', price: 'CAD 150 per night', win: 'Reservations open 5 months ahead at 07:00 local', read: '2026-10-20', link: 'Reserve' },
        { name: 'Backcountry interior sites', sites: '60 km of routes', chip: '5 months ahead', who: 'Canoe-in and hike-in', price: 'CAD 12.50 per person per night', win: 'Same window as the campsite reservation', read: '2026-10-20', link: 'Reserve' }
      ],
      gatewayTowns: 'Killarney village, Sudbury',
      transit: [],
      todo: kinds({
        trail: [8, ['The Crack|From about 8|Hard · 6 km', 'Silver Peak|From about 9|Hard · 12 km', 'Granite Ridge|From about 5|Moderate · 2 km', 'Cranberry Bog|From about 4|Easy · 4 km']],
        lake: [5, ['George Lake|All ages', 'O.S.A. Lake|All ages', 'Killarney Lake|Moderate · 10 km']],
        view: [2, ['Lookout at Silver Peak|Hard · 12 km', 'Georgian Bay shore|All ages']],
        other: [3, ['Canoe rental at the village|Sight', 'Killarney Mountain Lodge|Sight', 'Fish and chips on the water|Sight']]
      }),
      notChecked: [['Glance', 'summary, photo, designations']],
      sources: [['Ontario Parks: Killarney official page', '20 Oct 2026'], ['Fees', '20 Oct 2026'], ['Alerts', '24 Oct 2026']] },

    { slug: 'zion-national-park', name: 'Zion National Park', kind: 'national', cc: 'US', country: 'United States', rc: 'ut', region: 'Utah', authority: 'National Park Service', placeholder: true,
      level: 'basics', entry: 'fee_book_ahead', places: 14, pts: 14, drive: {}, ll: [37.3, -113.03], worth: 4, season: { kind: 'allyear', read: '2026-10-20' }, trips: [],
      alerts: 'National Park Service alerts for Zion',
      todo: kinds({ trail: [8, ['Angels Landing|Hard · 8 km', 'The Narrows|Moderate · 15 km', 'Emerald Pools|Easy · 4 km']], view: [3, ['Canyon Overlook|Easy · 1.6 km']], other: [3, ['Zion Canyon shuttle|Scenic drive']] }),
      notChecked: [['Camping', 'campgrounds'], ['Safety and wildlife', 'flash floods, heat'], ['Getting there', 'airport and drive'], ['Summary and photo', '']],
      sources: [['National Park Service: Zion official page', '20 Oct 2026']] }
  ];

  /* ---- finalize: store the URL of every link and mark each invented record ---- */
  function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  PARKS.forEach(function (p) {
    (p.rows || []).forEach(function (r) { r.url = r.url || U(p.slug, slugify(r.name)); r.ph = r.ph || !!p.placeholder; });
    (p.camps || []).forEach(function (c) { c.url = c.url || U(p.slug, slugify(c.name)); c.ph = c.ph || !!p.placeholder; });
    if (p.safety) { p.safety.alertsUrl = p.safety.alertsUrl || U(p.slug, 'alerts'); p.safety.ph = p.safety.ph || !!p.placeholder; }
    if (p.alerts) p.alertsUrl = p.alertsUrl || U(p.slug, 'alerts');
    (p.closures || []).forEach(function (c) { c.ph = c.ph || !!p.placeholder; });
    if (p.airport) p.airport.ph = p.airport.ph || !!p.placeholder;
    if (p.gateway) p.gateway.ph = p.gateway.ph || !!p.placeholder;
    if (p.glanceCamp) p.glanceCamp.ph = p.glanceCamp.ph || !!p.placeholder;
    p.sources = (p.sources || [['Catalogue index (prototype)', '27 Oct 2026']]).map(function (x) { return { title: x[0], read: x[1], url: x[2] || U(p.slug, slugify(x[0])), ph: true }; });
    p.officialUrl = p.sources[0].url;
    p.feesUrl = (p.rows || []).filter(function (r) { return r.g === 'fees'; }).map(function (r) { return r.url; })[0] || U(p.slug, 'fees');
    p.alertsUrl = p.alertsUrl || (p.safety && p.safety.alertsUrl) || U(p.slug, 'alerts');
  });

  var ENTRY_LABEL = { none: 'No fee', fee: 'Fee', book_ahead: 'Book ahead', fee_book_ahead: 'Fee · book ahead', not_checked: 'Entry not checked yet' };
  /** The three index chips and the park page glance read ONLY this, so they cannot disagree. season: an optional override (page controls). */
  function facts(p, season) {
    season = season || p.season || { kind: 'none' };
    var s = season.kind === 'allyear' ? 'Open all year' : season.kind === 'seasonal' ? 'Open ' + season.label : null;
    return {
      season: { text: s || 'Season not checked', gap: !s },
      entry: { text: ENTRY_LABEL[p.entry], gap: p.entry === 'not_checked' },
      camping: { text: p.glanceCamp ? p.glanceCamp.v : 'Camping not checked', gap: !p.glanceCamp, ph: !!(p.glanceCamp && p.glanceCamp.ph) }
    };
  }
  /** minutes by car from a hub, or null when the park has no value for it */
  function driveFrom(p, hub) { return p.drive && p.drive[hub] != null ? p.drive[hub] : null; }

  window.PROTO = {
    PARKS: PARKS, KINDS: KINDS, facts: facts, driveFrom: driveFrom, URL_BASE: 'https://example.org/placeholder/', PAGE_SIZE: 20,
    HUBS: { toronto: 'Toronto', calgary: 'Calgary' },
    TYPES: [['nature.protected.national_park', 'National park'], ['nature.protected.state_provincial_park', 'State or provincial park']],
    KIND_TYPE: { national: 'nature.protected.national_park', provincial: 'nature.protected.state_provincial_park', state: 'nature.protected.state_provincial_park' },
    KIND_LABEL: { national: 'National park', provincial: 'Provincial park', state: 'State park', zone: 'Area' },
    ENTRY_LABEL: ENTRY_LABEL
  };
})();
