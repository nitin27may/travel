import { CONTRACT_TABLES } from '../../../core/test/catalogue/contract/index.ts';
import { runContractTargets } from '../../../core/test/catalogue/contract/run.ts';
import { PHASE_E, jsonTarget } from './targets';

// The contract kit against JsonStore on the real data (API-1b). The near and nearbyForPlace tables are pending until phase E.
const { target } = jsonTarget();
target.pending = Object.fromEntries([...CONTRACT_TABLES.near!, ...CONTRACT_TABLES.nearbyForPlace!].map((c) => [`${c.method}:${c.id}`, PHASE_E]));
runContractTargets([target]);
