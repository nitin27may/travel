import { handlePlan } from '../shared';

export async function GET(req: Request) {
  return handlePlan('starts', req);
}
