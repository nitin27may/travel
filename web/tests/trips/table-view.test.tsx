// UXB-5: the Table view's markup. One real <table> per day, a caption, column headers, the stop cell a row header, six head cells that the phone
// folds into three (CSS), and the read-only line in edit mode. Server-rendered here; the page loads the same component lazily.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { scheduleTrip } from '@travel/core/schedule/schedule.ts';
import { DEFAULT_PROFILE } from '@travel/core/schedule/types.ts';
import { DayTables, TableTools } from '@/components/trips/timeline/DayTables';
import { buildTimelineModel } from '@/components/trips/timeline/model';
import { getTrip } from '@/lib/public';

const trip = getTrip('dolomites-2027')!;
const tlModel = buildTimelineModel(trip, new Map())!;
const timelines = scheduleTrip(trip.days.map((d) => d.scheduleInput!), DEFAULT_PROFILE);
// every stop with a page has an area of its own here; `areas={{}}` is a trip whose stops have none known
const areas = Object.fromEntries(tlModel.days.flatMap((d) => d.input.variants.flatMap((v) => v.items.flatMap((i) => (i.placeSlug ? [[i.placeSlug, 'Dolomites']] : [])))));
const html = (p: Partial<Parameters<typeof DayTables>[0]> = {}) =>
  renderToStaticMarkup(<DayTables days={tlModel.days} timelines={timelines} areas={areas} mode="all" onList={() => {}} {...p} />);

describe('the Table view markup', () => {
  const h = html();
  it('is one table per day, in day order, each with a caption naming the day', () => {
    const tables = h.split('<table').slice(1);
    expect(tables.length).toBe(tlModel.days.length);
    tlModel.days.forEach((d, i) => expect(tables[i]).toContain(`<caption class="dt-cap"><span class="dt-cap-sign">Day ${d.n}</span>`));
  });
  it('has column headers with scope, six of them, and the stop of each row is the row header', () => {
    const head = h.split('<thead>')[1]!.split('</thead>')[0]!;
    expect([...head.matchAll(/<th scope="col"/g)].length).toBe(6);
    expect(head).toContain('Time');
    expect(head).toContain('Notes, book');
    expect(h).toMatch(/<td class="dt-time num">/);
    expect(h).toMatch(/<th scope="row" class="dt-what">/);
    expect(h).not.toMatch(/<th scope="row" class="dt-time/);
  });
  it('folds kind, where and notes for phones: the three extra cells are marked, the head and the cells agree in count', () => {
    const row = h.split('<tr class="dt-row"')[1]!.split('</tr>')[0]!;
    expect([...row.matchAll(/<(?:td|th)[ >]/g)].length).toBe(6);
    expect([...row.matchAll(/class="dt-x /g)].length).toBe(3);
    expect(h.match(/<th scope="col" class="dt-x /g)!.length / tlModel.days.length).toBe(3);
  });
  it('draws no Where column when no stop has an area of its own, and never puts the day\'s base in a row (PR-016)', () => {
    const none = html({ areas: {} });
    expect([...none.split('<thead>')[1]!.split('</thead>')[0]!.matchAll(/<th scope="col"/g)].length).toBe(5);
    expect(none).not.toContain('dt-where');
    const base = tlModel.days.find((d) => d.base)!;
    // the base is named once, in the caption
    expect(h).toContain(`base ${base.base}`);
    expect(h.split('<tbody>').slice(1).join('').match(new RegExp(`dt-where">${base.base}<`, 'g'))).toBeNull();
  });
  it('a drive says where it starts from under its name, not in the Where column (PR-015)', () => {
    const leg = h.split('data-leg="true"').slice(1).find((r) => r.split('</tr>')[0]!.includes('dt-from'))!;
    expect(leg.split('</tr>')[0]).toMatch(/<span class="dt-from num">from [^<]+<\/span>/);
    expect(leg.split('</tr>')[0]).toMatch(/<td class="dt-x dt-where"><\/td>/);
  });
  it('Stops only has fewer rows than Everything and drops the drives', () => {
    const rows = (s: string) => (s.match(/<tr class="dt-row"/g) ?? []).length;
    expect(rows(html({ mode: 'stops' }))).toBeLessThan(rows(h));
    // a day with stops lists only them; a day that is all travel (Day 14) keeps its drives, as the print does
    const day = (s: string, n: number) => s.split(`id="day-${n}"`)[1]!.split('</li>')[0]!;
    expect(day(html({ mode: 'stops' }), 1)).not.toContain('data-leg');
    expect(day(html({ mode: 'stops' }), 14)).toContain('data-leg');
    expect(day(h, 14)).toContain('data-leg="true"');
  });
  it('links a stop to its place page and leaves a drive as text', () => {
    expect(h).toMatch(/<a href="\/places\/[a-z0-9-]+\/">/);
    const leg = h.split('data-leg="true"')[1]!.split('</tr>')[0]!;
    expect(leg).not.toContain('<a ');
  });
  it('says nothing about editing on the public page, and in edit mode one line with a switch back to List', () => {
    expect(h).not.toContain('Editing works in List');
    const e = html({ editing: true });
    expect(e).toContain('Editing works in List.');
    expect(e).toContain('Switch to List');
    expect(e.match(/Editing works in List/g)!.length).toBe(1);
  });
  it('the tools name the two row sets and the print', () => {
    const t = renderToStaticMarkup(<TableTools mode="stops" onMode={() => {}} />);
    expect(t).toContain('Everything');
    expect(t).toContain('Stops only');
    expect(t).toContain('Print this table');
    expect(t).toMatch(/aria-checked="true"[^>]*>(?:(?!<\/button>).)*Stops only/s);
  });
});
