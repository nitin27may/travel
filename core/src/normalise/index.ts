// The normaliser's library surface (RIS-N). Import from here:
//   normaliseText / planNormalise / applyReport   run.ts   the engine (pure text in, text out; read-only plan; write)
//   parsePointSource / pinnedPointRefs            points.ts  capture-points/1 to /2
//   patchText                                     jsonPatch.ts  a format-preserving JSON rewrite
//   findDuplicates / checkProseLinks              S2 candidates and the prose-link check
//   budgetOf / budgetRises                        the counts check-all pins
//   stampImportedFrom                             what the loader (RIS-L) stamps; the normaliser never writes imported_from
export { DEFAULT_READ, DEFAULT_RUN, applyReport, changesOf, findingsOf, normaliseText, planNormalise, summarise } from "./run.ts";
export type { TextContext, TextResult } from "./run.ts";
export { parsePointSource, pinnedPointRefs } from "./points.ts";
export { patchText, isCanonical } from "./jsonPatch.ts";
export { findDuplicates } from "./dupes.ts";
export type { DupeCandidate } from "./dupes.ts";
export { checkProseLinks } from "./proseLinks.ts";
export { BUDGET_PATH, budgetOf, budgetRises, readBudget } from "./budget.ts";
export { sha256, stampImportedFrom } from "./stamp.ts";
export { FAMILIES, RULES, TRIP_LEVEL_FAMILIES } from "./types.ts";
export type { Change, DocResult, Family, FileResult, Finding, NormaliseOptions, NormaliseReport, RuleId } from "./types.ts";
