import { ensureFixtureBuilds, ensureRealBuild } from './global-setup-shared';

/** Project `fixture`: the fixture apps, and the real build some of these files also read. */
export default function setup() {
  ensureRealBuild();
  ensureFixtureBuilds();
}
