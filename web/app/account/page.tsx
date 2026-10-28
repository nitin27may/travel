import { Suspense } from 'react';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ButtonLink } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { RowSkeleton } from '@/components/ui/Skeleton';
import { capabilities } from '@/lib/capabilities';
import { getUser } from '@/lib/auth/server';
import { maskAddress } from '@/lib/auth/auth-errors';
import { accountLanding } from '@/lib/auth/landing-server';
import { authFlags } from '@/lib/auth/flags';
import { accountWays, googleAddedNow } from '@/lib/auth/ways-server';
import { AUTH_WAYS, GOOGLE_SIGN_IN } from '@travel/core/config/auth-limits.ts';
import { DEFAULT_RETURN, returnPath } from '@/lib/auth/return-path';
import { readDrafts, type DraftRow } from '@/lib/server/drafts';
import { loadProfile, type AccountProfile } from '@travel/core/db/profile.ts';
import { isoDay } from '@travel/core/schema/travellers.ts';
import { accountHash } from '@travel/core/favourites/account.ts';
import { displayName } from '@/lib/account/name';
import { safeError } from '@/lib/server/safe-error';
import { pageMetadata } from '@/lib/site';
import { AccountSection } from './AccountSections';
import { ProfileSection } from './ProfileSection';
import { SavedTrips } from './SavedTrips';
import { SetupCard, type SetupStep } from './SetupCard';
import { TravellersSection } from './TravellersSection';
import { YourData } from './YourData';
import { SignInMethods } from './SignInMethods';
import { SignInNotice } from './SignInNotice';
import { SignOutButton } from './SignOutButton';

export const metadata = pageMetadata({ title: 'Account', description: 'Your account settings.', path: '/account/', noindex: true });

// Request time only: never prerender or cache a page that belongs to one user.
export const dynamic = 'force-dynamic';

function SignedOut() {
  return (
    <div className="account-page account-signed-out">
      <span className="empty-glyph" aria-hidden="true">
        <Icon name="user" size={32} />
      </span>
      <h1>Account</h1>
      <p className="auth-sub">Sign in to see and save your trip drafts.</p>
      <div className="auth-actions">
        <ButtonLink href="/sign-in/" variant="primary">
          Sign in
        </ButtonLink>
        <ButtonLink href="/sign-up/">Create an account</ButtonLink>
      </div>
    </div>
  );
}

type ProfileRead = { kind: 'ok'; profile: AccountProfile } | { kind: 'missing' } | { kind: 'failed' };

/**
 * The profile row. Fails closed: a read that throws shows the error state, never a guess (ACCT-PC: no setup card on a failed read).
 * A database without migration 0012 (SQLSTATE 42P01) is the one expected failure before the migration is applied: the page then
 * shows the name section only and logs a fixed code.
 */
async function readProfile(userId: string): Promise<ProfileRead> {
  try {
    return { kind: 'ok', profile: await loadProfile(userId) };
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === '42P01') {
      console.warn('[account] profile_table_missing');
      return { kind: 'missing' };
    }
    console.error('[account] loadProfile failed', safeError(e));
    return { kind: 'failed' };
  }
}

async function readSaved(userId: string): Promise<{ kind: 'ok'; rows: DraftRow[] } | { kind: 'failed' }> {
  try {
    return { kind: 'ok', rows: await readDrafts(userId) };
  } catch (e) {
    console.error('[account] readDrafts failed', safeError(e));
    return { kind: 'failed' };
  }
}

