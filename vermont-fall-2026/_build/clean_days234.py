s=open('index.html',encoding='utf-8').read()
frag=[]   # (group, label, old, new)
cards=[]  # (group, label, html)
def swap(group,label,old,new):
    global s
    assert s.count(old)==1,(s.count(old),old[:90])
    s=s.replace(old,new); frag.append((group,label,old,new))
def cutcard(start,end):
    global s
    i=s.index(start); assert s.count(start)==1,start[:80]
    j=s.index(end,i)+len(end)
    blk=s[i:j]; s=s[:i]+s[j:]; return blk

# ================= FRIDAY =================
G='Friday'
swap(G,'Day header route line',"Pinnacle at dawn · Emily's Bridge · village · gondola · Bingham Falls · VT-108 through the Notch · Sunset Rock","Pinnacle · Emily's Bridge · village · gondola, toll road or Recreation Path · Bingham Falls · VT-108 through the Notch · Sunset Rock")
swap(G,'Breakfast card','and you are on the trail by then.','and you are on the road by then.')
swap(G,'Stowe village stats','<span>Gondola at <b>1:15</b> &mdash; hard edge</span>','<span>Next <b>1:15</b> &mdash; toll road, Recreation Path or gondola</span>')
swap(G,'Raja bullet','The obvious pick if you want the proper meal at lunch and something lighter at night.','Your one restaurant meal of the trip, since dinners are at home. Lunch is 30 minutes, so order quickly.')
swap(G,'Green Goddess bullet','and the better one if the gondola is the priority.','and the better one if you have a gondola ticket booked.')
swap(G,'Timing bullet','If the Pinnacle ate its buffer, drop the Rec Path stroll first and Emily\'s Bridge second &mdash; do not compress lunch, the next food is dinner.','If the Pinnacle ate its buffer, drop Emily\'s Bridge first. Lunch and coffee stay at 30 minutes each; dinner is at home.')
swap(G,'Gondola card title','<h3>Gondola SkyRide, Mt. Mansfield</h3>','<h3>Gondola SkyRide, Mt. Mansfield <span class="tag tag--optional">optional</span></h3>')

# ================= SATURDAY =================
G='Saturday'
swap(G,'Breakfast card','<p>The earliest start of the trip, and the one day where getting food right actually matters:','<p>The one day where getting food right actually matters:')
swap(G,'Breakfast card','Whatever you eat between now and Craftsbury at 2 PM, you are carrying up the mountain this morning.','Whatever you eat between now and the Craftsbury coffee stop at 1:10 PM, you are carrying up the mountain this morning.')
swap(G,'Picnic list','South Beach at 10:00 in early October is genuinely cold sitting still.','South Beach at 11:00 in early October is genuinely cold sitting still.')
swap(G,'Pisgah note','gets you home at 3:45 instead of after 4.','gets you home around 3:35 instead of after 4.')
swap(G,'Pisgah note','<b>If you take the extension: not at Pulpit Rock by 8:30, turn around anyway.</b>','<b>If you take the extension: not at Pulpit Rock by 9:30, turn around anyway.</b>')
swap(G,'Pisgah extension','7.1 km / 503 m, back at 11:20 instead of 9:45.','7.1 km / 503 m, back at about 12:25 instead of 10:50.') if '7.1 km / 503 m, back at 11:20 instead of 9:45.' in s else frag.append((G,'Pisgah extension (text not found, unchanged)','',''))
swap(G,'South Beach','it is the picnic you built at 5:45 — there is no alternative','it is the picnic you built before you left — there is no alternative')
i=s.index('<summary>Vegetarian, and why this stop matters</summary>'); j=s.index('</details>',i)
old=s[i:j]
new='''<summary>Vegetarian, and why this stop matters</summary>
            <p>Daily specials rotate through pasta, shepherd's pie and salads, so the vegetarian offer varies day to day &mdash; the pizza and the baked goods are the dependable part.</p>
            <p><b>Why it is on the plan.</b> This is the day's 30-minute coffee break, a coffee-and-a-pastry stop rather than a meal, because you ate the picnic at South Beach. It is 100 metres from the Common you are already walking. If you are running late, skip it and reach base at about 3:05, which buys time for Prospect Rock.</p>
            <p><b>The one caveat if you skip.</b> This is the only staffed food between Westmore and Morrisville, so on a skip-it day the picnic has to carry you from 8:30 to home.</p>
          '''
