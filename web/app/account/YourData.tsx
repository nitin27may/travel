import { PRIVACY_CONTACT } from '@/app/privacy/PrivacyBody';
import { AccountSection } from './AccountSections';

/** `GET /api/account/profile/export/` exists (ACCT-P3), so the link is drawn. */
export const EXPORT_READY = true;

/** Your data (AP-31). The delete line is today's way until F17's button ships; it lives here only (Ways to sign in no longer repeats it). */
export function YourData() {
  return (
    <AccountSection id="your-data" title="Your data">
      {EXPORT_READY ? (
        <p className="acct-line">
          <a className="acct-link" href="/api/account/profile/export/" download>
            Download my data
          </a>
        </p>
      ) : null}
      <p className="acct-note">
        To delete your account, email <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.
      </p>
    </AccountSection>
  );
}