async function AccountBody({ next, added, step }: { next: string; added: boolean; step: SetupStep }) {
  // Request time only. During `next build` connection() never resolves, so nothing below runs at build.
  await connection();
  // Fresh at Neon, not the 300 s session cookie (review ACCT-PSEC S1): a revoked session shows signed out and a name saved on another
  // device shows at once. A Server Component cannot write the renewed cookie, so a throw falls back to the cached read for display.
  const user = await getUser(undefined, { fresh: true, cachedOnThrow: true });
  // Fails closed: no session (or auth unconfigured/unreachable) shows the signed-out state, never a list.
  if (!user) return <SignedOut />;
  const landing = await accountLanding(user);
  // GSI-WAYS: the rows of "Ways to sign in" (the same list-accounts read as the landing). The return of Add Google (`?added=google`)
  // with a Google row from the last minutes says string 35 in the section instead of the landing notice 25: the parameter only picks
  // the wording, the rows decide that Google was added.
  const ways = await accountWays(user);
  const justAdded = googleAddedNow(added, ways);

  // Each read fails on its own: a page that cannot read one section still shows the others (spec 2.5).
  const [profile, drafts] = await Promise.all([readProfile(user.id), readSaved(user.id)]);
  // The name as rendered (spec 4.3, review S5): it can reach the session without our checks (Google, a direct update-user call).
  const name = displayName(user.name);
  // The owner tag of the party this page writes to the browser (review B2): a hash, never the id.
  const owner = await accountHash(user.id);

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <h1 className="account-title">Account</h1>
          <p className="account-identity">Signed in as {user.email}</p>
        </div>
        <SignOutButton />
      </header>

      {!justAdded && (landing === 'new' || landing === 'linked') ? (
        <SignInNotice kind={landing} masked={maskAddress(user.email)} next={next === DEFAULT_RETURN ? null : next} />
      ) : null}

      {profile.kind === 'failed' ? (
        <AccountSection id="profile" title="Profile">
          <ErrorState
            title="We couldn't load your profile."
            detail="The service may be briefly unavailable."
            cached={
              <Link className="account-retry" href="/account/">
                Try again
              </Link>
            }
          />
        </AccountSection>
      ) : profile.kind === 'ok' && profile.profile.setupDoneAt === null ? (
        // First run (spec 2.3): the card is the Profile and Travellers sections until it is finished or skipped. Only a successful read
        // shows it: a failed read never asks a set-up person again, and a database without migration 0012 never reaches this branch.
        <SetupCard userId={user.id} owner={owner} initialName={name} revision={profile.profile.revision} initialStep={step} />
      ) : (
        <>
          <AccountSection id="profile" title="Profile">
            <ProfileSection userId={user.id} initialName={name} />
          </AccountSection>
          {profile.kind === 'ok' ? (
            <AccountSection id="travellers" title="Travellers">
              <TravellersSection
                key={profile.profile.revision}
                userId={user.id}
                owner={owner}
                travellers={profile.profile.travellers}
                invalid={profile.profile.travellersInvalid}
                revision={profile.profile.revision}
                today={isoDay(new Date())}
              />
            </AccountSection>
          ) : null}
        </>
      )}

      <SignInMethods rows={ways} masked={maskAddress(user.email)} googleOn={authFlags.signInGoogle} justAdded={justAdded} />

      {drafts.kind === 'ok' ? (
        <SavedTrips userId={user.id} initialRows={drafts.rows} />
      ) : (
        <AccountSection id="saved-trips" title="Saved trips">
          <ErrorState
            title="We couldn't load your saved trips."
            detail="The service may be briefly unavailable."
            cached={
              <Link className="account-retry" href="/account/">
                Try again
              </Link>
            }
          />
        </AccountSection>
      )}

      <YourData />
    </div>
  );
}

/**
 * `next` (GSI-1; Google spec 3 and 7.4): Continue with Google always lands here, because only `/account/*` runs the verifier exchange in
 * `proxy.ts`, with the page it started from as `next`. A refused value is never echoed and leaves the visitor here.
 *
 * The stop (GSI-2; copy page W3, Q-GC3): a checked `next` is followed at once only for a returning sign-in. A new account, or Google
 * just added to an existing one, stays here with its notice and a Continue button to `next`; rows that cannot be read also stay here
 * (fail closed, without a notice). The landing comes from Neon's account rows (`accountLanding`), never from the address.
 */
export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!capabilities.signIn) return <SignedOut />;
  const params = await searchParams;
  const next = returnPath(params.next);
  const added = params[AUTH_WAYS.addedParam] === GOOGLE_SIGN_IN.provider;
  const step: SetupStep = params.setup === 'travellers' ? 'travellers' : 'name';
  if (next !== DEFAULT_RETURN) {
    const user = await getUser();
    if (user && (await accountLanding(user)) === 'returning') redirect(next);
  }
  return (
    <Suspense
      fallback={
        <div className="account-page" aria-busy="true">
          <header className="account-head">
            <div>
              <h1 className="account-title">Account</h1>
            </div>
          </header>
          {['Profile', 'Travellers', 'Saved trips'].map((title) => (
            <section key={title} className="acct-section" aria-label={title}>
              <h2 className="acct-h">{title}</h2>
              <ul className="account-list">
                <RowSkeleton />
              </ul>
            </section>
          ))}
        </div>
      }
    >
      <AccountBody next={next} added={added} step={step} />
    </Suspense>
  );
}