s=s[:i]+new+s[j:]; frag.append((G,'Genny details',old,new))
swap(G,'Genny title tag','<span class="tag tag--added">coffee stop</span>','<span class="tag tag--added">coffee, 30 min</span>') if s.count('<span class="tag tag--added">coffee stop</span>')==1 else None
swap(G,'Fisher stats','<span>Base by <b>3:45</b></span>','<span>Base by <b>~3:35</b></span>')
cards.append((G,'Appalachian Gap at golden hour (Saturday evening card, marked not doing)',cutcard('    <div class="stop"><span class="mark mark--4"></span>\n      <div class="card"><div class="split">\n        <div class="content">\n          <span class="time time--opt">not doing &mdash; kept for the record</span>','</figure>\n      </div></div>\n    </div>\n')))

# ================= SUNDAY =================
G='Sunday'
swap(G,'Day header title','<h2>Two ways home</h2>','<h2>Home by the covered bridges</h2>')
swap(G,'Day header route','''<p class="route"><b>A &mdash; covered bridges:</b> Cambridge Junction &middot; Gates Farm &middot; Montgomery &times;5 &middot; Swanton &middot; Highgate Springs &middot; Whitby ~6:30 PM<br>
      <b>B &mdash; Appalachian Gap traverse:</b> Waitsfield &middot; App Gap overlook &middot; Bristol &middot; Champlain Valley &middot; Highgate Springs &middot; Whitby ~7:00 PM</p>''','<p class="route">Cambridge Junction &middot; Gates Farm &middot; Montgomery &times;5 &middot; Swanton &middot; Highgate Springs &middot; Whitby ~6:30 PM</p>')
swap(G,'Checkout card',"If Moss Glen Falls (Stowe) didn't happen Thursday, it goes here: 8:15–9:00, then continue south — the routing home runs through Waterbury anyway, so nothing backtracks.","If Moss Glen Falls did not happen on Thursday, skip it. It is 15 minutes the wrong way and Sunday is timed around the border queue.")
rc=cutcard('    <div class="stop"><span class="mark mark--1"></span>\n      <div class="card"><div class="split"><div class="content">\n        <span class="time">8:15 AM &mdash; pick one</span>','</details>\n      </div></div></div>\n    </div>\n')
cards.append((G,'The route choice card (Route A or Route B)',rc))
routeA='''    <div class="stop"><span class="mark mark--1"></span>
      <div class="card"><div class="split"><div class="content">
        <span class="time">8:15 AM &ndash; 11:15 AM</span>
        <h3>Route A: the covered bridges <span class="tag tag--added">the route home</span></h3>
        <p>West on VT-15 to Cambridge Junction, whose <b>Poland Bridge</b> is a 140-ft Burr arch from 1887, the second-largest single span in Vermont &mdash; closed to cars, so you walk through it. Then Gates Farm, then north to <b>Montgomery</b>, which has more covered bridges than any other town in the country and made Yankee's Top-25 foliage towns. Five are findable; Hectorville has been removed and is in storage.</p>
        <div class="stats"><span><b>~75 mi</b> to the border</span><span>Border <b>~12:10</b></span><span><b>7 covered bridges</b></span><span>Whitby <b>~6:30 PM</b></span></div>
        <div class="links">
          <a class="btn primary" href="https://www.google.com/maps/dir/44.601828,-72.5745682/44.6510988,-72.8146024/44.6457214,-72.8722716/44.9072383,-72.6556465/44.8996622,-72.6446362/44.9032472,-72.6397131/44.8585853,-72.6125419/44.86724,-72.65252/Swanton,%20VT/Highgate%20Springs,%20VT/">Route A on Maps</a>
        </div>
        <details class="more"><summary>Stop times</summary>
          <ul>
            <li><b>~8:40</b> Cambridge Junction (Poland Covered Bridge)</li>
            <li><b>~9:00</b> Gates Farm Covered Bridge</li>
            <li><b>~9:30</b> Drive north to Montgomery</li>
            <li><b>9:55 &ndash; 11:00</b> The Montgomery covered bridges</li>
            <li><b>~11:15</b> VT-118 to Enosburg Falls and Swanton, then I-89 north</li>
          </ul>
          <p>The App Gap traverse (Route B) is in the Archive.</p>
        </details>
      </div></div></div>
    </div>
'''
i=s.index('    <div class="stop"><span class="mark mark--4"></span>\n      <div class="card"><div class="split">\n        <div class="content">\n          <span class="time time--opt">9:15 &ndash; 10:00 AM &mdash; Route B only</span>')
# insert Route A card where the old choice card was (just before Route B card), then cut Route B
s=s[:i]+routeA+'\n'+s[i:]
cards.append((G,'Appalachian Gap overlook (Route B only)',cutcard('    <div class="stop"><span class="mark mark--4"></span>\n      <div class="card"><div class="split">\n        <div class="content">\n          <span class="time time--opt">9:15 &ndash; 10:00 AM &mdash; Route B only</span>','</figure>\n      </div></div>\n    </div>\n')))
swap(G,'Farmers Market details','''<summary>You cannot have this and an early border crossing</summary>
          <p>The market opens at 10:00, which is after Cabot and well after Cold Hollow. Doing all three means leaving Waterbury around noon, crossing at Highgate Springs in the early afternoon &mdash; exactly the Sunday leaf-season window the plan is built to avoid &mdash; and reaching Whitby closer to 8:30&nbsp;PM. <b>The honest trade: pick the market or pick the early crossing.</b> If you want the market, do Cold Hollow at 8:00, the market at 10:00, and skip Cabot; or move the whole departure to Monday if the dates allow.</p>''','''<summary>You cannot have this and an early border crossing</summary>
          <p>The market opens at 10:00. Staying for it moves the border crossing to about 13:00 or later, in the Sunday leaf-season queue window the plan is built to avoid, and you reach Whitby closer to 8:30&nbsp;PM. <b>The honest trade: pick the market or pick the early crossing.</b></p>''')
