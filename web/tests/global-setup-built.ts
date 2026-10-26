import { ensureRealBuild } from './global-setup-shared';

/** Project `built`: the tests read the real build (web/.next). `unit` has no global setup at all. */
export default function setup() {
  ensureRealBuild();
}
