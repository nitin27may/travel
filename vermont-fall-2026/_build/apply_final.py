import re
p='index.html'; s=open(p,encoding='utf-8').read()
def rep(a,b,count=1):
    global s
    assert s.count(a)==count,(s.count(a),a[:80])
    s=s.replace(a,b)
def between(start,end,new):
    """replace from start marker through first end marker after it (inclusive of end)."""
    global s
    i=s.index(start); j=s.index(end,i)+len(end)
    s=s[:i]+new+s[j:]

# ---------- nav + summary ----------
rep('<a href="#about">Overview<span class="d">what &amp; why</span></a>','<a href="#about">Overview<span class="d">what &amp; why</span></a>\n    <a href="#glance">At a glance<span class="d">day by day</span></a>')
def T(rows):
    return '<table><thead><tr><th style="width:22%">Time</th><th>What</th></tr></thead><tbody>'+''.join(f'<tr><td>{a}</td><td>{b}</td></tr>' for a,b in rows)+'</tbody></table>'
thu=[('08:00 (07:30 is better)','Leave Whitby, full tank. Packed lunch and dinner in the cooler.'),
('~10:10','Break 1, 20 min: Napanee ONroute, coffee and washrooms.'),
('~12:30','Break 2, 20 min: packed lunch at an A-30 aire.'),
('~14:35','Highgate Springs border. Check the live wait first.'),
('~15:00','Break 3, 20 min: fuel at St. Albans.'),
('~16:30','Check in, base at 1592 Center Rd, Hyde Park.'),
('17:00 &ndash; 17:45','Moss Glen Falls, 0.5 mi round trip. Sunset 18:33. Skip it if you arrive after 17:30.'),
('~18:15','Hannaford, Morrisville (open to 22:00): Friday trail food, Saturday picnic, Sunday food.'),
('~18:45','Dinner at home.')]
fri=[('07:15 &ndash; 07:30','Leave base after breakfast at home. 25 min to the trailhead.'),
('~07:40 &ndash; 11:15','Stowe Pinnacle, 3.4 mi and 1,500 ft. Turn back if not on the summit by 10:00.'),
('11:30','Emily\'s Bridge, 10 min. First item to drop.'),
('11:45 &ndash; 12:15','Lunch, 30 min: quick bite in Stowe (Raja or Green Goddess).'),
('12:15 &ndash; 12:45','Coffee, 30 min, and the Community Church view point.'),
('13:15 &ndash; 14:45','Instead of the gondola: Mansfield Auto Toll Road (about 90 min, $37 per vehicle + $14 per extra passenger), or Cold Hollow Cider Mill (30 to 45 min, free).'),
('15:00 &ndash; 15:45','Bingham Falls, 0.5 mi, wet staircases.'),
('16:00 &ndash; 17:00','Smugglers\' Notch drive.'),
('17:30 &ndash; 18:30','Sunset Rock. Sunset 18:31.'),
('~19:10','Home. Dinner at home. (Optional: a drink at von Trapp Bierhall first.)')]
sat=[('07:30','Leave base. About 1 h 05 to Pisgah.'),
('~08:35 &ndash; 10:50','Mount Pisgah to Pulpit Rock and back, 2.2 mi and 900 ft.'),
('11:00 &ndash; 11:30','Lunch, 30 min: the picnic at South Beach.'),
('11:30 &ndash; 12:40','Drive north on VT-5A, VT-58 and VT-14.'),
('~12:40 &ndash; 13:10','Craftsbury Common stroll.'),
('13:10 &ndash; 13:40','Coffee, 30 min, at The Genny.'),
('13:55 &ndash; 14:35','Barr Hill, about 40 min.'),
('~15:10','Fisher Covered Railroad Bridge, 15 min, on the way home.'),
('~15:35','Back at base.'),
('~15:45 &ndash; 17:30','Optional: Prospect Rock, 2.6 mi and 460 ft, 1 h 30 to 1 h 45. Easy fallback: rail trail and Ten Bends.'),
('evening','Dinner at home.')]
sun=[('08:00','Check out.'),
('~08:40','Cambridge Junction (Poland Covered Bridge).'),
('~09:00','Gates Farm Covered Bridge.'),
('~09:30','Drive to Montgomery.'),
('09:55 &ndash; 11:00','The Montgomery covered bridges.'),
('~11:15','VT-118 to Enosburg Falls and Swanton.'),
('~12:10','Highgate Springs border. Check the northbound wait.'),
('~13:30 &ndash; 14:00','Lunch, 30 min, in Brossard.'),
('~18:30','Whitby.')]
glance=f'''<section class="day" id="glance">
  <div class="sign"><div class="date"><span class="dow">Summary</span><span class="num">4 DAYS</span></div>
  <div class="body"><h2>At a glance &mdash; day by day</h2>
  <p class="route">Rough times, leaving at 07:30 to 08:00. Dinner and breakfast at home; lunch 30 min and one 30 min coffee. No App Gap on this trip.</p></div></div>
  <div class="card" style="padding:14px 18px;margin-bottom:14px"><h3>Thursday, Oct 1 &mdash; Whitby to Hyde Park (~660 km, 6 h 40 driving)</h3>{T(thu)}</div>
  <div class="card" style="padding:14px 18px;margin-bottom:14px"><h3>Friday, Oct 2 &mdash; Stowe (~2 h driving, ~70 mi)</h3>{T(fri)}</div>
  <div class="card" style="padding:14px 18px;margin-bottom:14px"><h3>Saturday, Oct 3 &mdash; Northeast Kingdom (~3 h driving, ~130 mi)</h3>{T(sat)}</div>
  <div class="card" style="padding:14px 18px;margin-bottom:14px"><h3>Sunday, Oct 4 &mdash; home (~1 h 50 to the border, then 6 h 40)</h3>{T(sun)}</div>
  <p class="mono" style="font-size:.72rem;color:var(--muted)">Times are estimates from the drive times and trail research in this plan, not routed in Maps. If you leave at 08:00, shift each day by 30 minutes.</p>
</section>

'''
rep('<!-- ============ DAY 1 ============ -->',glance+'<!-- ============ DAY 1 ============ -->')

