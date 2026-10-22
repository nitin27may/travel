import { respond } from '@/lib/server/respond';

export const GET = (req: Request) => respond('globeTree', req);
