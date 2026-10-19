// data/vocab/types.json (capture-types/1): the one authored file of the capture contract (CC7). The tree of domains, categories,
// types and subtypes, the suitability profile rows (what was suitability-applicability.json), the layer and offer-class rules,
// and per node the marks, links, sources and display overrides. core/bin/capture.ts build resolves it into data/schema/capture/.
//
// Subset rule (meta.ts): plain shapes only. That ids form a tree, that every profile and mark key exists, and that every legacy
// (kind, subkind) pair is claimed once live in core/src/capture/tree.ts and core/src/validate/capture.ts.
import { z } from "zod";
import * as E from "../enums.ts";
import { date, json, pattern, table, text } from "../meta.ts";

export const TYPE_ID_RE = /^[a-z0-9_]+(\.[a-z0-9_]+){0,3}$/;
const layer = z.enum(E.CAP_LAYER);
const mark = z.enum(E.CAP_MARK);
const linkKind = z.enum(E.CAP_LINK_KIND);
const SOURCE_ORDER = ["O", "F", "T", "D", "C", "X"] as const;

export const typeNode = z.strictObject({
  id: z.string().regex(TYPE_ID_RE),
  parent: z.string().regex(TYPE_ID_RE).nullable(),
  level: z.enum(["domain", "category", "type", "subtype"]),
  /** a domain that is also its own category (settlement, event), so there are 61 categories in 15 domains */
  category: z.boolean().optional(),
  label: z.string().min(1),
  /** words people use, and old ids; they resolve to this node */
  aliases: z.array(z.string().min(1)).optional(),
  /** the (kind, subkind) pairs of suitability/1 that map to this node; the applicability file's `match` lists are generated from them */
  legacy: z.array(z.strictObject({ kind: z.string().min(1), subkind: z.string().min(1) })).optional(),
  records: z.array(layer).optional(),
  offer_class: z.enum(E.OFFER_CLASS).optional(),
  /** a key of `profiles`; children inherit it */
  profile: z.string().min(1).optional(),
  /** the default of a profile's `operated` flag for records of this type that do not state it */
  operated_default: z.boolean().optional(),
  /** the extension kind allowed on records of this node, when it differs from its profile's */
  ext: z.string().min(1).nullable().optional(),
  /** the layers whose records carry the suitability block (a lift's block sits on its ticket offer) */
  suitability_on: z.array(layer).optional(),
  effort: z.strictObject({ scales: z.array(z.enum(E.GRADE_SYSTEM)) }).optional(),
  /** relevance class keys, or a family such as "trail/*" */
  relevance_class: z.array(z.string().min(1)).optional(),
  /** property key, or layer.key (route.hours, offer.season), to R, R?, A or N */
  marks: z.record(z.string(), mark).optional(),
  links: z.strictObject({
    R: z.array(linkKind).optional(),
    "R?": z.array(linkKind).optional(),
    A: z.array(linkKind).optional(),
    add: z.array(linkKind).optional(),
    remove: z.array(linkKind).optional(),
  }).optional(),
  /** source order of preference, O operator, F official, T tourism board, D open data, C community, X computed */
  sources: z.array(z.enum(SOURCE_ORDER)).optional(),
  display: z.strictObject({ slot3: z.string().min(1).optional(), glance: z.array(z.string().min(1)).optional() }).optional(),
});

export const typeProfile = z.strictObject({
  operated: z.enum(["always", "never", "flag"]),
  ext: z.string().min(1).nullable(),
  note: z.string().optional(),
  /** `design` until the design reviewer has signed the row off (capture contract 2.3) */
  review: z.literal("design").optional(),
  /** only R, A and op cells; every other path is N */
  fields: z.record(z.string(), z.enum(["R", "A", "op"])),
});

const layerRule = z.strictObject({ R: z.array(z.string()).optional(), A: z.array(z.string()).optional(), N: z.array(z.string()).optional() });

export const capture_types = table("capture_types", {
  schema: pattern(/^capture-types\/1$/),
  note: text({ min: 1 }),
  updated: date(),
  profiles: json(z.record(z.string(), typeProfile)),
  /** layer deltas (3.3): route, place, offer, event, and offer.<class> */
  layers: json(z.record(z.string(), layerRule)),
  nodes: json(z.array(typeNode)),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Capture types" } });

export type TypeNode = z.infer<typeof typeNode>;
export type TypeProfile = z.infer<typeof typeProfile>;
export type LayerRule = z.infer<typeof layerRule>;
export interface TypesFile {
  schema: "capture-types/1";
  note: string;
  updated: string;
  profiles: Record<string, TypeProfile>;
  layers: Record<string, LayerRule>;
  nodes: TypeNode[];
}