# ---------- Thursday ----------
rep('tested &middot; rejected unless the Qu&eacute;bec leg runs','decided &middot; not doing')
rep('<span class="time opt">optional &middot; ~10:10 AM</span>','<span class="time opt">break 1 &middot; ~10:10 AM &middot; 20 min</span>')
between('<span class="time">1:15 &ndash; 2:15 PM</span>','</details>','''<span class="time">break 2 &middot; ~12:30 PM &middot; 20 min</span>
          <h3>Packed lunch, on the go <span class="tag tag--added">changed</span></h3>
          <p>No sit-down lunch. Stop at an A-30 aire or any safe car park and eat what you brought, about 20 minutes with the washroom. Three 20-minute breaks in total keep the whole day to one hour of stopping.</p>
          <div class="stats"><span>Break <b>20 min</b></span><span>Three breaks <b>= 60 min</b></span><span>Dinner <b>carried</b></span></div>
          <details class="more"><summary>Why not the Brossard restaurants any more</summary>
            <p>Le Tandoor and Shaan Tandoori (Brossard) were the plan's sit-down lunch. They stay as a fallback if you change your mind, but the packed lunch saves about 40 minutes and puts you at the border around 14:35.</p>''')
rep('<span class="time opt">optional &middot; ~3:40 PM</span>','<span class="time opt">break 3 &middot; ~3:00 PM &middot; 20 min</span>')
rep('<span class="time">~4:45 PM</span>','<span class="time">~4:30 PM</span>')
rep('<span>Was <b>4:30</b> before the lunch hour</span><span>Moss Glen cut-off <b>5:30 PM</b></span><span>Still <b>45 min</b> in hand</span>','<span>Moss Glen cut-off <b>5:30 PM</b></span><span>Still <b>1 h</b> in hand</span>')
rep('<span class="time">5:15 – 6:15 PM</span>','<span class="time">5:00 &ndash; 5:45 PM</span>')
rep('<span class="time">6:45 PM</span>\n        <h3>Groceries, then dinner</h3>','<span class="time">~6:15 PM</span>\n        <h3>Groceries, then dinner at home</h3>')
between('<p>Hannaford in Morrisville (open to 10) for Saturday','</details>','''<p>Hannaford in Morrisville (open to 10 PM) for Friday's trail food, Saturday's picnic and Sunday's food &mdash; see the Saturday morning card for the picnic list. Then home and dinner from the cooler. No restaurant tonight.</p>
        <div class="stats"><span>Hannaford to <b>10 PM</b></span><span>Dinner <b>at home</b></span><span>Base by <b>~6:45</b></span></div>
        <div class="links">
          <a class="btn primary" href="https://maps.google.com/?q=Hannaford,+80+Fairgrounds+Plaza,+Morrisville,+VT">Hannaford map</a>
        </div>
        <details class="more"><summary>If you change your mind about dinner out</summary>
          <p>Raja, 151 Main St, Stowe (ph 802-760-6685) is open to 9:00 Thursday to Saturday and closed Sunday. Piecasso (pizza, daily) is the other reliable vegetarian option.</p>
        ''')
