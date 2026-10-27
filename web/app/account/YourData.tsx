import { PRIVACY_CONTACT } from '@/app/privacy/PrivacyBody';
import { AccountSection } from './AccountSections';

/** ACCT-P3 builds `GET /api/account/export/` and switches this on; until then the link would 404, so it is not drawn. */
export const EXPORT_READY = false;

/** Your data (AP-31). The delete line is today's way until F17's button ships. */
export function YourData() {
  return (
    <AccountSection id="your-data" title="Your data">
      {EXPORT_READY ? (
        <p className="acct-line">
          <a className="acct-link" href="/api/account/export/" download>
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
