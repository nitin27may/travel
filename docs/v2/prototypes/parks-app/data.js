/* THROWAWAY prototype data. Algonquin and the camping rows are PLACEHOLDER; list-only parks carry index facts only. */
(function () {
  var KINDS = {
    trail: ['trail', 'trails', 'hiking and walking'], lake: ['lake', 'lakes', 'paddling and shores'],
    view: ['view', 'views', 'viewpoints and summits'], waterfall: ['waterfall', 'waterfalls', 'falls and canyons'],
    lift: ['lift', 'lifts', 'gondolas and chairs'], other: ['other place', 'other places', 'cycling, sights and more']
  };
  function items(a) { return a.map(function (s) { var pt = s.charAt(0) !== '~'; if (!pt) s = s.slice(1); var p = s.split('|'); return { name: p[0], chips: p.slice(1), pt: pt }; }); }
  function kinds(o) { return Object.keys(o).map(function (k) { return { id: k, count: o[k][0], items: items(o[k][1]) }; }); }
  var SRC_NOTE = 'placeholder';

  var PARKS = [
    { slug: 'banff-national-park', name: 'Banff National Park', kind: 'national', cc: 'CA', country: 'Canada', rc: 'ab', region: 'Alberta', authority: 'Parks Canada',
      level: 'full', entry: 'fee_book_ahead', places: 56, pts: 56, drive: { calgary: 90 }, ll: [51.18, -115.57], worth: 1,
      season: { kind: 'none' },
      glanceCamp: { v: '4 campgrounds', s: 'reserve ahead (placeholder)' }, gateway: ['Banff', 'inside the park, 0.2 km'], airport: { code: 'YYC', name: 'Calgary', drive: '1 h 30' },
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
        { name: 'Tunnel Mountain Village I', sites: '618 sites', chip: 'Opens in January', who: 'Tents and RVs · near Banff townsite', price: 'CAD 29.50 to 39.50 per night (placeholder)', win: 'Reservations open mid-January for the season, 08:00 local (placeholder)', read: '2026-10-27', link: 'Reserve' },
        { name: 'Two Jack Lakeside', sites: '74 sites', chip: 'Opens in January', who: 'Tents and RVs · lake views', price: 'CAD 29.50 per night (placeholder)', win: 'Reservations open mid-January for the season, 08:00 local (placeholder)', read: '2026-10-27', link: 'Reserve' },
        { name: 'Johnston Canyon', sites: '132 sites', chip: 'Opens in January', who: 'Tents and RVs · closed with the canyon trail in some years', price: 'CAD 29.50 per night (placeholder)', win: 'Reservations open mid-January for the season, 08:00 local (placeholder)', read: '2026-10-27', link: 'Reserve' },
        { name: 'Lake Louise Tent', sites: '206 sites', chip: 'Opens in January', who: 'Hard-sided and tent sites', price: 'CAD 29.50 per night (placeholder)', win: 'Reservations open mid-January for the season, 08:00 local (placeholder)', read: '2026-10-27', link: 'Reserve' }
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
      glanceCamp: { v: '1 campground', s: 'lottery (placeholder)' }, gateway: ['Field', 'placeholder'], airport: { code: 'YYC', name: 'Calgary', drive: '3 h 15' },
      trips: [],
      rows: [
        { g: 'book', cls: 'window', name: "Lake O'Hara day-use bus", chip: 'Lottery, usually in March', who: 'Day visitors', price: 'CAD 25.50 per person return · CAD 10 per draw application', cov: 'Lottery: apply usually 2 to 23 Mar at 08:00 local; seats left after the draw until 15:30 the day before · In force 19 Jun to 4 Oct', ex: 'Walking in instead: 22 km return on the fire road', link: 'Booking page', read: '2026-03-02', season: 'the 2026 season' },
        { g: 'fees', cls: 'price', inh: 'Yoho National Park', name: 'Daily admission', chip: 'Buy any time', who: 'Everyone entering · Discovery Pass covers it', price: 'CAD 12.25 adult · 17 and under free (2026)', link: 'Fees page', read: '2026-03-02' }
      ],
      safety: { wildlife: null, alerts: 'Parks Canada alerts for Yoho' },
      closures: [], services: ['The bus is the only motor access; the road is closed to private vehicles'],
      camps: [{ name: "Lake O'Hara Campground", sites: '30 sites', chip: 'Lottery, usually in March', who: 'Tents only · by bus', price: 'CAD 12 per person per night (placeholder)', win: 'Reservations by phone, opening in March (placeholder)', read: '2026-03-02', link: 'Reserve' }],
      gatewayTowns: 'Field (placeholder)', transit: [],
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
      glanceCamp: { v: '5 campgrounds', s: 'book ahead (placeholder)' }, gateway: ['Whitney', 'east gate, placeholder'], airport: { code: 'YYZ', name: 'Toronto Pearson', drive: '3 h 10' },
      trips: [],
      rows: [
        { g: 'fees', cls: 'price', name: 'Day-use vehicle permit', chip: 'Buy any time', who: 'Every vehicle stopping in the Highway 60 corridor · per day', price: 'CAD 21 per vehicle (placeholder, 2026)', cov: 'Seasonal permit also sold (placeholder)', ex: 'Not needed: through traffic that does not stop', link: 'Fees page', read: '2026-05-04' },
        { g: 'book', cls: 'window', name: 'Backcountry canoe route permit', chip: '5 months ahead', who: 'Overnight paddlers · per person per night', price: 'CAD 12.50 per person per night (placeholder)', cov: 'Reservations open 5 months ahead of the first night at 07:00 local (placeholder)', link: 'Reserve', read: '2026-09-10', season: 'the 2026 season' },
        { g: 'day', cls: 'price', name: 'Display your permit', chip: 'On the day', who: 'Every vehicle', price: 'Place the permit on the dashboard, face up (placeholder)', read: '2026-05-04' }
      ],
      safety: { wildlife: 'Black bears and moose live here (placeholder): keep food in the car or bear-proof lockers; do not feed wildlife.', alerts: 'Ontario Parks alerts' },
      closures: [{ member: 'Barron Canyon Trail', msg: 'trail, for bridge repair (placeholder)', from: '2026-11-02', to: '2026-12-15', read: '2026-10-25' }],
      services: ['Highway 60 corridor campgrounds run mid-May to mid-October (placeholder)'],
      camps: [
        { name: 'Canisbay Lake', sites: '241 sites', chip: '5 months ahead', who: 'Tents and RVs · Highway 60 corridor', price: 'CAD 47 per night (placeholder)', win: 'Reservations open 5 months ahead at 07:00 local (placeholder)', read: '2026-09-10', link: 'Reserve' },
        { name: 'Lake of Two Rivers', sites: '240 sites', chip: '5 months ahead', who: 'Tents and RVs · near the Visitor Centre', price: 'CAD 47 per night (placeholder)', win: 'Reservations open 5 months ahead at 07:00 local (placeholder)', read: '2026-09-10', link: 'Reserve' },
        { name: 'Pog Lake', sites: '286 sites', chip: '5 months ahead', who: 'Tents and RVs', price: 'CAD 47 per night (placeholder)', win: 'Reservations open 5 months ahead at 07:00 local (placeholder)', read: '2026-09-10', link: 'Reserve' },
        { name: 'Mew Lake', sites: '131 sites + yurts', chip: '5 months ahead', who: 'Open in winter (yurts)', price: 'CAD 36 to 150 per night (placeholder)', win: 'Reservations open 5 months ahead at 07:00 local (placeholder)', read: '2025-09-01', link: 'Reserve' },
        { name: 'Backcountry interior sites', sites: '2000 km of routes', chip: '5 months ahead', who: 'Canoe-in and hike-in', price: 'CAD 12.50 per person per night (placeholder)', win: 'Same window as the canoe route permit (placeholder)', read: '2026-09-10', link: 'Reserve' }
      ],
      gatewayTowns: 'Huntsville, Whitney, Dwight (placeholders)', transit: [],
      todo: kinds({
        trail: [14, ['Lookout Trail|From about 4|Easy · 2 km', 'Track and Tower|From about 5|Moderate · 7.5 km', 'Centennial Ridges|From about 10|Hard · 10 km', "Booth's Rock|From about 6|Moderate · 5 km", 'Barron Canyon|From about 6|Moderate · 1.5 km', 'Hemlock Bluff|From about 4|Easy · 3.5 km']],
        lake: [9, ['Canoe Lake|All ages', 'Lake of Two Rivers|All ages', 'Smoke Lake|All ages', 'Opeongo Lake|All ages']],
        view: [4, ['Lookout viewpoint|All ages', 'Sunday Creek Bluff|All ages', 'Lake Opeongo shore|All ages']],
        waterfall: [2, ['Whiskey Rapids|Easy · 2 km', 'Chipmunk Rapids|Easy · 1 km']],
        other: [6, ['Algonquin Visitor Centre|Sight', 'Logging Museum|Sight', 'Algonquin Art Centre|Sight', 'Highway 60 cycling|Cycling · Easy']]
      }),
      notChecked: [['Summary', 'photo, designations']],
      sources: [['Ontario Parks: Algonquin (placeholder)', '4 May 2026'], ['Fees (placeholder)', '4 May 2026'], ['Alerts (placeholder)', '25 Oct 2026']] },

    { slug: 'jasper-national-park', name: 'Jasper National Park', kind: 'national', cc: 'CA', country: 'Canada', rc: 'ab', region: 'Alberta', authority: 'Parks Canada', level: 'list', entry: 'fee_book_ahead', places: 31, pts: 31, drive: { calgary: 285 }, ll: [52.87, -118.08], worth: 2, season: { kind: 'allyear', read: '2026-10-27' }, trips: [] },
    { slug: 'yoho-national-park', name: 'Yoho National Park', kind: 'national', cc: 'CA', country: 'Canada', rc: 'bc', region: 'British Columbia', authority: 'Parks Canada', level: 'list', entry: 'fee', places: 22, pts: 22, drive: { calgary: 195 }, ll: [51.4, -116.5], worth: 5, season: { kind: 'allyear', read: '2026-10-27' }, areas: [{ slug: 'lake-ohara-area', name: "Lake O'Hara area" }], trips: [] },
    { slug: 'kootenay-national-park', name: 'Kootenay National Park', kind: 'national', cc: 'CA', country: 'Canada', rc: 'bc', region: 'British Columbia', authority: 'Parks Canada', level: 'list', entry: 'fee', places: 12, pts: 12, drive: { calgary: 185 }, ll: [50.85, -116.05], worth: 6, season: { kind: 'none' }, trips: [] },
    { slug: 'bruce-peninsula-national-park', name: 'Bruce Peninsula National Park', kind: 'national', cc: 'CA', country: 'Canada', rc: 'on', region: 'Ontario', authority: 'Parks Canada', level: 'list', entry: 'fee_book_ahead', places: 9, pts: 9, drive: { toronto: 215 }, ll: [45.23, -81.52], worth: 7,
      season: { kind: 'seasonal', windows: [['2026-05-15', '2026-10-15']], label: 'May to Oct', from: '15 May', to: '15 Oct', read: '2026-05-01' }, trips: [] },
    { slug: 'killarney-provincial-park', name: 'Killarney Provincial Park', kind: 'provincial', cc: 'CA', country: 'Canada', rc: 'on', region: 'Ontario', authority: 'Ontario Parks', level: 'list', entry: 'fee_book_ahead', places: 18, pts: 18, drive: { toronto: 240 }, ll: [46.0, -81.4], worth: 8,
      season: { kind: 'seasonal', windows: [['2026-05-01', '2026-10-31']], label: 'May to Oct', from: '1 May', to: '31 Oct', read: '2026-05-01' }, trips: [] },
    { slug: 'zion-national-park', name: 'Zion National Park', kind: 'national', cc: 'US', country: 'United States', rc: 'ut', region: 'Utah', authority: 'National Park Service', level: 'list', entry: 'fee_book_ahead', places: 14, pts: 14, drive: {}, ll: [37.3, -113.03], worth: 4, season: { kind: 'allyear', read: '2026-10-27' }, trips: [] }
  ];

  window.PROTO = {
    PARKS: PARKS, KINDS: KINDS,
    HUBS: { toronto: 'Toronto', calgary: 'Calgary' },
    TYPES: [['nature.protected.national_park', 'National park'], ['nature.protected.state_provincial_park', 'State or provincial park']],
    KIND_TYPE: { national: 'nature.protected.national_park', provincial: 'nature.protected.state_provincial_park', state: 'nature.protected.state_provincial_park' },
    KIND_LABEL: { national: 'National park', provincial: 'Provincial park', state: 'State park', zone: 'Area' },
    ENTRY_LABEL: { none: 'No fee', fee: 'Fee', book_ahead: 'Book ahead', fee_book_ahead: 'Fee · book ahead', not_checked: 'Entry not checked yet' }
  };
})();