# Map 1: drop Raja waypoint
rep('/44.4656857,-72.6843216/44.601828,-72.5745682/','/44.601828,-72.5745682/',3) if s.count('/44.4656857,-72.6843216/44.601828,-72.5745682/')==3 else None
n=s.count('/44.4656857,-72.6843216/44.601828,-72.5745682/')
if n: s=s.replace('/44.4656857,-72.6843216/44.601828,-72.5745682/','/44.601828,-72.5745682/')
rep('Moss Glen Falls, Hannaford, Raja, back to base.','Moss Glen Falls, Hannaford, back to base.')
rep('Map 1 order: Whitby, Le Tandoor (Brossard), Saint-Armand','Map 1 order: Whitby, Le Tandoor (Brossard, optional fallback), Saint-Armand')
rep('the Moss Glen, Hannaford and Raja loop adds roughly 60 km','the Moss Glen and Hannaford loop adds roughly 40 km')

# ---------- Friday ----------
rep('<span class="time">6:00 &ndash; 6:45 AM</span>','<span class="time">6:45 &ndash; 7:15 AM</span>')
rep('<div class="stats"><span>Depart <b>6:45</b></span><span>Sunrise <b>6:49</b></span>','<div class="stats"><span>Depart <b>7:15 (7:30 latest)</b></span><span>Sunrise <b>6:49</b></span>')
rep('<span class="time">7:15 – 10:45 AM</span>','<span class="time">~7:40 &ndash; 11:15 AM</span>')
rep('be there by 7:10.','be there by 7:40 at the latest, earlier if you can.')
rep('if you are not on the summit knob by 9:00, turn around.','if you are not on the summit knob by 10:00, turn around.')
rep('<span class="time opt">11:00 AM &middot; the flex item</span>','<span class="time opt">11:30 AM &middot; the flex item</span>')
rep('<span class="time">11:30 AM &ndash; 1:00 PM</span>\n          <h3>Stowe village — coffee, then lunch</h3>','<span class="time">11:45 AM &ndash; 12:45 PM</span>\n          <h3>Stowe village &mdash; quick lunch, then coffee</h3>')
rep('<b>Timing:</b> 90 minutes covers coffee, the church, Main Street and a sit-down lunch.','<b>Timing:</b> 60 minutes: a 30-minute quick lunch, then a 30-minute coffee and the church view point.')
rep('<summary>Gondola or toll road &mdash; how to pick</summary>','<summary>Gondola or toll road &mdash; how to pick</summary>\n            <p><b>If you skip the gondola, the toll road is the pick</b> (about 90 min, the best view of the alternatives, $37 + $14 per extra passenger). For an easy afternoon with no view, take <b>Cold Hollow Cider Mill</b> instead: VT-100 in Waterbury Center, daily 8&ndash;6, free, cider donuts and press demos, 30 to 45 minutes. Either fits before the 3:00 Bingham Falls stop.</p>')
rep('<span class="time">5:45 PM</span>\n        <h3>Sunset Rock','<span class="time">5:30 PM</span>\n        <h3>Sunset Rock')
rep('<span class="time">7:15 PM</span>\n        <h3>von Trapp Bierhall, then dinner at Raja <span class="tag tag--added">Raja moved here from Saturday</span></h3>','<span class="time opt">optional &middot; ~6:45 PM</span>\n        <h3>von Trapp Bierhall &mdash; a drink, then home for dinner <span class="tag tag--optional">optional</span></h3>')
rep('<b>The drink is here; dinner is at Raja</b> on Main St, which is open to 9:00 on Friday.','<b>Dinner is at home tonight</b>, so this is a drink and the view only. Skip it if everyone is tired.')
rep('<span>Dinner <b>Raja, by 8:00</b></span>','<span>Dinner <b>at home</b></span>')
rep('<summary>Why dinner is at Raja and not the Bierhall</summary>','<summary>If you want a proper dinner out instead</summary>')

