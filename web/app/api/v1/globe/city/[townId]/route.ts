import { respond } from '@/lib/server/respond';

export async function GET(req: Request, ctx: { params: Promise<{ townId: string }> }) {
  return respond('globeCity', req, await ctx.params);
}
