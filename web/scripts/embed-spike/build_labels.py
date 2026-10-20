# Writes labels.json from the judgements below. Judged BEFORE any ranker was run; grades: 2 = clearly what the query asks for, 1 = partly or arguably.
import json, sys
places = {p['slug'] for p in json.load(open('.cache/places.json'))}
Q = []
def q(id, query, why, g2=(), g1=(), spec=None):
    rel = {s: 2 for s in g2}
    rel.update({s: 1 for s in g1})
    bad = [s for s in rel if s not in places]
    if bad: sys.exit(f'unknown slugs in {id}: {bad}')
    Q.append({'id': id, 'specId': spec, 'query': query, 'relevant': rel, 'rationale': why})

q(1, 'easy hike with kids near Banff in September', 'Flat or short lakeshore and canyon walks in the Banff / Lake Louise area score 2; longer or steeper but doable walks score 1.',
  ['johnston-canyon-walk','lake-louise-lakeshore','moraine-lakeshore','fenland-loop','johnson-lake-loop','moraine-lake-rockpile-loop'],
  ['johnston-canyon','lake-agnes-tea-house','larch-valley','ink-pots-trail','plain-of-six-glaciers-to-teahouse-and-abbot-pass-viewpoint'], spec=1)
q(2, 'waterfall I can reach with a stroller', 'Falls with a paved or very short, flat approach score 2 (their separate walk entry scores 1); short but rougher walks score 1. The data has no stroller field, so this rests on what the places are.',
  ['athabasca-falls','sunwapta-falls','takakkaw-falls','godafoss','gullfoss','seljalandsfoss','skogafoss','elbow-falls','montmorency-falls'],
  ['athabasca-falls-walk','takakkaw-falls-walk','wapta-falls-yoho','wapta-falls','johnston-canyon-lower-falls','overlander-falls','canyon-sainte-anne','dettifoss','troll-falls','sentier-la-chute','elbow-falls-loop'], spec=2)
q(3, 'lakes in Iceland', 'Only one Iceland place is typed Lake.', ['jokulsarlon'], [], spec=3)
q(4, 'hot springs in Iceland in winter', 'Myvatn Nature Baths is the soaking place; Geysir is geothermal but not a soak.', ['myvatn-nature-baths'], ['geysir','namaskard'], spec=4)
q(5, 'via ferrata for a 12 year old in the Dolomites', 'Cinque Torri states a beginner via ferrata, 10+. The cabled routes are partial matches. The Banff via ferrata is in the wrong range.',
  ['cinque-torri'], ['croda-del-becco','sass-pordoi-and-piz-boe','lago-di-sorapis'], spec=5)
q(6, 'short walk under 3 km with a toddler', 'Loops of about 1-2 km on flat ground score 2; flat but longer or one-way walks score 1.',
  ['wedge-pond-loop','mount-lorette-ponds-loop','elbow-falls-loop','fenland-loop','moraine-lake-rockpile-loop','wedge-pond','mount-lorette-ponds'],
  ['johnson-lake-loop','lake-louise-lakeshore','lago-di-dobbiaco-walk','val-fiscalina','vallunga','parus-trail','riverside-walk','lago-di-dobbiaco'], spec=6)
q(7, 'trails under 5 km near Jasper', 'Short Jasper-area loops and walks.',
  ['lake-annette-loop','mary-schaffer-loop','moose-lake-loop','athabasca-falls-walk','toe-of-athabasca-glacier'], ['miette-mine-trail'], spec=7)
q(8, 'half day hike in Zion', 'The Narrows and Scout Lookout are half-day outings; the two easy valley paths are shorter.',
  ['narrows-from-the-temple-of-sinawava','scout-lookout-angels-landing-chains-view'], ['riverside-walk','parus-trail','the-narrows'], spec=8)
q(9, 'wheelchair accessible sights in Vermont', 'The data has no accessibility field. A paved path scores 2; roadside sights score 1. Tests honesty about a gap more than ranking.',
  ['stowe-recreation-path'], ['covered-bridge-loop','smugglers-notch','stowe'], spec=9)
q(10, 'viewpoint for sunset in the Dolomites', 'Places whose summary names sunset score 2; viewpoints and lakes with a west or open aspect score 1.',
  ['lago-di-limides','santa-maddalena-val-di-funes'], ['seceda-ridge','cadini-di-misurina-viewpoint','tre-cime-north-face-viewpoint-by-rifugio-locatelli','passo-gardena','dolomites','lago-di-limides-walk','rifugio-nuvolau-and-averau'], spec=10)