# ---------- Saturday ----------
rep('<span class="time">5:45 &ndash; 6:15 AM</span>\n          <h3>Breakfast at the property, and build the picnic</h3>','<span class="time">6:45 &ndash; 7:30 AM</span>\n          <h3>Breakfast at the property, and build the picnic</h3>')
rep('<span>Depart <b>6:15</b></span><span>Sunrise <b>6:50</b></span><span>Drive <b>1 h 05</b></span><span>Next real food <b>1:15 PM</b></span>','<span>Depart <b>7:30</b></span><span>Sunrise <b>6:50</b></span><span>Drive <b>1 h 05</b></span><span>Coffee <b>1:10 PM</b></span>')
rep('<span class="time">7:35 &ndash; 9:45 AM</span>','<span class="time">8:35 &ndash; 10:50 AM</span>')
rep('<span class="time">10:00 &ndash; 11:00 AM</span>\n          <h3>South Beach + picnic</h3>','<span class="time">11:00 &ndash; 11:30 AM</span>\n          <h3>South Beach + picnic (lunch, 30 min)</h3>')
rep('<span>Lunch <b>55 min</b></span><span>Nearest cafe <b>Craftsbury, 1:15</b></span>','<span>Lunch <b>30 min</b></span><span>Nearest cafe <b>Craftsbury, 1:10</b></span>')
rep('<span class="time">11:00 AM</span>\n          <h3>VT-5A shore drive + North Beach','<span class="time">11:30 AM</span>\n          <h3>VT-5A shore drive + North Beach')
rep('<span class="time">12:30 PM</span>\n          <h3>Craftsbury Common</h3>','<span class="time">~12:40 PM</span>\n          <h3>Craftsbury Common</h3>')
rep('<span class="time time--opt">1:15 PM &mdash; optional</span>','<span class="time">1:10 &ndash; 1:40 PM &middot; coffee, 30 min</span>')
rep('The Genny&quot; <span class="tag tag--added">optional</span>','The Genny&quot; <span class="tag tag--added">coffee stop</span>') if 'The Genny&quot;' in s else None
s=s.replace('&ldquo;The Genny&rdquo; <span class="tag tag--added">optional</span>','&ldquo;The Genny&rdquo; <span class="tag tag--added">coffee stop</span>')
s=s.replace('"The Genny" <span class="tag tag--added">optional</span>','"The Genny" <span class="tag tag--added">coffee stop</span>')
rep('<span class="time">1:50 &ndash; 2:40 PM</span>','<span class="time">1:55 &ndash; 2:35 PM</span>')
rep('<span class="time">3:25 PM</span>\n          <h3>Fisher','<span class="time">~3:10 PM</span>\n          <h3>Fisher')
rep('<span>Loop <b>~152 km</b> &middot; home <b>3:45</b></span>','<span>Loop <b>~152 km</b> &middot; home <b>~3:35</b></span>')

# App Gap card: not doing
rep('<span class="time">4:00 &ndash; 7:50 PM &mdash; LOCKED evening</span>\n          <h3>Appalachian Gap at golden hour <span class="tag tag--added">locked &middot; Saturday evening</span></h3>\n          <p><b>This is Saturday\'s evening.</b> The Hyde Park evening above is the fallback for rain or tired legs; it does not run as well.</p>',
    '<span class="time time--opt">not doing &mdash; kept for the record</span>\n          <h3>Appalachian Gap at golden hour <span class="tag tag--hidden">decided &middot; not on this trip</span></h3>\n          <p><b>Decision, 2026-09-25: the gap is not on this trip.</b> It costs 2 to 2.5 hours of extra driving on any day, and the family days are already full. This write-up is kept in case plans change.</p>')
