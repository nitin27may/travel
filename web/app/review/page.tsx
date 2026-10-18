import { ReviewGate } from '@/components/review/ReviewGate';
import { pageMetadata } from '@/lib/site';

// Owner only and unlisted: no nav link, not in the sitemap, and told not to be indexed.
export const metadata = pageMetadata({
  title: 'Review',
  description: 'The owner review queue for catalog proposals. It runs on the owner machine only.',
  path: '/review/',
  noindex: true,
});

export default function ReviewPage() {
  return <ReviewGate />;
}
