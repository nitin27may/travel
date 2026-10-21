import { ageLabel } from '@/lib/format/age';
import type { SuitabilityRecord } from '@travel/core/schema/suitability.ts';
import { isOperated, markOf, type Applicability, type Located, type Mark as CoreMark, profileOf, valueAt } from '@travel/core/suitability/applicability.ts';
import { deriveEffort, kidsFromOf, ruleValOf, valOf } from '@travel/core/suitability/derive.ts';
import { fits, type CheckStatus, type FitCheck } from '@travel/core/suitability/gates.ts';
import { checkRecord, type SuitLevel } from '@travel/core/suitability/level.ts';
import { DEFAULT_MAP } from '@travel/core/suitability/map.ts';
import { mergeBlock } from '@travel/core/suitability/merge.ts';
import type { Contract } from './contract';
import { WORDS, lookupFor, longDate, pval, isRawVal, type PVal, type RawVal, type SourceLookup, TextScrub, type Words } from './vals';

// "Who it suits" as data (suitability-display.md sections 1 to 4; suitability-applicability.md 5.1 and 5.2). Pure over a
// suitability record: the three chip slots, the warning line, the research line, the six groups in order. It draws nothing
// and names no kind: which fields count is the contract's marks (R, A, N), and the chip for the third slot is chosen by the
// type's `display.slot3` property key, formatted by the property, never by the type id.
//
// Rules this module keeps (display section 6):
//  - an N field never produces a row, a chip or a marker; a missing R field keeps its row with the gap chip;
//    missing A fields collapse into one closing line per group;
//  - every operator or official limit is visible at rest, in the chip's words or in its "+n" (pregnancy and medical bans count);
//  - "FE1" to "FE5" never appear: the effort is its name (Stroll, Easy, Moderate, Hard, Technical) and the original grade;
//  - no_limit earns the rule look ("No minimum age"); searched_none reads "<field> not stated" in the chip and a sentence
//    with the search date in its row; pregnancy not_recommended is a value (advice), not a gap.

export type ChipKind = 'rule' | 'advice' | 'value' | 'gap' | 'fits' | 'advice_fail' | 'rule_fail';
export type Glyph = 'lock' | 'person' | 'walker' | 'gauge' | 'wheel' | 'clock' | 'wave' | 'stroller' | 'boat' | 'brake' | 'thermometer' | 'kit' | 'check' | 'triangle' | 'none';

export interface Chip {
  kind: ChipKind;
  /** the words in the chip */
  text: string;
  glyph: Glyph;
  /** the accessible name: starts "Operator rule:", "Official rule:", "Our judgement:" or "Not checked yet:" (display check 13) */
  label: string;
  /** the property this chip speaks for, or null */
  field: string | null;
  /** operator bans past the third value, drawn "+n" after the text (D4) */
  extra: number;
  /** the same chip without its time, for a day row whose entry already carries the duration */
  textNoTime?: string;
}

export const GROUP_IDS = ['limits', 'who', 'effort', 'kind', 'facilities', 'when'] as const;
export type GroupId = (typeof GROUP_IDS)[number];

export interface SuitRow {
  key: string;
  label: string;
  /** the value in words, or the gap wording */
  text: string;
  look: 'rule' | 'advice' | 'info' | 'sentence' | 'gap';
  /** the sourced value behind the row, null for a missing R field */
  val: PVal | null;
  gap: boolean;
  /** "Sources disagree" when the value has conflicts (honesty chip, never one of the three slots) */
  honesty: string | null;
  /** the short form used in a collapsed group's summary */
  short: string;
}

export interface SuitGroup {
  id: GroupId;
  title: string;
  /** Limits and Who it suits are open at rest; the rest are collapsed to a header with their values inline (D7) */
  open: boolean;
  rows: SuitRow[];
  /** one closing line for the group's missing A fields, or null */
  closing: string | null;
}

export interface Research {
  done: number;
  total: number;
  read: string | null;
  level: SuitLevel;
  /** "Usable, partly unverified" for usable_partial (display 9); the plain level name otherwise */
  levelLabel: string;
  /** "13 of 13 key checks · 9 more not checked yet · read 12 Oct 2026" */
  text: string;
  /** the safety-critical limits that are missing or soft, led in the closing line */
  softSafety: string[];
}

export interface PublicSuitability {
  ref: string;
  /** slot 1 (limits or fit), slot 2 (effort or time), slot 3 (the deciding condition); null when the field is N */
  chips: [Chip | null, Chip | null, Chip | null];
  warning: string | null;
  research: Research;
  groups: SuitGroup[];
  /** the two card chips (D5): kids and effort name */
  card: { kids: Chip | null; effort: Chip | null };
  /** the stroller and wheelchair answers, as chips at rest when slot 3 does not already show them (S10) */
  accessChips: Chip[];
  /** the adult time of the record, the one home of that figure on the page (S4) */
  adultTime: { text: string; basis: string } | null;
  kidsFrom: number | null;
  familyEffort: { grade: 1 | 2 | 3 | 4 | 5; name: string; sourceGrade: string | null } | null;
  /** true when every R field is missing: the chip row is one gap chip "Family checks not done yet" (the Lake Louise case) */
  allMissing: boolean;
}

/** The suitability marks of a type (contract node) or of the applicability file: path -> R, A or op. */
export interface SuitMarks {
  marks: Record<string, 'R' | 'A' | 'op'>;
  operated: 'always' | 'never' | 'flag';
}

export interface SuitOptions {
  lookup?: SourceLookup;
  scrub?: TextScrub;
  /** the contract's suitability row for the record's type; without it the applicability file is read through core */
  suitMarks?: SuitMarks;
  /** the record's third chip property (contract `display.slot3`) */
  slot3?: string | null;
  /** one offer of the record, merged over the record's block */
  offerIndex?: number;
  /** a party's youngest traveller: slot 1 becomes the fit chip (D6) */
  party?: { youngestAge: number; relaxed?: boolean };
  words?: Partial<Words>;
  applicability?: Applicability;
}

// ---- small helpers ----------------------------------------------------------------------------------------------------

const EFFORT_NAMES = ['Stroll', 'Easy', 'Moderate', 'Hard', 'Technical'] as const;
export const effortName = (grade: number): string => EFFORT_NAMES[Math.min(5, Math.max(1, grade)) - 1]!;

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

function dur(min: number): string {
  if (min < 60) return `${min} min`;
  // a visit longer than a day is counted in days (an area), never "336 h"
  if (min >= 1440 && min % 1440 === 0) return `${min / 1440} ${min === 1440 ? 'day' : 'days'}`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}
/** "45 min–1 h 30", "30–45 min", "1–3 h", "2–14 days", "90 min": the unit shows on both ends when they differ, once when they match. */
function durRange(r: [number, number]): string {
  const [a, b] = r;
  if (a === b) return dur(a);
  if (b >= 1440 && a >= 1440 && a % 1440 === 0 && b % 1440 === 0) return `${a / 1440}–${dur(b)}`;
  if (b < 60) return `${a}–${b} min`;
  // both in hours: the unit shows once, at the end ("1–3 h", "1–1 h 30")
  if (a >= 60 && a % 60 === 0 && b < 1440) return `${a / 60}–${dur(b)}`;
  return `${dur(a)}–${dur(b)}`;
}
const num = (n: number): string => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
const humanise = (s: string): string => s.replace(/_/g, ' ');
const cap = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