rep('<span class="time opt">4:00 PM on &mdash; FALLBACK evening</span>\n        <h3>Hyde Park evening <span class="tag tag--easy">fallback &middot; rain or tired</span></h3>','<span class="time opt">~3:45 PM on &mdash; easy evening</span>\n        <h3>Hyde Park evening <span class="tag tag--easy">the easy fallback</span></h3>')
rep('<b>Saturday evening is now the Appalachian Gap (next card).</b> Use this one only if it rains, the sky is socked in at 4:00, or nobody has the legs for another drive.','<b>The easy option if Prospect Rock (previous card) is too much.</b> Use this if it rains or nobody has the legs for another hike.')
rep('Raja is no longer a Saturday meal &mdash; it moved to Friday.','Dinner is at home.')
rep('<li><b>Raja</b> is open to 9:00 on a Saturday if the fallback evening runs and you want a second visit, but the plan now eats there on Friday. It is <b>closed Sunday</b>. Ph 802-760-6685.</li>','<li>Dinner is at home tonight. If you change your mind: <b>Raja</b>, Stowe, is open to 9:00 on a Saturday and <b>closed Sunday</b>. Ph 802-760-6685.</li>')

# Prospect Rock card, inserted before the Hyde Park evening stop
pr='''    <div class="stop"><span class="mark mark--1"></span>
      <div class="card"><div class="split">
        <div class="content">
          <span class="time time--opt">~3:45 &ndash; 5:30 PM &mdash; optional</span>
          <h3>Prospect Rock, Johnson <span class="tag tag--optional">optional hike</span></h3>
          <p>The best of the near-base options. The trail starts with a short descent into marsh, then crosses a <b>suspension bridge over the Lamoille River at Ithiel Falls</b>, climbs moderately (one steep switchback section), and levels out at a flat bedrock ledge over the Lamoille valley and the Sterling Range. About 15 minutes from base on VT-15.</p>
          <div class="stats"><span><b>2.6 mi / 4.2 km</b> RT</span><span><b>~460 ft</b> gain</span><span>Time <b>1 h 30 &ndash; 1 h 45</b></span><span>Back at car <b>~5:30</b></span><span>Sunset <b>6:30</b></span></div>
          <div class="links">
            <a class="btn primary" href="https://maps.google.com/?q=Prospect+Rock+Trailhead,+Johnson,+VT">Map</a>
            <a class="btn" href="https://www.alltrails.com/trail/us/vermont/prospect-rock--2">AllTrails</a>
            <a class="btn" href="https://www.outdoorproject.com/united-states/vermont/prospect-rock">Outdoor Project</a>
            <a class="btn" href="https://www.greenmountainclub.org/hiking/hiking-recommendations/lamoille-river-valley/">Green Mountain Club</a>
            <a class="btn" href="https://www.komoot.com/smarttour/e1318961440/prospect-rock">Komoot</a>
          </div>
          <details class="more"><summary>Decide at base, and the easy alternative</summary>
            <p><b>Only if everyone still has energy at about 3:45.</b> The steep switchbacks can be slippery under wet leaves, and AllTrails times the hike at about 1 h 43, longer than the 1 h 10 in the plan's earlier research, so budget the longer figure. The overlook is closed April to August for falcons; that does not affect October. Trail condition for 2026 was not checked. If anyone is tired, take the Hyde Park evening below instead.</p>
          </details>
        </div>
      </div></div>
    </div>

'''
marker='    <div class="stop"><span class="mark mark--4"></span>\n      <div class="card"><div class="split"><figure><img loading="lazy" src="https://commons.wikimedia.org/wiki/Special:FilePath/Joes%20Pond%20-%20Rail%20Trail'
assert s.count(marker)==1
s=s.replace(marker,pr+marker)

# ---------- Sunday ----------
rep('<span class="time">~1:30 &ndash; 2:15 PM</span>','<span class="time">~1:30 &ndash; 2:00 PM</span>')
open(p,'w',encoding='utf-8').write(s)
print('ok')
