// The name of the public trip a converted trip was made from, from its slug: "canadian-rockies-2029" reads "Canadian Rockies". The
// slug is all a converted document keeps of our trip (`seed`, STEP2-C1), so Mine and the cover use this where a copy had the catalogue's
// title. A tiny file on purpose: the trip page's start code and Mine both import it.
const MONTHS = /-(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*$/;

export function fromTripName(slug: string): string {
  const base = slug.replace(/-\d{4}$/, '').replace(MONTHS, '');
  return base
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
