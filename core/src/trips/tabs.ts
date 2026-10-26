// The trip page's tabs as URL and device state (trip-and-places-ux-fixes.md 3.4, D1 to D3; Q293, Q294). Pure and import-free:
// the tab shell reads it in the trip page's start chunk, so it must stay a few hundred bytes and never pull in Zod.
//
// Five tabs: Summary (default), Days, Stops, Bookings, Photos. Table is a view inside Days, not a tab. The page's tab rides the
// existing `view` key (D3), which the profile codec does not own (core/src/schedule/profileCodec.ts PROFILE_KEYS):
//
//   view omitted   Summary          view=day     Days, List        view=table   Days, Table
//   view=all       Stops            view=bookings Bookings        view=photos  Photos
//   view=category  Stops (the By category link before UXB-1; kept as an alias so old links still land on the same list)
//
// Precedence on landing (3.4 "Default and memory"): the URL's `view` first; then the fragment (`#day-N` opens Days, a category
// fragment such as `#trails` opens Stops); then the tab this device remembered for the trip; then Summary. A tab the trip does not
// draw (empty: 3.4 "A tab with no content is not drawn") is never the answer: the next rule applies, and Summary is always drawn.

export const TRIP_TABS = ["summary", "days", "stops", "bookings", "photos"] as const;
export type TripTab = (typeof TRIP_TABS)[number];
export type DaysView = "list" | "table";

export const TAB_LABEL: Readonly<Record<TripTab, string>> = { summary: "Summary", days: "Days", stops: "Stops", bookings: "Bookings", photos: "Photos" };

/** The URL key the tab rides. Not one of the profile codec's keys: `useTripUrl` owns it. */
export const VIEW_KEY = "view";

export interface TabState {
  tab: TripTab;
  /** Only meaningful on Days; `list` everywhere else. */
  daysView: DaysView;
}

export const DEFAULT_TAB_STATE: TabState = { tab: "summary", daysView: "list" };

/** Every `view` value the page reads, to its state. `category` is the pre-tab alias of Stops; `days` and `stops` are forgiving aliases a person may type. */
const VIEWS: Readonly<Record<string, TabState>> = {
  summary: DEFAULT_TAB_STATE,
  day: { tab: "days", daysView: "list" },
  days: { tab: "days", daysView: "list" },
  table: { tab: "days", daysView: "table" },
  all: { tab: "stops", daysView: "list" },
  stops: { tab: "stops", daysView: "list" },
  category: { tab: "stops", daysView: "list" },
  bookings: { tab: "bookings", daysView: "list" },
  photos: { tab: "photos", daysView: "list" },
};

/** The category fragments of the Stops list (the six `CATEGORIES` of core/src/export/publicTypes.ts, copied so this file has no import). */
export const STOP_FRAGMENTS: readonly string[] = ["stays", "trails", "sights", "activities", "food", "logistics"];

/** `view` to a tab state; null when the value is absent or unknown (an unknown value falls back like an absent one, never an error). */
export function parseTripView(value: string | null | undefined): TabState | null {
  if (!value) return null;
  return Object.prototype.hasOwnProperty.call(VIEWS, value) ? VIEWS[value]! : null;
}

/** The `view` value to write for a state, or null to leave the key out (Summary, the default). The canonical spelling: `day`, `table`, `all`, `bookings`, `photos`. */
export function tripViewValue(s: TabState): string | null {
  switch (s.tab) {
    case "summary":
      return null;
    case "days":
      return s.daysView === "table" ? "table" : "day";
    case "stops":
      return "all";
    default:
      return s.tab;
  }
}

/** What the fragment implies: `day-3` opens Days, `trails` opens Stops; anything else implies nothing. */
export function tabOfFragment(hash: string): TripTab | null {
  const h = hash.replace(/^#/, "");
  if (/^day-\d{1,2}$/.test(h)) return "days";
  return STOP_FRAGMENTS.includes(h) ? "stops" : null;
}

export const isTripTab = (x: unknown): x is TripTab => typeof x === "string" && (TRIP_TABS as readonly string[]).includes(x);

/** What the trip has to show in each tab: the server knows it when it renders the page. */
export interface TabContent {
  /** Days with a plan (0 on an overview trip). */
  days: number;
  /** Distinct stops in the Stops list (0 on an overview trip). */
  stops: number;
  /** Rows of the export model's `bookings`. */
  bookings: number;
  /** Photos in the trip gallery. */
  photos: number;
}

/**
 * The tabs the trip draws, in order (W1 "Tabs by trip state"): Summary always; Days and Stops when the plan has days and stops;
 * Bookings when the export has a booking; Photos when the gallery has a photo. A trip left with only the Summary draws no tab bar
 * (`showTabBar`).
 */
export function tripTabsFor(c: TabContent): TripTab[] {
  const out: TripTab[] = ["summary"];
  if (c.days > 0) out.push("days");
  if (c.days > 0 && c.stops > 0) out.push("stops");
  if (c.bookings > 0) out.push("bookings");
  if (c.photos > 0) out.push("photos");
  return out;
}

export const showTabBar = (tabs: readonly TripTab[]): boolean => tabs.length > 1;

export interface ResolveInput {
  /** The URL's `view` value, or null. */
  view: string | null;
  /** `location.hash`, with or without the `#`. */
  hash: string;
  /** The tab this device remembered for the trip (`travel.tripui`), or null when none or storage is blocked. */
  remembered: TripTab | null;
  /** The remembered Days view, used when the remembered tab is Days. */
  rememberedDaysView?: DaysView | null;
  /** `tripTabsFor` of the trip. */
  available: readonly TripTab[];
}

export interface Resolved extends TabState {
  /** Which rule decided: the URL, the fragment, this device, or the default. */
  from: "url" | "hash" | "device" | "default";
}

/** The tab to open on landing and on Back/Forward (3.4): URL, then fragment, then the remembered tab, then Summary. */
export function resolveTripTab(i: ResolveInput): Resolved {
  const ok = (t: TripTab): boolean => i.available.includes(t);
  const fromUrl = parseTripView(i.view);
  if (fromUrl && ok(fromUrl.tab)) return { ...fromUrl, from: "url" };
  const fromHash = tabOfFragment(i.hash);
  if (fromHash && ok(fromHash)) return { tab: fromHash, daysView: "list", from: "hash" };
  if (i.remembered && ok(i.remembered)) return { tab: i.remembered, daysView: i.remembered === "days" ? (i.rememberedDaysView ?? "list") : "list", from: "device" };
  return { ...DEFAULT_TAB_STATE, from: "default" };
}

/**
 * Replaces or removes `view` in a query string and keeps every other key in place (the profile keys, a campaign tag). Returns the
 * query without the leading `?`. Mine's Open link adds `view=day` with it (3.4: a copy is opened to read its days).
 */
export function withTripView(query: string, s: TabState): string {
  // by hand, not URLSearchParams.toString(): that would re-encode the codec's commas (`d=5C,9A` -> `d=5C%2C9A`) and change every link
  const parts = query.replace(/^\?/, "").split("&").filter((p) => p !== "" && p.split("=")[0] !== VIEW_KEY);
  const v = tripViewValue(s);
  if (v !== null) parts.push(`${VIEW_KEY}=${v}`);
  return parts.join("&");
}
