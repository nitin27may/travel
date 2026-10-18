// Inheritance (CC3): walk from the root to a node and resolve its contract. A child overrides only what differs; `explain` says
// where each mark came from.
//
// Order of precedence for a base-group mark at (node, layer), lowest first:
//   1. the property's own base mark (3.2), forced to N when the property does not exist on the layer;
//   2. the marks of the node chain, root to leaf (a leaf overrides its parent);
//   3. the layer rule of types.json (route, place, offer, event);
//   4. the offer-class rule (offer.experience and so on);
//   5. layer-qualified marks of the node chain (`offer.hours`), root to leaf.
// A suitability path is the profile's cell (op resolved by the record), overridden by an unqualified mark in the chain.
import type { Mark, PropertyDef } from "../schema/capture/properties.ts";
import { PROPERTY_BY_KEY, PROPERTIES } from "../schema/capture/properties.ts";
import type { TypeNode, TypeProfile, TypesFile } from "../schema/capture/typesFile.ts";
import { chainOf, splitMarkKey, treeOf } from "./tree.ts";
import type { Tree } from "./tree.ts";

export type Layer = "place" | "route" | "offer" | "event";
export type OfferClass = "experience" | "rental" | "ticket" | "access" | "lodging";
export type Operated = "always" | "never" | "flag";

export interface Why { from: string; mark: string; rule: string }

export interface ResolvedLayer {
  layer: Layer;
  offer_class: OfferClass | null;
  /** base-group property -> mark (N omitted) */
  base: Record<string, Mark>;
  /** where each base mark came from: the node id, "layer:<layer>", "class:<class>" or "base" */
  why: Record<string, Why>;
  /** whether the suitability block is carried on this layer */
  carries_suitability: boolean;
}

export interface ResolvedNode {
  id: string;
  label: string;
  domain: string;
  category: string;
  level: TypeNode["level"];
  chain: string[];
  records: Layer[];
  profile: string | null;
  operated: Operated;
  operated_default: boolean | null;
  ext: string | null;
  /** the profile's non-N cells with the node overrides applied; "op" is decided by the record's operated flag */
  suitability: Record<string, "R" | "A" | "op">;
  suitability_why: Record<string, Why>;
  effort: { scales: string[] };
  relevance_class: string[];
  layers: Partial<Record<Layer, ResolvedLayer>>;
  links: { R: string[]; "R?": string[]; A: string[] };
  sources: string[];
  display: { slot3: string | null; glance: string[] | null };
  aliases: string[];
}

const LAYERS: Layer[] = ["place", "route", "offer", "event"];
const NON_BASE = (p: PropertyDef): boolean => p.home.in === "suitability";

/** The attribute of the closest node in the chain that sets it, with that node's id. */
function nearest<K extends keyof TypeNode>(chain: TypeNode[], key: K): { value: NonNullable<TypeNode[K]>; from: string } | null {
  for (let i = chain.length - 1; i >= 0; i--) {
    const v = chain[i]![key];
    if (v !== undefined) return { value: v as NonNullable<TypeNode[K]>, from: chain[i]!.id };
  }
  return null;
}

