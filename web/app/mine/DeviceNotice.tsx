import { Banner } from '@/components/ui/Banner';
import { Button, ButtonLink } from '@/components/ui/Button';

/** The signed-out device notice after the list (spec 7). "Got it" snoozes it; sign-in off leaves "Got it" alone. */
export function DeviceNotice({ signIn, onGotIt }: { signIn: boolean; onGotIt: () => void }) {
  return (
    <Banner
      kind="notice"
      className="mine-notice"
      action={
        <span className="mine-notice-actions">
          {signIn ? (
            <ButtonLink href="/sign-in/?next=%2Fmine%2F" size="sm">
              Sign in
            </ButtonLink>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onGotIt}>
            Got it
          </Button>
        </span>
      }
    >
      Your trips and favourites are kept in this browser only. Clearing browser data, using a private window or switching devices loses them, and some browsers clear site data after a few weeks without a visit.{signIn ? ' Sign in to keep them in your account.' : ''}
    </Banner>
  );
}
