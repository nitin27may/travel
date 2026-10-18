import { pageMetadata } from '@/lib/site';
import { SpecimenClient } from './SpecimenClient';

// Every foundation component in every state, for the screenshot harness and the verifier's side-by-side with
// docs/v2/design/foundation/specimen.html. Not indexed, not in the sitemap, not in any nav.
export const metadata = pageMetadata({ title: 'Specimen', description: 'Foundation components in every state.', path: '/specimen/', noindex: true });

export default function SpecimenPage() {
  return <SpecimenClient />;
}
