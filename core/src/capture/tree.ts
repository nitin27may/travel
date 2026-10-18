// The type tree of data/vocab/types.json (capture contract 2.2): loading, indexes, inheritance and the rules a schema cannot hold.
//
// Everything that reads the tree goes through this module: the generator, the resolver, the validator and the CLI. The file is
// loaded from `root` when it exists there (tests build their own roots) and from the copy shipped with the code otherwise.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import defaultJson from "../../../data/vocab/types.json" with { type: "json" };
import * as E from "../schema/enums.ts";
import type { TypeNode, TypesFile } from "../schema/capture/typesFile.ts";

export const TYPES_PATH = "data/vocab/types.json";
export const DEFAULT_TYPES = defaultJson as unknown as TypesFile;

const fileCache = new Map<string, { sig: string; file: TypesFile }>();
/** The file under `root`, or the one shipped with the code. Parsed once per (path, mtime, size), so the tree caches survive repeated calls. */
export function loadTypes(root?: string): TypesFile {
  if (!root) return DEFAULT_TYPES;
  const p = join(root, TYPES_PATH);
  if (!existsSync(p)) return DEFAULT_TYPES;
  try {
    const st = statSync(p);
    const sig = `${st.mtimeMs}:${st.size}`;
    const hit = fileCache.get(p);
    if (hit && hit.sig === sig) return hit.file;
    const file = JSON.parse(readFileSync(p, "utf8")) as TypesFile;
    fileCache.set(p, { sig, file });
    return file;
  } catch {
    return DEFAULT_TYPES;
  }
}

export interface Tree {
  file: TypesFile;
  byId: Map<string, TypeNode>;
  children: Map<string, string[]>;
  /** lower-cased label, alias or id -> ids that claim it (a word may be ambiguous; the first is the default) */
  words: Map<string, string[]>;
  /** "kind/subkind" -> the node that claims the legacy pair */
  legacy: Map<string, string>;
}

const norm = (s: string): string => s.toLowerCase().replace(/[_\s]+/g, " ").trim();

export function buildTree(file: TypesFile): Tree {
  const byId = new Map<string, TypeNode>();
  const children = new Map<string, string[]>();
  const words = new Map<string, string[]>();
  const legacy = new Map<string, string>();
  for (const n of file.nodes) {
    byId.set(n.id, n);
    if (n.parent !== null) children.set(n.parent, [...(children.get(n.parent) ?? []), n.id]);
    const claim = (w: string): void => {
      const k = norm(w);
      words.set(k, [...new Set([...(words.get(k) ?? []), n.id])]);
    };
    claim(n.id);
    claim(n.label);
    for (const a of n.aliases ?? []) claim(a);
    for (const l of n.legacy ?? []) legacy.set(`${l.kind}/${l.subkind}`, n.id);
  }
  return { file, byId, children, words, legacy };
}

const cache = new WeakMap<TypesFile, Tree>();
export function treeOf(file: TypesFile = DEFAULT_TYPES): Tree {
  let t = cache.get(file);
  if (!t) {
    t = buildTree(file);
    cache.set(file, t);
  }
  return t;
}

/** The nodes from the root to `id`, inclusive. Empty when the id is unknown. */
export function chainOf(tree: Tree, id: string): TypeNode[] {
  const out: TypeNode[] = [];
  let cur = tree.byId.get(id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parent === null ? undefined : tree.byId.get(cur.parent);
  }
  return out;
}

export interface Counts { domains: number; categories: number; types: number; subtypes: number; ids: number; nodes: number }
/** 15 domains, 61 categories, 324 type ids (277 types and 47 subtypes). A domain that is its own category counts in both. */
export function countsOf(file: TypesFile): Counts {
  let domains = 0, categories = 0, types = 0, subtypes = 0;
  for (const n of file.nodes) {
    if (n.level === "domain") domains++;
    if (n.level === "category" || (n.level === "domain" && n.category)) categories++;
    if (n.level === "type") types++;
    if (n.level === "subtype") subtypes++;
  }
  return { domains, categories, types, subtypes, ids: types + subtypes, nodes: file.nodes.length };
}

/** The domain id of a node. */
export const domainOf = (id: string): string => id.split(".")[0]!;
/** The category id of a node: two segments, or the domain itself when the domain is its own category. */
export function categoryOf(tree: Tree, id: string): string {
  const dom = tree.byId.get(domainOf(id));
  if (dom?.category) return dom.id;
  return id.split(".").slice(0, 2).join(".");
}

/**
 * Finds a node by id, label, alias, or an old `kind/subkind` / `kind` name (kinds.md aliases). A word claimed by more than one
 * node returns the first; callers that need the ambiguity ask `tree.words`.
 */
export function resolveWord(tree: Tree, word: string): string | null {
  if (tree.byId.has(word)) return word;
  const k = norm(word);
  const hit = tree.words.get(k)?.[0];
  if (hit) return hit;
  const lg = tree.legacy.get(word);
  if (lg) return lg;
  if (word.includes("/")) return tree.legacy.get(word.replace(/_/g, "_")) ?? null;
  return null;
}

