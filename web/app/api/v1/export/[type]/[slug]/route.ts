import { respond } from '@/lib/server/respond';

export async function GET(req: Request, ctx: { params: Promise<{ type: string; slug: string }> }) {
  return respond('getExport', req, await ctx.params);
}
