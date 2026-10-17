import { z } from "zod";
import * as E from "../enums.ts";
import { currency, date, enumOf, int, json, monthList, pattern, real, strList, table, text, url } from "../meta.ts";
import { CATALOG_INDEXES, LATLON_CHECK, common } from "./common.ts";

export const offers = table("offers", {
  ...common(),
  subject_entity: enumOf(E.SUBJECT_ENTITY),
  subject_id: text({ min: 1 }),
  category: enumOf(E.OFFER_CATEGORY, { ui: { label: "Category", facet: true } }),
  provider: text({ min: 1 }),
  book_url: url({ null: true }),
  reseller_urls: strList(),
  other_limits: text({ null: true }),
  limits_status: enumOf(E.LIMITS_STATUS),
  opens_kind: enumOf(E.OPENS_KIND),
  opens_lead_days: int({ null: true, min: 0 }),
  opens_rule: text({ null: true }),
  opens_evidence: text({ null: true }),
  sellout_kind: enumOf(E.SELLOUT_KIND),
  sellout_lead_days: int({ null: true, min: 0 }),
  sellout_peak: text({ null: true }),
  same_day: enumOf(E.SAME_DAY),
  cancellation: text({ null: true }),
  weather_refund: text({ null: true }),
  price_variance: text({ null: true }),
  notes: text(),
}, {
  family: "catalog", pk: ["id"], ui: { label: "Offers" },
  sql: { indexes: CATALOG_INDEXES, checks: [LATLON_CHECK] },
  rules: [{ code: "E_OFFER_WINDOW", kind: "custom", describe: "opens_kind rolling-lead needs opens_lead_days" }],
});

export const offer_prices = table("offer_prices", {
  id: pattern(/^.+#\d+$/),
  offer_id: text({ min: 1, fk: "offers.id" }),
  amount: real({ min: 0 }),
  currency: currency(),
  per: enumOf(E.PRICE_PER),
  age_from: int({ null: true, min: 0 }),
  age_to: int({ null: true, min: 0 }),
  valid_months: monthList(),
  basis_year: int({ null: true }),
  read: date(),
  source_id: text({ min: 1 }),
  window: json(z.record(z.string(), z.unknown()), { null: true }),
}, { family: "catalog", pk: ["id"], ui: { label: "Offer prices" }, sql: { indexes: [["offer_id"]] } });