const KIT_LABEL: Record<string, string> = {
  pfd: 'PFD', helmet: 'helmet', wetsuit: 'wetsuit', booties: 'booties', spray_jacket: 'spray jacket', fleece: 'fleece', harness: 'harness',
  lanyard: 'lanyard', crampons: 'crampons', microspikes: 'microspikes', ice_axe: 'ice axe', boots: 'boots', gloves: 'gloves',
  headlamp: 'headlamp', body_armour: 'body armour', full_face_helmet: 'full-face helmet', bike: 'bike',
};
const WEATHER_LABEL: Record<string, string> = {
  wind: 'wind', lightning: 'lightning', rain: 'rain', river_level: 'river level', sea_state: 'sea state', visibility: 'visibility',
  heat: 'heat', snow: 'snow', fog: 'fog', maintenance: 'maintenance',
};
const MEDICAL_LABEL: Record<string, string> = {
  heart: 'heart', high_blood_pressure: 'high blood pressure', epilepsy: 'epilepsy', neurological: 'neurological', back_neck: 'back and neck',
  recent_surgery: 'recent surgery', dislocation: 'dislocation', asthma: 'asthma', diabetes: 'diabetes', mobility: 'mobility', balance: 'balance', lung: 'lung',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "05-15" -> "15 May" */
const mmdd = (s: string): string => `${Number(s.slice(3))} ${MONTHS[Number(s.slice(0, 2)) - 1]}`;

// ---- the paths of each group (applicability 5.2) ----------------------------------------------------------------------

const LIMIT_PATHS = [
  'min_age', 'max_age', 'min_height_cm', 'max_height_cm', 'min_weight_kg', 'max_weight_kg', 'adult_required', 'group_min', 'solo',
  'participation.driver', 'participation.guide', 'water_safety.swim_ability', 'participation.waiver', 'participation.medical', 'participation.pregnancy',
  'participation.weigh_in', 'participation.fitness', 'participation.min_shoe_eu',
];
const WHO_PATHS = ['age_band', 'kid_note', 'carrier_ok', 'stroller', 'stroller_on_board', 'wheelchair', 'access_detail', 'accessible_toilet', 'accessible_parking', 'limited_capacity_note'];
const EFFORT_PATHS = ['effort.source_grade', 'effort.drivers.distance_km', 'effort.drivers.gain_m', 'effort.drivers.loss_m', 'effort.drivers.surface', 'effort.drivers.scrambling', 'effort.drivers.fixed_aids', 'effort.drivers.max_grade_pct', 'adult_time_min', 'child_time_min', 'on_site_min'];
const FACILITY_PATHS = ['toilets', 'water', 'food', 'shade', 'bail_out', 'signal', 'change_rooms', 'showers', 'picnic', 'baby_change'];
const WHEN_PATHS = ['access_season', 'participation.weather_cancel', 'hazards', 'exposure', 'altitude_m'];
const KIT_PATHS_FIXED = ['participation.kit_provided', 'participation.wear', 'water_safety.class', 'water_safety.lifejacket', 'water_safety.child_sizes_from_kg', 'water_safety.lifeguard', 'water_safety.entry', 'water_safety.water_temp_c', 'water_safety.current_or_tide'];

const GROUP_TITLE: Record<GroupId, string> = {
  limits: 'Limits and rules',
  who: 'For a family',
  effort: 'Effort and time',
  kind: 'Details',
  facilities: 'Facilities',
  when: 'When you can go',
};
/** The kind block's heading by extension discriminator (a vocabulary of the suitability schema, not a type id). */
const KIND_TITLE: Record<string, string> = {
  trail: 'On the trail', ride: 'The ride', paddle: 'On the water', ferrata: 'On the cable', water: 'The water', cave: 'In the cave', snow: 'On the snow',
  lift: 'The lift', boat: 'The boat', zip: 'The course', jump: 'The jump', coaster: 'The coaster', horse: 'The ride', glacier: 'On the ice',
  flight: 'The flight', wildlife: 'Viewing', area: 'The area', drive: 'The drive',
};

// ---- labels and formatting by property ---------------------------------------------------------------------------------

const LABEL: Record<string, string> = {
  min_age: 'Minimum age', max_age: 'Maximum age', min_height_cm: 'Minimum height', max_height_cm: 'Maximum height', min_weight_kg: 'Minimum weight',
  max_weight_kg: 'Maximum weight', adult_required: 'With an adult', group_min: 'Group size', solo: 'Alone', 'participation.driver': 'Driver',
  'participation.guide': 'Guide', 'water_safety.swim_ability': 'Swimming', 'participation.waiver': 'Waiver', 'participation.medical': 'Medical',
  'participation.pregnancy': 'Pregnancy', 'participation.weigh_in': 'Weigh-in', 'participation.fitness': 'Fitness', 'participation.min_shoe_eu': 'Shoe size',
  age_band: 'Recommended', kid_note: 'For a child', carrier_ok: 'Carrier', stroller: 'Stroller', stroller_extent: 'Stroller extent', stroller_on_board: 'Stroller on board',
  wheelchair: 'Wheelchair', access_detail: 'Access detail', accessible_toilet: 'Accessible toilet', accessible_parking: 'Accessible parking', limited_capacity_note: 'Capacity',
  'effort.source_grade': 'Effort', 'effort.drivers.distance_km': 'Distance', 'effort.drivers.gain_m': 'Climb', 'effort.drivers.loss_m': 'Descent',
  'effort.drivers.surface': 'Surface', 'effort.drivers.scrambling': 'Scrambling', 'effort.drivers.fixed_aids': 'Fixed aids', 'effort.drivers.max_grade_pct': 'Steepest',
  'ext.trail.snowfields_until': 'Snow on the trail until',
  adult_time_min: 'Adult time', child_time_min: 'Child time', on_site_min: 'Time on site',
  toilets: 'Toilets', water: 'Drinking water', food: 'Food', shade: 'Shade', bail_out: 'Bail-out', signal: 'Phone signal', change_rooms: 'Changing rooms',
  showers: 'Showers', picnic: 'Picnic', baby_change: 'Baby change', access_season: 'Access', 'participation.weather_cancel': 'Weather cancellation', hazards: 'Hazards',
  exposure: 'Exposure', altitude_m: 'Altitude', 'participation.kit_provided': 'Kit provided', 'participation.wear': 'Wear', 'water_safety.class': 'Water class',
  'water_safety.lifejacket': 'Life jackets', 'water_safety.child_sizes_from_kg': 'Child sizes from', 'water_safety.lifeguard': 'Lifeguard', 'water_safety.entry': 'Entry',
  'water_safety.water_temp_c': 'Water temperature', 'water_safety.current_or_tide': 'Current',
};

function extLabel(path: string): string {
  const field = (path.split('.').pop() ?? path).replace(/_min$/, '').replace(/_m$/, '');
  return cap(humanise(field));
}
export const labelOf = (path: string): string => LABEL[path] ?? extLabel(path);

const STROLLER_WORD: Record<string, string> = { smooth: 'Any stroller', all_terrain: 'All-terrain stroller only', none: 'No stroller access' };

/** The value in words, by property. null: no formatter knows the shape, the caller falls back to a generic read. */
function describe(path: string, v: unknown, rec: { block: Obj; ext: Obj | undefined }): string | null {
  switch (path) {
    case 'min_age': return typeof v === 'number' ? `${v}` : null;
    case 'max_age': return typeof v === 'number' ? `${v}` : null;
    case 'min_height_cm': case 'max_height_cm': return typeof v === 'number' ? `${v} cm` : null;
    case 'min_weight_kg': case 'max_weight_kg': return typeof v === 'number' ? `${num(v)} kg` : null;
    case 'adult_required': {
      if (v === 'none') return 'No adult needed';
      if (isObj(v) && typeof v.under === 'number') return `Under ${v.under} with an adult`;
      if (isObj(v) && typeof v.ratio === 'number') return `One adult per ${v.ratio}`;
      return null;
    }
    case 'group_min': return isObj(v) && typeof v.n === 'number' ? `At least ${v.n}${typeof v.season === 'string' ? ` (${v.season})` : ''}` : null;
    case 'solo': {
      if (!isObj(v)) return null;
      const bits = [typeof v.min_age === 'number' ? `from age ${v.min_age}` : '', typeof v.min_height_cm === 'number' ? `from ${v.min_height_cm} cm` : ''].filter(Boolean);
      return bits.length ? bits.join(' or ') : null;
    }
    case 'participation.driver': {
      if (!isObj(v)) return null;
      const bits: string[] = [];
      if (typeof v.min_age === 'number') bits.push(`Driver ${v.min_age}+`);
      if (v.licence === 'boat_card') bits.push('boat card');
      if (v.licence === 'driving_licence') bits.push("driver's licence");
      if (typeof v.passenger_min_age === 'number') bits.push(`passengers ${v.passenger_min_age}+`);
      return bits.length ? bits.join(' · ') : null;
    }
    case 'participation.guide': return v === 'required' ? 'Required' : v === 'recommended' ? 'Recommended' : v === 'none' ? 'Not needed' : null;
    // no official page states swimming and some ask visitors to avoid it (CS7c): the data says so honestly
    case 'ext.water.swimming': return v === 'discouraged' ? 'Swimming discouraged' : null;
    case 'water_safety.swim_ability': return v === 'none_needed' ? 'No swimming needed' : v === 'comfortable' ? 'Must be comfortable in the water' : v === 'tested' ? 'Swim test' : null;
    case 'participation.waiver': {
      if (!isObj(v)) return null;
      if (v.required !== true) return 'No waiver';
      return typeof v.guardian_signs_under === 'number' ? `A guardian signs for under-${v.guardian_signs_under}s` : 'Waiver required';
    }
    case 'participation.medical': {
      if (!isObj(v)) return null;
      const ex = (v.excluded as string[] | undefined) ?? [];
      const ask = (v.ask_doctor as string[] | undefined) ?? [];
      const nr = (v.not_recommended as string[] | undefined) ?? [];
      const parts: string[] = [];
      if (ex.length) parts.push(`${ex.map((m) => MEDICAL_LABEL[m] ?? humanise(m)).join(', ')} excluded`);
      if (nr.length) parts.push(`${nr.map((m) => MEDICAL_LABEL[m] ?? humanise(m)).join(', ')} not recommended`);
      if (ask.length) parts.push(`ask a doctor: ${ask.map((m) => MEDICAL_LABEL[m] ?? humanise(m)).join(', ')}`);
      return parts.length ? parts.join('; ') : 'No exclusions stated';
    }
    case 'participation.pregnancy':
      return v === 'allowed' ? 'Allowed' : v === 'ask_doctor' ? 'Ask a doctor' : v === 'not_recommended' ? 'Not recommended' : v === 'not_allowed' ? 'Not allowed' : null;
    case 'participation.weigh_in': return v === true ? 'You are weighed on site' : v === false ? 'No weigh-in' : null;
    case 'participation.fitness': return typeof v === 'string' ? `“${v}”` : null;
    case 'participation.min_shoe_eu': return typeof v === 'number' ? `EU ${v}+` : null;
    case 'age_band': {
      if (!isObj(v) || typeof v.from !== 'number') return null;
      if (v.to === null || v.to === undefined) return ageLabel('fit', v.from, 'advice');
      return `About ${v.from} to ${v.to}`;
    }
    case 'carrier_ok': return v === true ? 'Carrier OK' : v === false ? 'Not suited to carriers' : null;
    case 'stroller': {
      if (typeof v !== 'string') return null;
      const ext = rec.block.stroller_extent;
      const extent = isObj(ext) && v !== 'none' && ext.scope === 'part' ? `, ${typeof ext.part_note === 'string' ? ext.part_note : typeof ext.part_km === 'number' ? `first ${num(ext.part_km)} km` : 'for part of the way'}` : '';
      return `${STROLLER_WORD[v] ?? humanise(v)}${extent}`;
    }
    case 'stroller_on_board':
      return v === 'yes' ? 'Strollers on board' : v === 'folded' ? 'Strollers folded' : v === 'no' ? 'No strollers on board' : v === 'leave_at_dock' ? 'Leave strollers at the dock' : null;
    case 'wheelchair': return v === 'step_free' ? 'Step-free' : v === 'partial' ? 'Partly accessible' : v === 'none' ? 'Not accessible' : null;
    case 'accessible_toilet': return v === true ? 'Yes' : v === false ? 'None' : null;
    case 'accessible_parking': return v === true ? 'Yes' : v === false ? 'None' : null;
    case 'effort.source_grade': {
      if (!isObj(v) || typeof v.value !== 'string') return null;
      const sys = systemName(String(v.system));
      return `${sys} ${humanise(v.value)}`;
    }
    case 'effort.drivers.distance_km': return typeof v === 'number' ? `${num(v)} km` : null;
    case 'effort.drivers.gain_m': case 'effort.drivers.loss_m': return typeof v === 'number' ? `${Math.round(v)} m` : null;
    case 'effort.drivers.max_grade_pct': return typeof v === 'number' ? `${num(v)}%` : null;
    case 'effort.drivers.scrambling': return v === 'none' ? 'No scrambling' : v === 'hands_occasional' ? 'Hands now and then' : v === 'hands_needed' ? 'Hands needed' : v === 'climbing' ? 'Climbing' : null;
    case 'adult_time_min': case 'on_site_min': return Array.isArray(v) && v.length === 2 ? durRange(v as [number, number]) : null;
    case 'child_time_min': {
      if (!Array.isArray(v)) return null;
      return v.map((c) => (isObj(c) && Array.isArray(c.range) ? `from ${c.from_age}: ${durRange(c.range as [number, number])}` : '')).filter(Boolean).join('; ') || null;
    }
    case 'toilets': {
      if (!Array.isArray(v)) return null;
      const w: Record<string, string> = { start: 'at the start', route: 'on the route', payoff: 'at the payoff', none: 'none', on_board: 'on board', station: 'at the station' };
      return v.map((x) => w[String(x)] ?? humanise(String(x))).join(', ');
    }
    case 'water': return v === 'potable' ? 'Drinking water' : v === 'treat' ? 'Treat water first' : v === 'none' ? 'None' : null;
    case 'food': return v === 'hut' ? 'Hut' : v === 'cafe' ? 'Cafe' : v === 'none' ? 'None' : null;
    case 'shade': return v === 'full' ? 'Full' : v === 'partial' ? 'Partial' : v === 'none' ? 'None' : null;
    case 'signal': return v === 'good' ? 'Good' : v === 'patchy' ? 'Patchy' : v === 'none' ? 'None' : null;
    case 'change_rooms': case 'showers': case 'picnic': case 'baby_change': return v === true ? 'Yes' : v === false ? 'None' : null;
    case 'bail_out': {
      if (v === 'committing') return 'None: once started you are committed';
      return Array.isArray(v) ? v.map((b) => (isObj(b) ? `${b.name} at ${num(Number(b.at_km))} km` : '')).filter(Boolean).join('; ') : null;
    }
    case 'access_season': {
      if (!Array.isArray(v)) return null;
      return v.map((a) => (isObj(a) ? `${cap(String(a.via))}: ${a.status} ${mmdd(String(a.from))} to ${mmdd(String(a.to))}${typeof a.note === 'string' ? ` (${a.note})` : ''}` : '')).filter(Boolean).join('; ');
    }
    case 'participation.weather_cancel': {
      if (!isObj(v)) return null;
      const causes = ((v.causes as string[] | undefined) ?? []).map((c) => WEATHER_LABEL[c] ?? humanise(c));
      const policy = v.policy === 'refund' ? ' · refund' : v.policy === 'rebook' ? ' · rebook' : v.policy === 'credit' ? ' · credit' : '';
      // a record can name no cause and still say something ("closures can occur in adverse weather"): that sentence is the value, never the raw object
      const status = typeof v.status === 'string' ? v.status.trim() : '';
      if (!causes.length && status) return `${cap(status)}${policy}`;
      return causes.length ? `${causes.join(', ')}${policy}` : null;
    }
    case 'hazards': return Array.isArray(v) ? v.map((h) => (isObj(h) ? String(h.note) : '')).filter(Boolean).join('; ') : null;
    case 'exposure': {
      if (!isObj(v)) return null;
      const lvl = v.level === 'none' ? 'No exposure' : `${cap(String(v.level))} exposure`;
      const fence = v.fenced === 'fenced' ? ', fenced' : v.fenced === 'partly' ? ', partly fenced' : v.fenced === 'unfenced' ? ', unfenced' : '';
      return `${lvl}${fence}${typeof v.where === 'string' ? ` (${v.where})` : ''}`;
    }
    case 'altitude_m': return typeof v === 'number' ? `${Math.round(v)} m` : null;
    case 'walk_m': return typeof v === 'number' ? `${Math.round(v)} m` : null;
    case 'participation.kit_provided': return Array.isArray(v) ? `${v.map((k) => KIT_LABEL[String(k)] ?? humanise(String(k))).join(', ')} provided` : null;
    case 'participation.wear': return Array.isArray(v) ? v.map((k) => humanise(String(k))).join(', ') : null;
    case 'water_safety.class': return isObj(v) ? `Class ${v.value}` : null;
    case 'water_safety.lifejacket': return v === 'provided_all_sizes' ? 'Provided in all sizes' : v === 'provided_adult_only' ? 'Adult sizes only' : v === 'bring_own' ? 'Bring your own' : v === 'not_provided' ? 'Not provided' : null;
    case 'water_safety.child_sizes_from_kg': return typeof v === 'number' ? `${num(v)} kg` : null;
    case 'water_safety.lifeguard': return v === true ? 'Lifeguard on duty' : v === false ? 'No lifeguard' : null;
    case 'water_safety.entry': return v === 'shallow_gradual' ? 'Shallow, gradual' : v === 'steps_or_ladder' ? 'Steps or ladder' : v === 'drop_off' ? 'Drop-off' : null;
    case 'water_safety.water_temp_c': return Array.isArray(v) && v.length === 2 ? `${v[0]}–${v[1]} °C` : null;
    case 'water_safety.current_or_tide': return v === 'none' ? 'None' : typeof v === 'string' ? cap(v) : null;
    case 'ext.lift.last_up': case 'ext.lift.last_down':
      return Array.isArray(v) ? v.map((r) => (isObj(r) ? `${mmdd(String(r.from))} to ${mmdd(String(r.to))}: ${r.time}` : '')).filter(Boolean).join('; ') : null;
    default:
      // an extension field named *_min holds minutes
      if (/_min$/.test(path) && Array.isArray(v) && v.length === 2) return durRange(v as [number, number]);
      return null;
  }
}

/** A generic read for an extension field or a value no formatter names. */
function generic(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return num(v);
  if (typeof v === 'string') return cap(humanise(v));
  if (Array.isArray(v)) {
    if (v.length === 2 && v.every((x) => typeof x === 'number')) return `${v[0]}–${v[1]}`;
    return v.map(generic).filter(Boolean).join(', ');
  }
  if (isObj(v)) {
    const parts = Object.entries(v).filter(([, x]) => x !== null && x !== undefined).map(([k, x]) => `${humanise(k)} ${generic(x)}`);
    return parts.join(' · ');
  }
  return String(v);
}

// ---- reading the record ------------------------------------------------------------------------------------------------

interface Ctx {
  rec: SuitabilityRecord;
  block: Obj;
  ext: Obj | undefined;
  mark: (path: string) => 'R' | 'A' | 'N';
  operated: boolean;
  lookup: SourceLookup;
  scrub: TextScrub;
  words: Words;
  where: string;
}

/** The raw value at a path: the block's, then the extension's. */
const at = (c: Ctx, path: string): unknown => valueAt(c.block, c.ext, path);

function wrap(c: Ctx, path: string, raw: unknown): PVal | null {
  if (isRawVal(raw)) return pval(raw as RawVal, c.lookup, c.scrub, `${c.where} ${path}`);
  return null;
}

/** Answered: a value, no_limit, none_stated or searched_none. A gap or an absent field is not. */
function answered(raw: unknown): boolean {
  if (raw === undefined || raw === null) return false;
  if (isRawVal(raw)) return raw.state !== 'gap' && (raw.state !== 'not_applicable' || !!raw.note);
  if (typeof raw === 'string') return raw.length > 0;
  if (Array.isArray(raw)) return raw.length > 0;
  if (isObj(raw)) {
    const subs = Object.values(raw).filter(isRawVal);
    return subs.length === 0 ? Object.keys(raw).length > 0 : subs.some(answered);
  }
  return true;
}

/** One row of a group. Returns null when the field is N, or A and absent (it goes to the closing line instead). */
function rowFor(c: Ctx, path: string): SuitRow | { missingA: string } | null {
  const m = c.mark(path);
  if (m === 'N') return null;
  const label = labelOf(path);
  const raw = at(c, path);
  const isAnswered = answered(raw);
  if (!isAnswered) {
    if (m === 'A') return { missingA: label.toLowerCase() };
    const text = c.operated && LIMIT_PATHS.slice(0, 7).includes(path) ? c.words.gapLimits : c.words.gap;
    return { key: path, label, text, look: 'gap', val: null, gap: true, honesty: null, short: text };
  }
  const v = wrap(c, path, raw);
  // composite objects (access_detail, a plain string) have no wrapper of their own
  if (!v) {
    if (typeof raw === 'string') {
      const text = c.scrub.text(raw, `${c.where} ${path}`);
      return { key: path, label, text, look: 'advice', val: null, gap: false, honesty: null, short: text };
    }
    if (path === 'access_detail' && isObj(raw)) {
      const bits: string[] = [];
      const g = (k: string): unknown => (isRawVal(raw[k]) ? (raw[k] as RawVal).v : undefined);
      if (typeof g('surface') === 'string') bits.push(String(g('surface')));
      if (typeof g('max_gradient_pct') === 'number') bits.push(`up to ${num(g('max_gradient_pct') as number)}% gradient`);
      if (typeof g('steps') === 'number') bits.push(`${g('steps')} steps`);
      if (typeof g('width_min_cm') === 'number') bits.push(`${g('width_min_cm')} cm wide at the narrowest`);
      const text = bits.join(' · ') || generic(raw);
      return { key: path, label, text, look: 'info', val: null, gap: false, honesty: null, short: text };
    }
    if (path === 'stroller_extent') return null;
    const text = generic(raw);
    return { key: path, label, text, look: 'info', val: null, gap: false, honesty: null, short: text };
  }
  const honesty = v.conflicts.length > 0 ? 'Sources disagree' : null;
  const base = { key: path, label, val: v, gap: false, honesty };
  if (v.state === 'searched_none') {
    const when = v.searched ? ` · searched ${longDate(v.searched)}` : '';
    // a place with no operator (a free waterfall) has no one to state or ask: it is a gap, in the words of every gap, "Not checked yet" (3.57)
    if (!c.operated) return { key: path, label, text: c.words.gap, look: 'gap', val: null, gap: true, honesty: null, short: c.words.gap };
    const text = `${c.words.searchedNone}${when} · ask before booking`;
    return { ...base, text, look: 'sentence', short: `${label.toLowerCase()} not stated` };
  }
  if (v.state === 'none_stated') {
    const text = `${label} not stated${v.read ? ` · read ${longDate(v.read)}` : ''}`;
    return { ...base, text, look: 'sentence', short: `${label.toLowerCase()} not stated` };
  }
  if (v.state === 'no_limit') {
    const text = path === 'min_age' ? c.words.noLimit : `No ${label.toLowerCase()} limit`;
    return { ...base, text, look: 'rule', short: text };
  }
  if (v.state === 'not_applicable') {
    const text = v.note ?? 'Does not apply';
    return { ...base, text, look: 'info', short: text };
  }
  const described = describe(path, v.value, c);
  let text = described ?? generic(v.value);
  // ageless rule words: "8" -> "8 and over" read in the row, the chip says "Age 8+"
  if (path === 'min_age' && typeof v.value === 'number') text = `${v.value}`;
  const look: SuitRow['look'] = v.look === 'rule' ? 'rule' : v.look === 'advice' ? 'advice' : 'info';
  // pregnancy ask_doctor / not_recommended are advice, even in the limits group
  const rowLook = path === 'participation.pregnancy' && (v.value === 'ask_doctor' || v.value === 'not_recommended') ? 'advice' : look;
  return { ...base, text, look: rowLook, short: shortOf(path, label, text, v.value) };
}

/** "Shuttle 1 Jun – 12 Oct": an access season line in its short form, with no raw key and no cut word (S3). */
function seasonShort(value: unknown): string {
  const lines = Array.isArray(value) ? value.filter((l): l is Obj => isObj(l) && typeof l.from === 'string' && typeof l.to === 'string') : [];
  return lines
    .map((l) => {
      const via = typeof l.via === 'string' && l.via !== 'road' ? cap(humanise(l.via)) : '';
      const status = typeof l.status === 'string' && l.status !== 'open' ? cap(humanise(l.status)) : '';
      return `${[status || via || 'Open', status && via ? via.toLowerCase() : ''].filter(Boolean).join(' ')} ${mmdd(String(l.from))} – ${mmdd(String(l.to))}`;
    })
    .join('; ');
}

function shortOf(path: string, label: string, text: string, value?: unknown): string {
  switch (path) {
    case 'access_season': return seasonShort(value) || text;
    // the hazards and the exposure are the warning line above the groups, and section 3 says them again: the echo never repeats them
    case 'hazards': case 'exposure': return '';
    case 'toilets': return text === 'none' ? 'no toilets' : `toilets ${text}`;
    case 'water': return text === 'None' ? 'no water' : text.toLowerCase();
    case 'food': return text === 'None' ? 'no food' : `food: ${text.toLowerCase()}`;
    case 'shade': return `shade ${text.toLowerCase()}`;
    case 'signal': return `signal ${text.toLowerCase()}`;
    case 'effort.source_grade': return text;
    default: return `${label.toLowerCase()}: ${text}`;
  }
}

function group(c: Ctx, id: GroupId, paths: string[], title?: string): SuitGroup | null {
  const rows: SuitRow[] = [];
  const missing: string[] = [];
  let anyAsked = false;
  for (const p of paths) {
    const r = rowFor(c, p);
    if (!r) continue;
    anyAsked = true;
    if ('missingA' in r) missing.push(r.missingA);
    else rows.push(r);
  }
  if (!anyAsked) return null; // all N: not drawn, no marker (D9)
  return { id, title: title ?? GROUP_TITLE[id], open: id === 'limits' || id === 'who', rows, closing: missing.length ? `${c.words.closingPrefix}${missing.join(', ')}` : null };
}

// ---- the chips -------------------------------------------------------------------------------------------------------

const val = (c: Ctx, path: string): RawVal | null => {
  const raw = at(c, path);
  return isRawVal(raw) ? raw : null;
};

function chipLabel(kind: ChipKind, text: string, basisLabel: string | null, field: string | null): string {
  switch (kind) {
    case 'rule': return `${basisLabel === 'official rule' ? 'Official rule' : 'Operator rule'}: ${text}`;
    case 'advice': return `Our judgement: ${text}`;
    case 'gap': return `Not checked yet: ${field ? labelOf(field).toLowerCase() : text}`;
    case 'fits': return `Fits: ${text}`;
    case 'advice_fail': return `Our judgement: ${text}`;
    case 'rule_fail': return `Operator rule: ${text}`;
    default: return text;
  }
}

/** A lone dashed chip names what is missing (S11). */
const KIDS_GAP = 'Kids: not checked yet';

function gapChip(c: Ctx, field: string, text?: string): Chip {
  const t = text ?? c.words.gap;
  return { kind: 'gap', text: t, glyph: 'none', label: chipLabel('gap', t, null, field), field, extra: 0 };
}

interface LimitItem { text: string; field: string; basis: string | null }

/** Slot 1 from limits: the values of every rule limit, searched-none R limits as "x not stated", and the count of bans past three. */
function limitsChip(c: Ctx): Chip | null {
  const items: LimitItem[] = [];
  const rule = (path: string): { v: unknown; basis: string | null } | null => {
    const x = val(c, path);
    if (!x || x.state !== 'value' || !x.basis || !['operator_rule', 'official_rule'].includes(x.basis)) return null;
    return { v: x.v, basis: x.basis };
  };
  const soft = (path: string): boolean => {
    const x = val(c, path);
    return !!x && (x.state === 'searched_none' || x.state === 'none_stated') && c.mark(path) === 'R';
  };
  const ageRuleIsAdvice = c.block.age_rule === 'recommendation';

  const minAge = ageRuleIsAdvice ? null : rule('min_age');
  const minAgeV = val(c, 'min_age');
  if (minAge && typeof minAge.v === 'number') items.push({ text: ageLabel('fit', minAge.v, 'rule'), field: 'min_age', basis: minAge.basis });
  else if (minAgeV?.state === 'no_limit') items.push({ text: c.words.noLimit, field: 'min_age', basis: minAgeV.basis ?? 'operator_rule' });
  else if (soft('min_age')) items.push({ text: 'age not stated', field: 'min_age', basis: null });
  const maxAge = ageRuleIsAdvice ? null : rule('max_age');
  if (maxAge && typeof maxAge.v === 'number') items.push({ text: `up to age ${maxAge.v}`, field: 'max_age', basis: maxAge.basis });

  const pair = (lo: string, hi: string, unit: string, noun: string): void => {
    const a = rule(lo);
    const b = rule(hi);
    const av = a && typeof a.v === 'number' ? a.v : null;
    const bv = b && typeof b.v === 'number' ? b.v : null;
    const basis = (a ?? b)?.basis ?? null;
    if (av !== null && bv !== null) items.push({ text: `${num(av)}–${num(bv)} ${unit}`, field: lo, basis });
    else if (av !== null) items.push({ text: `${num(av)} ${unit} min`, field: lo, basis });
    else if (bv !== null) items.push({ text: `${num(bv)} ${unit} max`, field: hi, basis });
    else if (soft(lo) || soft(hi)) items.push({ text: `${noun} not stated`, field: lo, basis: null });
  };
  pair('min_weight_kg', 'max_weight_kg', 'kg', 'weight');
  pair('min_height_cm', 'max_height_cm', 'cm', 'height');

  const swim = rule('water_safety.swim_ability');
  if (swim && (swim.v === 'tested' || swim.v === 'comfortable')) items.push({ text: 'swim test', field: 'water_safety.swim_ability', basis: swim.basis });
  const adult = rule('adult_required');
  if (adult && isObj(adult.v) && typeof adult.v.under === 'number') items.push({ text: `Under ${adult.v.under} with an adult`, field: 'adult_required', basis: adult.basis });
  const solo = rule('solo');
  if (solo && isObj(solo.v)) {
    const bits = [typeof solo.v.min_age === 'number' ? `alone from ${solo.v.min_age}` : '', typeof solo.v.min_height_cm === 'number' ? `alone from ${solo.v.min_height_cm} cm` : ''].filter(Boolean);
    if (bits.length) items.push({ text: bits[0]!, field: 'solo', basis: solo.basis });
  }
  const guide = rule('participation.guide');
  if (guide && guide.v === 'required') items.push({ text: 'guide required', field: 'participation.guide', basis: guide.basis });
  const driver = rule('participation.driver');
  if (driver && isObj(driver.v) && typeof driver.v.min_age === 'number') items.push({ text: `driver ${driver.v.min_age}+`, field: 'participation.driver', basis: driver.basis });

  // bans that are not in the first three still count (D4): pregnancy not allowed, medical exclusions, waiver is kit not a ban
  let bans = 0;
  const preg = rule('participation.pregnancy');
  if (preg && preg.v === 'not_allowed') bans += 1;
  const med = rule('participation.medical');
  if (med && isObj(med.v) && Array.isArray(med.v.excluded) && med.v.excluded.length > 0) bans += 1;

  // stated limits only: an "x not stated" item rides along only when nothing is stated at all (R4-T4)
  if (items.some((i) => i.basis !== null)) for (let i = items.length - 1; i >= 0; i--) if (items[i]!.basis === null) items.splice(i, 1);
  if (items.length === 0 && bans === 0) return null;
  const shown = items.slice(0, 3);
  const extra = Math.max(0, items.length - 3) + bans;
  if (shown.length === 0) {
    // only pregnancy or medical bans exist: the chip is the count itself
    const text = bans === 1 ? 'See rules' : `${bans} rules`;
    return { kind: 'rule', text, glyph: 'lock', label: chipLabel('rule', text, 'operator rule', null), field: null, extra: 0 };
  }
  const text = shown.map((i) => i.text).join(' · ');
  const real = shown.some((i) => i.basis !== null) || bans > 0;
  const basis = shown.find((i) => i.basis)?.basis ?? 'operator_rule';
  // a chip of only "x not stated" values is not a rule: it is the gap look of a searched-none limit, drawn as a rule-less value
  if (!real) return { kind: 'value', text, glyph: 'person', label: text, field: shown[0]!.field, extra };
  const basisLabel = basis === 'official_rule' ? 'official rule' : 'operator rule';
  return { kind: 'rule', text, glyph: 'lock', label: chipLabel('rule', `${text}${extra ? ` and ${extra} more` : ''}`, basisLabel, null), field: shown[0]!.field, extra };
}

function adviceChip(c: Ctx, long: boolean): Chip | null {
  const x = val(c, 'age_band');
  if (!x || x.state !== 'value' || !isObj(x.v) || typeof x.v.from !== 'number') return null;
  const word = ageLabel('fit', x.v.from, 'advice');
  const text = long ? `${word} · our judgement` : word;
  return { kind: 'advice', text, glyph: 'person', label: chipLabel('advice', word, null, 'age_band'), field: 'age_band', extra: 0 };
}

/** The grade system as a short name beside the grade: the registry label is a description ("A local word on a valley or park page"), which is a glossary entry, not a name. */
const SHORT_SYSTEM: Record<string, string> = { local: 'Local grade', operator: "Operator's grade", other: 'Other grade', 'bike-path': 'Cycle path', flatwater: 'Flatwater' };
export const systemName = (system: string): string => SHORT_SYSTEM[system] ?? (DEFAULT_MAP.systems.find((s) => s.id === system)?.label ?? system).replace(/\s*\([^)]*\)/g, '').replace(/,.*$/, '').trim();
const SYSTEM_LABEL = systemName;

