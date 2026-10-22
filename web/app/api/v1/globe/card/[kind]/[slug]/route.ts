import { respond } from '@/lib/server/respond';

export async function GET(req: Request, ctx: { params: Promise<{ kind: string; slug: string }> }) {
  return respond('globeCard', req, await ctx.params);
}
