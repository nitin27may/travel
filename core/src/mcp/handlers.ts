// Handlers for the read operations that are Phase 1 MCP tools (plan 5.7). Each takes the parsed input and the repository
// root and returns the operation's output; a thrown ToolError becomes an MCP tool error the caller can read.
import { join } from "node:path";
import { editionResolver, stubBookBy } from "../checks/index.ts";
import { CATALOGUE, OPS_BY_NAME, opSchemaToJson } from "../ops/catalogue.ts";
import { buildSchemaJson } from "../schema/export.ts";
import { REGISTRY } from "../schema/index.ts";
import { validateDoc } from "../validate/index.ts";
import { loadCatalogRows, loadLocations, loadRows, loadTrip, readJson, tripSlugs } from "./data.ts";
import type { Row } from "./data.ts";
import { queryRows } from "./query.ts";
import type { Filter, Sort } from "./query.ts";

export class ToolError extends Error {}

export interface HandlerCtx {
  root: string;
  /** ISO date for bookings.due; defaults to today */
  today?: string;
}

type Handler = (input: any, ctx: HandlerCtx) => unknown;


function opSummary(o: (typeof CATALOGUE)[number]) {
  return { name: o.name, summary: o.summary, kind: o.kind, phase: o.phase, ...(o.mcp ? { mcp: o.mcp } : {}) };
}

function countRows(root: string, family: string, table: string): number {
  return loadRows(root, family, table).length;
}

function fieldNames(): string[] {
  return REGISTRY.map((t) => t.key);
}

