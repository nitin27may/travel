import { respond } from '@/lib/server/respond';

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return respond('nearbyForPlace', req, await ctx.params);
}