export function resolveNode(id: string, file?: TypesFile): ResolvedNode | null {
  const tree: Tree = treeOf(file);
  const chain = chainOf(tree, id);
  if (chain.length === 0) return null;
  const node = chain[chain.length - 1]!;
  const profiles = tree.file.profiles;

  const profileHit = nearest(chain, "profile");
  const profileName = profileHit?.value ?? null;
  const profile: TypeProfile | null = profileName ? profiles[profileName] ?? null : null;
  const operatedDefault = nearest(chain, "operated_default");
  const extHit = nearest(chain, "ext");
  const ext = extHit ? (extHit.value as string | null) : profile ? profile.ext : null;
  const records = (nearest(chain, "records")?.value ?? []) as Layer[];
  const classHit = nearest(chain, "offer_class");
  const suitOn = nearest(chain, "suitability_on")?.value as Layer[] | undefined;
  const effort = nearest(chain, "effort")?.value ?? { scales: [] };
  const rel = nearest(chain, "relevance_class")?.value ?? [];

  // suitability cells: profile row, then unqualified chain marks on suitability paths
  const suitability: ResolvedNode["suitability"] = {};
  const suitability_why: Record<string, Why> = {};
  if (profile) for (const [p, m] of Object.entries(profile.fields)) {
    suitability[p] = m;
    suitability_why[p] = { from: `profile:${profileName}`, mark: m, rule: "profile row" };
  }
  for (const n of chain) {
    for (const [k, m] of Object.entries(n.marks ?? {})) {
      const { layer, prop } = splitMarkKey(k);
      const def = PROPERTY_BY_KEY.get(prop);
      if (layer || !def || !NON_BASE(def)) continue;
      if (m === "N") {
        delete suitability[prop];
      } else {
        suitability[prop] = m === "R" ? "R" : "A";
      }
      suitability_why[prop] = { from: n.id, mark: m, rule: "node mark" };
    }
  }

  const layers: ResolvedNode["layers"] = {};
  for (const layer of records) {
    const offerClass = layer === "offer" ? ((classHit?.value ?? "experience") as OfferClass) : null;
    const base: Record<string, Mark> = {};
    const why: Record<string, Why> = {};
    const set = (key: string, m: Mark, from: string, rule: string): void => {
      const def = PROPERTY_BY_KEY.get(key);
      if (!def || NON_BASE(def)) return;
      if (def.layers && !def.layers.includes(layer)) return; // forced N: the property does not exist on this layer
      if (m === "N") {
        delete base[key];
      } else {
        base[key] = m;
      }
      why[key] = { from, mark: m, rule };
    };
    for (const def of PROPERTIES) if (!NON_BASE(def) && def.base !== "N") set(def.key, def.base, "base", "base contract 3.2");
    for (const n of chain) for (const [k, m] of Object.entries(n.marks ?? {})) {
      const { layer: ql, prop } = splitMarkKey(k);
      if (!ql) set(prop, m, n.id, "node mark");
    }
    const applyRule = (rule: { R?: string[]; A?: string[]; N?: string[] } | undefined, from: string, label: string): void => {
      if (!rule) return;
      for (const k of rule.R ?? []) set(k, "R", from, label);
      for (const k of rule.A ?? []) set(k, "A", from, label);
      for (const k of rule.N ?? []) set(k, "N", from, label);
    };
    applyRule(tree.file.layers[layer], `layer:${layer}`, `layer rule ${layer}`);
    if (offerClass) applyRule(tree.file.layers[`offer.${offerClass}`], `class:${offerClass}`, `offer class ${offerClass}`);
    for (const n of chain) for (const [k, m] of Object.entries(n.marks ?? {})) {
      const { layer: ql, prop } = splitMarkKey(k);
      if (ql === layer) set(prop, m, n.id, `node mark (${layer})`);
    }
    // an R? mark without a trigger in the registry is advisory
    layers[layer] = { layer, offer_class: offerClass, base, why, carries_suitability: suitOn ? suitOn.includes(layer) : layer !== "event" && profile !== null };
  }

  // links: the nearest node that sets `links` as a whole (R, R?, A); `add` and `remove` edit the parent's list
  let links = { R: ["official"] as string[], "R?": [] as string[], A: [] as string[] };
  for (const n of chain) {
    const l = n.links;
    if (!l) continue;
    if (l.R || l["R?"] || l.A) links = { R: [...(l.R ?? [])], "R?": [...(l["R?"] ?? [])], A: [...(l.A ?? [])] };
    for (const a of l.add ?? []) if (!links.R.includes(a) && !links["R?"].includes(a)) links.A.push(a);
    for (const r of l.remove ?? []) {
      links.R = links.R.filter((x) => x !== r);
      links["R?"] = links["R?"].filter((x) => x !== r);
      links.A = links.A.filter((x) => x !== r);
    }
    // an add of booking on a stage makes it R? only when the parent had it as R?; otherwise A
  }
  const slot3 = nearest(chain, "display");
  let slot3Id: string | null = null;
  let glance: string[] | null = null;
  for (const n of chain) {
    if (n.display?.slot3) slot3Id = n.display.slot3;
    if (n.display?.glance) glance = n.display.glance;
  }
  void slot3;

  const cat = chain.find((n) => n.level === "category") ?? chain.find((n) => n.level === "domain" && n.category) ?? chain[0]!;
  const aliases = [...new Set(chain.slice(-1).flatMap((n) => n.aliases ?? []))];
  return {
    id: node.id,
    label: node.label,
    domain: chain[0]!.id,
    category: cat.id,
    level: node.level,
    chain: chain.map((n) => n.id),
    records,
    profile: profileName,
    operated: profile ? profile.operated : "never",
    operated_default: operatedDefault ? (operatedDefault.value as boolean) : null,
    ext,
    suitability,
    suitability_why,
    effort: effort as { scales: string[] },
    relevance_class: rel as string[],
    layers,
    links,
    sources: (nearest(chain, "sources")?.value ?? []) as string[],
    display: { slot3: slot3Id, glance },
    aliases,
  };
}

/** The suitability mark for a path under the record's operated flag. N when the contract does not ask for it. */
export function suitMark(node: ResolvedNode, path: string, operated: boolean): "R" | "A" | "N" {
  const raw = node.suitability[path];
  if (raw === undefined) return "N";
  if (raw === "op") return operated ? "R" : "N";
  if (path.startsWith("participation.") && !operated) return "N";
  return raw;
}

/** Layers that a type allows. */
export const layersOf = (id: string, file?: TypesFile): Layer[] => resolveNode(id, file)?.records ?? [];
export const ALL_LAYERS = LAYERS;

/** Human-readable trace of where the marks of a node come from (`capture.ts explain`). */
export function explain(node: ResolvedNode): string[] {
  const out: string[] = [];
  out.push(`${node.id}  ${node.label}`);
  out.push(`inherits: ${node.chain.join(" > ")}`);
  out.push(`records: ${node.records.join(", ")}${node.profile ? `; suitability profile "${node.profile}" (${node.operated}${node.operated_default !== null ? `, default operated ${node.operated_default}` : ""}), ext ${node.ext ?? "none"}` : "; no suitability profile"}`);
  out.push(`effort scales: ${node.effort.scales.length ? node.effort.scales.join(", ") : "none (time is shown instead)"}`);
  for (const l of node.records) {
    const rl = node.layers[l]!;
    out.push(`-- layer ${l}${rl.offer_class ? ` (offer class ${rl.offer_class})` : ""}${rl.carries_suitability ? "" : " (no suitability block here)"}`);
    for (const [k, m] of Object.entries(rl.base)) out.push(`   ${k.padEnd(18)} ${m.padEnd(2)}  from ${rl.why[k]?.from} (${rl.why[k]?.rule})`);
  }
  out.push("-- suitability");
  for (const [k, m] of Object.entries(node.suitability)) out.push(`   ${k.padEnd(34)} ${m.padEnd(2)}  from ${node.suitability_why[k]?.from}`);
  return out;
}
