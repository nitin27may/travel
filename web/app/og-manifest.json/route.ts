import { listPlaces, listTrips } from '@/lib/public';

// Build input for scripts/og.mjs, which composes one share image per trip and place after `next build` and then deletes
// this file from the export. Not linked, not in the sitemap.
//
// It lists every slug, title and Commons photo URL in one uncapped body, so it answers only while the build prerenders it (NEXT_PHASE is set by
// Next then). og.mjs deletes the prerendered body, and under `next start` the route would otherwise be rebuilt on the first request and
// served to anyone (audit GB-B-2): there it answers 404.
export const dynamic = 'force-static';

export function GET(): Response {
  if (process.env.NEXT_PHASE !== 'phase-production-build') return new Response('Not found', { status: 404 });
  const items = [
    ...listTrips().map((t) => ({ kind: 'trips', slug: t.slug, title: t.title, sub: ['Trip', t.region].filter(Boolean).join(' · '), photo: t.cover ? { url: t.cover.url, author: t.cover.author, licence: t.cover.licence } : null })),
    ...listPlaces().map((p) => ({ kind: 'places', slug: p.slug, title: p.name, sub: [p.kindLabel, p.areaLabel].filter(Boolean).join(' · '), photo: p.photo ? { url: p.photo.url, author: p.photo.author, licence: p.photo.licence } : null })),
  ];
  return Response.json({ items });
}