function effortParts(c: Ctx, loc: Located | null): { grade: 1 | 2 | 3 | 4 | 5 | null; source: string | null } {
  const e = deriveEffort({ kind: c.rec.kind, subkind: c.rec.subkind, operated: c.rec.operated, block: c.block as never, ext: c.ext as never }, DEFAULT_MAP);
  const asked = loc ? markOf(loc.profile, 'effort.source_grade', c.operated) !== 'N' || markOf(loc.profile, 'water_safety.class', c.operated) === 'R' : e.family_effort !== null;
  if (!asked) return { grade: null, source: null };
  const src = e.source_grade ? `${SYSTEM_LABEL(e.source_grade.system)} ${humanise(String(e.source_grade.value))}` : null;
  return { grade: e.family_effort, source: src };
}

function timeText(c: Ctx): string | null {
  const adult = valOf(c.block.adult_time_min as never) as [number, number] | null;
  if (adult) return durRange(adult);
  return null;
}

function slot2(c: Ctx, loc: Located | null): { chip: Chip | null; effort: { grade: 1 | 2 | 3 | 4 | 5; name: string; sourceGrade: string | null } | null } {
  const { grade, source } = effortParts(c, loc);
  if (grade !== null) {
    const name = effortName(grade);
    const time = timeText(c);
    const base = `${name} · ${source ?? 'our grade'}`;
    const text = time ? `${base} · ${time}` : base;
    return {
      chip: { kind: 'value', text, textNoTime: base, glyph: 'gauge', label: text, field: 'effort.source_grade', extra: 0 },
      effort: { grade, name, sourceGrade: source },
    };
  }
  // effort is N: the time, with the kind's grade when it has one (the water class for paddling)
  const klass = valOf((c.block.water_safety as Obj | undefined)?.class as never) as { value: string } | null;
  const onWater = valOf((c.ext && (c.ext as Obj).on_water_min) as never) as [number, number] | null;
  const site = valOf(c.block.on_site_min as never) as [number, number] | null;
  const ride = valOf((c.ext && (c.ext as Obj).ride_min) as never) as [number, number] | null;
  const flight = valOf((c.ext && (c.ext as Obj).flight_min) as never) as [number, number] | null;
  const walkM = valOf(c.block.walk_m as never) as number | null;
  const landing = valOf((c.ext && (c.ext as Obj).landing) as never) as { where: string; min: number } | null;
  const parts: string[] = [];
  if (klass) parts.push(`Class ${klass.value}`);
  if (onWater) parts.push(`${durRange(onWater)} on water`);
  else if (ride) parts.push(`${durRange(ride)} ride`);
  else if (flight) parts.push(`${durRange(flight)} flight`);
  else if (site) parts.push(site[0] === site[1] ? `About ${dur(site[0])} on site` : `${durRange(site)} on site`);
  if (landing && parts.length) parts.push(`stop at ${landing.where}`);
  if (parts.length === 0 && walkM !== null) parts.push(`${Math.max(1, Math.round(walkM / 80))} min from the car`);
  if (parts.length > 0) {
    const text = parts.join(' · ');
    return { chip: { kind: 'value', text, glyph: onWater || klass ? 'wave' : 'clock', label: text, field: onWater ? 'ext.paddle.on_water_min' : 'on_site_min', extra: 0 }, effort: null };
  }
  // a missing R slot keeps its place as the gap chip
  for (const p of ['on_site_min', 'adult_time_min', 'walk_m']) if (c.mark(p) === 'R') return { chip: gapChip(c, p), effort: null };
  return { chip: null, effort: null };
}

