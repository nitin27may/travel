// The invariants of "add a place to a day" (spec 3.7), checked over every ordered sequence of one to three candidate places on every
// Rockies and Dolomites day, then removing them again, and over every single candidate the picker offers on each day. Deterministic: the
// sequences take the first of each group, in model order. The round trips of the edit operations (add then remove, move then move back)
// give back the published day byte for byte.
import { describe, expect, it } from 'vitest';
import { diffTimelines } from '@travel/core/schedule/diff.ts';
import { mealWindows } from '@travel/core/schedule/rules.ts';
import { scheduleDay } from '@travel/core/schedule/schedule.ts';
import { emptyDayEdit, moveItem, removeItem, scheduleEdited, stopsOf, type EditedDay } from '@travel/core/schedule/template.ts';
import { type DayTimeline, type Profile, type ScheduleItem, type TimelineEntry } from '@travel/core/schedule/types.ts';
import { createPublicData } from '@/lib/public';

const at = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const reported = (e: TimelineEntry) => e.kind !== 'leg' && e.kind !== 'sun';
const GROUPS = [['variant', 2], ['trip', 2], ['nearby', 3]] as const;

async function load() {
  const data = createPublicData();
  const { buildTripPageModel } = await import('@/components/trips/model');
  const { candidateToItem } = await import('@/components/trips/timeline/model');
  const { listPlaces, getPlace } = await import('@/lib/public');
  const trips = ['canadian-rockies-2029', 'dolomites-2027'].map((slug) => {
    const trip = data.getTrip(slug)!;
    const m = buildTripPageModel(trip, (s) => { const p = getPlace(s); return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null; }, listPlaces());
    return { slug, trip, model: m.timeline! };
  });
  return { trips, candidateToItem };
}

const lunches = (t: DayTimeline) => t.entries.filter((e) => e.kind === 'meal' && e.sub === 'lunch').length;
const dinners = (t: DayTimeline) => t.entries.filter((e) => e.kind === 'meal' && e.sub === 'dinner').length;

/**
 * One meal of each kind at most, no negative or reversed time, and no two timed rows of one lane at once, unless the day says so: a day
 * past midnight is clamped (S_MIDNIGHT), a set time it cannot reach is kept and named (S_FIXED_MISSED).
 */
function sane(t: DayTimeline): string[] {
  const out: string[] = [];
  if (lunches(t) > 1) out.push(`${lunches(t)} lunches`);
  if (dinners(t) > 1) out.push(`${dinners(t)} dinners`);
  const late = t.warnings.some((w) => w.code === 'S_MIDNIGHT');
  for (const e of t.entries) {
    if (e.durationMin < 0 || at(e.start) < 0) out.push(`${e.id} negative time ${e.start} +${e.durationMin}`);
    else if (!late && at(e.end) < at(e.start)) out.push(`${e.id} ends ${e.end} before it starts ${e.start}`);
  }
  if (late) return out;
  for (const lane of t.lanes) {
    const rows = t.entries
      .filter((e) => (e.lane === lane || e.lane === 'all') && reported(e) && e.durationMin > 0 && !e.insideOf && !e.block)
      .sort((a, b) => at(a.start) - at(b.start));
    // a set time the day cannot reach keeps its time and says so (S_FIXED_MISSED names it): that overlap is declared, not hidden
    const missed = new Set(t.warnings.filter((w) => w.code === 'S_FIXED_MISSED').map((w) => w.entryId));
    for (let i = 1; i < rows.length; i++) if (at(rows[i]!.start) < at(rows[i - 1]!.end) && !missed.has(rows[i]!.id) && !missed.has(rows[i - 1]!.id)) out.push(`${rows[i - 1]!.id} (${rows[i - 1]!.start}-${rows[i - 1]!.end}) overlaps ${rows[i]!.id} (${rows[i]!.start})`);
  }
  return out;
}

const perms = <T,>(xs: T[], n: number): T[][] => (n === 0 ? [[]] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)], n - 1).map((r) => [x, ...r])));

