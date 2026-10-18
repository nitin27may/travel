import { listPlaces, listTrips } from '@/lib/public';

// Build input for scripts/og.mjs, which composes one share image per trip and place after `next build` and then deletes
// this file from the export. Not linked, not in the sitemap.
export const dynamic = 'force-static';

export function GET(): Response {
  const items = [
    ...listTrips().map((t) => ({ kind: 'trips', slug: t.slug, title: t.title, sub: ['Trip', t.region].filter(Boolean).join(' · '), photo: t.cover ? { url: t.cover.url, author: t.cover.author, licence: t.cover.licence } : null })),
    ...listPlaces().map((p) => ({ kind: 'places', slug: p.slug, title: p.name, sub: [p.kindLabel, p.areaLabel].filter(Boolean).join(' · '), photo: p.photo ? { url: p.photo.url, author: p.photo.author, licence: p.photo.licence } : null })),
  ];
  return Response.json({ items });
}
