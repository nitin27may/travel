// Step 4 of the flywheel (plan 0A.2): merge a matched record into its row, field by field.
//   - a value with a newer read date and an equal or better source kind replaces the old one;
//   - an older or weaker value is kept as an alternative in field_meta.<field>.alternatives;
//   - two values of equal kind read on the same day that disagree make that field a conflict;
//   - a null field is filled; the same value from a new source is a corroboration (it feeds the promotion rule).
// Source kinds rank official > operator > press > reseller > blog > community (video, computed after) per policy.json.
import { bestEvidence, canon, clone, ensureSource, isEmpty, rankOf, same } from "./common.ts";
import type { Evidence, Row } from "./common.ts";

export type ChangeKind = "fill" | "replace" | "alternative" | "conflict" | "corroborate" | "link" | "gap";

export interface FieldChange {
  field: string;
  kind: ChangeKind;
  /** the field's value now (null for a fill) */
  before: unknown;
  /** the field's value after the change (equal to before for alternative, conflict and corroborate) */
  after: unknown;
  /** what the research said */
  incoming: unknown;
  /** the evidence behind the incoming value */
  evidence: Evidence[];
  /** how strong the value it was weighed against is */
  against?: { kind: string; read: string };
}

/** columns that are links: filling a null one is a "new link" (auto) whatever the source kind */
export const LINK_FIELDS = new Set(["official_url", "alltrails_url", "komoot_url", "outdooractive_url", "wikiloc_url", "book_url", "reseller_urls", "local_source_url"]);
/** list columns merge as sets */
export const LIST_FIELDS = new Set(["tags", "season_months", "hazards", "reseller_urls", "valid_months", "best_months"]);
/** never compared: identity, and provenance that the pipeline owns */
const SKIP = new Set(["id", "area_id", "offer_id", "from_id", "to_id", "mode", "review_status", "confidence", "sources", "field_meta", "verified_by", "last_verified", "contributed_by", "licence", "merged_from", "updated", "source_id"]);
/** columns that make a change need the owner whatever the source: hard limits and the house grade */
export const SENSITIVE = new Set(["min_age", "max_age", "min_height_cm", "max_height_cm", "min_weight_kg", "max_weight_kg", "house_grade", "house_basis"]);

export interface FieldEvidence {
  kind: string;
  read: string;
  urls: string[];
}

export interface MergeCtx {
  rank: readonly string[];
  /** evidence behind the stored value of a field: field_meta first, then the row's sources */
  evidenceOf(row: Row, field: string): FieldEvidence;
}

const union = (a: unknown[], b: unknown[]): unknown[] => [...new Set([...a, ...b].map((x) => canon(x)))].map((s) => JSON.parse(s)).sort((x, y) => canon(x).localeCompare(canon(y)));

export function mergeFields(existing: Row, incoming: Row, ev: Evidence[], ctx: MergeCtx): FieldChange[] {
  const out: FieldChange[] = [];
  const best = bestEvidence(ctx.rank, ev);
  if (!best) return out;
  for (const [field, inc] of Object.entries(incoming)) {
    if (SKIP.has(field) || isEmpty(inc)) continue;
    const cur = existing[field];
    const meta = existing.field_meta?.[field] ?? {};
    const known = (meta.alternatives ?? []) as Row[];
    const fe = ctx.evidenceOf(existing, field);
    const base = { field, incoming: inc, evidence: ev };

    if (isEmpty(cur)) {
      out.push({ ...base, kind: LINK_FIELDS.has(field) ? "link" : "fill", before: cur ?? null, after: inc });
      continue;
    }
    const list = LIST_FIELDS.has(field) && Array.isArray(cur) && Array.isArray(inc);
    const merged = list ? union(cur as unknown[], inc as unknown[]) : inc;
    if (same(cur, merged) || same(cur, inc)) {
      const have = new Set(fe.urls);
      if (ev.some((e) => !have.has(e.url))) out.push({ ...base, kind: "corroborate", before: cur, after: cur });
      continue;
    }
    // the same disagreement already recorded: nothing new to say
    if (known.some((a) => same(a.value, inc))) continue;

    const rIn = rankOf(ctx.rank, best.kind);
    const rCur = rankOf(ctx.rank, fe.kind);
    const against = { kind: fe.kind, read: fe.read };
    if (best.read > fe.read && rIn <= rCur) out.push({ ...base, kind: "replace", before: cur, after: merged, against });
    else if (rIn === rCur && best.read === fe.read) out.push({ ...base, kind: "conflict", before: cur, after: cur, against });
    else out.push({ ...base, kind: "alternative", before: cur, after: cur, against });
  }
  return out;
}

