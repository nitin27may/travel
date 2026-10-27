// Public ref aliases (public-ref-aliases.md 4, owner ruling of 27 Oct 2026 on review M2): no public id holds a calendar month next to a
// year. Eight legacy trip folders carry a month (`canadian-rockies-sept-2029`); capture refs embed them (`legacy/<folder>/...`). The
// stored refs never change (entity-graph 4.4 rule 1; CLAUDE.md "never rewrite capture refs"). Instead every public boundary (the
// `publicStore` wrapper, core/src/catalogue/public-store.ts, and the web page adapter) rewrites them with `publicRef`, through the
// folder table pinned in data/catalogue/slugs.json `trips.folderAliases` (written only by `node core/bin/slugs.ts`).
//
// Pure functions over a table; no file system. The table is server-side only: `privateRef` (the inverse) and the table never reach a
// client chunk (5.3). A month alone, a season with a year (`vermont-fall-2026`) or a year alone (`canadian-rockies-2029`) is public
// (QR1): only a month or a pair of months next to a year is private.

/** The month words of the grammar (4.1): short and long English forms, `sept` included. */
export const MONTH_WORDS = [
  "jan", "january", "feb", "february", "mar", "march", "apr", "april", "may", "jun", "june", "jul", "july", "aug", "august",
  "sep", "sept", "september", "oct", "october", "nov", "november", "dec", "december",
] as const;

/** One month as a regex alternation (6.1), longest forms reachable through optional tails. */
export const MONTH_ALT = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

/**
 * A dated folder anywhere in a string (6.1): a hyphenated token with a month (or two) and then a year as its last words. Case-insensitive.
 * `canadian-rockies-sept-2029`, `patagonia-feb-mar-2027`, `offer-legacy-canadian-rockies-sept-2029-x` all match; `vermont-fall-2026`,
 * `canadian-rockies-2029` and `2029-09` do not. The privacy detector (core/src/privacy/detect.ts) reads this same pattern.
 */
export const DATED_FOLDER_RE = new RegExp(`(?<![a-z0-9])[a-z0-9]+(?:-[a-z0-9]+)*-(?:${MONTH_ALT})(?:-(?:${MONTH_ALT}))?-(?:19|20)\\d\\d(?![0-9])`, "i");

/** The month token or tokens before the closing year of a folder name: what `aliasOfFolder` removes. */
const MONTH_TAIL_RE = new RegExp(`-(?:${MONTH_ALT})(?:-(?:${MONTH_ALT}))?(?=-(?:19|20)\\d\\d$)`);

/** True when a string holds a dated folder token anywhere (6.1). */
export const isDated = (s: string): boolean => DATED_FOLDER_RE.test(s);

/** A whole folder name that is dated: lower-case words, the last two (or three) a month or months and a year. */
export const DATED_FOLDER_NAME_RE = new RegExp(`^[a-z0-9]+(?:-[a-z0-9]+)*-(?:${MONTH_ALT})(?:-(?:${MONTH_ALT}))?-(?:19|20)\\d\\d$`);

/**
 * The alias rule (4.1), used once per folder when `slugs.ts build` pins it: the folder with its month token or tokens removed. A folder
 * with no month before its year is its own alias. After the first write the PINNED value counts (4.2), never this function again; if
 * the rule ever changes, keep this version for the entries already pinned (the registry check compares an entry against it).
 */
export function aliasOfFolder(folder: string): string {
  return folder.replace(MONTH_TAIL_RE, "");
}

// ---- a JSON-Schema-safe refusal (no flags in a JSON Schema `pattern`, so case is spelled out per letter) ------------------------------

const ci = (src: string): string => src.replace(/[a-z]/g, (c) => `[${c}${c.toUpperCase()}]`);

/**
 * The source of a pattern that matches a string holding NO dated folder: `^(?![\s\S]*<dated>)`. Case-insensitive by construction (each
 * letter is a class), so it survives `z.toJSONSchema()` (OpenAPI) where a flag would not. One letter or digit before the month is enough
 * to anchor a token; the lookbehind of DATED_FOLDER_RE is not needed for a refusal.
 */
export const NO_DATED_FOLDER_SOURCE = `^(?![\\s\\S]*[a-zA-Z0-9]-(?:${ci(MONTH_ALT)})(?:-(?:${ci(MONTH_ALT)}))?-(?:19|20)[0-9]{2}(?![0-9]))`;
export const NO_DATED_FOLDER_RE = new RegExp(NO_DATED_FOLDER_SOURCE);

// ---- the table and the two directions ---------------------------------------------------------------------------------------------

/** Dated legacy folder -> its pinned alias (`trips.folderAliases` of the slug registry). */
export type FolderAliases = Readonly<Record<string, string>>;

interface Compiled {
  /** every pinned folder, longest first, token-bounded; global, case-insensitive on the name */
  forward: RegExp | null;
  /** `legacy/<alias>` at the start or after a `/`, before `/`, `#` or the end */
  inverse: RegExp | null;
  /** lower-case folder -> alias */
  toAlias: Map<string, string>;
  /** alias -> folder */
  toFolder: Map<string, string>;
}

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cache = new WeakMap<object, Compiled>();

/**
 * A token boundary before a name: the start, any character outside [A-Za-z0-9], or a URL-encoded separator (`%2F`, `%3A`, `%23`), so a
 * ref inside an encoded href (`?ref=legacy%2Fcanadian-rockies-sept-2029%2F...`) is found too.
 */