describe('add a place to a day: invariants', () => {
  it('holds for every order of 1 to 3 places on every day, and removing them restores the day', async () => {
    const { trips, candidateToItem } = await load();
    let cases = 0;
    const fails: string[] = [];
    for (const { slug, trip, model } of trips) {
      const P: Profile = trip.schedule!.defaultProfile;
      for (const d of trip.days) {
        const input = d.scheduleInput!;
        const keys = model.addByDay[d.n] ?? [];
        const picked: string[] = [];
        for (const [g, n] of GROUPS) picked.push(...keys.filter((k) => model.addables[k]!.group === g).slice(0, n));
        const items = new Map<string, ScheduleItem>(picked.map((k) => [k, candidateToItem(model.addables[k]!)]));
        const cache = new Map<string, DayTimeline>();
        const T = (seq: string[]): DayTimeline => {
          const k = seq.join('|');
          if (!cache.has(k)) cache.set(k, scheduleDay(input, P, { added: seq.map((x) => items.get(x)!) }));
          return cache.get(k)!;
        };
        const base = T([]);
        const win = mealWindows(P);
        const lunchOf = (t: DayTimeline) => t.entries.filter((e) => e.kind === 'meal' && e.sub === 'lunch');
        const dinnerOf = (t: DayTimeline) => t.entries.filter((e) => e.kind === 'meal' && e.sub === 'dinner');
        for (let n = 1; n <= Math.min(3, picked.length); n++) {
          for (const seq of perms(picked, n)) {
            cases += 1;
            const tag = `${slug} day ${d.n} +${seq.join(',')}`;
            const bad = (msg: string) => fails.push(`${tag}: ${msg}`);
            const after = T(seq);
            if (new Set(after.entries.map((e) => e.id)).size !== after.entries.length) bad('entry ids collide');
            const before = T(seq.slice(0, -1));
            // a dinner that cannot hold, or is dropped, because of what was added is said so in a warning that names it
            const said = after.warnings.some((w) => w.code === 'S_DINNER_LATE');
            // one lunch and one dinner, as the plan had them; dinner by 19:30 unless the plan's own was later; lunch where it can be eaten
            // a day pushed past midnight (S_MIDNIGHT) is already declared impossible in its warnings; the lunch it loses is not asserted
            const impossible = after.warnings.some((w) => w.code === 'S_MIDNIGHT');
            // the plan's own lunch row is the day's one lunch: an addition before it never draws a second (Cavell Meadows on Rockies Day 8 did)
            if (lunchOf(after).length > 1 || (!impossible && lunchOf(after).length < lunchOf(base).length)) bad(`lunch count ${lunchOf(after).length} vs ${lunchOf(base).length}`);
            for (const x of sane(after)) bad(x);
            if (dinnerOf(after).length > 1 || (dinnerOf(after).length < dinnerOf(base).length && !said)) bad(`dinner count ${dinnerOf(after).length} vs ${dinnerOf(base).length}`);
            const dn = dinnerOf(after)[0];
            const dn0 = dinnerOf(base)[0];
            if (dn && !said && at(dn.start) > Math.max(win.dinner.to + 30, dn0 ? at(dn0.start) : 0)) bad(`dinner at ${dn.start}`);
            for (const l of lunchOf(after)) if (l.addedBy === 'scheduler' && l.style !== 'on-trail' && (at(l.start) < win.lunch.from || at(l.start) > win.lunch.to + 30)) bad(`lunch at ${l.start}`);
            // authored entries never vanish; whatever else goes is reported
            const { moved, gone } = diffTimelines(before, after);
            for (const e of base.entries) if (reported(e) && e.addedBy === 'author' && !after.entries.some((x) => x.id === e.id)) bad(`authored entry ${e.id} vanished`);
            for (const g of gone) if (g.addedBy === 'author' || g.addedBy === 'visitor') bad(`${g.id} reported gone but is not generated`);
            const afterIds = new Set(after.entries.map((e) => e.id));
            for (const e of before.entries) if (reported(e) && !afterIds.has(e.id) && !gone.some((g) => g.id === e.id)) bad(`${e.id} vanished unreported`);
            // moved notes are the real difference on 5 minutes, and only for entries that moved
            for (const e of after.entries) {
              if (!reported(e)) continue;
              const w = before.entries.find((x) => x.id === e.id);
              if (!w) continue;
              const real = Math.round((at(e.start) - at(w.start)) / 5) * 5;
              if ((moved.get(e.id) ?? 0) !== real) bad(`${e.id} moved note ${moved.get(e.id) ?? 'none'} vs ${real}`);
              if (e.start === w.start && moved.has(e.id)) bad(`${e.id} has a note but did not move`);
            }
            // generated and added starts on the 5 minute grid; fixed slots stay
            for (const e of after.entries) {
              // 23:59 is where a day that runs past midnight is clamped; S_MIDNIGHT says so
              if (reported(e) && e.kind !== 'start' && e.addedBy !== 'author' && e.start !== '23:59' && at(e.start) % 5 !== 0) bad(`${e.id} starts ${e.start}`);
              if (e.time.confidence === 'fixed') {
                const w = base.entries.find((x) => x.id === e.id);
                if (w && w.start !== e.start) bad(`fixed ${e.id} moved ${w.start} to ${e.start}`);
              }
            }
            // removing the last addition gives back exactly the timeline before it
            const redo = scheduleDay(input, P, { added: seq.slice(0, -1).map((x) => items.get(x)!) });
            if (JSON.stringify(redo) !== JSON.stringify(before)) bad('removing the last addition does not restore the day');
          }
        }
        if (JSON.stringify(scheduleDay(input, P, { added: [] })) !== JSON.stringify(base)) fails.push(`${slug} day ${d.n}: empty additions differ`);
      }
    }
    console.log(`add-invariants: ${cases} cases`);
    expect(fails.slice(0, 40)).toEqual([]);
    expect(cases).toBeGreaterThan(500);
  }, 600000);

  it('holds for every candidate the picker offers on every day, alone: one lunch, one dinner, no negative time, no overlap', async () => {
    const { trips, candidateToItem } = await load();
    let cases = 0;
    const fails: string[] = [];
    for (const { slug, trip, model } of trips) {
      const P: Profile = trip.schedule!.defaultProfile;
      for (const d of trip.days) {
        const input = d.scheduleInput!;
        const base = scheduleDay(input, P);
        for (const x of sane(base)) fails.push(`${slug} day ${d.n} as published: ${x}`);
        for (const k of model.addByDay[d.n] ?? []) {
          cases += 1;
          const item = candidateToItem(model.addables[k]!);
          // the picker's two ways in: placed by cheapest insertion, and put after a stop (the edit session's add after)
          for (const x of sane(scheduleDay(input, P, { added: [item] }))) fails.push(`${slug} day ${d.n} +${k}: ${x}`);
          const day: EditedDay = { input, base: {}, edit: emptyDayEdit() };
          for (const s of stopsOf(day, P).filter((s) => s.lane === 'main')) {
            const t = scheduleEdited({ ...day, edit: { removed: [], placed: [{ item, addedBy: 'visitor', at: { after: s.item.id } }] } }, P);
            for (const x of sane(t)) fails.push(`${slug} day ${d.n} +${k} after ${s.item.id}: ${x}`);
          }
        }
      }
    }
    console.log(`add-invariants, every candidate: ${cases} cases`);
    expect(fails.slice(0, 40)).toEqual([]);
    expect(cases).toBeGreaterThan(200);
  }, 600000);
});

