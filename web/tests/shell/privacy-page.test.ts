import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { metadata } from '@/app/privacy/page';
import { PrivacyBody } from '@/app/privacy/PrivacyBody';
import { sitemapInput } from '@/lib/sitemap';
import { WEB } from '../helpers/built';

const render = (google: boolean, googleSignIn = false) => renderToStaticMarkup(createElement(PrivacyBody, { google, googleSignIn }));
const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/\u2019/g, "'");
const html = render(false);
const text = strip(html);

describe('the privacy page (GSI-P)', () => {
  it('is public: indexable, with its own canonical path', () => {
    expect(metadata.robots).toBeUndefined();
    expect(String(metadata.alternates?.canonical)).toMatch(/\/privacy\/$/);
    expect(html).toContain('<h1>Privacy</h1>');
  });

  it('names each service the site uses and what it does with it', () => {
    for (const t of [
      'Cloudflare Web Analytics', 'sets no cookies', 'which site linked to them', 'country, browser, operating system and kind of device', 'It runs only on the live site',
      'Reading the site sets no cookies', 'Signing in sets cookies', 'Vercel', 'request logs', 'deletes them after a limited time', 'Neon', 'trip drafts you save',
      'your name if you give one', 'your password, if you set one, in a scrambled form', 'Turnstile',
      'Resend only to send alerts to the site owner', 'The pages hold no household data', 'Removing your account', 'Last changed 27 October 2026',
    ]) expect(text, t).toContain(t);
    expect(text).toContain('email nitin27may@gmail.com');
    expect(html).toContain('href="mailto:nitin27may@gmail.com"');
  });

  it('says what the sign-in guard keeps and sends, as the code does it (review EML-S SF6)', () => {
    for (const t of [
      // Keys are the address, the IP and the two together (core/src/quota/keys.ts), not a network range.
      'for each email address, for each IP address, and for the two together',
      // quota_take() purges keyed rows 48 h after their window ends, only when it runs (0011_quota.sql); day windows make that 72 h.
      'deleted at the next sign-in attempt by anyone once it is two days past its period', 'at most three days after your attempt',
      'are kept for 35 days',
      // lib/server/turnstile.ts sends remoteip to siteverify.
      'our server sends Cloudflare your IP address with the check',
      // The EML-P wording of "Decision 25 Oct" (email spec).
      "Sign-in, confirmation and password reset emails are sent by Neon, which runs our sign-in, from auth@mail.myneon.app under the name Neon Auth. They use Neon's standard wording. We don't send these emails ourselves yet.",
    ]) expect(text, t).toContain(t);
    for (const t of ['each network', 'within two days']) expect(text, t).not.toContain(t);
  });

  it('names Google Maps only when a Google map family is on', () => {
    expect(text).not.toContain('Google');
    const on = render(true);
    expect(strip(on)).toContain('Trip maps use Google Maps');
    expect(on).toContain('href="https://policies.google.com/privacy"');
  });

  it('"What we keep" lands on the Accounts heading (copy page 63)', () => {
    expect(html).toContain('<h2 id="accounts">Accounts</h2>');
  });

  it('lists the sign-in notes kept on this device, never a password, a code or (in storage) an address beyond the reset hand-off', () => {
    for (const t of ['auth.lastMethod', 'auth.resetEmail', 'never your address', 'never a password or a code', 'when you close the tab']) expect(text, t).toContain(t);
    expect(text).not.toContain('auth.google');
  });

  it('the account profile and travellers, as spec 10.2 words it (ACCT-P3)', () => {
    for (const t of [
      'Your browser also keeps a few things on this device: light or dark, km or miles, saved views, trips you copy, and who is travelling (the number of adults and children\'s ages). They stay on the device. If you sign in, the travellers you save to your account are copied to this browser and removed from it when you sign out.',
      'travel.party',
      'If you choose to save your travellers, we keep the number of adults and each child\'s age with the date you entered it, so the ages move on each year, and a date of birth only if you add one; no names. Adults\' ages are optional. Trips then plan for the right ages on any device. Only you can see them. Trips you save to your account keep the party you planned them for (adults and children\'s ages). You can change or remove your travellers on your account page at any time, and download everything we hold about you there. Removed data leaves our backups when they expire.',
      'pressing Save is your consent',
      'You can delete any saved trip and remove your saved travellers on your account page.',
    ]) expect(text, t).toContain(t);
    // The travellers paragraph sits right after the first Accounts paragraph, before the guard paragraph.
    expect(text.indexOf('trip drafts you save')).toBeLessThan(text.indexOf('If you choose to save your travellers'));
    expect(text.indexOf('If you choose to save your travellers')).toBeLessThan(text.indexOf('To stop repeated guessing'));
    // Google is still named only when it is in use.
    expect(text).not.toContain('Google');
  });

  it('with Continue with Google on: what Google sends, what we keep, and how to stop it (copy page 59 to 62, GSI-R M1)', () => {
    const on = render(false, true);
    const t = strip(on);
    expect(t).toContain(
      'If you use Continue with Google, Google tells us your name, your email address, whether Google has confirmed it, and a link to your Google profile photo. We keep them with your account. We do not show your name on any page and we do not use the photo. We never see your Google password, contacts, calendar or files, and we ask Google for nothing else.',
    );
    expect(t).toContain('To stop Google sharing your details with us, remove Trip Plans at myaccount.google.com/permissions (opens in a new tab) . That does not delete your account here; see "Removing your account" below.'.replace(/"/g, '\u201c').replace('\u201cRemoving your account\u201c', '\u201cRemoving your account\u201d'));
    expect(on).toContain('href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer"');
    for (const k of ['auth.lastMethod', 'auth.resetEmail', 'auth.googlePending', 'auth.googleBefore', 'an emailed code, a password or Google']) expect(t, k).toContain(k);
    // String 61 (Neon keeps Google's tokens) waits for U6.
    expect(t).not.toContain('sign-in tokens');
    expect(on).toContain('<h2 id="accounts">Accounts</h2>');
  });

  it('edit mode and account trips: what is kept on the device and in the account, only while each flag is on (review STEP2-ES ES-005)', () => {
    // flag off: neither is described
    for (const t of ['travel.trip-edit', 'When you are signed in, your trips']) expect(text, t).not.toContain(t);
    const edit = strip(renderToStaticMarkup(createElement(PrivacyBody, { google: false, tripEdit: true })));
    for (const t of [
      'When you change a trip you copied, this browser keeps your changes with it: the stops you remove or move, the days you add or drop, the places you mark Maybe and your notes (travel.trip-edit.device). They are deleted when you remove the trip from My trips.',
      'This tab also keeps your last 50 changes to each trip so you can undo them (travel.trip-edit.undo); they are deleted when you close the tab.',
    ]) expect(edit, t).toContain(t);
    expect(edit).not.toContain('When you are signed in, your trips');
    const both = strip(renderToStaticMarkup(createElement(PrivacyBody, { google: false, tripEdit: true, accountTrips: true })));
    for (const t of [
      // edit-my-trip 7, word for word
      "When you are signed in, your trips, their dates and who is going (adults and children's ages) are kept in your account so you can open them on any device. Only you can read them. Delete a trip or your account to remove them.",
      'Trips you copied on this device before signing in move into your account, with their changes and notes, and leave this device; a trip that cannot move stays here.',
      "When you sign out, this browser deletes its copy of your account's trips and the changes this tab could undo.",
      'They are deleted when you remove the trip from My trips or it moves into your account.',
    ]) expect(both, t).toContain(t);
    // the account paragraph sits in Accounts, after the travellers paragraph
    expect(both.indexOf('If you choose to save your travellers')).toBeLessThan(both.indexOf('When you are signed in, your trips'));
    expect(both.indexOf('<h2 id="accounts">')).toBe(-1);
  });

  it('the privacy page passes the edit and account trips flags through', () => {
    const page = readFileSync(path.join(WEB, 'app', 'privacy', 'page.tsx'), 'utf8');
    expect(page).toContain('tripEdit={tripEditFlag()}');
    expect(page).toContain('accountTrips={accountTripsFlag()}');
  });

  it('the privacy page passes the Google sign-in flag through', () => {
    expect(readFileSync(path.join(WEB, 'app', 'privacy', 'page.tsx'), 'utf8')).toContain('googleSignIn={authFlags.signInGoogle}');
  });

  it('does not claim owner approval', () => {
    for (const f of ['page.tsx', 'PrivacyBody.tsx']) expect(readFileSync(path.join(WEB, 'app', 'privacy', f), 'utf8'), f).not.toMatch(/owner-approved|approved wording/);
  });

  it('has one h1 and links to the terms', () => {
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain('href="/terms"');
  });

  it('is in the sitemap', () => expect(sitemapInput([], []).fixed).toContain('/privacy/'));

  it('has a footer link, and the footer is on every page through the layout', () => {
    const footer = readFileSync(path.join(WEB, 'components', 'shell', 'SiteFooter.tsx'), 'utf8');
    expect(footer).toContain('<Link href="/privacy/">Privacy</Link>');
    expect(readFileSync(path.join(WEB, 'app', 'layout.tsx'), 'utf8')).toContain('<SiteFooter />');
  });
});
