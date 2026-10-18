// The fame-signals tool (relevance.md 2.3, 5 rule 6, 9.1 step 3). The only network code of relevance.
//
// - It reads by confirmed QID only. It never searches by name (the Moraine Lake / Lake Louise / Smugglers' Notch gotchas).
// - Every request is sequential, spaced, retried on 429 and 5xx with Retry-After honoured, and cached with a read date.
// - It identifies itself with a project name and the repo URL, and nothing else: no email, no person's name.
// - `derive` and `check` never import this file.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// The repo is private, so the contact URL is the public site. Project name and URL only: no email, no personal name.
export const USER_AGENT = "travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)";

export type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; headers: { get(name: string): string | null }; json(): Promise<unknown> }>;

export interface SignalsOptions {
  root: string;
  fetchImpl?: FetchLike;
  /** a cached entry younger than this is reused */
  maxAgeDays?: number;
  refresh?: boolean;
  today?: string;
  /** milliseconds between two requests to one host; tests pass 0 */
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
}

/** Wikipedia-like wikis in a sitelinks object. commons, species, meta, wikidata and the like are not language editions. */
const NOT_LANG = new Set(["commonswiki", "specieswiki", "metawiki", "wikidatawiki", "mediawikiwiki", "sourceswiki", "foundationwiki", "incubatorwiki", "outreachwiki", "strategywiki", "wikimaniawiki", "nostalgiawiki"]);
const isWikipedia = (site: string): boolean => /^[a-z_]+wiki$/.test(site) && !NOT_LANG.has(site);
const langOfSite = (site: string): string => site.replace(/wiki$/, "").replace(/_/g, "-");

export interface WikidataItem {
  read: string;
  label: string | null;
  sitelinks: { count: number; langs: string[] };
  /** titles only for the languages whose pageviews we read */
  titles: Record<string, string>;
  /** the extra languages asked for when this was read; a change in langs.json triggers a re-read */
  langs: string[];
  p1435: string[]; // heritage designation item ids
  p757: string[]; // World Heritage Site id
  p814: string[]; // IUCN protected area category item ids
  /** P625 coordinate location (Wikidata, CC0); null when the item has none. Absent in readings made before RVC, which triggers one re-read */
  p625?: { lat: number; lon: number } | null;
}
export interface PageviewsItem {
  read: string;
  window: { from: string; to: string }; // YYYYMM
  views: Record<string, { title: string; total: number | null }>; // by project, e.g. en.wikipedia
  max: number;
}
export interface OsmItem {
  read: string;
  class_key: string;
  tag: string;
  radius_km: number;
  count: number;
}
interface Cache<T> {
  schema: string;
  source: string;
  credit?: string;
  items: Record<string, T>;
}

const FILES = { wikidata: "wikidata.json", pageviews: "pageviews.json", osm: "osm-similar.json" } as const;
const SOURCES = {
  wikidata: { schema: "relevance-signals-wikidata/1", source: "Wikidata (CC0), wbgetentities by confirmed QID" },
  pageviews: { schema: "relevance-signals-pageviews/1", source: "Wikimedia REST pageviews, per article, user agents, 12 full months" },
  osm: { schema: "relevance-signals-osm/1", source: "OpenStreetMap via Overpass, count within 25 km", credit: "Contains data (c) OpenStreetMap contributors, ODbL 1.0" },
} as const;

function load<T>(path: string, kind: keyof typeof SOURCES): Cache<T> {
  if (existsSync(path)) {
    try {
      const j = JSON.parse(readFileSync(path, "utf8")) as Cache<T>;
      if (j && typeof j === "object" && j.items) return j;
    } catch {
      /* rebuild */
    }
  }
  return { ...SOURCES[kind], items: {} };
}
function save<T>(path: string, c: Cache<T>): void {
  mkdirSync(dirname(path), { recursive: true });
  const items = Object.fromEntries(Object.keys(c.items).sort().map((k) => [k, c.items[k]!]));
  writeFileSync(path, JSON.stringify({ ...c, items }, null, 2) + "\n");
}

const ageDays = (a: string, b: string): number => Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);

export class SignalsClient {
  readonly requests: string[] = [];
  private lastAt = new Map<string, number>();
  private readonly o: Required<Pick<SignalsOptions, "root" | "maxAgeDays" | "refresh" | "delayMs">> & SignalsOptions;
  readonly today: string;

  constructor(o: SignalsOptions) {
    this.o = { maxAgeDays: 365, refresh: false, delayMs: 250, ...o };
    this.today = o.today ?? new Date().toISOString().slice(0, 10);
  }

  private path(kind: keyof typeof FILES): string {
    return join(this.o.root, "data", "relevance", "signals", FILES[kind]);
  }
  private fresh(read: string | undefined): boolean {
    return !this.o.refresh && !!read && ageDays(read, this.today) <= this.o.maxAgeDays;
  }
  private log(s: string): void {
    this.o.log?.(s);
  }

