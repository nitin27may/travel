import { describe, expect, it } from "vitest";
import { DATED_FOLDER, DATED_FOLDER_WHY, OWN_HOSTS, privacyHits, STREET_ADDRESS } from "../../src/privacy/detect.ts";
import { HOME_TOWN_RE } from "../../src/privacy/home.ts";
import { publicGazetteer } from "../../src/privacy/towns.ts";
import { encodePolyline5 } from "../../src/schema/api/legs.ts";
import { HOME_PROBE, northOfHome } from "./probe.ts";

const WORD = HOME_TOWN_RE.source.replace(/[^a-z]/gi, "").toLowerCase();
const NAME = WORD.charAt(0).toUpperCase() + WORD.slice(1);

describe("privacy detector", () => {
  it("finds the home town, a planning note, a street address, a private key and a status word", () => {
    const whys = (x: unknown) => privacyHits(x).map((h) => h.why);
    expect(whys({ a: `Drive from ${NAME}` })).toEqual(["the home town"]);
    expect(whys({ a: "Hotel idea near the lake" })).toEqual(["a household planning note"]);
    expect(whys({ a: "Meet at 123 Maple Street" })).toEqual(["a household planning note"]);
    expect(whys({ sourceTypes: ["x"] })).toEqual(["a private key"]);
    expect(whys({ status: "planned" })).toEqual(["a private key"]);
    expect(whys({ status: "open", hours: "30 min each way" })).toEqual([]);
  });
  it("finds the internal research columns in a served body: meta, notes_private and doc (RI-6, RIS-C); notes stays public", () => {
    const whys = (x: unknown) => privacyHits(x).map((h) => h.why);
    expect(whys({ place: { ref: "place/x", meta: { schema_version: 1, run_id: "DATA-D7R" } } })).toEqual(["a private key"]);
    expect(whys({ items: [{ ref: "place/x", notes_private: "lead to follow" }] })).toEqual(["a private key"]);
    expect(whys({ entity: { ref: "place/x", doc: {} } })).toEqual(["a private key"]);
    expect(privacyHits({ items: [{ meta: {} }] })[0]!.where).toBe("$.items[0].meta");
    expect(whys({ notes: "Bring a jacket", trip: { notes: [] } })).toEqual([]);
  });
  it("finds a point near home as an object, as a coordinate array in either order, and inside an export body", () => {
    const p = northOfHome(0.5);
    expect(privacyHits({ lat: p.lat, lon: p.lon }).length).toBe(1);
    expect(privacyHits({ geometry: [[p.lon, p.lat], [-115.5, 51.1]] }).length).toBe(1);
    expect(privacyHits({ geometry: [[p.lat, p.lon]] }).length).toBe(1);
    expect(privacyHits({ body: `<gpx><wpt lat="${p.lat.toFixed(5)}" lon="${p.lon.toFixed(5)}"><name>x</name></wpt></gpx>` }).length).toBe(1);
    expect(privacyHits({ body: `<kml><coordinates>${p.lon.toFixed(5)},${p.lat.toFixed(5)},0 ${HOME_PROBE.lon.toFixed(1)},9.0</coordinates></kml>` }).length).toBe(1);
  });
  it("finds a private origin key (store.ts A24) as a value, inside text and as a map key, and leaves wikiloc and place refs alone", () => {
    const whys = (x: unknown) => privacyHits(x).map((h) => h.why);
    const origin = "a private origin key (wishlist or prototype id)";
    expect(whys({ ref: "loc:CA/AB/x/y" })).toEqual([origin]);
    expect(whys({ ref: "proto:braies" })).toEqual([origin]);
    expect(whys({ body: '{"items":[{"ref":"loc:IT/x"}]}' })).toEqual([origin]);
    expect(whys({ refSlugs: { "proto:x": "x" } })).toEqual([origin]);
    expect(JSON.stringify(privacyHits({ refSlugs: { "loc:CA/AB/secret": "x" } }))).not.toContain("secret");
    expect(whys({ ref: "place/lake-louise", note: "wikiloc: 12345 tracks", s: "proto: ", t: "prototype_approx", u: "trip/x/sight:ragged falls" })).toEqual([]);
  });
  it("lifts the home-town text rule only for gazetteer towns (A33), and lifts nothing without a gazetteer", () => {
    const id = `ca-zz-${WORD}`;
    const gazetteer = publicGazetteer([{ id, name: NAME, lat: 50, lon: -100 }]);
    const row = { items: [{ id, name: WORD.toUpperCase() }] };
    expect(privacyHits(row, 20, { gazetteer })).toEqual([]);
    expect(privacyHits(row).map((h) => h.why)).toEqual(["the home town", "the home town"]);
    // a sentence is never a slot, and a planning note in a name slot is still found
    expect(privacyHits({ items: [{ id, name: `Hotel idea in ${WORD}` }] }, 20, { gazetteer }).map((h) => h.why)).toEqual(["a household planning note"]);
    // review API3-R-2: nearTown exempts its own string only
    expect(privacyHits({ items: [{ slug: "x", name: "Lake", nearTown: id }] }, 20, { gazetteer })).toEqual([]);
    expect(privacyHits({ items: [{ slug: "x", name: `${NAME} Harbour`, nearTown: id }] }, 20, { gazetteer }).map((h) => h.why)).toEqual(["the home town"]);
  });
  it("does not read the request's own words back as household text under an echo key (A40), and reads them everywhere else", () => {
    for (const q of [NAME, "hotel ideas", "base camp: x", "100 Queen Street", `${NAME} hotel ideas`]) {
      expect(privacyHits({ query: q, q, unused: q.split(" "), terms: [q] }, 20, { echo: [q] })).toEqual([]);
      expect(privacyHits({ query: q }).length).toBe(1);
      expect(privacyHits({ query: q, summary: q }, 20, { echo: [q] }).map((h) => h.where)).toEqual(["$.summary"]);
    }
    // an href's query parameter echoing the request, and a city= gazetteer id, are not read; another parameter is
    expect(privacyHits({ href: `/places/?q=${encodeURIComponent(`${NAME} hotel ideas`)}` }, 20, { echo: [`${NAME} hotel ideas`] })).toEqual([]);
    expect(privacyHits({ href: `/places/?q=${WORD}` }, 20, { echo: ["lake"] }).length).toBe(1);
    // a coordinate pair the visitor typed is an echo too: refusing it would answer 500 for exactly the points near home
    const p = northOfHome(0.4);
    const typed = `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)} lookout above the lake`;
    expect(privacyHits({ query: typed }, 20, { echo: [typed] })).toEqual([]);
    expect(privacyHits({ note: typed }, 20, { echo: [typed] }).length).toBe(1);
  });
  it("reads a resolve row's `asked` as an echo of the request (FAV-1X) and stays strict for every other key and value", () => {
    const asked = `place:${WORD}`;
    const row = { asked, state: "unknown", space: "place", slug: null, ref: null, name: null, kind: null, cc: null };
    // the visitor's own value under `asked` is not read as text, alone or in a list of rows
    expect(privacyHits({ items: [row] }, 20, { echo: [asked] })).toEqual([]);
    expect(privacyHits({ items: [row, { ...row, asked: `trip:${NAME}` }] }, 20, { echo: [asked, `trip:${NAME}`] })).toEqual([]);
    // without the request's echo, or when the request did not send it, `asked` is read like any string
    expect(privacyHits({ items: [row] }).map((h) => h.why)).toEqual(["the home town"]);
    expect(privacyHits({ items: [row] }, 20, { echo: ["place:lake"] }).map((h) => h.where)).toEqual(["$.items[0].asked"]);
    // the same words in ANY other key still fail, even when the request sent them
    for (const k of ["slug", "ref", "name", "kind", "cc", "space", "state", "summary", "note", "title"]) {
      expect(privacyHits({ items: [{ ...row, [k]: `${NAME} town` }] }, 20, { echo: [asked, `${NAME} town`] }).map((h) => h.where), k).toEqual([`$.items[0].${k}`]);
    }
    // a nested object under `asked` is not an echo: its strings sit under their own keys
    expect(privacyHits({ asked: { note: NAME } }, 20, { echo: [NAME] }).map((h) => h.where)).toEqual(["$.asked.note"]);
    // the private keys stay private next to an echoed `asked`
    for (const k of ["favouredAt", "favourites", "fromRef", "gw", "copiedAt", "travellers"]) {
      expect(privacyHits({ items: [{ ...row, [k]: "x" }] }, 20, { echo: [asked] }).map((h) => h.why), k).toEqual(["a private key"]);
    }
    // an origin key or a planning note the request did not send is still found under `asked`
    expect(privacyHits({ asked: "loc:CA/x" }, 20, { echo: ["place:lake"] }).map((h) => h.why)).toEqual(["a private origin key (wishlist or prototype id)"]);
    expect(privacyHits({ asked: "hotel idea" }, 20, { echo: ["place:lake"] }).map((h) => h.why)).toEqual(["a household planning note"]);
  });
  it("decodes an encoded line under `geometry` and finds a vertex near home, and never reads its characters as words (A39)", () => {
    const p = northOfHome(0.5);
    expect(privacyHits({ geometry: encodePolyline5([[-116.1, 51.3], [p.lon, p.lat]]) }).map((h) => h.why)).toEqual(["a coordinate near the home town in an encoded line"]);
    expect(privacyHits({ geometry: encodePolyline5([[-116.1, 51.3], [-116.2, 51.4]]) })).toEqual([]);
  });
  it("walks a JSON body (the json export) as a structure: a polyline or a point near home inside it is found (A39, review API3-R-6)", () => {
    const p = northOfHome(0.5);
    const line = encodePolyline5([[-116.1, 51.3], [p.lon, p.lat]]);
    const body = JSON.stringify({ title: "x", days: [{ legs: [{ geometry: line }] }] });
    expect(privacyHits({ filename: "x.json", mime: "application/json", body }).map((h) => h.why)).toEqual(["a coordinate near the home town in an encoded line"]);
    expect(privacyHits({ body: JSON.stringify({ stops: [{ point: { lat: p.lat, lon: p.lon } }] }) }).map((h) => h.why)).toContain("a point near the home town");
    expect(privacyHits({ body: JSON.stringify({ days: [{ legs: [{ geometry: encodePolyline5([[-116.1, 51.3], [-116.2, 51.4]]) }] }] }) })).toEqual([]);
    expect(privacyHits({ body: "{not json" })).toEqual([]);
  });
  it("leaves a far point alone, and a hit names no coordinate", () => {
    const far = northOfHome(30);
    expect(privacyHits({ lat: far.lat, lon: far.lon, g: [[far.lon, far.lat]], body: `lat="${far.lat.toFixed(5)}" lon="${far.lon.toFixed(5)}" and more text here` })).toEqual([]);
    const near = northOfHome(0.2);
    expect(JSON.stringify(privacyHits({ lat: near.lat, lon: near.lon }))).not.toContain(String(near.lat).slice(0, 6));
  });
});

