import { buildGlobeFiles } from '@/lib/globe/data';

// The card behind one pin (photo and credit included), written at build time and loaded when the pin is selected.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams(): { kind: string; slug: string }[] {
  const keys = Object.keys(buildGlobeFiles().cards).map((k) => {
    const [kind, slug] = k.split('/');
    return { kind, slug };
  });
  return keys.length ? keys : [{ kind: 'none', slug: 'none' }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind, slug } = await params;
  return Response.json(buildGlobeFiles().cards[`${kind}/${slug}`] ?? null);
}
