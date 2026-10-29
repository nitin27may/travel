// The ratchet gate (location-type-requirements 5.4, LT-C): what a promotion of one mark for one family would add to the required tier.
//
// A new property or link kind lands as A (phase 1: it counts for Complete, never for Usable, so no gap count moves). A family batch
// fills the field on every record of the family, then promotes the mark from A to R in the same commit. `capture.ts gaps --promote
// <key> --family <f>` simulates that promotion on a copy of data/vocab/types.json, reads every record through the same tier engine
// (recordTier), and lists the required keys the promotion would leave unanswered. Any unanswered key fails the gate (exit 1): the
// promotion waits for its fill, and the budget is never raised for a promotion (rule 5).
import { PROPERTY_BY_KEY } from "../schema/capture/properties.ts";
import type { Mark } from "../schema/capture/properties.ts";
import type { TypeNode, TypesFile } from "../schema/capture/typesFile.ts";
import { CAP_FAMILY } from "../schema/capture/typesFile.ts";
import * as E from "../schema/enums.ts";
import { LINK_KEY_PREFIX } from "./engine.ts";
import type { World } from "./records.ts";
import { resolveNode } from "./resolve.ts";
import { recordTier } from "./tiers.ts";
import { categoriesOfFamily, descendants, familyOf, splitMarkKey, treeOf } from "./tree.ts";

type LinkKind = (typeof E.CAP_LINK_KIND)[number];
export type PromoteMark = Extract<Mark, "R" | "R?">;

export interface PromotionRow { ref: string; type: string; layer: string; added: string[] }
export interface Promotion {
  key: string;
  family: string;
  mark: PromoteMark;
  categories: string[];
  /** records whose type is in the family */
  records: number;
  /** records that would gain at least one unanswered required key */
  rows: PromotionRow[];
  /** unanswered required keys the promotion would add, over every record */
  keysAdded: number;
  /** the budget's two tier counts, today and with the promotion */
  budget: { records: { now: number; promoted: number }; keys: { now: number; promoted: number } };
  ok: boolean;
}

export class PromoteError extends Error {}

const isCategory = (n: TypeNode): boolean => n.level === "category" || (n.level === "domain" && n.category === true);

/**
 * A copy of `file` with `key` promoted to `mark` on the family's categories, the way a batch would write it: the mark on each category,
 * and every A mark of the same key (unqualified or layer-qualified) below the categories raised too. An N below stays N (a type that
 * never asks the property). A link kind (`links.<kind>`) moves into the categories' `links.R`, and out of R? and A wherever a node
 * below lists it.
 */
export function promoteFile(file: TypesFile, key: string, family: string, mark: PromoteMark = "R"): TypesFile {
  if (!(CAP_FAMILY as readonly string[]).includes(family)) throw new PromoteError(`unknown family "${family}"; one of ${CAP_FAMILY.join(", ")}`);
  const cats = categoriesOfFamily(file, family);
  if (cats.length === 0) throw new PromoteError(`no category carries family "${family}" in data/vocab/types.json`);
  const out = structuredClone(file) as TypesFile;
  const tree = treeOf(out);
  const scope = new Set(cats.flatMap((c) => [c, ...descendants(tree, c)]));
  const nodes = out.nodes.filter((n) => scope.has(n.id));

  if (key.startsWith(LINK_KEY_PREFIX)) {
    const kind = key.slice(LINK_KEY_PREFIX.length) as LinkKind;
    if (!(E.CAP_LINK_KIND as readonly string[]).includes(kind)) throw new PromoteError(`"${kind}" is not a link kind (core/src/schema/enums.ts CAP_LINK_KIND)`);
    if (kind === "official") throw new PromoteError(`official is already required everywhere through the "links" key`);
    if (mark !== "R") throw new PromoteError(`a link kind is promoted to R (links.R); R? link kinds are not tier keys`);
    for (const n of nodes) {
      if (isCategory(n)) {
        // the category's resolved list, written whole, with the kind in R: children that edit it with add/remove still apply
        const resolved = resolveNode(n.id, file)!.links as { R: LinkKind[]; "R?": LinkKind[]; A: LinkKind[] };
        n.links = {
          R: [...new Set([...resolved.R, kind])],
          ...(resolved["R?"].filter((k) => k !== kind).length ? { "R?": resolved["R?"].filter((k) => k !== kind) } : {}),
          ...(resolved.A.filter((k) => k !== kind).length ? { A: resolved.A.filter((k) => k !== kind) } : {}),
        };
        continue;
      }
      const l = n.links;
      if (!l) continue;
      const listed = (l.A ?? []).includes(kind) || (l["R?"] ?? []).includes(kind);
      if (l.A) l.A = l.A.filter((k) => k !== kind);
      if (l["R?"]) l["R?"] = l["R?"].filter((k) => k !== kind);
      if (listed) l.R = [...new Set([...(l.R ?? []), kind])];
      if (l.add) l.add = l.add.filter((k) => k !== kind);
    }
    return out;
  }

  const { prop } = splitMarkKey(key);
  const def = PROPERTY_BY_KEY.get(prop);
  if (!def) throw new PromoteError(`"${prop}" is not a property of the registry (core/src/schema/capture/properties.ts), nor links.<kind>`);
  if (def.home.in === "suitability" && mark === "R?") throw new PromoteError(`a suitability path is R, A or N, never R?`);
  for (const n of nodes) {
    const marks = (n.marks ??= {});
    if (isCategory(n)) marks[key] = mark;
    for (const [k, m] of Object.entries(marks)) {
      if (m !== "A") continue;
      if (k === key || (!splitMarkKey(key).layer && splitMarkKey(k).prop === prop && splitMarkKey(k).layer)) marks[k] = mark;
    }
  }
  return out;
}

/** The gate: every record read with today's marks and with the promoted marks, through the same tier engine. */
export function promotion(world: World, file: TypesFile, key: string, family: string, mark: PromoteMark = "R"): Promotion {
  const promoted = promoteFile(file, key, family, mark);
  const tree = treeOf(file);
  const rows: PromotionRow[] = [];
  let records = 0, keysAdded = 0, recNow = 0, recPro = 0, keysNow = 0, keysPro = 0;
  for (const { rec } of world.cap.values()) {
    if (familyOf(tree, rec.type) === family) records++;
    const before = recordTier(world, rec.ref, file);
    const after = recordTier(world, rec.ref, promoted);
    const b = before?.requiredMissing ?? [];
    const a = after?.requiredMissing ?? [];
    if (b.length > 0) recNow++;
    if (a.length > 0) recPro++;
    keysNow += b.length;
    keysPro += a.length;
    const added = a.filter((k) => !b.includes(k));
    if (added.length > 0) {
      rows.push({ ref: rec.ref, type: rec.type, layer: rec.layer, added });
      keysAdded += added.length;
    }
  }
  rows.sort((x, y) => x.type.localeCompare(y.type) || x.ref.localeCompare(y.ref));
  return {
    key, family, mark, categories: categoriesOfFamily(file, family), records, rows, keysAdded,
    budget: { records: { now: recNow, promoted: recPro }, keys: { now: keysNow, promoted: keysPro } },
    ok: keysAdded === 0,
  };
}