/** evidence of a stored field from field_meta, falling back to the strongest source the row cites */
export function fieldEvidenceOf(rank: readonly string[], row: Row, field: string, sourceRows: Row[]): FieldEvidence {
  const byId = new Map(sourceRows.map((s) => [s.id, s]));
  const meta = row.field_meta?.[field];
  const urlsOf = (ids: string[]): string[] => ids.map((i) => byId.get(i)?.url).filter((u): u is string => !!u);
  if (meta?.kind && meta?.read) return { kind: meta.kind, read: meta.read, urls: urlsOf(meta.src ?? []) };
  const cited = ((row.sources ?? []) as string[]).map((i) => byId.get(i)).filter((s): s is Row => !!s);
  const top = bestEvidence(rank, cited.map((s) => ({ url: s.url, kind: s.kind, read: s.read, title: s.title, publisher: s.publisher })));
  return top ? { kind: top.kind, read: top.read, urls: urlsOf(meta?.src ?? []).concat(cited.map((s) => s.url)) } : { kind: "community", read: "0000-00-00", urls: urlsOf(meta?.src ?? []) };
}

/** what a changed field records in field_meta: the strongest evidence and every source that states the value */
function metaFor(rank: readonly string[], file: Row, ev: Evidence[], prev: Row | undefined): Row {
  const best = bestEvidence(rank, ev)!;
  const meta: Row = { kind: best.kind, read: best.read, src: [...new Set(ev.map((e) => ensureSource(file, e)))].sort() };
  if (prev?.alternatives?.length) meta.alternatives = prev.alternatives;
  return meta;
}

/** Write the changes into a row (a working copy) and the file's sources. Returns the row. */
export function applyFieldChanges(row: Row, changes: FieldChange[], file: Row, rank: readonly string[], opts: { prevMetaOf?: (field: string) => Row | undefined } = {}): Row {
  const meta: Row = clone(row.field_meta ?? {});
  for (const c of changes) {
    const prev = meta[c.field] as Row | undefined;
    switch (c.kind) {
      case "fill":
      case "link": {
        if (c.field === "external") {
          meta.external = c.after;
          break;
        }
        row[c.field] = c.after;
        meta[c.field] = metaFor(rank, file, c.evidence, prev);
        break;
      }
      case "replace": {
        row[c.field] = c.after;
        const next = metaFor(rank, file, c.evidence, prev);
        const old: Row = { value: c.before, kind: prev?.kind ?? c.against?.kind ?? "community", read: prev?.read ?? c.against?.read ?? "0000-00-00", src: prev?.src ?? [] };
        next.alternatives = [...(prev?.alternatives ?? []), old];
        meta[c.field] = next;
        break;
      }
      case "alternative":
      case "conflict": {
        const best = bestEvidence(rank, c.evidence)!;
        const m: Row = prev ? clone(prev) : {};
        m.alternatives = [...(m.alternatives ?? []), { value: c.incoming, kind: best.kind, read: best.read, src: [...new Set(c.evidence.map((e) => ensureSource(file, e)))].sort() }];
        if (c.kind === "conflict") m.confidence = "conflict";
        meta[c.field] = m;
        break;
      }
      case "gap": {
        meta[c.field] = { ...(prev ?? {}), confidence: "gap", gap_reason: String(c.incoming ?? "") };
        break;
      }
      case "corroborate": {
        const m: Row = prev ? clone(prev) : { ...(opts.prevMetaOf?.(c.field) ?? {}) };
        const best = bestEvidence(rank, c.evidence)!;
        m.kind ??= best.kind;
        m.read ??= best.read;
        m.src = [...new Set([...(m.src ?? []), ...c.evidence.map((e) => ensureSource(file, e))])].sort();
        meta[c.field] = m;
        break;
      }
    }
    // a value filled or replaced clears an earlier "gap"
    if ((c.kind === "fill" || c.kind === "replace") && meta[c.field]?.confidence === "gap") delete meta[c.field].confidence;
  }
  row.field_meta = meta;
  return row;
}
