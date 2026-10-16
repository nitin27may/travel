import re
p='index.html'; s=open(p,encoding='utf-8').read()
def rep(a,b,count=1):
    global s
    assert s.count(a)==count,(s.count(a),a[:70])
    s=s.replace(a,b)

# --- Saturday: Hyde Park evening becomes the fallback ---
rep('<span class="time opt">4:00 PM on &mdash; DEFAULT evening</span>\n        <h3>Hyde Park evening <span class="tag tag--easy">plan A</span></h3>',
    '<span class="time opt">4:00 PM on &mdash; FALLBACK evening</span>\n        <h3>Hyde Park evening <span class="tag tag--easy">fallback &middot; rain or tired</span></h3>')
rep('<p>Back at 3:45 by design. Ten Bends Beer',
    '<p><b>Saturday evening is now the Appalachian Gap (next card).</b> Use this one only if it rains, the sky is socked in at 4:00, or nobody has the legs for another drive. Back at 3:45 by design. Ten Bends Beer')
rep('<b>The clash to know about:</b> dinner is pencilled at 6:30 and <b>sunset is 6:30</b>. As written, the last sunset of the trip is spent parking at a restaurant. Eat at 5:00 and walk after, or walk first and eat at 7:15 &mdash; Raja runs to 9:00.',
    '<b>The clash to know about:</b> dinner is pencilled at 6:30 and <b>sunset is 6:30</b>. Eat at 5:00 and walk after, or walk first and eat at 7:15. Raja is no longer a Saturday meal &mdash; it moved to Friday.')
rep('<summary>Dinner &mdash; Saturday is the last chance</summary>','<summary>Dinner on the fallback evening</summary>')
rep('<li><b>Raja</b>, 151 Main St, Stowe &mdash; open to 9:00 on a Saturday, and <b>closed Sunday</b>, so tonight is the last Indian meal available on the trip. 18 minutes from base. Ph 802-760-6685.</li>',
    '<li><b>Raja</b> is open to 9:00 on a Saturday if the fallback evening runs and you want a second visit, but the plan now eats there on Friday. It is <b>closed Sunday</b>. Ph 802-760-6685.</li>')

# --- Saturday: App Gap becomes the locked evening ---
rep('<span class="time time--opt">4:00 &ndash; 7:50 PM &mdash; ALTERNATIVE evening</span>\n          <h3>Appalachian Gap at golden hour <span class="tag tag--added">plan B &middot; instead of the Hyde Park evening</span></h3>\n          <p><b>This replaces the evening above, it does not add to it.</b> Take one or the other.</p>',
    '<span class="time">4:00 &ndash; 7:50 PM &mdash; LOCKED evening</span>\n          <h3>Appalachian Gap at golden hour <span class="tag tag--added">locked &middot; Saturday evening</span></h3>\n          <p><b>This is Saturday\'s evening.</b> The Hyde Park evening above is the fallback for rain or tired legs; it does not run as well.</p>')
rep('<summary>The dinner clash, and how to solve it</summary>','<summary>Dinner, and why Sunday no longer needs the gap</summary>')
i=s.index('<summary>Dinner, and why Sunday no longer needs the gap</summary>'); j=s.index('</details>',i)
new='''<summary>Dinner, and why Sunday no longer needs the gap</summary>
            <p><b>Raja moved to Friday</b>, so nothing is lost by getting back at 19:50. Saturday dinner is a late, simple meal: <b>Piecasso</b> (pizza, Mountain Rd, Stowe, listed as daily; tonight's hours not checked) as you pass through Stowe on VT-100, or <b>Hannaford</b> in Morrisville, which is open to 10 PM and is the safe fallback.</p>
            <p><b>Sunday:</b> with the gap done on Saturday, Sunday is Route A, the covered bridges. Route B (the App Gap traverse) is redundant and only stays on the page as history.</p>
            <p><b>Why not the other days:</b> Friday would run to 14 h 30 and costs Sunset Rock, since you cannot have two sunsets. Thursday puts you at base at 19:20 with a 06:45 start for the Pinnacle. Sunday is impossible &mdash; you are in Qu&eacute;bec by 18:29.</p>
          '''
