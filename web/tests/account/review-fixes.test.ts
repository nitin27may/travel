// The Account review's fixes as pure rules (review ACCT-PR, 27 Oct 2026): the words a grown-up child is shown with (SF1), one notice at a
// time (SF2), My trips' rows and their "Changed" line (MF1), the bare chips and the retry sentence of Mine (SF10, SF11), and the guard's
// log keys (review ACCT-PSEC N6). The behaviour in a browser is travellers.browser.test.ts and profile.browser.test.ts.
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => '/account/' }));
vi.mock('@/app/account/actions', () => ({ saveTravellers: vi.fn(), removeTravellers: vi.fn() }));

import { firstNotice, NOTICE_ORDER, planNote, shownParty } from '@/app/account/TravellersSection';
import { newestTrips } from '@/app/account/AccountTrips';
import { changedLabel } from '@/lib/mine/rows';
import { chipsBare, retryAnnouncement } from '@/lib/mine/chips';
import { deniedLogKey } from '@/lib/auth/guard';
import { AGE_OR_DOB_COPY, issuesOf } from '@/lib/account/travellers-form';
import { partyText } from '@travel/core/trips/party.ts';
import { ACCOUNT_PAGE } from '@travel/core/config/account.ts';
import type { Travellers } from '@travel/core/schema/travellers.ts';
import type { SyncSnapshot } from '@/lib/mine/sync';

const TODAY = '2026-10-27';
const doc: Travellers = { schema: 'travellers/1', adults: 2, children: [{ age: 17, age_as_of: '2025-10-01' }, { age: 9, age_as_of: TODAY }] };

describe('SF1: a child now 18 reads 18 everywhere while the notice is open', () => {
  it('the summary uses the real age for the children the notice is about, and the plan note says what trips do', () => {
    expect(partyText(shownParty(doc, TODAY, [0]))).toBe('2 adults · 2 children (18, 9)');
    expect(planNote(doc, TODAY, [0])).toBe('Trips plan for the 18-year-old as 17 until you choose below.');
  });
  it('kept as a child (not in the list): the plan age, and no note', () => {
    expect(partyText(shownParty(doc, TODAY, []))).toBe('2 adults · 2 children (17, 9)');
    expect(planNote(doc, TODAY, [])).toBeNull();
  });
});

describe('SF2: one notice at a time, in the review\'s order', () => {
  it('the order is conflict, differs, grown-up, check ages, storage blocked, then the read and save failures', () => {
    expect(NOTICE_ORDER).toEqual(['conflict', 'differs', 'grown', 'check', 'blocked', 'invalid', 'failed']);
    expect(firstNotice({ differs: true, grown: true, blocked: true })).toBe('differs');
    expect(firstNotice({ grown: true, conflict: true })).toBe('conflict');
    expect(firstNotice({ check: true, blocked: true })).toBe('check');
    expect(firstNotice({})).toBeNull();
  });
});

describe('SF8: a missing age with the date field open names both ways', () => {
  it('the issue is still "age"; the editor shows the pair wording', () => {
    expect(issuesOf({ adults: 2, adultAges: null, children: [{ age: null, dob: '', dobOpen: true }] }, TODAY).children).toEqual(['age']);
    expect(AGE_OR_DOB_COPY).toBe('Choose an age, or enter a date of birth.');
  });
});

describe('MF1: My trips on the Account page', () => {
  const item = (id: string) => ({ id }) as SyncSnapshot['items'][number];
  const row = (changedAt: string) => ({ state: 'quiet' as const, spin: false, pending: 0, changedAt });
  it('the newest changes first, at most ACCOUNT_PAGE.tripsShown', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const snap = { items: ids.map(item), rows: Object.fromEntries(ids.map((id, i) => [id, row(`2026-10-${10 + i}T00:00:00.000Z`)])) };
    expect(ACCOUNT_PAGE.tripsShown).toBe(5);
    expect(newestTrips(snap).map((i) => i.id)).toEqual(['g', 'f', 'e', 'd', 'c']);
  });
  it('"Changed 24 Oct" in the site\'s d MMM form, the year only when it is not this one; nothing for a bad time', () => {
    const now = new Date(2026, 9, 27, 12);
    expect(changedLabel(new Date(2026, 9, 24, 9).toISOString(), now)).toBe('Changed 24 Oct');
    expect(changedLabel(new Date(2025, 0, 3, 9).toISOString(), now)).toBe('Changed 3 Jan 2025');
    expect(changedLabel('not a time', now)).toBe('');
  });
});

describe('SF10 and SF11: Mine\'s chips', () => {
  it('no chip when every row is on this device or waiting offline (the card line says it); mixed lists and Retry keep theirs', () => {
    expect(chipsBare(['device', 'device'])).toBe(true);
    expect(chipsBare(['offline', 'offline'])).toBe(true);
    expect(chipsBare(['device', 'quiet'])).toBe(false);
    expect(chipsBare(['retry', 'retry'])).toBe(false);
    expect(chipsBare(['syncing'])).toBe(false);
    expect(chipsBare([])).toBe(false);
  });
  it('a row that turns "Not synced" is said by name', () => {
    expect(retryAnnouncement('Dolomites')).toBe('Dolomites: not synced. Retry is next to it.');
  });
});

describe('the guard never logs a birth or age key (ACCT-PSEC N6)', () => {
  it('denies the travellers keys the detector refuses, and any birth* key, whatever the case', () => {
    for (const k of ['ageAsOf', 'age_as_of', 'AGEASOF', 'dob', 'birthDate', 'birth_year', 'BirthMonth', 'travellersConsentedAt', 'adult_ages', 'email']) expect(deniedLogKey(k), k).toBe(true);
    for (const k of ['code', 'route', 'status', 'kind']) expect(deniedLogKey(k), k).toBe(false);
  });
});
