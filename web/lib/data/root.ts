import path from 'node:path';

/** Repo root. TRAVEL_ROOT overrides it (the privacy test points it at a fixture tree). */
export function travelRoot(): string {
  if (process.env.TRAVEL_ROOT) return path.resolve(process.env.TRAVEL_ROOT);
  // `pnpm --dir web ...` runs with cwd = web/
  return path.resolve(process.cwd(), '..');
}

/** The date used for relative badges: HUB_TODAY when set (reproducible builds), else the build date. */
export function buildToday(): string {
  const pinned = process.env.HUB_TODAY;
  if (pinned && /^\d{4}-\d{2}-\d{2}$/.test(pinned)) return pinned;
  return new Date().toISOString().slice(0, 10);
}