describe("privacy detector: dated trip folders (public-ref-aliases 6.1, REF-C A3)", () => {
  const dated = (x: unknown, opts = {}) => privacyHits(x, 20, opts).filter((h) => h.why === DATED_FOLDER_WHY);
  const F = "canadian-rockies-sept-2029";

  it("hits: a raw ref, the part/ and offer/ wrappers, a hyphen-folded id, upper case, URL-encoded, a map key, a JSON export, an own-host URL", () => {
    const hitsOn: [string, unknown][] = [
      ["raw ref", { ref: `legacy/${F}/sights/bow-lake` }],
      ["part/", { ref: `part/legacy/${F}/hikes/x#top` }],
      ["offer/", { ref: `offer/legacy/${F}/lifts/banff-gondola#ticket` }],
      ["hyphen-folded id", { id: `offer-legacy-${F}-lifts-banff-gondola` }],
      ["upper case", { label: "Canadian-Rockies-Sept-2029" }],
      ["two months", { ref: "legacy/patagonia-feb-mar-2027/x" }],
      ["URL-encoded", { href: `/api/v1/resolve?ref=legacy%2F${F}%2Fsights%2Fbow-lake` }],
      ["double-encoded", { href: `/x?u=legacy%252F${F}` }],
      ["encoded name", { href: "/x?u=legacy%2Fcanadian%2Drockies%2Dsept%2D2029" }],
      ["map key", { refSlugs: { [`legacy/${F}/sights/bow-lake`]: "bow-lake" } }],
      ["JSON export", { body: JSON.stringify({ lines: [{ ref: `legacy/${F}/sights/bow-lake` }] }) }],
      ["GPX text", { body: `<gpx><wpt><name>x</name><desc>legacy/${F}/sights/a</desc></wpt></gpx>` }],
      ["own old site", { url: `https://nks-travel.pages.dev/${F}/` }],
      ["own preview subdomain", { url: `https://abc123.nks-travel.pages.dev/${F}/` }],
      ["own v2 host", { url: `https://travel-beta-tan.vercel.app/x/${F}` }],
      ["a configured own host", [{ url: `https://example.org/${F}` }, { ownHosts: ["example.org"] }]],
    ];
    for (const [what, x] of hitsOn) {
      const [body, opts] = what === "a configured own host" ? (x as [unknown, object]) : [x, {}];
      expect(dated(body, opts).length, what).toBe(1);
    }
  });
  it("no hit: a third party's link, a season with a year, a year alone, an ISO month, prose", () => {
    const clean = [
      { url: "https://on-top.ca/Outings/2022/Indefatigable-Bench-July-2022.html" },
      { body: "See https://on-top.ca/Outings/2022/Indefatigable-Bench-July-2022.html for the route." },
      { href: "/out?u=https%3A%2F%2Fon-top.ca%2FOutings%2F2022%2FIndefatigable-Bench-July-2022.html" },
      { slug: "vermont-fall-2026" },
      { slug: "canadian-rockies-2029", ref: "legacy/canadian-rockies-2029/sights/bow-lake" },
      { month: "2029-09" },
      { note: "Best in September 2029" },
      { slug: "norway-summer-2028" },
    ];
    for (const x of clean) expect(dated(x), JSON.stringify(x)).toEqual([]);
  });
  it("S1: ambiguous English months in prose slugs are not trip folders, but a real folder in the same words still is", () => {
    const clean = [
      { note: "you-may-2020 is a slug in a sentence" },
      { note: "after covid-march-2020 the trail reopened" },
      { note: "see open-may-2026 for details" },
      { note: "we-march-2025 and they-may-2024" },
      { url: "www.on-top.ca/Outings/Bench-July-2022.html" },
      { url: "//on-top.ca/Outings/Bench-July-2022.html" },
      { body: "Read www.on-top.ca/Outings/Bench-July-2022.html and //cdn.on-top.ca/a/Bench-July-2022.html" },
    ];
    for (const x of clean) expect(dated(x), JSON.stringify(x)).toEqual([]);
    const hitsOn = [
      { ref: "legacy/rockies-may-2029/sights/a" }, // an id context, even for may
      { id: "offer-legacy-rockies-may-2029-x" },
      { slug: "rockies-may-2029" }, // the whole string
      { url: "https://nks-travel.pages.dev/rockies-march-2029/" },
      { note: "see canadian-rockies-sept-2029 here" }, // any other month word is read in prose too
      { note: "see quebec-july-2026 here" },
      { url: "www.nks-travel.pages.dev/canadian-rockies-sept-2029/" },
      { url: "//nks-travel.pages.dev/canadian-rockies-sept-2029/" },
    ];
    for (const x of hitsOn) expect(dated(x).length, JSON.stringify(x)).toBe(1);
  });
  it("S3: a link to another host that wraps one of our URLs is read (archive snapshot, redirect query)", () => {
    const hitsOn = [
      { url: `https://web.archive.org/web/2026/https://nks-travel.pages.dev/${F}/` },
      { url: `https://x.example/r?u=nks-travel.pages.dev/${F}` },
      { url: `https://x.example/r?u=https%3A%2F%2Ftravel-beta-tan.vercel.app%2F${F}` },
      { url: `https://x.example/r?u=https%253A%252F%252Fnks-travel.pages.dev%252Flegacy%252Frockies-sept-2029` },
    ];
    for (const x of hitsOn) expect(dated(x).length, JSON.stringify(x)).toBe(1);
    expect(dated({ url: "https://web.archive.org/web/2026/https://on-top.ca/Outings/Bench-July-2022.html" })).toEqual([]);
  });
  it("a hit names where, never the value; the key path omits the key", () => {
    const h = privacyHits({ refSlugs: { [`legacy/${F}/a`]: "a" } });
    expect(h).toEqual([{ where: "$.refSlugs[key]", why: DATED_FOLDER_WHY }]);
    expect(JSON.stringify(privacyHits({ ref: `legacy/${F}/a` }))).not.toMatch(/sept/);
  });
  it("an echo of the request's own words is not read (resolve's `asked`: a dated guess answers unknown, never 500)", () => {
    const body = { items: [{ asked: `legacy/${F}/sights/bow-lake`, state: "unknown" }] };
    expect(dated(body)).toHaveLength(1);
    expect(dated(body, { echo: [`legacy/${F}/sights/bow-lake`] })).toEqual([]);
  });
  it("internal records may switch the rule off (the normalise checks); nothing else does", () => {
    expect(dated({ ref: `legacy/${F}/a` }, { datedFolders: false })).toEqual([]);
    expect(OWN_HOSTS).toEqual(["nks-travel.pages.dev", "travel-beta-tan.vercel.app"]);
    expect(DATED_FOLDER.flags).toContain("i");
  });
});

