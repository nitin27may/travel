import { respond } from '@/lib/server/respond';

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return respond('tripPlanModel', req, await ctx.params);
}