const BRAKE: Record<string, string> = { self: 'You brake yourself', guide: 'Guide brakes for you', automatic: 'Automatic braking' };
const VESSEL: Record<string, string> = { enclosed: 'Enclosed boat', part_open: 'Part-open boat', open: 'Open boat', rib: 'Rigid inflatable' };

/** The third chip, chosen by the type's slot-3 property and formatted by that property. */
function slot3(c: Ctx, key: string | null): Chip | null {
  if (!key) return null;
  const m = c.mark(key);
  if (m === 'N') return null;
  const raw = at(c, key);
  const x = isRawVal(raw) ? raw : null;
  const miss = (): Chip | null => (m === 'R' ? gapChip(c, key) : null);
  if (!x || x.state === 'gap') return miss();
  if (x.state !== 'value' && x.state !== 'no_limit') {
    const text = `${labelOf(key)} not stated`;
    return { kind: 'value', text, glyph: 'none', label: text, field: key, extra: 0 };
  }
  const v = x.v;
  let text: string | null = null;
  let glyph: Glyph = 'none';
  switch (key) {
    case 'stroller': {
      const s = describe('stroller', v, c);
      text = v === 'none' ? 'No stroller access' : v === 'smooth' ? 'Stroller OK' : s;
      if (isObj(c.block.stroller_extent) && c.block.stroller_extent.scope === 'part' && v !== 'none') {
        const e = c.block.stroller_extent;
        const note = typeof e.part_km === 'number' ? `first ${num(e.part_km)} km` : typeof e.part_note === 'string' && e.part_note.length <= 24 ? e.part_note : 'part of the way';
        text = `Stroller: ${note}`;
      }
      glyph = 'stroller';
      break;
    }
    case 'carrier_ok': text = v === true ? 'Carrier OK' : 'No carriers'; glyph = 'person'; break;
    case 'stroller_on_board': text = describe(key, v, c); glyph = 'stroller'; break;
    case 'ext.zip.braking': text = typeof v === 'string' ? (BRAKE[v] ?? null) : null; glyph = 'brake'; break;
    case 'ext.boat.vessel': text = typeof v === 'string' ? (VESSEL[v] ?? null) : null; glyph = 'boat'; break;
    case 'participation.guide': text = v === 'required' ? 'Guide required' : v === 'recommended' ? 'Guide recommended' : 'No guide needed'; glyph = 'person'; break;
    case 'participation.kit_provided': text = describe(key, v, c); glyph = 'kit'; break;
    case 'water_safety.water_temp_c': text = describe(key, v, c); glyph = 'thermometer'; break;
    case 'water_safety.lifeguard': text = describe(key, v, c); glyph = 'person'; break;
    case 'participation.driver': text = describe(key, v, c); glyph = 'person'; break;
    case 'adult_required': text = v === 'none' ? 'No adult needed' : isObj(v) && typeof v.under === 'number' ? `Adult with under-${v.under}s` : isObj(v) && typeof v.ratio === 'number' ? `One adult per ${v.ratio}` : null; glyph = 'person'; break;
    case 'exposure': if (isObj(v) && v.level === 'none' && !v.fenced) return null; text = isObj(v) && v.fenced === 'unfenced' ? 'Unfenced edge' : isObj(v) && v.fenced === 'fenced' ? 'Fenced edge' : null; glyph = 'triangle'; break;
    case 'water_safety.lifejacket': text = typeof v === 'string' ? `Life jackets: ${(describe(key, v, c) ?? '').toLowerCase()}` : null; glyph = 'kit'; break;
    case 'water_safety.child_sizes_from_kg': text = typeof v === 'number' ? `Child sizes from ${num(v)} kg` : null; glyph = 'kit'; break;
    default: {
      // a value that does not name itself ("Good") is prefixed with the property
      const d = describe(key, v, c);
      text = d ? `${labelOf(key)}: ${d}` : null;
      break;
    }
  }
  text ??= `${labelOf(key)}: ${generic(v)}`;
  return { kind: 'value', text, glyph, label: text, field: key, extra: 0 };
}