// ACCT-PC (account-profile-and-travellers 10.1, amended 27 Oct 2026): the account's saved travellers never pass a served body.
describe("privacy detector: the account's travellers", () => {
  const whys = (x: unknown) => privacyHits(x).map((h) => h.why);
  it.each([
    ["dob", { kids: [{ dob: "2019-03-15" }] }],
    ["born", { born: "2019-03" }],
    ["birthDate", { birthDate: "2019-03-15" }],
    ["birth_year", { p: { birth_year: 2019 } }],
    ["BirthMonth", { BirthMonth: 3 }],
    ["age_as_of", { age_as_of: "2026-10-27" }],
    ["ageAsOf", { ageAsOf: "2026-10-27" }],
    ["ages", { ages: [7, 9] }],
    ["adult_ages", { adult_ages: [] }],
    ["travellers_consented_at", { travellers_consented_at: "2026-10-27T10:00:00Z" }],
    ["travellersSavedAt", { travellersSavedAt: "2026-10-27T10:00:00Z" }],
  ])("flags the key %s as private", (_k, body) => {
    expect(whys(body)).toEqual(["a private key"]);
  });
  it("flags the document's schema name wherever it sits, and inside a JSON string", () => {
    expect(whys({ schema: "travellers/1" })).toEqual(["a private document (the account's travellers)"]);
    expect(whys({ a: [{ b: " travellers/2 " }] })).toEqual(["a private document (the account's travellers)"]);
    expect(privacyHits({ body: JSON.stringify({ schema: "travellers/1", adults: 2, children: [] }) }).length).toBeGreaterThan(0);
  });
  it("names the path, never the value", () => {
    expect(privacyHits({ kids: [{ dob: "2019-03-15" }] })).toEqual([{ where: "$.kids[0].dob", why: "a private key" }]);
  });
  it("leaves public words alone: a birthplace in prose, a party of plain ages, an age band", () => {
    expect(whys({ text: "The birthplace of the park system", party: { adults: 2, children: [7, 9] }, minAge: 6, ageBand: "6+" })).toEqual([]);
    expect(whys({ title: "Travellers' guide", schema: "trip/1" })).toEqual([]);
  });
});

// Review STEP2-ES ES-012: a clock time before a road name ("19:00 Vermilion Lakes Drive", a published day line in a calendar file) is not
// a street address; a house number still is.
describe("STREET_ADDRESS and clock times (ES-012)", () => {
  it("lets a time before a road through", () => {
    for (const t of ["19:00 Vermilion Lakes Drive", "Day 1\\n07:30 Icefields Parkway Road stop", "DESCRIPTION:12:45 Bow Valley Ave"])
      expect(STREET_ADDRESS.test(t), t).toBe(false);
    expect(privacyHits("SUMMARY:Sunset\r\nDESCRIPTION:19:00 Vermilion Lakes Drive")).toEqual([]);
  });
  it("still fails a house number", () => {
    for (const t of ["12 Vermilion Lakes Drive", "at 1234 Main Street", "Stay: 45 Banff Ave", "(221 Baker St)"]) expect(STREET_ADDRESS.test(t), t).toBe(true);
    expect(privacyHits("meet at 12 Vermilion Lakes Drive")).not.toEqual([]);
  });
});