const BEFORE = "(?<=^|[^A-Za-z0-9]|%2[Ff]|%3[Aa]|%23)";
const AFTER = "(?![A-Za-z0-9])";

function compile(table: FolderAliases): Compiled {
  const hit = cache.get(table);
  if (hit) return hit;
  const folders = Object.keys(table).sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  const aliases = [...new Set(Object.values(table))].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  const c: Compiled = {
    forward: folders.length ? new RegExp(`${BEFORE}(?:${folders.map((f) => ci(esc(f))).join("|")})${AFTER}`, "g") : null,
    inverse: aliases.length ? new RegExp(`(^|/)legacy/(${aliases.map(esc).join("|")})(?=/|#|$)`, "g") : null,
    toAlias: new Map(Object.entries(table).map(([f, a]) => [f.toLowerCase(), a])),
    toFolder: new Map(Object.entries(table).map(([f, a]) => [a, f])),
  };
  cache.set(table, c);
  return c;
}

/**
 * The public form of a string (4.1): every whole-token occurrence of a pinned dated folder name, in any case, replaced by its alias.
 * Inside `legacy/<F>/...`, `part/legacy/<F>/...#top`, `offer/legacy/<F>/...#ticket`, `trip/<F>`, a hyphen-folded element id
 * `offer-legacy-<F>-...` and an encoded href alike. A string with no pinned folder comes back unchanged (the same string). Idempotent.
 */
export function publicRef(s: string, table: FolderAliases): string {
  const c = compile(table);
  if (!c.forward) return s;
  c.forward.lastIndex = 0;
  if (c.forward.test(s)) {
    c.forward.lastIndex = 0;
    return s.replace(c.forward, (m) => c.toAlias.get(m.toLowerCase()) ?? m);
  }
  if (!s.includes("%")) return s;
  // S2: the detector reads the text URL-decoded (up to twice: `%252F`, `%2D`), so the rewrite must too, or such an input fails closed
  // instead of being aliased. The decoded text is rewritten; only the characters that would change a URL's shape are escaped again.
  const d = decodeTwice(s);
  if (d === s) return s;
  c.forward.lastIndex = 0;
  if (!c.forward.test(d)) return s;
  c.forward.lastIndex = 0;
  return d.replace(c.forward, (m) => c.toAlias.get(m.toLowerCase()) ?? m).replace(/[%&#?+ ]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
}

/** Percent-escapes decoded up to twice, leniently (the detector's `hasDatedFolder` does the same, so the two cannot disagree). */
function decodeTwice(s: string): string {
  let t = s;
  for (let i = 0; i < 2 && t.includes("%"); i++) {
    let d: string;
    try {
      d = decodeURIComponent(t);
    } catch {
      d = t.replace(/%[0-7][0-9A-Fa-f]/g, (e) => String.fromCharCode(parseInt(e.slice(1), 16)));
    }
    if (d === t) break;
    t = d;
  }
  return t;
}

/**
 * The internal ref behind a public one (5.3), SERVER-SIDE ONLY: `legacy/<alias>` (after the start or a `/`, so inside a `part/` or
 * `offer/` wrapper too) becomes `legacy/<F>`. `trip/<alias>` is never inverted: `trip/canadian-rockies-2029/...` is a real data-trip ref.
 */
export function privateRef(s: string, table: FolderAliases): string {
  const c = compile(table);
  if (!c.inverse || !s.includes("legacy/")) return s;
  c.inverse.lastIndex = 0;
  return s.replace(c.inverse, (_m, pre: string, alias: string) => `${pre}legacy/${c.toFolder.get(alias) ?? alias}`);
}

/**
 * A ref a visitor sent (5.3), SERVER-SIDE ONLY: null ("unknown") when it holds a dated folder, so a dated guess answers exactly like any
 * unknown string and the resolver is no oracle for the month (G6, QR4); otherwise the internal ref to look up.
 */
export function fromPublicInput(s: string, table: FolderAliases): string | null {
  if (isDated(s)) return null;
  return privateRef(s, table);
}

/**
 * A JSON value with every string value AND every object key through `publicRef` (5.1), so `refSlugs[ref]` stays consistent with the
 * refs it is looked up by. Copy-on-write: a branch with nothing to rewrite is returned as the same object. Only plain arrays and objects
 * are walked; any other value is returned as it is.
 */
export function aliasDeep<T>(value: T, table: FolderAliases): T {
  const c = compile(table);
  if (!c.forward) return value;
  return walk(value, table) as T;
}

function walk(x: unknown, table: FolderAliases): unknown {
  if (typeof x === "string") return publicRef(x, table);
  if (Array.isArray(x)) {
    let out: unknown[] | null = null;
    for (let i = 0; i < x.length; i++) {
      const y = walk(x[i], table);
      if (y !== x[i] && !out) out = x.slice(0, i);
      if (out) out.push(y);
    }
    return out ?? x;
  }
  if (x && typeof x === "object" && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null)) {
    const entries = Object.entries(x as Record<string, unknown>);
    let changed = false;
    const next: [string, unknown][] = entries.map(([k, v]) => {
      const k2 = publicRef(k, table);
      const v2 = walk(v, table);
      if (k2 !== k || v2 !== v) changed = true;
      return [k2, v2];
    });
    return changed ? Object.fromEntries(next) : x;
  }
  return x;
}