// ---- fit chip (D6) -----------------------------------------------------------------------------------------------------

const RULE_GATES: ReadonlySet<FitCheck['gate']> = new Set(['min_age', 'max_age', 'min_height', 'max_height', 'min_weight', 'max_weight']);

function fitChip(c: Ctx, party: NonNullable<SuitOptions['party']>, app: Applicability | undefined, offerIndex: number | undefined): Chip | null {
  const result = fits(c.rec, { youngestAge: party.youngestAge, relaxed: party.relaxed }, { applicability: app, offerIndex });
  const failing = result.checks.filter((k) => k.status === ('fail' as CheckStatus));
  const ruleFail = failing.find((k) => RULE_GATES.has(k.gate));
  if (ruleFail) {
    const min = ruleValOf(c.rec.suitability.min_age as never);
    const basis = (c.rec.suitability.min_age as { basis?: string } | undefined)?.basis === 'official_rule' ? 'official rule' : 'operator rule';
    const what = ruleFail.gate === 'min_age' && typeof min === 'number' ? `under ${min}` : ruleFail.gate === 'max_age' ? 'this age' : ruleFail.gate.includes('weight') ? 'this weight' : ruleFail.gate.includes('height') ? 'this height' : 'this age';
    const text = `Not for ${what} · ${basis}`;
    return { kind: 'rule_fail', text, glyph: 'none', label: chipLabel('rule_fail', text, basis, null), field: ruleFail.gate, extra: 0 };
  }
  if (failing.length > 0 || (result.fits === 'yes' && result.advice.length > 0)) {
    const text = ageLabel('advice_fail', party.youngestAge);
    return { kind: 'advice_fail', text, glyph: 'triangle', label: chipLabel('advice_fail', text, null, null), field: failing[0]?.gate ?? null, extra: 0 };
  }
  if (result.fits === 'yes') {
    const text = `Fits a ${party.youngestAge}-year-old`;
    return { kind: 'fits', text, glyph: 'check', label: chipLabel('fits', text, null, null), field: null, extra: 0 };
  }
  return null;
}

