import { buildGlobeFiles } from '@/lib/globe/data';

// The light pins of one country (name, kind, slug, position, area path), written at build time and loaded when that country opens.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams(): { cc: string }[] {
  // `output: export` refuses an empty list (the privacy fixture has no places), so one placeholder file is built then.
  const ccs = Object.keys(buildGlobeFiles().pins);
  return (ccs.length ? ccs : ['none']).map((cc) => ({ cc }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ cc: string }> }) {
  const { cc } = await params;
  return Response.json(buildGlobeFiles().pins[cc] ?? []);
}