/** Descendants of `id` (not including it), depth first. */
export function descendants(tree: Tree, id: string): string[] {
  const out: string[] = [];
  const walk = (x: string): void => {
    for (const c of tree.children.get(x) ?? []) {
      out.push(c);
      walk(c);
    }
  };
  walk(id);
  return out;
}

export interface TreeIssue { id: string; message: string }

/** The mark keys a node may use: a property key, or `layer.key`. */
export function splitMarkKey(key: string): { layer: string | null; prop: string } {
  const m = /^(place|route|offer|event)\.(.+)$/.exec(key);
  return m ? { layer: m[1]!, prop: m[2]! } : { layer: null, prop: key };
}

export interface TreeCheckEnv {
  propertyKeys: ReadonlySet<string>;
  profileOk?: (name: string) => boolean;
  relevanceClasses?: ReadonlySet<string> | null;
  gradeSystems?: ReadonlySet<string>;
  /** the extension kinds of suitability/1 */
  extKinds?: ReadonlySet<string>;
  suitabilityPaths?: ReadonlySet<string>;
}

/** The rules of types.json that a schema cannot hold. Returns every problem; an empty list is a valid tree. */
export function checkTree(file: TypesFile, env: TreeCheckEnv): TreeIssue[] {
  const issues: TreeIssue[] = [];
  const bad = (id: string, message: string): void => void issues.push({ id, message });
  const seen = new Set<string>();
  const ids = new Set(file.nodes.map((n) => n.id));
  const LEVELS = ["domain", "category", "type", "subtype"];
  for (const n of file.nodes) {
    if (seen.has(n.id)) bad(n.id, "the id appears twice");
    seen.add(n.id);
    const depth = n.id.split(".").length;
    if (n.parent === null) {
      if (n.level !== "domain") bad(n.id, `a node without a parent must be a domain, not a ${n.level}`);
      if (depth !== 1) bad(n.id, "a domain id has one segment");
    } else {
      if (!ids.has(n.parent)) bad(n.id, `parent "${n.parent}" is not a node`);
      else {
        if (!n.id.startsWith(`${n.parent}.`) || depth !== n.parent.split(".").length + 1) bad(n.id, `the id must be the parent id "${n.parent}" plus one segment`);
        const parent = file.nodes.find((x) => x.id === n.parent)!;
        const skip = parent.level === "domain" && parent.category === true && n.level === "type";
        if (!skip && LEVELS.indexOf(n.level) !== LEVELS.indexOf(parent.level) + 1) bad(n.id, `a ${n.level} cannot sit under a ${parent.level}`);
      }
    }
    if (n.category && n.level !== "domain") bad(n.id, "only a domain can be its own category");
    for (const [key, mark] of Object.entries(n.marks ?? {})) {
      const { layer, prop } = splitMarkKey(key);
      if (layer && !(E.CAP_LAYER as readonly string[]).includes(layer)) bad(n.id, `mark "${key}" names the unknown layer "${layer}"`);
      if (!env.propertyKeys.has(prop)) bad(n.id, `mark "${key}": "${prop}" is not a property of the registry (core/src/schema/capture/properties.ts)`);
      if (mark === "R?" && env.suitabilityPaths?.has(prop)) bad(n.id, `mark "${key}": a suitability path is R, A or N, not R?`);
    }
    if (n.profile && env.profileOk && !env.profileOk(n.profile)) bad(n.id, `profile "${n.profile}" is not a row of "profiles"`);
    for (const s of n.effort?.scales ?? []) if (env.gradeSystems && !env.gradeSystems.has(s)) bad(n.id, `effort scale "${s}" is not a grade system with a block in data/schema/difficulty-map.json`);
    for (const c of n.relevance_class ?? []) {
      if (!env.relevanceClasses) continue;
      const fam = c.endsWith("/*");
      const ok = fam ? [...env.relevanceClasses].some((k) => k.startsWith(c.slice(0, -1))) : env.relevanceClasses.has(c);
      if (!ok) bad(n.id, `relevance class "${c}" is not in data/vocab/relevance-classes.json`);
    }
    if (n.ext && env.extKinds && !env.extKinds.has(n.ext)) bad(n.id, `ext "${n.ext}" is not an extension of suitability/1`);
  }
  // every node has a profile through its chain unless it says it carries none (event, access.pass): checked by the resolver.
  const tree = buildTree(file);
  // a legacy pair is claimed by one node
  const pairs = new Map<string, string>();
  for (const n of file.nodes) for (const l of n.legacy ?? []) {
    const k = `${l.kind}/${l.subkind}`;
    if (pairs.has(k)) bad(n.id, `the legacy pair ${k} is also claimed by ${pairs.get(k)}`);
    pairs.set(k, n.id);
  }
  // a domain that is its own category has no category children
  for (const n of file.nodes) if (n.category && (tree.children.get(n.id) ?? []).some((c) => tree.byId.get(c)!.level === "category")) bad(n.id, "a domain that is its own category has no category nodes under it");
  // a cycle cannot hide: every chain reaches a domain
  for (const n of file.nodes) if (chainOf(tree, n.id)[0]?.parent !== null && chainOf(tree, n.id)[0] !== undefined) bad(n.id, "the parent chain does not reach a domain");
  return issues;
}