  /** One GET, sequential, spaced per host, retried up to 3 times on 429 and 5xx. Returns null on 404. */
  async get(url: string): Promise<unknown | null> {
    const f = this.o.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    const sleep = this.o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const host = new URL(url).host;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const wait = (this.lastAt.get(host) ?? 0) + this.o.delayMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastAt.set(host, Date.now());
      this.requests.push(url);
      const res = await f(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        const ra = Number(res.headers.get("retry-after"));
        const ms = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2000 * attempt;
        this.log(`HTTP ${res.status} from ${host}; retrying in ${ms} ms`);
        await sleep(ms);
        continue;
      }
      throw new Error(`HTTP ${res.status} from ${url}`);
    }
    throw new Error(`gave up on ${url}`);
  }

  // ---- Wikidata ----

  async wikidata(qids: string[], langs: Record<string, string[]> = {}): Promise<Record<string, WikidataItem>> {
    const path = this.path("wikidata");
    const cache = load<WikidataItem>(path, "wikidata");
    const wantKey = (q: string): string => [...new Set(langs[q] ?? [])].sort().join(",");
    const need = [...new Set(qids)].filter((q) => /^Q[1-9]\d*$/.test(q) && (!this.fresh(cache.items[q]?.read) || cache.items[q]!.p625 === undefined || (cache.items[q]!.langs ?? []).slice().sort().join(",") !== wantKey(q)));
    for (let i = 0; i < need.length; i += 20) {
      const batch = need.slice(i, i + 20);
      const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks%7Cclaims%7Clabels&languages=en&ids=${batch.join("%7C")}`;
      const j = (await this.get(url)) as { entities?: Record<string, any> } | null;
      for (const q of batch) {
        const e = j?.entities?.[q];
        if (!e || e.missing !== undefined) {
          this.log(`${q}: not found on Wikidata`);
          continue;
        }
        const sl: Record<string, { title: string }> = e.sitelinks ?? {};
        const wikis = Object.keys(sl).filter(isWikipedia);
        const want = new Set(["en", ...(langs[q] ?? [])]);
        const titles: Record<string, string> = {};
        for (const w of wikis) if (want.has(langOfSite(w))) titles[langOfSite(w)] = sl[w]!.title;
        const ids = (prop: string): string[] =>
          (e.claims?.[prop] ?? []).map((c: any) => c?.mainsnak?.datavalue?.value).map((v: any) => (typeof v === "string" ? v : v?.id)).filter((x: unknown): x is string => typeof x === "string");
        cache.items[q] = {
          read: this.today,
          label: e.labels?.en?.value ?? null,
          sitelinks: { count: wikis.length, langs: wikis.map(langOfSite).sort() },
          titles,
          langs: [...new Set(langs[q] ?? [])].sort(),
          p1435: ids("P1435"),
          p757: ids("P757"),
          p814: ids("P814"),
          p625: ((): { lat: number; lon: number } | null => {
            const v = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
            return v && typeof v.latitude === "number" && typeof v.longitude === "number" ? { lat: Math.round(v.latitude * 1e5) / 1e5, lon: Math.round(v.longitude * 1e5) / 1e5 } : null;
          })(),
        };
      }
      save(path, cache);
    }
    return Object.fromEntries(qids.filter((q) => cache.items[q]).map((q) => [q, cache.items[q]!]));
  }

  // ---- Wikimedia pageviews ----

  /** The 12 full months before `today`, as YYYYMM01 bounds. */
  window(): { from: string; to: string } {
    const [y, m] = this.today.split("-").map(Number) as [number, number];
    const end = new Date(Date.UTC(y, m - 2, 1)); // last full month
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
    const f = (d: Date): string => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { from: f(start), to: f(end) };
  }

  async pageviews(items: Record<string, WikidataItem>): Promise<Record<string, PageviewsItem>> {
    const path = this.path("pageviews");
    const cache = load<PageviewsItem>(path, "pageviews");
    const win = this.window();
    for (const [q, wd] of Object.entries(items)) {
      const have = Object.keys(cache.items[q]?.views ?? {}).sort().join(",");
      const want = Object.keys(wd.titles).map((l) => `${l}.wikipedia`).sort().join(",");
      if (this.fresh(cache.items[q]?.read) && cache.items[q]!.window.to === win.to && have === want) continue;
      const views: PageviewsItem["views"] = {};
      for (const [lang, title] of Object.entries(wd.titles)) {
        const project = `${lang}.wikipedia`;
        const article = encodeURIComponent(title.replace(/ /g, "_"));
        const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${project}/all-access/user/${article}/monthly/${win.from}0100/${win.to}0100`;
        const j = (await this.get(url)) as { items?: { views: number }[] } | null;
        views[project] = { title, total: j?.items ? j.items.reduce((s, x) => s + x.views, 0) : null };
      }
      // the maximum across editions: the Dolomites read mostly in German (2.3 language bias)
      const max = Math.max(0, ...Object.values(views).map((v) => v.total ?? 0));
      cache.items[q] = { read: this.today, window: win, views, max };
      save(path, cache);
    }
    return cache.items;
  }

  // ---- Overpass ----

  async osm(places: { ref: string; class_key: string; lat: number; lon: number }[]): Promise<Record<string, OsmItem>> {
    const path = this.path("osm");
    const cache = load<OsmItem>(path, "osm");
    for (const p of places) {
      const tag = osmTag(p.class_key);
      if (!tag) continue;
      if (this.fresh(cache.items[p.ref]?.read) && cache.items[p.ref]!.class_key === p.class_key) continue;
      const q = `[out:json][timeout:60];nwr${tag}(around:25000,${p.lat},${p.lon});out count;`;
      const j = (await this.get(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`)) as { elements?: { tags?: { total?: string } }[] } | null;
      const total = Number(j?.elements?.[0]?.tags?.total ?? 0);
      cache.items[p.ref] = { read: this.today, class_key: p.class_key, tag, radius_km: 25, count: total };
      save(path, cache);
    }
    return cache.items;
  }
}

/** Overpass filters for the classes with a clean tag mapping (3.2); null for the rest. A lake's 1 ha floor is not applied. */
export function osmTag(classKey: string): string | null {
  const head = classKey.split("/")[0];
  switch (head) {
    case "waterfall": return '["waterway"="waterfall"]';
    case "viewpoint": return '["tourism"="viewpoint"]';
    case "peak": return '["natural"="peak"]';
    case "lake": return '["natural"="water"]["water"="lake"]';
    case "cave": return '["natural"="cave_entrance"]';
    default: return null;
  }
}