// ---- warning and research ----------------------------------------------------------------------------------------------

function warningLine(c: Ctx): string | null {
  const parts: string[] = [];
  const hz = val(c, 'hazards');
  if (hz && hz.state === 'value' && Array.isArray(hz.v)) for (const h of hz.v) if (isObj(h) && typeof h.note === 'string') parts.push(c.scrub.text(h.note, `${c.where} hazards`));
  const ex = val(c, 'exposure');
  if (ex && ex.state === 'value' && isObj(ex.v) && (ex.v.level === 'significant' || ex.v.level === 'serious') && ex.v.fenced === 'unfenced' && parts.length === 0) {
    parts.push(`${cap(String(ex.v.level))} exposure, unfenced${typeof ex.v.where === 'string' ? `: ${ex.v.where}` : ''}`);
  }
  const wc = val(c, 'participation.weather_cancel');
  if (wc && wc.state === 'value' && isObj(wc.v) && Array.isArray(wc.v.causes) && wc.v.causes.length > 0 && parts.length < 2) {
    parts.push(`Cancelled for ${wc.v.causes.map((x: unknown) => WEATHER_LABEL[String(x)] ?? humanise(String(x))).join(' and ')}`);
  }
  const line = parts.map((x) => x.replace(/[.;\s]+$/, '')).filter(Boolean).slice(0, 3).join('; ');
  return line ? line.replace(/[.;\s]+$/, '') : null;
}

