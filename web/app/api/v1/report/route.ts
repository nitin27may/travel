import { respond } from '@/lib/server/respond';

export const POST = (req: Request) => respond('report', req);
