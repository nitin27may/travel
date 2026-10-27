import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PLAN_ROW_STATES } from '@travel/core/plan/sync.ts';
import type { CopyItem } from '@travel/core/schema/copies.ts';
import { AccountCard } from '@/app/mine/AccountCard';
import { CopyRow } from '@/components/mine/CopyRow';
import { SignOutConfirm, unsentTitle } from '@/components/mine/SignOutConfirm';
import { CHIP_NAME, CHIP_WORDS, type RowChip } from '@/lib/mine/chips';
import { rowModel } from '@/lib/mine/rows';

// The row chips of signed-in Mine (edit-my-trip 4.7) in the foundation's words, the account card's line, and the sign-out question.

const item: CopyItem = {
  id: '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b', slug: 'dolomites-2027', title: 'Dolomites', days: 14, cc: 'IT', photo: null, start: '2027-07-03',
  adults: 2, children: [6], profile: null, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
};
const noop = () => undefined;
const props = { onCalendar: noop, onPrint: noop, onChangeDates: noop, onRemove: noop };
const html = (state: RowChip) => renderToStaticMarkup(<ul><CopyRow row={rowModel(item, '2026-10-25')} {...props} sync={{ state, onRetry: noop }} /></ul>);

describe('the chip states equal core\'s row states', () => {
  it('has one entry per state, in core\'s words', () => {
    expect(Object.keys(CHIP_WORDS).sort()).toEqual([...PLAN_ROW_STATES].sort());
    expect(Object.keys(CHIP_NAME).sort()).toEqual([...PLAN_ROW_STATES].sort());
  });
  it('never uses the word "saved" for a copy (foundation patterns 3.7)', () => {
    for (const w of [...Object.values(CHIP_WORDS), ...Object.values(CHIP_NAME)]) expect(w ?? '').not.toMatch(/saved/i);
  });
});

describe('a signed-in row', () => {
  it('quiet: no chip; the row\'s name says it is in the account', () => {
    const h = html('quiet');
    expect(h).not.toContain('crow-chip');
    expect(h).not.toContain('crow-retry');
    expect(h).toContain(', in your account"');
  });
  it('syncing: the chip with the small spinner inside the link; reduced motion stops the spin in the css', () => {
    const h = html('syncing');
    expect(h).toMatch(/<a [^>]*data-chip[^>]*>.*btn-spin crow-spin.*Syncing<\/span><\/a>/);
    expect(h).toContain(', syncing"');
  });
  it('offline: "Not synced yet" with a clock mark (never colour alone)', () => {
    const h = html('offline');
    expect(h).toMatch(/<a [^>]*data-chip[^>]*>.*<svg.*Not synced yet<\/span><\/a>/);
    expect(h).toContain(', not synced yet, will sync when online"');
    expect(h).not.toContain('crow-retry');
  });
  it('retry: a button beside the link (a button cannot sit in a link), with an icon and words, named for the trip', () => {
    const h = html('retry');
    expect(h).toMatch(/<button type="button" class="crow-retry" aria-label="Not synced\. Retry sending changes to Dolomites"[^>]*><span class="chip chip-caution"><svg.*Not synced · Retry<\/span><\/button>/);
    expect(h).toContain(', not synced"');
    const link = /<a [^>]*>.*<\/a>/.exec(h)![0];
    expect(link).not.toContain('<button');
    expect(link).toContain('data-retry');
  });
  it('device: "On this device", as today', () => {
    const h = html('device');
    expect(h).toContain('On this device');
    expect(h).toContain(', on this device only"');
  });
});

describe('the account card line (4.7)', () => {
  const card = (note?: { text: string; warn?: boolean } | null) => renderToStaticMarkup(<AccountCard signIn email="a@b.com" note={note} />);
  it('flag off: the old sentence, exactly', () => {
    expect(card(undefined)).toContain('Copies on this device move to your account when the planner opens.');
  });
  it('flag on: the new sentence replaces it', () => {
    const h = card({ text: 'Your trips are kept in your account.' });
    expect(h).toContain('Your trips are kept in your account.');
    expect(h).not.toContain('move to your account');
  });
  it('flag on, nothing to say yet: no sentence at all', () => {
    expect(card(null)).not.toContain('mine-card-note');
  });
  it('signed out: the old card is unchanged unless changes wait', () => {
    expect(renderToStaticMarkup(<AccountCard signIn email={null} />)).not.toContain('mine-card-note');
    expect(renderToStaticMarkup(<AccountCard signIn email={null} note={{ text: 'Sign in again to finish saving 1 change.', warn: true }} />)).toContain('Sign in again to finish saving 1 change.');
  });
});

describe('the sign-out question (4.6)', () => {
  const one = { count: 1, trips: [{ id: 'a', title: 'Canadian Rockies', count: 1 }] };
  it('names the change and the trip', () => {
    expect(unsentTitle(one)).toBe('1 change to Canadian Rockies is not in your account yet.');
    expect(unsentTitle({ count: 3, trips: [{ id: 'a', title: 'A', count: 2 }, { id: 'b', title: 'B', count: 1 }] })).toBe('3 changes to 2 trips are not in your account yet.');
  });
  it('Cancel is first in tab order; Try again, then the danger action', () => {
    const h = renderToStaticMarkup(<SignOutConfirm unsent={one} offline={false} busy={false} stillWaiting={false} onTryAgain={noop} onDiscard={noop} onCancel={noop} />);
    const labels = [...h.matchAll(/<span class="btn-label">([^<]+)</g)].map((m) => m[1]);
    expect(labels).toEqual(['Cancel', 'Try again', 'Sign out and discard it']);
    expect(h).toContain('btn-danger');
    expect(h).toContain('role="alertdialog"');
  });
  it('offline says so', () => {
    const h = renderToStaticMarkup(<SignOutConfirm unsent={one} offline busy={false} stillWaiting={false} onTryAgain={noop} onDiscard={noop} onCancel={noop} />);
    expect(h).toContain('You are offline.');
  });
});
