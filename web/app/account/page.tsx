import { Suspense } from 'react';
import { connection } from 'next/server';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ButtonLink } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { RowSkeleton } from '@/components/ui/Skeleton';
import { capabilities } from '@/lib/capabilities';
import { getUser } from '@/lib/auth/server';
import { loadDrafts } from '@/lib/server/drafts';
import { safeError } from '@/lib/server/safe-error';
import { dataEnv } from '@/lib/server/neon-env';
import { pageMetadata } from '@/lib/site';
import { AccountDrafts } from './AccountDrafts';
import { SignOutButton } from './SignOutButton';

export const metadata = pageMetadata({ title: 'Account', description: 'Your account and saved trip drafts.', path: '/account/', noindex: true });

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

async function AccountBody() {
  // Request time only. During `next build` connection() never resolves, so nothing below runs at build.
  await connection();
  const user = await getUser();
  // Fails closed: no session (or auth unconfigured/unreachable) shows the signed-out state, never a list.
  if (!user) return <SignedOut />;

  let loaded: Awaited<ReturnType<typeof loadDrafts>> | null = null;
  let failed = false;
  try {
    loaded = await loadDrafts(user.id);
  } catch (e) {
    console.error('[account] loadDrafts failed', safeError(e));
    failed = true;
  }

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <h1 className="account-title">
            Account
            {loaded ? <span className="account-count"> &middot; {loaded.rows.length} {loaded.rows.length === 1 ? 'draft' : 'drafts'}</span> : null}
          </h1>
          <p className="account-identity">Signed in as {user.email}</p>
        </div>
        <SignOutButton />
      </header>

      {failed || !loaded ? (
        <ErrorState
          title="We couldn't load your drafts."
          detail="The service may be briefly unavailable."
          cached={
            <Link className="account-retry" href="/account/">
              Try again
            </Link>
          }
        />
      ) : (
        <AccountDrafts userId={user.id} initialRows={loaded.rows} sealedQuery={loaded.sealedQuery} realtimeUrl={dataEnv().realtimeUrl} />
      )}
    </div>
  );
}

export default function AccountPage() {
  if (!capabilities.signIn) return <SignedOut />;
  return (
    <Suspense
      fallback={
        <div className="account-page" aria-busy="true">
          <header className="account-head">
            <div>
              <h1 className="account-title">Account</h1>
            </div>
          </header>
          <ul className="account-list">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </ul>
        </div>
      }
    >
      <AccountBody />
    </Suspense>
  );
}
