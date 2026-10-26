import { placePageFamily, tripPageFamily } from '@/lib/map/family';
import { pageMetadata } from '@/lib/site';
import { PrivacyBody } from './PrivacyBody';

export const metadata = pageMetadata({
  title: 'Privacy',
  description: 'What this site keeps and what it does not: page views counted without cookies, accounts only if you make one, and no household data on any public page.',
  path: '/privacy/',
});

/** Copy drafted for GSI-P; owner approval is recorded in docs/v2/PLAN.md (not yet). */
export default function PrivacyPage() {
  return <PrivacyBody google={tripPageFamily() === 'google-js' || placePageFamily() === 'google-js'} />;
}