export const HANDLERS: Record<string, Handler> = {
  "schema.list_types": (_i, { root }) => ({
    types: REGISTRY.map((t) => ({ id: t.key, family: t.family, table: t.name, rows: t.family === "sidecar" ? 0 : countRows(root, t.family, t.name) })),
  }),

  "schema.get": ({ type }, { root }) => {
    const file = readJson(join(root, "data", "schema", "generated", "schema.json")) ?? buildSchemaJson();
    const def = file.$defs?.[type];
    if (!def) throw new ToolError(`no entity type "${type}". The types are: ${fieldNames().join(", ")}.`);
    return { schema: def };
  },

  "ops.list": () => ({ operations: CATALOGUE.map(opSummary) }),

  "ops.describe": ({ name }) => {
    const o = OPS_BY_NAME.get(name);
    if (!o) throw new ToolError(`no operation "${name}". Use list_operations for the names.`);
    return { operation: { ...opSummary(o), tables: o.tables, input: opSchemaToJson(o.input, "input"), output: opSchemaToJson(o.output, "output") } };
  },

  "rows.query": ({ type, filter, sort, fields, limit, cursor }, { root }) => {
    const [family, table] = String(type).split(".");
    if (!family || !table || !fieldNames().includes(`${family}.${table}`)) {
      throw new ToolError(`no entity type "${type}". The types are: ${fieldNames().join(", ")}.`);
    }
    try {
      return queryRows(loadRows(root, family, table), { filter: filter as Filter | undefined, sort: sort as Sort[] | undefined, fields, limit, cursor });
    } catch (e) {
      throw new ToolError((e as Error).message);
    }
  },

  "trip.get": ({ slug, resolve }, { root }) => {
    if (resolve) throw new ToolError("resolve arrives with P4a: real dates, ages, book-by dates and sun times need the date, sun and book-by modules. Call get_trip with resolve false.");
    const trip = loadTrip(root, slug);
    if (!trip) throw new ToolError(`no trip "${slug}". Trips are the folders under data/trips/ (${tripSlugs(root).join(", ") || "none yet"}).`);
    return { trip };
  },

  "trip.validate": ({ slug, candidate }, { root }) => {
    if ((slug === undefined) === (candidate === undefined)) throw new ToolError("give exactly one of slug (a stored trip) or candidate (a whole trip document).");
    let doc: unknown = candidate;
    if (slug !== undefined) {
      doc = loadTrip(root, slug);
      if (!doc) throw new ToolError(`no trip "${slug}". Trips are the folders under data/trips/ (${tripSlugs(root).join(", ") || "none yet"}).`);
    }
    const r = validateDoc(doc, "trip", root, { folder: slug });
    return { ok: r.errors.length === 0, errors: r.errors, warnings: r.warnings };
  },

  "place.get": ({ id }, { root }) => {
    const loc = loadLocations(root);
    const place = (loc.places ?? []).find((p: Row) => p.id === id);
    if (!place) throw new ToolError(`no place "${id}". Example id: "CA/AB/banff-national-park/lake-louise". Use search to find one.`);
    const area = (loc.areas ?? []).find((a: Row) => a.id === place.area_id) ?? null;
    const region = area ? (loc.regions ?? []).find((r: Row) => r.id === area.region_id) ?? null : null;
    const country = region ? (loc.countries ?? []).find((c: Row) => c.code === region.country) ?? null : null;
    const trips = tripSlugs(root).filter((slug) => {
      const t = loadTrip(root, slug);
      return (t?.items ?? []).some((i: Row) => i.place_id === id) || (t?.bases ?? []).some((b: Row) => b.place_id === id);
    });
    return {
      place, area, region, country,
      tags: (loc.place_tags ?? []).filter((r: Row) => r.place_id === id).map((r: Row) => r.tag_id),
      sources: (loc.sources ?? []).filter((r: Row) => r.place_id === id),
      visits: (loc.visits ?? []).filter((r: Row) => r.place_id === id),
      used_by_trips: trips,
    };
  },

  "trail.get": ({ id, geometry }, { root }) => {
    const trail = loadCatalogRows(root, "trails").find((t) => t.id === id);
    if (!trail) throw new ToolError(`no trail "${id}". Example id: "AR/santa-cruz/el-chalten/laguna-de-los-tres". Use search to find one.`);
    const out: Row = { trail, used_by_trips: tripSlugs(root).filter((s) => (loadTrip(root, s)?.trip_trails ?? []).some((r: Row) => r.trail_id === id)) };
    if (geometry) out.geometry = trail.geometry_file ? readJson(join(root, "data", "catalog", "trails", trail.geometry_file)) : null;
    return out;
  },

  search: ({ q, types }, { root }) => {
    const needle = String(q).toLowerCase();
    const hit = (...vals: unknown[]) => vals.some((v) => typeof v === "string" && v.toLowerCase().includes(needle));
    const loc = loadLocations(root);
    const groups: { type: string; hits: Row[] }[] = [];
    const add = (type: string, hits: Row[]) => {
      if (hits.length > 0 && (!types || types.includes(type))) groups.push({ type, hits: hits.slice(0, 25) });
    };
    add("place", (loc.places ?? []).filter((p: Row) => hit(p.name, p.resolved_name, p.id)).map((p: Row) => ({ id: p.id, name: p.name, kind: p.kind, status: p.status })));
    add("area", (loc.areas ?? []).filter((a: Row) => hit(a.name, a.id)).map((a: Row) => ({ id: a.id, name: a.name })));
    for (const [type, table] of [["trail", "trails"], ["activity", "activities"], ["stay", "stays"], ["eatery", "eateries"]] as const) {
      add(type, loadCatalogRows(root, table).filter((r) => hit(r.name, r.id)).map((r) => ({ id: r.id, name: r.name })));
    }
    add("trip", tripSlugs(root).map((s) => loadTrip(root, s)).filter((t): t is Row => !!t && hit(t.trip?.title, t.trip?.slug, t.trip?.region_label)).map((t) => ({ id: t.id, name: t.trip.title })));
    return { groups };
  },

  "bookings.due": ({ within_days, trip }, { root, today }) => {
    const now = today ?? process.env.TRAVEL_TODAY ?? new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.parse(now) + within_days * 86400000).toISOString().slice(0, 10);
    const out: Row[] = [];
    for (const slug of trip ? [trip] : tripSlugs(root)) {
      const t = loadTrip(root, slug);
      if (!t) continue;
      const day1 = editionResolver(t)(1);
      for (const b of t.trip_bookings ?? []) {
        if (["booked", "paid", "cancelled", "not-needed", "sold-out"].includes(b.status)) continue;
        const off = stubBookBy(b);
        const date = b.deadline_date ?? (day1 && off !== null ? new Date(Date.parse(day1) + off * 86400000).toISOString().slice(0, 10) : null);
        if (date && date > horizon) continue;
        out.push({ trip: slug, id: b.id, item: b.item ?? b.offer_id, status: b.status, priority: b.priority, book_by: date, overdue: date !== null && date < now });
      }
    }
    out.sort((a, b) => String(a.book_by ?? "9999").localeCompare(String(b.book_by ?? "9999")));
    return { bookings: out };
  },

  "catalog.coverage": ({ area_id }, { root }) => {
    const doc = readJson(join(root, "data", "catalog", "coverage.json"));
    const list: Row[] = Array.isArray(doc) ? (doc as unknown as Row[]) : Array.isArray(doc?.coverage) ? doc!.coverage : Array.isArray(doc?.areas) ? doc!.areas : [];
    return { coverage: area_id ? list.filter((r) => r.area_id === area_id) : list };
  },

  "backlog.list": ({ area_id, reason, status }, { root }) => ({
    backlog: loadCatalogRows(root, "backlog").filter((r) => (!area_id || r.area_id === area_id) && (!reason || r.reason === reason) && (!status || r.status === status)),
  }),

  // Phase 1 tools whose logic belongs to a later phase: they are registered so the tool list matches the catalogue
  "route.suggest_breaks": () => {
    throw new ToolError("suggest_breaks arrives with P8 (routing with breaks).");
  },
  "search.along_route": () => {
    throw new ToolError("search_along_route arrives with P8 (routing with breaks); it needs stored route geometry.");
  },
};

