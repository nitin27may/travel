/**
 * Project `timing` (wall-clock thresholds). TS-4 hook point: the load guard goes here (wait while the 1-minute load average per
 * core is above 1.5, else defer; TEST-STRATEGY 7.1). Until then it does nothing, and the project only runs serially and alone.
 */
export function loadGuard(): void {}

export default function setup() {
  loadGuard();
}