describe('edit round trips give back the published day byte for byte', () => {
  it('add then remove, and move a stop then move it back, on every Rockies and Dolomites day', async () => {
    const { trips, candidateToItem } = await load();
    const fails: string[] = [];
    let cases = 0;
    for (const { slug, trip, model } of trips) {
      const P: Profile = trip.schedule!.defaultProfile;
      for (const d of trip.days) {
        const day: EditedDay = { input: d.scheduleInput!, base: {}, edit: emptyDayEdit() };
        const want = JSON.stringify(scheduleEdited(day, P));
        const tag = `${slug} day ${d.n}`;
        // add (by insertion, and after each stop) then remove
        for (const k of (model.addByDay[d.n] ?? []).slice(0, 4)) {
          const item = candidateToItem(model.addables[k]!);
          const ins: EditedDay = { ...day, base: { added: [item] } };
          const back = removeItem(ins, P, item.id);
          cases += 1;
          if (!back || JSON.stringify(back.timeline) !== want) fails.push(`${tag} +${k} by insertion, removed: not the published day`);
          for (const s of stopsOf(day, P).filter((s) => s.lane === 'main')) {
            const put: EditedDay = { ...day, edit: { removed: [], placed: [{ item, addedBy: 'visitor', at: { after: s.item.id } }] } };
            const r = removeItem(put, P, item.id);
            cases += 1;
            if (!r || JSON.stringify(r.timeline) !== want) fails.push(`${tag} +${k} after ${s.item.id}, removed: not the published day`);
          }
        }
        // move each stop of the party's lane to the end and to the start, then back after the stop it followed
        const main = stopsOf(day, P).filter((s) => s.lane === 'main').map((s) => s.item.id);
        main.forEach((id, i) => {
          for (const to of ['end', 'start'] as const) {
            const there = moveItem(day, day, P, id, to);
            if (!there) { fails.push(`${tag} move ${id} to ${to}: refused`); continue; }
            const home = moveItem(there.to.day, there.to.day, P, id, i === 0 ? 'start' : { after: main[i - 1]! });
            cases += 1;
            if (!home || JSON.stringify(home.to.timeline) !== want) fails.push(`${tag} move ${id} to ${to} and back: not the published day`);
          }
        });
      }
    }
    console.log(`edit round trips: ${cases} cases`);
    expect(fails.slice(0, 40)).toEqual([]);
    expect(cases).toBeGreaterThan(300);
  }, 600000);
});