s=s[:i]+new+s[j:]

# --- Friday: Raja gets the dinner ---
rep('<h3>von Trapp Bierhall <span class="tag tag--added">added</span></h3>','<h3>von Trapp Bierhall, then dinner at Raja <span class="tag tag--added">Raja moved here from Saturday</span></h3>')
rep('The right end to the biggest day of the trip.</p>','The right end to the biggest day of the trip. <b>The drink is here; dinner is at Raja</b> on Main St, which is open to 9:00 on Friday.</p>')
rep('<span>Veg alternative <b>Raja, to 9</b></span>','<span>Dinner <b>Raja, by 8:00</b></span>')
rep('<a class="btn" href="https://www.vontrappresort.com/">The lodge</a>','<a class="btn" href="https://www.vontrappresort.com/">The lodge</a>\n          <a class="btn primary" href="https://maps.google.com/?q=Raja+Indian+Restaurant,+151+Main+St,+Stowe,+VT">Raja map</a>')
rep('<summary>If the Bierhall is not the right dinner</summary>\n          <p>The Bierhall is a view and a beer garden more than it is a vegetarian dinner &mdash; the kitchen is Austrian, which means brats, schnitzel and one or two meatless plates. Two ways to play it: <b>drink there, eat elsewhere</b> &mdash; it is ten minutes from Sunset Rock and Raja on Main St serves until 9:00 on a Friday, so the beer garden at 7:00 and dinner at 8:00 both fit. Or eat at Raja at lunch instead and treat the Bierhall purely as the sunset drink.',
    '<summary>Why dinner is at Raja and not the Bierhall</summary>\n          <p>The Bierhall is a view and a beer garden more than it is a vegetarian dinner &mdash; the kitchen is Austrian, which means brats, schnitzel and one or two meatless plates. So the plan is <b>drink there at 7:00, dinner at Raja at 8:00</b> (151 Main St, ph <b>802-760-6685</b>, open to 9:00 on Friday). <b>Ring Raja ahead:</b> it is a small room on a foliage Friday and reservations were not confirmable online.')

# --- Sunday: Saturday evening no longer rejected ---
rep('<li><b>Saturday evening</b> &mdash; it genuinely fits: home 15:45, at the gap by 17:15, sunset 18:30, back for a 20:00 dinner. And it is the <b>best possible light</b>, because the view faces west. But it turns a 9&nbsp;h&nbsp;30 day into fourteen hours and Saturday\'s driving from 3&nbsp;h to 5&nbsp;h&nbsp;30, the night before a 6&nbsp;h&nbsp;40 drive home. <b>Not worth it.</b></li>',
    '<li><b>Saturday evening</b> &mdash; <b>chosen (locked).</b> Home 15:45, at the gap by 17:15, sunset 18:30, back at 19:50. It is the <b>best possible light</b>, because the view faces west. It turns a 9&nbsp;h&nbsp;30 day into twelve hours, which is the price. Route B below is therefore not needed.</li>')
rep('<li><b>Sunday Route B</b> &mdash; costs about thirty minutes over the bridge route, because it is a <b>traverse</b>: you go over the gap and down the west side rather than turning round. This is the recommendation.</li>',
    '<li><b>Sunday Route B</b> &mdash; costs about thirty minutes over the bridge route, because it is a <b>traverse</b>. Superseded: the gap is now on Saturday evening, in better light.</li>') if '<li><b>Sunday Route B</b> &mdash; costs about thirty minutes over the bridge route, because it is a <b>traverse</b>: you go over the gap and down the west side rather than turning round. This is the recommendation.</li>' in s else print('note: sunday route B li not found verbatim')
rep('<p><b>On a Whitby-direct trip the better golden-hour slot is Saturday evening</b> &mdash; see Day 3.','<p><b>Decision made: the gap is on Saturday evening</b> &mdash; see Day 3.')
open(p,'w',encoding='utf-8').write(s)
