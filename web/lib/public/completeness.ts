import type { Completeness, CompletenessLevel } from './types';

// Hand-transcribed from docs/v2/research/kinds (README section 10 and each profile). Only the checks the data can
// answer are tracked; the engine (TODO row "Enforce per-kind completeness") replaces this later. Pure function.

/** Profile totals (Draft + Usable + Complete) by place kind, from each profile's "Totals" line. */
export const PROFILE_TOTAL: Record<string, number> = {
  trail: 38,
  lake: 29,
  viewpoint: 28,
  sight: 29,
  waterfall: 28,
  town: 29,
  activity: 25,
  lift: 28,
  stay: 28,
  eatery: 25,
  area: 15, // no profile: the common checks only (D1-D5, U1-U2, C1-C8)
};

export interface CompletenessInput {
  kind: string;
  name: string;
  /** area chain present */
  hasArea: boolean;
  point: { lat: number; lon: number; pointSource: string; pointChecked: string | null } | null;
  /** at least one source with a URL and a read date */
  hasDatedSource: boolean;
  hasSummary: boolean;
  hasSeason: boolean;
  hasOsmOrWikidata: boolean;
  /** link checklist: null when the place has none */
  checklistComplete: boolean | null;
  hasCreditedPhoto: boolean;
  // kind-specific
  distanceKm: number | null;
  gainM: number | null;
  timeHours: string | null;
  hasTrailheadPoint: boolean;
  hasAccess: boolean;
  durationMin: number | null;
}

const POINT_SOURCE = /^(osm_node|osm_way|osm_relation|official|wikidata|gps|manual_pin)(:.+)?$/;
const decimals = (n: number) => (String(n).split('.')[1] ?? '').length;

interface Check {
  id: string;
  level: 'D' | 'U' | 'C';
  label: string;
  hint: string;
  pass: boolean;
}

export function computeCompleteness(i: CompletenessInput): Completeness {
  const checks: Check[] = [
    { id: 'D1', level: 'D', label: 'Name', hint: 'Give it the name as signed on the ground.', pass: i.name.trim().length > 0 },
    { id: 'D2', level: 'D', label: 'Kind and subkind', hint: 'Pick a kind from the vocabulary.', pass: i.kind.length > 0 },
    { id: 'D3', level: 'D', label: 'Area', hint: 'Set the smallest area that contains it.', pass: i.hasArea },
    {
      id: 'D4', level: 'D', label: 'Point', hint: 'Add a point with 5 decimals from OpenStreetMap or an official source.',
      pass: !!i.point && decimals(i.point.lat) >= 5 && decimals(i.point.lon) >= 5 && POINT_SOURCE.test(i.point.pointSource),
    },
    { id: 'D5', level: 'D', label: 'Source', hint: 'Add one source with a URL and a read date.', pass: i.hasDatedSource },
    { id: 'U1', level: 'U', label: 'Summary', hint: 'Write 1 to 3 sentences in our words, with a source.', pass: i.hasSummary && i.hasDatedSource },
    { id: 'U2', level: 'U', label: 'Season', hint: 'Record the months it is open.', pass: i.hasSeason },
    { id: 'C1', level: 'C', label: 'Point checked by a person', hint: 'A person confirms the pin over imagery.', pass: !!i.point?.pointChecked },
    { id: 'C2', level: 'C', label: 'OpenStreetMap or Wikidata id', hint: 'Set osm_ref or wikidata_qid.', pass: i.hasOsmOrWikidata },
    { id: 'C4', level: 'C', label: 'Licensed photo', hint: 'Add a photo with a free licence and author.', pass: i.hasCreditedPhoto },
  ];
  if (i.checklistComplete !== null) {
    checks.push({ id: 'C3', level: 'C', label: 'Link checklist', hint: 'Fill every link kind or record that it was searched.', pass: i.checklistComplete });
  }
  if (i.kind === 'trail') {
    checks.push(
      { id: 'U3', level: 'U', label: 'Trailhead point', hint: 'Add the trailhead with a point and source.', pass: i.hasTrailheadPoint },
      { id: 'U5', level: 'U', label: 'Distance', hint: 'Read the distance from the land manager.', pass: i.distanceKm !== null },
      { id: 'U6', level: 'U', label: 'Climb', hint: 'Read the climb from the land manager.', pass: i.gainM !== null },
      { id: 'U7', level: 'U', label: 'Time', hint: 'Record a realistic family time.', pass: i.timeHours !== null },
    );
  } else if (i.kind === 'lake' || i.kind === 'viewpoint') {
    checks.push({ id: 'U3', level: 'U', label: 'Access', hint: 'Record how you get there (lot, shuttle or walk).', pass: i.hasAccess });
  } else if (i.kind === 'sight') {
    checks.push({ id: 'U7', level: 'U', label: 'Time on site', hint: 'Record minutes on site.', pass: i.durationMin !== null });
  }
  // stay: nights is trip-level, so no stay-specific check is tracked here.

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const profile = PROFILE_TOTAL[i.kind] ?? 15;
  const notTracked = Math.max(0, profile - total);
  const failed = checks
    .filter((c) => !c.pass)
    .sort((a, b) => 'DUC'.indexOf(a.level) - 'DUC'.indexOf(b.level))
    .map(({ id, label, hint }) => ({ id, label, hint }));
  const levelFail = (l: 'D' | 'U') => checks.some((c) => c.level === l && !c.pass);
  // Complete needs every check including the untracked ones, so it can only be reached when none are untracked.
  let level: CompletenessLevel = 'draft';
  if (!levelFail('D') && !levelFail('U')) level = failed.length === 0 && notTracked === 0 ? 'complete' : 'usable';
  // "Draft" is the workshop's word and never reaches a visitor (3.42): the public levels are Basics only, Partly checked and Checked
  const label = level === 'draft' ? 'Basics only' : level === 'complete' ? 'Checked' : `Partly checked · ${passed} of ${total}`;
  const tooltip = `${passed} of ${total} tracked checks pass; ${notTracked} check${notTracked === 1 ? ' is' : 's are'} not tracked yet`;
  return { level, passed, total, notTracked, failed, label, tooltip };
}
