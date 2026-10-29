// UXB-5: the Table view's markup. One real <table> per day, a caption, column headers, the time cell a row header, six head cells that the phone
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
const html = (p: Partial<Parameters<typeof DayTables>[0]> = {}) =>
  renderToStaticMarkup(<DayTables days={tlModel.days} timelines={timelines} areas={{}} mode="all" onList={() => {}} {...p} />);

describe('the Table view markup', () => {
  const h = html();
  it('is one table per day, in day order, each with a caption naming the day', () => {
    const tables = h.split('<table').slice(1);
    expect(tables.length).toBe(tlModel.days.length);
    tlModel.days.forEach((d, i) => expect(tables[i]).toContain(`<caption class="dt-cap"><span class="dt-cap-sign">Day ${String(d.n).padStart(2, '0')}</span>`));
  });
  it('has column headers with scope, six of them, and the time of each row is a row header', () => {
    const head = h.split('<thead>')[1]!.split('</thead>')[0]!;
    expect([...head.matchAll(/<th scope="col"/g)].length).toBe(6);
    expect(head).toContain('Time');
    expect(head).toContain('Notes, book');
    expect(h).toMatch(/<th scope="row" class="dt-time num">/);
  });
  it('folds kind, where and notes for phones: the three extra cells are marked, the head and the cells agree in count', () => {
    const row = h.split('<tr class="dt-row"')[1]!.split('</tr>')[0]!;
    expect([...row.matchAll(/<(?:td|th)[ >]/g)].length).toBe(6);
    expect([...row.matchAll(/class="dt-x /g)].length).toBe(3);
    expect(h.match(/<th scope="col" class="dt-x /g)!.length / tlModel.days.length).toBe(3);
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
