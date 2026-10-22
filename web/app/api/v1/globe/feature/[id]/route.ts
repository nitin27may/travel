import { respond } from '@/lib/server/respond';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return respond('globeFeature', req, await ctx.params);
}
