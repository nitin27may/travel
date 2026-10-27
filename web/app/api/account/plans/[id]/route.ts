import { deleteRoute, getRoute, putRoute } from '@/lib/server/plans';

// One copy or plan of the signed-in person: read, write with its revision, remove as a tombstone (edit-my-trip 4.1, 4.5; every rule is
// in lib/server/plans.ts). The path's id only names the row; the owner is always the session's user. Private, never cached.
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  return getRoute(request, (await ctx.params).id);
}

export async function PUT(request: Request, ctx: Ctx): Promise<Response> {
  return putRoute(request, (await ctx.params).id);
}

export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  return deleteRoute(request, (await ctx.params).id);
}
