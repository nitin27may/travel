p='PLAN.md'; s=open(p,encoding='utf-8').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:70]); s=s.replace(a,b)
rep('| Day 3 (Sat) | Northeast Kingdom: Pisgah **to Pulpit Rock**, Lake Willoughby, Craftsbury Common, **+ Barr Hill** (backup: **Two Gaps day**, see addendum) |',
    '| Day 3 (Sat) | Northeast Kingdom: Pisgah **to Pulpit Rock**, Lake Willoughby, Craftsbury Common, **+ Barr Hill**, then **Appalachian Gap at golden hour (LOCKED 2026-09-25)** (backup: **Two Gaps day**, see addendum) |')
rep('| Drive home | Sun Oct 4 via the **covered-bridge route**','| Drive home | Sun Oct 4 via the **covered-bridge route (Route A; Route B is superseded by the Saturday gap)**')
rep('### Thursday alternative — arrive over the Appalachian Gap',
'''### Thursday maps (added 2026-09-25)

- **Map 1, Whitby, every stop:** https://www.google.com/maps/dir/Whitby,%20ON/1555%20Provencher%20Blvd,%20Brossard,%20QC/Saint-Armand,%20QC/Highgate%20Springs,%20VT/St.%20Albans,%20VT/44.601828,-72.5745682/44.4823794,-72.6245046/44.5727869,-72.5967606/44.4656857,-72.6843216/44.601828,-72.5745682/
- **Map 2, Koushik from 106 Blossom Circle, Dayton, NJ 08810 to the base:** https://www.google.com/maps/dir/106+Blossom+Circle,+Dayton,+NJ+08810/1592+Center+Rd,+Hyde+Park,+VT+05655/ — road chosen by Google, no stops added yet. **Open:** does Koushik meet at Moss Glen Falls / Raja Thursday, or only at base? Drive time not verified.

### Thursday alternative — arrive over the Appalachian Gap''')
rep('### The recommendation, revised\n','### DECISION (2026-09-25): Saturday evening, locked. Raja moved to Friday.\n\n### The recommendation, revised\n')
rep('**Solve the dinner clash by swapping the meals:** move **Raja to Friday**','**Solve the dinner clash by swapping the meals (DONE, 2026-09-25):** move **Raja to Friday**')
rep('| 18:30 | **Dinner — last chance for Raja** (Sat, to 21:00; **closed Sunday**). Alternatives:',
    '| 16:00–19:50 | **LOCKED evening: Appalachian Gap at golden hour.** Depart 16:00, overlook by 17:15, sunset 18:30, base 19:50. The Hyde Park evening (Ten Bends, rail trail) is the fallback for rain or tired legs. | |\n| ~19:30 | **Dinner: late and simple** — Piecasso (pizza, Stowe, hours not checked) on the way back, or Hannaford Morrisville (to 22:00). Raja is on Friday now. Fallback-evening alternatives: 10 Railroad Street (Resy, closed Sunday) or Black Diamond BBQ (Sat 5–9, sides only for you). Old line, superseded: last chance for Raja. Alternatives:')
rep('- **Saturday evening** — it *does* fit','- **Saturday evening** — **CHOSEN 2026-09-25.** It *does* fit')
rep('  **Rejected on fatigue, not on merit.**','  Accepted on 2026-09-25 with Raja moved to Friday; the old rejection was on fatigue, not merit.')
rep('- **Sunday Route B** — costs ~30 min. **This one.**','- **Sunday Route B** — costs ~30 min. Superseded by the Saturday gap.')
open(p,'w',encoding='utf-8').write(s)