function allReads(c: Ctx): string | null {
  const dates: string[] = [];
  const walk = (x: unknown): void => {
    if (isRawVal(x)) {
      const v = pval(x as RawVal, c.lookup, new TextScrub(), '');
      if (v.read) dates.push(v.read);
      return;
    }
    if (Array.isArray(x)) return;
    if (isObj(x)) Object.values(x).forEach(walk);
  };
  walk(c.block);
  if (c.ext) walk(c.ext);
  dates.sort();
  return dates.length ? dates[dates.length - 1]! : null;
}

const LEVEL_LABEL: Record<SuitLevel, string> = { draft: 'Draft', usable_partial: 'Usable, partly unverified', usable: 'Usable', complete: 'Complete' };

// ---- rows for other sections ---------------------------------------------------------------------------------------------

/**
 * The rows and closing labels for a list of suitability paths, read from one record. Sections 3, 8 and 9 of the page home
 * some suitability properties (facilities, access season, the hazards when section 4 is absent): they call this so a row has
 * the same text, look and provenance wherever it is drawn (PS1). A path the type marks N produces nothing.
 */
export function suitabilityRows(
  located: { rec: SuitabilityRecord; file: string } | null,
  paths: string[],
  opts: SuitOptions & { fallbackKind?: string } = {},
): { rows: SuitRow[]; missingA: string[] } {
  const rec = (located?.rec ?? { ref: '', kind: opts.fallbackKind ?? '', suitability: {} }) as SuitabilityRecord;
  const lookup = opts.lookup ?? lookupFor(located);
  const scrub = opts.scrub ?? new TextScrub();
  const words: Words = { ...WORDS, ...opts.words };
  const loc: Located | null = opts.suitMarks ? locatedFromMarks(opts.suitMarks) : profileOf(rec, opts.applicability);
  const operated = loc ? isOperated(loc.profile, rec.operated) : false;
  const offer = opts.offerIndex === undefined ? undefined : rec.offers?.[opts.offerIndex];
  const block = mergeBlock(rec.suitability, offer) as unknown as Obj;
  const ext = (offer?.ext ?? rec.ext) as unknown as Obj | undefined;
  const mark = (path: string): 'R' | 'A' | 'N' => (loc ? markOf(loc.profile, path, operated) : 'A');
  const c: Ctx = { rec, block, ext, mark, operated, lookup, scrub, words, where: rec.ref };
  const rows: SuitRow[] = [];
  const missingA: string[] = [];
  for (const p of paths) {
    const r = rowFor(c, p);
    if (!r) continue;
    if ('missingA' in r) missingA.push(r.missingA);
    else rows.push(r);
  }
  return { rows, missingA };
}

// ---- the entry point ---------------------------------------------------------------------------------------------------

/** The suitability row of a type from the contract, in the shape publicSuitability reads; null for a type with none. */
export function suitMarksFor(contract: Contract, typeId: string): SuitMarks | null {
  const n = contract.node(typeId);
  if (!n || !n.suitability) return null;
  return { marks: n.suitability, operated: n.operated ?? 'never' };
}

/** The synthetic profile a contract's suitability row makes, in the shape core's level and gates read. */
export function locatedFromMarks(sm: SuitMarks, name = 'contract'): Located {
  return { name, profile: { match: [], operated: sm.operated, ext: null, fields: sm.marks as Record<string, CoreMark> } };
}

/**
 * Everything "Who it suits" draws for one suitability record. `rec.suitability` is read through the merge of the chosen offer,
 * so a record with variants is read one variant at a time. Returns the model, never JSX.
 */
