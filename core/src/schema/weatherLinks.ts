// weather-links/1: data/reference/weather-links.json, the outbound weather and climate links of each public trip (Q298: links only,
// no weather API call from our pages). Plain zod, not a registered table, like seasons.ts: it is validated by
// core/src/validate/weatherLinks.ts (core and validate only; the web adapter that reads the file comes with UXB-4 and must not import zod
// into the browser start chunk). We store the link, its publisher and the date it was read, never the publisher's values.
import { z } from "zod";

export const WEATHER_LINKS_SCHEMA_ID = "weather-links/1";
/** forecast: a place forecast; climate: averages; mountain and aurora: secondary rows shown under When to go. */
export const WEATHER_LINK_KIND = ["forecast", "climate", "mountain", "aurora"] as const;
export const WEATHER_PUBLISHER_KIND = ["national_met_service", "regional_met_service", "park_agency"] as const;
export const WEATHER_URL_PATTERN = ["coords", "lat_lon", "station_id", "station_name", "place_id", "slug", "slug_postcode", "area_slug", "document_id", "fixed", "site_id", "office_code"] as const;
export const WEATHER_CONTENT = ["title_matches", "place_named", "app_shell", "pdf", "blocked"] as const;

const isoDate = z.iso.date();
const text = z.string().trim().min(1);
const url = z.string().min(1);

export const weatherPublisher = z.strictObject({
  name: text,
  short: text,
  country: z.string().regex(/^[A-Z]{2}$/),
  kind: z.enum(WEATHER_PUBLISHER_KIND),
  /** null and an empty langs list only for a publisher that could not be read (no link uses it) */
  english: z.boolean().nullable(),
  langs: z.array(z.string().regex(/^[a-z]{2,3}$/)),
  home: url.nullable(),
  terms_note: text,
});

const check = z.strictObject({
  read: isoDate,
  http: z.number().int().min(100).max(599).nullable(),
  page_title: z.string().nullable(),
  reachable: z.boolean(),
  method: text,
  content: z.enum(WEATHER_CONTENT),
  content_note: z.string().optional(),
});

export const weatherLink = z.strictObject({
  kind: z.enum(WEATHER_LINK_KIND),
  area: text,
  bases: z.array(text).min(1),
  /** the row label; the page appends the publisher's short name in brackets, and a non-English page names its language here */
  label: text,
  publisher: text,
  url,
  /** whether the linked page itself is in English */
  english: z.boolean(),
  url_pattern: z.enum(WEATHER_URL_PATTERN),
  built_from: text,
  check,
  note: z.string().nullable(),
});

const fallback = z.strictObject({
  url,
  check: z.strictObject({ read: isoDate, http: z.number().int().nullable(), reachable: z.boolean(), content: z.enum(WEATHER_CONTENT).optional() }),
});

export const weatherTrip = z.strictObject({
  trip: text,
  research_folder: z.string().nullable(),
  country: z.string().regex(/^[A-Z]{2}$/),
  region: text,
  links: z.array(weatherLink).min(1),
  fallback,
  gaps: z.array(text),
});

export const weatherLinksFile = z.strictObject({
  schema: z.literal(WEATHER_LINKS_SCHEMA_ID),
  status: text,
  note: text,
  researched: isoDate,
  run: text,
  user_agent: text,
  publishers: z.record(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), weatherPublisher),
  label_rule: text,
  trips: z.array(weatherTrip).min(1),
  privacy: z.strictObject({ rel: z.literal("noopener noreferrer"), target: z.literal("_blank"), sr_only: text, rule: text }),
  selection_rule: text,
});

export type WeatherLinksFile = z.infer<typeof weatherLinksFile>;
