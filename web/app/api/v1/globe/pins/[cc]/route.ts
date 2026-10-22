import { respond } from '@/lib/server/respond';

export async function GET(req: Request, ctx: { params: Promise<{ cc: string }> }) {
  return respond('globePins', req, await ctx.params);
}
