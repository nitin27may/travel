// The seed contract and the target guard (LOCAL-C; docs/v2/features/local-database-and-seed-sync.md, build notes LOCAL-C).
// Import from here:
//   contract.ts   SEED_TABLES (apply order, inputs, keys, onMissing), NOT_SEEDED and PRIVATE_CLASSES, assertSeedTable, assertDeletable
//   hash.ts       canonicalRow, contentHash, rowId, derivedId, tableHash, seedRunId, stampSeedMeta
//   plan.ts       classifyRow, planTable, seedPlan, formatPlan, planExitCode, planWrites (the idempotency rule)
//   drift.ts      compareTable, driftResult, formatDrift, driftExitCode (the db:verify shape)
//   guard.ts      describeTarget, hostsFromEnvText, guardTarget, assertTarget, guardedConnect (pure)
//   rehearsal.ts  the seed-rehearsal/1 evidence file and checkRehearsal
//   privacy.ts    inputRefusals, rowRefusals
//   io.ts         readRepoState, readRehearsal, readProductionHosts, expandInputs (the only module here that reads the machine)
//   schemaRefs.ts createdTables, tableReferences, hasColumn (what the migrations say, for the contract tests)
export * from "./contract.ts";
export * from "./hash.ts";
export * from "./plan.ts";
export * from "./drift.ts";
export * from "./guard.ts";
export * from "./rehearsal.ts";
export * from "./privacy.ts";
export * from "./io.ts";
export * from "./schemaRefs.ts";
export { globMatch } from "./glob.ts";
