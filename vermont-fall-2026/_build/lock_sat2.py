p='index.html'; s=open(p,encoding='utf-8').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:70]); s=s.replace(a,b)
rep('This is the recommendation.</li>','<b>Superseded:</b> the gap is now on Saturday evening, in better light.</li>')
rep('<p>What replaces them is a genuine fork.','<p><b>Update:</b> the Appalachian Gap is now locked for Saturday evening, so <b>Route A (covered bridges) is Sunday</b>. Route B stays below only for the record.</p>\n        <p>What replaces them is a genuine fork.')

# ---- Thursday maps ----
old=s[s.index('  <div class="mapframe">\n    <iframe title="Hyde Park, Vermont area map"'):]
old=old[:old.index('</div>\n</section>')]
whit='https://www.google.com/maps/dir/Whitby,%20ON/1555%20Provencher%20Blvd,%20Brossard,%20QC/Saint-Armand,%20QC/Highgate%20Springs,%20VT/St.%20Albans,%20VT/44.601828,-72.5745682/44.4823794,-72.6245046/44.5727869,-72.5967606/44.4656857,-72.6843216/44.601828,-72.5745682/'
kou='https://www.google.com/maps/dir/106+Blossom+Circle,+Dayton,+NJ+08810/1592+Center+Rd,+Hyde+Park,+VT+05655/'
new=f'''  <div class="mapframe">
    <iframe title="Whitby to Hyde Park route" loading="lazy" src="https://maps.google.com/maps?saddr=Whitby%2C%20ON&amp;daddr=Saint-Armand%2C%20QC%20to%3A1592%20Center%20Rd%2C%20Hyde%20Park%2C%20VT&amp;output=embed"></iframe>
    <div class="bar"><span>Map 1 &mdash; Whitby, all Thursday stops</span><a href="{whit}">Open all stops in Google Maps</a></div>
  </div>
  <p class="note" style="margin:8px 2px 0">Map 1 order: Whitby, Le Tandoor (Brossard), Saint-Armand (forces the quiet Highgate crossing), Highgate Springs border, St. Albans fuel, base check-in, Moss Glen Falls, Hannaford, Raja, back to base. The embed above shows the road only; the button opens every stop.</p>

  <div class="mapframe">
    <iframe title="Dayton NJ to Hyde Park route" loading="lazy" src="https://maps.google.com/maps?saddr=106%20Blossom%20Circle%2C%20Dayton%2C%20NJ%2008810&amp;daddr=1592%20Center%20Rd%2C%20Hyde%20Park%2C%20VT&amp;output=embed"></iframe>
    <div class="bar"><span>Map 2 &mdash; Koushik, from Dayton NJ</span><a href="{kou}">Open route in Google Maps</a></div>
  </div>
  <p class="note" style="margin:8px 2px 0">Koushik drives from 106 Blossom Circle, Dayton, NJ 08810 to the same base, 1592 Center Rd, Hyde Park. It is the opposite direction from Whitby, and Google picks the road. Check the drive time in Maps on the day and add stops (fuel, food) once his plan is set. Open question: does he meet you at Moss Glen Falls or Raja on Thursday, or just at base?</p>
'''
s=s.replace(old,new)
open(p,'w',encoding='utf-8').write(s)
