import { notFound } from 'next/navigation';
import { PlanFlow } from '@/components/plan/PlanFlow';
import { PLAN_BUILDER_ON } from '@/lib/plan/flag';
import { pageMetadata } from '@/lib/site';
import '@/components/plan/plan.css';

// The trip builder (TB-W1; FLOW 2 as amended by Step 2): stages 0 to 4, then Build my days hands the trip to `/t/<id>/`. A private working page:
// never indexed, nothing personal in the server HTML (everything is read in the browser). It is a page only with both flags on
// (next.config.ts `pageExtensions`), so with them off `/plan/` answers 404 as before.
export const metadata = pageMetadata({ title: 'Plan a trip', description: 'Plan your own trip: where, what to see, how many days and how far to drive.', path: '/plan/', noindex: true });

export default function PlanPage() {
  if (!PLAN_BUILDER_ON) notFound();
  return <PlanFlow />;
}
