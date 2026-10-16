s=open('index.html',encoding='utf-8').read()
old=open('_build/index.before-final.html.txt',encoding='utf-8').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:80]); s=s.replace(a,b)
def cut(text,start,end):
    i=text.index(start); j=text.index(end,i)+len(end); return text[i:j]

# ---- extract blocks to archive (verbatim) ----
gap=cut(s,'    <div class="stop"><span class="mark mark--4"></span>\n      <div class="card"><div class="split">\n        <div class="content">\n          <span class="time time--opt">3:15 &ndash; 7:20 PM','</figure>\n      </div></div>\n    </div>\n')
brossard=cut(old,'    <div class="stop"><span class="mark mark--4"></span>\n      <div class="card"><div class="split">\n        <div class="content">\n          <span class="time">1:15 &ndash; 2:15 PM</span>','</details>\n        </div>\n      </div></div>\n    </div>\n')
dinner=cut(old,'    <div class="stop"><span class="mark mark--4"></span>\n      <div class="card"><div class="split"><figure><img loading="lazy" src="https://commons.wikimedia.org/wiki/Special:FilePath/Downtown%20Morrisville%20wide.JPG','</details>\n      </div></div></div>\n    </div>\n')
napanee_old='<details class="more"><summary>Why not eat here</summary>\n            <p>Highway-service vegetarian on the 401 is a cheese bagel and a hash brown. Brossard is only three hours further and has actual food &mdash; hold out. If the car needs a stop sooner, Mallorytown North is the better-stocked of the two.</p>\n          </details>'
assert napanee_old in s
depart_old='ON-401 east. Fuel and coffee at ONroute Napanee (~10:10) or Mallorytown North (~11:15) — the last big stop before Quebec. The A-30 bypass skips Montreal island entirely; with the Napanee stop you cross the toll bridge about 1:00, comfortably between rush peaks, which puts you at the Brossard lunch exit at 1:15. A-35 is now freeway all the way to Saint-Armand (opened Sept 2025 — ignore older trip reports about slow Route 133 villages).'
assert depart_old in s

# ---- remove the gap card from Day 1 (moved to archive) ----
s=s.replace(gap,'',1)

# ---- Day 1 rewrites ----
rep(depart_old,'ON-401 east. Fuel and coffee at ONroute Napanee (~10:10) or Mallorytown North (~11:15), the last big stop before Quebec. The A-30 bypass skips Montreal island entirely; you cross the toll bridge around midday, between the rush peaks. A-35 is now freeway all the way to Saint-Armand (opened Sept 2025, so ignore older trip reports about slow Route 133 villages). Lunch and dinner are packed; the day has three 20-minute breaks and nothing else.')
rep('<h3>Depart Whitby — full tank</h3>','<h3>Depart Whitby &mdash; full tank, 08:00 (07:30 is better)</h3>')
rep('<span class="time">8:00 AM</span>\n        <h3>Depart Whitby','<span class="time">7:30 &ndash; 8:00 AM</span>\n        <h3>Depart Whitby')
rep('Keep it to twenty minutes: the real stop is lunch on the South Shore.','Keep it to twenty minutes. Lunch is packed, at break 2.')
rep(napanee_old,'<details class="more"><summary>Food here</summary>\n            <p>Highway-service vegetarian on the 401 is a cheese bagel and a hash brown, so eat the packed lunch at break 2 instead. If the car needs a stop sooner, Mallorytown North is the better-stocked of the two. The old note pointing to the Brossard restaurants is in the Archive.</p>\n          </details>')
rep('<h3>St. Albans &mdash; fuel, and coffee if you want it <span class="tag tag--optional">optional</span></h3>','<h3>St. Albans &mdash; fuel and a stretch <span class="tag tag--added">break 3</span></h3>')
rep('The fuel stop is not optional &mdash; Vermont gas runs about 1.50 CAD/L against Quebec\'s 1.80, and this is the first US town off I-89 exit 19. The coffee is. Ten minutes for fuel alone; thirty if you sit down.','Vermont gas runs about 1.50 CAD/L against Quebec\'s 1.80, and this is the first US town off I-89 exit 19. Fuel and a stretch fit in 20 minutes; coffee is optional and adds ten.')
rep('<span>Fuel <b>10 min</b></span><span>With coffee <b>30 min</b></span>','<span>Break <b>20 min</b></span><span>With coffee <b>30 min</b></span>')
rep('Stowe village is 18 minutes south; the Lamoille Valley Rail Trail is effectively at the doorstep.','Stowe village is 18 minutes south. The Lamoille Valley Rail Trail access is 3.2 km away, a five-minute drive, not at the door.')
# overview item 5 stays true (Thursday/Sunday driving); Friday/Sat lines fine.

# ---- Archive section + nav ----
rep('<a href="#essentials">Essentials<span class="d">checklist · live links</span></a>','<a href="#essentials">Essentials<span class="d">checklist · live links</span></a>\n    <a href="#archive">Archive<span class="d">old versions</span></a>')
arch=f'''<!-- ============ ARCHIVE ============ -->
<section class="day" id="archive">
  <div class="sign"><div class="date"><span class="dow">Archive</span><span class="num">OLD</span></div>
  <div class="body"><h2>Archive &mdash; earlier versions, kept for reference</h2>
  <p class="route">Nothing here is in the current plan. Each block is the text as it stood before the change, moved here instead of deleted.</p></div></div>

  <details class="more"><summary><b>Thursday: arrive over the Appalachian Gap</b> &middot; removed 2026-09-25, decided not doing</summary>
  <div class="trail">
{gap}  </div>
  </details>

  <details class="more"><summary><b>Thursday: sit-down lunch in Brossard</b> &middot; replaced 2026-09-25 by a packed lunch</summary>
  <div class="trail">
{brossard}  </div>
  </details>

  <details class="more"><summary><b>Thursday: groceries, then dinner at Raja</b> &middot; replaced 2026-09-25, dinner is at home</summary>
  <div class="trail">
{dinner}  </div>
  </details>

  <details class="more"><summary><b>Thursday: earlier wording of two small notes</b> &middot; replaced 2026-09-25</summary>
    <p><b>Depart card:</b> {depart_old}</p>
    <p><b>Napanee, &ldquo;Why not eat here&rdquo;:</b> Highway-service vegetarian on the 401 is a cheese bagel and a hash brown. Brossard is only three hours further and has actual food &mdash; hold out. If the car needs a stop sooner, Mallorytown North is the better-stocked of the two.</p>
    <p><b>Check-in card:</b> Stowe village is 18 minutes south; the Lamoille Valley Rail Trail is effectively at the doorstep. (Wrong: the trail access is 3.2 km away.)</p>
  </details>
</section>

'''
rep('</main>',arch+'</main>')
open('index.html','w',encoding='utf-8').write(s)
print('ok')
