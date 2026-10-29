// OpenAPI 3.1 from the contract (EXECUTION-PLAN 4.4, API brief step 18): paths and methods from CATALOGUE_CONTRACT, the flat URL
// parameters from each method's `query` schema (what a URL carries, review R-5), the response bodies from the `output` schemas with
// z.toJSONSchema. Generated into data/schema/generated/openapi.json by core/bin/openapi.ts; never edited by hand.
import { z } from "zod";
import * as S from "../schema/api/index.ts";
import { CATALOGUE_CONTRACT, type CatalogueMethod } from "./store.ts";

/** Repository-relative path of the generated document. */
export const OPENAPI_PATH = "data/schema/generated/openapi.json";

type Json = Record<string, unknown>;

const STATUS_TEXT: Record<number, string> = { 400: "invalid_input or invalid_scope", 404: "not_found", 413: "too_large", 501: "not_available", 500: "internal" };

/** A schema as JSON Schema 2020-12 with its definitions moved to components, so `#/components/schemas/...` resolves in the document. */
function schemaOf(name: string, schema: z.ZodType, components: Record<string, Json>): Json {
  const js = z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "any", io: "output", reused: "inline" }) as Json;
  const defs = (js.$defs ?? {}) as Record<string, Json>;
  delete js.$defs;
  delete js.$schema;
  const text = JSON.stringify({ js, defs }).replace(/"#\/\$defs\/([^"]+)"/g, (_m, id) => `"#/components/schemas/${name}_${id}"`);
  const out = JSON.parse(text) as { js: Json; defs: Record<string, Json> };
  for (const [id, d] of Object.entries(out.defs)) components[`${name}_${id}`] = d;
  return out.js;
}

const pascal = (m: string): string => m[0]!.toUpperCase() + m.slice(1);