q(11, 'hidden gems in Utah', 'Remote or little-visited Utah places score 2; well-known but quieter ones score 1.',
  ['bentonite-hills','factory-butte','long-dong-silver-spire','stansbury-island','goblin-valley','lower-calf-creek-falls'], ['kanarra-falls','hickman-bridge','fruita-orchards'], spec=11)
q(12, 'rainy day things to do with kids in Banff', 'Indoor or covered options only.', ['cave-and-basin-national-historic-site','banff-upper-hot-springs'], ['fairmont-banff-springs-spa'], spec=20)
q(13, 'free things to do near Lake Louise', 'Free walks and lakes score 2; Moraine Lake costs a shuttle and the Fairview and Larch Valley trails are further, so 1.',
  ['lake-louise','lake-louise-lakeshore','lake-agnes-tea-house','plain-of-six-glaciers-to-teahouse-and-abbot-pass-viewpoint'], ['moraine-lake','moraine-lakeshore','moraine-lake-rockpile','moraine-lake-rockpile-loop','larch-valley','mount-fairview'], spec=21)
q(14, 'stroll near Lake Louise', 'Flat lakeshore walks.', ['lake-louise-lakeshore','moraine-lakeshore'], ['moraine-lake-rockpile-loop','lake-agnes-tea-house','lake-louise'], spec=24)
q(15, 'kid friendly waterfalls in Ontario', 'Ragged Falls is the only Ontario waterfall.', ['ragged-falls'], [], spec=25)
q(16, 'hard hikes in Chamonix in July', 'Steep Chamonix hikes score 2; the col walk is gentler.', ['lac-blanc-via-flegere','plan-de-laiguille'], ['col-des-montets'], spec=27)
q(17, 'waterfalls worth the journey in Patagonia', 'Only one waterfall in the Patagonia places.', ['chorrillo-del-salto'], [], spec=29)
q(18, 'white water rafting', 'Rafting runs score 2; calm floats and the river entries score 1.',
  ['rafting-on-the-rienza','kicking-horse-river-upper-section','kicking-horse-river-lower-canyon','kennecott-river-rafting-wrangell-st-elias'], ['kicking-horse-river','bow-river-float-raft','kananaskis-river','rienza'])
q(19, 'soak in hot springs', 'Places where you bathe score 2; towns and spas with a hot-spring link score 1.',
  ['banff-upper-hot-springs','radium-hot-springs','miette-hot-springs','whiteswan-lake-and-lussier-hot-springs','myvatn-nature-baths'], ['radium-hot-springs-pools','ouray','fairmont-banff-springs-spa'])
q(20, 'see a glacier up close', 'Places that put you at a glacier score 2; glacier views from a distance score 1.',
  ['athabasca-glacier-and-columbia-icefield','toe-of-athabasca-glacier','athabasca-glacier-guided-ice-walk','jokulsarlon','grotte-de-la-mer-de-glace','perito-moreno-walkways','plain-of-six-glaciers-to-teahouse-and-abbot-pass-viewpoint','mount-edith-cavell-and-cavell-meadows'],
  ['columbia-icefield-skywalk','diamond-beach','montenvers-train','parker-ridge','wilcox-pass','cavell-meadows','snaefellsjokull-view'])
q(21, 'horseback riding', 'The three horse-ride entries.', ['banff-horseback-rides','brewster-stables-lake-louise-horseback','jasper-and-waterton-horseback-rides'], [])
q(22, 'scenic drive through the mountains', 'Mountain scenic drives score 2; short or valley drives score 1.',
  ['icefields-parkway-scenic-drive','highwood-pass-and-hwy-40-corridor','million-dollar-highway','zion-canyon-scenic-drive-by-shuttle','smith-dorrien-spray-trail'],
  ['red-rock-parkway-and-red-rock-canyon','waterton-red-rock-parkway','vermilion-lakes-drive','strada-per-il-rifugio-auronzo'])
q(23, 'world war one history in the mountains', 'The summaries name WWI open-air museums at Cinque Torri and Monte Piana; Lagazuoi has war tunnels.',
  ['cinque-torri','monte-piana'], ['lagazuoi-cable-car-and-tunnels','lagazuoi-tunnels'])
