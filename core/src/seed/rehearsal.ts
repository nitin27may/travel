// The child rehearsal evidence file, `seed-rehearsal/1` (spec 4.2, 6.1 item 3). Pure.
//
// `db:rehearse` (LOCAL-5) writes one file per commit to REHEARSAL_EVIDENCE_DIR/<commit>.json after it reset the child from
// production, deleted the copied sessions, migrated, synced, verified and ran the child suites. The production guard reads it
// BEFORE any connection: production is refused unless the file exists, parses, names the same commit and the child branch, is green
// in every required step and is younger than REHEARSAL_MAX_AGE_HOURS. After the RowMeta migration adds load_run, the engine also
// confirms the child's load_run row for the commit once connected to the child; the file stays the pre-connect proof.
//
// The schema holds no free text: every string is an id, a sha, a host or a timestamp, so the file cannot carry a connection string.
import { z } from "zod";
import { NEON_CHILD_BRANCH_ID, REHEARSAL_CLOCK_SKEW_MIN, REHEARSAL_MAX_AGE_HOURS } from "../config/database.ts";
import { RUN_ID_RE } from "../schema/rowMeta.ts";
import { SEED_CONTRACT_VERSION } from "./contract.ts";

export const REHEARSAL_SCHEMA = "seed-rehearsal/1";

/** The steps of a rehearsal, in the order LOCAL-5 runs them. */
export const REHEARSAL_STEPS = ["reset", "delete_sessions", "migrate", "sync_dry_run", "sync", "verify", "db_tests", "ris_t"] as const;
export type RehearsalStep = (typeof REHEARSAL_STEPS)[number];
/**
 * The steps that must be present, exit 0 and skip nothing for the rehearsal to count. `sync_dry_run` is informative (it exits 3
 * when there is a difference, which is the point of a rehearsal); `ris_t` joins this list when RIS-T exists.
 */
export const REHEARSAL_REQUIRED_STEPS: readonly RehearsalStep[] = ["reset", "delete_sessions", "migrate", "sync", "verify", "db_tests"];

const sha = z.string().regex(/^[0-9a-f]{40}$/);
/** A host name only: letters, digits, dots and dashes. No scheme, no user, no `@`, no `:`, no path. */
export const HOST_RE = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/;
const count = z.number().int().nonnegative();

export const rehearsalEvidenceSchema = z.strictObject({
  schema: z.literal(REHEARSAL_SCHEMA),
  commit: sha,
  contract_version: z.number().int().positive(),
  target: z.strictObject({ kind: z.literal("child"), branch_id: z.string().regex(/^br-[a-z0-9-]{1,60}$/), host: z.string().regex(HOST_RE) }),
  started_at: z.iso.datetime(),
  finished_at: z.iso.datetime(),
  steps: z.array(z.strictObject({ name: z.enum(REHEARSAL_STEPS), exit: z.number().int().min(0).max(255), skipped: count.optional() })).min(1),
  plan_totals: z.strictObject({ insert: count, update: count, retire: count, delete: count, unchanged: count, retained: count }),
  verify: z.strictObject({ ok: z.boolean(), tables: count, differing: count }),
  load_run_id: z.string().regex(RUN_ID_RE).nullable(),
  status: z.enum(["green", "red"]),
});
export type RehearsalEvidence = z.infer<typeof rehearsalEvidenceSchema>;

export type RehearsalCode =
  | "E_REHEARSAL_MISSING"
  | "E_REHEARSAL_INVALID"
  | "E_REHEARSAL_CONTRACT"
  | "E_REHEARSAL_COMMIT"
  | "E_REHEARSAL_TARGET"
  | "E_REHEARSAL_FAILED"
  | "E_REHEARSAL_STALE";

/** What the reader found: no file, or the parsed JSON (undefined when the file did not parse). */
export type RehearsalInput = { found: false } | { found: true; value: unknown };

export type RehearsalVerdict = { ok: true; evidence: RehearsalEvidence } | { ok: false; code: RehearsalCode; message: string };

/** Is the evidence a green child rehearsal of `commit`, recent enough, for this contract version? Messages carry no values. */
export function checkRehearsal(input: RehearsalInput | undefined, commit: string, now: Date, productionHost: (host: string) => boolean): RehearsalVerdict {
  if (!input || !input.found) return { ok: false, code: "E_REHEARSAL_MISSING", message: "no child rehearsal evidence for this commit; run the child rehearsal first" };
  const parsed = rehearsalEvidenceSchema.safeParse(input.value);
  if (!parsed.success) {
    const where = [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "(root)"))].slice(0, 5).join(", ");
    return { ok: false, code: "E_REHEARSAL_INVALID", message: `the rehearsal evidence does not match ${REHEARSAL_SCHEMA} (at ${where})` };
  }
  const ev = parsed.data;
  if (ev.contract_version !== SEED_CONTRACT_VERSION) {
    return { ok: false, code: "E_REHEARSAL_CONTRACT", message: `the rehearsal ran seed contract v${ev.contract_version}; this code is v${SEED_CONTRACT_VERSION}` };
  }
  if (ev.commit !== commit) return { ok: false, code: "E_REHEARSAL_COMMIT", message: "the rehearsal evidence is for a different commit" };
  if (ev.target.branch_id !== NEON_CHILD_BRANCH_ID || productionHost(ev.target.host)) {
    return { ok: false, code: "E_REHEARSAL_TARGET", message: "the rehearsal did not run on the child branch" };
  }
  const failed = REHEARSAL_REQUIRED_STEPS.filter((name) => {
    const s = ev.steps.find((x) => x.name === name);
    return !s || s.exit !== 0 || (s.skipped ?? 0) > 0;
  });
  if (ev.status !== "green" || failed.length > 0 || !ev.verify.ok || ev.verify.differing > 0) {
    const why = failed.length ? `steps not green: ${failed.join(", ")}` : "status or verify not green";
    return { ok: false, code: "E_REHEARSAL_FAILED", message: `the child rehearsal is not green (${why})` };
  }
  const finished = Date.parse(ev.finished_at);
  const ageHours = (now.getTime() - finished) / 3_600_000;
  if (finished < Date.parse(ev.started_at) || now.getTime() + REHEARSAL_CLOCK_SKEW_MIN * 60_000 < finished) {
    return { ok: false, code: "E_REHEARSAL_INVALID", message: "the rehearsal evidence has impossible timestamps" };
  }
  if (ageHours > REHEARSAL_MAX_AGE_HOURS) {
    return { ok: false, code: "E_REHEARSAL_STALE", message: `the child rehearsal is older than ${REHEARSAL_MAX_AGE_HOURS} h; rehearse again` };
  }
  return { ok: true, evidence: ev };
}

/** The file text LOCAL-5 writes: validated, two-space JSON with a final newline. Throws on an invalid evidence object. */
export function rehearsalEvidenceText(evidence: RehearsalEvidence): string {
  return `${JSON.stringify(rehearsalEvidenceSchema.parse(evidence), null, 2)}\n`;
}