export function buildOpenApi(): Json {
  const components: Record<string, Json> = { ApiError: schemaOf("ApiError", S.apiError, {}) };
  // the body of a `format=json` export (a string inside ExportFile), published as its own named schema (BACKLOG 15.223c item 3; PA-X)
  components.ExportModel = schemaOf("ExportModel", S.exportModel, components);
  const paths: Record<string, Json> = {};
  const errorBody = { content: { "application/json": { schema: { type: "object", required: ["error"], properties: { error: { $ref: "#/components/schemas/ApiError" } } } } } };
  for (const m of Object.keys(CATALOGUE_CONTRACT).sort() as CatalogueMethod[]) {
    const c = CATALOGUE_CONTRACT[m] as { http: string; query?: z.ZodObject; path?: z.ZodObject; input: z.ZodType | null; output: z.ZodType };
    const [verb, path] = c.http.split(" ") as [string, string];
    // each path parameter carries the pattern of the schema that checks it: the contract's `path` schema when the URL's segments are
    // not the input's keys (globeCard, store.ts A29), else the input schema
    const shape = (c.path ? c.path.shape : c.input && "shape" in c.input ? (c.input as z.ZodObject).shape : {}) as Record<string, z.ZodType>;
    const paramSchema = (name: string): Json => {
      const sch = shape[name];
      if (!sch) return { type: "string" };
      const js = z.toJSONSchema(sch, { target: "draft-2020-12", unrepresentable: "any" }) as Json;
      delete js.$schema;
      return js;
    };
    const params: Json[] = [...path.matchAll(/\{(\w+)\}/g)].map((x) => ({ name: x[1], in: "path", required: true, schema: paramSchema(x[1]!) }));
    if (c.query) {
      for (const [key, sch] of Object.entries(c.query.shape as Record<string, z.ZodType>)) {
        // a repeated key (resolveRefs' `ref`, FAV-1W) is a form-exploded array: `?ref=a&ref=b`; every other key is one flat string
        const inner = sch instanceof z.ZodOptional ? sch.unwrap() : sch;
        if (inner instanceof z.ZodArray) {
          const js = z.toJSONSchema(inner, { target: "draft-2020-12", unrepresentable: "any" }) as Json;
          delete js.$schema;
          params.push({ name: key, in: "query", required: false, style: "form", explode: true, schema: js });
        } else params.push({ name: key, in: "query", required: false, schema: { type: "string" } });
      }
    }
    const o = c.output;
    const op: Json = {
      operationId: m,
      summary: m,
      description: c.query && "q" in c.query.shape && "country" in c.query.shape
        ? `Facets are comma lists; a narrowed Kind adds f.<facet> parameters (pattern ${S.FACET_KEY_RE.source}).${m === "countPlaces" ? ` A parse to merge first (store.ts A25) is sent as parsed.q and parsed.<facet> parameters (the facet part matches the same pattern).` : ""}`
        : m === "resolveRefs"
          ? `One ref parameter per value, 1 to ${S.RESOLVE_MAX}: a handle (place:<slug>, trip:<slug>) or a public ref. One row per value, in the order asked. More than ${S.RESOLVE_MAX} is 413 too_large; a value that is neither is 400 invalid_input naming its index, never the value. A page that is not public answers unknown, like one that never existed.`
          : undefined,
      parameters: params,
      responses: {
        "200": { description: "ok", headers: { ETag: { schema: { type: "string" } } }, content: { "application/json": { schema: schemaOf(pascal(m), o, components) } } },
        ...(m === "getPlace" || m === "getTrip" || m === "tripLegs" ? { "308": { description: "the slug moved; Location is the current URL, with the query kept" } } : {}),
        ...Object.fromEntries([400, 404, 413, 501, 500].map((s) => [String(s), { description: STATUS_TEXT[s], ...errorBody }])),
        ...(c.http.startsWith("GET") && m !== "revision" ? { "304": { description: "If-None-Match matched the revision" } } : {}),
      },
    };
    if (c.http.startsWith("POST")) {
      op.requestBody = { required: true, content: { "application/json": { schema: schemaOf(`${pascal(m)}Input`, c.input!, components) } } };
    }
    paths[path] = { ...(paths[path] ?? {}), [verb.toLowerCase()]: op };
  }
  // STEP2-M (gap-analysis D6): the model a public trip's page embeds. Not a store method: respond() answers it from getTrip (which trip,
  // which revision) and the page's own model builder, so it sits beside the contract's paths like this document does.
  const slugJs = z.toJSONSchema(S.tripSlugInput.shape.slug, { target: "draft-2020-12", unrepresentable: "any" }) as Json;
  delete slugJs.$schema;
  paths["/api/v1/trips/{slug}/plan-model"] = {
    get: {
      operationId: "tripPlanModel",
      summary: "tripPlanModel",
      description: "The model the public trip page renders (days, timeline inputs, addables per day, sections, route, gallery), public data only. A copy's own changes are applied on the device, never sent.",
      parameters: [{ name: "slug", in: "path", required: true, schema: slugJs }],
      responses: {
        "200": { description: "ok", headers: { ETag: { schema: { type: "string" } } }, content: { "application/json": { schema: schemaOf("TripPlanModel", S.tripPlanModelLookup, components) } } },
        "308": { description: "the slug moved; Location is the current URL, with the query kept" },
        ...Object.fromEntries([400, 404, 500].map((s) => [String(s), { description: STATUS_TEXT[s], ...errorBody }])),
        "304": { description: "If-None-Match matched the revision" },
      },
    },
  };
  // TB-API (trip-builder.md 5): the builder's three routes, served by PlanService behind the `planBuilder` flag (404 with the flag off).
  // Not store methods, so they sit beside the contract's paths like the plan model. Their codes are the builder's own (S.PLAN_ERROR_CODES).
  const planErrors = (codes: number[]): Json =>
    Object.fromEntries(codes.map((st) => [String(st), { description: `${S.PLAN_ERROR_CODES.filter((c) => S.PLAN_ERROR_STATUS[c] === st).join(" or ")}`, ...errorBody }]));
  const ccJs = z.toJSONSchema(S.planRegionsInput.shape.cc, { target: "draft-2020-12", unrepresentable: "any" }) as Json;
  delete ccJs.$schema;
  paths["/api/v1/plan/regions/{cc}"] = {
    get: {
      operationId: "planRegions",
      summary: "planRegions",
      description: "The region groups and regions of one country with counts of researched places. Public, cached by the catalogue revision. Answers 404 when the planBuilder flag is off.",
      parameters: [{ name: "cc", in: "path", required: true, schema: ccJs }],
      responses: {
        "200": { description: "ok", headers: { ETag: { schema: { type: "string" } } }, content: { "application/json": { schema: schemaOf("PlanRegions", S.planRegions, components) } } },
        ...planErrors([400, 404, 500, 501]),
        "304": { description: "If-None-Match matched the revision" },
      },
    },
  };
  paths["/api/v1/plan/candidates"] = {
    get: {
      operationId: "planCandidates",
      summary: "planCandidates",
      description: `One page (40 at most) of ranked candidates for trip mode (m=trip, cc, rg) or near mode (m=near, from=<hub:id|iata:XXX|town:id>, r=<one-way drive minutes>). Facets are the Places keys (pattern ${S.FACET_KEY_RE.source}); p is the party band (adults or family-<youngest>), never ages. Public, cached by the catalogue revision. Answers 404 when the planBuilder flag is off.`,
      parameters: Object.keys(S.planCandidatesHttpQuery.shape).map((name) => ({ name, in: "query", required: false, schema: { type: "string" } })),
      responses: {
        "200": { description: "ok", headers: { ETag: { schema: { type: "string" } } }, content: { "application/json": { schema: schemaOf("PlanCandidatePage", S.planCandidatePage, components) } } },
        ...planErrors([400, 404, 413, 500, 501]),
        "304": { description: "If-None-Match matched the revision" },
      },
    },
  };
  paths["/api/v1/plan/build"] = {
    post: {
      operationId: "planBuild",
      summary: "planBuild",
      description: "Builds a plan: bases, nights, days, did-not-fit, reasons and the picks matrix. The party travels in this body only and is never echoed, logged or cached; the response is no-store. At most 30 builds an hour per client. Answers 404 when the planBuilder flag is off, 503 plan_paused while PLAN_BUILDER_PAUSED=1.",
      parameters: [],
      requestBody: { required: true, content: { "application/json": { schema: schemaOf("PlanBuildInput", S.planBuildInput, components) } } },
      responses: {
        "200": { description: "ok", content: { "application/json": { schema: schemaOf("PlanBuild", S.planBuildAnswer, components) } } },
        ...planErrors([400, 404, 413, 429, 500, 501, 503]),
      },
    },
  };
  paths["/api/v1/openapi.json"] ={ get: { operationId: "openapi", summary: "this document", responses: { "200": { description: "ok", content: { "application/json": { schema: { type: "object" } } } } } } };
  return {
    openapi: "3.1.0",
    info: { title: "Trip plans catalogue API", version: "1", description: "Read-only catalogue API (API-1b). Generated from core/src/schema/api; do not edit by hand. The site sets trailingSlash, so every path is served with a trailing slash (a request without one is redirected with 308)." },
    servers: [{ url: "/" }],
    paths,
    components: { schemas: components },
  };
}

export const openApiText = (doc: Json = buildOpenApi()): string => JSON.stringify(doc, null, 2) + "\n";