q(24, 'dark sky stargazing', 'Places tagged or named dark sky.', ['jasper-dark-sky-preserve-stargazing','sentier-des-cimes-parc-national-du-mont-megantic'], [])
q(25, 'black sand beach', 'Black-sand beaches on the Iceland coast. The text never says black sand, so this needs world knowledge.', ['reynisfjara-beach','djupalonssandur','diamond-beach'], [])
q(26, 'fall colours hike', 'Trails tagged Fall colours score 2; places known for foliage score 1.',
  ['la-crete-trail-mont-sainte-anne','mont-du-dome','mont-saddle-and-montagne-de-marbre-loop','sentier-des-cimes-parc-national-du-mont-megantic','leperon','le-buton-lookout-le-massif-de-charlevoix'],
  ['white-mountain-national-forest','mount-rainier-national-park','stowe','larch-valley','track-and-tower-trail','covered-bridge-loop','mont-xalibu','larch-valley-to-sentinel-pass'])
q(27, 'walk through a canyon', 'Canyon walks score 2; canyon-adjacent or slot-canyon-with-permit entries score 1.',
  ['johnston-canyon','johnston-canyon-walk','maligne-canyon','marble-canyon','marble-canyon-walk','narrows-from-the-temple-of-sinawava','the-narrows','fjadrargljufur-canyon','canyon-sainte-anne'],
  ['natural-bridge','canyon-des-portes-de-lenfer','kanarra-falls','ink-pots','ink-pots-trail'])
q(28, 'wildlife watching', 'Places or tours built around seeing animals.',
  ['jasper-wildlife-tours','elk-rut-viewing-and-bighorn-rut','penguin-colony-stop','laguna-nimez-birds','bonaventure-island'], ['kicking-horse-mountain-resort-golden-eagle-express-gondola','yellowstone-national-park'])
q(29, 'mountain hut or tea house for lunch', 'Huts and tea houses score 2; hikes whose summary names a lunch stop score 1.',
  ['rifugio-nuvolau-and-averau','rifugio-scotoni','lake-agnes-tea-house'], ['adolf-munkel-weg','plain-of-six-glaciers-to-teahouse-and-abbot-pass-viewpoint','tre-cime-di-lavaredo-loop'])
q(30, 'cable car or gondola up a mountain', 'Lifts that take you up a mountain.',
  ['banff-gondola','lake-louise-summer-gondola','lake-louise-sightseeing','jasper-skytram','aiguille-du-midi','lagazuoi-cable-car-and-tunnels','nakiska-summer-gondola-coaster','kicking-horse-mountain-resort-golden-eagle-express-gondola'],
  ['sass-pordoi-and-piz-boe','sulphur-mountain-switchback-trail-hike-up-gondola-down','sulphur-mountain','aiguille-du-midi-summit-terraces'])

dropped = [
 {'specId': 12, 'query': 'lake with toilets close to the parking', 'why': 'Needs toilet and walk-from-car facts the public cards do not carry; unjudgeable from the data.'},
 {'specId': 13, 'query': 'day trip from Toronto under 2 hours', 'why': 'Trip query; the spike ranks the 353 places.'},
 {'specId': 14, 'query': 'weekend trip with kids in October', 'why': 'Trip query.'},
 {'specId': 15, 'query': 'road trip in Utah with a 6 year old', 'why': 'Trip query.'},
 {'specId': 16, 'query': 'camper van trip in Iceland', 'why': 'Trip query.'},
 {'specId': 17, 'query': 'two week trip in summer', 'why': 'Trip query.'},
 {'specId': 18, 'query': 'long weekend in Vermont for the fall colours', 'why': 'Trip query.'},
 {'specId': 19, 'query': 'swimming beach with a lifeguard in Ontario', 'why': 'No Ontario beach among the 353 places, and no lifeguard field.'},
 {'specId': 22, 'query': 'gondola rides in Switzerland in June', 'why': 'No Swiss gondola in the places (one dam). Replaced by own query 30.'},
 {'specId': 23, 'query': 'moderate hike with 500 m climb', 'why': 'Needs climb figures that most cards lack; unjudgeable.'},
 {'specId': 26, 'query': 'Niagara Falls', 'why': 'A name query, and Niagara is not among the 353 places.'},
 {'specId': 28, 'query': 'dog friendly loop trail', 'why': 'No dog field in the public data.'},
 {'specId': 30, 'query': 'kayaking in Norway in August', 'why': 'No Norway place.'},
]
json.dump({'note': 'Judged from the public place data before any ranker ran. Grade 2 = clearly asked for, 1 = partly. specId points at docs/v2/features/smart-search.md section 3.', 'queries': Q, 'droppedSpecQueries': dropped}, open('labels.json', 'w'), indent=1)
print(len(Q), 'queries;', sum(len(x['relevant']) for x in Q), 'judgements')
