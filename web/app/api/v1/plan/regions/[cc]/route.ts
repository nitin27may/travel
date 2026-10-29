import { handlePlan } from '../../shared';

export async function GET(req: Request, ctx: { params: Promise<{ cc: string }> }) {
  return handlePlan('regions', req, await ctx.params);
}