swap(G,'Border card time','<span class="time">11:00 AM</span>\n        <h3>The border, then Whitby</h3>','<span class="time">~12:10 PM</span>\n        <h3>The border, then Whitby</h3>')
swap(G,'Border card text','Lunch is the next card; Whitby around 7:15&nbsp;PM with the Cabot stop, 6:30 without it.','Lunch is the next card; Whitby around 6:30&nbsp;PM.')
swap(G,'Lunch card text','Border around 11:45, Brossard about an hour and a quarter later.','Border around 12:10, Brossard about an hour and a quarter later.')
swap(G,'Lunch card stats','<span>Budget <b>45 min</b></span><span>Whitby <b>6:30&ndash;7:15 PM</b></span>','<span>Budget <b>30 min</b></span><span>Whitby <b>~6:30 PM</b></span>')
swap(G,'Lunch card bullet','the honest comparison is the same as Thursday: a packed lunch plus washroom is still 25&ndash;30 minutes. You save half an hour, not the full 45.','a packed lunch plus washroom is still about 20 minutes, so the restaurant costs you only ten more.')

# ================= ESSENTIALS =================
G='Essentials'
swap(G,'Checklist gondola','<span>Gondola tickets online for Fri Oct 2 — book once the Sept 29 email confirms weather</span>','<span>Gondola tickets online for Fri Oct 2, only if you take the gondola (the toll road and the Recreation Path need none)</span>')
swap(G,'Checklist Resy','<span>Resy: 10 Railroad Street for Sat Oct 3</span>','<span>Resy: 10 Railroad Street for Sat Oct 3, only if you decide to eat out (dinners are at home)</span>')
swap(G,'Checklist cooler','<span>Cooler + picnic kit for Saturday\'s summit lunch</span>','<span>Cooler: Thursday packed lunch and dinner, plus Saturday\'s picnic kit</span>')
swap(G,'Dinner hours heading','<h3>Dinner hours — the catches</h3>','<h3>Dinner hours &mdash; only if you eat out</h3>')

# ================= ARCHIVE =================
out=''
groups=[]
for g,_,_,_ in frag:
    if g not in groups: groups.append(g)
for g,_,_ in cards:
    if g not in groups: groups.append(g)
for g in groups:
    body=''
    for c in [c for c in cards if c[0]==g]:
        body+=f'  <p><b>{c[1]}</b> &mdash; the full card as it stood, moved here.</p>\n  <div class="trail">\n{c[2]}  </div>\n'
    for f in [f for f in frag if f[0]==g and f[2]]:
        body+=f'  <p><b>{f[1]}, earlier wording:</b> {f[2]}</p>\n'
    out+=f'\n  <details class="more"><summary><b>{g}: earlier wording and cards</b> &middot; replaced 2026-09-26</summary>\n{body}  </details>\n'
mi=s.index('</main>'); k=s.rindex('</section>',0,mi)
s=s[:k]+out+s[k:]
open('index.html','w',encoding='utf-8').write(s)
print('ok',len(frag),'fragments',len(cards),'cards')
