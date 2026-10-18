import { createPublicData } from './index';

/** web/redirects.json: the existing /locations rule, every old place URL, and the globe fallback. Deterministic. */
export function buildRedirects(): { from: string; to: string; status: number }[] {
  const d = createPublicData();
  return [
    ...d.legacyPlaceRedirects().map((r) => ({ from: r.from, to: r.to, status: 301 })),
    { from: '/locations/*', to: '/places/:splat', status: 301 },
    { from: '/globe/*', to: '/globe/', status: 200 },
  ];
}

/** web/data-snapshots/snapshot-report.json: text that could not be made dateless, for a person to rewrite. */
export function buildReport(snapshotDropped: { where: string; text: string; why: string }[]) {
  const d = createPublicData();
  const items = [...snapshotDropped, ...d.internals.dropped].sort((a, b) => a.where.localeCompare(b.where) || a.text.localeCompare(b.text));
  return { schema: 'snapshot-report/1', note: 'Dropped from the public view because it carries a calendar date. Rewrite each as a season, a day number or a rule.', count: items.length, items };
}