export function publicSuitability(located: { rec: SuitabilityRecord; file: string }, opts: SuitOptions = {}): PublicSuitability {
  const rec = located.rec;
  const lookup = opts.lookup ?? lookupFor(located);
  const scrub = opts.scrub ?? new TextScrub();
  const words: Words = { ...WORDS, ...opts.words };
  const loc: Located | null = opts.suitMarks ? locatedFromMarks(opts.suitMarks) : profileOf(rec, opts.applicability);
  const operated = loc ? isOperated(loc.profile, rec.operated) : false;
  const offer = opts.offerIndex === undefined ? undefined : rec.offers?.[opts.offerIndex];
  const block = mergeBlock(rec.suitability, offer) as unknown as Obj;
  const ext = (offer?.ext ?? rec.ext) as unknown as Obj | undefined;
  const mark = (path: string): 'R' | 'A' | 'N' => (loc ? markOf(loc.profile, path, operated) : 'A');
  const c: Ctx = { rec, block, ext, mark, operated, lookup, scrub, words, where: rec.ref };

  const check = checkRecord({ kind: rec.kind, subkind: rec.subkind, suitability: rec.suitability, ext: rec.ext, offers: rec.offers, operated: rec.operated }, opts.applicability, loc);
  const requiredCount = loc ? Object.keys(loc.profile.fields).filter((p) => mark(p) === 'R').length : 0;
  const done = Math.max(0, requiredCount - check.missingRequired.length);
  const read = allReads(c);
  const levelLabel = LEVEL_LABEL[check.level];
  const research: Research = { done, total: requiredCount, read, level: check.level, levelLabel, text: '', softSafety: check.softSafety.map((p) => labelOf(p).toLowerCase()) };
  const allMissing = requiredCount > 0 && done === 0;

  // chips
  const s2 = slot2(c, loc);
  let first: Chip | null;
  if (opts.party) first = fitChip(c, opts.party, opts.applicability, opts.offerIndex);
  else first = null;
  first ??= limitsChip(c) ?? adviceChip(c, false);
  if (!first && allMissing) first = { kind: 'gap', text: 'Family checks not done yet', glyph: 'none', label: 'Not checked yet: family checks', field: null, extra: 0 };
  if (!first && (mark('min_age') === 'R' || mark('age_band') === 'R')) first = gapChip(c, mark('age_band') === 'R' ? 'age_band' : 'min_age', operated ? words.gapLimits : KIDS_GAP);
  const chips: [Chip | null, Chip | null, Chip | null] = [first, allMissing ? null : s2.chip, allMissing ? null : slot3(c, opts.slot3 ?? null)];

  // card chips (D5): kids_from and the effort name
  const kidsFrom = kidsFromOf({ kind: rec.kind, subkind: rec.subkind, suitability: rec.suitability, ext: rec.ext, offers: rec.offers, operated: rec.operated }, opts.applicability);
  let kids: Chip | null = null;
  const minRule = c.block.age_rule === 'recommendation' ? null : ruleValOf(c.block.min_age as never);
  const band = valOf(c.block.age_band as never) as { from: number } | null;
  if (val(c, 'min_age')?.state === 'no_limit' && (band?.from ?? 0) === 0) kids = { kind: 'rule', text: words.noLimit, glyph: 'lock', label: chipLabel('rule', words.noLimit, 'operator rule', 'min_age'), field: 'min_age', extra: 0 };
  else if (kidsFrom !== null) {
    kids = typeof minRule === 'number' && minRule >= (band?.from ?? 0)
      ? { kind: 'rule', text: ageLabel('fit', minRule, 'rule'), glyph: 'lock', label: chipLabel('rule', ageLabel('fit', minRule, 'rule'), (val(c, 'min_age')?.basis === 'official_rule' ? 'official rule' : 'operator rule'), 'min_age'), field: 'min_age', extra: 0 }
      : adviceChip(c, false);
  } else if (mark('min_age') !== 'N' || mark('age_band') !== 'N') kids = gapChip(c, 'age_band', KIDS_GAP);
  const effortChip: Chip | null = s2.effort ? { kind: 'value', text: s2.effort.name, glyph: 'gauge', label: s2.effort.name, field: 'effort.source_grade', extra: 0 } : null;

  // groups, in the order of applicability 5.2
  const groups: SuitGroup[] = [];
  const push = (g: SuitGroup | null): void => void (g && groups.push(g));
  push(group(c, 'limits', LIMIT_PATHS));
  push(group(c, 'who', WHO_PATHS));
  const effortGroup = group(c, 'effort', EFFORT_PATHS);
  if (effortGroup && s2.effort) {
    // the effort row reads "Easy · Parks Canada Easy": the family-effort name, then the original grade (D2)
    const text = `${s2.effort.name} · ${s2.effort.sourceGrade ?? 'our grade'}`;
    const i = effortGroup.rows.findIndex((r) => r.key === 'effort.source_grade');
    // a missing original grade stays a gap row: the name alone is our derivation, not the source's grade
    if (i >= 0) {
      if (!effortGroup.rows[i]!.gap) effortGroup.rows[i] = { ...effortGroup.rows[i]!, text, short: text, label: 'Effort' };
    } else effortGroup.rows.unshift({ key: 'effort', label: 'Effort', text, look: 'advice', val: null, gap: false, honesty: null, short: text });
    effortGroup.closing = effortGroup.closing?.replace(/(: )effort, /, '$1').replace(/, effort$/, '').replace(/: effort$/, '') ?? null;
    if (effortGroup.closing === `${words.closingPrefix.trim()}`) effortGroup.closing = null;
  }
  push(effortGroup);
  const kindKey = typeof ext?.kind === 'string' ? ext.kind : null;
  const extPaths = kindKey ? Object.keys(ext!).filter((k) => k !== 'kind' && k !== 'note').map((k) => `ext.${kindKey}.${k}`) : [];
  // ask the kind block for every extension field the profile marks R or A, including the ones the record lacks
  const marked = loc ? Object.keys(loc.profile.fields).filter((p) => p.startsWith('ext.')) : [];
  const kindPaths = [...new Set([...marked, ...extPaths, ...KIT_PATHS_FIXED])];
  push(group(c, 'kind', kindPaths, kindKey ? (KIND_TITLE[kindKey] ?? GROUP_TITLE.kind) : GROUP_TITLE.kind));
  push(group(c, 'facilities', FACILITY_PATHS));
  push(group(c, 'when', WHEN_PATHS));

  // "13 of 13 key checks · 9 more not checked yet": the count says what the visitor sees. The key checks are the required ones; the rest
  // are the gap rows still drawn in the groups (S1, 3.49).
  const required = new Set(check.missingRequired);
  const openRows = groups.flatMap((g) => g.rows).filter((r) => r.gap);
  // the closing lines list the optional checks the visitor sees as "Not checked yet: a, b, c"; each name is one open check
  const listed = groups.reduce((n, g) => n + (g.closing ? g.closing.replace(words.closingPrefix, '').split(', ').filter(Boolean).length : 0), 0);
  const more = openRows.filter((r) => !required.has(r.key)).length + listed;
  if (requiredCount > 0) {
    research.text = `${done} of ${requiredCount} key checks${more > 0 ? ` · ${more} more not checked yet` : ''}${check.level === 'usable_partial' ? ' · usable, partly unverified' : ''}${read ? ` · read ${longDate(read)}` : ''}`;
  }

  // stroller and wheelchair at rest (S10): an answered value is a chip, a gap is not (the group below says what is missing)
  const shownFields = new Set(chips.filter((x): x is Chip => !!x).map((x) => x.field));
  const accessChips: Chip[] = [];
  for (const key of ['stroller', 'wheelchair'] as const) {
    const x = val(c, key);
    if (!x || shownFields.has(key) || c.mark(key) === 'N' || (x.state !== 'value' && x.state !== 'no_limit')) continue;
    const words2 = describe(key, x.v, c);
    if (!words2) continue;
    const text = key === 'stroller' ? (/stroller/i.test(words2) ? words2 : `Stroller: ${words2.toLowerCase()}`) : `Wheelchair: ${words2.toLowerCase()}`;
    accessChips.push({ kind: 'advice', text, glyph: key === 'stroller' ? 'stroller' : 'wheel', label: chipLabel('advice', text, null, key), field: key, extra: 0 });
  }
  const adultRaw = at(c, 'adult_time_min');
  const adultV = isRawVal(adultRaw) ? wrap(c, 'adult_time_min', adultRaw) : null;
  const adultTime = adultV && adultV.state === 'value' && Array.isArray(adultV.value) && adultV.value.length === 2 ? { text: durRange(adultV.value as [number, number]), basis: adultV.basisLabel || 'our research' } : null;

  return {
    ref: rec.ref,
    chips,
    warning: warningLine(c),
    research,
    groups,
    card: { kids, effort: effortChip },
    accessChips,
    adultTime,
    kidsFrom,
    familyEffort: s2.effort,
    allMissing,
  };
}
